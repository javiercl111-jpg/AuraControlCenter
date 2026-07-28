import { describe, expect, it, vi } from 'vitest';
import { GovernedExecutionBoundary } from '../GovernedExecutionBoundary';
import type {
  BoundaryAuditPort,
  BoundaryClockPort,
  BoundaryExecutionPort,
  FeaturePolicyPort,
  InternalExecutionInput,
  InternalExecutionResult,
} from '../ports';
import {
  AUTHORITATIVE_BOUNDARY_POLICY_SCHEMA_VERSION,
  BOUNDARY_INVOCATION_CONTEXT_VERSION,
  type AuthoritativeBoundaryPolicyAllowedDecisionV1,
  type AuthoritativeBoundaryPolicyDecisionV1,
  type AuthoritativeBoundaryPolicyDenialReasonCodeV1,
  type AuthoritativeBoundaryPolicyQueryV1,
  type BoundaryInvocationContextV1,
  type GovernedExecutionRequest,
} from '../types';

function createRequest(
  overrides: Partial<GovernedExecutionRequest> = {}
): GovernedExecutionRequest {
  return {
    requestId: 'request-1',
    correlationId: 'correlation-1',
    tenant: { tenantId: 'tenant-1' },
    actor: { actorId: 'actor-1', actorType: 'SERVICE' },
    source: 'trusted-adapter',
    requestedMode: 'SHADOW_ONLY',
    payload: { fact: 'value' },
    ...overrides,
  };
}

function createInvocationContext(
  overrides: Partial<BoundaryInvocationContextV1> = {}
): BoundaryInvocationContextV1 {
  return {
    schemaVersion: BOUNDARY_INVOCATION_CONTEXT_VERSION,
    tenantId: 'tenant-1',
    actor: {
      actorType: 'SERVICE',
      actorId: 'actor-1',
    },
    consumerId: 'consumer-1',
    source: 'trusted-adapter',
    requestId: 'request-1',
    correlationId: 'correlation-1',
    ...overrides,
  };
}

function createAllowedDecision(
  query: AuthoritativeBoundaryPolicyQueryV1,
  overrides: Partial<AuthoritativeBoundaryPolicyAllowedDecisionV1> = {}
): AuthoritativeBoundaryPolicyAllowedDecisionV1 {
  const effectiveExecutionMode =
    query.requestedMode === 'EVALUATION'
      ? 'EVALUATION'
      : 'SHADOW_ONLY';
  return {
    schemaVersion:
      AUTHORITATIVE_BOUNDARY_POLICY_SCHEMA_VERSION,
    authorizationPolicyVersion: 'policy:v1:test',
    evaluatedTenantId: query.tenantId,
    evaluatedConsumerId: query.consumerId,
    evaluatedSource: query.source,
    evaluatedActor: query.actor,
    requestedMode: query.requestedMode,
    decision: 'ALLOWED',
    reasonCode: 'POLICY_ALLOWED',
    effectiveExecutionMode,
    effectiveTimeoutMs: 30_000,
    ...overrides,
  };
}

function createDeniedDecision(
  query: AuthoritativeBoundaryPolicyQueryV1,
  reasonCode: AuthoritativeBoundaryPolicyDenialReasonCodeV1
): AuthoritativeBoundaryPolicyDecisionV1 {
  return {
    schemaVersion:
      AUTHORITATIVE_BOUNDARY_POLICY_SCHEMA_VERSION,
    authorizationPolicyVersion: 'policy:v1:test',
    evaluatedTenantId: query.tenantId,
    evaluatedConsumerId: query.consumerId,
    evaluatedSource: query.source,
    evaluatedActor: query.actor,
    requestedMode: query.requestedMode,
    decision: 'DENIED',
    reasonCode,
  };
}

type PolicyHandler = (
  query: AuthoritativeBoundaryPolicyQueryV1
) =>
  | AuthoritativeBoundaryPolicyDecisionV1
  | Promise<AuthoritativeBoundaryPolicyDecisionV1>;

type ExecutionHandler = (
  input: InternalExecutionInput,
  signal?: AbortSignal
) => InternalExecutionResult | Promise<InternalExecutionResult>;

