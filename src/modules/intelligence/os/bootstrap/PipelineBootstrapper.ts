import type { EnterpriseEvidence } from '../../enterprise-model/domain/evidence';
import type { EnterpriseMentalModel } from '../../enterprise-model/domain/types';
import { validateGraphIntegrity } from '../../enterprise-model/graph/domain/invariants';
import { createEmptyEnterpriseKnowledgeGraph } from '../../enterprise-model/graph/services/operations';
import { seedModelByIndustry } from '../../enterprise-model/seeds/industrySeeder';
import {
  applyEvidenceBatch,
  createEmptyEnterpriseMentalModel,
} from '../../enterprise-model/services/modelUpdater';
import type { PipelineClock } from '../ports';
import {
  createPipelineBootstrapError,
  type PipelineBootstrapError,
} from './errors';
import {
  PipelineBootstrapCoreError,
  getPipelineBootstrapCoreIssueMessage,
  throwPipelineBootstrapCoreError,
  type PipelineBootstrapCoreIssue,
} from './PipelineBootstrapCoreErrors';
import {
  PipelineBootstrapEvidenceFactory,
  type PipelineBootstrapEvidenceContext,
} from './PipelineBootstrapEvidenceFactory';
import type { PipelineBootstrapPort } from './ports';
import type {
  BootstrapAcceptedState,
  BootstrapRejectedState,
  PipelineBootstrapFact,
  PipelineBootstrapInput,
  PipelineBootstrapState,
  PipelineInitialEvidence,
} from './types';
import {
  PIPELINE_BOOTSTRAP_SCENARIO_REGISTRY,
  PIPELINE_BOOTSTRAP_SCHEMA_VERSION,
  PIPELINE_BOOTSTRAP_VERSION,
} from './types';
import {
  validateBootstrapAcceptedState,
  validateBootstrapRejectedState,
  validatePipelineBootstrapCorrelationId,
  validatePipelineBootstrapId,
  validatePipelineBootstrapInput,
  validatePipelineBootstrapTenantId,
  validatePipelineBootstrapTimestamp,
  validatePipelineScenarioDescriptor,
} from './validators';

type BootstrapClock = Pick<PipelineClock, 'now'>;
type BootstrapEvidenceFactory = Pick<
  PipelineBootstrapEvidenceFactory,
  'create'
>;

export interface PipelineBootstrapperDependencies {
  readonly clock: BootstrapClock;
  readonly evidenceFactory: BootstrapEvidenceFactory;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) {
      deepFreeze(nested);
    }
    Object.freeze(value);
  }
  return value;
}

function cloneFact(fact: PipelineBootstrapFact): PipelineBootstrapFact {
  if (fact.valueType === 'STRING_LIST') {
    return {
      ...fact,
      value: [...fact.value],
      provenance: { ...fact.provenance },
    };
  }
  return {
    ...fact,
    provenance: { ...fact.provenance },
  };
}

function sortedFacts(
  facts: readonly PipelineBootstrapFact[]
): PipelineBootstrapFact[] {
  return facts
    .map(cloneFact)
    .sort((left, right) => left.factId.localeCompare(right.factId));
}

function buildScenarioDescriptor(input: PipelineBootstrapInput): unknown {
  const registry =
    PIPELINE_BOOTSTRAP_SCENARIO_REGISTRY[
      input.targetScenario.scenarioId
    ];

  return {
    scenarioId: input.targetScenario.scenarioId,
    scenarioVersion: input.targetScenario.scenarioVersion,
    objectiveKey: input.targetScenario.objectiveKey,
    requestedStages: [
      ...(input.targetScenario.requestedStages ??
        registry.requiredStages),
    ],
    allowedStages: [...registry.allowedStages],
    requiredStages: [...registry.requiredStages],
    stageDependencies: Object.fromEntries(
      Object.entries(registry.stageDependencies).map(
        ([stage, dependencies]) => [stage, [...dependencies]]
      )
    ),
    includedDomains: [...registry.includedDomains],
    excludedDomains: [...registry.excludedDomains],
    source: input.targetScenario.source,
    explicitSelection: true,
  };
}

