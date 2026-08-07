import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { AssessmentPolicy } from '../../../enterprise-model/assessment/domain/types';
import type {
  DiagnosticNarrativeProvider,
  DossierPolicy,
} from '../../../enterprise-model/dossier/domain/types';
import type { PlannerPolicy } from '../../../enterprise-model/planning/domain/types';
import type { IQuestionRealizationProvider } from '../../../enterprise-model/planning/services/QuestionRealizationProvider';
import type { ReasoningPolicy } from '../../../enterprise-model/reasoning/policies/ReasoningPolicy';
import { AuraIntelligenceOrchestrator } from '../../AuraIntelligenceOrchestrator';
import type { AuraIntelligenceOSDependencies } from '../../dependencyComposition';
import { PipelineExecutionContext } from '../../PipelineExecutionContext';
import type {
  CheckpointProducerAuthorizerPort,
  PipelineAuditSink,
  PipelineClock,
} from '../../ports';
import {
  createMinimalAssessment,
  createMinimalCoverageReport,
  createMinimalDossier,
  createMinimalPlanResult,
  createMinimalReadinessAssessment,
  createMinimalReasoningReport,
} from '../../tests/fixtures';
import type { PipelineResult } from '../../types';
import {
  PipelineBootstrapCoreError,
} from '../PipelineBootstrapCoreErrors';
import { PipelineBootstrapEvidenceFactory } from '../PipelineBootstrapEvidenceFactory';
import {
  PipelineBootstrapExecutionComposer,
  type PipelineBootstrapCheckpointMapper,
} from '../PipelineBootstrapExecutionComposer';
import {
  mapBootstrapAcceptedStateToCheckpointHandoff,
} from '../PipelineBootstrapCheckpointMapper';
import { PipelineBootstrapper } from '../PipelineBootstrapper';
import type { PipelineBootstrapPort } from '../ports';
import type {
  BootstrapRejectedState,
  PipelineBootstrapFact,
  PipelineBootstrapInput,
  PipelineBootstrapPolicy,
} from '../types';

const TENANT_ID = 'tenant-1';
const CORRELATION_ID = 'correlation-1';
const PRODUCER = {
  producerId: 'bootstrap-checkpoint-mapper',
  producerVersion: '1',
} as const;

function createPolicy(): PipelineBootstrapPolicy {
  return {
    allowedTaxonomyVersion: '1',
    allowedScenarioVersion: '1',
    allowUnknownReliability: false,
    allowUncertainPolarity: false,
    allowInferredDirectness: false,
    allowedInferenceRuleIds: [],
    maxFacts: 10,
    maxFactValueSize: 256,
    maxTotalPayloadSize: 8_192,
    duplicateFactPolicy: 'REJECT',
    conflictPolicy: 'REJECT',
    failClosed: true,
    requireExplicitScenario: true,
  };
}

function createFact(): PipelineBootstrapFact {
  return {
    factId: 'fact-industry-1',
    category: 'BUSINESS_INDUSTRY',
    value: 'HOSPITALITY',
    valueType: 'ENUM',
    provenance: {
      sourceType: 'INTEGRATION',
      sourceId: 'source-1',
      collectionMethod: 'SYSTEM_EVENT',
      capturedAt: 200,
      reliability: 'HIGH',
      directness: 'DIRECT',
      actorType: 'SYSTEM',
      tenantId: TENANT_ID,
      correlationId: CORRELATION_ID,
    },
    reliability: 'HIGH',
    directness: 'DIRECT',
    polarity: 'AFFIRMED',
    observedAt: 100,
    schemaVersion: '1',
  };
}

function createInput(
  facts: readonly PipelineBootstrapFact[] = [createFact()]
): PipelineBootstrapInput {
  return {
    bootstrapId: 'bootstrap-1',
    tenantId: TENANT_ID,
    correlationId: CORRELATION_ID,
    targetScenario: {
      scenarioId: 'PAYROLL_AUDIT',
      scenarioVersion: '1',
      objectiveKey: 'ASSESS_PAYROLL_AUDIT_READINESS',
      requestedStages: [
        'EVIDENCE_EXTRACTION',
        'MENTAL_MODEL',
        'KNOWLEDGE_GRAPH',
        'KNOWLEDGE_COVERAGE',
      ],
      source: 'AUTHORIZED_SYSTEM_CONFIGURATION',
      explicitSelection: true,
    },
    facts,
    context: {
      requestedAt: 300,
      requestedBy: {
        requesterId: 'system-bootstrapper',
        actorType: 'SYSTEM',
      },
      locale: 'es-MX',
      timezone: 'America/Mexico_City',
      source: 'governed-bootstrap-contract',
    },
    policy: createPolicy(),
    schemaVersion: '1',
  };
}

