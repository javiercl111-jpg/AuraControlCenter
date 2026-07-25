import type {
  CoverageDomain,
  DomainCoverageMetrics,
  OverallCoverageReport,
  DecisionReadinessAssessment,
} from '../../coverage/domain/types';

// AI-01D Canonical Aliases within Planning Module
export type KnowledgeCoverageReport = OverallCoverageReport;
export type DomainCoverage = DomainCoverageMetrics;
export type CoverageDecision = DecisionReadinessAssessment;
export type ReadinessReason = string;

export interface ResearchQueueItem {
  id: string;
  domain: CoverageDomain;
  sourceGapId: string;
  description: string;
  recommendedAction: string;
  priorityScore: number;
}

export interface ResearchQueue {
  items: ResearchQueueItem[];
  priorityDomains: CoverageDomain[];
  recommendedQuestions: string[];
}

export interface PlannerPolicy {
  maxQuestionsPerPlan: number;
  minConfidenceThreshold: number;
  jaccardThreshold: number;
  allowClosedQuestions: boolean;
}

export interface PlannerExecutionContext {
  executionId: string;
  timestamp: string;
  sequenceSeed?: number;
  policy?: PlannerPolicy;
}

export interface PlanningTraceability {
  domainId: CoverageDomain;
  coverageDecisionRef?: string;
  researchQueueRef?: string;
  sourceGapId?: string;
}

export type ObjectiveStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';

export interface KnowledgeObjective {
  objectiveId: string;
  domainId: CoverageDomain;
  description: string;
  priority: number;
  status: ObjectiveStatus;
  traceability: PlanningTraceability;
}

export type StrategyApproach =
  | 'TOP_DOWN'
  | 'BOTTOM_UP'
  | 'LATERAL_VERIFICATION'
  | 'DEEP_DIVE'
  | 'CROSS_DOMAIN';

export interface QuestionStrategy {
  strategyId: string;
  objectiveId: string;
  domainId: CoverageDomain;
  approach: StrategyApproach;
  rationale: string;
  traceability: PlanningTraceability;
}

export interface QuestionIntent {
  intentId: string;
  strategyId: string;
  domainId: CoverageDomain;
  promptTemplate: string;
  targetGapType: string;
  isClosed: boolean;
  traceability: PlanningTraceability;
}

export interface QuestionCandidate {
  candidateId: string;
  intentId: string;
  domainId: CoverageDomain;
  questionText: string;
  rationale: string;
  traceability: PlanningTraceability;
}

export interface QuestionPlanItem {
  itemId: string;
  candidateId: string;
  domainId: CoverageDomain;
  questionText: string;
  priority: number;
  traceability: PlanningTraceability;
}

export interface QuestionPlan {
  planId: string;
  items: QuestionPlanItem[];
  timestamp: string;
  totalQuestions: number;
  evaluatedCandidateCount: number;
  traceabilityMatrix: Array<{
    candidateId: string;
    domainId: CoverageDomain;
    coverageDecisionRef?: string;
    researchQueueRef?: string;
  }>;
}

export interface EvaluationSummary {
  totalCandidates: number;
  selectedCandidates: number;
  rejectedDuplicateCandidates: number;
  rejectedClosedCandidates: number;
  rejectedUntraceableCandidates: number;
}

export interface AdaptiveQuestionPlanResult {
  planId: string;
  objectives: KnowledgeObjective[];
  strategies: QuestionStrategy[];
  intents: QuestionIntent[];
  candidates: QuestionCandidate[];
  selectedPlan: QuestionPlan;
  evaluationSummary: EvaluationSummary;
  traceabilityMatrix: Array<{
    objectiveId: string;
    strategyId: string;
    intentId: string;
    candidateId: string;
    domainId: CoverageDomain;
    coverageRef: string;
  }>;
}

export interface QuestionHistoryItem {
  questionId: string;
  domainId: CoverageDomain;
  questionText: string;
  askedAt: string;
  answeredAt?: string;
  status: 'ASKED' | 'ANSWERED' | 'SKIPPED';
}

export interface QuestionHistory {
  historyId: string;
  items: QuestionHistoryItem[];
}

const PlanningTypesModule = {
  version: '1.0.0',
};

export default PlanningTypesModule;