function applyIndustrySeed(
  model: EnterpriseMentalModel,
  facts: readonly PipelineBootstrapFact[]
): EnterpriseMentalModel {
  for (const fact of facts) {
    if (
      fact.category === 'BUSINESS_INDUSTRY' &&
      fact.polarity === 'AFFIRMED' &&
      (fact.valueType === 'STRING' || fact.valueType === 'ENUM') &&
      typeof fact.value === 'string'
    ) {
      return seedModelByIndustry(model, fact.value);
    }
  }
  return model;
}

function buildProvenanceSummary(
  evidence: readonly PipelineInitialEvidence[]
): BootstrapAcceptedState['provenanceSummary'] {
  const observedAt = evidence.map(
    (item) => item.sourceFact.observedAt
  );
  return {
    factCount: evidence.length,
    sourceTypes: Array.from(
      new Set(
        evidence.map(
          (item) => item.sourceFact.provenance.sourceType
        )
      )
    ),
    earliestObservedAt: Math.min(...observedAt),
    latestObservedAt: Math.max(...observedAt),
  };
}

export class PipelineBootstrapper implements PipelineBootstrapPort {
  private readonly clock: BootstrapClock;
  private readonly evidenceFactory: BootstrapEvidenceFactory;

  constructor(dependencies: PipelineBootstrapperDependencies) {
    this.clock = dependencies.clock;
    this.evidenceFactory = dependencies.evidenceFactory;
  }

  public async bootstrap(
    input: PipelineBootstrapInput,
    signal?: AbortSignal
  ): Promise<PipelineBootstrapState> {
    const createdAt = this.readCreatedAt();
    const inputResult = validatePipelineBootstrapInput(input);

    if (!inputResult.valid) {
      return this.buildRejectedState(
        input,
        createdAt,
        inputResult.errors
      );
    }
    const validatedInput = inputResult.value;

    if (signal?.aborted) {
      return this.buildRejectedState(validatedInput, createdAt, [
        createPipelineBootstrapError(
          'CANCELLED',
          'Pipeline bootstrap was cancelled'
        ),
      ]);
    }

    try {
      return this.buildAcceptedState(
        validatedInput,
        createdAt
      );
    } catch (error) {
      const issue =
        error instanceof PipelineBootstrapCoreError
          ? error.issue
          : 'BOOTSTRAP_STATE_VALIDATION_FAILED';
      return this.buildRejectedState(validatedInput, createdAt, [
        this.toPublicError(issue),
      ]);
    }
  }

  private readCreatedAt(): number {
    let createdAt: unknown;
    try {
      createdAt = this.clock.now();
    } catch {
      throwPipelineBootstrapCoreError(
        'BOOTSTRAP_STATE_VALIDATION_FAILED'
      );
    }
    const result = validatePipelineBootstrapTimestamp(createdAt);
    if (!result.valid) {
      throwPipelineBootstrapCoreError(
        'BOOTSTRAP_STATE_VALIDATION_FAILED'
      );
    }
    return result.value;
  }

