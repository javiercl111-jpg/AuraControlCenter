// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { describe, it, expect } from 'vitest';
import { ConversationalExtractor } from '../services/ConversationalExtractor';
import type { EvidenceExtractionProvider, ExtractionContext } from '../domain/types';
import { generateDeterministicEvidenceId } from '../domain/utils';

describe('ConversationalExtractor (AI-01C)', () => {
  const mockContext: ExtractionContext = {
    sessionId: 'session-123',
    turnId: 'turn-456',
    previousStatements: [],
    currentEntities: []
  };

  it('T01: Extractor returns validated result when given valid data', () => {
    const provider: EvidenceExtractionProvider = {
      extract: () => ({
        evidence: [{
          evidenceId: generateDeterministicEvidenceId('session-123', 'turn-456', 'Valid fact', 'OPERATIONAL'),
          sessionId: 'session-123',
          turnId: 'turn-456',
          source: 'user-chat',
          sourceType: 'USER_STATEMENT',
          originalText: 'Valid fact',
          normalizedStatement: 'Valid fact',
          category: 'OPERATIONAL',
          entityRefs: ['node-1'],
          capturedAt: Date.now(),
          reliability: 0.9,
          directness: 1.0,
          polarity: 'POSITIVE',
          extractorVersion: '1.0',
          metadata: {}
        }],
        nodeProposals: [{
          id: 'node-1',
          type: 'PROCESS',
          label: 'Valid process',
          status: 'CANDIDATE',
          mentalModelRef: null,
          properties: {},
          createdAt: Date.now(),
          updatedAt: Date.now()
        }],
        relationshipProposals: [],
        corrections: [],
        contradictions: [],
        knowledgeGaps: []
      })
    };
    
    const extractor = new ConversationalExtractor(provider);
    const result = extractor.extractFromTurn('Valid fact', mockContext);
    expect(result.evidence).toHaveLength(1);
    expect(result.nodeProposals).toHaveLength(1);
  });

  it('T02: Rejects relationship with invalid node (fail-closed)', () => {
    const provider: EvidenceExtractionProvider = {
      extract: () => ({
        evidence: [],
        nodeProposals: [],
        relationshipProposals: [{
          id: 'rel-1',
          sourceId: '', // Invalid node
          targetId: 'target-1',
          type: 'RELATED_TO',
          status: 'CANDIDATE',
          confidence: 0.8,
          evidenceRefs: ['ev-1'],
          properties: {},
          createdAt: Date.now(),
          updatedAt: Date.now()
        }],
        corrections: [],
        contradictions: [],
        knowledgeGaps: []
      })
    };
    
    const extractor = new ConversationalExtractor(provider);
    const result = extractor.extractFromTurn('Some text', mockContext);
    expect(result.relationshipProposals).toHaveLength(0); // Failed validation, returns empty
  });

  it('T03: Rejects CAUSES relationship without explicit evidence', () => {
    const provider: EvidenceExtractionProvider = {
      extract: () => ({
        evidence: [],
        nodeProposals: [{
          id: 'node-1', type: 'RISK', label: 'R', status: 'CANDIDATE', mentalModelRef: null, properties: {}, createdAt: 1, updatedAt: 1
        }, {
          id: 'node-2', type: 'PROCESS', label: 'P', status: 'CANDIDATE', mentalModelRef: null, properties: {}, createdAt: 1, updatedAt: 1
        }],
        relationshipProposals: [{
          id: 'rel-1',
          sourceId: 'node-1',
          targetId: 'node-2',
          type: 'CAUSES',
          status: 'CANDIDATE',
          confidence: 0.8,
          evidenceRefs: [], // Missing evidence for CAUSES!
          properties: {},
          createdAt: Date.now(),
          updatedAt: Date.now()
        }],
        corrections: [],
        contradictions: [],
        knowledgeGaps: []
      })
    };
    
    const extractor = new ConversationalExtractor(provider);
    const result = extractor.extractFromTurn('R causes P', mockContext);
    expect(result.relationshipProposals).toHaveLength(0);
  });

  it('T04: Rejects unknown relationship type', () => {
    const provider: EvidenceExtractionProvider = {
      extract: () => ({
        evidence: [], nodeProposals: [], corrections: [], contradictions: [], knowledgeGaps: [],
        relationshipProposals: [{
          id: 'rel-1',
          sourceId: 'a',
          targetId: 'b',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          type: 'MAGIC_BOND' as any,
          status: 'CANDIDATE',
          confidence: 0.8,
          evidenceRefs: ['ev-1'],
          properties: {},
          createdAt: Date.now(),
          updatedAt: Date.now()
        }],
      })
    };
    const extractor = new ConversationalExtractor(provider);
    const result = extractor.extractFromTurn('text', mockContext);
    expect(result.relationshipProposals).toHaveLength(0);
  });

  it('T05: Rejects confidence outside 0-1', () => {
    const provider: EvidenceExtractionProvider = {
      extract: () => ({
        evidence: [{
          evidenceId: 'ev-1', sessionId: '1', turnId: '1', source: 'user', sourceType: 'USER_STATEMENT',
          originalText: 'txt', normalizedStatement: 'txt', category: 'CAT', entityRefs: [],
          capturedAt: 1, reliability: 1.5, directness: 0.5, polarity: 'POSITIVE', extractorVersion: '1.0', metadata: {}
        }], nodeProposals: [], relationshipProposals: [], corrections: [], contradictions: [], knowledgeGaps: []
      })
    };
    const extractor = new ConversationalExtractor(provider);
    const result = extractor.extractFromTurn('text', mockContext);
    expect(result.evidence).toHaveLength(0);
  });

  it('T06: Deterministic extraction ID checks', () => {
    const id1 = generateDeterministicEvidenceId('s1', 't1', 'same', 'CAT');
    const id2 = generateDeterministicEvidenceId('s1', 't1', 'same', 'cat');
    expect(id1).toEqual(id2);
  });

  it('T07: Casos obligatorios - hotelería', () => {
    const provider: EvidenceExtractionProvider = {
      extract: () => ({
        evidence: [{
          evidenceId: generateDeterministicEvidenceId('s1', 't1', 'Hotel uses Excel', 'HOTEL'),
          sessionId: 's1', turnId: 't1', source: 'chat', sourceType: 'USER_STATEMENT',
          originalText: 'We do it in excel', normalizedStatement: 'Hotel uses Excel',
          category: 'HOTEL', entityRefs: ['node-1'], capturedAt: 1, reliability: 1, directness: 1,
          polarity: 'POSITIVE', extractorVersion: '1.0', metadata: {}
        }],
        nodeProposals: [{
          id: 'node-1', type: 'PROCESS', label: 'Hotel Booking', status: 'CANDIDATE', mentalModelRef: null, properties: {}, createdAt: 1, updatedAt: 1
        }], relationshipProposals: [], corrections: [], contradictions: [], knowledgeGaps: []
      })
    };
    const extractor = new ConversationalExtractor(provider);
    const result = extractor.extractFromTurn('We do it in excel', mockContext);
    expect(result.evidence[0].category).toBe('HOTEL');
  });

  it('T08: Casos obligatorios - mantenimiento en Excel', () => {
    const provider: EvidenceExtractionProvider = {
      extract: () => ({
        evidence: [{
          evidenceId: generateDeterministicEvidenceId('s1', 't1', 'Maintenance is tracked in Excel', 'TECH'),
          sessionId: 's1', turnId: 't1', source: 'chat', sourceType: 'USER_STATEMENT',
          originalText: 'mantenimiento en excel', normalizedStatement: 'Maintenance is tracked in Excel',
          category: 'TECH', entityRefs: ['node-2'], capturedAt: 1, reliability: 1, directness: 1,
          polarity: 'POSITIVE', extractorVersion: '1.0', metadata: {}
        }],
        nodeProposals: [{
          id: 'node-2', type: 'PROCESS', label: 'Maintenance Tracking', status: 'CANDIDATE', mentalModelRef: null, properties: {}, createdAt: 1, updatedAt: 1
        }], relationshipProposals: [], corrections: [], contradictions: [], knowledgeGaps: []
      })
    };
    const extractor = new ConversationalExtractor(provider);
    const result = extractor.extractFromTurn('mantenimiento en excel', mockContext);
    expect(result.evidence[0].normalizedStatement).toContain('Excel');
  });

  it('T09: Casos obligatorios - corrección del usuario', () => {
    const provider: EvidenceExtractionProvider = {
      extract: () => ({
        evidence: [], nodeProposals: [], relationshipProposals: [], contradictions: [], knowledgeGaps: [],
        corrections: [{
          evidenceId: generateDeterministicEvidenceId('s1', 't1', 'Not 5 but 10 users', 'TECH'),
          sessionId: 's1', turnId: 't1', source: 'chat', sourceType: 'USER_CORRECTION',
          originalText: 'actually 10', normalizedStatement: 'Not 5 but 10 users',
          category: 'TECH', entityRefs: [], capturedAt: 1, reliability: 1, directness: 1,
          polarity: 'POSITIVE', extractorVersion: '1.0', metadata: {}
        }],
      })
    };
    const extractor = new ConversationalExtractor(provider);
    const result = extractor.extractFromTurn('actually 10', mockContext);
    expect(result.corrections).toHaveLength(1);
    expect(result.corrections[0].sourceType).toBe('USER_CORRECTION');
  });

  it('T10: Casos obligatorios - contradicción', () => {
    const provider: EvidenceExtractionProvider = {
      extract: () => ({
        evidence: [], nodeProposals: [], relationshipProposals: [], corrections: [], knowledgeGaps: [],
        contradictions: [{
          evidenceId: generateDeterministicEvidenceId('s1', 't1', 'We never used Excel', 'TECH'),
          sessionId: 's1', turnId: 't1', source: 'chat', sourceType: 'USER_CORRECTION',
          originalText: 'We never used Excel', normalizedStatement: 'We never used Excel',
          category: 'TECH', entityRefs: [], capturedAt: 1, reliability: 1, directness: 1,
          polarity: 'NEGATIVE', extractorVersion: '1.0', metadata: {}
        }],
      })
    };
    const extractor = new ConversationalExtractor(provider);
    const result = extractor.extractFromTurn('We never used Excel', mockContext);
    expect(result.contradictions).toHaveLength(1);
    expect(result.contradictions[0].polarity).toBe('NEGATIVE');
  });

  it('T11: Casos obligatorios - respuesta ambigua', () => {
    const provider: EvidenceExtractionProvider = {
      extract: () => ({
        evidence: [], nodeProposals: [], relationshipProposals: [], corrections: [], contradictions: [],
        knowledgeGaps: [{
          gapId: 'gap-1', domain: 'TECH', question: 'What tool is used for maintenance?',
          importance: 'MEDIUM', blocking: false, status: 'OPEN', relatedEntityRefs: []
        }]
      })
    };
    const extractor = new ConversationalExtractor(provider);
    const result = extractor.extractFromTurn('I am not sure', mockContext);
    expect(result.knowledgeGaps).toHaveLength(1);
  });

  it('T12: Casos obligatorios - AFFECTS sin elevarla a CAUSES', () => {
    const provider: EvidenceExtractionProvider = {
      extract: () => ({
        evidence: [],
        nodeProposals: [{
          id: 'node-1', type: 'RISK', label: 'R', status: 'CANDIDATE', mentalModelRef: null, properties: {}, createdAt: 1, updatedAt: 1
        }, {
          id: 'node-2', type: 'PROCESS', label: 'P', status: 'CANDIDATE', mentalModelRef: null, properties: {}, createdAt: 1, updatedAt: 1
        }],
        relationshipProposals: [{
          id: 'rel-1',
          sourceId: 'node-1',
          targetId: 'node-2',
          type: 'AFFECTS', // AFFECTS instead of CAUSES
          status: 'CANDIDATE',
          confidence: 0.8,
          evidenceRefs: ['ev-1'], // AFFECTS is fine with or without direct causal proof if explicitly stated
          properties: {},
          createdAt: Date.now(),
          updatedAt: Date.now()
        }],
        corrections: [],
        contradictions: [],
        knowledgeGaps: []
      })
    };
    const extractor = new ConversationalExtractor(provider);
    const result = extractor.extractFromTurn('R affects P', mockContext);
    expect(result.relationshipProposals[0].type).toBe('AFFECTS');
  });
  
  it('T13: Incomplete traceability (missing evidenceId) fails validation', () => {
    const provider: EvidenceExtractionProvider = {
      extract: () => ({
        evidence: [{
          evidenceId: '', // missing ID!
          sessionId: 'session-123',
          turnId: 'turn-456',
          source: 'user-chat',
          sourceType: 'USER_STATEMENT',
          originalText: 'Valid fact',
          normalizedStatement: 'Valid fact',
          category: 'OPERATIONAL',
          entityRefs: ['node-1'],
          capturedAt: Date.now(),
          reliability: 0.9,
          directness: 1.0,
          polarity: 'POSITIVE',
          extractorVersion: '1.0',
          metadata: {}
        }], nodeProposals: [], relationshipProposals: [], corrections: [], contradictions: [], knowledgeGaps: []
      })
    };
    const extractor = new ConversationalExtractor(provider);
    const result = extractor.extractFromTurn('text', mockContext);
    expect(result.evidence).toHaveLength(0);
  });
});
