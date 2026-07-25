// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { describe, it, expect } from 'vitest';
import FindingSynthesizer from '../services/FindingSynthesizer';
import { createStrictPolicy } from '../policies/ReasoningPolicy';
import type { ExecutiveReasoningContext, ReasoningClaim, ReasoningExecutionContext, FindingStatus } from '../domain/types';

describe('FindingSynthesizer', () => {
  const policy = createStrictPolicy();
  const execCtx: ReasoningExecutionContext = { executionId: 'ex1', timestamp: '' };

  const createClaim = (sourceNodes: string[], directness: number, status: FindingStatus): ReasoningClaim => ({
    claimId: 'c1',
    statement: 'test',
    sourceNodes,
    sourceRelationships: [],
    evidenceSupports: [],
    confidence: { support: 1, directness, consistency: 1, coverage: 1, causalConfidence: 1, aggregate: 0.9 },
    status,
    createdAt: ''
  });

  it('19. should synthesize RISK when source node is a RISK', () => {
    const ctx = {
      knowledgeGraph: {
        nodes: { 'n1': { type: 'RISK', properties: { severity: 'HIGH' } } }
      }
    } as unknown as ExecutiveReasoningContext;

    const claims = [createClaim(['n1'], 1.0, 'SUPPORTED_FINDING')];
    const result = FindingSynthesizer.synthesize(claims, ctx, policy, execCtx);
    
    expect(result.risks.length).toBe(1);
    expect(result.risks[0].severity).toBe('HIGH');
  });

  it('20. should demote RISK to REQUIRES_MORE_EVIDENCE if directness < 1.0 and policy requires direct evidence', () => {
    const ctx = {
      knowledgeGraph: {
        nodes: { 'n1': { type: 'RISK', properties: { severity: 'HIGH' } } }
      }
    } as unknown as ExecutiveReasoningContext;

    const claims = [createClaim(['n1'], 0.5, 'SUPPORTED_FINDING')];
    const result = FindingSynthesizer.synthesize(claims, ctx, policy, execCtx);
    
    expect(result.risks.length).toBe(0);
    expect(result.rejectedClaims.length).toBe(1);
    expect(result.rejectedClaims[0].status).toBe('REQUIRES_MORE_EVIDENCE');
  });

  it('21. should synthesize OPPORTUNITY when source node is an OBJECTIVE or CAPABILITY', () => {
    const ctx = {
      knowledgeGraph: {
        nodes: { 'n1': { type: 'CAPABILITY', properties: {} } }
      }
    } as unknown as ExecutiveReasoningContext;

    const claims = [createClaim(['n1'], 0.5, 'SUPPORTED_FINDING')]; // 0.5 directness (inference) allowed for opps
    const result = FindingSynthesizer.synthesize(claims, ctx, policy, execCtx);
    
    expect(result.opportunities.length).toBe(1);
  });

  it('22. should filter out NOT_DEFENDABLE claims to rejectedClaims', () => {
    const ctx = {
      knowledgeGraph: { nodes: {} }
    } as unknown as ExecutiveReasoningContext;

    const claims = [createClaim(['n1'], 1.0, 'NOT_DEFENDABLE')];
    const result = FindingSynthesizer.synthesize(claims, ctx, policy, execCtx);
    
    expect(result.findings.length).toBe(0);
    expect(result.rejectedClaims.length).toBe(1);
  });
});
