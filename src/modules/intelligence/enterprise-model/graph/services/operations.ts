import type {
  EnterpriseKnowledgeGraph,
  GraphNode,
  EnterpriseRelationship,
  RelationshipType,
  NodeStatus,
  RelationshipStatus
} from '../domain/types';
import { generateDeterministicNodeId, generateDeterministicRelationshipId } from '../domain/identity';
import { evaluateRelationshipConfidence } from '../policies/confidence';
import type { EnterpriseEvidence } from '../../domain/types';
import { validateGraphIntegrity } from '../domain/invariants';

export function createEmptyEnterpriseKnowledgeGraph(): EnterpriseKnowledgeGraph {
  return {
    nodes: {},
    relationships: {}
  };
}

export function upsertGraphNode(
  graph: EnterpriseKnowledgeGraph,
  type: string,
  label: string,
  properties: Record<string, string | number | boolean> = {},
  timestamp: number = Date.now()
): { graph: EnterpriseKnowledgeGraph; nodeId: string } {
  const id = generateDeterministicNodeId(type, label);
  const existing = graph.nodes[id];

  const newNode: GraphNode = existing
    ? {
        ...existing,
        properties: { ...existing.properties, ...properties },
        updatedAt: timestamp
      }
    : {
        id,
        type,
        label,
        status: 'CANDIDATE',
        mentalModelRef: null,
        properties,
        createdAt: timestamp,
        updatedAt: timestamp
      };

  const newGraph = {
    ...graph,
    nodes: {
      ...graph.nodes,
      [id]: newNode
    }
  };

  validateGraphIntegrity(newGraph);
  return { graph: newGraph, nodeId: id };
}

export function addGraphRelationship(
  graph: EnterpriseKnowledgeGraph,
  sourceId: string,
  targetId: string,
  type: RelationshipType,
  properties: Record<string, string | number | boolean> = {},
  timestamp: number = Date.now()
): { graph: EnterpriseKnowledgeGraph; relationshipId: string } {
  const id = generateDeterministicRelationshipId(sourceId, targetId, type);

  if (!graph.nodes[sourceId] || !graph.nodes[targetId]) {
    throw new Error('Source or Target node does not exist in the graph.');
  }

  const existing = graph.relationships[id];

  const newRelationship: EnterpriseRelationship = existing
    ? {
        ...existing,
        properties: { ...existing.properties, ...properties },
        updatedAt: timestamp
      }
    : {
        id,
        sourceId,
        targetId,
        type,
        status: 'CANDIDATE',
        confidence: 0,
        evidenceRefs: [],
        properties,
        createdAt: timestamp,
        updatedAt: timestamp
      };

  const newGraph = {
    ...graph,
    relationships: {
      ...graph.relationships,
      [id]: newRelationship
    }
  };

  validateGraphIntegrity(newGraph);
  return { graph: newGraph, relationshipId: id };
}

export function applyRelationshipEvidence(
  graph: EnterpriseKnowledgeGraph,
  relationshipId: string,
  evidenceId: string,
  evidencesData: EnterpriseEvidence[],
  timestamp: number = Date.now()
): EnterpriseKnowledgeGraph {
  const rel = graph.relationships[relationshipId];
  if (!rel) throw new Error(`Relationship ${relationshipId} not found`);

  const updatedRefs = Array.from(new Set([...rel.evidenceRefs, evidenceId]));
  const { confidence, status } = evaluateRelationshipConfidence(rel.type, evidencesData);

  const updatedRel: EnterpriseRelationship = {
    ...rel,
    evidenceRefs: updatedRefs,
    confidence,
    status,
    updatedAt: timestamp
  };

  const newGraph = {
    ...graph,
    relationships: {
      ...graph.relationships,
      [relationshipId]: updatedRel
    }
  };

  validateGraphIntegrity(newGraph);
  return newGraph;
}

export function applyGraphEvidenceBatch(
  graph: EnterpriseKnowledgeGraph,
  updates: Array<{ relationshipId: string; evidenceId: string; evidencesData: EnterpriseEvidence[] }>,
  timestamp: number = Date.now()
): EnterpriseKnowledgeGraph {
  return updates.reduce((accGraph, update) => {
    return applyRelationshipEvidence(
      accGraph,
      update.relationshipId,
      update.evidenceId,
      update.evidencesData,
      timestamp
    );
  }, graph);
}

