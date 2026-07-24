import { EvidenceSourceType } from '../domain/evidence';
import type { EnterpriseEvidence, ConfidenceScore } from '../domain/evidence';
import type { ConfidenceStatus } from '../domain/types';

/**
 * SOURCE_WEIGHTS define the base weight of an evidence based on its source type.
 * Derived inferences weigh significantly less than direct user statements, 
 * satisfying the "evidence-first" principle.
 */
const SOURCE_WEIGHTS: Record<EvidenceSourceType, number> = {
  [EvidenceSourceType.USER_CORRECTION]: 1.0,
  [EvidenceSourceType.USER_CONFIRMATION]: 0.95,
  [EvidenceSourceType.USER_STATEMENT]: 0.9,
  [EvidenceSourceType.DOCUMENT]: 0.85,
  [EvidenceSourceType.INTEGRATION]: 0.85,
  [EvidenceSourceType.SYSTEM_OBSERVATION]: 0.6,
  [EvidenceSourceType.DERIVED_INFERENCE]: 0.3,
};

/**
 * Calculates the weight of a single piece of evidence.
 * Formula: weight = sourceWeight * reliability * directness
 */
export function calculateEvidenceWeight(evidence: EnterpriseEvidence): number {
  const sourceWeight = SOURCE_WEIGHTS[evidence.sourceType] || 0.1;
  return sourceWeight * evidence.reliability * evidence.directness;
}

/**
 * Calculates the confidence score based on a collection of evidences.
 * Formula:
 * - Positive confidence asymptotically approaches 1: 1 - PI(1 - weight_i)
 * - Negative confidence asymptotically approaches 1: 1 - PI(1 - weight_i)
 * - Final confidence = max(0, positive - negative)
 */
export function calculateConfidenceScore(evidences: EnterpriseEvidence[]): ConfidenceScore {
  let positiveUncertainty = 1.0;
  let negativeUncertainty = 1.0;

  for (const ev of evidences) {
    const weight = calculateEvidenceWeight(ev);
    if (ev.polarity === 'POSITIVE') {
      positiveUncertainty *= (1 - weight);
    } else if (ev.polarity === 'NEGATIVE') {
      negativeUncertainty *= (1 - weight);
    }
  }

  const positiveConfidence = 1.0 - positiveUncertainty;
  const negativeConfidence = 1.0 - negativeUncertainty;

  return Math.max(0, positiveConfidence - negativeConfidence);
}

/**
 * Determines the ConfidenceStatus based on the evidences and the current status.
 * Deterministic rules:
 * - If there's a NEGATIVE USER_CORRECTION -> REJECTED
 * - If negative confidence >= 0.6 -> CONTRADICTED
 * - If positive confidence >= 0.8 -> CONFIRMED
 * - If positive confidence > 0.0 -> PARTIALLY_SUPPORTED
 * - If no evidence but current is CANDIDATE -> CANDIDATE
 * - Else -> UNKNOWN
 */
export function determineConfidenceStatus(evidences: EnterpriseEvidence[], currentStatus: ConfidenceStatus): ConfidenceStatus {
  // Check for absolute rejection
  const hasUserCorrectionAgainst = evidences.some(
    ev => ev.sourceType === EvidenceSourceType.USER_CORRECTION && ev.polarity === 'NEGATIVE'
  );

  if (hasUserCorrectionAgainst) {
    return 'REJECTED';
  }

  let positiveUncertainty = 1.0;
  let negativeUncertainty = 1.0;

  for (const ev of evidences) {
    const weight = calculateEvidenceWeight(ev);
    if (ev.polarity === 'POSITIVE') {
      positiveUncertainty *= (1 - weight);
    } else if (ev.polarity === 'NEGATIVE') {
      negativeUncertainty *= (1 - weight);
    }
  }

  const positiveConfidence = 1.0 - positiveUncertainty;
  const negativeConfidence = 1.0 - negativeUncertainty;

  if (negativeConfidence >= 0.6) {
    return 'CONTRADICTED';
  }

  if (positiveConfidence >= 0.75) {
    return 'CONFIRMED';
  }

  if (positiveConfidence > 0) {
    return 'PARTIALLY_SUPPORTED';
  }

  // If no impactful positive/negative evidence, maintain CANDIDATE if it was one.
  if (currentStatus === 'CANDIDATE') {
    return 'CANDIDATE';
  }

  return 'UNKNOWN';
}
