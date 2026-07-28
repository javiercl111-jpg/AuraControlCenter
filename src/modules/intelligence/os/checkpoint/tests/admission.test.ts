import { describe, expect, it, vi } from 'vitest';
import { AuraIntelligenceOrchestrator } from '../../AuraIntelligenceOrchestrator';
import type { PipelineAggregatedState } from '../../contextTypes';
import type { AuraIntelligenceOSDependencies } from '../../dependencyComposition';
import { AuraIntelligenceOSError, ErrorCodes } from '../../errors';
import { PipelineExecutionContext } from '../../PipelineExecutionContext';
import type {
  CheckpointProducerAuthorizerPort,
  PipelineAuditSink,
  PipelineClock,
} from '../../ports';
import type {
  PipelineExecutionScenario,
  PipelineStageId,
  StageStatus,
} from '../../types';
import type { EnterpriseEvidence } from '../../../enterprise-model/domain/types';
import type { PlannerPolicy } from '../../../enterprise-model/planning/domain/types';
import type { IQuestionRealizationProvider } from '../../../enterprise-model/planning/services/QuestionRealizationProvider';
import type { ReasoningPolicy } from '../../../enterprise-model/reasoning/policies/ReasoningPolicy';
import type {
  DiagnosticNarrativeProvider,
  DossierPolicy,
} from '../../../enterprise-model/dossier/domain/types';
import type { AssessmentPolicy } from '../../../enterprise-model/assessment/domain/types';
import {
  createMinimalAssessment,
  createMinimalCoverageReport,
  createMinimalDossier,
  createMinimalExecutionScenario,
  createMinimalExtractionResult,
  createMinimalKnowledgeGraph,
  createMinimalMentalModel,
  createMinimalPlanResult,
  createMinimalReadinessAssessment,
  createMinimalReasoningReport,
} from '../../tests/fixtures';
import {
  calculateCheckpointStageFingerprints,
  createDeterministicFingerprint,
  type PipelineEvidenceReference,
  type PipelineStageAdmission,
  type PrecomputedAdmissibleStageId,
  type PrecomputedPipelineCheckpoint,
} from '..';

const TENANT_ID = 'tenant-1';
const CORRELATION_ID = 'correlation-1';
const CHECKPOINT_COMPLETED_AT = '2026-01-01T00:00:00.000Z';

function createEvidence(
  overrides: Partial<EnterpriseEvidence> = {}
): EnterpriseEvidence {
  return {
    evidenceId: 'evidence-1',
    sessionId: 'session-1',
    turnId: 'turn-1',
    source: 'governed-source',
    sourceType: 'DOCUMENT',
    originalText: null,
    normalizedStatement: 'Canonical applied evidence',
    category: 'business',
    entityRefs: [],
    capturedAt: 1,
    reliability: 0.9,
    directness: 1,
    polarity: 'POSITIVE',
    extractorVersion: '1',
    metadata: {},
    ...overrides,
  };
}

function createScenario(
  overrides: Partial<PipelineExecutionScenario> = {}
): PipelineExecutionScenario {
  const base = createMinimalExecutionScenario('PAYROLL_AUDIT');
  return {
    ...base,
    ...overrides,
    stageDependencies: {
      ...base.stageDependencies,
      ...(overrides.stageDependencies ?? {}),
    },
  };
}

function createPrecomputedState(
  scenario: PipelineExecutionScenario
): PipelineAggregatedState {
  const evidence = createEvidence();
  const mentalModel = createMinimalMentalModel();
  mentalModel.evidences = { [evidence.evidenceId]: evidence };

  return {
    sessionId: 'session-1',
    executionScenario: scenario,
    mentalModel,
    knowledgeGraph: createMinimalKnowledgeGraph(),
    evidence: [evidence],
  };
}

