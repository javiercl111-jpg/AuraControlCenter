import type {
  EnterpriseEvidence,
  EnterpriseMentalModel,
} from '../../enterprise-model/domain/types';
import type { EnterpriseKnowledgeGraph } from '../../enterprise-model/graph/domain/types';
import type { PipelineAggregatedState } from '../contextTypes';
import { AuraIntelligenceOSError, ErrorCodes } from '../errors';
import type {
  CheckpointProducerAuthorizerPort,
} from '../ports';
import type {
  PipelineExecutionScenario,
  PipelineStageId,
} from '../types';
import {
  canonicalizeFingerprintInput,
  canonicalizePipelineEvidenceReferences,
  createDeterministicFingerprint,
} from './integrity';
import type {
  CheckpointFingerprint,
  PipelineEvidenceReference,
  PipelineStageAdmission,
  PrecomputedPipelineCheckpoint,
} from './types';
import { validatePrecomputedPipelineCheckpoint } from './validators';

export const PRECOMPUTED_ADMISSIBLE_STAGE_IDS = [
  'EVIDENCE_EXTRACTION',
  'MENTAL_MODEL',
  'KNOWLEDGE_GRAPH',
] as const;

export type PrecomputedAdmissibleStageId =
  (typeof PRECOMPUTED_ADMISSIBLE_STAGE_IDS)[number];

export const PRECOMPUTED_STAGE_ARTIFACT_SCHEMA_VERSIONS: Readonly<
  Record<PrecomputedAdmissibleStageId, '1'>
> = Object.freeze({
  EVIDENCE_EXTRACTION: '1',
  MENTAL_MODEL: '1',
  KNOWLEDGE_GRAPH: '1',
});

export const PRECOMPUTED_EVIDENCE_SCHEMA_VERSION = '1' as const;

const FOUNDATION_STAGE_DEPENDENCIES: Readonly<
  Record<PrecomputedAdmissibleStageId, readonly PrecomputedAdmissibleStageId[]>
> = Object.freeze({
  EVIDENCE_EXTRACTION: Object.freeze([] as const),
  MENTAL_MODEL: Object.freeze(['EVIDENCE_EXTRACTION'] as const),
  KNOWLEDGE_GRAPH: Object.freeze([
    'EVIDENCE_EXTRACTION',
    'MENTAL_MODEL',
  ] as const),
});

export type CheckpointAdmissionIssueCode =
  | 'CHECKPOINT_CONTRACT_INVALID'
  | 'CHECKPOINT_PRODUCER_UNAUTHORIZED'
  | 'CHECKPOINT_CONTEXT_MISMATCH'
  | 'CHECKPOINT_FINGERPRINT_MISMATCH'
  | 'CHECKPOINT_STAGE_NOT_ALLOWED'
  | 'CHECKPOINT_DEPENDENCY_UNSATISFIED'
  | 'CHECKPOINT_RAW_INPUT_CONFLICT'
  | 'CHECKPOINT_REQUIRED_STAGE_UNSATISFIED'
  | 'CHECKPOINT_EVIDENCE_REFERENCE_INVALID'
  | 'CHECKPOINT_ARTIFACT_SCHEMA_UNSUPPORTED';

const ISSUE_MESSAGES: Readonly<Record<CheckpointAdmissionIssueCode, string>> =
  Object.freeze({
    CHECKPOINT_CONTRACT_INVALID:
      'Precomputed checkpoint contract is invalid',
    CHECKPOINT_PRODUCER_UNAUTHORIZED:
      'Precomputed checkpoint producer is not authorized',
    CHECKPOINT_CONTEXT_MISMATCH:
      'Precomputed checkpoint execution context does not match',
    CHECKPOINT_FINGERPRINT_MISMATCH:
      'Precomputed checkpoint fingerprint does not match current state',
    CHECKPOINT_STAGE_NOT_ALLOWED:
      'Precomputed checkpoint stage is not allowed by the execution scenario',
    CHECKPOINT_DEPENDENCY_UNSATISFIED:
      'Precomputed checkpoint stage dependency is not satisfied',
    CHECKPOINT_RAW_INPUT_CONFLICT:
      'Precomputed checkpoint conflicts with current raw input',
    CHECKPOINT_REQUIRED_STAGE_UNSATISFIED:
      'A required execution scenario stage cannot be satisfied',
    CHECKPOINT_EVIDENCE_REFERENCE_INVALID:
      'Precomputed checkpoint evidence reference is not available',
    CHECKPOINT_ARTIFACT_SCHEMA_UNSUPPORTED:
      'Precomputed checkpoint artifact schema version is unsupported',
  });

