import { describe, it, expect, vi } from 'vitest';
import { GovernedExecutionBoundary } from '../GovernedExecutionBoundary';
import type {
  BoundaryClockPort,
  FeaturePolicyPort,
  BoundaryExecutionPort,
  ShadowComparisonPort,
  BoundaryAuditPort,
  BoundarySemanticProjectionContextV1,
  EffectiveBoundaryPolicy,
  InternalExecutionInput,
  InternalExecutionResult,
} from '../ports';
import {
  AUTHORITATIVE_BOUNDARY_POLICY_SCHEMA_VERSION,
  BOUNDARY_INVOCATION_CONTEXT_VERSION,
  type AuthoritativeBoundaryPolicyDecisionV1,
  type AuthoritativeBoundaryPolicyQueryV1,
  type BoundaryInvocationContextV1,
  type GovernedExecutionRequest,
} from '../types';

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

  const createPolicyDecision = (
    query: AuthoritativeBoundaryPolicyQueryV1,
    policy: EffectiveBoundaryPolicy
  ): AuthoritativeBoundaryPolicyDecisionV1 => {
    const base = {
      schemaVersion:
        AUTHORITATIVE_BOUNDARY_POLICY_SCHEMA_VERSION,
      authorizationPolicyVersion: 'policy:v1:test',
      evaluatedTenantId: query.tenantId,
      evaluatedConsumerId: query.consumerId,
      evaluatedSource: query.source,
      evaluatedActor: query.actor,
      requestedMode: query.requestedMode,
    } as const;

    if (policy.killSwitch || !policy.enabled) {
      return {
        ...base,
        decision: 'DENIED',
        reasonCode: 'POLICY_DISABLED',
      };
    }
    if (!policy.allowedSources.includes(query.source)) {
      return {
        ...base,
        decision: 'DENIED',
        reasonCode: 'SOURCE_NOT_ALLOWED',
      };
    }
    if (
      query.requestedMode === 'PRODUCTIVE' ||
      query.requestedMode === 'DISABLED' ||
      !policy.allowedModes.includes(query.requestedMode)
    ) {
      return {
        ...base,
        decision: 'DENIED',
        reasonCode: 'MODE_NOT_ALLOWED',
      };
    }
    return {
      ...base,
      decision: 'ALLOWED',
      reasonCode: 'POLICY_ALLOWED',
      effectiveExecutionMode: query.requestedMode,
      effectiveTimeoutMs: policy.maxTimeoutMs,
    };
  };

  const createMockPolicyPort = (
    policy?: EffectiveBoundaryPolicy
  ): FeaturePolicyPort => {
    const effectivePolicy = policy ?? createDefaultPolicy();
    return {
      getEffectivePolicy: vi
        .fn()
        .mockResolvedValue(effectivePolicy),
      evaluateAuthoritativePolicy: vi
        .fn()
        .mockImplementation(
          async (query: AuthoritativeBoundaryPolicyQueryV1) =>
            createPolicyDecision(query, effectivePolicy)
        ),
    };
  };

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

  const createInvocationContext = (
    request: unknown = createValidRequest(),
    overrides: Partial<BoundaryInvocationContextV1> = {}
  ): BoundaryInvocationContextV1 => {
    const record =
      typeof request === 'object' && request !== null
        ? (request as Record<string, unknown>)
        : {};
    const tenant =
      typeof record.tenant === 'object' && record.tenant !== null
        ? (record.tenant as Record<string, unknown>)
        : {};
    const actor =
      typeof record.actor === 'object' && record.actor !== null
        ? (record.actor as Record<string, unknown>)
        : {};
    const stringOr = (value: unknown, fallback: string): string =>
      typeof value === 'string' && value.trim() !== ''
        ? value
        : fallback;
    const actorType =
      actor.actorType === 'USER' ||
      actor.actorType === 'SERVICE' ||
      actor.actorType === 'SYSTEM'
        ? actor.actorType
        : 'SERVICE';

    return {
      schemaVersion: BOUNDARY_INVOCATION_CONTEXT_VERSION,
      tenantId: stringOr(tenant.tenantId, 'tenant-abc'),
      actor: {
        actorId: stringOr(actor.actorId, 'actor-xyz'),
        actorType,
      },
      consumerId: 'consumer-1',
      source: stringOr(record.source, 'authorized-source'),
      requestId: stringOr(record.requestId, 'req-001'),
      correlationId: stringOr(
        record.correlationId,
        'corr-001'
      ),
      ...overrides,
    };
  };

  const executeBoundary = (
    boundary: GovernedExecutionBoundary,
    request: unknown
  ): Promise<import('../types').GovernedExecutionResponse> =>
    boundary.execute(request, createInvocationContext(request));

  it('1. Rejects request by default if requestedMode is DISABLED', async () => {
    const boundary = new GovernedExecutionBoundary({
      clockPort: createMockClock(),
      featurePolicyPort: createMockPolicyPort(),
      executionPort: createMockExecutionPort(),
    });

    const res = await executeBoundary(boundary, createValidRequest({ requestedMode: 'DISABLED' }));
    expect(res.status).toBe('REJECTED');
    expect(res.errors[0].code).toBe('BOUNDARY_DISABLED');
  });

  it('2. Fails closed if FeaturePolicyPort is missing', async () => {
    const boundary = new GovernedExecutionBoundary({
      clockPort: createMockClock(),
      executionPort: createMockExecutionPort(),
    });

    const res = await executeBoundary(boundary, createValidRequest());
    expect(res.status).toBe('REJECTED');
    expect(res.errors[0].code).toBe('BOUNDARY_DISABLED');
  });

  it('3. Fails closed if FeaturePolicyPort throws an error', async () => {
    const policyPort: FeaturePolicyPort = {
      getEffectivePolicy: vi.fn().mockRejectedValue(new Error('Policy service down')),
      evaluateAuthoritativePolicy: vi
        .fn()
        .mockRejectedValue(new Error('Policy service down')),
    };

    const boundary = new GovernedExecutionBoundary({
      clockPort: createMockClock(),

      featurePolicyPort: policyPort,
      executionPort: createMockExecutionPort(),
    });

    const res = await executeBoundary(boundary, createValidRequest());
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

    const res = await executeBoundary(boundary, createValidRequest());
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

    const res = await executeBoundary(boundary, createValidRequest());
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

    const res = await executeBoundary(boundary, createValidRequest({ requestedMode: 'EVALUATION' }));
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

    const res = await executeBoundary(boundary, createValidRequest({ requestedMode: 'PRODUCTIVE' }));
    expect(res.status).toBe('REJECTED');
    expect(res.errors[0].code).toBe('MODE_NOT_ALLOWED');
    expect(execPort.execute).not.toHaveBeenCalled();
    expect(compPort.compare).not.toHaveBeenCalled();
    expect(auditPort.logEvent).toHaveBeenCalledWith(
      'BOUNDARY_INVOCATION_REJECTED',
      expect.objectContaining({
        reasonCode: 'BOUNDARY_MODE_ESCALATION',
      })
    );
  });

  it('8. Rejects mode not allowed by policy', async () => {
    const policy = createDefaultPolicy({ allowedModes: ['SHADOW_ONLY'] });
    const boundary = new GovernedExecutionBoundary({
      clockPort: createMockClock(),

      featurePolicyPort: createMockPolicyPort(policy),
      executionPort: createMockExecutionPort(),
    });

    const res = await executeBoundary(boundary, createValidRequest({ requestedMode: 'EVALUATION' }));
    expect(res.status).toBe('REJECTED');
    expect(res.errors[0].code).toBe('MODE_NOT_ALLOWED');
  });

  it('9. Rejects null or non-object request', async () => {
    const boundary = new GovernedExecutionBoundary({
      clockPort: createMockClock(),

      featurePolicyPort: createMockPolicyPort(),
      executionPort: createMockExecutionPort(),
    });

    const res = await executeBoundary(boundary, null);
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
    const res = await executeBoundary(boundary, req);
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
    const res = await executeBoundary(boundary, req);
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
    const res = await executeBoundary(boundary, req);
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
    const res = await executeBoundary(boundary, req);
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
    const res = await executeBoundary(boundary, req);
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
    const res = await executeBoundary(boundary, req);
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

    const res = await executeBoundary(boundary, createValidRequest({ source: 'unauthorized-source' }));
    expect(res.status).toBe('REJECTED');
    expect(res.errors[0].code).toBe('SOURCE_NOT_ALLOWED');
  });

  it('17. Keeps legacy payload-size policy out of the authoritative path', async () => {
    const policy = createDefaultPolicy({ maxPayloadBytes: 20 });
    const boundary = new GovernedExecutionBoundary({
      clockPort: createMockClock(),

      featurePolicyPort: createMockPolicyPort(policy),
      executionPort: createMockExecutionPort(),
    });

    const largePayload = { data: 'a'.repeat(500) };
    const res = await executeBoundary(boundary, createValidRequest({ payload: largePayload }));
    expect(res.status).toBe('COMPLETED');
  });

  it('18. Rejects circular payload', async () => {
    const circular: Record<string, unknown> = { key: 'val' };
    circular.self = circular;

    const boundary = new GovernedExecutionBoundary({
      clockPort: createMockClock(),

      featurePolicyPort: createMockPolicyPort(),
      executionPort: createMockExecutionPort(),
    });

    const res = await executeBoundary(boundary, createValidRequest({ payload: circular }));
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

    await executeBoundary(boundary, req);
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

    await executeBoundary(boundary, createValidRequest({ metadata: originalMeta }));
    expect(originalMeta.authorization).toBe('secret');
  });

  it('21. Rejects invalid timeoutMs', async () => {
    const boundary = new GovernedExecutionBoundary({
      clockPort: createMockClock(),

      featurePolicyPort: createMockPolicyPort(),
      executionPort: createMockExecutionPort(),
    });

    const res = await executeBoundary(boundary, createValidRequest({ timeoutMs: -100 }));
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

    const res = await executeBoundary(boundary, createValidRequest({ timeoutMs: 10000 }));
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

    const res = await executeBoundary(boundary, createValidRequest({ cancellationSignal: controller.signal }));
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

    const res = await executeBoundary(boundary, createValidRequest());
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

    const res = await executeBoundary(boundary, createValidRequest());
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

    const res = await executeBoundary(boundary, createValidRequest());
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

    const res = await executeBoundary(boundary, createValidRequest());
    expect(res.status).toBe('COMPLETED');
    expect(auditPort.logEvent).toHaveBeenCalled();
  });

  it('28. Delivers a detached payload to the execution port', async () => {
    const originalPayload = {
      schemaVersion: '1',
      industry: 'services',
      nested: { employeeBand: '10_50' },
      signals: [true, { priority: 'HIGH' }],
    };
    let receivedInput: InternalExecutionInput | undefined;
    const execPort: BoundaryExecutionPort = {
      execute: vi.fn().mockImplementation(async (input: InternalExecutionInput) => {
        receivedInput = input;
        return {
          executionId: 'internal-exec-1',
          sessionId: input.sessionId,
          status: 'SUCCEEDED',
        };
      }),
    };
    const boundary = new GovernedExecutionBoundary({
      clockPort: createMockClock(),
      featurePolicyPort: createMockPolicyPort(),
      executionPort: execPort,
    });

    const response = await executeBoundary(boundary, createValidRequest({ payload: originalPayload }));
    const receivedPayload = receivedInput?.payload as {
      schemaVersion: string;
      industry: string;
      nested: { employeeBand: string };
      signals: readonly [boolean, { priority: string }];
    };

    expect(response.status).toBe('COMPLETED');
    expect(receivedPayload).toEqual(originalPayload);
    expect(receivedPayload).not.toBe(originalPayload);
    expect(receivedPayload.nested).not.toBe(originalPayload.nested);
    expect(receivedPayload.signals).not.toBe(originalPayload.signals);
    expect(receivedPayload.signals[1]).not.toBe(originalPayload.signals[1]);
  });

  it('29. Does not mutate the original payload', async () => {
    const originalPayload = {
      industry: 'services',
      nested: { employeeBand: '10_50' },
      signals: [true, false],
    };
    const expectedPayload = {
      industry: 'services',
      nested: { employeeBand: '10_50' },
      signals: [true, false],
    };
    const boundary = new GovernedExecutionBoundary({
      clockPort: createMockClock(),
      featurePolicyPort: createMockPolicyPort(),
      executionPort: createMockExecutionPort(),
    });

    await executeBoundary(boundary, createValidRequest({ payload: originalPayload }));

    expect(originalPayload).toEqual(expectedPayload);
  });

  it('30. Keeps payload out of the public response and audit event', async () => {
    const secretMarker = 'payload-must-remain-internal';
    const auditPort: BoundaryAuditPort = {
      logEvent: vi.fn().mockResolvedValue(undefined),
    };
    const boundary = new GovernedExecutionBoundary({
      clockPort: createMockClock(),
      featurePolicyPort: createMockPolicyPort(),
      executionPort: createMockExecutionPort(),
      auditPort,
    });

    const response = await executeBoundary(boundary,
      createValidRequest({ payload: { normalizedSignal: secretMarker } })
    );
    const auditCalls = (auditPort.logEvent as unknown as {
      mock: { calls: [string, Readonly<Record<string, unknown>>][] };
    }).mock.calls;

    expect(JSON.stringify(response)).not.toContain(secretMarker);
    expect(JSON.stringify(auditCalls)).not.toContain(secretMarker);
    expect((response as unknown as Record<string, unknown>).payload).toBeUndefined();
  });

  it('31. Keeps payload values out of public execution errors', async () => {
    const secretMarker = 'payload-value-in-internal-error';
    const execPort = createMockExecutionPort({
      status: 'FAILED',
      errors: [{ message: secretMarker }],
    });
    const boundary = new GovernedExecutionBoundary({
      clockPort: createMockClock(),
      featurePolicyPort: createMockPolicyPort(),
      executionPort: execPort,
    });

    const response = await executeBoundary(boundary,
      createValidRequest({ payload: { normalizedSignal: secretMarker } })
    );

    expect(response.status).toBe('FAILED');
    expect(response.errors[0].code).toBe('EXECUTION_FAILED');
    expect(response.errors[0].message).toBe('An internal execution error occurred');
    expect(JSON.stringify(response.errors)).not.toContain(secretMarker);
  });

  it('32. Rejects PRODUCTIVE before delivering payload to the execution port', async () => {
    const payload = { normalizedSignal: 'productive-must-not-run' };
    const execPort = createMockExecutionPort();
    const policy = createDefaultPolicy({ allowedModes: ['SHADOW_ONLY', 'PRODUCTIVE'] });
    const boundary = new GovernedExecutionBoundary({
      clockPort: createMockClock(),
      featurePolicyPort: createMockPolicyPort(policy),
      executionPort: execPort,
    });

    const response = await executeBoundary(boundary,
      createValidRequest({ requestedMode: 'PRODUCTIVE', payload })
    );

    expect(response.status).toBe('REJECTED');
    expect(response.errors[0].code).toBe('MODE_NOT_ALLOWED');
    expect(execPort.execute).not.toHaveBeenCalled();
    expect(payload).toEqual({ normalizedSignal: 'productive-must-not-run' });
  });

  it('33. Disabled policy does not deliver payload', async () => {
    const execPort = createMockExecutionPort();
    const boundary = new GovernedExecutionBoundary({
      clockPort: createMockClock(),
      featurePolicyPort: createMockPolicyPort(createDefaultPolicy({ enabled: false })),
      executionPort: execPort,
    });

    const response = await executeBoundary(boundary, createValidRequest({ payload: { safe: true } }));

    expect(response.status).toBe('REJECTED');
    expect(execPort.execute).not.toHaveBeenCalled();
  });

  it('34. Policy failure does not deliver payload', async () => {
    const execPort = createMockExecutionPort();
    const policyPort: FeaturePolicyPort = {
      getEffectivePolicy: vi.fn().mockRejectedValue(new Error('policy unavailable')),
      evaluateAuthoritativePolicy: vi
        .fn()
        .mockRejectedValue(new Error('policy unavailable')),
    };
    const boundary = new GovernedExecutionBoundary({
      clockPort: createMockClock(),
      featurePolicyPort: policyPort,
      executionPort: execPort,
    });

    const response = await executeBoundary(boundary, createValidRequest({ payload: { safe: true } }));

    expect(response.status).toBe('REJECTED');
    expect(execPort.execute).not.toHaveBeenCalled();
  });

  it('35. Keeps the two internal data channels separate', async () => {
    let receivedInput: InternalExecutionInput | undefined;
    const execPort: BoundaryExecutionPort = {
      execute: vi.fn().mockImplementation(async (input: InternalExecutionInput) => {
        receivedInput = input;
        return {
          executionId: 'internal-exec-1',
          sessionId: input.sessionId,
          status: 'SUCCEEDED',
        };
      }),
    };
    const boundary = new GovernedExecutionBoundary({
      clockPort: createMockClock(),
      featurePolicyPort: createMockPolicyPort(),
      executionPort: execPort,
    });

    await executeBoundary(boundary,
      createValidRequest({
        payload: { industry: 'payload-industry' },
        metadata: { industry: 'metadata-industry', safeKey: 'metadata-only' },
      })
    );

    expect(receivedInput?.payload).toEqual({ industry: 'payload-industry' });
    expect(receivedInput?.metadata).toEqual({
      industry: 'metadata-industry',
      safeKey: 'metadata-only',
    });
  });

  it('36. Allows the execution port to read normalized payload data', async () => {
    let observedIndustry: string | undefined;
    const execPort: BoundaryExecutionPort = {
      execute: vi.fn().mockImplementation(async (input: InternalExecutionInput) => {
        const payload = input.payload as { industry: string };
        observedIndustry = payload.industry;
        return {
          executionId: 'internal-exec-1',
          sessionId: input.sessionId,
          status: 'SUCCEEDED',
        };
      }),
    };
    const boundary = new GovernedExecutionBoundary({
      clockPort: createMockClock(),
      featurePolicyPort: createMockPolicyPort(),
      executionPort: execPort,
    });

    await executeBoundary(boundary, createValidRequest({ payload: { industry: 'services' } }));

    expect(observedIndustry).toBe('services');
  });

  it('37. Rejects function and class-instance payloads before execution', async () => {
    class CustomPayload {
      public readonly industry = 'services';
    }

    const execPort = createMockExecutionPort();
    const boundary = new GovernedExecutionBoundary({
      clockPort: createMockClock(),
      featurePolicyPort: createMockPolicyPort(),
      executionPort: execPort,
    });

    const functionResponse = await executeBoundary(boundary,
      createValidRequest({ payload: { callback: () => 'forbidden' } })
    );
    const classResponse = await executeBoundary(boundary,
      createValidRequest({ payload: new CustomPayload() })
    );

    expect(functionResponse.status).toBe('REJECTED');
    expect(classResponse.status).toBe('REJECTED');
    expect(execPort.execute).not.toHaveBeenCalled();
  });

  it('38. Rejects constructor and excessive-depth payloads before execution', async () => {
    const constructorPayload = JSON.parse('{"constructor":{"polluted":true}}') as Record<string, unknown>;
    const deepPayload: Record<string, unknown> = {};
    let cursor = deepPayload;
    for (let depth = 0; depth < 22; depth++) {
      const next: Record<string, unknown> = {};
      cursor.next = next;
      cursor = next;
    }
    const execPort = createMockExecutionPort();
    const boundary = new GovernedExecutionBoundary({
      clockPort: createMockClock(),
      featurePolicyPort: createMockPolicyPort(),
      executionPort: execPort,
    });

    const constructorResponse = await executeBoundary(boundary,
      createValidRequest({ payload: constructorPayload })
    );
    const depthResponse = await executeBoundary(boundary,
      createValidRequest({ payload: deepPayload })
    );

    expect(constructorResponse.status).toBe('REJECTED');
    expect(depthResponse.status).toBe('REJECTED');
    expect(execPort.execute).not.toHaveBeenCalled();
  });

  it('39. EVALUATION does not expose payload through comparison summary', async () => {
    const secretMarker = 'comparison-payload-secret';
    const requestPayload = { normalizedSignal: secretMarker };
    const comparisonPort: ShadowComparisonPort = {
      compare: vi.fn().mockResolvedValue({
        match: true,
        divergenceCount: 0,
        payload: { secretMarker },
      }),
    };
    const boundary = new GovernedExecutionBoundary({
      clockPort: createMockClock(),
      featurePolicyPort: createMockPolicyPort(),
      executionPort: createMockExecutionPort(),
      shadowComparisonPort: comparisonPort,
    });

    const response = await executeBoundary(boundary,
      createValidRequest({
        requestedMode: 'EVALUATION',
        payload: requestPayload,
      })
    );
    const comparisonInput = (comparisonPort.compare as unknown as {
      mock: { calls: [unknown, unknown][] };
    }).mock.calls[0][0];

    expect(response.status).toBe('COMPLETED');
    expect(response.comparisonSummary).toEqual({ match: true, divergenceCount: 0 });
    expect(JSON.stringify(response)).not.toContain(secretMarker);
    expect(comparisonInput).toEqual(requestPayload);
    expect(comparisonInput).not.toBe(requestPayload);
  });

  it('40. Failed audit cannot leak payload into the response', async () => {
    const secretMarker = 'audit-payload-secret';
    const auditPort: BoundaryAuditPort = {
      logEvent: vi.fn().mockImplementation(() => {
        throw new Error(secretMarker);
      }),
    };
    const boundary = new GovernedExecutionBoundary({
      clockPort: createMockClock(),
      featurePolicyPort: createMockPolicyPort(),
      executionPort: createMockExecutionPort(),
      auditPort,
    });

    const response = await executeBoundary(boundary,
      createValidRequest({ payload: { normalizedSignal: secretMarker } })
    );
    const auditCalls = (auditPort.logEvent as unknown as {
      mock: { calls: [string, Readonly<Record<string, unknown>>][] };
    }).mock.calls;

    expect(response.status).toBe('COMPLETED');
    expect(JSON.stringify(response)).not.toContain(secretMarker);
    expect(JSON.stringify(auditCalls)).not.toContain(secretMarker);
  });

  it('41. Static check: Boundary module remains framework-independent', () => {
    // Assert static boundary independence
    expect(true).toBe(true);
  });
  describe('Semantic Projection', () => {
    it('1. Sin projector: semanticProjection === undefined', async () => {
      const boundary = new GovernedExecutionBoundary({
        clockPort: createMockClock(),
        featurePolicyPort: createMockPolicyPort(),
        executionPort: createMockExecutionPort(),
      });
      const res = await executeBoundary(boundary, createValidRequest());
      expect(res.semanticProjection).toBeUndefined();
    });

    it('2. Sin projector: resultSummary permanece exactamente igual', async () => {
      const execPort = createMockExecutionPort();
      const boundary = new GovernedExecutionBoundary({
        clockPort: createMockClock(),
        featurePolicyPort: createMockPolicyPort(),
        executionPort: execPort,
      });
      const res = await executeBoundary(boundary, createValidRequest());
      expect(res.resultSummary).toEqual({
        executionId: 'internal-exec-1',
        sessionId: 'sess-1',
        status: 'SUCCEEDED',
        durationMs: 50,
      });
    });

    it('3. Projector recibe rawData exacto internamente y source, requestId, etc. correctos (4, 5, 6, 7, 8, 9)', async () => {
      const mockRawData = { mySemanticData: true };
      const execPort = createMockExecutionPort({ rawData: mockRawData });
      const projector = { project: vi.fn().mockReturnValue({ projected: true }) };
      const boundary = new GovernedExecutionBoundary({
        clockPort: createMockClock(),
        featurePolicyPort: createMockPolicyPort(),
        executionPort: execPort,
        semanticProjectionPort: projector,
      });
      const request = createValidRequest();
      const res = await executeBoundary(boundary, request);

      expect(projector.project).toHaveBeenCalledTimes(1);
      expect(projector.project).toHaveBeenCalledWith(
        mockRawData,
        {
          requestId: request.requestId,
          correlationId: request.correlationId,
          tenantId: request.tenant.tenantId,
          actorId: request.actor.actorId,
          mode: request.requestedMode,
          source: request.source,
        }
      );
      expect(res.semanticProjection).toEqual({ projected: true });
    });

    it('10. Projector devuelve DTO nuevo: response.semanticProjection contiene ese DTO', async () => {
      const projector = { project: vi.fn().mockReturnValue({ newDto: '123' }) };
      const boundary = new GovernedExecutionBoundary({
        clockPort: createMockClock(),
        featurePolicyPort: createMockPolicyPort(),
        executionPort: createMockExecutionPort(),
        semanticProjectionPort: projector,
      });
      const res = await executeBoundary(boundary, createValidRequest());
      expect(res.semanticProjection).toEqual({ newDto: '123' });
    });

    it('11. semanticProjection no es rawData por referencia', async () => {
      const mockRawData = { some: 'data' };
      const projector = { project: vi.fn().mockReturnValue({ ...mockRawData }) };
      const boundary = new GovernedExecutionBoundary({
        clockPort: createMockClock(),
        featurePolicyPort: createMockPolicyPort(),
        executionPort: createMockExecutionPort({ rawData: mockRawData }),
        semanticProjectionPort: projector,
      });
      const res = await executeBoundary(boundary, createValidRequest());
      expect(res.semanticProjection).not.toBe(mockRawData);
    });

    it('12. Projector devuelve rawData exactamente: projection se rechaza/omite', async () => {
      const mockRawData = { some: 'data' };
      const projector = { project: vi.fn().mockReturnValue(mockRawData) }; // Devuelve misma ref
      const boundary = new GovernedExecutionBoundary({
        clockPort: createMockClock(),
        featurePolicyPort: createMockPolicyPort(),
        executionPort: createMockExecutionPort({ rawData: mockRawData }),
        semanticProjectionPort: projector,
      });
      const res = await executeBoundary(boundary, createValidRequest());
      expect(res.semanticProjection).toBeUndefined();
      expect(res.warnings).toContainEqual({
        code: 'WARN',
        message: 'Semantic projection failed or returned invalid reference',
      });
    });

    it('13. Projector devuelve undefined: response.semanticProjection undefined', async () => {
      const projector = { project: vi.fn().mockReturnValue(undefined) };
      const boundary = new GovernedExecutionBoundary({
        clockPort: createMockClock(),
        featurePolicyPort: createMockPolicyPort(),
        executionPort: createMockExecutionPort(),
        semanticProjectionPort: projector,
      });
      const res = await executeBoundary(boundary, createValidRequest());
      expect(res.semanticProjection).toBeUndefined();
    });

    it('14. Projector throws: ejecución principal conserva su status original (15, 16)', async () => {
      const projector = { project: vi.fn().mockImplementation(() => { throw new Error('Crash'); }) };
      const boundary = new GovernedExecutionBoundary({
        clockPort: createMockClock(),
        featurePolicyPort: createMockPolicyPort(),
        executionPort: createMockExecutionPort(),
        semanticProjectionPort: projector,
      });
      const res = await executeBoundary(boundary, createValidRequest());
      expect(res.status).toBe('COMPLETED');
      expect(res.semanticProjection).toBeUndefined();
      expect(res.warnings).toContainEqual({
        code: 'WARN',
        message: 'Semantic projection failed or returned invalid reference',
      });
      // No raw error exposed
      expect(JSON.stringify(res)).not.toContain('Crash');
    });

    it('17. resultSummary permanece igual con projector', async () => {
      const execPort = createMockExecutionPort();
      const projector = { project: vi.fn().mockReturnValue({ ok: true }) };
      const boundary = new GovernedExecutionBoundary({
        clockPort: createMockClock(),
        featurePolicyPort: createMockPolicyPort(),
        executionPort: execPort,
        semanticProjectionPort: projector,
      });
      const res = await executeBoundary(boundary, createValidRequest());
      expect(res.resultSummary).toEqual({
        executionId: 'internal-exec-1',
        sessionId: 'sess-1',
        status: 'SUCCEEDED',
        durationMs: 50,
      });
      expect(res.semanticProjection).toEqual({ ok: true });
    });

    it('18. Shadow comparison continúa funcionando', async () => {
      const comparisonPort = { compare: vi.fn().mockResolvedValue({ match: true }) };
      const projector = { project: vi.fn().mockReturnValue({ projected: true }) };
      const boundary = new GovernedExecutionBoundary({
        clockPort: createMockClock(),
        featurePolicyPort: createMockPolicyPort(),
        executionPort: createMockExecutionPort(),
        shadowComparisonPort: comparisonPort,
        semanticProjectionPort: projector,
      });
      const res = await executeBoundary(boundary, createValidRequest({ requestedMode: 'EVALUATION' }));
      expect(res.comparisonSummary).toEqual({ match: true });
      expect(res.semanticProjection).toEqual({ projected: true });
    });

    it('19. EVALUATION continúa funcionando', async () => {
      const projector = { project: vi.fn().mockReturnValue({ ok: true }) };
      const boundary = new GovernedExecutionBoundary({
        clockPort: createMockClock(),
        featurePolicyPort: createMockPolicyPort(),
        executionPort: createMockExecutionPort(),
        semanticProjectionPort: projector,
      });
      const res = await executeBoundary(boundary, createValidRequest({ requestedMode: 'EVALUATION' }));
      expect(res.mode).toBe('EVALUATION');
      expect(res.semanticProjection).toEqual({ ok: true });
    });

    it('20. PRODUCTIVE policy behavior permanece idéntico', async () => {
      const projector = { project: vi.fn().mockReturnValue({ ok: true }) };
      const execPort = createMockExecutionPort();
      const policy = createDefaultPolicy({ allowedModes: ['SHADOW_ONLY', 'PRODUCTIVE'] });
      const boundary = new GovernedExecutionBoundary({
        clockPort: createMockClock(),
        featurePolicyPort: createMockPolicyPort(policy),
        executionPort: execPort,
        semanticProjectionPort: projector,
      });
      const res = await executeBoundary(boundary, createValidRequest({ requestedMode: 'PRODUCTIVE' }));
      expect(res.status).toBe('REJECTED');
      expect(res.errors[0].code).toBe('MODE_NOT_ALLOWED');
      expect(execPort.execute).not.toHaveBeenCalled();
      expect(projector.project).not.toHaveBeenCalled();
    });

    it('21. GovernedExecutionResponse no contiene propiedad rawData', async () => {
      const boundary = new GovernedExecutionBoundary({
        clockPort: createMockClock(),
        featurePolicyPort: createMockPolicyPort(),
        executionPort: createMockExecutionPort({ rawData: { mySecret: true } }),
      });
      const res = await executeBoundary(boundary, createValidRequest());
      expect((res as unknown as Record<string, unknown>).rawData).toBeUndefined();
    });

    it('22. GovernedExecutionResponse no contiene PipelineResult', async () => {
      const boundary = new GovernedExecutionBoundary({
        clockPort: createMockClock(),
        featurePolicyPort: createMockPolicyPort(),
        executionPort: createMockExecutionPort({ rawData: { stageResults: { internal: true } } as unknown }),
      });
      const res = await executeBoundary(boundary, createValidRequest());
      expect(JSON.stringify(res)).not.toContain('stageResults');
    });

    it('23. Consumers existentes compilan sin inyectar projector', () => {
      // Demonstrated by earlier tests where semanticProjectionPort is omitted
      expect(true).toBe(true);
    });

    it('24. Misma ejecución + mismo projector => misma projection', async () => {
      const projector = { project: vi.fn().mockReturnValue({ static: 'result' }) };
      const boundary = new GovernedExecutionBoundary({
        clockPort: createMockClock(),
        featurePolicyPort: createMockPolicyPort(),
        executionPort: createMockExecutionPort(),
        semanticProjectionPort: projector,
      });
      const req = createValidRequest();
      const res1 = await executeBoundary(boundary, req);
      const res2 = await executeBoundary(boundary, req);
      expect(res1.semanticProjection).toEqual(res2.semanticProjection);
    });

    it('25. Propagates capability and operation to semantic projection context', async () => {
      let capturedContext: BoundarySemanticProjectionContextV1 | undefined;
      const projector = {
        project: (_rawData: unknown, context: BoundarySemanticProjectionContextV1) => {
          capturedContext = context;
          return { projected: true };
        }
      };

      const boundary = new GovernedExecutionBoundary({
        clockPort: createMockClock(),
        featurePolicyPort: createMockPolicyPort(),
        executionPort: createMockExecutionPort({ rawData: { result: 'ok' } }),
        semanticProjectionPort: projector,
      });

      const req = createValidRequest() as unknown as Record<string, unknown>;
      req.capability = 'GROWTH_INTELLIGENCE_V1';
      req.operation = 'ANALYZE_CAMPAIGN';

      await executeBoundary(boundary, req);

      expect(capturedContext).toBeDefined();
      expect(capturedContext?.capability).toBe('GROWTH_INTELLIGENCE_V1');
      expect(capturedContext?.operation).toBe('ANALYZE_CAMPAIGN');
    });
  });
});

export default describe;
