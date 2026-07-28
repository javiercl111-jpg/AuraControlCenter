import {
  COVERAGE_DOMAINS,
  type CoverageGapType,
  type CoverageScenarioScope,
  type GapSeverity,
  type OverallCoverageReport,
} from './types';

export type CoverageScenarioScopeValidationReason =
  | 'INVALID_SCENARIO_ID'
  | 'EMPTY_INCLUDED_DOMAINS'
  | 'UNKNOWN_COVERAGE_DOMAIN'
  | 'DUPLICATE_COVERAGE_DOMAIN'
  | 'OVERLAPPING_COVERAGE_DOMAINS';

export class CoverageScenarioScopeValidationError extends Error {
  public readonly code = 'INVALID_CONTRACT';
  public readonly reason: CoverageScenarioScopeValidationReason;

  constructor(
    reason: CoverageScenarioScopeValidationReason,
    message: string
  ) {
    super(message);
    this.name = 'CoverageScenarioScopeValidationError';
    this.reason = reason;
    Object.setPrototypeOf(
      this,
      CoverageScenarioScopeValidationError.prototype
    );
  }
}

export function assertCoverageScenarioScopeValid(
  scope: CoverageScenarioScope
): void {
  if (
    !scope ||
    typeof scope.scenarioId !== 'string' ||
    scope.scenarioId.trim().length === 0
  ) {
    throw new CoverageScenarioScopeValidationError(
      'INVALID_SCENARIO_ID',
      'Coverage scenario scope requires a non-empty scenarioId'
    );
  }

  if (
    !Array.isArray(scope.includedDomains) ||
    scope.includedDomains.length === 0
  ) {
    throw new CoverageScenarioScopeValidationError(
      'EMPTY_INCLUDED_DOMAINS',
      'Coverage scenario scope requires at least one included domain'
    );
  }

  if (!Array.isArray(scope.excludedDomains)) {
    throw new CoverageScenarioScopeValidationError(
      'UNKNOWN_COVERAGE_DOMAIN',
      'Coverage scenario scope contains an invalid excluded domain collection'
    );
  }

  const knownDomains = new Set<string>(COVERAGE_DOMAINS);
  const includedDomains = scope.includedDomains as readonly unknown[];
  const excludedDomains = scope.excludedDomains as readonly unknown[];
  const allDomains = [...includedDomains, ...excludedDomains];

  if (
    allDomains.some(
      (domain) => typeof domain !== 'string' || !knownDomains.has(domain)
    )
  ) {
    throw new CoverageScenarioScopeValidationError(
      'UNKNOWN_COVERAGE_DOMAIN',
      'Coverage scenario scope contains an unknown domain'
    );
  }

  if (
    new Set(includedDomains).size !== includedDomains.length ||
    new Set(excludedDomains).size !== excludedDomains.length
  ) {
    throw new CoverageScenarioScopeValidationError(
      'DUPLICATE_COVERAGE_DOMAIN',
      'Coverage scenario scope contains duplicate domains'
    );
  }

  const excludedSet = new Set(excludedDomains);
  if (includedDomains.some((domain) => excludedSet.has(domain))) {
    throw new CoverageScenarioScopeValidationError(
      'OVERLAPPING_COVERAGE_DOMAINS',
      'Coverage scenario scope cannot include and exclude the same domain'
    );
  }
}

export function validateCoverageScore(score: number): boolean {
  return typeof score === 'number' && !isNaN(score) && score >= 0 && score <= 100;
}

export function calculateCompletenessScore(
  nodeCount: number,
  relationshipCount: number,
  avgConfidence: number,
  evidenceDensity: number
): number {
  if (nodeCount === 0) return 0;
  
  const nodeFactor = Math.min(nodeCount / 5, 1) * 25;
  const relFactor = Math.min(relationshipCount / Math.max(nodeCount, 1), 1) * 25;
  const confFactor = Math.max(0, Math.min(avgConfidence, 1)) * 25;
  const evFactor = Math.max(0, Math.min(evidenceDensity, 1)) * 25;

  const rawScore = nodeFactor + relFactor + confFactor + evFactor;
  return Math.round(Math.min(100, Math.max(0, rawScore)));
}

export function categorizeGapSeverity(
  gapType: CoverageGapType,
  avgConfidence: number
): GapSeverity {
  if (gapType === 'missing_node_type' || avgConfidence < 0.3) {
    return 'critical';
  }
  if (gapType === 'low_confidence' || gapType === 'missing_evidence') {
    return avgConfidence < 0.6 ? 'high' : 'medium';
  }
  if (gapType === 'unverified_relationship' || gapType === 'isolated_subgraph') {
    return 'medium';
  }
  return 'low';
}

export function assertCoverageReportValid(report: OverallCoverageReport): boolean {
  if (!report) return false;
  if (!validateCoverageScore(report.overallScore)) return false;
  if (report.totalNodes < 0 || report.totalRelationships < 0) return false;
  if (!report.domainBreakdown) return false;
  return true;
}

const CoverageValidationModule = {
  assertCoverageScenarioScopeValid,
  validateCoverageScore,
  calculateCompletenessScore,
  categorizeGapSeverity,
  assertCoverageReportValid,
};

export default CoverageValidationModule;