export class CheckpointAdmissionError extends AuraIntelligenceOSError {
  public readonly issue: CheckpointAdmissionIssueCode;

  constructor(issue: CheckpointAdmissionIssueCode, stage?: PipelineStageId) {
    super(
      ErrorCodes.INVALID_CONTRACT,
      ISSUE_MESSAGES[issue],
      false,
      stage,
      { checkpointAdmissionIssue: issue }
    );
    this.name = 'CheckpointAdmissionError';
    this.issue = issue;
    Object.setPrototypeOf(this, CheckpointAdmissionError.prototype);
  }
}

export interface CheckpointStageFingerprintContext {
  readonly tenantId: string;
  readonly correlationId: string;
  readonly scenarioId: string;
  readonly scenarioVersion: string;
  readonly evidenceRefs: readonly PipelineEvidenceReference[];
  readonly appliedEvidence: readonly EnterpriseEvidence[];
  readonly mentalModel?: EnterpriseMentalModel;
  readonly knowledgeGraph?: EnterpriseKnowledgeGraph;
}

export interface CheckpointStageFingerprints {
  readonly inputFingerprint: CheckpointFingerprint;
  readonly outputFingerprint: CheckpointFingerprint;
}

export type CheckpointAdmissionAudit = (
  event: string,
  metadata?: Readonly<Record<string, string>>
) => void;

export interface ValidateCheckpointAdmissionOptions {
  readonly checkpoint: unknown;
  readonly tenantId?: string;
  readonly correlationId?: string;
  readonly executionScenario?: PipelineExecutionScenario;
  readonly state: PipelineAggregatedState;
  readonly authorizer?: CheckpointProducerAuthorizerPort;
  readonly isStageConfigured: (stage: PipelineStageId) => boolean;
  readonly audit?: CheckpointAdmissionAudit;
}

export interface ValidatedCheckpointAdmissionPlan {
  readonly checkpoint: PrecomputedPipelineCheckpoint;
  readonly admissions: ReadonlyMap<PipelineStageId, PipelineStageAdmission>;
}

function isPrecomputedAdmissibleStage(
  stage: PipelineStageId
): stage is PrecomputedAdmissibleStageId {
  return PRECOMPUTED_ADMISSIBLE_STAGE_IDS.some(
    (candidate) => candidate === stage
  );
}

function throwAdmissionIssue(
  issue: CheckpointAdmissionIssueCode,
  stage?: PipelineStageId
): never {
  throw new CheckpointAdmissionError(issue, stage);
}

function sortEvidence(
  evidence: readonly EnterpriseEvidence[]
): EnterpriseEvidence[] {
  return [...evidence].sort((left, right) =>
    left.evidenceId.localeCompare(right.evidenceId)
  );
}

function collectAppliedEvidence(
  state: PipelineAggregatedState
): EnterpriseEvidence[] {
  const evidenceById = new Map<string, EnterpriseEvidence>();
  const candidates = [
    ...(state.evidence ?? []),
    ...Object.values(state.mentalModel?.evidences ?? {}),
  ];

  for (const evidence of candidates) {
    if (
      typeof evidence.evidenceId !== 'string' ||
      evidence.evidenceId.length === 0
    ) {
      throwAdmissionIssue('CHECKPOINT_EVIDENCE_REFERENCE_INVALID');
    }

    const existing = evidenceById.get(evidence.evidenceId);
    if (
      existing &&
      canonicalizeFingerprintInput(existing) !==
        canonicalizeFingerprintInput(evidence)
    ) {
      throwAdmissionIssue('CHECKPOINT_RAW_INPUT_CONFLICT');
    }
    evidenceById.set(evidence.evidenceId, evidence);
  }

  return sortEvidence([...evidenceById.values()]);
}

