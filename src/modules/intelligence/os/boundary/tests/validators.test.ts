import { describe, it, expect } from 'vitest';
import {
  createSafeInternalPayload,
  detectCircularOrDangerousKeys,
  estimateSizeInBytes,
  validateGovernedRequest,
} from '../validators';
import { GovernedBoundaryError } from '../errors';

describe('Boundary Validators', () => {
  it('validates a correct request successfully', () => {
    const validReq = {
      requestId: 'req-1',
      correlationId: 'corr-1',
      source: 'test-source',
      requestedMode: 'SHADOW_ONLY',
      tenant: { tenantId: 'tenant-1' },
      actor: { actorId: 'actor-1', actorType: 'USER' },
      payload: { data: 'test' },
    };

    const validated = validateGovernedRequest(validReq);
    expect(validated.requestId).toBe('req-1');
  });

  it('rejects null or non-object requests', () => {
    expect(() => validateGovernedRequest(null)).toThrow(GovernedBoundaryError);
    expect(() => validateGovernedRequest('invalid')).toThrow(GovernedBoundaryError);
  });

  it('rejects missing or empty requestId', () => {
    const req = {
      requestId: ' ',
      correlationId: 'corr-1',
      source: 'test',
      requestedMode: 'SHADOW_ONLY',
      tenant: { tenantId: 'tenant-1' },
      actor: { actorId: 'actor-1', actorType: 'USER' },
      payload: {},
    };
    expect(() => validateGovernedRequest(req)).toThrow(GovernedBoundaryError);
  });

  it('rejects missing or empty correlationId', () => {
    const req = {
      requestId: 'req-1',
      correlationId: '',
      source: 'test',
      requestedMode: 'SHADOW_ONLY',
      tenant: { tenantId: 'tenant-1' },
      actor: { actorId: 'actor-1', actorType: 'USER' },
      payload: {},
    };
    expect(() => validateGovernedRequest(req)).toThrow(GovernedBoundaryError);
  });

  it('rejects invalid or missing tenant context', () => {
    const reqNoTenant = {
      requestId: 'req-1',
      correlationId: 'corr-1',
      source: 'test',
      requestedMode: 'SHADOW_ONLY',
      tenant: { tenantId: '' },
      actor: { actorId: 'actor-1', actorType: 'USER' },
      payload: {},
    };
    expect(() => validateGovernedRequest(reqNoTenant)).toThrow(GovernedBoundaryError);
  });

  it('rejects invalid or missing actor context', () => {
    const reqNoActor = {
      requestId: 'req-1',
      correlationId: 'corr-1',
      source: 'test',
      requestedMode: 'SHADOW_ONLY',
      tenant: { tenantId: 't-1' },
      actor: { actorId: '', actorType: 'USER' },
      payload: {},
    };
    expect(() => validateGovernedRequest(reqNoActor)).toThrow(GovernedBoundaryError);
  });

  it('detects circular references in payloads', () => {
    const circularObj: Record<string, unknown> = { key: 'val' };
    circularObj.self = circularObj;

    const res = detectCircularOrDangerousKeys(circularObj);
    expect(res.safe).toBe(false);
    expect(res.reason).toContain('Circular reference');
  });

  it('detects prototype pollution attempts', () => {
    const dangerousObj = JSON.parse('{"__proto__": {"polluted": true}}') as Record<string, unknown>;
    const res = detectCircularOrDangerousKeys(dangerousObj);
    expect(res.safe).toBe(false);
    expect(res.reason).toContain('Dangerous property');
  });

  it('estimates size in bytes correctly', () => {
    const obj = { test: 'hello' };
    const bytes = estimateSizeInBytes(obj);
    expect(bytes).toBeGreaterThan(0);
  });

  it('creates a detached JSON-like payload copy', () => {
    const original = {
      industry: 'services',
      nested: { employeeBand: '10_50' },
      signals: [true, { priority: 'HIGH' }],
    };

    const copy = createSafeInternalPayload(original);
    const typedCopy = copy as {
      industry: string;
      nested: { employeeBand: string };
      signals: readonly [boolean, { priority: string }];
    };

    expect(copy).toEqual(original);
    expect(copy).not.toBe(original);
    expect(typedCopy.nested).not.toBe(original.nested);
    expect(typedCopy.signals).not.toBe(original.signals);
    expect(typedCopy.signals[1]).not.toBe(original.signals[1]);
  });

  it('does not preserve shared nested references in the internal copy', () => {
    const shared = { incidentSignal: true };
    const original = { first: shared, second: shared };
    const copy = createSafeInternalPayload(original) as {
      first: { incidentSignal: boolean };
      second: { incidentSignal: boolean };
    };

    expect(copy.first).toEqual(shared);
    expect(copy.second).toEqual(shared);
    expect(copy.first).not.toBe(shared);
    expect(copy.second).not.toBe(shared);
    expect(copy.first).not.toBe(copy.second);
  });

  it('rejects functions at every payload level', () => {
    expect(() => createSafeInternalPayload(() => 'not-json')).toThrow(GovernedBoundaryError);
    expect(() => createSafeInternalPayload({ nested: { callback: () => 'not-json' } })).toThrow(
      GovernedBoundaryError
    );
  });

  it('rejects symbols and bigint values', () => {
    expect(() => createSafeInternalPayload(Symbol('not-json'))).toThrow(GovernedBoundaryError);
    expect(() => createSafeInternalPayload({ count: BigInt(1) })).toThrow(GovernedBoundaryError);
  });

  it('rejects class instances', () => {
    class CustomPayload {
      public readonly value = 'not-plain';
    }

    expect(() => createSafeInternalPayload(new CustomPayload())).toThrow(GovernedBoundaryError);
  });

  it('rejects __proto__, constructor and prototype keys', () => {
    const protoPayload = JSON.parse('{"__proto__":{"polluted":true}}') as Record<string, unknown>;
    const constructorPayload = JSON.parse('{"constructor":{"polluted":true}}') as Record<string, unknown>;
    const prototypePayload = JSON.parse('{"prototype":{"polluted":true}}') as Record<string, unknown>;

    expect(() => createSafeInternalPayload(protoPayload)).toThrow(GovernedBoundaryError);
    expect(() => createSafeInternalPayload(constructorPayload)).toThrow(GovernedBoundaryError);
    expect(() => createSafeInternalPayload(prototypePayload)).toThrow(GovernedBoundaryError);
  });

  it('rejects excessive nesting depth', () => {
    const root: Record<string, unknown> = {};
    let cursor = root;
    for (let depth = 0; depth < 22; depth++) {
      const next: Record<string, unknown> = {};
      cursor.next = next;
      cursor = next;
    }

    expect(() => createSafeInternalPayload(root)).toThrow(GovernedBoundaryError);
  });

  it('rejects accessors without invoking them', () => {
    let getterCalls = 0;
    const payload: Record<string, unknown> = {};
    Object.defineProperty(payload, 'secret', {
      enumerable: true,
      get: () => {
        getterCalls += 1;
        return 'must-not-be-read';
      },
    });

    expect(() => createSafeInternalPayload(payload)).toThrow(GovernedBoundaryError);
    expect(getterCalls).toBe(0);
  });
});

export default describe;
