// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { describe, it, expect } from 'vitest';
import EvidenceEvaluator from '../services/EvidenceEvaluator';
import { createStrictPolicy } from '../policies/ReasoningPolicy';
import type { ExecutiveReasoningContext, ReasoningClaim, EvidenceSupport } from '../domain/types';

describe('EvidenceEvaluator', () => {
  const policy = createStrictPolicy();
  const ctx = {
    coverageReport: { overallScore: 0.8 },
    knowledgeGraph: { relationships: {} }
  } as unknown as ExecutiveReasoningContext;

  const createClaim = (supports: EvidenceSupport[], sourceRelationships: string[] = []): ReasoningClaim => ({
    claimId: 'c1',
    statement: 'test',
    sourceNodes: [],
    sourceRelationships,
    evidenceSupports: supports,
    confidence: { support: 0, directness: 0, consistency: 0, coverage: 0, causalConfidence: 0, aggregate: 0 },
    status: 'REQUIRES_MORE_EVIDENCE',
    createdAt: ''
  });

  it('9. should mark claim as NOT_DEFENDABLE if it has no evidence support', () => {
    const claims = [createClaim([])];
    const evaluated = EvidenceEvaluator.evaluate(claims, ctx, policy);
    expect(evaluated[0].status).toBe('NOT_DEFENDABLE');
    expect(evaluated[0].confidence.aggregate).toBe(0);
  });

  it('10. should assign directness score of 1.0 for direct evidence vs 0.5 for inference', () => {
    const directClaim = createClaim([{ supportId: 's1', evidenceRef: 'ev1', correlationType: 'DIRECT', weight: 1, rationale: '' }]);
    const inferenceClaim = createClaim([{ supportId: 's2', evidenceRef: 'ev2', correlationType: 'INFERENCE', weight: 1, rationale: '' }]);

    const evaluatedDirect = EvidenceEvaluator.evaluate([directClaim], ctx, policy);
    const evaluatedInference = EvidenceEvaluator.evaluate([inferenceClaim], ctx, policy);

    expect(evaluatedDirect[0].confidence.directness).toBe(1.0);
    expect(evaluatedInference[0].confidence.directness).toBe(0.5);
  });

  it('11. should correctly evaluate causal confidence based on relationships', () => {
    const ctxCausal = {
      coverageReport: { overallScore: 0.8 },
      knowledgeGraph: { relationships: { 'r1': { type: 'CAUSES' }, 'r2': { type: 'AFFECTS' } } }
    } as unknown as ExecutiveReasoningContext;

    const causalDirectClaim = createClaim([{ supportId: 's1', evidenceRef: 'ev1', correlationType: 'DIRECT', weight: 1, rationale: '' }], ['r1']);
    const nonCausalClaim = createClaim([{ supportId: 's2', evidenceRef: 'ev2', correlationType: 'DIRECT', weight: 1, rationale: '' }], ['r2']);

    const evals = EvidenceEvaluator.evaluate([causalDirectClaim, nonCausalClaim], ctxCausal, policy);
    expect(evals[0].confidence.causalConfidence).toBe(0.9); // direct + causal
    expect(evals[1].confidence.causalConfidence).toBe(0); // non-causal
  });

  it('12. should mark claim as PARTIALLY_SUPPORTED if aggregate is below policy threshold', () => {
    const policyStrict = { ...policy, minimumSupportThreshold: 0.95 }; // Very high threshold
    const claim = createClaim([{ supportId: 's1', evidenceRef: 'ev1', correlationType: 'INFERENCE', weight: 1, rationale: '' }]);
    const evals = EvidenceEvaluator.evaluate([claim], ctx, policyStrict);
    expect(evals[0].status).toBe('PARTIALLY_SUPPORTED');
  });
});
