import type { ReasoningClaim, ExecutiveReasoningContext } from '../domain/types';
import type { ReasoningPolicy } from '../policies/ReasoningPolicy';

export class ContradictionResolver {
  /**
   * Identifies contradictory claims and adjusts their confidence or marks them as CONTRADICTED.
   */
  public static resolve(
    claims: ReasoningClaim[],
    context: ExecutiveReasoningContext,
    policy: ReasoningPolicy
  ): ReasoningClaim[] {
    const resolvedClaims = [...claims];
    
    // In a real implementation, we would use NLP or the existing graph properties
    // For this deterministic implementation, we check if any source nodes have a CONTRADICTED status
    // or if the hypothesis itself is in the contradictions array.

    for (let i = 0; i < resolvedClaims.length; i++) {
      const claim = resolvedClaims[i];
      let isContradicted = false;

      // 1. Check if source nodes are contradicted in the graph
      for (const nodeId of claim.sourceNodes) {
        const node = context.knowledgeGraph.nodes[nodeId];
        if (node && node.status === 'CONTRADICTED') {
          isContradicted = true;
          break;
        }
      }

      // 2. Check source relationships
      for (const relId of claim.sourceRelationships) {
        const rel = context.knowledgeGraph.relationships[relId];
        if (rel && rel.status === 'CONTRADICTED') {
          isContradicted = true;
          break;
        }
      }

      if (isContradicted) {
        claim.status = 'CONTRADICTED';
        claim.confidence.consistency = 0.0;
        claim.confidence.aggregate = claim.confidence.aggregate * policy.contradictionDemotionWeight;
      }
    }

    // Secondary pass: Find claims that might contradict each other based on mutual exclusion (placeholder logic)
    // Since we don't invent causality, we rely strictly on the enterprise model's explicit contradiction mappings.
    // If we had a Contradiction type, we would iterate it here and find matching claims.
    
    return resolvedClaims;
  }
}

export default ContradictionResolver;
