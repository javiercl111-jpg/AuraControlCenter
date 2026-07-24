import type { EnterpriseKnowledgeGraph, GraphNode, EnterpriseRelationship } from '../domain/types';

export function getNodeById(graph: EnterpriseKnowledgeGraph, id: string): GraphNode | null {
  return graph.nodes[id] || null;
}

export function getNodesByType(graph: EnterpriseKnowledgeGraph, type: string): GraphNode[] {
  return Object.values(graph.nodes).filter(node => node.type === type);
}

export function getRelationshipsForNode(
  graph: EnterpriseKnowledgeGraph,
  nodeId: string,
  direction: 'OUTGOING' | 'INCOMING' | 'BOTH' = 'BOTH'
): EnterpriseRelationship[] {
  return Object.values(graph.relationships).filter(rel => {
    if (direction === 'OUTGOING') return rel.sourceId === nodeId;
    if (direction === 'INCOMING') return rel.targetId === nodeId;
    return rel.sourceId === nodeId || rel.targetId === nodeId;
  });
}

export function getConnectedNodes(
  graph: EnterpriseKnowledgeGraph,
  nodeId: string,
  direction: 'OUTGOING' | 'INCOMING' | 'BOTH' = 'BOTH'
): GraphNode[] {
  const rels = getRelationshipsForNode(graph, nodeId, direction);
  const connectedIds = new Set<string>();

  rels.forEach(rel => {
    if (rel.sourceId === nodeId) connectedIds.add(rel.targetId);
    if (rel.targetId === nodeId) connectedIds.add(rel.sourceId);
  });

  return Array.from(connectedIds).map(id => graph.nodes[id]).filter(Boolean);
}

export default {
  getNodeById,
  getNodesByType,
  getRelationshipsForNode,
  getConnectedNodes
};