interface CheckpointOverrides {
  readonly stages?: readonly PrecomputedAdmissibleStageId[];
  readonly evidenceRefs?: readonly PipelineEvidenceReference[];
  readonly admissionOverrides?: Partial<
    Record<PrecomputedAdmissibleStageId, Partial<PipelineStageAdmission>>
  >;
  readonly checkpoint?: Partial<PrecomputedPipelineCheckpoint>;
}

function createCheckpoint(
  state: PipelineAggregatedState,
  scenario: PipelineExecutionScenario,
  overrides: CheckpointOverrides = {}
): PrecomputedPipelineCheckpoint {
  const evidenceRefs =
    overrides.evidenceRefs ??
    (state.evidence ?? []).map(
      (evidence): PipelineEvidenceReference => ({
        referenceType: 'EVIDENCE',
        evidenceId: evidence.evidenceId,
        schemaVersion: '1',
      })
    );
  const stages =
    overrides.stages ??
    ([
      'EVIDENCE_EXTRACTION',
      'MENTAL_MODEL',
      'KNOWLEDGE_GRAPH',
    ] as const);

  const admissions = stages.map((stage): PipelineStageAdmission => {
    const fingerprints = calculateCheckpointStageFingerprints(stage, {
      tenantId: TENANT_ID,
      correlationId: CORRELATION_ID,
      scenarioId: scenario.scenarioId,
      scenarioVersion: scenario.scenarioVersion,
      evidenceRefs,
      appliedEvidence: state.evidence ?? [],
      mentalModel: state.mentalModel,
      knowledgeGraph: state.knowledgeGraph,
    });
    return {
      stageId: stage,
      admissionType: 'PRECOMPUTED',
      artifactSchemaVersion: '1',
      evidenceRefs,
      ...fingerprints,
      ...(overrides.admissionOverrides?.[stage] ?? {}),
    };
  });

  return {
    checkpointId: 'checkpoint-1',
    checkpointVersion: '1',
    tenantId: TENANT_ID,
    correlationId: CORRELATION_ID,
    scenarioId: scenario.scenarioId,
    scenarioVersion: scenario.scenarioVersion,
    producerId: 'precomputed-domain-producer',
    producerVersion: '1',
    completedAt: CHECKPOINT_COMPLETED_AT,
    admissions,
    ...overrides.checkpoint,
  };
}

interface HarnessOptions {
  readonly scenario?: PipelineExecutionScenario;
  readonly authorized?: boolean;
  readonly includeAuthorizer?: boolean;
}

