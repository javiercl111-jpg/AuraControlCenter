import type { 
  MaturityLevel, 
  DiagnosticDimension, 
  StrategicPriority, 
  ExecutiveRecommendationCandidate, 
  DiagnosticAudit, 
  DiagnosticNarrative,
  ExecutiveSummary
} from '../../dossier/domain/types';

import type { 
  ExecutiveFinding, 
  EnterpriseRisk, 
  EnterpriseOpportunity, 
  RootCauseHypothesis, 
  ReasoningClaim 
} from '../../reasoning/domain/types';

export type AssessmentStatus = 
  | 'COMPLETE' 
  | 'COMPLETE_WITH_LIMITATIONS' 
  | 'INSUFFICIENT_EVIDENCE' 
  | 'CONTRADICTED' 
  | 'NOT_DEFENDABLE';

export interface AssessmentDimension {
  dimension: DiagnosticDimension;
  maturity: MaturityLevel;
  score: number;
  strengths: string[]; // IDs to EnterpriseStrength
  weaknesses: string[]; // IDs to EnterpriseWeakness
}

export interface MaturityProfile {
  overallMaturity: MaturityLevel;
  dimensions: AssessmentDimension[];
}

export type TransformationConstraintType = 
  | 'BUDGET' 
  | 'RESOURCES' 
  | 'TECHNICAL' 
  | 'CULTURAL' 
  | 'TIME' 
  | 'REGULATORY' 
  | 'GOVERNANCE' 
  | 'OTHER';

export interface TransformationConstraint {
  id: string;
  type: TransformationConstraintType;
  description: string;
  impactLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export type TransformationDependencyType = 'BLOCKS' | 'REQUIRES' | 'ENHANCES';

export interface TransformationDependency {
  id: string;
  sourcePriorityId: string;
  targetPriorityId: string;
  type: TransformationDependencyType;
}

export interface TransformationReadiness {
  status: 'READY' | 'NEEDS_PREPARATION' | 'NOT_READY';
  score: number;
  criticalGaps: string[]; // IDs of weaknesses or risks
  constraints: TransformationConstraint[];
  dependencies: TransformationDependency[];
}

export interface ConfidenceMatrix {
  overallConfidence: number; // 0 to 1
  support: number;
  directness: number;
  consistency: number;
  coverage: number;
  causalConfidence: number;
  dimensionConfidence: Record<DiagnosticDimension, number>;
}

export type EvidenceLinkType = 
  | 'CLAIM' 
  | 'FINDING' 
  | 'RISK' 
  | 'OPPORTUNITY' 
  | 'ROOT_CAUSE_HYPOTHESIS' 
  | 'EVIDENCE' 
  | 'CONTRADICTION';

export interface TypedEvidenceLink {
  sourceId: string;
  sourceType: EvidenceLinkType;
  targetId: string;
  targetType: EvidenceLinkType;
  description?: string;
}

export interface EvidenceMap {
  mapId: string;
  links: TypedEvidenceLink[];
}

export interface TraceableTakeaway {
  text: string;
  sourceRefs: string[]; // IDs to claims, findings, risks, etc.
}

export interface ExecutiveInsight {
  summary: ExecutiveSummary; // Mapped from dossier
  narrative: DiagnosticNarrative; // Mapped from dossier
  keyTakeaways: TraceableTakeaway[];
}

export interface TransformationPriority extends StrategicPriority {
  readinessDependencyIds: string[]; // IDs to TransformationDependency
}

export interface AssessmentAudit {
  rejectedClaims: ReasoningClaim[];
  diagnosticAudit: DiagnosticAudit;
  limitations: string[];
  invalidReferences: string[];
  unresolvedContradictions: string[];
  insufficientEvidenceRefs: string[];
}

export interface AssessmentMetadata {
  version: string;
  schema: string;
  generator: string; // Ej. 'EnterpriseTransformationAssessmentBuilder'
  policyVersion: string;
  timestamp: string; // Solo como metadato, no usado para IDs deterministas
}

export interface IDGenerationContext {
  executionId: string;
  policyVersion: string;
  references: string[]; // Canonical references
  content: string; // Normalized content
}

export interface AssessmentExecutionContext {
  executionId: string;
  timestamp: string; // Solo inyectado como metadato
  policyVersion: string;
  generateDeterministicId(context: IDGenerationContext): string;
}

export interface EnterpriseTransformationAssessment {
  assessmentId: string;
  dossierRef: string; 
  reasoningReportRef: string;
  executionId: string;
  status: AssessmentStatus;
  
  maturityProfile: MaturityProfile;
  
  findings: ExecutiveFinding[];
  risks: EnterpriseRisk[];
  opportunities: EnterpriseOpportunity[];
  rootCauses: RootCauseHypothesis[];
  
  transformationPriorities: TransformationPriority[];
  recommendationCandidates: ExecutiveRecommendationCandidate[];
  
  transformationReadiness: TransformationReadiness;
  confidenceMatrix: ConfidenceMatrix;
  evidenceMap: EvidenceMap;
  executiveInsight: ExecutiveInsight;
  
  audit: AssessmentAudit;
  metadata: AssessmentMetadata;
}

export interface AssessmentPolicy {
  version: string;
  
  // Weights and thresholds for ConfidenceMatrix
  confidenceWeights: {
    support: number;
    directness: number;
    consistency: number;
    coverage: number;
    causalConfidence: number;
  };
  dimensionThresholds: Record<DiagnosticDimension, number>;
  globalConfidenceThreshold: number;

  evaluateReadiness(
    profile: MaturityProfile, 
    risks: EnterpriseRisk[], 
    constraints: TransformationConstraint[],
    dependencies: TransformationDependency[]
  ): TransformationReadiness;
  
  calculateConfidence(matrix: Omit<ConfidenceMatrix, 'overallConfidence'>): ConfidenceMatrix;
  determineAssessmentStatus(readiness: TransformationReadiness, confidence: ConfidenceMatrix, audit: AssessmentAudit): AssessmentStatus;
}
