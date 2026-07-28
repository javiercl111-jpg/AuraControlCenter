import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createEmptyEnterpriseKnowledgeGraph } from '../../../enterprise-model/graph/services/operations';
import { createEmptyEnterpriseMentalModel } from '../../../enterprise-model/services/modelUpdater';
import type { PlannerPolicy } from '../../../enterprise-model/planning/domain/types';
import type { IQuestionRealizationProvider } from '../../../enterprise-model/planning/services/QuestionRealizationProvider';
import type { ReasoningPolicy } from '../../../enterprise-model/reasoning/policies/ReasoningPolicy';
import type {
  DiagnosticNarrativeProvider,
  DossierPolicy,
} from '../../../enterprise-model/dossier/domain/types';
import type { AssessmentPolicy } from '../../../enterprise-model/assessment/domain/types';
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
import {
  mapBootstrapAcceptedStateToCheckpointHandoff,
  type PipelineBootstrapCheckpointMapperOptions,
} from '../PipelineBootstrapCheckpointMapper';
import {
  PIPELINE_BOOTSTRAP_SCENARIO_REGISTRY,
  type BootstrapAcceptedState,
  type PipelineBootstrapFact,
  type PipelineBootstrapPolicy,
  type PipelineInitialEvidence,
  type PipelineScenarioDescriptor,
} from '../types';

const TENANT_ID = 'tenant-1';
const CORRELATION_ID = 'correlation-1';
const SESSION_ID = 'session-bootstrap-1';

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
    maxTotalPayloadSize: 4096,
    duplicateFactPolicy: 'REJECT',
    conflictPolicy: 'REJECT',
    failClosed: true,
    requireExplicitScenario: true,
  };
}

