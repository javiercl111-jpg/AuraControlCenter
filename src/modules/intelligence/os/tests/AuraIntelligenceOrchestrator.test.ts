import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { AuraIntelligenceOrchestrator } from '../AuraIntelligenceOrchestrator';
import type { AuraIntelligenceOSDependencies } from '../dependencyComposition';
import { PipelineExecutionContext } from '../PipelineExecutionContext';
import type { PipelineAggregatedState } from '../contextTypes';
import {
  createMinimalMentalModel,
  createMinimalKnowledgeGraph,
  createMinimalExtractionResult,
  createMinimalCoverageReport,
  createMinimalReadinessAssessment,
  createMinimalPlanResult,
  createMinimalReasoningReport,
  createMinimalDossier,
  createMinimalAssessment
} from './fixtures';
import type { PipelineClock, PipelineIdGenerator } from '../ports';
import type { PlannerPolicy } from '../../enterprise-model/planning/domain/types';
import type { ReasoningPolicy } from '../../enterprise-model/reasoning/policies/ReasoningPolicy';
import type { DossierPolicy, DiagnosticNarrativeProvider } from '../../enterprise-model/dossier/domain/types';
import type { AssessmentPolicy } from '../../enterprise-model/assessment/domain/types';
import type { IQuestionRealizationProvider } from '../../enterprise-model/planning/services/QuestionRealizationProvider';

