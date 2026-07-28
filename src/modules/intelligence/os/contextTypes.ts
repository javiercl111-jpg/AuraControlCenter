import type { 
  EnterpriseMentalModel, 
  EnterpriseEvidence, 
  EnterpriseHypothesis, 
  Constraint, 
  EnterpriseObjective 
} from '../enterprise-model/domain/types';
import type { EnterpriseKnowledgeGraph } from '../enterprise-model/graph/domain/types';
import type { TurnExtractionResult } from '../enterprise-model/extraction/domain/types';
import type { DecisionReadinessAssessment, OverallCoverageReport } from '../enterprise-model/coverage/domain/types';
import type { AdaptiveQuestionPlanResult, QuestionHistory } from '../enterprise-model/planning/domain/types';
import type { ExecutiveReasoningReport } from '../enterprise-model/reasoning/domain/types';
import type { ExecutiveDossier } from '../enterprise-model/dossier/domain/types';
import type { 
  EnterpriseTransformationAssessment, 
  TransformationConstraint, 
  TransformationDependency 
} from '../enterprise-model/assessment/domain/types';
import type {
  PipelineSessionId,
  PipelineExecutionKey,
  PipelineExecutionMetadata,
  PipelineExecutionScenario
} from './types';

/**
 * Agregado completo del estado del Aura OS durante la ejecución de un pipeline.
 * Se encarga de portar referencias inmutables a los resultados de cada etapa,
 * permitiendo construir los contextos especializados sin duplicar contratos de dominio.
 */
export interface PipelineAggregatedState {
  // Metadatos de ejecución de nivel superior
  sessionId: PipelineSessionId;
  executionKey?: PipelineExecutionKey;
  executionScenario?: PipelineExecutionScenario;
  targetScenario?: string;
  objectiveIds?: readonly string[];
  metadata?: PipelineExecutionMetadata;

  // Estados opcionales (se van rellenando conforme avanza el pipeline)
  extractionResult?: TurnExtractionResult;
  mentalModel?: EnterpriseMentalModel;
  knowledgeGraph?: EnterpriseKnowledgeGraph;
  evidence?: EnterpriseEvidence[];
  hypotheses?: EnterpriseHypothesis[];
  
  coverageReport?: OverallCoverageReport;
  readinessAssessment?: DecisionReadinessAssessment;
  
  planningResult?: AdaptiveQuestionPlanResult;
  questionHistory?: QuestionHistory;
  
  reasoningReport?: ExecutiveReasoningReport;
  
  dossier?: ExecutiveDossier;
  
  assessment?: EnterpriseTransformationAssessment;
  
  constraints?: Constraint[]; 
  transformationConstraints?: TransformationConstraint[];
  transformationDependencies?: TransformationDependency[];
  executiveObjectives?: EnterpriseObjective[];
}
