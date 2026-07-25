// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { describe, it, expect } from 'vitest';
import ClaimGenerator from '../services/ClaimGenerator';
import type { ExecutiveReasoningContext, ReasoningExecutionContext } from '../domain/types';

describe('ClaimGenerator', () => {
  const execCtx: ReasoningExecutionContext = { executionId: 'ex1', timestamp: '2026-07-25T12:00:00Z' };

  it('5. should generate claims from confirmed nodes', () => {
    const ctx = {
      knowledgeGraph: {
        nodes: {
          'n1': { id: 'n1', label: 'Process A', status: 'CONFIRMED', properties: { evidenceRefs: ['ev1'] }, type: 'PROCESS' }
        },
        relationships: {}
      },
      evidences: [{ evidenceId: 'ev1' }],
      hypotheses: []
    } as unknown as ExecutiveReasoningContext;

    const claims = ClaimGenerator.generateCandidates(ctx, execCtx);
    expect(claims).toHaveLength(1);
    expect(claims[0].statement).toBe('Process A');
    expect(claims[0].evidenceSupports).toHaveLength(1);
    expect(claims[0].sourceNodes).toContain('n1');
  });

  it('6. should ignore rejected or unknown nodes', () => {
    const ctx = {
      knowledgeGraph: {
        nodes: {
          'n1': { id: 'n1', label: 'Process B', status: 'REJECTED', properties: {}, type: 'PROCESS' },
          'n2': { id: 'n2', label: 'Process C', status: 'UNKNOWN', properties: {}, type: 'PROCESS' }
        },
        relationships: {}
      },
      evidences: [],
      hypotheses: []
    } as unknown as ExecutiveReasoningContext;

    const claims = ClaimGenerator.generateCandidates(ctx, execCtx);
    expect(claims).toHaveLength(0);
  });

  it('7. should generate claims from confirmed relationships deterministically', () => {
    const ctx = {
      knowledgeGraph: {
        nodes: {
          'n1': { id: 'n1', label: 'Node1', status: 'CONFIRMED', properties: {}, type: 'PROCESS' },
          'n2': { id: 'n2', label: 'Node2', status: 'CONFIRMED', properties: {}, type: 'PROCESS' }
        },
        relationships: {
          'r1': { id: 'r1', sourceId: 'n1', targetId: 'n2', type: 'CAUSES', status: 'CONFIRMED', evidenceRefs: [] }
        }
      },
      evidences: [],
      hypotheses: []
    } as unknown as ExecutiveReasoningContext;

    const claims = ClaimGenerator.generateCandidates(ctx, execCtx);
    const relClaim = claims.find(c => c.sourceRelationships.includes('r1'));
    expect(relClaim).toBeDefined();
    expect(relClaim?.statement).toBe('Node1 CAUSES Node2');
    expect(relClaim?.createdAt).toBe('2026-07-25T12:00:00Z');
  });

  it('8. should generate claims from candidate hypotheses', () => {
    const ctx = {
      knowledgeGraph: { nodes: {}, relationships: {} },
      evidences: [],
      hypotheses: [
        { hypothesisId: 'h1', statement: 'Hypothesis A', status: 'CANDIDATE', supportingEvidenceRefs: [] }
      ]
    } as unknown as ExecutiveReasoningContext;

    const claims = ClaimGenerator.generateCandidates(ctx, execCtx);
    expect(claims).toHaveLength(1);
    expect(claims[0].statement).toBe('Hypothesis A');
    expect(claims[0].status).toBe('REQUIRES_MORE_EVIDENCE'); // Initially requires evaluation
  });
});