function assertEvidenceReferences(
  admission: PipelineStageAdmission,
  appliedEvidence: readonly EnterpriseEvidence[]
): void {
  const availableEvidenceIds = new Set(
    appliedEvidence.map((evidence) => evidence.evidenceId)
  );
  const referencedEvidenceIds = new Set<string>();

  for (const reference of admission.evidenceRefs) {
    if (
      reference.referenceType !== 'EVIDENCE' ||
      reference.schemaVersion !== PRECOMPUTED_EVIDENCE_SCHEMA_VERSION ||
      !availableEvidenceIds.has(reference.evidenceId)
    ) {
      throwAdmissionIssue(
        'CHECKPOINT_EVIDENCE_REFERENCE_INVALID',
        admission.stageId
      );
    }
    referencedEvidenceIds.add(reference.evidenceId);
  }

  if (
    referencedEvidenceIds.size !== availableEvidenceIds.size ||
    [...availableEvidenceIds].some(
      (evidenceId) => !referencedEvidenceIds.has(evidenceId)
    )
  ) {
    throwAdmissionIssue(
      admission.stageId === 'EVIDENCE_EXTRACTION'
        ? 'CHECKPOINT_RAW_INPUT_CONFLICT'
        : 'CHECKPOINT_EVIDENCE_REFERENCE_INVALID',
      admission.stageId
    );
  }
}

/**
 * Recalculates the exact OS-owned fingerprints used for checkpoint admission.
 *
 * EVIDENCE_EXTRACTION input binds typed evidence references to tenant,
 * correlation, and nominal scenario. Its output is the canonical applied
 * evidence set.
 *
 * MENTAL_MODEL input is the canonical applied evidence set and its output is
 * the current EnterpriseMentalModel.
 *
 * KNOWLEDGE_GRAPH input is the current EnterpriseMentalModel plus canonical
 * applied evidence, and its output is the current EnterpriseKnowledgeGraph.
 */
export function calculateCheckpointStageFingerprints(
  stage: PrecomputedAdmissibleStageId,
  context: CheckpointStageFingerprintContext
): CheckpointStageFingerprints {
  const appliedEvidence = sortEvidence(context.appliedEvidence);
  const evidenceRefs = canonicalizePipelineEvidenceReferences(
    context.evidenceRefs
  );

  if (stage === 'EVIDENCE_EXTRACTION') {
    return {
      inputFingerprint: createDeterministicFingerprint({
        contract: 'aura.os.checkpoint.stage-input.v1',
        stage,
        tenantId: context.tenantId,
        correlationId: context.correlationId,
        scenarioId: context.scenarioId,
        scenarioVersion: context.scenarioVersion,
        evidenceRefs,
      }),
      outputFingerprint: createDeterministicFingerprint({
        contract: 'aura.os.checkpoint.stage-output.v1',
        stage,
        appliedEvidence,
      }),
    };
  }

  if (!context.mentalModel) {
    throwAdmissionIssue(
      'CHECKPOINT_DEPENDENCY_UNSATISFIED',
      stage
    );
  }

  if (stage === 'MENTAL_MODEL') {
    return {
      inputFingerprint: createDeterministicFingerprint({
        contract: 'aura.os.checkpoint.stage-input.v1',
        stage,
        appliedEvidence,
      }),
      outputFingerprint: createDeterministicFingerprint({
        contract: 'aura.os.checkpoint.stage-output.v1',
        stage,
        mentalModel: context.mentalModel,
      }),
    };
  }

  if (!context.knowledgeGraph) {
    throwAdmissionIssue(
      'CHECKPOINT_DEPENDENCY_UNSATISFIED',
      stage
    );
  }

  return {
    inputFingerprint: createDeterministicFingerprint({
      contract: 'aura.os.checkpoint.stage-input.v1',
      stage,
      mentalModel: context.mentalModel,
      appliedEvidence,
    }),
    outputFingerprint: createDeterministicFingerprint({
      contract: 'aura.os.checkpoint.stage-output.v1',
      stage,
      knowledgeGraph: context.knowledgeGraph,
    }),
  };
}

function scenarioDependencies(
  scenario: PipelineExecutionScenario,
  stage: PipelineStageId
): readonly PipelineStageId[] | undefined {
  const dependencies = scenario.stageDependencies[stage];
  return Array.isArray(dependencies) ? dependencies : undefined;
}

