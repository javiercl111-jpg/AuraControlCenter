// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { describe, it, expect } from 'vitest';
import ReasoningReportBuilder from '../services/ReasoningReportBuilder';
import type { ExecutiveFinding, ReasoningExecutionContext, FindingStatus } from '../domain/types';

describe('ReasoningReportBuilder', () => {
  const execCtx: ReasoningExecutionContext = { executionId: 'ex1', timestamp: '2026-07-25T12:00:00Z' };

  const createMockFinding = (status: FindingStatus): ExecutiveFinding => ({
    findingId: 'f1',
    statement: 'st',
    type: 'FINDING',
    chain: { chainId: 'c1', claims: [], logicDescription: '' },
    status,
    confidence: { support: 1, directness: 1, consistency: 1, coverage: 1, causalConfidence: 1, aggregate: 1 }
  });

  it('23. should set overallStatus to SUPPORTED_FINDING if all items are supported', () => {
    const findings: ExecutiveFinding[] = [
      createMockFinding('SUPPORTED_FINDING'),
      createMockFinding('SUPPORTED_FINDING')
    ];
    
    const report = ReasoningReportBuilder.build(findings, [], [], [], [], execCtx);
    expect(report.overallStatus).toBe('SUPPORTED_FINDING');
  });

  it('24. should set overallStatus to PARTIALLY_SUPPORTED if mixed', () => {
    const findings: ExecutiveFinding[] = [
      createMockFinding('SUPPORTED_FINDING'),
      createMockFinding('PARTIALLY_SUPPORTED')
    ];
    
    const report = ReasoningReportBuilder.build(findings, [], [], [], [], execCtx);
    expect(report.overallStatus).toBe('PARTIALLY_SUPPORTED');
  });

  it('25. should override overallStatus to CONTRADICTED if any item is contradicted', () => {
    const findings: ExecutiveFinding[] = [
      createMockFinding('SUPPORTED_FINDING'),
      createMockFinding('CONTRADICTED')
    ];
    
    const report = ReasoningReportBuilder.build(findings, [], [], [], [], execCtx);
    expect(report.overallStatus).toBe('CONTRADICTED');
  });

  it('26. should return REQUIRES_MORE_EVIDENCE if empty', () => {
    const report = ReasoningReportBuilder.build([], [], [], [], [], execCtx);
    expect(report.overallStatus).toBe('REQUIRES_MORE_EVIDENCE');
  });
});
