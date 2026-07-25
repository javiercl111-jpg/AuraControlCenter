// @ts-expect-error Vitest ambient module types
import { describe, it, expect } from 'vitest';
import { DiagnosticContextBuilder } from '../services/DiagnosticContextBuilder';
import { ContextValidationError } from '../utils/validators';
import type { ExecutiveReasoningReport } from '../../reasoning/domain/types';

const createValidReport = (): ExecutiveReasoningReport => ({
  reportId: 'rep-1',
  timestamp: '2026-07-25T10:00:00Z',
  overallStatus: 'SUPPORTED_FINDING',
  findings: [],
  risks: [],
  opportunities: [],
  rootCauses: [],
  rejectedClaims: [],
  readinessGaps: []
});

describe('DiagnosticContextBuilder', () => {
  const builder = new DiagnosticContextBuilder();

  it('should successfully build context for a valid report', () => {
    const report = createValidReport();
    const context = builder.build(report);
    expect(context.status).toBe('VALID');
    expect(context.blocks).toHaveLength(0);
    expect(context.report.reportId).toBe('rep-1');
  });

  it('should throw ContextValidationError for invalid input structure', () => {
    expect(() => builder.build({})).toThrow(ContextValidationError);
    expect(() => builder.build(null)).toThrow(ContextValidationError);
  });

  it('should map rejected claims to audit', () => {
    const report = createValidReport();
    report.rejectedClaims = [{
      claimId: 'c1',
      statement: 'false claim',
      sourceNodes: [],
      sourceRelationships: [],
      evidenceSupports: [],
      confidence: { support: 0, directness: 0, consistency: 0, coverage: 0, causalConfidence: 0, aggregate: 0 },
      status: 'NOT_DEFENDABLE',
      createdAt: ''
    }];
    
    const context = builder.build(report);
    expect(context.audit.rejectedClaims).toHaveLength(1);
    expect(context.audit.rejectedClaims[0].claim.claimId).toBe('c1');
    expect(context.audit.rejectedClaims[0].reason).toBe('Rejected during reasoning phase');
  });

  it('should set status to INSUFFICIENT_EVIDENCE if report is NOT_DEFENDABLE', () => {
    const report = createValidReport();
    report.overallStatus = 'NOT_DEFENDABLE';
    const context = builder.build(report);
    expect(context.status).toBe('INSUFFICIENT_EVIDENCE');
    expect(context.blocks).toContain('Report overall status is NOT_DEFENDABLE');
  });

  it('should set status to INSUFFICIENT_EVIDENCE if there are readiness gaps', () => {
    const report = createValidReport();
    report.readinessGaps = ['Missing financial data'];
    const context = builder.build(report);
    expect(context.status).toBe('INSUFFICIENT_EVIDENCE');
    expect(context.blocks).toContain('Report has readiness gaps: Missing financial data');
  });
});
