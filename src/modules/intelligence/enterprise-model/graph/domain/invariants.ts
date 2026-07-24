import type { EnterpriseKnowledgeGraph } from './types';
import { generateDeterministicNodeId, generateDeterministicRelationshipId } from './identity';

export class GraphInvariantViolation extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GraphInvariantViolation';
  }
}

export function validateGraphIntegrity(graph: EnterpriseKnowledgeGraph): void {
  const nodeKeys = Object.keys(graph.nodes);
  const relKeys = Object.keys(graph.relationships);

  // Invariant 1: Node deterministic ID correctness
  for (const nodeId of nodeKeys) {
    const node = graph.nodes[nodeId];
    if (nodeId !== node.id) {
      throw new GraphInvariantViolation(`Node key ${nodeId} does not match node id ${node.id}`);
    }
    const expectedId = generateDeterministicNodeId(node.type, node.label);
    if (node.id !== expectedId) {
      throw new GraphInvariantViolation(`Node ${node.id} has incorrect deterministic ID. Expected ${expectedId}`);
    }
  }

  // Invariant 2, 3, 4, 5, 7, 9, 10, 11, 12 checks inside relationships
  for (const relId of relKeys) {
    const rel = graph.relationships[relId];

    // Invariant 2: Relationship deterministic ID correctness
    if (relId !== rel.id) {
      throw new GraphInvariantViolation(`Relationship key ${relId} does not match relationship id ${rel.id}`);
    }
    const expectedRelId = generateDeterministicRelationshipId(rel.sourceId, rel.targetId, rel.type);
    if (rel.id !== expectedRelId) {
      throw new GraphInvariantViolation(`Relationship ${rel.id} has incorrect deterministic ID. Expected ${expectedRelId}`);
    }

    // Invariant 3: Source node must exist
    if (!graph.nodes[rel.sourceId]) {
      throw new GraphInvariantViolation(`Relationship ${rel.id} references missing source node ${rel.sourceId}`);
    }

    // Invariant 4: Target node must exist
    if (!graph.nodes[rel.targetId]) {
      throw new GraphInvariantViolation(`Relationship ${rel.id} references missing target node ${rel.targetId}`);
    }

    // Invariant 5: No self-loops allowed
    if (rel.sourceId === rel.targetId) {
      throw new GraphInvariantViolation(`Relationship ${rel.id} is a self-loop, which is not permitted`);
    }

    // Invariant 6: Confidence bounds
    if (rel.confidence < 0 || rel.confidence > 1) {
      throw new GraphInvariantViolation(`Relationship ${rel.id} has out-of-bounds confidence ${rel.confidence}`);
    }

    // Invariant 7: Contradicted / Rejected cannot have high confidence
    if ((rel.status === 'CONTRADICTED' || rel.status === 'REJECTED') && rel.confidence > 0.5) {
      throw new GraphInvariantViolation(`Relationship ${rel.id} has status ${rel.status} but high confidence ${rel.confidence}`);
    }

    // Invariant 8: Confirmed relationships must have high confidence
    if (rel.status === 'CONFIRMED' && rel.confidence < 0.5) {
      throw new GraphInvariantViolation(`Relationship ${rel.id} is CONFIRMED but has low confidence ${rel.confidence}`);
    }
  }

  // Invariant 9: No duplicate semantic nodes
  const semanticSet = new Set<string>();
  for (const node of Object.values(graph.nodes)) {
    const semanticKey = `${node.type}:${node.label.toLowerCase()}`;
    if (semanticSet.has(semanticKey)) {
      throw new GraphInvariantViolation(`Duplicate semantic node found for ${semanticKey}`);
    }
    semanticSet.add(semanticKey);
  }

  // Invariant 10: Node properties cannot contain objects or arrays
  for (const node of Object.values(graph.nodes)) {
    for (const [key, value] of Object.entries(node.properties)) {
      if (typeof value === 'object' && value !== null) {
        throw new GraphInvariantViolation(`Node ${node.id} property ${key} is an object, which is not allowed`);
      }
    }
  }

  // Invariant 11: Relationship properties cannot contain objects or arrays
  for (const rel of Object.values(graph.relationships)) {
    for (const [key, value] of Object.entries(rel.properties)) {
      if (typeof value === 'object' && value !== null) {
        throw new GraphInvariantViolation(`Relationship ${rel.id} property ${key} is an object, which is not allowed`);
      }
    }
  }

  // Invariant 12: Ensure timestamps are valid
  for (const node of Object.values(graph.nodes)) {
    if (node.updatedAt < node.createdAt) {
      throw new GraphInvariantViolation(`Node ${node.id} has updatedAt before createdAt`);
    }
  }
}

export default { validateGraphIntegrity, GraphInvariantViolation };
