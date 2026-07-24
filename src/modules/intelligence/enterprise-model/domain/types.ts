import type { EnterpriseEvidence } from './evidence';
export type { EnterpriseEvidence };

export type ConfidenceStatus =
  | 'UNKNOWN'
  | 'CANDIDATE'
  | 'PARTIALLY_SUPPORTED'
  | 'CONFIRMED'
  | 'CONTRADICTED'
  | 'REJECTED';

export interface EnterpriseIdentity {
  organizationName: string | null;
  industry: string | null;
  subindustry: string | null;
  size: string | null;
  employeeRange: string | null;
  locations: string[] | null;
  operatingRegions: string[] | null;
  businessModel: string | null;
}

export interface StrategicContext {
  transformationObjectives: string[];
  growthObjectives: string[];
  executivePriorities: string[];
  constraints: string[];
  urgency: string | null;
  timeHorizon: string | null;
}

export interface OperationalDomain {
  domainId: string;
  name: string;
  category: string;
  status: ConfidenceStatus;
  confidence: number;
  evidenceRefs: string[];
  processes: string[]; // Process IDs
  risks: string[]; // Risk IDs
  painPoints: string[]; // PainPoint IDs
  objectives: string[]; // Objective IDs
  capabilities: string[]; // Capability IDs
}

export interface BusinessProcess {
  processId: string;
  name: string;
  domainId: string;
  currentState: string | null;
  digitalizationLevel: string | null;
  automationLevel: string | null;
  integrationLevel: string | null;
  criticality: string | null;
  status: ConfidenceStatus;
  confidence: number;
  evidenceRefs: string[];
}

export interface PainPoint {
  painPointId: string;
  statement: string;
  category: string;
  impact: string | null;
  frequency: string | null;
  urgency: string | null;
  status: ConfidenceStatus;
  confidence: number;
  evidenceRefs: string[];
}

export interface Risk {
  riskId: string;
  statement: string;
  category: string;
  probability: string | null;
  impact: string | null;
  severity: string | null;
  status: ConfidenceStatus;
  confidence: number;
  evidenceRefs: string[];
}

export interface Capability {
  capabilityId: string;
  name: string;
  currentMaturity: string | null;
  targetMaturity: string | null;
  gap: string | null;
  status: ConfidenceStatus;
  confidence: number;
  evidenceRefs: string[];
}

export interface EnterpriseObjective {
  objectiveId: string;
  statement: string;
  horizon: string | null;
  priority: string | null;
  successSignals: string[];
  status: ConfidenceStatus;
  confidence: number;
  evidenceRefs: string[];
}

export interface Constraint {
  constraintId: string;
  category: string;
  statement: string;
  severity: string | null;
  status: ConfidenceStatus;
  confidence: number;
  evidenceRefs: string[];
}

export interface EnterpriseHypothesis {
  hypothesisId: string;
  statement: string;
  category: string;
  status: ConfidenceStatus;
  confidence: number;
  supportingEvidenceRefs: string[];
  contradictingEvidenceRefs: string[];
  createdAt: number;
  updatedAt: number;
}

export interface KnowledgeGap {
  gapId: string;
  domain: string;
  question: string;
  importance: 'HIGH' | 'MEDIUM' | 'LOW';
  blocking: boolean;
  status: 'OPEN' | 'RESOLVED';
  relatedEntityRefs: string[];
}

export interface ProductApplicability {
  productId: string;
  applicability: string | null;
  rationale: string | null;
  confidence: number;
  evidenceRefs: string[];
}

export interface EnterpriseMentalModel {
  identity: EnterpriseIdentity;
  strategicContext: StrategicContext;
  evidences: Record<string, EnterpriseEvidence>;
  domains: Record<string, OperationalDomain>;
  processes: Record<string, BusinessProcess>;
  painPoints: Record<string, PainPoint>;
  risks: Record<string, Risk>;
  capabilities: Record<string, Capability>;
  objectives: Record<string, EnterpriseObjective>;
  constraints: Record<string, Constraint>;
  hypotheses: Record<string, EnterpriseHypothesis>;
  knowledgeGaps: Record<string, KnowledgeGap>;
  // Product applicability is kept separate and should not pollute the base diagnostic model
  productApplicability: Record<string, ProductApplicability>;
}
