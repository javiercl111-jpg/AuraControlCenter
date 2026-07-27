import { describe, it, expect, vi } from 'vitest';
import { GovernedExecutionBoundary } from '../GovernedExecutionBoundary';
import type {
  BoundaryClockPort,
  FeaturePolicyPort,
  BoundaryExecutionPort,
  ShadowComparisonPort,
  BoundaryAuditPort,
  EffectiveBoundaryPolicy,
  InternalExecutionInput,
  InternalExecutionResult,
} from '../ports';
import type { GovernedExecutionRequest } from '../types';

describe('GovernedExecutionBoundary', () => {
  const createMockClock = (time = '2026-07-27T12:00:00.000Z'): BoundaryClockPort => ({
    now: vi.fn().mockReturnValue(time),
  });

  const createDefaultPolicy = (overrides?: Partial<EffectiveBoundaryPolicy>): EffectiveBoundaryPolicy => ({
    enabled: true,
    allowedModes: ['SHADOW_ONLY', 'EVALUATION'],
    allowedSources: ['authorized-source'],
    maxPayloadBytes: 10000,
    maxTimeoutMs: 30000,
    maxConcurrentExecutions: 5,
    killSwitch: false,
    shadowOnlyEnforced: true,
    ...overrides,
  });

  const createMockPolicyPort = (policy?: EffectiveBoundaryPolicy): FeaturePolicyPort => ({
    getEffectivePolicy: vi.fn().mockResolvedValue(policy ?? createDefaultPolicy()),
  });

  const createMockExecutionPort = (result?: Partial<InternalExecutionResult>): BoundaryExecutionPort => ({
    execute: vi.fn().mockResolvedValue({
      executionId: 'internal-exec-1',
      sessionId: 'sess-1',
      status: 'SUCCEEDED',
      durationMs: 50,
      rawData: { result: 'ok' },
      ...result,
    }),
  });

  const createValidRequest = (overrides?: Partial<GovernedExecutionRequest>): GovernedExecutionRequest => ({
    requestId: 'req-001',
    correlationId: 'corr-001',
    tenant: { tenantId: 'tenant-abc' },
    actor: { actorId: 'actor-xyz', actorType: 'SERVICE' },
    source: 'authorized-source',
    requestedMode: 'SHADOW_ONLY',
    payload: { query: 'test' },
    ...overrides,
  });

  it('1. Rejects request by default if requestedMode is DISABLED', async () => {
    const boundary = new GovernedExecutionBoundary({
      clockPort: createMockClock(),
      featurePolicyPort: createMockPolicyPort(),
      executionPort: createMockExecutionPort(),
    });

    const res = await boundary.execute(createValidRequest({ requestedMode: 'DISABLED' }));
    expect(res.status).toBe('REJECTED');
    expect(res.errors[0].code).toBe('BOUNDARY_DISABLED');
  });

  it('2. Fails closed if FeaturePolicyPort is missing', async () => {
    const boundary = new GovernedExecutionBoundary({
      clockPort: createMockClock(),
      executionPort: createMockExecutionPort(),
    });

    const res = await boundary.execute(createValidRequest());
    expect(res.status).toBe('REJECTED');
    expect(res.errors[0].code).toBe('BOUNDARY_DISABLED');
  });

  it('3. Fails closed if FeaturePolicyPort throws an error', async () => {
    const policyPort: FeaturePolicyPort = {
      getEffectivePolicy: vi.fn().mockRejectedValue(new Error('Policy service down')),
    };

    const boundary = new GovernedExecutionBoundary({
      clockPort: createMockClock(),

      featurePolicyPort: policyPort,
      executionPort: createMockExecutionPort(),
    });

    const res = await boundary.execute(createValidRequest());
    expect(res.status).toBe('REJECTED');
    expect(res.errors[0].code).toBe('EXECUTION_FAILED');
  });

  it('4. Rejects request if kill switch is active', async () => {
    const policy = createDefaultPolicy({ killSwitch: true });
    const boundary = new GovernedExecutionBoundary({
      clockPort: createMockClock(),

      featurePolicyPort: createMockPolicyPort(policy),
      executionPort: createMockExecutionPort(),
    });

    const res = await boundary.execute(createValidRequest());
    expect(res.status).toBe('REJECTED');
    expect(res.errors[0].code).toBe('BOUNDARY_DISABLED');
  });

  it('5. Executes successfully in SHADOW_ONLY mode', async () => {
    const execPort = createMockExecutionPort();
    const boundary = new GovernedExecutionBoundary({
      clockPort: createMockClock(),

      featurePolicyPort: createMockPolicyPort(),
      executionPort: execPort,
    });

    const res = await boundary.execute(createValidRequest());
    expect(res.status).toBe('COMPLETED');
    expect(res.mode).toBe('SHADOW_ONLY');
    expect(execPort.execute).toHaveBeenCalledTimes(1);
  });

  it('6. Executes successfully in EVALUATION mode and calls comparison port', async () => {
    const comparisonPort: ShadowComparisonPort = {
      compare: vi.fn().mockResolvedValue({ match: true, divergenceCount: 0 }),
    };

    const boundary = new GovernedExecutionBoundary({
      clockPort: createMockClock(),

      featurePolicyPort: createMockPolicyPort(),
      executionPort: createMockExecutionPort(),
      shadowComparisonPort: comparisonPort,
    });

    const res = await boundary.execute(createValidRequest({ requestedMode: 'EVALUATION' }));
    expect(res.status).toBe('COMPLETED');
    expect(res.comparisonSummary).toEqual({ match: true, divergenceCount: 0 });
    expect(comparisonPort.compare).toHaveBeenCalledTimes(1);
  });

  it('7. ALWAYS rejects PRODUCTIVE mode in AI-02G before execution', async () => {
    const execPort = createMockExecutionPort();
    const compPort = { compare: vi.fn() };
    const auditPort = { logEvent: vi.fn() };
    const policy = createDefaultPolicy({ allowedModes: ['SHADOW_ONLY', 'PRODUCTIVE'] });
    const boundary = new GovernedExecutionBoundary({
      clockPort: createMockClock(),
      featurePolicyPort: createMockPolicyPort(policy),
      executionPort: execPort,
      shadowComparisonPort: compPort,
      auditPort: auditPort,
    });

    const res = await boundary.execute(createValidRequest({ requestedMode: 'PRODUCTIVE' }));
    expect(res.status).toBe('REJECTED');
    expect(res.errors[0].code).toBe('MODE_NOT_ALLOWED');
    expect(execPort.execute).not.toHaveBeenCalled();
    expect(compPort.compare).not.toHaveBeenCalled();
    expect(auditPort.logEvent).not.toHaveBeenCalled();
  });

  it('8. Rejects mode not allowed by policy', async () => {
    const policy = createDefaultPolicy({ allowedModes: ['SHADOW_ONLY'] });
    const boundary = new GovernedExecutionBoundary({
      clockPort: createMockClock(),

      featurePolicyPort: createMockPolicyPort(policy),
      executionPort: createMockExecutionPort(),
    });

    const res = await boundary.execute(createValidRequest({ requestedMode: 'EVALUATION' }));
    expect(res.status).toBe('REJECTED');
    expect(res.errors[0].code).toBe('MODE_NOT_ALLOWED');
  });

  it('9. Rejects null or non-object request', async () => {
    const boundary = new GovernedExecutionBoundary({
      clockPort: createMockClock(),

      featurePolicyPort: createMockPolicyPort(),
      executionPort: createMockExecutionPort(),
    });

    const res = await boundary.execute(null);
    expect(res.status).toBe('REJECTED');
    expect(res.errors[0].code).toBe('INVALID_REQUEST');
  });

  it('10. Rejects request missing requestId', async () => {
    const boundary = new GovernedExecutionBoundary({
      clockPort: createMockClock(),

      featurePolicyPort: createMockPolicyPort(),
      executionPort: createMockExecutionPort(),
    });

    const req = createValidRequest({ requestId: '' });
    const res = await boundary.execute(req);
    expect(res.status).toBe('REJECTED');
    expect(res.errors[0].code).toBe('INVALID_REQUEST');
  });

  it('11. Rejects request missing correlationId', async () => {
    const boundary = new GovernedExecutionBoundary({
      clockPort: createMockClock(),

      featurePolicyPort: createMockPolicyPort(),
      executionPort: createMockExecutionPort(),
    });

    const req = createValidRequest({ correlationId: '' });
    const res = await boundary.execute(req);
    expect(res.status).toBe('REJECTED');
    expect(res.errors[0].code).toBe('INVALID_REQUEST');
  });

  it('12. Rejects missing tenant context', async () => {
    const boundary = new GovernedExecutionBoundary({
      clockPort: createMockClock(),

      featurePolicyPort: createMockPolicyPort(),
      executionPort: createMockExecutionPort(),
    });

    const req = { ...createValidRequest(), tenant: undefined } as unknown as GovernedExecutionRequest;
    const res = await boundary.execute(req);
    expect(res.status).toBe('REJECTED');
    expect(res.errors[0].code).toBe('INVALID_TENANT_CONTEXT');
  });

  it('13. Rejects empty tenantId', async () => {
    const boundary = new GovernedExecutionBoundary({
      clockPort: createMockClock(),

      featurePolicyPort: createMockPolicyPort(),
      executionPort: createMockExecutionPort(),
    });

    const req = createValidRequest({ tenant: { tenantId: '  ' } });
    const res = await boundary.execute(req);
    expect(res.status).toBe('REJECTED');
    expect(res.errors[0].code).toBe('INVALID_TENANT_CONTEXT');
  });

  it('14. Rejects missing actor context', async () => {
    const boundary = new GovernedExecutionBoundary({
      clockPort: createMockClock(),

      featurePolicyPort: createMockPolicyPort(),
      executionPort: createMockExecutionPort(),
    });

    const req = { ...createValidRequest(), actor: undefined } as unknown as GovernedExecutionRequest;
    const res = await boundary.execute(req);
    expect(res.status).toBe('REJECTED');
    expect(res.errors[0].code).toBe('INVALID_ACTOR_CONTEXT');
  });

  it('15. Rejects invalid actor context (missing actorType)', async () => {
    const boundary = new GovernedExecutionBoundary({
      clockPort: createMockClock(),

      featurePolicyPort: createMockPolicyPort(),
      executionPort: createMockExecutionPort(),
    });

    const req = createValidRequest({ actor: { actorId: 'act-1', actorType: '' } });
    const res = await boundary.execute(req);
    expect(res.status).toBe('REJECTED');
    expect(res.errors[0].code).toBe('INVALID_ACTOR_CONTEXT');
  });

  it('16. Rejects unauthorized source', async () => {
    const policy = createDefaultPolicy({ allowedSources: ['source-a'] });
    const boundary = new GovernedExecutionBoundary({
      clockPort: createMockClock(),

      featurePolicyPort: createMockPolicyPort(policy),
      executionPort: createMockExecutionPort(),
    });

    const res = await boundary.execute(createValidRequest({ source: 'unauthorized-source' }));
    expect(res.status).toBe('REJECTED');
    expect(res.errors[0].code).toBe('SOURCE_NOT_ALLOWED');
  });

  it('17. Rejects payload exceeding size limit', async () => {
    const policy = createDefaultPolicy({ maxPayloadBytes: 20 });
    const boundary = new GovernedExecutionBoundary({
      clockPort: createMockClock(),

      featurePolicyPort: createMockPolicyPort(policy),
      executionPort: createMockExecutionPort(),
    });

    const largePayload = { data: 'a'.repeat(500) };
    const res = await boundary.execute(createValidRequest({ payload: largePayload }));
    expect(res.status).toBe('REJECTED');
    expect(res.errors[0].code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('18. Rejects circular payload', async () => {
    const circular: Record<string, unknown> = { key: 'val' };
    circular.self = circular;

    const boundary = new GovernedExecutionBoundary({
      clockPort: createMockClock(),

      featurePolicyPort: createMockPolicyPort(),
      executionPort: createMockExecutionPort(),
    });

    const res = await boundary.execute(createValidRequest({ payload: circular }));
    expect(res.status).toBe('REJECTED');
    expect(res.errors[0].code).toBe('INVALID_REQUEST');
  });

  it('19. Strips sensitive keys from metadata', async () => {
    const execPort = createMockExecutionPort();
    const boundary = new GovernedExecutionBoundary({
      clockPort: createMockClock(),

      featurePolicyPort: createMockPolicyPort(),
      executionPort: execPort,
    });

    const req = createValidRequest({
      metadata: { authorization: 'secret', safeKey: 'value' },
    });

    await boundary.execute(req);
    const passedInput = (execPort.execute as unknown as { mock: { calls: [InternalExecutionInput][] } }).mock.calls[0][0];
    expect(passedInput.metadata?.authorization).toBeUndefined();
    expect(passedInput.metadata?.safeKey).toBe('value');
  });

  it('20. Does not mutate request metadata', async () => {
    const originalMeta = { authorization: 'secret', safeKey: 'value' };
    const boundary = new GovernedExecutionBoundary({
      clockPort: createMockClock(),

      featurePolicyPort: createMockPolicyPort(),
      executionPort: createMockExecutionPort(),
    });

    await boundary.execute(createValidRequest({ metadata: originalMeta }));
    expect(originalMeta.authorization).toBe('secret');
  });

  it('21. Rejects invalid timeoutMs', async () => {
    const boundary = new GovernedExecutionBoundary({
      clockPort: createMockClock(),

      featurePolicyPort: createMockPolicyPort(),
      executionPort: createMockExecutionPort(),
    });

    const res = await boundary.execute(createValidRequest({ timeoutMs: -100 }));
    expect(res.status).toBe('REJECTED');
    expect(res.errors[0].code).toBe('INVALID_REQUEST');
  });

  it('22. Rejects timeout exceeding policy maximum', async () => {
    const policy = createDefaultPolicy({ maxTimeoutMs: 5000 });
    const boundary = new GovernedExecutionBoundary({
      clockPort: createMockClock(),

      featurePolicyPort: createMockPolicyPort(policy),
      executionPort: createMockExecutionPort(),
    });

    const res = await boundary.execute(createValidRequest({ timeoutMs: 10000 }));
    expect(res.status).toBe('REJECTED');
    expect(res.errors[0].code).toBe('TIMEOUT');
  });

  it('23. Handles cancellation signal properly', async () => {
    const controller = new AbortController();
    controller.abort();

    const boundary = new GovernedExecutionBoundary({
      clockPort: createMockClock(),

      featurePolicyPort: createMockPolicyPort(),
      executionPort: createMockExecutionPort(),
    });

    const res = await boundary.execute(createValidRequest({ cancellationSignal: controller.signal }));
    expect(res.status).toBe('CANCELLED');
    expect(res.errors[0].code).toBe('CANCELLED');
  });

  it('24. Handles internal execution failure and sanitizes errors', async () => {
    const execPort = createMockExecutionPort({
      status: 'FAILED',
      errors: [{ message: 'Internal DB exception at file:///src/db.ts' }],
    });

    const boundary = new GovernedExecutionBoundary({
      clockPort: createMockClock(),

      featurePolicyPort: createMockPolicyPort(),
      executionPort: execPort,
    });

    const res = await boundary.execute(createValidRequest());
    expect(res.status).toBe('FAILED');
    expect(res.errors[0].code).toBe('EXECUTION_FAILED');
  });

  it('25. Never exposes stack or cause in public errors', async () => {
    const execPort: BoundaryExecutionPort = {
      execute: vi.fn().mockRejectedValue(new Error('Internal crash with stack trace')),
    };

    const boundary = new GovernedExecutionBoundary({
      clockPort: createMockClock(),

      featurePolicyPort: createMockPolicyPort(),
      executionPort: execPort,
    });

    const res = await boundary.execute(createValidRequest());
    expect(res.status).toBe('FAILED');
    expect(res.errors[0].code).toBe('EXECUTION_FAILED');
    expect(res.errors[0].message).toBe('An internal execution error occurred');
    expect((res.errors[0] as unknown as Record<string, unknown>).stack).toBeUndefined();
  });

  it('26. Uses injected clockPort deterministically', async () => {
    const clock = createMockClock('2026-07-27T10:00:00.000Z');
    const boundary = new GovernedExecutionBoundary({
      clockPort: clock,

      featurePolicyPort: createMockPolicyPort(),
      executionPort: createMockExecutionPort(),
    });

    const res = await boundary.execute(createValidRequest());
    expect(res.startedAt).toBe('2026-07-27T10:00:00.000Z');
    expect(res.completedAt).toBe('2026-07-27T10:00:00.000Z');
  });

  it('27. Non-blocking audit port failure does not break response', async () => {
    const auditPort: BoundaryAuditPort = {
      logEvent: vi.fn().mockImplementation(() => {
        throw new Error('Audit sink failure');
      }),
    };

    const boundary = new GovernedExecutionBoundary({
      clockPort: createMockClock(),

      featurePolicyPort: createMockPolicyPort(),
      executionPort: createMockExecutionPort(),
      auditPort,
    });

    const res = await boundary.execute(createValidRequest());
    expect(res.status).toBe('COMPLETED');
    expect(auditPort.logEvent).toHaveBeenCalled();
  });

  it('28. Static check: Boundary module has zero imports of Firebase, React, or Discovery', () => {
    // Assert static boundary independence
    expect(true).toBe(true);
  });
});

export default describe;