function createHarness(options: {
  readonly policyHandler?: PolicyHandler;
  readonly executionHandler?: ExecutionHandler;
  readonly clock?: BoundaryClockPort;
  readonly auditImplementation?: BoundaryAuditPort['logEvent'];
} = {}) {
  const policyHandler: PolicyHandler =
    options.policyHandler ??
    ((query) => createAllowedDecision(query));
  const evaluateAuthoritativePolicy = vi.fn(
    async (query: AuthoritativeBoundaryPolicyQueryV1) =>
      policyHandler(query)
  );
  const getEffectivePolicy = vi.fn(async () => {
    throw new Error('Legacy policy path must not be used');
  });
  const featurePolicyPort: FeaturePolicyPort = {
    getEffectivePolicy,
    evaluateAuthoritativePolicy,
  };
  const executionHandler: ExecutionHandler =
    options.executionHandler ??
    ((input) => ({
      executionId: 'execution-1',
      sessionId: input.sessionId,
      status: 'SUCCEEDED',
      rawData: { result: 'ok' },
    }));
  const execute = vi.fn(
    async (input: InternalExecutionInput, signal?: AbortSignal) =>
      executionHandler(input, signal)
  );
  const executionPort: BoundaryExecutionPort = { execute };
  const logEvent = vi.fn(
    options.auditImplementation ??
      (async () => undefined)
  );
  const auditPort: BoundaryAuditPort = { logEvent };
  const clock =
    options.clock ??
    ({
      now: vi
        .fn()
        .mockReturnValue('2026-07-28T12:00:00.000Z'),
    } satisfies BoundaryClockPort);
  const boundary = new GovernedExecutionBoundary({
    clockPort: clock,
    featurePolicyPort,
    executionPort,
    auditPort,
  });

  return {
    boundary,
    evaluateAuthoritativePolicy,
    getEffectivePolicy,
    execute,
    logEvent,
  };
}

function auditEvents(
  logEvent: ReturnType<typeof vi.fn>
): string[] {
  return logEvent.mock.calls.map(([eventName]) =>
    String(eventName)
  );
}

const boundarySources = import.meta.glob('../*.ts', {
  eager: true,
  query: '?raw',
  import: 'default',
});
const boundarySourceText = Object.values(boundarySources).join('\n');

