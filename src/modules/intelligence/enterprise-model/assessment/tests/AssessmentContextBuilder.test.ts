// @ts-expect-error Vitest ambient module types
import { describe, it, expect } from 'vitest';
import { AssessmentContextBuilder } from '../services/AssessmentContextBuilder';

describe('AssessmentContextBuilder', () => {
  it('should initialize with executionId, policyVersion, and timestamp', () => {
    const builder = new AssessmentContextBuilder('exec-1', '1.0.0', '2026-07-25T10:00:00Z');
    const context = builder.build();
    
    expect(context.executionId).toBe('exec-1');
    expect(context.policyVersion).toBe('1.0.0');
    expect(context.timestamp).toBe('2026-07-25T10:00:00Z');
    expect(typeof context.generateDeterministicId).toBe('function');
  });

  it('should generate deterministic ID consistently for same inputs', () => {
    const builder = new AssessmentContextBuilder('exec-1', '1.0.0', '2026-07-25T10:00:00Z');
    const context = builder.build();
    
    const id1 = context.generateDeterministicId({
      executionId: 'exec-1',
      policyVersion: '1.0.0',
      references: ['ref-A', 'ref-B'],
      content: 'test content'
    });

    const id2 = context.generateDeterministicId({
      executionId: 'exec-1',
      policyVersion: '1.0.0',
      references: ['ref-B', 'ref-A'], // Sorted internally
      content: 'test content'
    });

    expect(id1).toBe(id2);
  });

  it('should generate different IDs for different content', () => {
    const builder = new AssessmentContextBuilder('exec-1', '1.0.0', '2026-07-25T10:00:00Z');
    const context = builder.build();
    
    const id1 = context.generateDeterministicId({
      executionId: 'exec-1',
      policyVersion: '1.0.0',
      references: ['ref-A'],
      content: 'content A'
    });

    const id2 = context.generateDeterministicId({
      executionId: 'exec-1',
      policyVersion: '1.0.0',
      references: ['ref-A'],
      content: 'content B'
    });

    expect(id1).not.toBe(id2);
  });

  it('should enforce length and format constraints on hash (16 chars hex)', () => {
    const builder = new AssessmentContextBuilder('exec-1', '1.0.0', '2026-07-25T10:00:00Z');
    const context = builder.build();
    
    const id = context.generateDeterministicId({
      executionId: 'exec-1',
      policyVersion: '1.0.0',
      references: [],
      content: 'hash format test'
    });

    expect(id).toMatch(/^[0-9a-f]{16}$/);
  });
});
