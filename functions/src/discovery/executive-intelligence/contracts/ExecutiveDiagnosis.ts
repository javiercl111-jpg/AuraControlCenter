import type {
  DiscoveryEvidenceClassification,
  DiscoveryJsonValue,
} from "./ExecutiveDiscoveryApiRequest";

export const ExecutivePriority = {
  CRITICAL: "CRITICAL",
  HIGH: "HIGH",
  MEDIUM: "MEDIUM",
  LOW: "LOW",
} as const;

export type ExecutivePriority =
  (typeof ExecutivePriority)[keyof typeof ExecutivePriority];

export const ExecutiveActionStatus = {
  PROPOSED: "PROPOSED",
  PLANNED: "PLANNED",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
  DISMISSED: "DISMISSED",
} as const;

export type ExecutiveActionStatus =
  (typeof ExecutiveActionStatus)[keyof typeof ExecutiveActionStatus];

export const ExecutiveConfidenceLevel = {
  VERY_HIGH: "VERY_HIGH",
  HIGH: "HIGH",
  MEDIUM: "MEDIUM",
  LOW: "LOW",
} as const;

export type ExecutiveConfidenceLevel =
  (typeof ExecutiveConfidenceLevel)[keyof typeof ExecutiveConfidenceLevel];

export const ExecutiveDiagnosisStatus = {
  COMPLETE: "COMPLETE",
  PARTIAL: "PARTIAL",
  INSUFFICIENT_EVIDENCE: "INSUFFICIENT_EVIDENCE",
} as const;

export type ExecutiveDiagnosisStatus =
  (typeof ExecutiveDiagnosisStatus)[keyof typeof ExecutiveDiagnosisStatus];

export const ExecutiveMaturityLevel = {
  INITIAL: "INITIAL",
  DEVELOPING: "DEVELOPING",
  STRUCTURED: "STRUCTURED",
  ADVANCED: "ADVANCED",
  LEADING: "LEADING",
} as const;

export type ExecutiveMaturityLevel =
  (typeof ExecutiveMaturityLevel)[keyof typeof ExecutiveMaturityLevel];

export const ExecutiveOpportunityHorizon = {
  NEAR_TERM: "NEAR_TERM",
  MEDIUM_TERM: "MEDIUM_TERM",
  LONG_TERM: "LONG_TERM",
} as const;

export type ExecutiveOpportunityHorizon =
  (typeof ExecutiveOpportunityHorizon)[keyof typeof ExecutiveOpportunityHorizon];

export const ExecutiveRiskLikelihood = {
  HIGH: "HIGH",
  MEDIUM: "MEDIUM",
  LOW: "LOW",
  UNKNOWN: "UNKNOWN",
} as const;

export type ExecutiveRiskLikelihood =
  (typeof ExecutiveRiskLikelihood)[keyof typeof ExecutiveRiskLikelihood];

export const ExecutiveRiskSeverity = {
  CRITICAL: "CRITICAL",
  HIGH: "HIGH",
  MEDIUM: "MEDIUM",
  LOW: "LOW",
} as const;

export type ExecutiveRiskSeverity =
  (typeof ExecutiveRiskSeverity)[keyof typeof ExecutiveRiskSeverity];

export interface ExecutiveConfidence {
  readonly level: ExecutiveConfidenceLevel;
  readonly score: number;
  readonly basis: readonly string[];
  readonly evidenceCount: number;
  readonly missingEvidenceCount: number;
  readonly calibrationVersion?: string;
}

export interface ExecutiveBusinessFact {
  readonly label: string;
  readonly value: DiscoveryJsonValue;
  readonly classification: DiscoveryEvidenceClassification;
  readonly evidenceIds: readonly string[];
}

export interface ExecutiveMissingInformation {
  readonly label: string;
  readonly evidenceIds: readonly string[];
}