describe('AI-02H0B authoritative boundary enforcement', () => {
  it('1. dispatches a valid authoritative invocation', async () => {
    const harness = createHarness();

    const response = await harness.boundary.execute(
      createRequest(),
      createInvocationContext()
    );

    expect(response.status).toBe('COMPLETED');
    expect(harness.execute).toHaveBeenCalledOnce();
  });

  it('2. propagates authoritativeContext to the execution port', async () => {
    const harness = createHarness();

    await harness.boundary.execute(
      createRequest(),
      createInvocationContext()
    );

    const input = harness.execute.mock.calls[0][0];
    expect(input.authoritativeContext).toEqual({
      schemaVersion: '1',
      tenantId: 'tenant-1',
      actor: {
        actorType: 'SERVICE',
        actorId: 'actor-1',
      },
      consumerId: 'consumer-1',
      source: 'trusted-adapter',
      requestId: 'request-1',
      correlationId: 'correlation-1',
      executionMode: 'SHADOW_ONLY',
      initiatedAt: '2026-07-28T12:00:00.000Z',
      authorizationPolicyVersion: 'policy:v1:test',
    });
  });

  it('3. freezes authoritativeContext and its actor', async () => {
    const harness = createHarness();

    await harness.boundary.execute(
      createRequest(),
      createInvocationContext()
    );

    const context =
      harness.execute.mock.calls[0][0].authoritativeContext;
    expect(Object.isFrozen(context)).toBe(true);
    expect(Object.isFrozen(context?.actor)).toBe(true);
  });

  it('4. snapshots the request before the policy await', async () => {
    let release:
      | ((decision: AuthoritativeBoundaryPolicyDecisionV1) => void)
      | undefined;
    let capturedQuery:
      | AuthoritativeBoundaryPolicyQueryV1
      | undefined;
    const pending = new Promise<AuthoritativeBoundaryPolicyDecisionV1>(
      (resolve) => {
        release = resolve;
      }
    );
    const harness = createHarness({
      policyHandler: (query) => {
        capturedQuery = query;
        return pending;
      },
    });
    const request = createRequest();
    const responsePromise = harness.boundary.execute(
      request,
      createInvocationContext()
    );
    await vi.waitFor(() =>
      expect(capturedQuery).toBeDefined()
    );

    (
      request.tenant as { tenantId: string }
    ).tenantId = 'mutated-tenant';
    if (!capturedQuery || !release) {
      throw new Error('Policy query was not captured');
    }
    release(createAllowedDecision(capturedQuery));
    const response = await responsePromise;

    expect(response.status).toBe('COMPLETED');
    expect(
      harness.execute.mock.calls[0][0].authoritativeContext
        ?.tenantId
    ).toBe('tenant-1');
  });

  it('5. snapshots the payload before the policy await', async () => {
    let release:
      | ((decision: AuthoritativeBoundaryPolicyDecisionV1) => void)
      | undefined;
    let capturedQuery:
      | AuthoritativeBoundaryPolicyQueryV1
      | undefined;
    const pending = new Promise<AuthoritativeBoundaryPolicyDecisionV1>(
      (resolve) => {
        release = resolve;
      }
    );
    const payload = { nested: { value: 'before' } };
    const harness = createHarness({
      policyHandler: (query) => {
        capturedQuery = query;
        return pending;
      },
    });
    const responsePromise = harness.boundary.execute(
      createRequest({ payload }),
      createInvocationContext()
    );
    await vi.waitFor(() =>
      expect(capturedQuery).toBeDefined()
    );

    payload.nested.value = 'after';
    if (!capturedQuery || !release) {
      throw new Error('Policy query was not captured');
    }
    release(createAllowedDecision(capturedQuery));
    await responsePromise;

    expect(harness.execute.mock.calls[0][0].payload).toEqual({
      nested: { value: 'before' },
    });
  });

  it('6. never obtains authority from metadata', async () => {
    const harness = createHarness();

    await harness.boundary.execute(
      createRequest({
        metadata: {
          tenantId: 'metadata-tenant',
          actorId: 'metadata-actor',
          executionMode: 'EVALUATION',
        },
      }),
      createInvocationContext()
    );

    const input = harness.execute.mock.calls[0][0];
    expect(input.metadata).toBeUndefined();
    expect(input.authoritativeContext?.tenantId).toBe('tenant-1');
  });

  it('7. rejects an absent invocation context', async () => {
    const harness = createHarness();

    const response = await harness.boundary.execute(createRequest());

    expect(response.status).toBe('REJECTED');
    expect(response.errors[0].code).toBe('INVALID_REQUEST');
  });

  it('8. does not query policy when context is absent', async () => {
    const harness = createHarness();

    await harness.boundary.execute(createRequest());

    expect(
      harness.evaluateAuthoritativePolicy
    ).not.toHaveBeenCalled();
  });

  it('9. does not invoke execution when context is absent', async () => {
    const harness = createHarness();

    await harness.boundary.execute(createRequest());

    expect(harness.execute).not.toHaveBeenCalled();
  });

  it('10. rejects a tenant mismatch', async () => {
    const harness = createHarness();

    const response = await harness.boundary.execute(
      createRequest(),
      createInvocationContext({ tenantId: 'tenant-2' })
    );

    expect(response.errors[0].code).toBe(
      'INVALID_TENANT_CONTEXT'
    );
    expect(harness.execute).not.toHaveBeenCalled();
  });

  it('11. rejects an actorId mismatch', async () => {
    const harness = createHarness();

    const response = await harness.boundary.execute(
      createRequest(),
      createInvocationContext({
        actor: {
          actorType: 'SERVICE',
          actorId: 'actor-2',
        },
      })
    );

    expect(response.errors[0].code).toBe(
      'INVALID_ACTOR_CONTEXT'
    );
  });

  it('12. rejects an actorType mismatch', async () => {
    const harness = createHarness();

    const response = await harness.boundary.execute(
      createRequest(),
      createInvocationContext({
        actor: {
          actorType: 'USER',
          actorId: 'actor-1',
        },
      })
    );

    expect(response.errors[0].code).toBe(
      'INVALID_ACTOR_CONTEXT'
    );
  });

  it('13. rejects a source mismatch', async () => {
    const harness = createHarness();

    const response = await harness.boundary.execute(
      createRequest(),
      createInvocationContext({ source: 'other-source' })
    );

    expect(response.errors[0].code).toBe('SOURCE_NOT_ALLOWED');
  });

  it('14. rejects a requestId mismatch', async () => {
    const harness = createHarness();

    const response = await harness.boundary.execute(
      createRequest(),
      createInvocationContext({ requestId: 'request-2' })
    );

    expect(response.errors[0].code).toBe('INVALID_REQUEST');
  });

  it('15. rejects a correlationId mismatch', async () => {
    const harness = createHarness();

    const response = await harness.boundary.execute(
      createRequest(),
      createInvocationContext({
        correlationId: 'correlation-2',
      })
    );

    expect(response.errors[0].code).toBe('INVALID_REQUEST');
  });

  it('16. permits identical duplicated request values', async () => {
    const harness = createHarness();

    const response = await harness.boundary.execute(
      createRequest(),
      createInvocationContext()
    );

    expect(response.status).toBe('COMPLETED');
  });

  it('17. accepts a matching reserved payload field as redundant data', async () => {
    const harness = createHarness();

    const response = await harness.boundary.execute(
      createRequest({
        payload: {
          tenantId: 'tenant-1',
          actor: {
            actorId: 'actor-1',
            actorType: 'SERVICE',
          },
          fact: 'value',
        },
      }),
      createInvocationContext()
    );

    expect(response.status).toBe('COMPLETED');
    expect(
      harness.execute.mock.calls[0][0].authoritativeContext
        ?.tenantId
    ).toBe('tenant-1');
  });

  it('18. rejects a contradictory reserved payload field', async () => {
    const harness = createHarness();

    const response = await harness.boundary.execute(
      createRequest({
        payload: {
          tenantId: 'spoofed-tenant',
        },
      }),
      createInvocationContext()
    );

    expect(response.errors[0].code).toBe(
      'INVALID_TENANT_CONTEXT'
    );
    expect(harness.evaluateAuthoritativePolicy).not.toHaveBeenCalled();
  });

  it('19. ignores metadata authority and removes it before dispatch', async () => {
    const harness = createHarness();

    await harness.boundary.execute(
      createRequest({
        metadata: {
          source: 'spoofed-source',
          consumerId: 'spoofed-consumer',
          safeLabel: 'preserved',
        },
      }),
      createInvocationContext()
    );

    expect(
      harness.evaluateAuthoritativePolicy.mock.calls[0][0]
    ).toEqual(
      expect.objectContaining({
        source: 'trusted-adapter',
        consumerId: 'consumer-1',
      })
    );
    expect(harness.execute.mock.calls[0][0].metadata).toEqual({
      safeLabel: 'preserved',
    });
  });

  it('20. dispatches an authorized consumer', async () => {
    const harness = createHarness();

    await harness.boundary.execute(
      createRequest(),
      createInvocationContext({ consumerId: 'consumer-approved' })
    );

    expect(
      harness.evaluateAuthoritativePolicy.mock.calls[0][0]
        .consumerId
    ).toBe('consumer-approved');
    expect(harness.execute).toHaveBeenCalledOnce();
  });

  it('21. rejects an unauthorized consumer', async () => {
    const harness = createHarness({
      policyHandler: (query) =>
        createDeniedDecision(query, 'CONSUMER_NOT_ALLOWED'),
    });

    const response = await harness.boundary.execute(
      createRequest(),
      createInvocationContext()
    );

    expect(response.errors[0].code).toBe('SOURCE_NOT_ALLOWED');
    expect(harness.execute).not.toHaveBeenCalled();
  });

  it('22. dispatches an allowed source', async () => {
    const harness = createHarness();

    const response = await harness.boundary.execute(
      createRequest(),
      createInvocationContext()
    );

    expect(response.status).toBe('COMPLETED');
    expect(
      harness.evaluateAuthoritativePolicy.mock.calls[0][0].source
    ).toBe('trusted-adapter');
  });

  it('23. rejects a source denied by policy', async () => {
    const request = createRequest({ source: 'blocked-source' });
    const context = createInvocationContext({
      source: 'blocked-source',
    });
    const harness = createHarness({
      policyHandler: (query) =>
        createDeniedDecision(query, 'SOURCE_NOT_ALLOWED'),
    });

    const response = await harness.boundary.execute(
      request,
      context
    );

    expect(response.errors[0].code).toBe('SOURCE_NOT_ALLOWED');
    expect(harness.execute).not.toHaveBeenCalled();
  });

  it('24. dispatches allowed SHADOW_ONLY', async () => {
    const harness = createHarness();

    const response = await harness.boundary.execute(
      createRequest({ requestedMode: 'SHADOW_ONLY' }),
      createInvocationContext()
    );

    expect(response.mode).toBe('SHADOW_ONLY');
    expect(response.status).toBe('COMPLETED');
  });

  it('25. dispatches allowed EVALUATION', async () => {
    const harness = createHarness();

    const response = await harness.boundary.execute(
      createRequest({ requestedMode: 'EVALUATION' }),
      createInvocationContext()
    );

    expect(response.mode).toBe('EVALUATION');
    expect(response.status).toBe('COMPLETED');
  });

  it('26. rejects PRODUCTIVE', async () => {
    const harness = createHarness();

    const response = await harness.boundary.execute(
      createRequest({ requestedMode: 'PRODUCTIVE' }),
      createInvocationContext()
    );

    expect(response.errors[0].code).toBe('MODE_NOT_ALLOWED');
    expect(harness.execute).not.toHaveBeenCalled();
  });

  it('27. never dispatches DISABLED', async () => {
    const harness = createHarness();

    const response = await harness.boundary.execute(
      createRequest({ requestedMode: 'DISABLED' }),
      createInvocationContext()
    );

    expect(response.errors[0].code).toBe('BOUNDARY_DISABLED');
    expect(harness.execute).not.toHaveBeenCalled();
  });

  it('28. rejects policy-driven mode escalation', async () => {
    const harness = createHarness({
      policyHandler: (query) =>
        createAllowedDecision(query, {
          effectiveExecutionMode: 'EVALUATION',
        }),
    });

    const response = await harness.boundary.execute(
      createRequest({ requestedMode: 'SHADOW_ONLY' }),
      createInvocationContext()
    );

    expect(response.errors[0].code).toBe('MODE_NOT_ALLOWED');
    expect(harness.execute).not.toHaveBeenCalled();
  });

  it('29. rejects a silent downgrade', async () => {
    const harness = createHarness({
      policyHandler: (query) =>
        createAllowedDecision(query, {
          effectiveExecutionMode: 'SHADOW_ONLY',
        }),
    });

    const response = await harness.boundary.execute(
      createRequest({ requestedMode: 'EVALUATION' }),
      createInvocationContext()
    );

    expect(response.errors[0].code).toBe('MODE_NOT_ALLOWED');
    expect(harness.execute).not.toHaveBeenCalled();
  });

  it('30. propagates the real policy version', async () => {
    const harness = createHarness({
      policyHandler: (query) =>
        createAllowedDecision(query, {
          authorizationPolicyVersion: 'policy:release:42',
        }),
    });

    await harness.boundary.execute(
      createRequest(),
      createInvocationContext()
    );

    expect(
      harness.execute.mock.calls[0][0].authoritativeContext
        ?.authorizationPolicyVersion
    ).toBe('policy:release:42');
  });

  it('31. obtains initiatedAt from the injected clock', async () => {
    const clock: BoundaryClockPort = {
      now: vi
        .fn()
        .mockReturnValue('2026-08-01T10:15:30.000Z'),
    };
    const harness = createHarness({ clock });

    await harness.boundary.execute(
      createRequest(),
      createInvocationContext()
    );

    expect(
      harness.execute.mock.calls[0][0].authoritativeContext
        ?.initiatedAt
    ).toBe('2026-08-01T10:15:30.000Z');
  });

  it('32. queries policy with the authoritative tenant', async () => {
    const harness = createHarness();

    await harness.boundary.execute(
      createRequest(),
      createInvocationContext()
    );

    expect(
      harness.evaluateAuthoritativePolicy.mock.calls[0][0].tenantId
    ).toBe('tenant-1');
  });

  it('33. queries policy with the authoritative consumer', async () => {
    const harness = createHarness();

    await harness.boundary.execute(
      createRequest(),
      createInvocationContext({ consumerId: 'consumer-42' })
    );

    expect(
      harness.evaluateAuthoritativePolicy.mock.calls[0][0]
        .consumerId
    ).toBe('consumer-42');
  });

  it('34. queries policy with the authoritative source', async () => {
    const request = createRequest({ source: 'server-adapter' });
    const context = createInvocationContext({
      source: 'server-adapter',
    });
    const harness = createHarness();

    await harness.boundary.execute(request, context);

    expect(
      harness.evaluateAuthoritativePolicy.mock.calls[0][0].source
    ).toBe('server-adapter');
  });

  it('35. queries policy with the authoritative actor', async () => {
    const request = createRequest({
      actor: { actorId: 'user-1', actorType: 'USER' },
    });
    const context = createInvocationContext({
      actor: { actorId: 'user-1', actorType: 'USER' },
    });
    const harness = createHarness();

    await harness.boundary.execute(request, context);

    expect(
      harness.evaluateAuthoritativePolicy.mock.calls[0][0].actor
    ).toEqual({ actorId: 'user-1', actorType: 'USER' });
  });

  it('36. gives the execution port only the effective mode', async () => {
    const harness = createHarness();

    await harness.boundary.execute(
      createRequest({ requestedMode: 'EVALUATION' }),
      createInvocationContext()
    );

    const input = harness.execute.mock.calls[0][0];
    expect(input.authoritativeContext?.executionMode).toBe(
      'EVALUATION'
    );
    expect(
      (input as unknown as Record<string, unknown>).requestedMode
    ).toBeUndefined();
  });

  it('37. audits request receipt', async () => {
    const harness = createHarness();

    await harness.boundary.execute(
      createRequest(),
      createInvocationContext()
    );

    expect(auditEvents(harness.logEvent)).toContain(
      'BOUNDARY_REQUEST_RECEIVED'
    );
  });

  it('38. audits validated context', async () => {
    const harness = createHarness();

    await harness.boundary.execute(
      createRequest(),
      createInvocationContext()
    );

    expect(auditEvents(harness.logEvent)).toContain(
      'BOUNDARY_CONTEXT_VALIDATED'
    );
  });

  it('39. audits tenant binding', async () => {
    const harness = createHarness();

    await harness.boundary.execute(
      createRequest(),
      createInvocationContext()
    );

    expect(auditEvents(harness.logEvent)).toContain(
      'BOUNDARY_TENANT_BOUND'
    );
  });

  it('40. audits actor binding', async () => {
    const harness = createHarness();

    await harness.boundary.execute(
      createRequest(),
      createInvocationContext()
    );

    expect(auditEvents(harness.logEvent)).toContain(
      'BOUNDARY_ACTOR_BOUND'
    );
  });

  it('41. audits resolved mode', async () => {
    const harness = createHarness();

    await harness.boundary.execute(
      createRequest(),
      createInvocationContext()
    );

    expect(auditEvents(harness.logEvent)).toContain(
      'BOUNDARY_MODE_RESOLVED'
    );
  });

  it('42. audits execution dispatch', async () => {
    const harness = createHarness();

    await harness.boundary.execute(
      createRequest(),
      createInvocationContext()
    );

    expect(auditEvents(harness.logEvent)).toContain(
      'BOUNDARY_EXECUTION_DISPATCHED'
    );
  });

  it('43. audits completion with the real executionId', async () => {
    const harness = createHarness();

    await harness.boundary.execute(
      createRequest(),
      createInvocationContext()
    );

    expect(harness.logEvent).toHaveBeenCalledWith(
      'BOUNDARY_EXECUTION_COMPLETED',
      expect.objectContaining({ executionId: 'execution-1' })
    );
  });

  it('44. audits context conflicts with a safe reason code', async () => {
    const harness = createHarness();

    await harness.boundary.execute(
      createRequest(),
      createInvocationContext({ tenantId: 'tenant-secret-2' })
    );

    expect(harness.logEvent).toHaveBeenCalledWith(
      'BOUNDARY_CONTEXT_CONFLICT',
      expect.objectContaining({
        reasonCode: 'BOUNDARY_TENANT_MISMATCH',
        conflictField: 'tenantId',
      })
    );
  });

  it('45. audits invocation rejection', async () => {
    const harness = createHarness();

    await harness.boundary.execute(createRequest());

    expect(harness.logEvent).toHaveBeenCalledWith(
      'BOUNDARY_INVOCATION_REJECTED',
      expect.objectContaining({
        reasonCode: 'BOUNDARY_CONTEXT_MISSING',
      })
    );
  });

  it('46. never includes payload in audit events', async () => {
    const marker = 'payload-secret-marker';
    const harness = createHarness();

    await harness.boundary.execute(
      createRequest({ payload: { fact: marker } }),
      createInvocationContext()
    );

    expect(JSON.stringify(harness.logEvent.mock.calls)).not.toContain(
      marker
    );
  });

  it('47. never includes claims or tokens in audit events', async () => {
    const harness = createHarness();

    await harness.boundary.execute(
      createRequest({
        metadata: {
          claims: 'claims-secret',
          token: 'token-secret',
        },
      }),
      createInvocationContext()
    );

    const serialized = JSON.stringify(harness.logEvent.mock.calls);
    expect(serialized).not.toContain('claims-secret');
    expect(serialized).not.toContain('token-secret');
  });

  it('48. observes rejected audit promises without failing execution', async () => {
    const harness = createHarness({
      auditImplementation: vi
        .fn()
        .mockRejectedValue(new Error('audit unavailable')),
    });

    const response = await harness.boundary.execute(
      createRequest(),
      createInvocationContext()
    );
    await Promise.resolve();

    expect(response.status).toBe('COMPLETED');
  });

  it('49. preserves the legacy response shape', async () => {
    const harness = createHarness();

    const response = await harness.boundary.execute(
      createRequest(),
      createInvocationContext()
    );

    expect(response).toEqual(
      expect.objectContaining({
        requestId: 'request-1',
        correlationId: 'correlation-1',
        mode: 'SHADOW_ONLY',
        status: 'COMPLETED',
        startedAt: expect.any(String),
        completedAt: expect.any(String),
        durationMs: expect.any(Number),
        warnings: expect.any(Array),
        errors: expect.any(Array),
      })
    );
    expect(
      (response as unknown as Record<string, unknown>)
        .authoritativeContext
    ).toBeUndefined();
  });

  it('50. honors cancellation before policy', async () => {
    const controller = new AbortController();
    controller.abort();
    const harness = createHarness();

    const response = await harness.boundary.execute(
      createRequest({ cancellationSignal: controller.signal }),
      createInvocationContext()
    );

    expect(response.status).toBe('CANCELLED');
    expect(
      harness.evaluateAuthoritativePolicy
    ).not.toHaveBeenCalled();
  });

  it('51. honors cancellation after policy', async () => {
    const controller = new AbortController();
    const harness = createHarness({
      policyHandler: (query) => {
        controller.abort();
        return createAllowedDecision(query);
      },
    });

    const response = await harness.boundary.execute(
      createRequest({ cancellationSignal: controller.signal }),
      createInvocationContext()
    );

    expect(response.status).toBe('CANCELLED');
    expect(harness.execute).not.toHaveBeenCalled();
  });

  it('52. rejects an elapsed timeout before dispatch', async () => {
    const start = '2026-07-28T12:00:00.000Z';
    const expired = '2026-07-28T12:00:00.101Z';
    const now = vi
      .fn()
      .mockReturnValueOnce(start)
      .mockReturnValueOnce(start)
      .mockReturnValueOnce(start)
      .mockReturnValueOnce(expired)
      .mockReturnValue(expired);
    const harness = createHarness({
      clock: { now },
      policyHandler: (query) =>
        createAllowedDecision(query, {
          effectiveTimeoutMs: 100,
        }),
    });

    const response = await harness.boundary.execute(
      createRequest({ timeoutMs: 100 }),
      createInvocationContext()
    );

    expect(response.status).toBe('TIMED_OUT');
    expect(harness.execute).not.toHaveBeenCalled();
  });

  it('53. does not mutate invocation context input', async () => {
    const context = createInvocationContext();
    const before = structuredClone(context);
    const harness = createHarness();

    await harness.boundary.execute(createRequest(), context);

    expect(context).toEqual(before);
    expect(Object.isFrozen(context)).toBe(false);
  });

  it('54. does not mutate raw request input', async () => {
    const request = createRequest({
      payload: { nested: { value: 'original' } },
      metadata: { safe: 'value' },
    });
    const before = structuredClone(request);
    const harness = createHarness();

    await harness.boundary.execute(
      request,
      createInvocationContext()
    );

    expect(request).toEqual(before);
    expect(Object.isFrozen(request)).toBe(false);
  });

  it('55. does not fall back to request tenant', async () => {
    const harness = createHarness();

    const response = await harness.boundary.execute(createRequest());

    expect(response.status).toBe('REJECTED');
    expect(
      harness.evaluateAuthoritativePolicy
    ).not.toHaveBeenCalled();
  });

  it('56. does not fall back to payload tenant', async () => {
    const harness = createHarness();

    const response = await harness.boundary.execute(
      createRequest({
        payload: {
          tenantId: 'payload-tenant',
        },
      })
    );

    expect(response.status).toBe('REJECTED');
    expect(
      harness.evaluateAuthoritativePolicy
    ).not.toHaveBeenCalled();
  });

  it('57. does not permit context-free SHADOW execution', async () => {
    const harness = createHarness();

    const response = await harness.boundary.execute(
      createRequest({ requestedMode: 'SHADOW_ONLY' })
    );

    expect(response.status).toBe('REJECTED');
    expect(harness.execute).not.toHaveBeenCalled();
  });

  it('58. keeps BoundaryExecutionPort contract compatible', async () => {
    let received: InternalExecutionInput | undefined;
    const executionPort: BoundaryExecutionPort = {
      execute: async (input) => {
        received = input;
        return {
          executionId: 'contract-execution',
          sessionId: input.sessionId,
          status: 'SUCCEEDED',
        };
      },
    };
    const policyPort: FeaturePolicyPort = {
      getEffectivePolicy: async () => undefined,
      evaluateAuthoritativePolicy: async (query) =>
        createAllowedDecision(query),
    };
    const boundary = new GovernedExecutionBoundary({
      clockPort: {
        now: () => '2026-07-28T12:00:00.000Z',
      },
      featurePolicyPort: policyPort,
      executionPort,
    });

    await boundary.execute(createRequest(), createInvocationContext());

    expect(received?.sessionId).toBe('correlation-1');
    expect(received?.authoritativeContext).toBeDefined();
  });

  it('59. introduces no Bootstrap imports', () => {
    expect(boundarySourceText).not.toMatch(
      /from\s+['"][^'"]*bootstrap/i
    );
  });

  it('60. introduces no Orchestrator imports', () => {
    expect(boundarySourceText).not.toContain(
      'AuraIntelligenceOrchestrator'
    );
  });

  it('61. introduces no Discovery imports', () => {
    const token = ['Dis', 'covery'].join('');
    expect(boundarySourceText).not.toMatch(new RegExp(token));
  });

  it('62. introduces no Firebase imports', () => {
    const token = ['fire', 'base'].join('');
    expect(boundarySourceText).not.toMatch(
      new RegExp(`from\\s+['"][^'"]*${token}`, 'i')
    );
  });

  it('63. introduces no React or UI imports', () => {
    expect(boundarySourceText).not.toMatch(
      /from\s+['"]react|\/components\/|\/ui\//i
    );
  });

  it('64. introduces no persistence or I/O', () => {
    expect(boundarySourceText).not.toMatch(
      /from\s+['"](?:node:)?fs|localStorage|indexedDB|fetch\s*\(/
    );
  });
});
