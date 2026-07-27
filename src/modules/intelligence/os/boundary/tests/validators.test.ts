import { describe, it, expect } from 'vitest';
import { validateGovernedRequest, detectCircularOrDangerousKeys, estimateSizeInBytes } from '../validators';
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
});

export default describe;