interface HarnessOptions {
  readonly includeAuthorizer?: boolean;
  readonly authorized?: boolean;
}

function createHarness(options: HarnessOptions = {}) {
  const bootstrapper = new PipelineBootstrapper({
    clock: { now: vi.fn(() => 300) },
    evidenceFactory: new PipelineBootstrapEvidenceFactory(),
  });
  const checkpointMapper = vi.fn(
    mapBootstrapAcceptedStateToCheckpointHandoff
  );
  const clock: PipelineClock = {
    now: vi.fn(() => 1_000),
    toISOString: vi.fn(() => '2026-01-01T00:00:01.000Z'),
  };
  const auditSink: PipelineAuditSink = { log: vi.fn() };
  const authorizer: CheckpointProducerAuthorizerPort = {
    isAuthorized: vi.fn(() => options.authorized ?? true),
  };
  const extractionApplier = {
    applyExtraction: vi.fn(),
  };
  const coverageDecisionEngine = {
    evaluateDecisionReadiness: vi.fn(() =>
      createMinimalReadinessAssessment()
    ),
  };
  const coverageCalculator = {
    calculateOverallReport: vi.fn(() => createMinimalCoverageReport()),
  };
  const adaptiveQuestionPlanner = {
    planQuestionsFromGraph: vi.fn(async () => createMinimalPlanResult()),
  };
  const executiveReasoningEngine = {
    execute: vi.fn(() => createMinimalReasoningReport()),
  };
  const executiveDossierBuilder = {
    build: vi.fn(() => createMinimalDossier()),
  };
  const enterpriseTransformationAssessmentBuilder = {
    build: vi.fn(() => createMinimalAssessment()),
  };
  const dependencies: AuraIntelligenceOSDependencies = {
    clock,
    idGenerator: {
      generateExecutionId: vi.fn(() => 'execution-1'),
    },
    auditSink,
    ...(options.includeAuthorizer === false
      ? {}
      : { checkpointProducerAuthorizer: authorizer }),
    extractionApplier,
    coverageDecisionEngine,
    coverageCalculator,
    adaptiveQuestionPlanner,
    executiveReasoningEngine,
    executiveDossierBuilder,
    enterpriseTransformationAssessmentBuilder,
    plannerPolicy: { maxQuestionsPerPlan: 5 } as PlannerPolicy,
    questionRealizationProvider: {
      realizeIntents: vi.fn(),
    } as unknown as IQuestionRealizationProvider,
    reasoningPolicy: {
      minimumSupportThreshold: 0.7,
    } as ReasoningPolicy,
    dossierPolicy: {
      getLevels: vi.fn(),
      evaluateScore: vi.fn(),
    } as unknown as DossierPolicy,
    diagnosticNarrativeProvider: {
      generateNarrative: vi.fn(),
      generateExecutiveSummary: vi.fn(),
    } as unknown as DiagnosticNarrativeProvider,
    assessmentPolicy: { version: '1' } as AssessmentPolicy,
  };
  const orchestrator = new AuraIntelligenceOrchestrator(
    new PipelineExecutionContext('execution-1', clock, {
      sessionId: CORRELATION_ID,
    }),
    dependencies
  );
  const executePipeline = vi.spyOn(orchestrator, 'executePipeline');
  const composer = new PipelineBootstrapExecutionComposer({
    bootstrapPort: bootstrapper,
    checkpointMapper,
    clock,
    orchestratorFactory: () => orchestrator,
    producer: PRODUCER,
  });

  return {
    composer,
    checkpointMapper,
    executePipeline,
    authorizer,
    extractionApplier,
    coverageDecisionEngine,
    adaptiveQuestionPlanner,
    executiveReasoningEngine,
  };
}

async function executeHarness(options: HarnessOptions = {}) {
  const harness = createHarness(options);
  const result = await harness.composer.execute(createInput());
  return { harness, result };
}

function createRejectedState(): BootstrapRejectedState {
  return {
    status: 'REJECTED',
    bootstrapId: 'bootstrap-1',
    tenantId: TENANT_ID,
    correlationId: CORRELATION_ID,
    errors: [
      {
        code: 'EMPTY_FACT_SET',
        message: 'Bootstrap facts are required',
        retryable: false,
      },
    ],
    bootstrapVersion: '1',
    createdAt: 300,
  };
}

