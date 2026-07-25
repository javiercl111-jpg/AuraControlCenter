import * as crypto from 'crypto';

/**
 * Creates a deterministic ID for evidence based on session, turn, normalized text, and category.
 * Prevents duplicates for the same statement in the same turn.
 */
export function generateDeterministicEvidenceId(
  sessionId: string,
  turnId: string,
  normalizedStatement: string,
  category: string
): string {
  const hash = crypto.createHash('sha256');
  hash.update(sessionId);
  hash.update(turnId);
  hash.update(normalizedStatement.trim().toLowerCase());
  hash.update(category.trim().toUpperCase());
  return `ev_${hash.digest('hex').substring(0, 16)}`;
}

/**
 * Creates a deterministic ID for a graph node.
 */
export function generateDeterministicNodeId(
  type: string,
  label: string
): string {
  const hash = crypto.createHash('sha256');
  hash.update(type.trim().toUpperCase());
  hash.update(label.trim().toLowerCase());
  return `node_${hash.digest('hex').substring(0, 16)}`;
}

/**
 * Creates a deterministic ID for a relationship.
 */
export function generateDeterministicRelationshipId(
  sourceId: string,
  targetId: string,
  type: string
): string {
  const hash = crypto.createHash('sha256');
  hash.update(sourceId);
  hash.update(targetId);
  hash.update(type.trim().toUpperCase());
  return `rel_${hash.digest('hex').substring(0, 16)}`;
}

export default {
  generateDeterministicEvidenceId,
  generateDeterministicNodeId,
  generateDeterministicRelationshipId
};
