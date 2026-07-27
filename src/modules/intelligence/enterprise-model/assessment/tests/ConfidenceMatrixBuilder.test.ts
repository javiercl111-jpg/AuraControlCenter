/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest';
import { ConfidenceMatrixBuilder } from '../services/ConfidenceMatrixBuilder';
import { DefaultAssessmentPolicy } from '../policies/AssessmentPolicy';

describe('ConfidenceMatrixBuilder', () => {
  const policy = new DefaultAssessmentPolicy();
  const builder = new ConfidenceMatrixBuilder(policy);

  const mockFindingWithConfidence = (c: any) => ({
    findingId: 'f-1',
    statement: 'Finding 1',
    type: 'FINDING' as const,
    chain: { chainId: '', claims: [], logicDescription: '' },
    status: 'SUPPORTED_FINDING' as const,
    confidence: { ...c, aggregate: 0 }
  });

  it('should calculate averages across all findings', () => {
    const findings = [
      mockFindingWithConfidence({ support: 0.8, directness: 0.6, consistency: 0.8, coverage: 0.4, causalConfidence: 0.2 }),
      mockFindingWithConfidence({ support: 0.2, directness: 0.4, consistency: 0.2, coverage: 0.6, causalConfidence: 0.8 })
    ];

    const matrix = builder.build(findings);
    
    // Average should be 0.5 for all
    expect(matrix.support).toBeCloseTo(0.5);
    expect(matrix.directness).toBeCloseTo(0.5);
    expect(matrix.consistency).toBeCloseTo(0.5);
    expect(matrix.coverage).toBeCloseTo(0.5);
    expect(matrix.causalConfidence).toBeCloseTo(0.5);
  });

  it('should calculate overall confidence using policy weights', () => {
    const findings = [
      mockFindingWithConfidence({ support: 1, directness: 1, consistency: 1, coverage: 1, causalConfidence: 1 })
    ];

    const matrix = builder.build(findings);
    
    // All 1s should lead to overallConfidence of 1 (assuming weights sum to 1)
    expect(matrix.overallConfidence).toBeCloseTo(1);
  });

  it('should handle zero findings by returning zero matrix', () => {
    const matrix = builder.build([]);
    
    expect(matrix.support).toBe(0);
    expect(matrix.overallConfidence).toBe(0);
  });

  it('should populate dimensionConfidence properly', () => {
    const findings = [
      mockFindingWithConfidence({ support: 0.8, directness: 0.8, consistency: 0.8, coverage: 0.8, causalConfidence: 0.8 })
    ];

    const matrix = builder.build(findings);
    
    expect(matrix.dimensionConfidence['DEFAULT']).toBeCloseTo(0.8);
  });
});
