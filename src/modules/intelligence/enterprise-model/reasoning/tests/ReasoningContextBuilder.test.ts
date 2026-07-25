// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { describe, it, expect } from 'vitest';
import ReasoningContextBuilder from '../services/ReasoningContextBuilder';
import { createStrictPolicy } from '../policies/ReasoningPolicy';
import type { ExecutiveReasoningContext, ReasoningExecutionContext } from '../domain/types';
import type { CoverageGap, DomainCoverageMetrics } from '../../coverage/domain/types';
import type { EnterpriseMentalModel } from '../../domain/types';

describe('ReasoningContextBuilder', () => {
  const policy = createStrictPolicy();
  const execCtx: ReasoningExecutionContext = { executionId: 'ex1', timestamp: '2026-07-25T12:00:00Z' };

  const createMockContext = (overallScore: number, blockingGaps: CoverageGap[] = []): ExecutiveReasoningContext => ({
    mentalModel: {} as EnterpriseMentalModel,
    knowledgeGraph: { nodes: {}, relationships: {} },
    coverageReport: { overallScore, domainBreakdown: {} as Record<string, DomainCoverageMetrics>, totalNodes: 0, totalRelationships: 0, timestamp: '', criticalGaps: [], readinessForDecision: false, confidenceLevel: 'LOW' },
    decisionAssessment: { isReady: blockingGaps.length === 0, score: 0, targetScenario: '', recommendedQuestions: [], blockingGaps },
    questionHistory: { historyId: '1', items: [] },
    evidences: [],
    hypotheses: [],
    contradictions: [],
    constraints: [],
    executiveObjectives: [],
  });

  it('1. should accept context when coverage is sufficient and no blocking gaps exist', () => {
    const ctx = createMockContext(0.8, []);
    const result = ReasoningContextBuilder.validateOrReject(ctx, policy, execCtx);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.context).toBeDefined();
    }
  });

  it('2. should reject context and return fallback report when coverage score is below policy threshold', () => {
    const ctx = createMockContext(0.5, []);
    const result = ReasoningContextBuilder.validateOrReject(ctx, policy, execCtx);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.fallbackReport.overallStatus).toBe('REQUIRES_MORE_EVIDENCE');
      expect(result.fallbackReport.readinessGaps.length).toBe(1);
      expect(result.fallbackReport.readinessGaps[0]).toContain('below policy threshold');
    }
  });

  it('3. should reject context when there are blocking gaps in decision assessment', () => {
    const gap: CoverageGap = { id: 'gap1', domain: 'payroll', gapType: 'missing_node_type', severity: 'critical', description: 'desc', recommendedAction: 'act' };
    const ctx = createMockContext(0.9, [gap]);
    const result = ReasoningContextBuilder.validateOrReject(ctx, policy, execCtx);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.fallbackReport.overallStatus).toBe('REQUIRES_MORE_EVIDENCE');
      expect(result.fallbackReport.readinessGaps.length).toBe(1);
      expect(result.fallbackReport.readinessGaps[0]).toContain('1 blocking gaps');
    }
  });

  it('4. should reject context with multiple readiness gaps when score is low and gaps exist', () => {
    const gap: CoverageGap = { id: 'gap1', domain: 'payroll', gapType: 'missing_node_type', severity: 'critical', description: 'desc', recommendedAction: 'act' };
    const ctx = createMockContext(0.2, [gap]);
    const result = ReasoningContextBuilder.validateOrReject(ctx, policy, execCtx);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.fallbackReport.readinessGaps.length).toBe(2);
    }
  });
});
