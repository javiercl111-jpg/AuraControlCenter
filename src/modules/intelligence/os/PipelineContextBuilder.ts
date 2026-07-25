import { AuraIntelligenceOSError, ErrorCodes } from './errors';
import type { PipelineExecutionContext } from './PipelineExecutionContext';
import type { AuraIntelligenceOSDependencies } from './dependencyComposition';
import type { PipelineAggregatedState } from './contextTypes';

import type { EnterpriseKnowledgeGraph } from '../enterprise-model/graph/domain/types';
import type { PlanFromGraphOptions } from '../enterprise-model/planning/services/AdaptiveQuestionPlanner';
import type { PlannerExecutionContext } from '../enterprise-model/planning/domain/types';
import type { ExecutiveReasoningContext, ReasoningExecutionContext } from '../enterprise-model/reasoning/domain/types';
import type { DossierExecutionContext } from '../enterprise-model/dossier/domain/types';
import type { TransformationConstraint, TransformationDependency } from '../enterprise-model/assessment/domain/types';
import type { ExecutiveDossier } from '../enterprise-model/dossier/domain/types';
import type { ExecutiveReasoningReport } from '../enterprise-model/reasoning/domain/types';

export class PipelineContextBuilder {

  public static buildCoverageContext(state: PipelineAggregatedState): { graph: EnterpriseKnowledgeGraph; targetScenario: string } {
    if (!state.knowledgeGraph) {
      throw new AuraIntelligenceOSError(
        ErrorCodes.MISSING_REQUIRED_STATE,
        'knowledgeGraph is required to evaluate coverage',
        false,
        'KNOWLEDGE_COVERAGE',
        { missingField: 'knowledgeGraph' }
      );
    }
    if (!state.targetScenario) {
      throw new AuraIntelligenceOSError(
        ErrorCodes.MISSING_REQUIRED_STATE,
        'targetScenario is required to evaluate coverage readiness',
        false,
        'KNOWLEDGE_COVERAGE',
        { missingField: 'targetScenario' }
      );
    }

    return {
      graph: state.knowledgeGraph,
      targetScenario: state.targetScenario
    };
  }

  public static buildPlanningContext(
    state: PipelineAggregatedState,
    dependencies: AuraIntelligenceOSDependencies,
    osContext: PipelineExecutionContext
  ): { options: PlanFromGraphOptions; executionContext: PlannerExecutionContext } {
    
    if (!state.knowledgeGraph) {
      throw new AuraIntelligenceOSError(
        ErrorCodes.MISSING_REQUIRED_STATE,
        'knowledgeGraph is required for planning',
        false,
        'ADAPTIVE_PLANNING',
        { missingField: 'knowledgeGraph' }
      );
    }
    
    if (!dependencies.plannerPolicy) {
      throw new AuraIntelligenceOSError(
        ErrorCodes.MISSING_REQUIRED_DEPENDENCY,
        'plannerPolicy is required for planning',
        false,
        'ADAPTIVE_PLANNING',
        { missingField: 'plannerPolicy' }
      );
    }

    if (!dependencies.questionRealizationProvider) {
      throw new AuraIntelligenceOSError(
        ErrorCodes.MISSING_REQUIRED_DEPENDENCY,
        'questionRealizationProvider is required for planning',
        false,
        'ADAPTIVE_PLANNING',
        { missingField: 'questionRealizationProvider' }
      );
    }

    const options: PlanFromGraphOptions = {
      graph: state.knowledgeGraph,
      targetScenario: state.targetScenario,
      policy: dependencies.plannerPolicy,
      realizationProvider: dependencies.questionRealizationProvider,
      completedObjectiveIds: state.objectiveIds ? [...state.objectiveIds] : undefined
    };

    const executionContext: PlannerExecutionContext = {
      executionId: osContext.executionId,
      timestamp: osContext.createdAt,
      policy: dependencies.plannerPolicy
    };

    return { options, executionContext };
  }