describe('AuraIntelligenceOrchestrator', () => {
  let mockClock: PipelineClock;
  let mockIdGenerator: PipelineIdGenerator;
  let mockExtractionApplier: { applyExtraction: Mock };
  let mockCoverageDecisionEngine: { evaluateDecisionReadiness: Mock };
  let mockCoverageCalculator: { calculateOverallReport: Mock };
  let mockAdaptiveQuestionPlanner: { planQuestionsFromGraph: Mock };
  let mockExecutiveReasoningEngine: { execute: Mock };
  let mockExecutiveDossierBuilder: { build: Mock };
  let mockAssessmentBuilder: { build: Mock };

  let dependencies: AuraIntelligenceOSDependencies;
  let osContext: PipelineExecutionContext;

  beforeEach(() => {
    mockClock = {
      now: vi.fn().mockReturnValue(new Date('2026-01-01T10:00:00Z').getTime()),
      toISOString: vi.fn().mockReturnValue('2026-01-01T10:00:00.000Z')
    };

    mockIdGenerator = {
      generateExecutionId: vi.fn().mockReturnValue('exec-123')
    };

    mockExtractionApplier = {
      applyExtraction: vi.fn().mockReturnValue({
        mentalModel: createMinimalMentalModel(),
        knowledgeGraph: createMinimalKnowledgeGraph(),
        extractionResult: createMinimalExtractionResult()
      })
    };

    mockCoverageDecisionEngine = {
      evaluateDecisionReadiness: vi.fn().mockReturnValue(createMinimalReadinessAssessment())
    };

    mockCoverageCalculator = {
      calculateOverallReport: vi.fn().mockReturnValue(createMinimalCoverageReport())
    };

    mockAdaptiveQuestionPlanner = {
      planQuestionsFromGraph: vi.fn().mockResolvedValue(createMinimalPlanResult())
    };

    mockExecutiveReasoningEngine = {
      execute: vi.fn().mockReturnValue(createMinimalReasoningReport())
    };

    mockExecutiveDossierBuilder = {
      build: vi.fn().mockReturnValue(createMinimalDossier())
    };

    mockAssessmentBuilder = {
      build: vi.fn().mockReturnValue(createMinimalAssessment())
    };

    dependencies = {
      clock: mockClock,
      idGenerator: mockIdGenerator,
      plannerPolicy: { maxQuestionsPerPlan: 5, minConfidenceThreshold: 80, jaccardThreshold: 0.8, allowClosedQuestions: false } as PlannerPolicy,
      questionRealizationProvider: { realizeIntents: vi.fn() } as IQuestionRealizationProvider,
      reasoningPolicy: { minimumSupportThreshold: 0.7, minimumCausalConfidence: 0.85, requireDirectEvidenceForRisks: true, allowInferenceForOpportunities: true, failClosedOnCoverageScore: 0.6, failClosedOnMissingEntities: true, contradictionDemotionWeight: 0.5, maxInferenceSteps: 2 } as ReasoningPolicy,
      dossierPolicy: { getLevels: vi.fn(), evaluateScore: vi.fn() } as DossierPolicy,
      diagnosticNarrativeProvider: { generateNarrative: vi.fn(), generateExecutiveSummary: vi.fn() } as DiagnosticNarrativeProvider,
      assessmentPolicy: { version: '1', confidenceWeights: { support: 1, directness: 1, consistency: 1, coverage: 1, causalConfidence: 1 }, dimensionThresholds: { LEADERSHIP: 1, STRATEGY: 1, EXECUTION: 1, TECHNOLOGY: 1, CULTURE: 1, OPERATIONS: 1 }, globalConfidenceThreshold: 0.8, evaluateReadiness: vi.fn(), calculateConfidence: vi.fn(), determineAssessmentStatus: vi.fn() } as AssessmentPolicy,

      extractionApplier: mockExtractionApplier,
      coverageDecisionEngine: mockCoverageDecisionEngine,
      coverageCalculator: mockCoverageCalculator,
      adaptiveQuestionPlanner: mockAdaptiveQuestionPlanner,
      executiveReasoningEngine: mockExecutiveReasoningEngine,
      executiveDossierBuilder: mockExecutiveDossierBuilder,
      enterpriseTransformationAssessmentBuilder: mockAssessmentBuilder
    };

    osContext = new PipelineExecutionContext('exec-123', mockClock, { sessionId: 'sess-123', targetScenario: 'Test' });
  });

  it('Pipeline completo exitoso y orden exacto', async () => {
    const orchestrator = new AuraIntelligenceOrchestrator(osContext, dependencies);
    const inputState: PipelineAggregatedState = {
      sessionId: 'sess-123',
      targetScenario: 'Test',
      extractionResult: createMinimalExtractionResult(),
      mentalModel: createMinimalMentalModel(),
      knowledgeGraph: createMinimalKnowledgeGraph()
    };

    const result = await orchestrator.executePipeline({ sessionId: 'sess-123', targetScenario: 'Test' }, inputState);

    expect(result.status).toBe('SUCCESS');
    expect(result.errors).toHaveLength(0);

    expect(mockExtractionApplier.applyExtraction).toHaveBeenCalledTimes(1);
    expect(mockCoverageDecisionEngine.evaluateDecisionReadiness).toHaveBeenCalledTimes(1);
    expect(mockAdaptiveQuestionPlanner.planQuestionsFromGraph).toHaveBeenCalledTimes(1);
    expect(mockExecutiveReasoningEngine.execute).toHaveBeenCalledTimes(1);
    expect(mockExecutiveDossierBuilder.build).toHaveBeenCalledTimes(1);
    expect(mockAssessmentBuilder.build).toHaveBeenCalledTimes(1);

    expect(result.stageResults['EVIDENCE_EXTRACTION']?.status).toBe('SUCCEEDED');
    expect(result.stageResults['MENTAL_MODEL']?.status).toBe('SUCCEEDED');
    expect(result.stageResults['KNOWLEDGE_GRAPH']?.status).toBe('SUCCEEDED');
    expect(result.stageResults['KNOWLEDGE_COVERAGE']?.status).toBe('SUCCEEDED');
    expect(result.stageResults['ADAPTIVE_PLANNING']?.status).toBe('SUCCEEDED');
    expect(result.stageResults['EXECUTIVE_REASONING']?.status).toBe('SUCCEEDED');
    expect(result.stageResults['EXECUTIVE_DOSSIER']?.status).toBe('SUCCEEDED');
    expect(result.stageResults['TRANSFORMATION_ASSESSMENT']?.status).toBe('SUCCEEDED');
  });

  it('Fallo de Extraction salta etapas fundamentales', async () => {
    mockExtractionApplier.applyExtraction = vi.fn().mockImplementation(() => {
      throw new Error('Extraction failed');
    });

    const orchestrator = new AuraIntelligenceOrchestrator(osContext, dependencies);
    const inputState: PipelineAggregatedState = {
      sessionId: 'sess-123',
      targetScenario: 'Test',
      extractionResult: createMinimalExtractionResult(),
      mentalModel: createMinimalMentalModel(),
      knowledgeGraph: createMinimalKnowledgeGraph()
    };

    const result = await orchestrator.executePipeline({ sessionId: 'sess-123', targetScenario: 'Test' }, inputState);

    expect(result.status).toBe('FAILED');
    expect(result.stageResults['EVIDENCE_EXTRACTION']?.status).toBe('FAILED');
    expect(result.skippedStages).toContain('KNOWLEDGE_COVERAGE');
    expect(result.skippedStages).toContain('ADAPTIVE_PLANNING');
    expect(result.skippedStages).toContain('EXECUTIVE_REASONING');

    expect(mockCoverageDecisionEngine.evaluateDecisionReadiness).not.toHaveBeenCalled();
    expect(mockAdaptiveQuestionPlanner.planQuestionsFromGraph).not.toHaveBeenCalled();
  });

  it('Fallo de Reasoning salta Dossier y Assessment', async () => {
    mockExecutiveReasoningEngine.execute = vi.fn().mockImplementation(() => {
      throw new Error('Reasoning failed');
    });

    const orchestrator = new AuraIntelligenceOrchestrator(osContext, dependencies);
    const inputState: PipelineAggregatedState = {
      sessionId: 'sess-123',
      targetScenario: 'Test',
      extractionResult: createMinimalExtractionResult(),
      mentalModel: createMinimalMentalModel(),
      knowledgeGraph: createMinimalKnowledgeGraph()
    };

    const result = await orchestrator.executePipeline({ sessionId: 'sess-123', targetScenario: 'Test' }, inputState);

    expect(result.status).toBe('PARTIAL_SUCCESS');
    expect(result.stageResults['EXECUTIVE_REASONING']?.status).toBe('FAILED');
    expect(result.skippedStages).toContain('EXECUTIVE_DOSSIER');
    expect(result.skippedStages).toContain('TRANSFORMATION_ASSESSMENT');

    expect(mockExecutiveDossierBuilder.build).not.toHaveBeenCalled();
    expect(mockAssessmentBuilder.build).not.toHaveBeenCalled();
  });

  it('Cancelacion respeta el estado global', async () => {
    dependencies.cancellationSignal = { aborted: true, reason: 'Test' };

    const orchestrator = new AuraIntelligenceOrchestrator(osContext, dependencies);
    const result = await orchestrator.executePipeline({ sessionId: 'sess-123' }, undefined);

    expect(result.status).toBe('CANCELLED');
    expect(result.skippedStages).toContain('EVIDENCE_EXTRACTION');
    expect(mockExtractionApplier.applyExtraction).not.toHaveBeenCalled();
  });

  it('Ausencia de dependencias genera skip o fallo y produce PARTIAL_SUCCESS', async () => {
    delete dependencies.adaptiveQuestionPlanner;

    const orchestrator = new AuraIntelligenceOrchestrator(osContext, dependencies);
    const inputState: PipelineAggregatedState = {
      sessionId: 'sess-123',
      targetScenario: 'Test',
      extractionResult: createMinimalExtractionResult(),
      mentalModel: createMinimalMentalModel(),
      knowledgeGraph: createMinimalKnowledgeGraph()
    };

    const result = await orchestrator.executePipeline({ sessionId: 'sess-123' }, inputState);
    expect(result.status).toBe('PARTIAL_SUCCESS');
    expect(result.skippedStages).toContain('ADAPTIVE_PLANNING');
    expect(result.stageResults['EXECUTIVE_REASONING']?.status).toBe('SUCCEEDED');
  });

  it('Mutacion no ocurre en el input original', async () => {
    const orchestrator = new AuraIntelligenceOrchestrator(osContext, dependencies);
    const inputState: PipelineAggregatedState = {
      sessionId: 'sess-123',
      targetScenario: 'Test',
      extractionResult: createMinimalExtractionResult(),
      mentalModel: createMinimalMentalModel(),
      knowledgeGraph: createMinimalKnowledgeGraph()
    };
    const clonedInput = JSON.parse(JSON.stringify(inputState));

    const result = await orchestrator.executePipeline({ sessionId: 'sess-123', targetScenario: 'Test' }, inputState);

    expect(result.status).toBe('SUCCESS');
    expect(inputState).toEqual(clonedInput);
  });
});
