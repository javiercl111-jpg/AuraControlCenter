import type { RelationshipType, RelationshipStatus } from '../domain/types';
import type { EnterpriseEvidence } from '../../domain/types';

export interface ConfidenceEvaluation {
  confidence: number;
  status: RelationshipStatus;
}

export function evaluateRelationshipConfidence(
  type: RelationshipType,
  evidences: EnterpriseEvidence[]
): ConfidenceEvaluation {
  if (evidences.length === 0) {
    return { confidence: 0, status: 'CANDIDATE' };
  }

  // Calculate base confidence based on evidence quality
  const score = evidences.reduce((acc, ev) => {
    const rel = typeof ev.reliability === 'number' ? ev.reliability : 0.5;
    if (rel >= 0.8) return acc + 0.4;
    if (rel >= 0.5) return acc + 0.2;
    return acc + 0.1;
  }, 0);

  const cappedScore = Math.min(score, 1.0);

  // Apply thresholds depending on the type
  let requiredForConfirmed = 0.8;

  // Specific policies for causal/impact relations
  if (type === 'CAUSES') {
    // CAUSES requires much higher evidence to confirm
    requiredForConfirmed = 0.9;
  } else if (type === 'AFFECTS') {
    // AFFECTS requires high, but not as high as CAUSES
    requiredForConfirmed = 0.7;
  } else if (type === 'RELATED_TO') {
    // RELATED_TO requires lower threshold
    requiredForConfirmed = 0.5;
  }

  let status: RelationshipStatus = 'CANDIDATE';
  if (cappedScore >= requiredForConfirmed) {
    status = 'CONFIRMED';
  } else if (cappedScore > 0) {
    status = 'PARTIALLY_SUPPORTED';
  }

  return {
    confidence: cappedScore,
    status
  };
}

export default { evaluateRelationshipConfidence };
