import type { 
  ReasoningClaim
} from '../../reasoning/domain/types';

export type MaturityLevel = 'INITIAL' | 'EMERGING' | 'MANAGED' | 'INTEGRATED' | 'OPTIMIZING';

export type DiagnosticDimension = string;

export interface MaturityAssessment {
  dimension: DiagnosticDimension;
  level: MaturityLevel;
  score: number;
  evidenceRefs: string[]; // findingIds
  justification: string;
}

export interface EnterpriseStrength {
  id: string;
  dimension: DiagnosticDimension;
  description: string;
  impact: 'MODERATE' | 'HIGH' | 'CRITICAL';
  supportingFindings: string[]; // findingIds
}

export interface EnterpriseWeakness {
  id: string;
  dimension: DiagnosticDimension;
  description: string;
  severity: 'MODERATE' | 'HIGH' | 'CRITICAL';
  relatedRisks: string[]; // findingIds from EnterpriseRisk
  rootCauses: string[]; // findingIds from RootCauseHypothesis
}

export interface StrategicPriority {
  id: string;
  rank: number;
  title: string;
  description: string;
  dimension: DiagnosticDimension;
  addressedWeaknesses: string[]; // Weakness IDs
  leveragedStrengths: string[]; // Strength IDs
  urgency: 'IMMEDIATE' | 'SHORT_TERM' | 'MEDIUM_TERM';
}

export interface ExecutiveRecommendationCandidate {
  id: string;
  priorityId: string;
  proposedAction: string;
  expectedOutcome: string;
  effortEstimate: 'LOW' | 'MEDIUM' | 'HIGH';
  evidenceRefs: string[]; // findingIds / opportunityIds
}

export interface DiagnosticNarrative {
  executiveSummary: string;
  currentState: string;
  burningIssues: string;
  opportunitiesForGrowth: string;
}

export interface DiagnosticAudit {
  rejectedClaims: Array<{
    claim: ReasoningClaim;
    reason: string;
  }>;
}

export interface BusinessDiagnosis {
  overallMaturity: MaturityLevel;
  dimensionAssessments: MaturityAssessment[];
  strengths: EnterpriseStrength[];
  weaknesses: EnterpriseWeakness[];
}

export interface ExecutiveSummary {
  headline: string;
  keyInsights: string[];
  criticalRisksSummary: string;
}

export type DossierStatus = 'VALID' | 'INSUFFICIENT_EVIDENCE';

export interface ExecutiveDossier {
  dossierId: string;
  reportRef: string;
  timestamp: string;
  diagnosticStatus: DossierStatus;
  blocks: string[];
  executiveSummary: ExecutiveSummary;
  businessDiagnosis: BusinessDiagnosis;
  priorities: StrategicPriority[];
  recommendationCandidates: ExecutiveRecommendationCandidate[];
  narrative: DiagnosticNarrative;
  diagnosticAudit: DiagnosticAudit;
}

export interface DiagnosticNarrativeProvider {
  generateNarrative(context: {
    diagnosis: BusinessDiagnosis;
    priorities: StrategicPriority[];
    status: DossierStatus;
  }): DiagnosticNarrative;
  
  generateExecutiveSummary(context: {
    diagnosis: BusinessDiagnosis;
    priorities: StrategicPriority[];
    status: DossierStatus;
  }): ExecutiveSummary;
}

export interface DossierPolicy {
  getLevels(): MaturityLevel[];
  evaluateScore(score: number): MaturityLevel;
}

export interface DossierExecutionContext {
  executionId: string;
  timestamp: string;
  generateId(namespace: string, data: string): string;
}

const DossierDomainTypes = {
  version: '1.0.0'
};

export default DossierDomainTypes;
