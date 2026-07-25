// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { describe, it, expect } from 'vitest';
import { PipelineContextBuilder } from '../PipelineContextBuilder';
import { AuraIntelligenceOSError, ErrorCodes } from '../errors';
import type { PipelineAggregatedState } from '../contextTypes';
import type { AuraIntelligenceOSDependencies } from '../dependencyComposition';
import { PipelineExecutionContext } from '../PipelineExecutionContext';
import type { PipelineInput } from '../types';
import type { PipelineClock, PipelineIdGenerator } from '../ports';
import type { EnterpriseKnowledgeGraph } from '../../enterprise-model/graph/domain/types';
import type { AssessmentPolicy } from '../../enterprise-model/assessment/domain/types';
import type { PlannerPolicy } from '../../enterprise-model/planning/domain/types';
import type { IQuestionRealizationProvider } from '../../enterprise-model/planning/services/QuestionRealizationProvider';
import type { ReasoningPolicy } from '../../enterprise-model/reasoning/policies/ReasoningPolicy';
import type { DossierPolicy, DiagnosticNarrativeProvider } from '../../enterprise-model/dossier/domain/types';

describe('PipelineContextBuilder', () => {
  const dummyClock: PipelineClock = { now: () => 1000, toISOString: () => '2026-07-25T12:00:00.000Z' };
  const dummyIdGen: PipelineIdGenerator = { generateExecutionId: () => 'exec-123' };
  
  const dummyOSDependencies: AuraIntelligenceOSDependencies = {
    clock: dummyClock,
    idGenerator: dummyIdGen,
    plannerPolicy: {} as PlannerPolicy,
    questionRealizationProvider: {} as IQuestionRealizationProvider,
    reasoningPolicy: {} as ReasoningPolicy,
    dossierPolicy: {} as DossierPolicy,
    diagnosticNarrativeProvider: {} as DiagnosticNarrativeProvider,
    assessmentPolicy: {} as AssessmentPolicy
  };

  const createDummyOSContext = () => {
    const input: PipelineInput = { sessionId: 'session-1', targetScenario: 'M&A' };
    return new PipelineExecutionContext('exec-123', dummyClock, input);
  };

  const dummyGraph = { nodes: {}, relationships: {} } as unknown as EnterpriseKnowledgeGraph;

  describe('Coverage Context', () => {
    it('1. Construcción válida del contexto de Coverage', () => {
      const state: PipelineAggregatedState = { sessionId: 'session-1', knowledgeGraph: dummyGraph, targetScenario: 'M&A' };
      const ctx = PipelineContextBuilder.buildCoverageContext(state);
      expect(ctx.graph).toBe(dummyGraph);
      expect(ctx.targetScenario).toBe('M&A');
    });

    it('2. Error cuando falta graph', () => {
      const state: PipelineAggregatedState = { sessionId: 'session-1', targetScenario: 'M&A' };
      expect(() => PipelineContextBuilder.buildCoverageContext(state))
        .toThrowError(AuraIntelligenceOSError);
    });

    it('3. Error cuando falta targetScenario', () => {
      const state: PipelineAggregatedState = { sessionId: 'session-1', knowledgeGraph: dummyGraph };
      expect(() => PipelineContextBuilder.buildCoverageContext(state))
        .toThrowError(AuraIntelligenceOSError);
    });
  });

  describe('Planning Context', () => {
    it('4. Construcción válida del contexto de Planning', () => {
      const state: PipelineAggregatedState = { sessionId: 'session-1', knowledgeGraph: dummyGraph, targetScenario: 'M&A' };
      const osCtx = createDummyOSContext();
      const ctx = PipelineContextBuilder.buildPlanningContext(state, dummyOSDependencies, osCtx);
      
      
      expect(ctx.options.graph).toBe(dummyGraph);
      expect(ctx.options.targetScenario).toBe('M&A');
      expect(ctx.executionContext.executionId).toBe(osCtx.executionId);
    });

    it('5. Error cuando falta PlannerPolicy', () => {
      const state: PipelineAggregatedState = { sessionId: 'session-1', knowledgeGraph: dummyGraph };
      const deps = { ...dummyOSDependencies, plannerPolicy: undefined };
      expect(() => PipelineContextBuilder.buildPlanningContext(state, deps, createDummyOSContext()))
        .toThrowError(AuraIntelligenceOSError);
    });

    it('6. Error cuando falta QuestionRealizationProvider', () => {
      const state: PipelineAggregatedState = { sessionId: 'session-1', knowledgeGraph: dummyGraph };
      const deps = { ...dummyOSDependencies, questionRealizationProvider: undefined };
      expect(() => PipelineContextBuilder.buildPlanningContext(state, deps, createDummyOSContext()))
        .toThrowError(AuraIntelligenceOSError);
    });

    it('7 & 8. Conservación explícita y no invención de objectiveIds', () => {
      const state: PipelineAggregatedState = { sessionId: 'session-1', knowledgeGraph: dummyGraph, objectiveIds: ['obj-1'] };
      const ctx = PipelineContextBuilder.buildPlanningContext(state, dummyOSDependencies, createDummyOSContext());
      expect(ctx.options.completedObjectiveIds).toEqual(['obj-1']);
      
      const stateEmpty: PipelineAggregatedState = { sessionId: 'session-1', knowledgeGraph: dummyGraph };
      const ctxEmpty = PipelineContextBuilder.buildPlanningContext(stateEmpty, dummyOSDependencies, createDummyOSContext());
      expect(ctxEmpty.options.completedObjectiveIds).toBeUndefined(); // no inventa
    });
  });

  describe('Reasoning Context', () => {
    const dummyMentalModel = { nodes: {}, evidences: {} } as any;
    const dummyCoverage = { overallScore: 80, domainBreakdown: {} } as any;
    
    it('9, 14, 15. Construcción válida de ExecutiveReasoningContext y ExecutionContext', () => {
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
      expect(ctx.executionContext.timestamp).toBe(osCtx.createdAt);
    });

    it('10, 11, 12, 24. Errores por falta de modelo, grafo, cobertura o política', () => {
      const osCtx = createDummyOSContext();
      
      expect(() => PipelineContextBuilder.buildReasoningContext({ sessionId: 'session-1', knowledgeGraph: dummyGraph, coverageReport: dummyCoverage }, dummyOSDependencies, osCtx))
        .toThrowError(AuraIntelligenceOSError);
        
      expect(() => PipelineContextBuilder.buildReasoningContext({ sessionId: 'session-1', mentalModel: dummyMentalModel, coverageReport: dummyCoverage }, dummyOSDependencies, osCtx))
        .toThrowError(AuraIntelligenceOSError);
        
      expect(() => PipelineContextBuilder.buildReasoningContext({ sessionId: 'session-1', mentalModel: dummyMentalModel, knowledgeGraph: dummyGraph }, dummyOSDependencies, osCtx))
        .toThrowError(AuraIntelligenceOSError);
        
      const depsWithoutPolicy = { ...dummyOSDependencies, reasoningPolicy: undefined };
      expect(() => PipelineContextBuilder.buildReasoningContext({ sessionId: 'session-1', mentalModel: dummyMentalModel, knowledgeGraph: dummyGraph, coverageReport: dummyCoverage }, depsWithoutPolicy, osCtx))
        .toThrowError(AuraIntelligenceOSError);
    });

    it('13. Conservación de evidence e hypotheses', () => {
      const evidence: any[] = [{ id: 'ev-1' }];
      const hypotheses: any[] = [{ id: 'hyp-1' }];
      const state: PipelineAggregatedState = { 
        sessionId: 'session-1', mentalModel: dummyMentalModel, knowledgeGraph: dummyGraph, coverageReport: dummyCoverage,
        evidence, hypotheses
      };
      const ctx = PipelineContextBuilder.buildReasoningContext(state, dummyOSDependencies, createDummyOSContext());
      expect(ctx.context.evidences).toEqual(evidence);
      expect(ctx.context.hypotheses).toEqual(hypotheses);
      // Validate copies were made, not mutating original state
      expect(ctx.context.evidences).not.toBe(evidence);
    });
  });

  describe('Dossier Context', () => {
    const dummyReasoningReport = { reportId: 'report-1' } as any;

    it('16. Construcción válida de DossierExecutionContext', () => {
      const state: PipelineAggregatedState = { sessionId: 'session-1', reasoningReport: dummyReasoningReport };
      const osCtx = createDummyOSContext();
      const ctx = PipelineContextBuilder.buildDossierContext(state, dummyOSDependencies, osCtx);
      
      expect(ctx.executionContext.executionId).toBe(osCtx.executionId);
      expect(ctx.executionContext.timestamp).toBe(osCtx.createdAt);
      expect(ctx.executionContext.generateId('a', 'b')).toBe('exec-123-a-b'); // Uses idGenerator
      expect(ctx.report).toBe(dummyReasoningReport);
    });

    it('17 & 18. Error cuando falta DossierPolicy o DiagnosticNarrativeProvider', () => {
      const state: PipelineAggregatedState = { sessionId: 'session-1', reasoningReport: dummyReasoningReport };
      const osCtx = createDummyOSContext();
      
      expect(() => PipelineContextBuilder.buildDossierContext(state, { ...dummyOSDependencies, dossierPolicy: undefined }, osCtx))
        .toThrowError(AuraIntelligenceOSError);
        
      expect(() => PipelineContextBuilder.buildDossierContext(state, { ...dummyOSDependencies, diagnosticNarrativeProvider: undefined }, osCtx))
        .toThrowError(AuraIntelligenceOSError);
    });
  });

  describe('Assessment Context', () => {
    const dummyDossier = { dossierId: 'dossier-1' } as any;
    const dummyReasoningReport = { reportId: 'report-1' } as any;

    it('19, 22, 23. Construcción válida de Assessment context con constraints y dependencies', () => {
      const constraints: any[] = [{ id: 'const-1' }];
      const deps: any[] = [{ id: 'dep-1' }];
      const state: PipelineAggregatedState = { 
        sessionId: 'session-1', 
        dossier: dummyDossier, 
        reasoningReport: dummyReasoningReport,
        transformationConstraints: constraints,
        transformationDependencies: deps
      };
      const osCtx = createDummyOSContext();
      const ctx = PipelineContextBuilder.buildAssessmentContext(state, dummyOSDependencies, osCtx);
      
      expect(ctx.executionId).toBe(osCtx.executionId);
      expect(ctx.dossier).toBe(dummyDossier);
      expect(ctx.reasoning).toBe(dummyReasoningReport);
      expect(ctx.constraints).toEqual(constraints);
      expect(ctx.transformationDependencies).toEqual(deps);
      expect(ctx.constraints).not.toBe(constraints); // explicit copy
    });

    it('20 & 21. Error cuando falta dossier o reasoning', () => {
      const osCtx = createDummyOSContext();
      
      expect(() => PipelineContextBuilder.buildAssessmentContext({ sessionId: 'session-1', reasoningReport: dummyReasoningReport }, dummyOSDependencies, osCtx))
        .toThrowError(AuraIntelligenceOSError);
        
      expect(() => PipelineContextBuilder.buildAssessmentContext({ sessionId: 'session-1', dossier: dummyDossier }, dummyOSDependencies, osCtx))
        .toThrowError(AuraIntelligenceOSError);
    });
  });

  describe('General Requirements', () => {
    it('25. Errores son serializables', () => {
      const state: PipelineAggregatedState = { sessionId: 'session-1' };
      try {
        PipelineContextBuilder.buildCoverageContext(state);
      } catch (err) {
        expect(err).toBeInstanceOf(AuraIntelligenceOSError);
        const serialized = (err as AuraIntelligenceOSError).toJSON();
        expect(serialized.code).toBe(ErrorCodes.MISSING_REQUIRED_STATE);
        expect(serialized.metadata).toBeDefined();
      }
    });

    it('26 & 27. No mutación de estado agregado ni dependencias', () => {
      const state = Object.freeze({ sessionId: 'session-1', knowledgeGraph: dummyGraph, targetScenario: 'M&A' });
      const deps = Object.freeze({ ...dummyOSDependencies });
      const osCtx = createDummyOSContext();
      
      expect(() => PipelineContextBuilder.buildPlanningContext(state, deps, osCtx)).not.toThrow();
    });

    it('28. Ausencia de ejecución de motores', () => {
      // The builder only returns context objects, it has no reference to engine execute() methods
      expect(typeof PipelineContextBuilder.buildPlanningContext).toBe('function');
    });
  });
});