  private buildAcceptedState(
    input: PipelineBootstrapInput,
    createdAt: number
  ): BootstrapAcceptedState {
    const facts = sortedFacts(input.facts);
    const evidenceContext: PipelineBootstrapEvidenceContext = {
      bootstrapId: input.bootstrapId,
      tenantId: input.tenantId,
      correlationId: input.correlationId,
    };

    let initialEvidence: PipelineInitialEvidence[];
    try {
      initialEvidence = facts.map((sourceFact) => ({
        sourceFact,
        appliedEvidence: this.evidenceFactory.create(
          sourceFact,
          evidenceContext
        ),
      }));
    } catch (error) {
      if (error instanceof PipelineBootstrapCoreError) {
        throw error;
      }
      throwPipelineBootstrapCoreError(
        'BOOTSTRAP_FACT_MAPPING_FAILED'
      );
    }

    const evidenceIds = initialEvidence.map(
      (item) => item.appliedEvidence.evidenceId
    );
    if (
      evidenceIds.some((evidenceId) => evidenceId.length === 0) ||
      new Set(evidenceIds).size !== evidenceIds.length
    ) {
      throwPipelineBootstrapCoreError(
        'BOOTSTRAP_EVIDENCE_DUPLICATE'
      );
    }
    const appliedEvidence = initialEvidence.map(
      (item) => item.appliedEvidence
    );
    const mentalModel = this.buildMentalModel(facts, appliedEvidence);
    const knowledgeGraph = this.buildKnowledgeGraph();
    const scenarioResult = validatePipelineScenarioDescriptor(
      buildScenarioDescriptor(input),
      input.policy
    );
    if (!scenarioResult.valid) {
      throwPipelineBootstrapCoreError(
        'BOOTSTRAP_STATE_VALIDATION_FAILED'
      );
    }

    const candidate: unknown = {
      status: 'ACCEPTED',
      bootstrapId: input.bootstrapId,
      tenantId: input.tenantId,
      correlationId: input.correlationId,
      initialDomainState: {
        mentalModel,
        knowledgeGraph,
        evidence: initialEvidence,
        scenario: scenarioResult.value,
        bootstrapId: input.bootstrapId,
        tenantId: input.tenantId,
        correlationId: input.correlationId,
        createdAt,
        schemaVersion: PIPELINE_BOOTSTRAP_SCHEMA_VERSION,
      },
      provenanceSummary: buildProvenanceSummary(initialEvidence),
      bootstrapVersion: PIPELINE_BOOTSTRAP_VERSION,
      createdAt,
    };
    const acceptedResult = validateBootstrapAcceptedState(
      candidate,
      input.policy
    );
    if (!acceptedResult.valid) {
      throwPipelineBootstrapCoreError(
        'BOOTSTRAP_STATE_VALIDATION_FAILED'
      );
    }
    return deepFreeze(acceptedResult.value);
  }

  private buildMentalModel(
    facts: readonly PipelineBootstrapFact[],
    evidence: readonly EnterpriseEvidence[]
  ): EnterpriseMentalModel {
    try {
      const seeded = applyIndustrySeed(
        createEmptyEnterpriseMentalModel(),
        facts
      );
      return applyEvidenceBatch(seeded, [...evidence]);
    } catch {
      throwPipelineBootstrapCoreError(
        'BOOTSTRAP_MODEL_BUILD_FAILED'
      );
    }
  }

  private buildKnowledgeGraph() {
    try {
      const graph = createEmptyEnterpriseKnowledgeGraph();
      validateGraphIntegrity(graph);
      return graph;
    } catch {
      throwPipelineBootstrapCoreError(
        'BOOTSTRAP_GRAPH_BUILD_FAILED'
      );
    }
  }

  private buildRejectedState(
    input: PipelineBootstrapInput,
    createdAt: number,
    errors: readonly PipelineBootstrapError[]
  ): BootstrapRejectedState {
    const bootstrapIdResult = validatePipelineBootstrapId(
      input.bootstrapId
    );
    if (!bootstrapIdResult.valid) {
      throwPipelineBootstrapCoreError('BOOTSTRAP_INPUT_INVALID');
    }
    const tenantResult = validatePipelineBootstrapTenantId(
      input.tenantId
    );
    const correlationResult = validatePipelineBootstrapCorrelationId(
      input.correlationId
    );
    const candidate: unknown = {
      status: 'REJECTED',
      bootstrapId: bootstrapIdResult.value,
      ...(tenantResult.valid
        ? { tenantId: tenantResult.value }
        : {}),
      ...(correlationResult.valid
        ? { correlationId: correlationResult.value }
        : {}),
      errors: errors.map((error) => ({ ...error })),
      bootstrapVersion: PIPELINE_BOOTSTRAP_VERSION,
      createdAt,
    };
    const rejectedResult = validateBootstrapRejectedState(candidate);
    if (!rejectedResult.valid) {
      throwPipelineBootstrapCoreError(
        'BOOTSTRAP_STATE_VALIDATION_FAILED'
      );
    }
    return deepFreeze(rejectedResult.value);
  }

  private toPublicError(
    issue: PipelineBootstrapCoreIssue
  ): PipelineBootstrapError {
    return createPipelineBootstrapError(
      issue === 'BOOTSTRAP_STATE_VALIDATION_FAILED'
        ? 'INVALID_INITIAL_DOMAIN_STATE'
        : 'BOOTSTRAP_FAILED',
      getPipelineBootstrapCoreIssueMessage(issue)
    );
  }
}
