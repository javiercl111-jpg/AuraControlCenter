import { describe, it, expect } from 'vitest';
import { PriorityRanker } from '../services/PriorityRanker';
import { DefaultDossierExecutionContext } from '../utils/DossierContextImpl';
import type { EnterpriseStrength, EnterpriseWeakness } from '../domain/types';

describe('PriorityRanker', () => {
  const contextProvider = new DefaultDossierExecutionContext('exec-1', 'time-1');
  const ranker = new PriorityRanker(contextProvider);

  it('should rank CRITICAL weaknesses over HIGH weaknesses', () => {
    const weaknesses: EnterpriseWeakness[] = [
      { id: 'w1', dimension: 'HR', description: 'High W', severity: 'HIGH', relatedRisks: ['r1'], rootCauses: [] },
      { id: 'w2', dimension: 'TECH', description: 'Crit W', severity: 'CRITICAL', relatedRisks: ['r2'], rootCauses: [] },
    ];

    const result = ranker.rank([], weaknesses);
    expect(result.priorities).toHaveLength(2);
    expect(result.priorities[0].dimension).toBe('TECH');
    expect(result.priorities[0].urgency).toBe('IMMEDIATE');
    expect(result.priorities[1].dimension).toBe('HR');
    expect(result.priorities[1].urgency).toBe('SHORT_TERM');
  });

  it('should link leveraged strengths by dimension', () => {
    const strengths: EnterpriseStrength[] = [
      { id: 's1', dimension: 'HR', description: 'Good HR', impact: 'HIGH', supportingFindings: [] },
      { id: 's2', dimension: 'TECH', description: 'Good Tech', impact: 'MODERATE', supportingFindings: [] }
    ];
    const weaknesses: EnterpriseWeakness[] = [
      { id: 'w1', dimension: 'HR', description: 'Bad HR', severity: 'HIGH', relatedRisks: [], rootCauses: [] },
    ];

    const result = ranker.rank(strengths, weaknesses);
    expect(result.priorities).toHaveLength(1);
    expect(result.priorities[0].leveragedStrengths).toContain('s1');
    expect(result.priorities[0].leveragedStrengths).not.toContain('s2');
  });

  it('should guarantee unique ranks', () => {
    const weaknesses: EnterpriseWeakness[] = [
      { id: 'w1', dimension: 'HR', description: 'A', severity: 'HIGH', relatedRisks: ['r1'], rootCauses: [] },
      { id: 'w2', dimension: 'HR', description: 'B', severity: 'HIGH', relatedRisks: ['r1'], rootCauses: [] },
      { id: 'w3', dimension: 'HR', description: 'C', severity: 'HIGH', relatedRisks: ['r1'], rootCauses: [] },
    ];

    const result = ranker.rank([], weaknesses);
    const ranks = result.priorities.map(p => p.rank);
    const uniqueRanks = new Set(ranks);
    expect(uniqueRanks.size).toBe(3);
    expect(ranks).toEqual([1, 2, 3]);
  });

  it('should emit candidates linked to priorities', () => {
    const weaknesses: EnterpriseWeakness[] = [
      { id: 'w1', dimension: 'HR', description: 'Bad HR', severity: 'HIGH', relatedRisks: ['r1'], rootCauses: ['rc1'] },
    ];

    const result = ranker.rank([], weaknesses);
    expect(result.candidates).toHaveLength(1);
    const candidate = result.candidates[0];
    const priority = result.priorities[0];
    
    expect(candidate.priorityId).toBe(priority.id);
    expect(candidate.evidenceRefs).toContain('r1');
    expect(candidate.evidenceRefs).toContain('rc1');
    expect(candidate.effortEstimate).toBe('MEDIUM');
  });

  it('should rank HIGH severity weaknesses by number of related risks', () => {
    const weaknesses: EnterpriseWeakness[] = [
      { id: 'w1', dimension: 'HR', description: 'A', severity: 'HIGH', relatedRisks: ['r1'], rootCauses: [] },
      { id: 'w2', dimension: 'TECH', description: 'B', severity: 'HIGH', relatedRisks: ['r2', 'r3'], rootCauses: [] },
    ];
    const result = ranker.rank([], weaknesses);
    expect(result.priorities).toHaveLength(2);
    expect(result.priorities[0].dimension).toBe('TECH');
    expect(result.priorities[1].dimension).toBe('HR');
  });

  it('should rank alphabetically if severity and related risk count are identical', () => {
    const weaknesses: EnterpriseWeakness[] = [
      { id: 'wB', dimension: 'HR', description: 'B', severity: 'HIGH', relatedRisks: ['r1'], rootCauses: [] },
      { id: 'wA', dimension: 'TECH', description: 'A', severity: 'HIGH', relatedRisks: ['r2'], rootCauses: [] },
    ];
    const result = ranker.rank([], weaknesses);
    expect(result.priorities).toHaveLength(2);
    expect(result.priorities[0].addressedWeaknesses).toContain('wA');
    expect(result.priorities[1].addressedWeaknesses).toContain('wB');
  });
});
