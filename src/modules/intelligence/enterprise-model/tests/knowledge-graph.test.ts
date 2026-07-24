// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { describe, test, expect } from 'vitest';
import {
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
} from '../graph/services/operations';
import { validateGraphIntegrity, GraphInvariantViolation } from '../graph/domain/invariants';
import { traverseGraph, findPath } from '../graph/selectors/traversal';
import { getNodeById, getNodesByType } from '../graph/selectors/selectors';
import type { EnterpriseEvidence } from '../domain/types';
import type { EnterpriseRelationship } from '../graph/domain/types';

describe('Enterprise Knowledge Graph Foundation (AI-01B)', () => {
  const timestamp = 1600000000000;

  // 1
  test('1. createEmptyEnterpriseKnowledgeGraph creates an empty graph', () => {
    const graph = createEmptyEnterpriseKnowledgeGraph();
    expect(graph.nodes).toEqual({});
    expect(graph.relationships).toEqual({});
  });

  // 2
  test('2. upsertGraphNode creates a new node', () => {
    let graph = createEmptyEnterpriseKnowledgeGraph();
    const result = upsertGraphNode(graph, 'PROCESS', 'Check-in', { severity: 'High' }, timestamp);
    graph = result.graph;
    const nodeId = result.nodeId;

    expect(graph.nodes[nodeId]).toBeDefined();
    expect(graph.nodes[nodeId].type).toBe('PROCESS');
    expect(graph.nodes[nodeId].label).toBe('Check-in');
    expect(graph.nodes[nodeId].status).toBe('CANDIDATE');
    expect(graph.nodes[nodeId].properties.severity).toBe('High');
  });

  // 3
  test('3. upsertGraphNode updates an existing node correctly', () => {
    const graph = createEmptyEnterpriseKnowledgeGraph();
    const r1 = upsertGraphNode(graph, 'PROCESS', 'Check-in', { severity: 'High' }, timestamp);
    const r2 = upsertGraphNode(r1.graph, 'PROCESS', 'Check-in', { digital: true }, timestamp + 1000);

    expect(r2.graph.nodes[r2.nodeId].properties.severity).toBe('High');
    expect(r2.graph.nodes[r2.nodeId].properties.digital).toBe(true);
    expect(r2.graph.nodes[r2.nodeId].updatedAt).toBe(timestamp + 1000);
  });

  // 4
  test('4. addGraphRelationship creates a new relationship', () => {
    const graph = createEmptyEnterpriseKnowledgeGraph();
    const { graph: g1, nodeId: sourceId } = upsertGraphNode(graph, 'PROCESS', 'A');
    const { graph: g2, nodeId: targetId } = upsertGraphNode(g1, 'RISK', 'B');
    const { graph: g3, relationshipId } = addGraphRelationship(g2, sourceId, targetId, 'AFFECTS');

    expect(g3.relationships[relationshipId]).toBeDefined();
    expect(g3.relationships[relationshipId].type).toBe('AFFECTS');
    expect(g3.relationships[relationshipId].sourceId).toBe(sourceId);
    expect(g3.relationships[relationshipId].targetId).toBe(targetId);
  });

  // 5
  test('5. addGraphRelationship updates an existing relationship', () => {
    const graph = createEmptyEnterpriseKnowledgeGraph();
    const { graph: g1, nodeId: sourceId } = upsertGraphNode(graph, 'PROCESS', 'A');
    const { graph: g2, nodeId: targetId } = upsertGraphNode(g1, 'RISK', 'B');
    const { graph: g3, relationshipId: rel1 } = addGraphRelationship(g2, sourceId, targetId, 'AFFECTS', { impact: 5 });
    const { graph: g4, relationshipId: rel2 } = addGraphRelationship(g3, sourceId, targetId, 'AFFECTS', { frequency: 'high' });

    expect(rel1).toBe(rel2);
    expect(g4.relationships[rel1].properties.impact).toBe(5);
    expect(g4.relationships[rel1].properties.frequency).toBe('high');
  });

  // 6
  test('6. addGraphRelationship throws if source node missing', () => {
    const graph = createEmptyEnterpriseKnowledgeGraph();
    const { graph: g1, nodeId: targetId } = upsertGraphNode(graph, 'RISK', 'B');
    expect(() => addGraphRelationship(g1, 'missing', targetId, 'AFFECTS')).toThrow();
  });

  // 7
  test('7. addGraphRelationship throws if target node missing', () => {
    const graph = createEmptyEnterpriseKnowledgeGraph();
    const { graph: g1, nodeId: sourceId } = upsertGraphNode(graph, 'PROCESS', 'A');
    expect(() => addGraphRelationship(g1, sourceId, 'missing', 'AFFECTS')).toThrow();
  });

  const highEvidence: EnterpriseEvidence = {
    evidenceId: 'e1',
    sessionId: 's1',
    turnId: 't1',
    source: 'conv',
    sourceType: 'USER_STATEMENT',
    originalText: 'Doc',
    normalizedStatement: 'Doc',
    category: 'GENERAL',
    entityRefs: [],
    capturedAt: timestamp,
    reliability: 1.0,
    directness: 1.0,
    polarity: 'POSITIVE',
    extractorVersion: '1.0',
    metadata: {}
  };
  const mediumEvidence: EnterpriseEvidence = {
    evidenceId: 'e2',
    sessionId: 's1',
    turnId: 't1',
    source: 'conv',
    sourceType: 'SYSTEM_OBSERVATION',
    originalText: 'Msg',
    normalizedStatement: 'Msg',
    category: 'GENERAL',
    entityRefs: [],
    capturedAt: timestamp,
    reliability: 0.6,
    directness: 0.6,
    polarity: 'POSITIVE',
    extractorVersion: '1.0',
    metadata: {}
  };

  // 8
  test('8. applyRelationshipEvidence updates confidence based on RELATED_TO policy', () => {
    const graph = createEmptyEnterpriseKnowledgeGraph();
    const n1 = upsertGraphNode(graph, 'NODE', 'A');
    const n2 = upsertGraphNode(n1.graph, 'NODE', 'B');
    const rel = addGraphRelationship(n2.graph, n1.nodeId, n2.nodeId, 'RELATED_TO');

    // RELATED_TO needs 0.5 for CONFIRMED. 1 HIGH (0.4) + 1 MEDIUM (0.2) = 0.6
    const gUpdated = applyRelationshipEvidence(rel.graph, rel.relationshipId, 'e3', [highEvidence, mediumEvidence]);
    expect(gUpdated.relationships[rel.relationshipId].status).toBe('CONFIRMED');
    expect(gUpdated.relationships[rel.relationshipId].confidence).toBeCloseTo(0.6);
  });

  // 9
  test('9. applyRelationshipEvidence updates confidence based on AFFECTS policy', () => {
    const graph = createEmptyEnterpriseKnowledgeGraph();
    const n1 = upsertGraphNode(graph, 'NODE', 'A');
    const n2 = upsertGraphNode(n1.graph, 'NODE', 'B');
    const rel = addGraphRelationship(n2.graph, n1.nodeId, n2.nodeId, 'AFFECTS');

    // AFFECTS needs 0.7 for CONFIRMED. 0.6 is PARTIALLY_SUPPORTED
    const gUpdated = applyRelationshipEvidence(rel.graph, rel.relationshipId, 'e3', [highEvidence, mediumEvidence]);
    expect(gUpdated.relationships[rel.relationshipId].status).toBe('PARTIALLY_SUPPORTED');
  });

  // 10
  test('10. applyRelationshipEvidence updates confidence based on CAUSES policy', () => {
    const graph = createEmptyEnterpriseKnowledgeGraph();
    const n1 = upsertGraphNode(graph, 'NODE', 'A');
    const n2 = upsertGraphNode(n1.graph, 'NODE', 'B');
    const rel = addGraphRelationship(n2.graph, n1.nodeId, n2.nodeId, 'CAUSES');

    // CAUSES needs 0.9. 1 High + 1 Med = 0.6 (PARTIALLY_SUPPORTED)
    const gUpdated = applyRelationshipEvidence(rel.graph, rel.relationshipId, 'e3', [highEvidence, mediumEvidence]);
    expect(gUpdated.relationships[rel.relationshipId].status).toBe('PARTIALLY_SUPPORTED');
  });

  // 11
  test('11. applyGraphEvidenceBatch updates multiple relationships', () => {
    const graph = createEmptyEnterpriseKnowledgeGraph();
    const n1 = upsertGraphNode(graph, 'NODE', 'A');
    const n2 = upsertGraphNode(n1.graph, 'NODE', 'B');
    const rel1 = addGraphRelationship(n2.graph, n1.nodeId, n2.nodeId, 'CAUSES');
    const rel2 = addGraphRelationship(rel1.graph, n2.nodeId, n1.nodeId, 'RELATED_TO');

    const batched = applyGraphEvidenceBatch(rel2.graph, [
      { relationshipId: rel1.relationshipId, evidenceId: 'e1', evidencesData: [highEvidence] },
      { relationshipId: rel2.relationshipId, evidenceId: 'e1', evidencesData: [highEvidence] }
    ]);

    expect(batched.relationships[rel1.relationshipId].confidence).toBe(0.4);
    expect(batched.relationships[rel2.relationshipId].confidence).toBe(0.4);
  });

  // 12
  test('12. confirmRelationship forces status to CONFIRMED', () => {
    const graph = createEmptyEnterpriseKnowledgeGraph();
    const n1 = upsertGraphNode(graph, 'NODE', 'A');
    const n2 = upsertGraphNode(n1.graph, 'NODE', 'B');
    const rel = addGraphRelationship(n2.graph, n1.nodeId, n2.nodeId, 'AFFECTS');
    const gUpdated = confirmRelationship(rel.graph, rel.relationshipId);
    expect(gUpdated.relationships[rel.relationshipId].status).toBe('CONFIRMED');
    expect(gUpdated.relationships[rel.relationshipId].confidence).toBe(0.9);
  });

  // 13
  test('13. contradictRelationship sets status to CONTRADICTED and confidence 0', () => {
    const graph = createEmptyEnterpriseKnowledgeGraph();
    const n1 = upsertGraphNode(graph, 'NODE', 'A');
    const n2 = upsertGraphNode(n1.graph, 'NODE', 'B');
    const rel = addGraphRelationship(n2.graph, n1.nodeId, n2.nodeId, 'AFFECTS');
    const gUpdated = contradictRelationship(rel.graph, rel.relationshipId);
    expect(gUpdated.relationships[rel.relationshipId].status).toBe('CONTRADICTED');
    expect(gUpdated.relationships[rel.relationshipId].confidence).toBe(0);
  });

  // 14
  test('14. rejectRelationship sets status to REJECTED and confidence 0', () => {
    const graph = createEmptyEnterpriseKnowledgeGraph();
    const n1 = upsertGraphNode(graph, 'NODE', 'A');
    const n2 = upsertGraphNode(n1.graph, 'NODE', 'B');
    const rel = addGraphRelationship(n2.graph, n1.nodeId, n2.nodeId, 'AFFECTS');
    const gUpdated = rejectRelationship(rel.graph, rel.relationshipId);
    expect(gUpdated.relationships[rel.relationshipId].status).toBe('REJECTED');
    expect(gUpdated.relationships[rel.relationshipId].confidence).toBe(0);
  });

  // 15
  test('15. removeOrArchiveCandidateRelationship completely removes a pure candidate', () => {
    const graph = createEmptyEnterpriseKnowledgeGraph();
    const n1 = upsertGraphNode(graph, 'NODE', 'A');
    const n2 = upsertGraphNode(n1.graph, 'NODE', 'B');
    const rel = addGraphRelationship(n2.graph, n1.nodeId, n2.nodeId, 'AFFECTS');
    const gUpdated = removeOrArchiveCandidateRelationship(rel.graph, rel.relationshipId);
    expect(gUpdated.relationships[rel.relationshipId]).toBeUndefined();
  });

  // 16
  test('16. removeOrArchiveCandidateRelationship archives a relationship with evidence', () => {
    const graph = createEmptyEnterpriseKnowledgeGraph();
    const n1 = upsertGraphNode(graph, 'NODE', 'A');
    const n2 = upsertGraphNode(n1.graph, 'NODE', 'B');
    const rel = addGraphRelationship(n2.graph, n1.nodeId, n2.nodeId, 'AFFECTS');
    const gWithEv = applyRelationshipEvidence(rel.graph, rel.relationshipId, 'e1', [highEvidence]);
    const gUpdated = removeOrArchiveCandidateRelationship(gWithEv, rel.relationshipId);
    expect(gUpdated.relationships[rel.relationshipId].status).toBe('ARCHIVED');
  });

  // 17
  test('17. linkNodeToMentalModelEntity links and sets status to CONFIRMED', () => {
    const graph = createEmptyEnterpriseKnowledgeGraph();
    const n1 = upsertGraphNode(graph, 'PROCESS', 'Check-in');
    const gUpdated = linkNodeToMentalModelEntity(n1.graph, n1.nodeId, 'process-123');
    expect(gUpdated.nodes[n1.nodeId].mentalModelRef).toBe('process-123');
    expect(gUpdated.nodes[n1.nodeId].status).toBe('CONFIRMED');
  });

  // 18
  test('18. Invariants: throw if node deterministic ID is tampered', () => {
    const graph = createEmptyEnterpriseKnowledgeGraph();
    const n1 = upsertGraphNode(graph, 'NODE', 'A');

    // Tamper ID
    const tamperedGraph = { ...n1.graph, nodes: { ...n1.graph.nodes, fake: { ...n1.graph.nodes[n1.nodeId], id: 'fake' } } };
    delete (tamperedGraph.nodes as Record<string, unknown>)[n1.nodeId];

    expect(() => validateGraphIntegrity(tamperedGraph)).toThrow(GraphInvariantViolation);
  });

  // 19
  test('19. Invariants: throw if relationship is a self-loop', () => {
    const graph = createEmptyEnterpriseKnowledgeGraph();
    const n1 = upsertGraphNode(graph, 'NODE', 'A');
    // We cannot use addGraphRelationship easily for self-loop because of invariants in operations,
    // but let me test if we bypass operations
    const fakeRel: EnterpriseRelationship = {
      id: 'x',
      sourceId: n1.nodeId,
      targetId: n1.nodeId,
      type: 'AFFECTS',
      confidence: 0,
      evidenceRefs: [],
      status: 'CANDIDATE',
      properties: {},
      createdAt: 0,
      updatedAt: 0
    };
    const tamperedGraph = { ...n1.graph, relationships: { x: fakeRel } };
    expect(() => validateGraphIntegrity(tamperedGraph)).toThrow(GraphInvariantViolation);
  });

  // 20
  test('20. Traversal: Hospitality Example (cycle detection & depth)', () => {
    let graph = createEmptyEnterpriseKnowledgeGraph();

    // Nodes
    const pp = upsertGraphNode(graph, 'PAIN_POINT', 'Long wait times');
    const proc = upsertGraphNode(pp.graph, 'PROCESS', 'Guest Check-in');
    const risk = upsertGraphNode(proc.graph, 'RISK', 'Guest dissatisfaction');
    const cap = upsertGraphNode(risk.graph, 'CAPABILITY', 'Mobile Check-in Kiosk');
    graph = cap.graph;

    const ppId = pp.nodeId;
    const procId = proc.nodeId;
    const riskId = risk.nodeId;
    const capId = cap.nodeId;

    // Relationships
    // "Long wait times" AFFECTS "Guest Check-in"
    const r1 = addGraphRelationship(graph, ppId, procId, 'AFFECTS');
    // "Guest Check-in" CAUSES "Guest dissatisfaction"
    const r2 = addGraphRelationship(r1.graph, procId, riskId, 'CAUSES');
    // "Mobile Check-in Kiosk" MITIGATES "Long wait times"
    const r3 = addGraphRelationship(r2.graph, capId, ppId, 'MITIGATES');
    // Add a cycle for test: "Guest dissatisfaction" CAUSES "Long wait times" (guests arguing)
    const r4 = addGraphRelationship(r3.graph, riskId, ppId, 'CAUSES');
    graph = r4.graph;

    // Test selectors
    expect(getNodesByType(graph, 'PROCESS').length).toBe(1);
    expect(getNodeById(graph, procId)?.label).toBe('Guest Check-in');

    // Test cycle detection and paths (from Kiosk to Risk)
    const paths = traverseGraph(graph, capId, { maxDepth: 10, direction: 'OUTGOING' });

    // It should traverse cap -> pp -> proc -> risk. And then risk -> pp (but stop due to visited rel)
    expect(paths.length).toBeGreaterThan(0);

    // Shortest path from Cap to Risk
    const shortestPath = findPath(graph, capId, riskId, { maxDepth: 5 });
    expect(shortestPath).toBeDefined();
    if (shortestPath) {
      expect(shortestPath.nodes.length).toBe(4); // Cap, PP, Proc, Risk
      expect(shortestPath.nodes[0].id).toBe(capId);
      expect(shortestPath.nodes[3].id).toBe(riskId);
    }
  });
});