function createRejectedHarness() {
  const bootstrapPort: PipelineBootstrapPort = {
    bootstrap: vi.fn(async () => createRejectedState()),
  };
  const checkpointMapper: PipelineBootstrapCheckpointMapper = vi.fn(
    () => {
      throw new Error('Mapper must not run');
    }
  );
  const orchestrator = {
    executePipeline: vi.fn(async () => {
      throw new Error('Orchestrator must not run');
    }),
  };
  const composer = new PipelineBootstrapExecutionComposer({
    bootstrapPort,
    checkpointMapper,
    clock: { now: () => 1_000, toISOString: () => '2026-01-01T00:00:01.000Z' },
    orchestratorFactory: () => orchestrator as unknown as AuraIntelligenceOrchestrator,
    producer: PRODUCER,
  });
  return {
    composer,
    bootstrapPort,
    checkpointMapper,
    orchestrator,
  };
}

function createFailedPipelineResult(): PipelineResult {
  return {
    contractVersion: '1',
    pipelineVersion: '1',
    executionId: 'execution-1',
    sessionId: CORRELATION_ID,
    status: 'FAILED',
    startedAt: '2026-01-01T00:00:01.000Z',
    completedAt: '2026-01-01T00:00:01.000Z',
    durationMs: 0,
    stageResults: {},
    partialFailures: false,
    skippedStages: [],
    errors: [],
    warnings: [],
    auditTrail: [],
  };
}

