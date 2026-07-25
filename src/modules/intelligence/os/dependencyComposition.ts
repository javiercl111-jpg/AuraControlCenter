import type { PlannerPolicy } from '../enterprise-model/planning/domain/types';
import type { IQuestionRealizationProvider } from '../enterprise-model/planning/services/QuestionRealizationProvider';
import type { ReasoningPolicy } from '../enterprise-model/reasoning/policies/ReasoningPolicy';
import type { DossierPolicy, DiagnosticNarrativeProvider } from '../enterprise-model/dossier/domain/types';
import type { AssessmentPolicy } from '../enterprise-model/assessment/domain/types';
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
}