function assertRequiredStagesCanBeSatisfied(
  scenario: PipelineExecutionScenario,
  admissions: ReadonlyMap<PipelineStageId, PipelineStageAdmission>,
  isStageConfigured: (stage: PipelineStageId) => boolean
): void {
  const allowed = new Set(scenario.allowedStages);

  const canSucceed = (
    stage: PipelineStageId,
    visiting: ReadonlySet<PipelineStageId>
  ): boolean => {
    if (admissions.has(stage)) {
      return true;
    }
    if (
      !allowed.has(stage) ||
      !isStageConfigured(stage) ||
      visiting.has(stage)
    ) {
      return false;
    }

    const dependencies = scenarioDependencies(scenario, stage);
    if (!dependencies) {
      return false;
    }
    const nextVisiting = new Set(visiting);
    nextVisiting.add(stage);
    return dependencies.every((dependency) =>
      canSucceed(dependency, nextVisiting)
    );
  };

  for (const requiredStage of scenario.requiredStages) {
    if (!allowed.has(requiredStage)) {
      throwAdmissionIssue(
        'CHECKPOINT_STAGE_NOT_ALLOWED',
        requiredStage
      );
    }
    if (!canSucceed(requiredStage, new Set())) {
      throwAdmissionIssue(
        'CHECKPOINT_REQUIRED_STAGE_UNSATISFIED',
        requiredStage
      );
    }
  }
}

function assertAdmissionDependencies(
  scenario: PipelineExecutionScenario,
  admissions: ReadonlyMap<PipelineStageId, PipelineStageAdmission>
): void {
  const visited = new Set<PipelineStageId>();
  const visiting = new Set<PipelineStageId>();

  const visit = (stage: PipelineStageId): void => {
    if (visited.has(stage)) {
      return;
    }
    if (visiting.has(stage)) {
      throwAdmissionIssue(
        'CHECKPOINT_DEPENDENCY_UNSATISFIED',
        stage
      );
    }

    const dependencies = scenarioDependencies(scenario, stage);
    if (
      !dependencies ||
      dependencies.some((dependency) => !admissions.has(dependency))
    ) {
      throwAdmissionIssue(
        'CHECKPOINT_DEPENDENCY_UNSATISFIED',
        stage
      );
    }

    if (isPrecomputedAdmissibleStage(stage)) {
      const requiredDependencies = FOUNDATION_STAGE_DEPENDENCIES[stage];
      if (
        requiredDependencies.some(
          (dependency) => !dependencies.includes(dependency)
        )
      ) {
        throwAdmissionIssue(
          'CHECKPOINT_DEPENDENCY_UNSATISFIED',
          stage
        );
      }
    }

    visiting.add(stage);
    for (const dependency of dependencies) {
      visit(dependency);
    }
    visiting.delete(stage);
    visited.add(stage);
  };

  for (const stage of admissions.keys()) {
    visit(stage);
  }
}

