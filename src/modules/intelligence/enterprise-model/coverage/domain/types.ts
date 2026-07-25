export type CoverageDomain = 
  | 'organization'
  | 'payroll'
  | 'compensation'
  | 'benefits'
  | 'compliance'
  | 'talent_performance'
  | 'time_attendance'
  | 'workforce_analytics';

export type CoverageGapType = 
  | 'missing_node_type'
  | 'low_confidence'
  | 'unverified_relationship'
  | 'missing_evidence'
  | 'isolated_subgraph';

export type GapSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface CoverageGap {
  id: string;
  domain: CoverageDomain;
  gapType: CoverageGapType;
  severity: GapSeverity;
  description: string;
  targetEntityId?: string;
  recommendedAction: string;
}

export interface DomainCoverageMetrics {
  domain: CoverageDomain;
  nodeCount: number;
  relationshipCount: number;
  confirmedEntitiesRatio: number;
  evidenceDensity: number;
  avgConfidence: number;
  completenessScore: number;
  gaps: CoverageGap[];
}

export interface OverallCoverageReport {
  timestamp: string;
  totalNodes: number;
  totalRelationships: number;
  overallScore: number;
  confidenceLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXECUTIVE';
  domainBreakdown: Record<CoverageDomain, DomainCoverageMetrics>;
  criticalGaps: CoverageGap[];
  readinessForDecision: boolean;
}

export interface DecisionReadinessAssessment {
  isReady: boolean;
  score: number;
  targetScenario: string;
  blockingGaps: CoverageGap[];
  recommendedQuestions: string[];
}

const CoverageTypesModule = {
  version: '1.0.0',
};

export default CoverageTypesModule;
