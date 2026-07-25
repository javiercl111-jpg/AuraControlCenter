import type { ReasoningClaim, ExecutiveReasoningContext } from '../domain/types';
import type { ReasoningPolicy } from '../policies/ReasoningPolicy';

export class EvidenceEvaluator {
  /**
   * Evaluates the raw claims against evidences, assigning multidimensional confidence scores.
   */
  public static evaluate(
    claims: ReasoningClaim[],
    context: ExecutiveReasoningContext,
    policy: ReasoningPolicy
  ): ReasoningClaim[] {
    return claims.map((claim) => {
      const evaluatedClaim = { ...claim, confidence: { ...claim.confidence } };

      // 1. Calculate Support (Quantity and quality of evidence)
      let supportScore = 0;
      if (evaluatedClaim.evidenceSupports.length > 0) {
        supportScore = Math.min(1.0, evaluatedClaim.evidenceSupports.length * 0.35); // Simple heuristic: 3 evidences = ~1.0
      }
      evaluatedClaim.confidence.support = supportScore;

      // 2. Calculate Directness
      let directnessScore = 0;
      const hasDirect = evaluatedClaim.evidenceSupports.some((s) => s.correlationType === 'DIRECT');
      const hasInference = evaluatedClaim.evidenceSupports.some((s) => s.correlationType === 'INFERENCE');
      if (hasDirect) {
        directnessScore = 1.0;
      } else if (hasInference) {
        directnessScore = 0.5;
      }
      evaluatedClaim.confidence.directness = directnessScore;

      // 3. Consistency (starts at 1.0, will be adjusted by ContradictionResolver)
      evaluatedClaim.confidence.consistency = 1.0;

      // 4. Coverage (based on OverallCoverageReport)
      evaluatedClaim.confidence.coverage = context.coverageReport.overallScore;

      // 5. Causal Confidence
      let causalConfidenceScore = 0;
      // If it's a relationship claim of type CAUSES, and has direct evidence
      if (claim.sourceRelationships.length > 0) {
        const isCausal = claim.sourceRelationships.some((relId) => {
          const rel = context.knowledgeGraph.relationships[relId];
          return rel && rel.type === 'CAUSES';
        });
        if (isCausal && hasDirect) {
          causalConfidenceScore = 0.9;
        } else if (isCausal) {
          causalConfidenceScore = 0.4;
        }
      }
      evaluatedClaim.confidence.causalConfidence = causalConfidenceScore;

      // Calculate Aggregate
      evaluatedClaim.confidence.aggregate = (
        evaluatedClaim.confidence.support * 0.4 +
        evaluatedClaim.confidence.directness * 0.3 +
        evaluatedClaim.confidence.consistency * 0.2 +
        evaluatedClaim.confidence.coverage * 0.1
      );

      // Status determination
      if (evaluatedClaim.evidenceSupports.length === 0) {
        evaluatedClaim.status = 'NOT_DEFENDABLE';
        evaluatedClaim.confidence.aggregate = 0; // Force to 0 for lack of evidence
      } else if (evaluatedClaim.confidence.aggregate >= policy.minimumSupportThreshold) {
        evaluatedClaim.status = 'SUPPORTED_FINDING';
      } else {
        evaluatedClaim.status = 'PARTIALLY_SUPPORTED';
      }

      return evaluatedClaim;
    });
  }
}

export default EvidenceEvaluator;
