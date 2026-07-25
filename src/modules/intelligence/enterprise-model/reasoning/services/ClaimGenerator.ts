import type {
  ExecutiveReasoningContext,
  ReasoningClaim,
  ReasoningExecutionContext,
  EvidenceSupport,
} from '../domain/types';

export class ClaimGenerator {
  /**
   * Generates initial raw claims from the Knowledge Graph and Evidences.
   * Rule: Cannot invent new statements. Claims must be derived entirely from existing nodes, relationships, hypotheses, or evidences.
   */
  public static generateCandidates(
    context: ExecutiveReasoningContext,
    executionContext: ReasoningExecutionContext
  ): ReasoningClaim[] {
    const claims: ReasoningClaim[] = [];
    let claimIndex = 0;

    // 1. Generate claims from Confirmed/Candidate Nodes (Processes, Risks, PainPoints, Objectives)
    const nodes = Object.values(context.knowledgeGraph.nodes);
    for (const node of nodes) {
      if (node.status === 'CONFIRMED' || node.status === 'CANDIDATE') {
        const rawRefs = node.properties.evidenceRefs;
        const refArray = typeof rawRefs === 'string' ? [rawRefs] : (rawRefs as unknown as string[]) || [];
        const evidenceSupports = this.extractEvidenceSupportsFromRefs(refArray, context);
        
        claims.push({
          claimId: `claim-node-${node.id}-${claimIndex++}`,
          statement: node.label, // Purely derived from existing node label
          sourceNodes: [node.id],
          sourceRelationships: [],
          evidenceSupports,
          confidence: this.createEmptyConfidence(),
          status: 'REQUIRES_MORE_EVIDENCE', // Will be evaluated later
          createdAt: executionContext.timestamp,
        });
      }
    }

    // 2. Generate claims from Relationships (AFFECTS, CAUSES, MITIGATES)
    const relationships = Object.values(context.knowledgeGraph.relationships);
    for (const rel of relationships) {
      if (rel.status === 'CONFIRMED' || rel.status === 'CANDIDATE') {
        const sourceNode = context.knowledgeGraph.nodes[rel.sourceId];
        const targetNode = context.knowledgeGraph.nodes[rel.targetId];
        
        if (sourceNode && targetNode) {
          const evidenceSupports = this.extractEvidenceSupportsFromRefs(rel.evidenceRefs || [], context);
          const statement = `${sourceNode.label} ${rel.type} ${targetNode.label}`; // Extracted deterministically

          claims.push({
            claimId: `claim-rel-${rel.id}-${claimIndex++}`,
            statement,
            sourceNodes: [rel.sourceId, rel.targetId],
            sourceRelationships: [rel.id],
            evidenceSupports,
            confidence: this.createEmptyConfidence(),
            status: 'REQUIRES_MORE_EVIDENCE',
            createdAt: executionContext.timestamp,
          });
        }
      }
    }

    // 3. Generate claims from Hypotheses
    for (const hypothesis of context.hypotheses) {
      if (hypothesis.status === 'CANDIDATE' || hypothesis.status === 'PARTIALLY_SUPPORTED') {
        const evidenceSupports = this.extractEvidenceSupportsFromRefs(hypothesis.supportingEvidenceRefs || [], context);
        
        claims.push({
          claimId: `claim-hyp-${hypothesis.hypothesisId}-${claimIndex++}`,
          statement: hypothesis.statement,
          sourceNodes: [],
          sourceRelationships: [],
          evidenceSupports,
          confidence: this.createEmptyConfidence(),
          status: 'REQUIRES_MORE_EVIDENCE',
          createdAt: executionContext.timestamp,
        });
      }
    }

    return claims;
  }

  private static extractEvidenceSupportsFromRefs(refs: string[], context: ExecutiveReasoningContext): EvidenceSupport[] {
    const supports: EvidenceSupport[] = [];
    refs.forEach((ref, index) => {
      // Find evidence in context
      const ev = context.evidences.find((e) => e.evidenceId === ref);
      if (ev) {
        supports.push({
          supportId: `supp-${ref}-${index}`,
          evidenceRef: ref,
          correlationType: 'DIRECT', // Assume direct for now, Evaluator will refine
          weight: 0, // Evaluator will calculate
          rationale: `Derived from entity reference to ${ref}`,
        });
      }
    });
    return supports;
  }

  private static createEmptyConfidence() {
    return {
      support: 0,
      directness: 0,
      consistency: 0,
      coverage: 0,
      causalConfidence: 0,
      aggregate: 0,
    };
  }
}

export default ClaimGenerator;
