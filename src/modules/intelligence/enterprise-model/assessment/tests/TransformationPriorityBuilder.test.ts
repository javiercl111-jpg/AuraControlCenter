/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-expect-error Vitest ambient module types
import { describe, it, expect } from 'vitest';
import { TransformationPriorityBuilder } from '../services/TransformationPriorityBuilder';

describe('TransformationPriorityBuilder', () => {
  const builder = new TransformationPriorityBuilder();

  it('should map strategic priority to transformation priority without recommendation candidates', () => {
    const strategicPriorities = [
      {
        id: 'p-1',
        rank: 1,
        title: 'Priority 1',
        description: 'Desc 1',
        dimension: 'TECHNOLOGY',
        addressedWeaknesses: [],
        leveragedStrengths: [],
        urgency: 'IMMEDIATE' as const
      }
    ];

    const priorities = builder.build(strategicPriorities, []);
    
    expect(priorities).toHaveLength(1);
    expect(priorities[0].id).toBe('p-1');
    expect((priorities[0] as any).recommendationCandidates).toBeUndefined();
  });

  it('should assign readinessDependencyIds based on dependencies', () => {
    const strategicPriorities = [
      {
        id: 'p-1', rank: 1, title: '', description: '', dimension: 'TECHNOLOGY', addressedWeaknesses: [], leveragedStrengths: [], urgency: 'IMMEDIATE' as const
      }
    ];
    
    const dependencies = [
      { id: 'dep-1', sourcePriorityId: 'p-1', targetPriorityId: 'p-2', type: 'REQUIRES' as const }
    ];

    const priorities = builder.build(strategicPriorities, dependencies);
    
    expect(priorities[0].readinessDependencyIds).toContain('dep-1');
  });

  it('should maintain rank and properties correctly', () => {
    const strategicPriorities = [
      {
        id: 'p-1', rank: 2, title: 'Title', description: 'Desc', dimension: 'TECHNOLOGY', addressedWeaknesses: ['w-1'], leveragedStrengths: ['s-1'], urgency: 'IMMEDIATE' as const
      }
    ];

    const priorities = builder.build(strategicPriorities, []);
    
    expect(priorities[0].rank).toBe(2);
    expect(priorities[0].title).toBe('Title');
    expect(priorities[0].addressedWeaknesses).toContain('w-1');
    expect(priorities[0].leveragedStrengths).toContain('s-1');
  });

  it('should handle empty lists gracefully', () => {
    const priorities = builder.build([], []);
    expect(priorities).toHaveLength(0);
  });
});
