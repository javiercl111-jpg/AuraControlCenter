import type {
  EnterpriseMentalModel,
  EnterpriseHypothesis,
  Constraint,
  EnterpriseObjective,
  EnterpriseEvidence,
} from '../../domain/types';
import type { EnterpriseKnowledgeGraph } from '../../graph/domain/types';
import type { OverallCoverageReport, DecisionReadinessAssessment } from '../../coverage/domain/types';
import type { QuestionHistory } from '../../planning/domain/types';

export type FindingStatus =
  | 'SUPPORTED_FINDING'
  | 'PARTIALLY_SUPPORTED'
  | 'REQUIRES_MORE_EVIDENCE'
  | 'CONTRADICTED'
  | 'NOT_DEFENDABLE';

export interface ReasoningConfidence {
  support: number;
  directness: number;
  consistency: number;
  coverage: number;
  causalConfidence: number;
  aggregate: number; // 0 to 1
}

export type EvidenceCorrelationType = 'DIRECT' | 'INFERENCE' | 'HYPOTHESIS' | 'CONTRADICTION';

export interface EvidenceSupport {
  supportId: string;
  evidenceRef: string;
  correlationType: EvidenceCorrelationType;
  weight: number;
  rationale: string;
}

export interface ReasoningClaim {
  claimId: string;
  statement: string;
  sourceNodes: string[];
  sourceRelationships: string[];
  evidenceSupports: EvidenceSupport[];
  confidence: ReasoningConfidence;
  status: FindingStatus;
  createdAt: string; // ISO 8601 string, deterministic (provided by context)
}

export interface ReasoningChain {
  chainId: string;
  claims: ReasoningClaim[];
  logicDescription: string;
}

export interface ExecutiveFinding {
  findingId: string;
  statement: string;
  type: 'FINDING' | 'RISK' | 'OPPORTUNITY' | 'ROOT_CAUSE';
  chain: ReasoningChain;
  status: FindingStatus;
  confidence: ReasoningConfidence;
}

export interface EnterpriseRisk extends ExecutiveFinding {
  type: 'RISK';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  impactArea: string;
}

export interface EnterpriseOpportunity extends ExecutiveFinding {
  type: 'OPPORTUNITY';
  potentialValue: string;
  effort: string;
}

export interface RootCauseHypothesis extends ExecutiveFinding {
  type: 'ROOT_CAUSE';
  relatedFindings: string[];
}

export interface ReasoningExecutionContext {
  executionId: string;
  timestamp: string; // Deterministic time injection
}

export interface ExecutiveReasoningContext {
  mentalModel: EnterpriseMentalModel;
  knowledgeGraph: EnterpriseKnowledgeGraph;
  coverageReport: OverallCoverageReport;
  decisionAssessment: DecisionReadinessAssessment;
  questionHistory: QuestionHistory;
  evidences: EnterpriseEvidence[];
  hypotheses: EnterpriseHypothesis[];
  contradictions: unknown[]; // Contradictions placeholder
  constraints: Constraint[];
  executiveObjectives: EnterpriseObjective[];
}

export interface ExecutiveReasoningReport {
  reportId: string;
  timestamp: string; // From ReasoningExecutionContext
  overallStatus: FindingStatus;
  findings: ExecutiveFinding[];
  risks: EnterpriseRisk[];
  opportunities: EnterpriseOpportunity[];
  rootCauses: RootCauseHypothesis[];
  rejectedClaims: ReasoningClaim[];
  readinessGaps: string[];
}

const ReasoningDomainTypes = {
  version: '1.0.0',
};

export default ReasoningDomainTypes;
