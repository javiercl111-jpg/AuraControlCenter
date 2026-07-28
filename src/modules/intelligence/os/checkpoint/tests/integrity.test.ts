import { describe, expect, it } from 'vitest';
import {
  canonicalizeFingerprintInput,
  createDeterministicFingerprint,
  isCheckpointFingerprint,
} from '..';

describe('AI-02C.3B deterministic checkpoint fingerprints', () => {
  it('25. produces the same fingerprint deterministically', () => {
    const input = { stage: 'MENTAL_MODEL', count: 2 };
    expect(createDeterministicFingerprint(input))
      .toBe(createDeterministicFingerprint(input));
  });

  it('26. changes the fingerprint when the input changes', () => {
    expect(createDeterministicFingerprint({ count: 1 }))
      .not.toBe(createDeterministicFingerprint({ count: 2 }));
  });

  it('27. ignores object property insertion order', () => {
    const left = { alpha: 1, beta: { one: true, two: false } };
    const right = { beta: { two: false, one: true }, alpha: 1 };

    expect(createDeterministicFingerprint(left))
      .toBe(createDeterministicFingerprint(right));
  });

  it('28. ignores array order only under explicit SET semantics', () => {
    const left = { refs: ['evidence-b', 'evidence-a'] };
    const right = { refs: ['evidence-a', 'evidence-b'] };

    expect(
      createDeterministicFingerprint(left, { arraySemantics: 'SET' })
    ).toBe(
      createDeterministicFingerprint(right, { arraySemantics: 'SET' })
    );
    expect(createDeterministicFingerprint(left))
      .not.toBe(createDeterministicFingerprint(right));
  });

  it('29. preserves semantically different values', () => {
    expect(createDeterministicFingerprint({ value: false }))
      .not.toBe(createDeterministicFingerprint({ value: 0 }));
  });

  it('30. returns the versioned fp:v1 digest format', () => {
    const fingerprint = createDeterministicFingerprint({ stable: true });
    expect(fingerprint).toMatch(/^fp:v1:[0-9a-f]{32}$/);
    expect(isCheckpointFingerprint(fingerprint)).toBe(true);
  });

  it('31. does not mutate fingerprint input', () => {
    const input = {
      refs: ['evidence-b', 'evidence-a'],
      nested: { value: 1 },
    };
    const before = JSON.stringify(input);

    createDeterministicFingerprint(input, { arraySemantics: 'SET' });

    expect(JSON.stringify(input)).toBe(before);
  });

  it('32. rejects non-serializable values', () => {
    expect(() =>
      createDeterministicFingerprint({ callback: () => undefined })
    ).toThrowError(
      expect.objectContaining({
        issue: 'UNSUPPORTED_VALUE',
      })
    );
  });

  it('33. rejects cyclic objects', () => {
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;

    expect(() => createDeterministicFingerprint(cyclic)).toThrowError(
      expect.objectContaining({
        issue: 'CYCLIC_VALUE',
      })
    );
  });

  it('34. rejects undefined explicitly', () => {
    expect(() =>
      createDeterministicFingerprint({ value: undefined })
    ).toThrowError(
      expect.objectContaining({
        issue: 'UNDEFINED_VALUE',
      })
    );
  });

  it('35. preserves null explicitly and distinctly', () => {
    expect(canonicalizeFingerprintInput(null)).toBe('null');
    expect(createDeterministicFingerprint({ value: null }))
      .not.toBe(createDeterministicFingerprint({ value: 'null' }));
  });
});
