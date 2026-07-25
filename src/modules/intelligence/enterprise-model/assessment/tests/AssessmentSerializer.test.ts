/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-expect-error Vitest ambient module types
import { describe, it, expect } from 'vitest';
import { AssessmentSerializer } from '../services/AssessmentSerializer';

describe('AssessmentSerializer', () => {
  const serializer = new AssessmentSerializer();

  it('should serialize objects deterministically regardless of property order', () => {
    const objA = { b: 2, a: 1 };
    const objB = { a: 1, b: 2 };

    const serializedA = serializer.serialize(objA as any);
    const serializedB = serializer.serialize(objB as any);

    expect(serializedA).toBe(serializedB);
    expect(serializedA).toBe('{"a":1,"b":2}');
  });

  it('should serialize nested objects deterministically', () => {
    const objA = { z: { b: 2, a: 1 }, c: 3 };
    const objB = { c: 3, z: { a: 1, b: 2 } };

    const serializedA = serializer.serialize(objA as any);
    const serializedB = serializer.serialize(objB as any);

    expect(serializedA).toBe(serializedB);
    expect(serializedA).toBe('{"c":3,"z":{"a":1,"b":2}}');
  });

  it('should serialize arrays deterministically keeping their order', () => {
    const objA = { arr: [{ b: 2, a: 1 }, { d: 4, c: 3 }] };
    const objB = { arr: [{ a: 1, b: 2 }, { c: 3, d: 4 }] };

    const serializedA = serializer.serialize(objA as any);
    const serializedB = serializer.serialize(objB as any);

    expect(serializedA).toBe(serializedB);
    expect(serializedA).toBe('{"arr":[{"a":1,"b":2},{"c":3,"d":4}]}');
  });

  it('should ignore undefined properties during serialization', () => {
    const objA = { a: 1, b: undefined };
    const serializedA = serializer.serialize(objA as any);

    expect(serializedA).toBe('{"a":1}');
  });
});