export function validateCheckpointForAdmission(
  options: ValidateCheckpointAdmissionOptions
): ValidatedCheckpointAdmissionPlan {
  const contractResult = validatePrecomputedPipelineCheckpoint(
    options.checkpoint
  );
  if (!contractResult.valid) {
    throwAdmissionIssue('CHECKPOINT_CONTRACT_INVALID');
  }
  const checkpoint = contractResult.value;

  if (
    !options.tenantId ||
    !options.correlationId ||
    !options.executionScenario ||
    checkpoint.tenantId !== options.tenantId ||
    checkpoint.correlationId !== options.correlationId ||
    checkpoint.scenarioId !== options.executionScenario.scenarioId ||
    checkpoint.scenarioVersion !==
      options.executionScenario.scenarioVersion
  ) {
    throwAdmissionIssue('CHECKPOINT_CONTEXT_MISMATCH');
  }

  if (!options.authorizer) {
    options.audit?.('CHECKPOINT_PRODUCER_REJECTED', {
      reason: 'AUTHORIZER_UNAVAILABLE',
    });
    throwAdmissionIssue('CHECKPOINT_PRODUCER_UNAUTHORIZED');
  }

  let producerAuthorized: boolean;
  try {
    producerAuthorized =
      options.authorizer.isAuthorized({
        producerId: checkpoint.producerId,
        producerVersion: checkpoint.producerVersion,
        tenantId: checkpoint.tenantId,
        scenarioId: checkpoint.scenarioId,
        checkpointVersion: checkpoint.checkpointVersion,
      }) === true;
  } catch {
    producerAuthorized = false;
  }

  if (!producerAuthorized) {
    options.audit?.('CHECKPOINT_PRODUCER_REJECTED', {
      reason: 'PRODUCER_UNAUTHORIZED',
    });
    throwAdmissionIssue('CHECKPOINT_PRODUCER_UNAUTHORIZED');
  }
  options.audit?.('CHECKPOINT_PRODUCER_AUTHORIZED');

  const allowedStages = new Set(options.executionScenario.allowedStages);
  const admissions = new Map<PipelineStageId, PipelineStageAdmission>();

  for (const admission of checkpoint.admissions) {
    if (!allowedStages.has(admission.stageId)) {
      throwAdmissionIssue(
        'CHECKPOINT_STAGE_NOT_ALLOWED',
        admission.stageId
      );
    }
    if (
      !isPrecomputedAdmissibleStage(admission.stageId) ||
      admission.artifactSchemaVersion !==
        PRECOMPUTED_STAGE_ARTIFACT_SCHEMA_VERSIONS[admission.stageId]
    ) {
      throwAdmissionIssue(
        'CHECKPOINT_ARTIFACT_SCHEMA_UNSUPPORTED',
        admission.stageId
      );
    }
    admissions.set(admission.stageId, admission);
  }

  if (
    admissions.size !== PRECOMPUTED_ADMISSIBLE_STAGE_IDS.length ||
    PRECOMPUTED_ADMISSIBLE_STAGE_IDS.some(
      (stage) => !admissions.has(stage)
    )
  ) {
    throwAdmissionIssue('CHECKPOINT_DEPENDENCY_UNSATISFIED');
  }

  assertAdmissionDependencies(options.executionScenario, admissions);

  if (
    admissions.has('EVIDENCE_EXTRACTION') &&
    options.state.extractionResult
  ) {
    options.audit?.('CHECKPOINT_RAW_INPUT_CONFLICT', {
      stage: 'EVIDENCE_EXTRACTION',
    });
    throwAdmissionIssue(
      'CHECKPOINT_RAW_INPUT_CONFLICT',
      'EVIDENCE_EXTRACTION'
    );
  }

  let appliedEvidence: EnterpriseEvidence[];
  try {
    appliedEvidence = collectAppliedEvidence(options.state);
  } catch (error) {
    if (error instanceof CheckpointAdmissionError) {
      if (error.issue === 'CHECKPOINT_RAW_INPUT_CONFLICT') {
        options.audit?.('CHECKPOINT_RAW_INPUT_CONFLICT');
      }
      throw error;
    }
    throwAdmissionIssue('CHECKPOINT_FINGERPRINT_MISMATCH');
  }

  for (const admission of admissions.values()) {
    try {
      assertEvidenceReferences(admission, appliedEvidence);
    } catch (error) {
      if (
        error instanceof CheckpointAdmissionError &&
        error.issue === 'CHECKPOINT_RAW_INPUT_CONFLICT'
      ) {
        options.audit?.('CHECKPOINT_RAW_INPUT_CONFLICT', {
          stage: admission.stageId,
        });
      }
      throw error;
    }
    let fingerprints: CheckpointStageFingerprints;
    try {
      fingerprints = calculateCheckpointStageFingerprints(
        admission.stageId as PrecomputedAdmissibleStageId,
        {
          tenantId: checkpoint.tenantId,
          correlationId: checkpoint.correlationId,
          scenarioId: checkpoint.scenarioId,
          scenarioVersion: checkpoint.scenarioVersion,
          evidenceRefs: admission.evidenceRefs,
          appliedEvidence,
          mentalModel: options.state.mentalModel,
          knowledgeGraph: options.state.knowledgeGraph,
        }
      );
    } catch (error) {
      if (error instanceof CheckpointAdmissionError) {
        throw error;
      }
      options.audit?.('CHECKPOINT_FINGERPRINT_MISMATCH', {
        stage: admission.stageId,
      });
      throwAdmissionIssue(
        'CHECKPOINT_FINGERPRINT_MISMATCH',
        admission.stageId
      );
    }

    if (
      fingerprints.inputFingerprint !== admission.inputFingerprint ||
      fingerprints.outputFingerprint !== admission.outputFingerprint
    ) {
      options.audit?.('CHECKPOINT_FINGERPRINT_MISMATCH', {
        stage: admission.stageId,
      });
      throwAdmissionIssue(
        'CHECKPOINT_FINGERPRINT_MISMATCH',
        admission.stageId
      );
    }
    options.audit?.('CHECKPOINT_STAGE_ADMISSION_VALIDATED', {
      stage: admission.stageId,
    });
  }

  assertRequiredStagesCanBeSatisfied(
    options.executionScenario,
    admissions,
    options.isStageConfigured
  );

  return {
    checkpoint,
    admissions,
  };
}
