import type { EnterpriseKnowledgeGraph, GraphNode, EnterpriseRelationship, RelationshipType } from '../domain/types';
import { getRelationshipsForNode } from './selectors';

export interface TraversalOptions {
  maxDepth?: number;
  relationshipTypes?: RelationshipType[];
  direction?: 'OUTGOING' | 'INCOMING' | 'BOTH';
}

export interface TraversalPath {
  nodes: GraphNode[];
  relationships: EnterpriseRelationship[];
}

export function traverseGraph(
  graph: EnterpriseKnowledgeGraph,
  startNodeId: string,
  options: TraversalOptions = {}
): TraversalPath[] {
  const { maxDepth = 5, relationshipTypes, direction = 'OUTGOING' } = options;
  const paths: TraversalPath[] = [];

  if (!graph.nodes[startNodeId]) return paths;

  function dfs(
    currentNodeId: string,
    currentDepth: number,
    currentPathNodes: GraphNode[],
    currentPathRels: EnterpriseRelationship[],
    visitedRels: Set<string>
  ) {
    if (currentDepth > maxDepth) return;

    let rels = getRelationshipsForNode(graph, currentNodeId, direction);

    if (relationshipTypes && relationshipTypes.length > 0) {
      rels = rels.filter(r => relationshipTypes.includes(r.type));
    }

    let isLeaf = true;

    for (const rel of rels) {
      if (visitedRels.has(rel.id)) continue; // Cycle detection via visited relationships

      isLeaf = false;
      const nextNodeId = rel.sourceId === currentNodeId ? rel.targetId : rel.sourceId;
      const nextNode = graph.nodes[nextNodeId];

      if (!nextNode) continue; // Should not happen due to invariants, but safe check

      const nextVisitedRels = new Set(visitedRels);
      nextVisitedRels.add(rel.id);

      dfs(
        nextNodeId,
        currentDepth + 1,
        [...currentPathNodes, nextNode],
        [...currentPathRels, rel],
        nextVisitedRels
      );
    }

    if (isLeaf && currentPathRels.length > 0) {
      paths.push({
        nodes: currentPathNodes,
        relationships: currentPathRels
      });
    }
  }

  dfs(startNodeId, 0, [graph.nodes[startNodeId]], [], new Set<string>());

  return paths;
}

export function findPath(
  graph: EnterpriseKnowledgeGraph,
  startNodeId: string,
  endNodeId: string,
  options: TraversalOptions = {}
): TraversalPath | null {
  const allPaths = traverseGraph(graph, startNodeId, options);

  // Find shortest path to endNodeId
  let shortestPath: TraversalPath | null = null;

  for (const path of allPaths) {
    const lastNode = path.nodes[path.nodes.length - 1];
    if (lastNode.id === endNodeId) {
      if (!shortestPath || path.nodes.length < shortestPath.nodes.length) {
        shortestPath = path;
      }
    }
  }

  return shortestPath;
}

export default { traverseGraph, findPath };
