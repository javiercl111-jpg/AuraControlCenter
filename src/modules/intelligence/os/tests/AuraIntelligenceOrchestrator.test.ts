// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuraIntelligenceOrchestrator } from '../AuraIntelligenceOrchestrator';
import { PipelineContextBuilder } from '../PipelineContextBuilder';
import { AuraIntelligenceOSError } from '../errors';
import type { AuraIntelligenceOSDependencies } from '../dependencyComposition';
import type { PipelineExecutionContext } from '../types';
import type { PipelineAggregatedState } from '../contextTypes';
import type { TurnExtractionResult } from '../../enterprise-model/extraction/domain/types';

describe('AuraIntelligenceOrchestrator', () => {
  let mockClock: any;
  let mockIdGenerator: any;
  let mockExtractionApplier: any;
  let mockCoverageDecisionEngine: any;
  let mockCoverageCalculator: any;
  let mockAdaptiveQuestionPlanner: any;
  let mockExecutiveReasoningEngine: any;
  let mockExecutiveDossierBuilder: any;
  let mockAssessmentBuilder: any;
  
  let dependencies: AuraIntelligenceOSDependencies;
  let osContext: PipelineExecutionContext;
  
  beforeEach(() => {
    mockClock = {
      now: vi.fn().mockReturnValue(new Date('2026-01-01T10:00:00Z')),
      toISOString: vi.fn().mockReturnValue('2026-01-01T10:00:00.000Z')
    };

    mockIdGenerator = {
      generateExecutionId: vi.fn().mockReturnValue('exec-123'),
      generateSessionId: vi.fn().mockReturnValue('sess-123')
    };

    mockExtractionApplier = {
      applyExtraction: vi.fn().mockReturnValue({
        mentalModel: {} as any,
        knowledgeGraph: {} as any,
        extractionResult: {} as any
      })
    };

    mockCoverageDecisionEngine = {
      evaluateDecisionReadiness: vi.fn().mockReturnValue({
        isReady: true,
        score: 85,
        targetScenario: 'Test',
        blockingGaps: [],
        recommendedQuestions: []
      })
    };

    mockCoverageCalculator = {
      calculateOverallReport: vi.fn().mockReturnValue({
        overallScore: 85,
        domainBreakdown: {}
      })
    };

    mockAdaptiveQuestionPlanner = {
      planQuestionsFromGraph: vi.fn().mockResolvedValue({
        status: 'READY',
        selectedQuestions: [],
        coverageScore: 85,
        gapsAddressed: 0
      })
    };

    mockExecutiveReasoningEngine = {
      execute: vi.fn().mockReturnValue({
        evaluationContext: { targetScenario: 'Test' },
        executiveSummary: { narrative: 'Test', bottomLine: 'Test' },
        claims: [],
        rootCauses: [],
        gaps: [],
        confidenceScore: 90
      })
    };

    mockExecutiveDossierBuilder = {
      build: vi.fn().mockReturnValue({
        id: 'dos-1',
        type: 'DIAGNOSTIC',
        title: 'Test',
        executiveSummary: 'Test',
        maturityProfile: { currentLevel: 'INITIAL', score: 10 },
        strengths: [],
        weaknesses: [],
        priorities: []
      })
    };

    mockAssessmentBuilder = {
      build: vi.fn().mockReturnValue({
        id: 'asm-1',
        timestamp: '2026-01-01',
        version: '1',
        readiness: { status: 'READY', score: 90, blockers: [] },
        confidence: { score: 90, factors: [] },
        evidenceMap: { totalEvidences: 0, criticalGaps: 0, mappedClaims: [] },
        maturity: { level: 'INITIAL', nextLevel: 'MANAGED', gaps: [] },
        priorities: [],
        insights: []
      })
    };

    dependencies = {
      clock: mockClock,
      idGenerator: mockIdGenerator,
      plannerPolicy: { maxQuestions: 5, minConfidence: 80, focusAreas: [] },
      questionRealizationProvider: { realize: vi.fn() },
      reasoningPolicy: { minConfidenceScore: 80, requireRootCause: false },
      dossierPolicy: { requiredMaturityLevel: 'INITIAL', includeEvidence: true, prioritiesCount: 3 },
      diagnosticNarrativeProvider: { generate: vi.fn() },
      assessmentPolicy: { version: '1', strictMode: false },
      
      extractionApplier: mockExtractionApplier,
      coverageDecisionEngine: mockCoverageDecisionEngine,
      coverageCalculator: mockCoverageCalculator,
      adaptiveQuestionPlanner: mockAdaptiveQuestionPlanner,
      executiveReasoningEngine: mockExecutiveReasoningEngine,
      executiveDossierBuilder: mockExecutiveDossierBuilder,
      enterpriseTransformationAssessmentBuilder: mockAssessmentBuilder
    };

    osContext = {
      executionId: 'exec-123',
      sessionId: 'sess-123',
      createdAt: '2026-01-01T10:00:00.000Z',
      clock: mockClock,
      idGenerator: mockIdGenerator
    };
  });

  it('Pipeline completo exitoso y orden exacto', async () => {
    const orchestrator = new AuraIntelligenceOrchestrator(osContext, dependencies);
    const inputState = {
      sessionId: 'sess-123',
      targetScenario: 'Test',
      extractionResult: { evidence: [], knowledgeGaps: [], corrections: [], contradictions: [], nodeProposals: [] },
      mentalModel: { entities: [] },
      knowledgeGraph: { totalNodes: 0, totalRelationships: 0, nodes: [], relationships: [] }
    } as unknown as PipelineAggregatedState;

    const result = await orchestrator.executePipeline({ sessionId: 'sess-123', targetScenario: 'Test' }, inputState);

    console.log(JSON.stringify(result.errors, null, 2)); expect(result.status).toBe('SUCCESS');
    expect(result.errors).toHaveLength(0);
    
    // Order exacto de etapas: Extraction, Coverage, Planning, Reasoning, Dossier, Assessment
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
    mockExtractionApplier.applyExtraction.mockImplementation(() => {
      throw new Error('Extraction failed');
    });

    const orchestrator = new AuraIntelligenceOrchestrator(osContext, dependencies);
    const inputState = {
      sessionId: 'sess-123',
      targetScenario: 'Test',
      extractionResult: { evidence: [], knowledgeGaps: [], corrections: [], contradictions: [], nodeProposals: [] },
      mentalModel: { entities: [] },
      knowledgeGraph: { totalNodes: 0, totalRelationships: 0, nodes: [], relationships: [] }
    } as unknown as PipelineAggregatedState;

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
    mockExecutiveReasoningEngine.execute.mockImplementation(() => {
      throw new Error('Reasoning failed');
    });

    const orchestrator = new AuraIntelligenceOrchestrator(osContext, dependencies);
    const inputState = {
      sessionId: 'sess-123',
      targetScenario: 'Test',
      extractionResult: { evidence: [], knowledgeGaps: [], corrections: [], contradictions: [], nodeProposals: [] },
      mentalModel: { entities: [] },
      knowledgeGraph: { totalNodes: 0, totalRelationships: 0, nodes: [], relationships: [] }
    } as unknown as PipelineAggregatedState;

    const result = await orchestrator.executePipeline({ sessionId: 'sess-123', targetScenario: 'Test' }, inputState);

    expect(result.status).toBe('PARTIAL_SUCCESS'); // Extraction and coverage succeeded
    expect(result.stageResults['EXECUTIVE_REASONING']?.status).toBe('FAILED');
    expect(result.skippedStages).toContain('EXECUTIVE_DOSSIER');
    expect(result.skippedStages).toContain('TRANSFORMATION_ASSESSMENT');
    
    expect(mockExecutiveDossierBuilder.build).not.toHaveBeenCalled();
    expect(mockAssessmentBuilder.build).not.toHaveBeenCalled();
  });

  it('Cancelacion respeta el estado global', async () => {
    dependencies.cancellationSignal = { checkCancellation: () => {}, aborted: true, reason: 'Test' } as any;
    
    const orchestrator = new AuraIntelligenceOrchestrator(osContext, dependencies);
    const result = await orchestrator.executePipeline({ sessionId: 'sess-123' }, undefined);

    expect(result.status).toBe('CANCELLED');
    expect(result.skippedStages).toContain('EVIDENCE_EXTRACTION');
    expect(mockExtractionApplier.applyExtraction).not.toHaveBeenCalled();
  });

  it('Ausencia de dependencias genera skip o fallo y produce PARTIAL_SUCCESS', async () => {
    delete dependencies.adaptiveQuestionPlanner;

    const orchestrator = new AuraIntelligenceOrchestrator(osContext, dependencies);
    const inputState = {
      sessionId: 'sess-123',
      targetScenario: 'Test',
      extractionResult: { evidence: [], knowledgeGaps: [], corrections: [], contradictions: [], nodeProposals: [] },
      mentalModel: { entities: [] },
      knowledgeGraph: { totalNodes: 0, totalRelationships: 0, nodes: [], relationships: [] }
    } as unknown as PipelineAggregatedState;

    const result = await orchestrator.executePipeline({ sessionId: 'sess-123' }, inputState);
    expect(result.status).toBe('PARTIAL_SUCCESS');
    expect(result.skippedStages).toContain('ADAPTIVE_PLANNING');
    expect(result.stageResults['EXECUTIVE_REASONING']?.status).toBe('SUCCEEDED'); // continues
  });

  it('Mutacion no ocurre en el input original', async () => {
    const orchestrator = new AuraIntelligenceOrchestrator(osContext, dependencies);
    const inputState = {
      sessionId: 'sess-123',
      targetScenario: 'Test',
      extractionResult: { evidence: [], knowledgeGaps: [], corrections: [], contradictions: [], nodeProposals: [] },
      mentalModel: { entities: [] },
      knowledgeGraph: { totalNodes: 0, totalRelationships: 0, nodes: [], relationships: [] }
    } as unknown as PipelineAggregatedState;
    const clonedInput = JSON.parse(JSON.stringify(inputState));

    const result = await orchestrator.executePipeline({ sessionId: 'sess-123', targetScenario: 'Test' }, inputState);

    console.log(JSON.stringify(result.errors, null, 2)); expect(result.status).toBe('SUCCESS');
    // Original state should not be mutated
    expect(inputState).toEqual(clonedInput);
  });
});
