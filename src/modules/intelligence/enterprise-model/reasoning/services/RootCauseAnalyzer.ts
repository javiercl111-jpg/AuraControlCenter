import type {
  ReasoningClaim,
  ExecutiveReasoningContext,
  RootCauseHypothesis,
  ReasoningExecutionContext,
} from '../domain/types';
import type { ReasoningPolicy } from '../policies/ReasoningPolicy';

export class RootCauseAnalyzer {
  /**
   * Generates RootCauseHypothesis by analyzing relationships and claims.
   * Rule: No declaring confirmed causality unless there is an explicit causal relation,
   * sufficient direct evidence, and policy compliance.
   */
  public static analyze(
    claims: ReasoningClaim[],
    context: ExecutiveReasoningContext,
    policy: ReasoningPolicy,
    executionContext: ReasoningExecutionContext
  ): { updatedClaims: ReasoningClaim[]; rootCauses: RootCauseHypothesis[] } {
    const rootCauses: RootCauseHypothesis[] = [];
    const updatedClaims = [...claims];
    let rcIndex = 0;

    // Filter claims that are based on 'CAUSES' relationships
    const causalClaims = updatedClaims.filter((c) => {
      return c.sourceRelationships.some((relId) => {
        const rel = context.knowledgeGraph.relationships[relId];
        return rel && rel.type === 'CAUSES';
      });
    });

    for (const claim of causalClaims) {
      if (claim.status === 'NOT_DEFENDABLE' || claim.status === 'CONTRADICTED') continue;

      const isCausalConfirmed =
        claim.confidence.causalConfidence >= policy.minimumCausalConfidence &&
        claim.confidence.directness === 1.0 && // Requires direct evidence
        claim.confidence.aggregate >= policy.minimumSupportThreshold;

      const rcHypothesis: RootCauseHypothesis = {
        findingId: `rc-${executionContext.executionId}-${rcIndex++}`,
        statement: `Root Cause: ${claim.statement}`,
        type: 'ROOT_CAUSE',
        chain: {
          chainId: `chain-rc-${rcIndex}`,
          claims: [claim],
          logicDescription: 'Derived from explicit CAUSES relationship with evidence.',
        },
        status: isCausalConfirmed ? 'SUPPORTED_FINDING' : 'PARTIALLY_SUPPORTED',
        confidence: { ...claim.confidence },
        relatedFindings: [], // Will be linked in synthesizer if needed
      };

      rootCauses.push(rcHypothesis);
    }

    return { updatedClaims, rootCauses };
  }
}

export default RootCauseAnalyzer;
