// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { describe, it, expect } from 'vitest';
import RootCauseAnalyzer from '../services/RootCauseAnalyzer';
import { createStrictPolicy } from '../policies/ReasoningPolicy';
import type { ExecutiveReasoningContext, ReasoningClaim, ReasoningExecutionContext } from '../domain/types';

describe('RootCauseAnalyzer', () => {
  const policy = createStrictPolicy();
  const execCtx: ReasoningExecutionContext = { executionId: 'ex1', timestamp: '' };

  const createClaim = (sourceRelationships: string[], directness: number, aggregate: number, causalConf: number): ReasoningClaim => ({
    claimId: 'c1',
    statement: 'A causes B',
    sourceNodes: [],
    sourceRelationships,
    evidenceSupports: [],
    confidence: { support: 1, directness, consistency: 1, coverage: 1, causalConfidence: causalConf, aggregate },
    status: 'SUPPORTED_FINDING',
    createdAt: ''
  });

  it('16. should generate RootCauseHypothesis when claim is based on CAUSES relationship', () => {
    const ctx = {
      knowledgeGraph: {
        relationships: { 'r1': { type: 'CAUSES' } }
      }
    } as unknown as ExecutiveReasoningContext;

    const claims = [createClaim(['r1'], 1.0, 0.9, 0.9)];
    const result = RootCauseAnalyzer.analyze(claims, ctx, policy, execCtx);
    
    expect(result.rootCauses.length).toBe(1);
    expect(result.rootCauses[0].status).toBe('SUPPORTED_FINDING');
    expect(result.rootCauses[0].statement).toContain('A causes B');
  });

  it('17. should mark RootCauseHypothesis as PARTIALLY_SUPPORTED if directness is not 1.0', () => {
    const ctx = {
      knowledgeGraph: {
        relationships: { 'r1': { type: 'CAUSES' } }
      }
    } as unknown as ExecutiveReasoningContext;

    const claims = [createClaim(['r1'], 0.5, 0.9, 0.9)];
    const result = RootCauseAnalyzer.analyze(claims, ctx, policy, execCtx);
    
    expect(result.rootCauses.length).toBe(1);
    expect(result.rootCauses[0].status).toBe('PARTIALLY_SUPPORTED');
  });

  it('18. should ignore NON-CAUSAL relationships', () => {
    const ctx = {
      knowledgeGraph: {
        relationships: { 'r1': { type: 'AFFECTS' } }
      }
    } as unknown as ExecutiveReasoningContext;

    const claims = [createClaim(['r1'], 1.0, 0.9, 0.9)];
    const result = RootCauseAnalyzer.analyze(claims, ctx, policy, execCtx);
    
    expect(result.rootCauses.length).toBe(0);
  });
});