  public static buildReasoningContext(
    state: PipelineAggregatedState,
    dependencies: AuraIntelligenceOSDependencies,
    osContext: PipelineExecutionContext
  ): { context: ExecutiveReasoningContext; executionContext: ReasoningExecutionContext } {
    
    if (!state.mentalModel) {
      throw new AuraIntelligenceOSError(
        ErrorCodes.MISSING_REQUIRED_STATE,
        'mentalModel is required for reasoning',
        false,
        'EXECUTIVE_REASONING',
        { missingField: 'mentalModel' }
      );
    }
    
    if (!state.knowledgeGraph) {
      throw new AuraIntelligenceOSError(
        ErrorCodes.MISSING_REQUIRED_STATE,
        'knowledgeGraph is required for reasoning',
        false,
        'EXECUTIVE_REASONING',
        { missingField: 'knowledgeGraph' }
      );
    }

    if (!state.coverageReport) {
      throw new AuraIntelligenceOSError(
        ErrorCodes.MISSING_REQUIRED_STATE,
        'coverageReport is required for reasoning',
        false,
        'EXECUTIVE_REASONING',
        { missingField: 'coverageReport' }
      );
    }

    if (!dependencies.reasoningPolicy) {
      throw new AuraIntelligenceOSError(
        ErrorCodes.MISSING_REQUIRED_DEPENDENCY,
        'reasoningPolicy is required for reasoning',
        false,
        'EXECUTIVE_REASONING',
        { missingField: 'reasoningPolicy' }
      );
    }

    const context: ExecutiveReasoningContext = {
      mentalModel: state.mentalModel,
      knowledgeGraph: state.knowledgeGraph,
      coverageReport: state.coverageReport,
      decisionAssessment: state.readinessAssessment || {
        isReady: false,
        score: state.coverageReport.overallScore,
        targetScenario: state.targetScenario || 'Unknown',
        blockingGaps: [],
        recommendedQuestions: []
      },
      questionHistory: state.questionHistory || { historyId: 'default', items: [] },
      evidences: state.evidence ? [...state.evidence] : [],
      hypotheses: state.hypotheses ? [...state.hypotheses] : [],
      contradictions: [],
      constraints: state.constraints ? [...state.constraints] : [],
      executiveObjectives: state.executiveObjectives ? [...state.executiveObjectives] : []
    };

    const executionContext: ReasoningExecutionContext = {
      executionId: osContext.executionId,
      timestamp: osContext.createdAt
    };

    return { context, executionContext };
  }

  public static buildDossierContext(
    state: PipelineAggregatedState,
    dependencies: AuraIntelligenceOSDependencies,
    osContext: PipelineExecutionContext
  ): { executionContext: DossierExecutionContext; report: unknown } {
    
    if (!state.reasoningReport) {
      throw new AuraIntelligenceOSError(
        ErrorCodes.MISSING_REQUIRED_STATE,
        'reasoningReport is required for dossier',
        false,
        'EXECUTIVE_DOSSIER',
        { missingField: 'reasoningReport' }
      );
    }

    if (!dependencies.dossierPolicy) {
      throw new AuraIntelligenceOSError(
        ErrorCodes.MISSING_REQUIRED_DEPENDENCY,
        'dossierPolicy is required for dossier',
        false,
        'EXECUTIVE_DOSSIER',
        { missingField: 'dossierPolicy' }
      );
    }

    if (!dependencies.diagnosticNarrativeProvider) {
      throw new AuraIntelligenceOSError(
        ErrorCodes.MISSING_REQUIRED_DEPENDENCY,
        'diagnosticNarrativeProvider is required for dossier',
        false,
        'EXECUTIVE_DOSSIER',
        { missingField: 'diagnosticNarrativeProvider' }
      );
    }

    const executionContext: DossierExecutionContext = {
      executionId: osContext.executionId,
      timestamp: osContext.createdAt,
      generateId: (namespace: string, data: string) => `${dependencies.idGenerator.generateExecutionId()}-${namespace}-${data}`
    };

    return { 
      executionContext, 
      report: state.reasoningReport 
    };
  }

  public static buildAssessmentContext(
    state: PipelineAggregatedState,
    dependencies: AuraIntelligenceOSDependencies,
    osContext: PipelineExecutionContext
  ): { 
    executionId: string; 
    timestamp: string;
    dossier: ExecutiveDossier; 
    reasoning: ExecutiveReasoningReport;
    constraints: TransformationConstraint[];
    transformationDependencies: TransformationDependency[];
  } {
    
    if (!state.dossier) {
      throw new AuraIntelligenceOSError(
        ErrorCodes.MISSING_REQUIRED_STATE,
        'dossier is required for assessment',
        false,
        'TRANSFORMATION_ASSESSMENT',
        { missingField: 'dossier' }
      );
    }

    if (!state.reasoningReport) {
      throw new AuraIntelligenceOSError(
        ErrorCodes.MISSING_REQUIRED_STATE,
        'reasoningReport is required for assessment',
        false,
        'TRANSFORMATION_ASSESSMENT',
        { missingField: 'reasoningReport' }
      );
    }

    if (!dependencies.assessmentPolicy) {
      throw new AuraIntelligenceOSError(
        ErrorCodes.MISSING_REQUIRED_DEPENDENCY,
        'assessmentPolicy is required for assessment',
        false,
        'TRANSFORMATION_ASSESSMENT',
        { missingField: 'assessmentPolicy' }
      );
    }

    return {
      executionId: osContext.executionId,
      timestamp: osContext.createdAt,
      dossier: state.dossier,
      reasoning: state.reasoningReport,
      constraints: state.transformationConstraints ? [...state.transformationConstraints] : [],
      transformationDependencies: state.transformationDependencies ? [...state.transformationDependencies] : []
    };
  }
}
