import type { TurnExtractionResult } from '../enterprise-model/extraction/domain/types';
import type { EnterpriseMentalModel } from '../enterprise-model/domain/types';
import type { EnterpriseKnowledgeGraph } from '../enterprise-model/graph/domain/types';
import type {
  CoverageDomain,
  CoverageScenarioInput,
  DecisionReadinessAssessment,
  OverallCoverageReport
} from '../enterprise-model/coverage/domain/types';
import type { PlannerPolicy, PlannerExecutionContext, AdaptiveQuestionPlanResult } from '../enterprise-model/planning/domain/types';
import type { PlanFromGraphOptions } from '../enterprise-model/planning/services/AdaptiveQuestionPlanner';
import type { IQuestionRealizationProvider } from '../enterprise-model/planning/services/QuestionRealizationProvider';
import type { ReasoningPolicy } from '../enterprise-model/reasoning/policies/ReasoningPolicy';
import type { ExecutiveReasoningContext, ReasoningExecutionContext, ExecutiveReasoningReport } from '../enterprise-model/reasoning/domain/types';
import type { DossierPolicy, DiagnosticNarrativeProvider, ExecutiveDossier, DossierExecutionContext } from '../enterprise-model/dossier/domain/types';
import type { AssessmentPolicy, EnterpriseTransformationAssessment, TransformationConstraint, TransformationDependency } from '../enterprise-model/assessment/domain/types';
import type { 
  PipelineIdGenerator, 
  PipelineClock, 
  PipelineAuditSink, 
  PipelineTimeoutPolicy, 
  PipelineCancellationSignal 
} from './ports';

export interface AuraIntelligenceOSDependencies {
  // Required core OS dependencies
  clock: PipelineClock;
  idGenerator: PipelineIdGenerator;

  // Optional core OS dependencies
  auditSink?: PipelineAuditSink;
  timeoutPolicy?: PipelineTimeoutPolicy;
  cancellationSignal?: PipelineCancellationSignal;

  // Domain dependencies (Optional at OS level, required at stage execution)
  plannerPolicy?: PlannerPolicy;
  questionRealizationProvider?: IQuestionRealizationProvider;
  
  reasoningPolicy?: ReasoningPolicy;
  
  dossierPolicy?: DossierPolicy;
  diagnosticNarrativeProvider?: DiagnosticNarrativeProvider;
  
  assessmentPolicy?: AssessmentPolicy;

  // Engine execution ports (Structural injection)
  extractionApplier?: {
    applyExtraction(
      currentMentalModel: EnterpriseMentalModel,
      currentGraph: EnterpriseKnowledgeGraph,
      extractionResult: TurnExtractionResult
    ): { mentalModel: EnterpriseMentalModel; knowledgeGraph: EnterpriseKnowledgeGraph; extractionResult: TurnExtractionResult };
  };

  coverageDecisionEngine?: {
    evaluateDecisionReadiness(
      graphOrReport: EnterpriseKnowledgeGraph | OverallCoverageReport,
      scenario: CoverageScenarioInput
    ): DecisionReadinessAssessment;
  };

  coverageCalculator?: {
    calculateOverallReport(
      graph: EnterpriseKnowledgeGraph,
      model?: EnterpriseMentalModel,
      requiredDomains?: readonly CoverageDomain[]
    ): OverallCoverageReport;
  };

  adaptiveQuestionPlanner?: {
    planQuestionsFromGraph(
      options: PlanFromGraphOptions,
      ctx: PlannerExecutionContext
    ): Promise<AdaptiveQuestionPlanResult>;
  };

  executiveReasoningEngine?: {
    execute(
      context: ExecutiveReasoningContext,
      executionContext: ReasoningExecutionContext
    ): ExecutiveReasoningReport;
  };

  executiveDossierBuilder?: {
    build(
      executionContext: DossierExecutionContext,
      policy: DossierPolicy,
      narrativeProvider: DiagnosticNarrativeProvider,
      report: unknown
    ): ExecutiveDossier;
  };

  enterpriseTransformationAssessmentBuilder?: {
    build(
      policy: AssessmentPolicy,
      executionId: string,
      timestamp: string,
      dossier: ExecutiveDossier,
      reasoning: ExecutiveReasoningReport,
      constraints?: TransformationConstraint[],
      dependencies?: TransformationDependency[]
    ): EnterpriseTransformationAssessment;
  };
}