function createHarness(options: HarnessOptions = {}) {
  const scenario = options.scenario ?? createScenario();
  const state = createPrecomputedState(scenario);
  const checkpoint = createCheckpoint(state, scenario);
  const clock: PipelineClock = {
    now: vi.fn(() => 1_000),
    toISOString: vi.fn(() => '2026-01-01T00:00:01.000Z'),
  };
  const auditSink: PipelineAuditSink = { log: vi.fn() };
  const authorizer: CheckpointProducerAuthorizerPort = {
    isAuthorized: vi.fn(() => options.authorized ?? true),
  };
  const extractionApplier = {
    applyExtraction: vi.fn(() => ({
      mentalModel: createMinimalMentalModel(),
      knowledgeGraph: createMinimalKnowledgeGraph(),
      extractionResult: createMinimalExtractionResult(),
    })),
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
    idGenerator: { generateExecutionId: vi.fn(() => 'execution-1') },
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
  const osContext = new PipelineExecutionContext(
    'execution-1',
    clock,
    { sessionId: 'session-1' }
  );
  const orchestrator = new AuraIntelligenceOrchestrator(
    osContext,
    dependencies
  );

  const input = {
    sessionId: 'session-1',
    tenantId: TENANT_ID,
    correlationId: CORRELATION_ID,
    executionScenario: scenario,
    precomputedCheckpoint: checkpoint,
  };

  return {
    scenario,
    state,
    checkpoint,
    clock,
    auditSink,
    authorizer,
    extractionApplier,
    coverageDecisionEngine,
    coverageCalculator,
    adaptiveQuestionPlanner,
    executiveReasoningEngine,
    executiveDossierBuilder,
    enterpriseTransformationAssessmentBuilder,
    dependencies,
    orchestrator,
    input,
  };
}

function admissionIssue(
  result: Awaited<
    ReturnType<AuraIntelligenceOrchestrator['executePipeline']>
  >
): string | undefined {
  return result.errors[0]?.metadata?.checkpointAdmissionIssue as
    | string
    | undefined;
}

describe('AI-02C.3C precomputed checkpoint admission', () => {
  it('1. preserves the legacy route when checkpoint is absent', async () => {
    const harness = createHarness();
    const legacyState: PipelineAggregatedState = {
      ...harness.state,
      extractionResult: createMinimalExtractionResult(),
    };
    const result = await harness.orchestrator.executePipeline(
      {
        sessionId: 'session-1',
        executionScenario: harness.scenario,
      },
      legacyState
    );

    expect(result.status).toBe('SUCCESS');
    expect(harness.extractionApplier.applyExtraction).toHaveBeenCalledOnce();
    expect(harness.authorizer.isAuthorized).not.toHaveBeenCalled();
  });

  it('2. admits a valid checkpoint with three precomputed stages', async () => {
    const harness = createHarness();
    const result = await harness.orchestrator.executePipeline(
      harness.input,
      harness.state
    );

    expect(result.errors).toEqual([]);
    expect(
      ['EVIDENCE_EXTRACTION', 'MENTAL_MODEL', 'KNOWLEDGE_GRAPH'].every(
        (stage) => result.stageResults[stage as PipelineStageId]
      )
    ).toBe(true);
  });

  it('3. records admitted stage results as SUCCEEDED/PRECOMPUTED', async () => {
    const harness = createHarness();
    const result = await harness.orchestrator.executePipeline(
      harness.input,
      harness.state
    );

    for (const stage of [
      'EVIDENCE_EXTRACTION',
      'MENTAL_MODEL',
      'KNOWLEDGE_GRAPH',
    ] as const) {
      expect(result.stageResults[stage]).toMatchObject({
        status: 'SUCCEEDED',
        executionOrigin: 'PRECOMPUTED',
        startedAt: CHECKPOINT_COMPLETED_AT,
        completedAt: CHECKPOINT_COMPLETED_AT,
        durationMs: 0,
      });
    }
  });

  it('4. records the typed admissionReference', async () => {
    const harness = createHarness();
    const result = await harness.orchestrator.executePipeline(
      harness.input,
      harness.state
    );

    expect(result.stageResults.KNOWLEDGE_GRAPH?.admissionReference).toEqual({
      checkpointId: 'checkpoint-1',
      stageId: 'KNOWLEDGE_GRAPH',
    });
  });

  it('5. does not reexecute admitted stages', async () => {
    const harness = createHarness();
    await harness.orchestrator.executePipeline(
      harness.input,
      harness.state
    );

    expect(harness.extractionApplier.applyExtraction).not.toHaveBeenCalled();
  });

  it('6. executes Coverage after precomputed foundation stages', async () => {
    const harness = createHarness();
    await harness.orchestrator.executePipeline(
      harness.input,
      harness.state
    );
    expect(
      harness.coverageDecisionEngine.evaluateDecisionReadiness
    ).toHaveBeenCalledOnce();
  });

  it('7. executes Planning after precomputed foundation stages', async () => {
    const harness = createHarness();
    await harness.orchestrator.executePipeline(
      harness.input,
      harness.state
    );
    expect(
      harness.adaptiveQuestionPlanner.planQuestionsFromGraph
    ).toHaveBeenCalledOnce();
  });

  it('8. executes Reasoning after precomputed foundation stages', async () => {
    const harness = createHarness();
    await harness.orchestrator.executePipeline(
      harness.input,
      harness.state
    );
    expect(harness.executiveReasoningEngine.execute).toHaveBeenCalledOnce();
  });

  it('9. authorizes the producer with the complete governed context', async () => {
    const harness = createHarness();
    await harness.orchestrator.executePipeline(
      harness.input,
      harness.state
    );
    expect(harness.authorizer.isAuthorized).toHaveBeenCalledWith({
      producerId: 'precomputed-domain-producer',
      producerVersion: '1',
      tenantId: TENANT_ID,
      scenarioId: 'PAYROLL_AUDIT',
      checkpointVersion: '1',
    });
    expect(harness.auditSink.log).toHaveBeenCalledWith(
      'INFO',
      'CHECKPOINT_PRODUCER_AUTHORIZED',
      undefined
    );
  });

  it('10. fails closed when the authorizer is absent', async () => {
    const harness = createHarness({ includeAuthorizer: false });
    const result = await harness.orchestrator.executePipeline(
      harness.input,
      harness.state
    );
    expect(result.status).toBe('FAILED');
    expect(admissionIssue(result)).toBe(
      'CHECKPOINT_PRODUCER_UNAUTHORIZED'
    );
  });

  it('11. rejects an unauthorized producer', async () => {
    const harness = createHarness({ authorized: false });
    const result = await harness.orchestrator.executePipeline(
      harness.input,
      harness.state
    );
    expect(admissionIssue(result)).toBe(
      'CHECKPOINT_PRODUCER_UNAUTHORIZED'
    );
  });

  it('12. rejects a tenant mismatch', async () => {
    const harness = createHarness();
    const result = await harness.orchestrator.executePipeline(
      { ...harness.input, tenantId: 'tenant-2' },
      harness.state
    );
    expect(admissionIssue(result)).toBe('CHECKPOINT_CONTEXT_MISMATCH');
  });

  it('13. rejects a correlation mismatch', async () => {
    const harness = createHarness();
    const result = await harness.orchestrator.executePipeline(
      { ...harness.input, correlationId: 'correlation-2' },
      harness.state
    );
    expect(admissionIssue(result)).toBe('CHECKPOINT_CONTEXT_MISMATCH');
  });

  it('14. rejects a scenario mismatch', async () => {
    const harness = createHarness();
    const mismatchedScenario = createScenario({
      scenarioId: 'COMPLIANCE_AUDIT',
    });
    const result = await harness.orchestrator.executePipeline(
      { ...harness.input, executionScenario: mismatchedScenario },
      harness.state
    );
    expect(admissionIssue(result)).toBe('CHECKPOINT_CONTEXT_MISMATCH');
  });

  it('15. rejects a scenarioVersion mismatch', async () => {
    const harness = createHarness();
    const mismatchedScenario = createScenario({ scenarioVersion: '2' });
    const result = await harness.orchestrator.executePipeline(
      { ...harness.input, executionScenario: mismatchedScenario },
      { ...harness.state, executionScenario: mismatchedScenario }
    );
    expect(admissionIssue(result)).toBe('CHECKPOINT_CONTEXT_MISMATCH');
  });

  it('16. rejects an admission for a stage outside allowedStages', async () => {
    const scenario = createScenario({
      allowedStages: createScenario().allowedStages.filter(
        (stage) => stage !== 'KNOWLEDGE_GRAPH'
      ),
    });
    const harness = createHarness({ scenario });
    const result = await harness.orchestrator.executePipeline(
      harness.input,
      harness.state
    );
    expect(admissionIssue(result)).toBe('CHECKPOINT_STAGE_NOT_ALLOWED');
  });

  it('17. satisfies a required stage through precomputed admission', async () => {
    const scenario = createScenario({
      requiredStages: ['KNOWLEDGE_GRAPH'],
    });
    const harness = createHarness({ scenario });
    const result = await harness.orchestrator.executePipeline(
      harness.input,
      harness.state
    );
    expect(result.stageResults.KNOWLEDGE_GRAPH?.status).toBe('SUCCEEDED');
    expect(result.status).toBe('SUCCESS');
  });

  it('18. satisfies a required stage through current execution', async () => {
    const harness = createHarness();
    const result = await harness.orchestrator.executePipeline(
      harness.input,
      harness.state
    );
    expect(result.stageResults.KNOWLEDGE_COVERAGE?.status).toBe(
      'SUCCEEDED'
    );
    expect(
      result.stageResults.KNOWLEDGE_COVERAGE?.executionOrigin
    ).toBeUndefined();
  });

  it('19. does not satisfy a required stage that is skipped', async () => {
    const scenario = createScenario({
      requiredStages: ['EXECUTIVE_DOSSIER'],
    });
    const harness = createHarness({ scenario });
    harness.executiveReasoningEngine.execute.mockImplementation(() => {
      throw new Error('reasoning failed');
    });
    const result = await harness.orchestrator.executePipeline(
      harness.input,
      harness.state
    );
    expect(result.skippedStages).toContain('EXECUTIVE_DOSSIER');
    expect(admissionIssue(result)).toBe(
      'CHECKPOINT_REQUIRED_STAGE_UNSATISFIED'
    );
  });

  it('20. rejects an unsatisfied checkpoint dependency', async () => {
    const scenario = createScenario({
      stageDependencies: {
        ...createScenario().stageDependencies,
        KNOWLEDGE_GRAPH: [
          'EVIDENCE_EXTRACTION',
          'MENTAL_MODEL',
          'KNOWLEDGE_COVERAGE',
        ],
      },
    });
    const harness = createHarness({ scenario });
    const result = await harness.orchestrator.executePipeline(
      harness.input,
      harness.state
    );
    expect(admissionIssue(result)).toBe(
      'CHECKPOINT_DEPENDENCY_UNSATISFIED'
    );
  });

  it('21. accepts a dependency satisfied by precomputed admission', async () => {
    const harness = createHarness();
    const result = await harness.orchestrator.executePipeline(
      harness.input,
      harness.state
    );
    expect(result.stageResults.KNOWLEDGE_GRAPH?.status).toBe('SUCCEEDED');
    expect(result.stageResults.MENTAL_MODEL?.executionOrigin).toBe(
      'PRECOMPUTED'
    );
  });

  it('22. rejects a graph admission without its model dependency', async () => {
    const harness = createHarness();
    const checkpoint = createCheckpoint(harness.state, harness.scenario, {
      stages: ['KNOWLEDGE_GRAPH'],
    });
    const result = await harness.orchestrator.executePipeline(
      { ...harness.input, precomputedCheckpoint: checkpoint },
      harness.state
    );
    expect(admissionIssue(result)).toBe(
      'CHECKPOINT_DEPENDENCY_UNSATISFIED'
    );
  });

  it('23. rejects an extraction input fingerprint mismatch', async () => {
    const harness = createHarness();
    const checkpoint = createCheckpoint(harness.state, harness.scenario, {
      admissionOverrides: {
        EVIDENCE_EXTRACTION: {
          inputFingerprint: createDeterministicFingerprint({
            mismatch: 'extraction',
          }),
        },
      },
    });
    const result = await harness.orchestrator.executePipeline(
      { ...harness.input, precomputedCheckpoint: checkpoint },
      harness.state
    );
    expect(admissionIssue(result)).toBe(
      'CHECKPOINT_FINGERPRINT_MISMATCH'
    );
    expect(harness.auditSink.log).toHaveBeenCalledWith(
      'WARN',
      'CHECKPOINT_FINGERPRINT_MISMATCH',
      { stage: 'EVIDENCE_EXTRACTION' }
    );
  });

  it('24. rejects a Mental Model output fingerprint mismatch', async () => {
    const harness = createHarness();
    const checkpoint = createCheckpoint(harness.state, harness.scenario, {
      admissionOverrides: {
        MENTAL_MODEL: {
          outputFingerprint: createDeterministicFingerprint({
            mismatch: 'model',
          }),
        },
      },
    });
    const result = await harness.orchestrator.executePipeline(
      { ...harness.input, precomputedCheckpoint: checkpoint },
      harness.state
    );
    expect(admissionIssue(result)).toBe(
      'CHECKPOINT_FINGERPRINT_MISMATCH'
    );
  });

  it('25. rejects a Knowledge Graph output fingerprint mismatch', async () => {
    const harness = createHarness();
    const checkpoint = createCheckpoint(harness.state, harness.scenario, {
      admissionOverrides: {
        KNOWLEDGE_GRAPH: {
          outputFingerprint: createDeterministicFingerprint({
            mismatch: 'graph',
          }),
        },
      },
    });
    const result = await harness.orchestrator.executePipeline(
      { ...harness.input, precomputedCheckpoint: checkpoint },
      harness.state
    );
    expect(admissionIssue(result)).toBe(
      'CHECKPOINT_FINGERPRINT_MISMATCH'
    );
  });

  it('26. rejects a nonexistent evidence reference', async () => {
    const harness = createHarness();
    const missingReference: PipelineEvidenceReference = {
      referenceType: 'EVIDENCE',
      evidenceId: 'missing-evidence',
      schemaVersion: '1',
    };
    const checkpoint = createCheckpoint(harness.state, harness.scenario, {
      evidenceRefs: [missingReference],
    });
    const result = await harness.orchestrator.executePipeline(
      { ...harness.input, precomputedCheckpoint: checkpoint },
      harness.state
    );
    expect(admissionIssue(result)).toBe(
      'CHECKPOINT_EVIDENCE_REFERENCE_INVALID'
    );
  });

  it('27. rejects an unsupported artifactSchemaVersion', async () => {
    const harness = createHarness();
    const checkpoint = createCheckpoint(harness.state, harness.scenario, {
      admissionOverrides: {
        MENTAL_MODEL: { artifactSchemaVersion: '2' },
      },
    });
    const result = await harness.orchestrator.executePipeline(
      { ...harness.input, precomputedCheckpoint: checkpoint },
      harness.state
    );
    expect(admissionIssue(result)).toBe(
      'CHECKPOINT_ARTIFACT_SCHEMA_UNSUPPORTED'
    );
  });

  it('28. rejects raw evidence that is not bound by the checkpoint', async () => {
    const harness = createHarness();
    const state: PipelineAggregatedState = {
      ...harness.state,
      evidence: [
        ...(harness.state.evidence ?? []),
        createEvidence({
          evidenceId: 'evidence-2',
          normalizedStatement: 'Additional raw evidence',
        }),
      ],
    };
    const result = await harness.orchestrator.executePipeline(
      harness.input,
      state
    );
    expect(admissionIssue(result)).toBe('CHECKPOINT_RAW_INPUT_CONFLICT');
    expect(harness.auditSink.log).toHaveBeenCalledWith(
      'WARN',
      'CHECKPOINT_RAW_INPUT_CONFLICT',
      { stage: 'EVIDENCE_EXTRACTION' }
    );
  });

  it('29. rejects extractionResult with extraction admission', async () => {
    const harness = createHarness();
    const result = await harness.orchestrator.executePipeline(
      harness.input,
      {
        ...harness.state,
        extractionResult: createMinimalExtractionResult(),
      }
    );
    expect(admissionIssue(result)).toBe('CHECKPOINT_RAW_INPUT_CONFLICT');
  });

  it('30. never degrades an invalid checkpoint to the legacy route', async () => {
    const harness = createHarness();
    const invalidCheckpoint = {
      ...harness.checkpoint,
      checkpointId: '',
    } as PrecomputedPipelineCheckpoint;
    const result = await harness.orchestrator.executePipeline(
      { ...harness.input, precomputedCheckpoint: invalidCheckpoint },
      {
        ...harness.state,
        extractionResult: createMinimalExtractionResult(),
      }
    );
    expect(result.status).toBe('FAILED');
    expect(harness.extractionApplier.applyExtraction).not.toHaveBeenCalled();
  });

  it('31. does not mutate checkpoint arrays or current artifacts', async () => {
    const harness = createHarness();
    const stateBefore = JSON.stringify(harness.state);
    const checkpointBefore = JSON.stringify(harness.checkpoint);
    await harness.orchestrator.executePipeline(
      harness.input,
      harness.state
    );
    expect(JSON.stringify(harness.state)).toBe(stateBefore);
    expect(JSON.stringify(harness.checkpoint)).toBe(checkpointBefore);

    const context = new PipelineExecutionContext(
      'execution-checkpoint',
      harness.clock,
      {
        sessionId: 'session-1',
        tenantId: TENANT_ID,
        correlationId: CORRELATION_ID,
        precomputedCheckpoint: harness.checkpoint,
      }
    );
    expect(context.initialInput.precomputedCheckpoint).not.toBe(
      harness.checkpoint
    );
    expect(
      Object.isFrozen(
        context.initialInput.precomputedCheckpoint?.admissions
      )
    ).toBe(true);
  });

  it('32. audits checkpoint received', async () => {
    const harness = createHarness();
    await harness.orchestrator.executePipeline(
      harness.input,
      harness.state
    );
    expect(harness.auditSink.log).toHaveBeenCalledWith(
      'INFO',
      'CHECKPOINT_RECEIVED',
      undefined
    );
  });

  it('33. audits checkpoint rejected', async () => {
    const harness = createHarness({ authorized: false });
    await harness.orchestrator.executePipeline(
      harness.input,
      harness.state
    );
    expect(harness.auditSink.log).toHaveBeenCalledWith(
      'WARN',
      'CHECKPOINT_REJECTED',
      { reason: 'CHECKPOINT_PRODUCER_UNAUTHORIZED' }
    );
  });

  it('34. audits every stage admitted as precomputed', async () => {
    const harness = createHarness();
    await harness.orchestrator.executePipeline(
      harness.input,
      harness.state
    );
    expect(harness.auditSink.log).toHaveBeenCalledWith(
      'INFO',
      'CHECKPOINT_STAGE_ADMITTED_PRECOMPUTED',
      { stage: 'MENTAL_MODEL' }
    );
    expect(harness.auditSink.log).toHaveBeenCalledWith(
      'INFO',
      'CHECKPOINT_STAGE_ADMISSION_VALIDATED',
      { stage: 'MENTAL_MODEL' }
    );
  });

  it('35. keeps evidence payloads and full fingerprints out of audit', async () => {
    const harness = createHarness();
    await harness.orchestrator.executePipeline(
      harness.input,
      harness.state
    );
    const serializedAudit = JSON.stringify(
      vi.mocked(harness.auditSink.log).mock.calls
    );
    expect(serializedAudit).not.toContain('Canonical applied evidence');
    expect(serializedAudit).not.toContain(
      harness.checkpoint.admissions[0].inputFingerprint
    );
  });

  it('36. honors cancellation before checkpoint admission', async () => {
    const harness = createHarness();
    harness.dependencies.cancellationSignal = {
      aborted: true,
      reason: 'cancel-before-admission',
    };
    const result = await harness.orchestrator.executePipeline(
      harness.input,
      harness.state
    );
    expect(result.status).toBe('CANCELLED');
    expect(result.stageResults.EVIDENCE_EXTRACTION).toBeUndefined();
    expect(harness.authorizer.isAuthorized).not.toHaveBeenCalled();
  });

  it('37. preserves admitted stages when cancellation occurs afterwards', async () => {
    const harness = createHarness();
    let aborted = false;
    harness.dependencies.cancellationSignal = {
      get aborted() {
        return aborted;
      },
    };
    vi.mocked(harness.auditSink.log).mockImplementation(
      (_level, event) => {
        if (event === 'CHECKPOINT_STAGE_ADMITTED_PRECOMPUTED') {
          aborted = true;
        }
      }
    );
    const result = await harness.orchestrator.executePipeline(
      harness.input,
      harness.state
    );
    expect(result.status).toBe('CANCELLED');
    expect(result.stageResults.EVIDENCE_EXTRACTION).toMatchObject({
      status: 'SUCCEEDED',
      executionOrigin: 'PRECOMPUTED',
    });
  });

  it('38. preserves current-stage timeout semantics', async () => {
    const harness = createHarness();
    harness.adaptiveQuestionPlanner.planQuestionsFromGraph.mockRejectedValue(
      new AuraIntelligenceOSError(
        ErrorCodes.STAGE_TIMEOUT,
        'Planning timed out',
        false,
        'ADAPTIVE_PLANNING'
      )
    );
    const result = await harness.orchestrator.executePipeline(
      harness.input,
      harness.state
    );
    expect(result.status).toBe('TIMED_OUT');
    expect(result.stageResults.ADAPTIVE_PLANNING?.status).toBe('TIMED_OUT');
  });

  it('39. returns SUCCESS when every required stage is satisfied', async () => {
    const scenario = createScenario({
      allowedStages: [
        'EVIDENCE_EXTRACTION',
        'MENTAL_MODEL',
        'KNOWLEDGE_GRAPH',
        'KNOWLEDGE_COVERAGE',
      ],
      requiredStages: ['KNOWLEDGE_COVERAGE'],
    });
    const harness = createHarness({ scenario });
    const result = await harness.orchestrator.executePipeline(
      harness.input,
      harness.state
    );
    expect(result.status).toBe('SUCCESS');
    expect(result.errors).toEqual([]);
    expect(result.skippedStages).toContain('ADAPTIVE_PLANNING');
  });

  it('40. returns FAILED when a required stage remains unsatisfied', async () => {
    const scenario = createScenario({
      requiredStages: ['EXECUTIVE_DOSSIER'],
    });
    const harness = createHarness({ scenario });
    harness.executiveReasoningEngine.execute.mockImplementation(() => {
      throw new Error('reasoning failed');
    });
    const result = await harness.orchestrator.executePipeline(
      harness.input,
      harness.state
    );
    expect(result.status).toBe('FAILED');
    expect(admissionIssue(result)).toBe(
      'CHECKPOINT_REQUIRED_STAGE_UNSATISFIED'
    );
    expect(harness.auditSink.log).toHaveBeenCalledWith(
      'WARN',
      'CHECKPOINT_REQUIRED_STAGE_UNSATISFIED',
      { stage: 'EXECUTIVE_DOSSIER' }
    );
  });

  it('41. leaves executionOrigin absent on legacy stage results', async () => {
    const harness = createHarness();
    const result = await harness.orchestrator.executePipeline(
      {
        sessionId: 'session-1',
        executionScenario: harness.scenario,
      },
      {
        ...harness.state,
        extractionResult: createMinimalExtractionResult(),
      }
    );
    expect(result.stageResults.EVIDENCE_EXTRACTION?.executionOrigin)
      .toBeUndefined();
  });

  it('42. keeps PRECOMPUTED outside StageStatus', () => {
    const statuses: StageStatus[] = [
      'PENDING',
      'RUNNING',
      'SUCCEEDED',
      'PARTIAL',
      'FAILED',
      'SKIPPED',
      'CANCELLED',
      'TIMED_OUT',
    ];
    expect(statuses).not.toContain('PRECOMPUTED' as StageStatus);
  });
});
