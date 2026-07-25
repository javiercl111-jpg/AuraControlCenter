// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { describe, it, expect } from 'vitest';
import ContradictionResolver from '../services/ContradictionResolver';
import { createStrictPolicy } from '../policies/ReasoningPolicy';
import type { ExecutiveReasoningContext, ReasoningClaim } from '../domain/types';

describe('ContradictionResolver', () => {
  const policy = createStrictPolicy();
  
  const createClaim = (sourceNodes: string[], sourceRelationships: string[] = [], aggregate: number = 0.8): ReasoningClaim => ({
    claimId: 'c1',
    statement: 'test',
    sourceNodes,
    sourceRelationships,
    evidenceSupports: [],
    confidence: { support: 1, directness: 1, consistency: 1, coverage: 1, causalConfidence: 0, aggregate },
    status: 'SUPPORTED_FINDING',
    createdAt: ''
  });

  it('13. should mark claim as CONTRADICTED if a source node is CONTRADICTED', () => {
    const ctx = {
      knowledgeGraph: {
        nodes: {
          'n1': { status: 'CONTRADICTED' },
          'n2': { status: 'CONFIRMED' }
        },
        relationships: {}
      }
    } as unknown as ExecutiveReasoningContext;

    const claims = [createClaim(['n1', 'n2'])];
    const resolved = ContradictionResolver.resolve(claims, ctx, policy);
    
    expect(resolved[0].status).toBe('CONTRADICTED');
    expect(resolved[0].confidence.consistency).toBe(0.0);
    expect(resolved[0].confidence.aggregate).toBe(0.8 * policy.contradictionDemotionWeight);
  });

  it('14. should mark claim as CONTRADICTED if a source relationship is CONTRADICTED', () => {
    const ctx = {
      knowledgeGraph: {
        nodes: {},
        relationships: {
          'r1': { status: 'CONTRADICTED' }
        }
      }
    } as unknown as ExecutiveReasoningContext;

    const claims = [createClaim([], ['r1'])];
    const resolved = ContradictionResolver.resolve(claims, ctx, policy);
    
    expect(resolved[0].status).toBe('CONTRADICTED');
    expect(resolved[0].confidence.consistency).toBe(0.0);
  });

  it('15. should leave claim untouched if no sources are CONTRADICTED', () => {
    const ctx = {
      knowledgeGraph: {
        nodes: { 'n1': { status: 'CONFIRMED' } },
        relationships: {}
      }
    } as unknown as ExecutiveReasoningContext;

    const claims = [createClaim(['n1'])];
    const resolved = ContradictionResolver.resolve(claims, ctx, policy);
    
    expect(resolved[0].status).toBe('SUPPORTED_FINDING');
    expect(resolved[0].confidence.consistency).toBe(1.0);
  });
});