function createFact(): PipelineBootstrapFact {
  return {
    factId: 'fact-1',
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

function createInitialEvidence(): PipelineInitialEvidence {
  const sourceFact = createFact();
  return {
    sourceFact,
    appliedEvidence: {
      evidenceId: 'evidence-1',
      sessionId: SESSION_ID,
      turnId: 'bootstrap-turn-1',
      source: 'governed-bootstrap-contract',
      sourceType: 'INTEGRATION',
      originalText: null,
      normalizedStatement: 'BUSINESS_INDUSTRY=HOSPITALITY',
      category: 'BUSINESS_INDUSTRY',
      entityRefs: [],
      capturedAt: sourceFact.provenance.capturedAt,
      reliability: 0.8,
      directness: 1,
      polarity: 'POSITIVE',
      extractorVersion: '1',
      metadata: {},
    },
  };
}

function createScenario(): PipelineScenarioDescriptor {
  const registry = PIPELINE_BOOTSTRAP_SCENARIO_REGISTRY.PAYROLL_AUDIT;
  return {
    scenarioId: 'PAYROLL_AUDIT',
    scenarioVersion: '1',
    objectiveKey: registry.objectiveKey,
    requestedStages: [...registry.requiredStages],
    allowedStages: [...registry.allowedStages],
    requiredStages: [...registry.requiredStages],
    stageDependencies: registry.stageDependencies,
    includedDomains: [...registry.includedDomains],
    excludedDomains: [...registry.excludedDomains],
    source: 'AUTHORIZED_SYSTEM_CONFIGURATION',
    explicitSelection: true,
  } as PipelineScenarioDescriptor;
}

function createAcceptedState(): BootstrapAcceptedState {
  const evidence = createInitialEvidence();
  const mentalModel = createEmptyEnterpriseMentalModel();
  mentalModel.evidences[evidence.appliedEvidence.evidenceId] =
    evidence.appliedEvidence;
  const scenario = createScenario();

  return {
    status: 'ACCEPTED',
    bootstrapId: 'bootstrap-1',
    tenantId: TENANT_ID,
    correlationId: CORRELATION_ID,
    initialDomainState: {
      mentalModel,
      knowledgeGraph: createEmptyEnterpriseKnowledgeGraph(),
      evidence: [evidence],
      scenario,
      bootstrapId: 'bootstrap-1',
      tenantId: TENANT_ID,
      correlationId: CORRELATION_ID,
      createdAt: 300,
      schemaVersion: '1',
    },
    provenanceSummary: {
      factCount: 1,
      sourceTypes: ['INTEGRATION'],
      earliestObservedAt: 100,
      latestObservedAt: 100,
    },
    bootstrapVersion: '1',
    createdAt: 300,
  };
}

const mapperOptions: PipelineBootstrapCheckpointMapperOptions = {
  policy: createPolicy(),
  producer: {
    producerId: 'bootstrap-checkpoint-mapper',
    producerVersion: '1',
  },
};

interface HarnessOptions {
  readonly includeAuthorizer?: boolean;
  readonly authorized?: boolean;
}

function createHarness(options: HarnessOptions = {}) {
  const handoff = mapBootstrapAcceptedStateToCheckpointHandoff(
    createAcceptedState(),
    mapperOptions
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
  const orchestrator = new AuraIntelligenceOrchestrator(
    new PipelineExecutionContext('execution-1', clock, {
      sessionId: SESSION_ID,
    }),
    dependencies
  );

  return {
    handoff,
    orchestrator,
    authorizer,
    extractionApplier,
    coverageDecisionEngine,
    adaptiveQuestionPlanner,
    executiveReasoningEngine,
  };
}

async function executeHarness(
  options: HarnessOptions = {}
): Promise<{
  readonly harness: ReturnType<typeof createHarness>;
  readonly result: Awaited<
    ReturnType<AuraIntelligenceOrchestrator['executePipeline']>
  >;
}> {
  const harness = createHarness(options);
  const result = await harness.orchestrator.executePipeline(
    harness.handoff.pipelineInput,
    harness.handoff.aggregatedState
  );
  return { harness, result };
}

function readSource(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

function checkpointIssue(
  result: Awaited<
    ReturnType<AuraIntelligenceOrchestrator['executePipeline']>
  >
): string | undefined {
  return result.errors[0]?.metadata?.checkpointAdmissionIssue as
    | string
    | undefined;
}

describe('AI-02C.3D bootstrap checkpoint integration', () => {
  it('50. integrates the mapped bootstrap state with the Orchestrator in memory', async () => {
    const { result } = await executeHarness();
    expect(result.status).toBe('SUCCESS');
    expect(result.errors).toEqual([]);
  });

  it('51. produces three PRECOMPUTED SUCCEEDED foundational results', async () => {
    const { result } = await executeHarness();
    for (const stage of [
      'EVIDENCE_EXTRACTION',
      'MENTAL_MODEL',
      'KNOWLEDGE_GRAPH',
    ] as const) {
      expect(result.stageResults[stage]).toMatchObject({
        status: 'SUCCEEDED',
        executionOrigin: 'PRECOMPUTED',
      });
    }
  });

  it('52. does not reexecute foundational stages', async () => {
    const { harness } = await executeHarness();
    expect(harness.extractionApplier.applyExtraction).not.toHaveBeenCalled();
  });

  it('53. executes Coverage after mapped checkpoint admission', async () => {
    const { harness, result } = await executeHarness();
    expect(
      harness.coverageDecisionEngine.evaluateDecisionReadiness
    ).toHaveBeenCalledOnce();
    expect(result.stageResults.KNOWLEDGE_COVERAGE?.status).toBe(
      'SUCCEEDED'
    );
  });

  it('54. executes Planning after mapped checkpoint admission', async () => {
    const { harness, result } = await executeHarness();
    expect(
      harness.adaptiveQuestionPlanner.planQuestionsFromGraph
    ).toHaveBeenCalledOnce();
    expect(result.stageResults.ADAPTIVE_PLANNING?.status).toBe(
      'SUCCEEDED'
    );
  });

  it('55. executes Reasoning after mapped checkpoint admission', async () => {
    const { harness, result } = await executeHarness();
    expect(
      harness.executiveReasoningEngine.execute
    ).toHaveBeenCalledOnce();
    expect(result.stageResults.EXECUTIVE_REASONING?.status).toBe(
      'SUCCEEDED'
    );
  });

  it('56. requires an explicit checkpoint producer authorizer', async () => {
    const { result } = await executeHarness({
      includeAuthorizer: false,
    });
    expect(result.status).toBe('FAILED');
    expect(checkpointIssue(result)).toBe(
      'CHECKPOINT_PRODUCER_UNAUTHORIZED'
    );
  });

  it('57. fails closed when the authorizer rejects the producer', async () => {
    const { harness, result } = await executeHarness({
      authorized: false,
    });
    expect(harness.authorizer.isAuthorized).toHaveBeenCalledOnce();
    expect(result.status).toBe('FAILED');
    expect(checkpointIssue(result)).toBe(
      'CHECKPOINT_PRODUCER_UNAUTHORIZED'
    );
  });

  it('58. introduces zero BoundaryExecutionPort coupling', () => {
    expect(
      readSource(
        'src/modules/intelligence/os/bootstrap/PipelineBootstrapCheckpointMapper.ts'
      )
    ).not.toMatch(/BoundaryExecutionPort|boundary\/execution/i);
  });

  it('59. introduces zero Discovery coupling', () => {
    expect(
      readSource(
        'src/modules/intelligence/os/bootstrap/PipelineBootstrapCheckpointMapper.ts'
      )
    ).not.toMatch(
      /(?:from\s+|import\s*\()['"][^'"]*discovery|Discovery/i
    );
  });

  it('60. introduces zero Firebase coupling', () => {
    expect(
      readSource(
        'src/modules/intelligence/os/bootstrap/PipelineBootstrapCheckpointMapper.ts'
      )
    ).not.toMatch(/firebase|firestore/i);
  });

  it('61. introduces zero UI coupling', () => {
    expect(
      readSource(
        'src/modules/intelligence/os/bootstrap/PipelineBootstrapCheckpointMapper.ts'
      )
    ).not.toMatch(
      /(?:from\s+|import\s*\()['"][^'"]*(?:react|components|ui)\b/i
    );
  });

  it('62. introduces zero persistence or I/O coupling', () => {
    expect(
      readSource(
        'src/modules/intelligence/os/bootstrap/PipelineBootstrapCheckpointMapper.ts'
      )
    ).not.toMatch(
      /localStorage|sessionStorage|indexedDB|fetch\(|writeFile|database/i
    );
  });

  it('63. keeps the Orchestrator bootstrap-mapper independent', () => {
    expect(
      readSource(
        'src/modules/intelligence/os/AuraIntelligenceOrchestrator.ts'
      )
    ).not.toMatch(
      /PipelineBootstrapCheckpointMapper|BootstrapAcceptedState/
    );
  });

  it('64. keeps PipelineContextBuilder bootstrap-mapper independent', () => {
    expect(
      readSource(
        'src/modules/intelligence/os/PipelineContextBuilder.ts'
      )
    ).not.toMatch(
      /PipelineBootstrapCheckpointMapper|BootstrapAcceptedState|precomputedCheckpoint/
    );
  });

  it('65. keeps Coverage bootstrap-checkpoint independent', () => {
    expect(
      readSource(
        'src/modules/intelligence/enterprise-model/coverage/services/CoverageDecisionEngine.ts'
      )
    ).not.toMatch(
      /PipelineBootstrapCheckpointMapper|BootstrapAcceptedState|PrecomputedPipelineCheckpoint/
    );
  });

  it('66. keeps Planning bootstrap-checkpoint independent', () => {
    expect(
      readSource(
        'src/modules/intelligence/enterprise-model/planning/services/AdaptiveQuestionPlanner.ts'
      )
    ).not.toMatch(
      /PipelineBootstrapCheckpointMapper|BootstrapAcceptedState|PrecomputedPipelineCheckpoint/
    );
  });

  it('67. keeps Reasoning bootstrap-checkpoint independent', () => {
    expect(
      readSource(
        'src/modules/intelligence/enterprise-model/reasoning/services/ExecutiveReasoningEngine.ts'
      )
    ).not.toMatch(
      /PipelineBootstrapCheckpointMapper|BootstrapAcceptedState|PrecomputedPipelineCheckpoint/
    );
  });
});