export function confirmRelationship(
  graph: EnterpriseKnowledgeGraph,
  relationshipId: string,
  timestamp: number = Date.now()
): EnterpriseKnowledgeGraph {
  const rel = graph.relationships[relationshipId];
  if (!rel) throw new Error(`Relationship ${relationshipId} not found`);

  const newGraph = {
    ...graph,
    relationships: {
      ...graph.relationships,
      [relationshipId]: {
        ...rel,
        status: 'CONFIRMED' as RelationshipStatus,
        confidence: Math.max(rel.confidence, 0.9), // Force high confidence if manually confirmed
        updatedAt: timestamp
      }
    }
  };
  validateGraphIntegrity(newGraph);
  return newGraph;
}

export function contradictRelationship(
  graph: EnterpriseKnowledgeGraph,
  relationshipId: string,
  timestamp: number = Date.now()
): EnterpriseKnowledgeGraph {
  const rel = graph.relationships[relationshipId];
  if (!rel) throw new Error(`Relationship ${relationshipId} not found`);

  const newGraph = {
    ...graph,
    relationships: {
      ...graph.relationships,
      [relationshipId]: {
        ...rel,
        status: 'CONTRADICTED' as RelationshipStatus,
        confidence: 0, // Contradicted means zero confidence in the assertion
        updatedAt: timestamp
      }
    }
  };
  validateGraphIntegrity(newGraph);
  return newGraph;
}

export function rejectRelationship(
  graph: EnterpriseKnowledgeGraph,
  relationshipId: string,
  timestamp: number = Date.now()
): EnterpriseKnowledgeGraph {
  const rel = graph.relationships[relationshipId];
  if (!rel) throw new Error(`Relationship ${relationshipId} not found`);

  const newGraph = {
    ...graph,
    relationships: {
      ...graph.relationships,
      [relationshipId]: {
        ...rel,
        status: 'REJECTED' as RelationshipStatus,
        confidence: 0,
        updatedAt: timestamp
      }
    }
  };
  validateGraphIntegrity(newGraph);
  return newGraph;
}

export function removeOrArchiveCandidateRelationship(
  graph: EnterpriseKnowledgeGraph,
  relationshipId: string,
  timestamp: number = Date.now()
): EnterpriseKnowledgeGraph {
  const rel = graph.relationships[relationshipId];
  if (!rel) return graph;

  if (rel.status === 'CANDIDATE' && rel.evidenceRefs.length === 0) {
    // Complete removal if pure candidate without evidence
    const newRelationships = { ...graph.relationships };
    delete newRelationships[relationshipId];
    const newGraph = { ...graph, relationships: newRelationships };
    validateGraphIntegrity(newGraph);
    return newGraph;
  } else {
    // Archive if it has history or evidence
    const newGraph = {
      ...graph,
      relationships: {
        ...graph.relationships,
        [relationshipId]: {
          ...rel,
          status: 'ARCHIVED' as RelationshipStatus,
          updatedAt: timestamp
        }
      }
    };
    validateGraphIntegrity(newGraph);
    return newGraph;
  }
}

export function linkNodeToMentalModelEntity(
  graph: EnterpriseKnowledgeGraph,
  nodeId: string,
  mentalModelRef: string,
  timestamp: number = Date.now()
): EnterpriseKnowledgeGraph {
  const node = graph.nodes[nodeId];
  if (!node) throw new Error(`Node ${nodeId} not found`);

  const newGraph = {
    ...graph,
    nodes: {
      ...graph.nodes,
      [nodeId]: {
        ...node,
        mentalModelRef,
        status: 'CONFIRMED' as NodeStatus,
        updatedAt: timestamp
      }
    }
  };
  validateGraphIntegrity(newGraph);
  return newGraph;
}

export default {
  createEmptyEnterpriseKnowledgeGraph,
  upsertGraphNode,
  addGraphRelationship,
  applyRelationshipEvidence,
  applyGraphEvidenceBatch,
  confirmRelationship,
  contradictRelationship,
  rejectRelationship,
  removeOrArchiveCandidateRelationship,
  linkNodeToMentalModelEntity
};
