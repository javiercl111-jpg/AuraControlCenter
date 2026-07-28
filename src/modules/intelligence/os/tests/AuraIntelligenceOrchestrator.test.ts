import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
  createMinimalAssessment,
  createMinimalExecutionScenario
} from './fixtures';
import type { PipelineClock, PipelineIdGenerator, PipelineAuditSink } from '../ports';
import type { PlannerPolicy } from '../../enterprise-model/planning/domain/types';
import type { ReasoningPolicy } from '../../enterprise-model/reasoning/policies/ReasoningPolicy';
import type { DossierPolicy, DiagnosticNarrativeProvider } from '../../enterprise-model/dossier/domain/types';
import type { AssessmentPolicy } from '../../enterprise-model/assessment/domain/types';
import type { IQuestionRealizationProvider } from '../../enterprise-model/planning/services/QuestionRealizationProvider';
import { PipelineContextBuilder } from '../PipelineContextBuilder';
import { ErrorCodes } from '../errors';

describe('AuraIntelligenceOrchestrator - Resilience & Cancellation', () => {
  let mockClock: PipelineClock;
  let mockIdGenerator: PipelineIdGenerator;
  let mockAuditSink: PipelineAuditSink;
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
    vi.useFakeTimers();

    mockClock = {
      now: vi.fn().mockImplementation(() => {
        // En fake timers, Date.now() equals the fake time si avanzamos timers
        return Date.now();
      }),
      toISOString: vi.fn().mockImplementation(() => new Date(Date.now()).toISOString())
    };

    mockIdGenerator = { generateExecutionId: vi.fn().mockReturnValue('exec-123') };
    mockAuditSink = { log: vi.fn() };

    mockExtractionApplier = {
      applyExtraction: vi.fn().mockReturnValue({
        mentalModel: createMinimalMentalModel(),
        knowledgeGraph: createMinimalKnowledgeGraph(),
        extractionResult: createMinimalExtractionResult()
      })
    };
    mockCoverageDecisionEngine = { evaluateDecisionReadiness: vi.fn().mockReturnValue(createMinimalReadinessAssessment()) };
    mockCoverageCalculator = { calculateOverallReport: vi.fn().mockReturnValue(createMinimalCoverageReport()) };
    mockAdaptiveQuestionPlanner = { planQuestionsFromGraph: vi.fn().mockResolvedValue(createMinimalPlanResult()) };
    mockExecutiveReasoningEngine = { execute: vi.fn().mockReturnValue(createMinimalReasoningReport()) };
    mockExecutiveDossierBuilder = { build: vi.fn().mockReturnValue(createMinimalDossier()) };
    mockAssessmentBuilder = { build: vi.fn().mockReturnValue(createMinimalAssessment()) };

    dependencies = {
      clock: mockClock,
      idGenerator: mockIdGenerator,
      auditSink: mockAuditSink,
      timeoutPolicy: { getExecutionTimeoutMs: () => 5000, getStageTimeoutMs: () => 2000 },
      cancellationSignal: { aborted: false, reason: undefined },
      plannerPolicy: { maxQuestionsPerPlan: 5 } as PlannerPolicy,
      questionRealizationProvider: { realizeIntents: vi.fn() } as IQuestionRealizationProvider,
      reasoningPolicy: { minimumSupportThreshold: 0.7 } as ReasoningPolicy,
      dossierPolicy: { getLevels: vi.fn(), evaluateScore: vi.fn() } as DossierPolicy,
      diagnosticNarrativeProvider: { generateNarrative: vi.fn(), generateExecutiveSummary: vi.fn() } as DiagnosticNarrativeProvider,
      assessmentPolicy: { version: '1' } as AssessmentPolicy,

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

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('Pipeline completo exitoso y orden exacto', async () => {
    const orchestrator = new AuraIntelligenceOrchestrator(osContext, dependencies);
    const executionScenario = createMinimalExecutionScenario('Test');
    const coverageContextSpy = vi.spyOn(PipelineContextBuilder, 'buildCoverageContext');
    const inputState: PipelineAggregatedState = {
      sessionId: 'sess-123',
      executionScenario,
      targetScenario: 'Test',
      extractionResult: createMinimalExtractionResult(),
      mentalModel: createMinimalMentalModel(),
      knowledgeGraph: createMinimalKnowledgeGraph()
    };

    const resultPromise = orchestrator.executePipeline({ sessionId: 'sess-123', targetScenario: 'Test' }, inputState);
    await vi.advanceTimersByTimeAsync(1);
    const result = await resultPromise;

    expect(result.status).toBe('SUCCESS');
    expect(coverageContextSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        executionScenario: expect.objectContaining({ scenarioId: 'Test' })
      })
    );
    const propagatedState = coverageContextSpy.mock.calls[0][0];
    expect(propagatedState.executionScenario).not.toBe(executionScenario);
    expect(propagatedState.executionScenario?.includedDomains)
      .not.toBe(executionScenario.includedDomains);
    expect(mockCoverageDecisionEngine.evaluateDecisionReadiness).toHaveBeenCalledWith(
      expect.anything(),
      {
        scenarioId: 'Test',
        includedDomains: executionScenario.includedDomains,
        excludedDomains: executionScenario.excludedDomains
      }
    );
    expect(mockCoverageCalculator.calculateOverallReport).toHaveBeenCalledWith(
      expect.anything(),
      undefined,
      executionScenario.includedDomains
    );
    coverageContextSpy.mockRestore();
  });

  it('Rechaza OrchestrationInput con representaciones de scenario contradictorias', async () => {
    const orchestrator = new AuraIntelligenceOrchestrator(osContext, dependencies);
    const result = await orchestrator.executePipeline({
      sessionId: 'sess-123',
      executionScenario: createMinimalExecutionScenario('PAYROLL_AUDIT'),
      targetScenario: 'COMPLIANCE_AUDIT'
    });

    expect(result.status).toBe('FAILED');
    expect(result.errors).toEqual([
      expect.objectContaining({
        code: ErrorCodes.INVALID_CONTRACT,
        metadata: {
          executionScenarioId: 'PAYROLL_AUDIT',
          targetScenario: 'COMPLIANCE_AUDIT'
        }
      })
    ]);
    expect(mockCoverageDecisionEngine.evaluateDecisionReadiness).not.toHaveBeenCalled();
  });

  it('Propaga executionScenario desde OrchestrationInput al estado inicial', async () => {
    dependencies.extractionApplier = undefined;
    const orchestrator = new AuraIntelligenceOrchestrator(osContext, dependencies);
    const executionScenario = createMinimalExecutionScenario('PAYROLL_AUDIT');
    const coverageContextSpy = vi.spyOn(PipelineContextBuilder, 'buildCoverageContext');

    const resultPromise = orchestrator.executePipeline({
      sessionId: 'sess-123',
      executionScenario
    });
    await vi.advanceTimersByTimeAsync(1);
    await resultPromise;

    expect(coverageContextSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        executionScenario: expect.objectContaining({
          scenarioId: 'PAYROLL_AUDIT'
        }),
        targetScenario: undefined
      })
    );
    const propagatedState = coverageContextSpy.mock.calls[0][0];
    expect(propagatedState.executionScenario).not.toBe(executionScenario);
    expect(mockCoverageDecisionEngine.evaluateDecisionReadiness).not.toHaveBeenCalled();
  });

  it('Ejecuta Coverage nominal sin targetScenario y propaga el scope a Planning', async () => {
    const orchestrator = new AuraIntelligenceOrchestrator(osContext, dependencies);
    const executionScenario = createMinimalExecutionScenario(
      'ORGANIZATION_RESTRUCTURE'
    );
    const inputState: PipelineAggregatedState = {
      sessionId: 'sess-123',
      executionScenario,
      extractionResult: createMinimalExtractionResult(),
      mentalModel: createMinimalMentalModel(),
      knowledgeGraph: createMinimalKnowledgeGraph()
    };

    const resultPromise = orchestrator.executePipeline(
      { sessionId: 'sess-123' },
      inputState
    );
    await vi.advanceTimersByTimeAsync(1);
    const result = await resultPromise;

    expect(result.status).toBe('SUCCESS');
    expect(mockCoverageCalculator.calculateOverallReport).toHaveBeenCalledWith(
      expect.anything(),
      undefined,
      executionScenario.includedDomains
    );
    expect(mockCoverageDecisionEngine.evaluateDecisionReadiness).toHaveBeenCalledWith(
      expect.anything(),
      {
        scenarioId: 'ORGANIZATION_RESTRUCTURE',
        includedDomains: executionScenario.includedDomains,
        excludedDomains: executionScenario.excludedDomains
      }
    );
    expect(mockAdaptiveQuestionPlanner.planQuestionsFromGraph).toHaveBeenCalledWith(
      expect.objectContaining({
        targetScenario: undefined,
        coverageScenario: {
          scenarioId: 'ORGANIZATION_RESTRUCTURE',
          includedDomains: executionScenario.includedDomains,
          excludedDomains: executionScenario.excludedDomains
        }
      }),
      expect.anything()
    );
    expect(executionScenario.includedDomains).toEqual([
      'organization',
      'workforce_analytics',
      'talent_performance'
    ]);
  });

  it('Timeout global antes de completar', async () => {
    // Stage timeout = 2000, Global = 5000.
    // We will make planning stage take 6000ms. Since it's limited by min(2000, 5000) it will throw STAGE_TIMEOUT.
    // Wait, if we want PIPELINE_TIMEOUT to trigger, we need total elapsed time to hit 5000.
    // So let's make extraction take 0ms, coverage take 0ms, and we'll change stageTimeout for Planning to 10000ms,
    // so it hits the global timeout of 5000.
    dependencies.timeoutPolicy = { getExecutionTimeoutMs: () => 5000, getStageTimeoutMs: () => 10000 };

    mockAdaptiveQuestionPlanner.planQuestionsFromGraph = vi.fn().mockImplementation(() => {
      return new Promise(resolve => setTimeout(resolve, 6000));
    });

    const orchestrator = new AuraIntelligenceOrchestrator(osContext, dependencies);
    const inputState: PipelineAggregatedState = {
      sessionId: 'sess-123',
      extractionResult: createMinimalExtractionResult(),
      mentalModel: createMinimalMentalModel(),
      knowledgeGraph: createMinimalKnowledgeGraph(),
      coverageReport: createMinimalCoverageReport(),
      readinessAssessment: createMinimalReadinessAssessment()
    }; // Skip early stages to hit planning directly

    const resultPromise = orchestrator.executePipeline({ sessionId: 'sess-123' }, inputState);
    await vi.advanceTimersByTimeAsync(5500); // 5500 > 5000 (global timeout hits)
    const result = await resultPromise;

    expect(result.status).toBe('TIMED_OUT');
    expect(result.skippedStages).toContain('EXECUTIVE_REASONING');
    expect(result.stageResults['ADAPTIVE_PLANNING']?.status).toBe('TIMED_OUT');
  });

  it('Timeout de una etapa preserva resultado anterior y omite las siguientes', async () => {
    // Stage timeout = 2000, Global = 5000.
    mockAdaptiveQuestionPlanner.planQuestionsFromGraph = vi.fn().mockImplementation(() => {
      return new Promise(resolve => setTimeout(resolve, 3000));
    });

    const orchestrator = new AuraIntelligenceOrchestrator(osContext, dependencies);
    const inputState: PipelineAggregatedState = {
      sessionId: 'sess-123',
      extractionResult: createMinimalExtractionResult(),
      mentalModel: createMinimalMentalModel(),
      knowledgeGraph: createMinimalKnowledgeGraph(),
      coverageReport: createMinimalCoverageReport(),
      readinessAssessment: createMinimalReadinessAssessment()
    };

    const resultPromise = orchestrator.executePipeline({ sessionId: 'sess-123' }, inputState);
    await vi.advanceTimersByTimeAsync(2500); // 2500 > 2000 (stage timeout hits)
    const result = await resultPromise;

    // Orchestrator status when a stage times out should be TIMED_OUT globally (according to requirements).
    expect(result.status).toBe('TIMED_OUT');
    expect(result.stageResults['ADAPTIVE_PLANNING']?.status).toBe('TIMED_OUT');
    expect(result.skippedStages).toContain('EXECUTIVE_REASONING');
  });

  it('Resultado tardio ignorado sin modificar estado ni fallar', async () => {
    let lateResolve!: (value: unknown) => void;
    mockAdaptiveQuestionPlanner.planQuestionsFromGraph = vi.fn().mockImplementation(() => {
      return new Promise(resolve => { lateResolve = resolve; });
    });

    const orchestrator = new AuraIntelligenceOrchestrator(osContext, dependencies);
    const inputState: PipelineAggregatedState = {
      sessionId: 'sess-123',
      extractionResult: createMinimalExtractionResult(),
      mentalModel: createMinimalMentalModel(),
      knowledgeGraph: createMinimalKnowledgeGraph(),
      coverageReport: createMinimalCoverageReport(),
      readinessAssessment: createMinimalReadinessAssessment()
    };

    const resultPromise = orchestrator.executePipeline({ sessionId: 'sess-123' }, inputState);
    await vi.advanceTimersByTimeAsync(2500); // Stage timeout hits (2000)
    const result = await resultPromise;
    expect(result.status).toBe('TIMED_OUT');

    // Now resolve late
    lateResolve(createMinimalPlanResult());
    await vi.advanceTimersByTimeAsync(1); // Flush microtasks

    // Check audit sink
    expect(mockAuditSink.log).toHaveBeenCalledWith('WARN', expect.stringContaining('Late resolution'), expect.anything());
  });

  it('Cancelacion antes de iniciar', async () => {
    dependencies.cancellationSignal = { aborted: true, reason: 'Test' };
    const orchestrator = new AuraIntelligenceOrchestrator(osContext, dependencies);
    const result = await orchestrator.executePipeline({ sessionId: 'sess-123' });
    expect(result.status).toBe('CANCELLED');
    expect(result.skippedStages).toContain('EVIDENCE_EXTRACTION');
  });

  it('Cancelacion entre etapas (Extraction y Coverage)', async () => {
    let aborted = false;
    dependencies.cancellationSignal = {
      get aborted() { return aborted; }
    };
    mockExtractionApplier.applyExtraction = vi.fn().mockImplementation(() => {
      // simulate cancelling right after extraction by setting aborted true
      aborted = true;
      return { mentalModel: createMinimalMentalModel(), knowledgeGraph: createMinimalKnowledgeGraph(), extractionResult: createMinimalExtractionResult() };
    });

    const orchestrator = new AuraIntelligenceOrchestrator(osContext, dependencies);
    const inputState: PipelineAggregatedState = { sessionId: 'sess-123', extractionResult: createMinimalExtractionResult(), mentalModel: createMinimalMentalModel(), knowledgeGraph: createMinimalKnowledgeGraph() };

    const resultPromise = orchestrator.executePipeline({ sessionId: 'sess-123' }, inputState);
    await vi.advanceTimersByTimeAsync(1);
    const result = await resultPromise;

    expect(result.status).toBe('CANCELLED');
    expect(result.stageResults['EVIDENCE_EXTRACTION']?.status).toBe('CANCELLED');
    expect(result.skippedStages).toContain('KNOWLEDGE_COVERAGE');
  });

  it('Fallo del audit sink no rompe pipeline', async () => {
    mockAuditSink.log = vi.fn().mockImplementation(() => { throw new Error('AuditSink down'); });
    mockAdaptiveQuestionPlanner.planQuestionsFromGraph = vi.fn().mockImplementation(() => Promise.reject(new Error('Engine Error')));

    const orchestrator = new AuraIntelligenceOrchestrator(osContext, dependencies);
    const inputState: PipelineAggregatedState = {
      sessionId: 'sess-123',
      extractionResult: createMinimalExtractionResult(),
      mentalModel: createMinimalMentalModel(),
      knowledgeGraph: createMinimalKnowledgeGraph(),
      coverageReport: createMinimalCoverageReport(),
      readinessAssessment: createMinimalReadinessAssessment()
    };

    const resultPromise = orchestrator.executePipeline({ sessionId: 'sess-123' }, inputState);
    await vi.advanceTimersByTimeAsync(1);
    const result = await resultPromise;

    expect(result.status).toBe('PARTIAL_SUCCESS'); // Coverage passed, Planning failed normally -> PARTIAL_SUCCESS
  });

  it('Dos ejecuciones no comparten estado', async () => {
    const orchestrator1 = new AuraIntelligenceOrchestrator(osContext, dependencies);
    const orchestrator2 = new AuraIntelligenceOrchestrator(osContext, dependencies);

    const input1: PipelineAggregatedState = { sessionId: '1', extractionResult: createMinimalExtractionResult(), mentalModel: createMinimalMentalModel(), knowledgeGraph: createMinimalKnowledgeGraph() };
    const input2: PipelineAggregatedState = { sessionId: '2' };

    const p1 = orchestrator1.executePipeline({ sessionId: '1' }, input1);
    const p2 = orchestrator2.executePipeline({ sessionId: '2' }, input2);

    await vi.advanceTimersByTimeAsync(1);
    const [res1, res2] = await Promise.all([p1, p2]);

    expect(res1.sessionId).toBe('1');
    expect(res2.sessionId).toBe('2');
    expect(res1.stageResults['EVIDENCE_EXTRACTION']?.status).toBe('SUCCEEDED');
    expect(res2.stageResults['EVIDENCE_EXTRACTION']?.status).toBe('FAILED');
  });

  it('Input original no mutado y arrays clonados', async () => {
    const orchestrator = new AuraIntelligenceOrchestrator(osContext, dependencies);
    const inputState: PipelineAggregatedState = {
      sessionId: 'sess-123',
      objectiveIds: ['obj-1'],
      evidence: [{
        evidenceId: '1',
        sessionId: 'sess-123',
        turnId: 'turn-1',
        source: 'test',
        sourceType: 'DOCUMENT',
        originalText: 'test',
        normalizedStatement: 'test',
        category: 'test',
        entityRefs: [],
        capturedAt: 0,
        reliability: 0.9,
        directness: 1,
        polarity: 'POSITIVE',
        extractorVersion: '1',
        metadata: {}
      }]
    };
    const clonedInput = JSON.parse(JSON.stringify(inputState));

    const p = orchestrator.executePipeline({ sessionId: 'sess-123' }, inputState);
    await vi.advanceTimersByTimeAsync(1);
    await p;

    expect(inputState).toEqual(clonedInput);
  });
});
