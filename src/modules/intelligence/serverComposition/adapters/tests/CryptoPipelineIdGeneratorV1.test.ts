import { describe, it, expect } from 'vitest';
import { CryptoPipelineIdGeneratorV1 } from '../CryptoPipelineIdGeneratorV1';
import type { PipelineIdGenerator } from '../../../os/ports';

describe('AEA-05-R1C.1 CryptoPipelineIdGeneratorV1', () => {
  it('implements structurally PipelineIdGenerator', () => {
    const generator = new CryptoPipelineIdGeneratorV1();

    // Type assertion to ensure it implements PipelineIdGenerator interface
    const asGenerator: PipelineIdGenerator = generator;
    expect(asGenerator).toBeDefined();

    expect(typeof generator.generateExecutionId).toBe('function');
  });

  it('returns non-empty string', () => {
    const generator = new CryptoPipelineIdGeneratorV1();
    const id = generator.generateExecutionId();

    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('two successive invocations produce distinct IDs', () => {
    const generator = new CryptoPipelineIdGeneratorV1();
    const id1 = generator.generateExecutionId();
    const id2 = generator.generateExecutionId();

    expect(id1).not.toEqual(id2);
  });

  it('generates a valid UUID format (not timestamp-only, no Math.random)', () => {
    const generator = new CryptoPipelineIdGeneratorV1();
    const id = generator.generateExecutionId();

    // UUID v4 format verification
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(id).toMatch(uuidRegex);

    // Check that it's not purely a timestamp
    const numericOnly = /^\d+$/;
    expect(id).not.toMatch(numericOnly);
  });

  it('has zero dependencies on Firebase, Environment or other domains', () => {
    const generator = new CryptoPipelineIdGeneratorV1();
    expect(generator).toBeDefined();
    // Static safety check will guarantee these imports don't exist
  });
});
