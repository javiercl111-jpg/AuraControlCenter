/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest';
import { TransformationReadinessEvaluator } from '../services/TransformationReadinessEvaluator';
import { DefaultAssessmentPolicy } from '../policies/AssessmentPolicy';

describe('TransformationReadinessEvaluator', () => {
  const policy = new DefaultAssessmentPolicy();
  const evaluator = new TransformationReadinessEvaluator(policy);

  const mockProfile = { overallMaturity: 'MANAGED' as const, dimensions: [] };
  const mockRisk = (severity: any) => ({
    findingId: 'r-1',
    statement: '',
    type: 'RISK' as const,
    chain: { chainId: '', claims: [], logicDescription: '' },
    status: 'SUPPORTED_FINDING' as const,
    confidence: { support: 1, directness: 1, consistency: 1, coverage: 1, causalConfidence: 1, aggregate: 1 },
    severity,
    impactArea: ''
  });

  it('should evaluate to READY when there are no issues', () => {
    const readiness = evaluator.evaluate(mockProfile, [], [], []);
    
    expect(readiness.status).toBe('READY');
  });

  it('should evaluate to NEEDS_PREPARATION when there are some blocking dependencies', () => {
    const readiness = evaluator.evaluate(
      mockProfile, 
      [], 
      [], 
      [{ id: 'd-1', sourcePriorityId: 'p-1', targetPriorityId: 'p-2', type: 'BLOCKS' }]
    );
    
    expect(readiness.status).toBe('NEEDS_PREPARATION');
  });

  it('should evaluate to NOT_READY when there are multiple critical risks', () => {
    const readiness = evaluator.evaluate(
      mockProfile, 
      [mockRisk('CRITICAL'), mockRisk('CRITICAL'), mockRisk('CRITICAL')], 
      [], 
      []
    );
    
    expect(readiness.status).toBe('NOT_READY');
  });

  it('should evaluate to NOT_READY when there are multiple critical constraints', () => {
    const readiness = evaluator.evaluate(
      mockProfile, 
      [], 
      [
        { id: 'c-1', type: 'BUDGET', description: '', impactLevel: 'CRITICAL' },
        { id: 'c-2', type: 'TIME', description: '', impactLevel: 'CRITICAL' }
      ], 
      []
    );
    
    expect(readiness.status).toBe('NOT_READY');
  });
});