export interface ExecutiveBusinessSnapshot {
  readonly confirmedFacts: readonly Readonly<ExecutiveBusinessFact>[];
  readonly inferredFacts: readonly Readonly<ExecutiveBusinessFact>[];
  readonly systemObservations: readonly Readonly<ExecutiveBusinessFact>[];
  readonly missingInformation: readonly Readonly<ExecutiveMissingInformation>[];
}

export interface ExecutiveMaturityDimension {
  readonly dimensionId: string;
  readonly name: string;
  readonly score: number;
  readonly rationale: string;
  readonly evidenceIds: readonly string[];
  readonly confidence: Readonly<ExecutiveConfidence>;
}

export interface ExecutiveMaturity {
  readonly overallScore: number;
  readonly level: ExecutiveMaturityLevel;
  readonly dimensions: readonly Readonly<ExecutiveMaturityDimension>[];
  readonly rationale: string;
  readonly evidenceIds: readonly string[];
  readonly confidence: Readonly<ExecutiveConfidence>;
}

export interface ExecutiveRisk {
  readonly riskId: string;
  readonly category: string;
  readonly title: string;
  readonly description: string;
  readonly severity: ExecutiveRiskSeverity;
  readonly likelihood: ExecutiveRiskLikelihood;
  readonly impact: string;
  readonly mitigation?: string;
  readonly confidence: Readonly<ExecutiveConfidence>;
  readonly evidenceIds: readonly string[];
}

export interface ExecutiveOpportunity {
  readonly opportunityId: string;
  readonly category: string;
  readonly title: string;
  readonly description: string;
  readonly expectedValue: string;
  readonly feasibility: number;
  readonly horizon: ExecutiveOpportunityHorizon;
  readonly confidence: Readonly<ExecutiveConfidence>;
  readonly evidenceIds: readonly string[];
}

export interface ExecutiveRecommendation {
  readonly recommendationId: string;
  readonly title: string;
  readonly description: string;
  readonly rationale: string;
  readonly priority: ExecutivePriority;
  readonly confidence: Readonly<ExecutiveConfidence>;
  readonly evidenceIds: readonly string[];
  readonly expectedImpact: string;
  readonly timeframe: string;
  readonly linkedActionIds: readonly string[];
}

export interface ExecutiveAction {
  readonly actionId: string;
  readonly title: string;
  readonly description: string;
  readonly priority: ExecutivePriority;
  readonly ownerRole?: string;
  readonly timeframe: string;
  readonly dependencies: readonly string[];
  readonly successCriteria: readonly string[];
  readonly evidenceIds: readonly string[];
  readonly status: ExecutiveActionStatus;
}

export interface ExecutiveDiagnosisGenerationMetadata {
  readonly requestId: string;
  readonly correlationId: string;
  readonly providerId: string;
  readonly providerVersion: string;
  readonly deterministic: boolean;
}

export interface ExecutiveDiagnosis {
  readonly diagnosisId: string;
  readonly schemaVersion: "1.0";
  readonly capabilityVersion: string;
  readonly organizationId: string;
  readonly tenantId: string;
  readonly companyId: string;
  readonly sessionId: string;
  readonly status: ExecutiveDiagnosisStatus;
  readonly executiveSummary: string;
  readonly businessSnapshot: Readonly<ExecutiveBusinessSnapshot>;
  readonly maturity: Readonly<ExecutiveMaturity>;
  readonly risks: readonly Readonly<ExecutiveRisk>[];
  readonly opportunities: readonly Readonly<ExecutiveOpportunity>[];
  readonly recommendations: readonly Readonly<ExecutiveRecommendation>[];
  readonly actions: readonly Readonly<ExecutiveAction>[];
  readonly confidence: Readonly<ExecutiveConfidence>;
  readonly evidenceIds: readonly string[];
  readonly warnings: readonly string[];
  readonly generatedAt: string;
  readonly generationMetadata: Readonly<ExecutiveDiagnosisGenerationMetadata>;
}

