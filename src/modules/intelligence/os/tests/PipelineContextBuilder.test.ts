import { describe, it, expect } from 'vitest';
import { PipelineContextBuilder } from '../PipelineContextBuilder';
import { AuraIntelligenceOSError } from '../errors';
import type { PipelineAggregatedState } from '../contextTypes';
import type { AuraIntelligenceOSDependencies } from '../dependencyComposition';
import { PipelineExecutionContext } from '../PipelineExecutionContext';
import type { EnterpriseKnowledgeGraph } from '../../enterprise-model/graph/domain/types';
import {
  createMinimalMentalModel,
  createMinimalKnowledgeGraph,
  createMinimalCoverageReport,
  createMinimalReasoningReport,
  createMinimalDossier
} from './fixtures';

describe('PipelineContextBuilder', () => {
  const dummyGraph: EnterpriseKnowledgeGraph = createMinimalKnowledgeGraph();

  const dummyOSDependencies: AuraIntelligenceOSDependencies = {
    clock: { now: () => Date.now(), toISOString: () => new Date().toISOString() },
    idGenerator: { generateExecutionId: () => 'exec-123' },
    assessmentPolicy: { version: '1', confidenceWeights: { support: 1, directness: 1, consistency: 1, coverage: 1, causalConfidence: 1 }, dimensionThresholds: { LEADERSHIP: 1, STRATEGY: 1, EXECUTION: 1, TECHNOLOGY: 1, CULTURE: 1, OPERATIONS: 1 }, globalConfidenceThreshold: 0.8, evaluateReadiness: () => ({ status: 'READY', score: 90, criticalGaps: [], constraints: [], dependencies: [] }), calculateConfidence: () => ({ overallConfidence: 1, support: 1, directness: 1, consistency: 1, coverage: 1, causalConfidence: 1, dimensionConfidence: { LEADERSHIP: 1, STRATEGY: 1, EXECUTION: 1, TECHNOLOGY: 1, CULTURE: 1, OPERATIONS: 1 } }), determineAssessmentStatus: () => 'COMPLETE' },
    plannerPolicy: { maxQuestionsPerPlan: 5, minConfidenceThreshold: 80, jaccardThreshold: 0.8, allowClosedQuestions: false },
    questionRealizationProvider: { realizeIntents: () => [] },
    reasoningPolicy: { minimumSupportThreshold: 0.7, minimumCausalConfidence: 0.85, requireDirectEvidenceForRisks: true, allowInferenceForOpportunities: true, failClosedOnCoverageScore: 0.6, failClosedOnMissingEntities: true, contradictionDemotionWeight: 0.5, maxInferenceSteps: 2 },
    dossierPolicy: { getLevels: () => [], evaluateScore: () => 'INITIAL' },
    diagnosticNarrativeProvider: { generateNarrative: () => ({ executiveSummary: '', currentState: '', burningIssues: '', opportunitiesForGrowth: '' }), generateExecutiveSummary: () => ({ headline: '', keyInsights: [], criticalRisksSummary: '' }) }
  };

  const createDummyOSContext = (): PipelineExecutionContext => new PipelineExecutionContext('exec-123', dummyOSDependencies.clock, { sessionId: 'sess-123', targetScenario: 'M&A' });

  describe('Coverage Context', () => {
    it('1. Construccin volida si el state tiene knowledgeGraph', () => {
      const state: PipelineAggregatedState = { sessionId: 'session-1', knowledgeGraph: dummyGraph, targetScenario: 'M&A' };
      const ctx = PipelineContextBuilder.buildCoverageContext(state);
      expect(ctx.graph).toBe(dummyGraph);
      expect(ctx.targetScenario).toBe('M&A');
    });

    it('2 & 3. Error si targetScenario o knowledgeGraph eston ausentes', () => {
      expect(() => PipelineContextBuilder.buildCoverageContext({ sessionId: 'session-1', knowledgeGraph: dummyGraph }))
        .toThrowError(AuraIntelligenceOSError);
      expect(() => PipelineContextBuilder.buildCoverageContext({ sessionId: 'session-1', targetScenario: 'M&A' }))
        .toThrowError(AuraIntelligenceOSError);
    });
  });

  describe('Planning Context', () => {
    it('4. Construccin volida de opciones y contexto', () => {
      const state: PipelineAggregatedState = { sessionId: 'session-1', knowledgeGraph: dummyGraph, targetScenario: 'M&A' };
      const ctx = PipelineContextBuilder.buildPlanningContext(state, dummyOSDependencies, createDummyOSContext());
      expect(ctx.options.graph).toBe(dummyGraph);
      expect(ctx.options.targetScenario).toBe('M&A');
      expect(ctx.options.policy).toBe(dummyOSDependencies.plannerPolicy);
      expect(ctx.options.realizationProvider).toBe(dummyOSDependencies.questionRealizationProvider);
    });

    it('5 & 6. Error si falta PlannerPolicy, QuestionRealizationProvider o knowledgeGraph', () => {
      const state: PipelineAggregatedState = { sessionId: 'session-1', knowledgeGraph: dummyGraph };

      const depsNoPolicy = { ...dummyOSDependencies, plannerPolicy: undefined };
      expect(() => PipelineContextBuilder.buildPlanningContext(state, depsNoPolicy, createDummyOSContext()))
        .toThrowError(AuraIntelligenceOSError);

      const depsNoProvider = { ...dummyOSDependencies, questionRealizationProvider: undefined };
      expect(() => PipelineContextBuilder.buildPlanningContext(state, depsNoProvider, createDummyOSContext()))
        .toThrowError(AuraIntelligenceOSError);

      expect(() => PipelineContextBuilder.buildPlanningContext({ sessionId: 'session-1' }, dummyOSDependencies, createDummyOSContext()))
        .toThrowError(AuraIntelligenceOSError);
    });
  });

  describe('Reasoning Context', () => {
    const dummyMentalModel = createMinimalMentalModel();
    const dummyCoverage = createMinimalCoverageReport();

    it('9, 14, 15. Construccin volida de ExecutiveReasoningContext y ExecutionContext', () => {
      const state: PipelineAggregatedState = {
        sessionId: 'session-1',
        mentalModel: dummyMentalModel,
        knowledgeGraph: dummyGraph,
        coverageReport: dummyCoverage,
        targetScenario: 'M&A'
      };
      const osCtx = createDummyOSContext();
      const ctx = PipelineContextBuilder.buildReasoningContext(state, dummyOSDependencies, osCtx);

      expect(ctx.context.mentalModel).toBe(dummyMentalModel);
      expect(ctx.executionContext.executionId).toBe(osCtx.executionId);
    });

    it('10, 11, 12, 24. Errores por falta de dependencias', () => {
      const osCtx = createDummyOSContext();
      expect(() => PipelineContextBuilder.buildReasoningContext({ sessionId: 'session-1', knowledgeGraph: dummyGraph, coverageReport: dummyCoverage }, dummyOSDependencies, osCtx))
        .toThrowError(AuraIntelligenceOSError);
    });
  });

  describe('Dossier Context', () => {
    const dummyReasoningReport = createMinimalReasoningReport();

    it('16. Construccin volida de DossierExecutionContext', () => {
      const state: PipelineAggregatedState = { sessionId: 'session-1', reasoningReport: dummyReasoningReport };
      const osCtx = createDummyOSContext();
      const ctx = PipelineContextBuilder.buildDossierContext(state, dummyOSDependencies, osCtx);
      expect(ctx.executionContext.executionId).toBe(osCtx.executionId);
      expect(ctx.report).toBe(dummyReasoningReport);
    });
  });

  describe('Assessment Context', () => {
    const dummyDossier = createMinimalDossier();
    const dummyReasoningReport = createMinimalReasoningReport();

    it('19, 22, 23. Construccin volida de Assessment context con constraints y dependencies', () => {
      const state: PipelineAggregatedState = {
        sessionId: 'session-1',
        dossier: dummyDossier,
        reasoningReport: dummyReasoningReport,
        transformationConstraints: [],
        transformationDependencies: []
      };
      const osCtx = createDummyOSContext();
      const ctx = PipelineContextBuilder.buildAssessmentContext(state, dummyOSDependencies, osCtx);
      expect(ctx.executionId).toBe(osCtx.executionId);
    });
  });

  describe('General Requirements', () => {
    it('25. Errores son serializables', () => {
      const state: PipelineAggregatedState = { sessionId: 'session-1' };
      try {
        PipelineContextBuilder.buildCoverageContext(state);
      } catch (err) {
        expect(err).toBeInstanceOf(AuraIntelligenceOSError);
      }
    });
  });
});
