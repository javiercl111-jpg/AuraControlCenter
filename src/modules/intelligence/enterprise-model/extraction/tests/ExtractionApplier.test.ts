// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { describe, it, expect, beforeEach } from 'vitest';
import { ExtractionApplier } from '../services/ExtractionApplier';
import type { TurnExtractionResult } from '../domain/types';
import { createEmptyEnterpriseMentalModel } from '../../services/modelUpdater';
import { createEmptyEnterpriseKnowledgeGraph } from '../../graph/services/operations';
import { generateDeterministicEvidenceId } from '../domain/utils';

describe('ExtractionApplier (AI-01C)', () => {
  let applier: ExtractionApplier;
  let emptyEMM: ReturnType<typeof createEmptyEnterpriseMentalModel>;
  let emptyEKG: ReturnType<typeof createEmptyEnterpriseKnowledgeGraph>;

  beforeEach(() => {
    applier = new ExtractionApplier();
    emptyEMM = createEmptyEnterpriseMentalModel();
    emptyEKG = createEmptyEnterpriseKnowledgeGraph();
  });

  const sampleEvidence = {
    evidenceId: generateDeterministicEvidenceId('s', 't', 'ev', 'cat'),
    sessionId: 's', turnId: 't', source: 'chat', sourceType: 'USER_STATEMENT' as const,
    originalText: 'ev', normalizedStatement: 'ev', category: 'cat', entityRefs: ['node-1'],
    capturedAt: 1, reliability: 1, directness: 1, polarity: 'POSITIVE' as const,
    extractorVersion: '1', metadata: {}
  };

  it('T14: Idempotent application of the same extraction result', () => {
    const extraction: TurnExtractionResult = {
      evidence: [sampleEvidence],
      nodeProposals: [], relationshipProposals: [], corrections: [], contradictions: [], knowledgeGaps: []
    };
    
    const result1 = applier.applyExtraction(emptyEMM, emptyEKG, extraction);
    const result2 = applier.applyExtraction(result1.mentalModel, result1.knowledgeGraph, extraction);
    
    // EMM shouldn't duplicate evidence
    expect(Object.keys(result2.mentalModel.evidences)).toHaveLength(1);
    expect(result2.mentalModel).toEqual(result1.mentalModel);
  });

  it('T15: New node proposals correctly inserted into EKG', () => {
    const extraction: TurnExtractionResult = {
      evidence: [],
      nodeProposals: [{
        id: 'node-1', type: 'PROCESS', label: 'P', status: 'CANDIDATE', mentalModelRef: null, properties: {}, createdAt: 1, updatedAt: 1
      }],
      relationshipProposals: [], corrections: [], contradictions: [], knowledgeGaps: []
    };
    const result = applier.applyExtraction(emptyEMM, emptyEKG, extraction);
    const nodeIds = Object.keys(result.knowledgeGraph.nodes);
    expect(nodeIds).toHaveLength(1);
    expect(result.knowledgeGraph.nodes[nodeIds[0]].type).toBe('PROCESS');
  });

  it('T16: Relationship proposals inserted into EKG and link evidence', () => {
    const extraction: TurnExtractionResult = {
      evidence: [sampleEvidence],
      nodeProposals: [{
        id: 'node-1', type: 'PROCESS', label: 'P1', status: 'CANDIDATE', mentalModelRef: null, properties: {}, createdAt: 1, updatedAt: 1
      }, {
        id: 'node-2', type: 'PROCESS', label: 'P2', status: 'CANDIDATE', mentalModelRef: null, properties: {}, createdAt: 1, updatedAt: 1
      }],
      relationshipProposals: [{
        id: 'rel-1', sourceId: 'node-1', targetId: 'node-2', type: 'DEPENDS_ON',
        status: 'CANDIDATE', confidence: 0.9, evidenceRefs: [sampleEvidence.evidenceId],
        properties: {}, createdAt: 1, updatedAt: 1
      }], corrections: [], contradictions: [], knowledgeGaps: []
    };
    const result = applier.applyExtraction(emptyEMM, emptyEKG, extraction);
    const relIds = Object.keys(result.knowledgeGraph.relationships);
    expect(relIds).toHaveLength(1);
    expect(result.knowledgeGraph.relationships[relIds[0]].evidenceRefs).toContain(sampleEvidence.evidenceId);
  });

  it('T17: Evidence injected into EMM', () => {
    const extraction: TurnExtractionResult = {
      evidence: [sampleEvidence], nodeProposals: [], relationshipProposals: [], corrections: [], contradictions: [], knowledgeGaps: []
    };
    const result = applier.applyExtraction(emptyEMM, emptyEKG, extraction);
    expect(result.mentalModel.evidences[sampleEvidence.evidenceId]).toBeDefined();
  });

  it('T18: Knowledge Gaps registered', () => {
    const extraction: TurnExtractionResult = {
      evidence: [], nodeProposals: [], relationshipProposals: [], corrections: [], contradictions: [],
      knowledgeGaps: [{
        gapId: 'gap-1', domain: 'D', question: 'Q', importance: 'HIGH', blocking: true, status: 'OPEN', relatedEntityRefs: []
      }]
    };
    const result = applier.applyExtraction(emptyEMM, emptyEKG, extraction);
    expect(result.mentalModel.knowledgeGaps['gap-1']).toBeDefined();
  });

  it('T19: Traces of corrections accurately applied', () => {
    const correctionEv = { ...sampleEvidence, evidenceId: 'ev-2', sourceType: 'USER_CORRECTION' as const };
    const extraction: TurnExtractionResult = {
      evidence: [], nodeProposals: [], relationshipProposals: [], corrections: [correctionEv], contradictions: [], knowledgeGaps: []
    };
    const result = applier.applyExtraction(emptyEMM, emptyEKG, extraction);
    expect(result.mentalModel.evidences['ev-2']).toBeDefined();
  });

  it('T20: Traces of contradictions applied correctly', () => {
    const contradictionEv = { ...sampleEvidence, evidenceId: 'ev-3', polarity: 'NEGATIVE' as const };
    const extraction: TurnExtractionResult = {
      evidence: [], nodeProposals: [], relationshipProposals: [], corrections: [], contradictions: [contradictionEv], knowledgeGaps: []
    };
    const result = applier.applyExtraction(emptyEMM, emptyEKG, extraction);
    expect(result.mentalModel.evidences['ev-3']).toBeDefined();
  });

  it('T21: Safe application skips invalid node relations without crashing', () => {
    const extraction: TurnExtractionResult = {
      evidence: [], nodeProposals: [],
      relationshipProposals: [{
        id: 'rel-bad', sourceId: 'missing-source', targetId: 'missing-target', type: 'RELATED_TO',
        status: 'CANDIDATE', confidence: 0.9, evidenceRefs: [], properties: {}, createdAt: 1, updatedAt: 1
      }], corrections: [], contradictions: [], knowledgeGaps: []
    };
    
    // addGraphRelationship throws if nodes are missing, our applier should catch it and continue
    expect(() => {
      const result = applier.applyExtraction(emptyEMM, emptyEKG, extraction);
      expect(result.knowledgeGraph.relationships['rel-bad']).toBeUndefined();
    }).not.toThrow();
  });
});
