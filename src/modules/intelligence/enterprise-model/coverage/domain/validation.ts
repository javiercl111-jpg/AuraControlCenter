import type { CoverageGapType, GapSeverity, OverallCoverageReport } from './types';

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
  validateCoverageScore,
  calculateCompletenessScore,
  categorizeGapSeverity,
  assertCoverageReportValid,
};

export default CoverageValidationModule;