function readSource(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

function checkpointIssue(
  result: PipelineResult
): string | undefined {
  return result.errors[0]?.metadata?.checkpointAdmissionIssue as
    | string
    | undefined;
}

describe('AI-02G.2B PipelineBootstrapExecutionComposer', () => {
  it('1. skips the mapper when bootstrap returns REJECTED', async () => {
    const harness = createRejectedHarness();
    const result = await harness.composer.execute(createInput());
    expect(result.status).toBe('BOOTSTRAP_REJECTED');
    expect(harness.checkpointMapper).not.toHaveBeenCalled();
  });

  it('2. skips the Orchestrator when bootstrap returns REJECTED', async () => {
    const harness = createRejectedHarness();
    await harness.composer.execute(createInput());
    expect(
      harness.orchestrator.executePipeline
    ).not.toHaveBeenCalled();
  });

  it('3. invokes the real mapper exactly once for ACCEPTED', async () => {
    const { harness } = await executeHarness();
    expect(harness.checkpointMapper).toHaveBeenCalledOnce();
  });

  it('4. invokes the real Orchestrator exactly once for ACCEPTED', async () => {
    const { harness } = await executeHarness();
    expect(harness.executePipeline).toHaveBeenCalledOnce();
  });

  it('5. returns the validated bootstrap state', async () => {
    const { result } = await executeHarness();
    expect(result.status).toBe('EXECUTION_COMPLETED');
    if (result.status !== 'BOOTSTRAP_REJECTED') {
      expect(result.bootstrapState.status).toBe('ACCEPTED');
      expect(result.bootstrapState.bootstrapId).toBe('bootstrap-1');
    }
  });

  it('6. returns the mapper handoff without duplicating its artifacts', async () => {
    const { result } = await executeHarness();
    expect(result.status).toBe('EXECUTION_COMPLETED');
    if (result.status !== 'BOOTSTRAP_REJECTED') {
      expect(result.handoff.precomputedCheckpoint.checkpointId).toBe(
        'bootstrap-1'
      );
      expect(result.handoff.tenantId).toBe(TENANT_ID);
    }
  });

  it('7. returns the existing PipelineResult contract', async () => {
    const { result } = await executeHarness();
    expect(result.status).toBe('EXECUTION_COMPLETED');
    if (result.status !== 'BOOTSTRAP_REJECTED') {
      expect(result.pipelineResult).toMatchObject({
        contractVersion: '1',
        pipelineVersion: '1',
        status: 'SUCCESS',
      });
    }
  });

  it('8. admits the three foundational stages as SUCCEEDED/PRECOMPUTED', async () => {
    const { result } = await executeHarness();
    expect(result.status).toBe('EXECUTION_COMPLETED');
    if (result.status !== 'BOOTSTRAP_REJECTED') {
      for (const stage of [
        'EVIDENCE_EXTRACTION',
        'MENTAL_MODEL',
        'KNOWLEDGE_GRAPH',
      ] as const) {
        expect(result.pipelineResult.stageResults[stage]).toMatchObject({
          status: 'SUCCEEDED',
          executionOrigin: 'PRECOMPUTED',
        });
      }
    }
  });

  it('9. executes Coverage after checkpoint admission', async () => {
    const { harness, result } = await executeHarness();
    expect(
      harness.coverageDecisionEngine.evaluateDecisionReadiness
    ).toHaveBeenCalledOnce();
    if (result.status !== 'BOOTSTRAP_REJECTED') {
      expect(
        result.pipelineResult.stageResults.KNOWLEDGE_COVERAGE?.status
      ).toBe('SUCCEEDED');
    }
  });

  it('10. executes Planning after checkpoint admission', async () => {
    const { harness, result } = await executeHarness();
    expect(
      harness.adaptiveQuestionPlanner.planQuestionsFromGraph
    ).toHaveBeenCalledOnce();
    if (result.status !== 'BOOTSTRAP_REJECTED') {
      expect(
        result.pipelineResult.stageResults.ADAPTIVE_PLANNING?.status
      ).toBe('SUCCEEDED');
    }
  });

  it('11. executes Reasoning after checkpoint admission', async () => {
    const { harness, result } = await executeHarness();
    expect(
      harness.executiveReasoningEngine.execute
    ).toHaveBeenCalledOnce();
    if (result.status !== 'BOOTSTRAP_REJECTED') {
      expect(
        result.pipelineResult.stageResults.EXECUTIVE_REASONING?.status
      ).toBe('SUCCEEDED');
    }
  });

  it('12. preserves the fail-closed result when authorizer is absent', async () => {
    const { result } = await executeHarness({
      includeAuthorizer: false,
    });
    expect(result.status).toBe('EXECUTION_FAILED');
    if (result.status === 'EXECUTION_FAILED') {
      expect(checkpointIssue(result.pipelineResult)).toBe(
        'CHECKPOINT_PRODUCER_UNAUTHORIZED'
      );
    }
  });

  it('13. preserves the fail-closed result when authorizer rejects', async () => {
    const { harness, result } = await executeHarness({
      authorized: false,
    });
    expect(harness.authorizer.isAuthorized).toHaveBeenCalledOnce();
    expect(result.status).toBe('EXECUTION_FAILED');
    if (result.status === 'EXECUTION_FAILED') {
      expect(checkpointIssue(result.pipelineResult)).toBe(
        'CHECKPOINT_PRODUCER_UNAUTHORIZED'
      );
    }
  });

  it('14. converts mapper exceptions into a closed composition error', async () => {
    const mapper: PipelineBootstrapCheckpointMapper = vi.fn(() => {
      throw new Error('sensitive mapper failure');
    });
    const composer = new PipelineBootstrapExecutionComposer({
      bootstrapPort: new PipelineBootstrapper({
        clock: { now: () => 300 },
        evidenceFactory: new PipelineBootstrapEvidenceFactory(),
      }),
      checkpointMapper: mapper,
      clock: { now: () => 1_000, toISOString: () => '2026-01-01T00:00:01.000Z' },
      orchestratorFactory: () => ({ executePipeline: vi.fn() } as unknown as AuraIntelligenceOrchestrator),
      producer: PRODUCER,
    });
    await expect(composer.execute(createInput())).rejects.toMatchObject({
      name: 'PipelineBootstrapCoreError',
      issue: 'BOOTSTRAP_EXECUTION_COMPOSITION_FAILED',
      message: 'Pipeline bootstrap execution composition failed',
    });
  });

  it('15. preserves an Orchestrator FAILED PipelineResult', async () => {
    const failed = createFailedPipelineResult();
    const composer = new PipelineBootstrapExecutionComposer({
      bootstrapPort: new PipelineBootstrapper({
        clock: { now: () => 300 },
        evidenceFactory: new PipelineBootstrapEvidenceFactory(),
      }),
      checkpointMapper: mapBootstrapAcceptedStateToCheckpointHandoff,
      clock: { now: () => 1_000, toISOString: () => '2026-01-01T00:00:01.000Z' },
      orchestratorFactory: () => ({ executePipeline: vi.fn(async () => failed) } as unknown as AuraIntelligenceOrchestrator),
      producer: PRODUCER,
    });
    const result = await composer.execute(createInput());
    expect(result.status).toBe('EXECUTION_FAILED');
    if (result.status === 'EXECUTION_FAILED') {
      expect(result.pipelineResult).toBe(failed);
    }
  });

  it('16. does not mutate PipelineBootstrapInput', async () => {
    const input = createInput();
    const snapshot = structuredClone(input);
    await createHarness().composer.execute(input);
    expect(input).toEqual(snapshot);
  });

  it('17. never returns or aliases BoundaryResponse', async () => {
    const { result } = await executeHarness();
    expect(result).not.toHaveProperty('boundaryResponse');
    expect(result).not.toHaveProperty('boundary');
  });

  it('18. contains no Boundary imports or BoundaryExecutionPort coupling', () => {
    const source = readSource(
      'src/modules/intelligence/os/bootstrap/PipelineBootstrapExecutionComposer.ts'
    );
    expect(source).not.toMatch(
      /BoundaryExecutionPort|BoundaryResponse|boundary\//i
    );
  });

  it('19. contains no persistence, Firebase, or Discovery coupling', () => {
    const source = readSource(
      'src/modules/intelligence/os/bootstrap/PipelineBootstrapExecutionComposer.ts'
    );
    expect(source).not.toMatch(
      /firebase|firestore|discovery|localStorage|sessionStorage|indexedDB|database|repository/i
    );
  });

  it('20. contains no network, filesystem, environment, or UI I/O', () => {
    const source = readSource(
      'src/modules/intelligence/os/bootstrap/PipelineBootstrapExecutionComposer.ts'
    );
    expect(source).not.toMatch(
      /fetch\s*\(|XMLHttpRequest|node:fs|writeFile|readFile|process\.env|react/i
    );
  });

  it('21. is deterministic end-to-end with deterministic in-memory dependencies', async () => {
    const first = await createHarness().composer.execute(createInput());
    const second = await createHarness().composer.execute(createInput());
    expect(first).toEqual(second);
  });

  it('22. leaves the legacy Orchestrator and ContextBuilder composition-independent', () => {
    const orchestrator = readSource(
      'src/modules/intelligence/os/AuraIntelligenceOrchestrator.ts'
    );
    const contextBuilder = readSource(
      'src/modules/intelligence/os/PipelineContextBuilder.ts'
    );
    expect(orchestrator).not.toMatch(
      /PipelineBootstrapExecutionComposer|PipelineBootstrapper/
    );
    expect(contextBuilder).not.toMatch(
      /PipelineBootstrapExecutionComposer|PipelineBootstrapper/
    );
    expect(PipelineBootstrapCoreError).toBeDefined();
  });

  it('23. dynamically resolves orchestrator per request with dedicated context', async () => {
    const orchestratorFactory = vi.fn((osContext: PipelineExecutionContext) => ({
      executePipeline: vi.fn(async () => ({ status: 'SUCCESS' }) as unknown as PipelineResult),
      _testId: osContext.executionId,
    }));

    const composer = new PipelineBootstrapExecutionComposer({
      bootstrapPort: new PipelineBootstrapper({
        clock: { now: () => 300 },
        evidenceFactory: new PipelineBootstrapEvidenceFactory(),
      }),
      checkpointMapper: mapBootstrapAcceptedStateToCheckpointHandoff,
      clock: { now: () => 1_000, toISOString: () => '2026-01-01T00:00:01.000Z' },
      orchestratorFactory: orchestratorFactory as unknown as (osContext: PipelineExecutionContext) => Pick<AuraIntelligenceOrchestrator, 'executePipeline'>,
      producer: PRODUCER,
    });

    const input1 = createInput();
    const input2 = createInput();
    // mutate bootstrapId to differentiate
    (input2 as unknown as { bootstrapId: string }).bootstrapId = 'bootstrap-2';

    await composer.execute(input1);
    await composer.execute(input2);

    expect(orchestratorFactory).toHaveBeenCalledTimes(2);

    const context1 = orchestratorFactory.mock.calls[0][0];
    const context2 = orchestratorFactory.mock.calls[1][0];

    expect(context1).toBeInstanceOf(PipelineExecutionContext);
    expect(context2).toBeInstanceOf(PipelineExecutionContext);

    expect(context1.executionId).toBe('bootstrap-1');
    expect(context2.executionId).toBe('bootstrap-2');

    expect(context1).not.toBe(context2);
  });
});
