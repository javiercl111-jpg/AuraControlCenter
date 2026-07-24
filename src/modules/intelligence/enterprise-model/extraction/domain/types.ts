import type { EnterpriseEvidence } from '../../domain/evidence';
import type { KnowledgeGap } from '../../domain/types';
import type { GraphNode, EnterpriseRelationship } from '../../graph/domain/types';

export interface TurnExtractionResult {
  evidence: EnterpriseEvidence[];
  nodeProposals: GraphNode[];
  relationshipProposals: EnterpriseRelationship[];
  corrections: EnterpriseEvidence[]; // Evidences that correct prior ones
  contradictions: EnterpriseEvidence[]; // Evidences that contradict prior ones
  knowledgeGaps: KnowledgeGap[];
}

export interface ExtractionContext {
  sessionId: string;
  turnId: string;
  previousStatements: string[];
  currentEntities: string[]; // IDs of entities currently in focus
}

/**
 * Pure, deterministic provider interface that performs the NLP extraction
 * logic without side effects.
 */
export interface EvidenceExtractionProvider {
  extract(text: string, context: ExtractionContext): TurnExtractionResult;
}


