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
  type AuthoritativeBoundaryPolicyQueryV1,
  type BoundaryInvocationContextV1,
  type GovernedExecutionRequest,
} from '../types';
import { validateAuthoritativeExecutionContextV1 } from '../validators';

const INGRESS_AT = '2026-07-28T12:00:00.000Z';

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

function createInvocationContext(): BoundaryInvocationContextV1 {
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
  };
}

function createAllowedDecision(
  query: AuthoritativeBoundaryPolicyQueryV1,
  overrides: Partial<AuthoritativeBoundaryPolicyAllowedDecisionV1> = {}
): AuthoritativeBoundaryPolicyAllowedDecisionV1 {
  return {
    schemaVersion:
      AUTHORITATIVE_BOUNDARY_POLICY_SCHEMA_VERSION,
    authorizationPolicyVersion: 'policy:v1:deadline',
    evaluatedTenantId: query.tenantId,
    evaluatedConsumerId: query.consumerId,
    evaluatedSource: query.source,
    evaluatedActor: query.actor,
    requestedMode: query.requestedMode,
    decision: 'ALLOWED',
    reasonCode: 'POLICY_ALLOWED',
    effectiveExecutionMode: 'SHADOW_ONLY',
    effectiveTimeoutMs: 30_000,
    ...overrides,
  };
}

type PolicyHandler = (
  query: AuthoritativeBoundaryPolicyQueryV1
) =>
  | AuthoritativeBoundaryPolicyDecisionV1
  | Promise<AuthoritativeBoundaryPolicyDecisionV1>;

function createClock(...timestamps: readonly string[]) {
  const fallback = timestamps.at(-1) ?? INGRESS_AT;
  const now = vi.fn(() => fallback);
  for (const timestamp of timestamps) {
    now.mockReturnValueOnce(timestamp);
  }
  return { now };
}

function createHarness(options: {
  readonly clock?: BoundaryClockPort;
  readonly policyHandler?: PolicyHandler;
  readonly auditImplementation?: BoundaryAuditPort['logEvent'];
} = {}) {
  const policyHandler: PolicyHandler =
    options.policyHandler ??
    ((query) => createAllowedDecision(query));
  const evaluateAuthoritativePolicy = vi.fn(
    async (query: AuthoritativeBoundaryPolicyQueryV1) =>
      policyHandler(query)
  );
  const featurePolicyPort: FeaturePolicyPort = {
    getEffectivePolicy: async () => undefined,
    evaluateAuthoritativePolicy,
  };
  const execute = vi.fn(
    async (
      input: InternalExecutionInput,
      _signal?: AbortSignal
    ): Promise<InternalExecutionResult> => ({
      executionId: 'execution-1',
      sessionId: input.sessionId,
      status: 'SUCCEEDED',
    })
  );
  const executionPort: BoundaryExecutionPort = { execute };
  const logEvent = vi.fn(
    options.auditImplementation ?? (async () => undefined)
  );
  const boundary = new GovernedExecutionBoundary({
    clockPort: options.clock ?? createClock(INGRESS_AT),
    featurePolicyPort,
    executionPort,
    auditPort: { logEvent },
  });
  return {
    boundary,
    evaluateAuthoritativePolicy,
    execute,
    logEvent,
  };
}

function createValidAuthoritativeContext() {
  return {
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
    initiatedAt: INGRESS_AT,
    authoritativeDeadlineAt: '2026-07-28T12:00:30.000Z',
    authorizationPolicyVersion: 'policy:v1:deadline',
  };
}

const boundarySources = import.meta.glob('../*.ts', {
  eager: true,
  query: '?raw',
  import: 'default',
});
const boundarySourceText = Object.values(boundarySources).join('\n');

describe('AI-02H0B.1 authoritative deadline propagation', () => {
  it('1. calculates the deadline from initiatedAt and policy timeout', async () => {
    const harness = createHarness();

    await harness.boundary.execute(
      createRequest(),
      createInvocationContext()
    );

    expect(
      harness.execute.mock.calls[0][0].authoritativeContext
        ?.authoritativeDeadlineAt
    ).toBe('2026-07-28T12:00:30.000Z');
  });

  it('2. obtains initiatedAt and deadline checks only from the injected clock', async () => {
    const clock = createClock(INGRESS_AT);
    const harness = createHarness({ clock });

    await harness.boundary.execute(
      createRequest(),
      createInvocationContext()
    );

    expect(clock.now).toHaveBeenCalled();
    expect(
      harness.execute.mock.calls[0][0].authoritativeContext
        ?.initiatedAt
    ).toBe(INGRESS_AT);
  });

  it('3. does not use ambient clocks or active schedulers', () => {
    expect(boundarySourceText).not.toMatch(/Date\.now\s*\(/);
    expect(boundarySourceText).not.toMatch(/new Date\s*\(\s*\)/);
    expect(boundarySourceText).not.toMatch(/performance\.now\s*\(/);
    expect(boundarySourceText).not.toMatch(/setTimeout\s*\(/);
    expect(boundarySourceText).not.toMatch(
      /new AbortController\s*\(/
    );
  });

  it('4. propagates the deadline to BoundaryExecutionPort', async () => {
    const harness = createHarness();

    await harness.boundary.execute(
      createRequest(),
      createInvocationContext()
    );

    expect(
      harness.execute.mock.calls[0][0].authoritativeContext
    ).toHaveProperty(
      'authoritativeDeadlineAt',
      '2026-07-28T12:00:30.000Z'
    );
  });

  it('5. freezes the deadline inside the authoritative context', async () => {
    const harness = createHarness();

    await harness.boundary.execute(
      createRequest(),
      createInvocationContext()
    );

    const context =
      harness.execute.mock.calls[0][0].authoritativeContext;
    expect(Object.isFrozen(context)).toBe(true);
    expect(context?.authoritativeDeadlineAt).toBe(
      '2026-07-28T12:00:30.000Z'
    );
  });

  it('6. produces an earlier deadline for a smaller policy timeout', async () => {
    const harness = createHarness({
      policyHandler: (query) =>
        createAllowedDecision(query, {
          effectiveTimeoutMs: 5_000,
        }),
    });

    await harness.boundary.execute(
      createRequest(),
      createInvocationContext()
    );

    expect(
      harness.execute.mock.calls[0][0].authoritativeContext
        ?.authoritativeDeadlineAt
    ).toBe('2026-07-28T12:00:05.000Z');
  });

  it('7. does not let a requested timeout replace the authoritative deadline', async () => {
    const harness = createHarness();

    await harness.boundary.execute(
      createRequest({ timeoutMs: 5_000 }),
      createInvocationContext()
    );

    expect(
      harness.execute.mock.calls[0][0].authoritativeContext
        ?.authoritativeDeadlineAt
    ).toBe('2026-07-28T12:00:30.000Z');
  });

  it('8. continues rejecting a requested timeout above the policy limit', async () => {
    const harness = createHarness();

    const response = await harness.boundary.execute(
      createRequest({ timeoutMs: 30_001 }),
      createInvocationContext()
    );

    expect(response.errors[0].code).toBe('TIMEOUT');
    expect(harness.execute).not.toHaveBeenCalled();
  });

  it('9. prevents dispatch when the deadline expires immediately before it', async () => {
    const deadline = '2026-07-28T12:00:30.000Z';
    const clock = createClock(
      INGRESS_AT,
      INGRESS_AT,
      INGRESS_AT,
      INGRESS_AT,
      deadline
    );
    const harness = createHarness({ clock });

    const response = await harness.boundary.execute(
      createRequest(),
      createInvocationContext()
    );

    expect(response.status).toBe('TIMED_OUT');
    expect(harness.execute).not.toHaveBeenCalled();
  });

  it('10. prevents dispatch when policy evaluation consumes the full deadline', async () => {
    const deadline = '2026-07-28T12:00:00.100Z';
    const clock = createClock(
      INGRESS_AT,
      INGRESS_AT,
      deadline
    );
    const harness = createHarness({
      clock,
      policyHandler: (query) =>
        createAllowedDecision(query, {
          effectiveTimeoutMs: 100,
        }),
    });

    const response = await harness.boundary.execute(
      createRequest(),
      createInvocationContext()
    );

    expect(response.status).toBe('TIMED_OUT');
    expect(harness.execute).not.toHaveBeenCalled();
  });

  it('11. permits dispatch while the authoritative deadline remains active', async () => {
    const harness = createHarness();

    const response = await harness.boundary.execute(
      createRequest(),
      createInvocationContext()
    );

    expect(response.status).toBe('COMPLETED');
    expect(harness.execute).toHaveBeenCalledTimes(1);
  });

  it('12. fails closed when deadline arithmetic exceeds the Date range', async () => {
    const maximumDate = '+275760-09-13T00:00:00.000Z';
    const harness = createHarness({
      clock: createClock(maximumDate),
      policyHandler: (query) =>
        createAllowedDecision(query, {
          effectiveTimeoutMs: 1,
        }),
    });

    const response = await harness.boundary.execute(
      createRequest(),
      createInvocationContext()
    );

    expect(response.status).toBe('REJECTED');
    expect(response.errors[0].code).toBe('INVALID_REQUEST');
    expect(harness.execute).not.toHaveBeenCalled();
  });

  it('13. fails closed for a NaN policy timeout', async () => {
    const harness = createHarness({
      policyHandler: (query) =>
        createAllowedDecision(query, {
          effectiveTimeoutMs: Number.NaN,
        }),
    });

    const response = await harness.boundary.execute(
      createRequest(),
      createInvocationContext()
    );

    expect(response.status).toBe('REJECTED');
    expect(harness.execute).not.toHaveBeenCalled();
  });

  it('14. fails closed for an infinite policy timeout', async () => {
    const harness = createHarness({
      policyHandler: (query) =>
        createAllowedDecision(query, {
          effectiveTimeoutMs: Number.POSITIVE_INFINITY,
        }),
    });

    const response = await harness.boundary.execute(
      createRequest(),
      createInvocationContext()
    );

    expect(response.status).toBe('REJECTED');
    expect(harness.execute).not.toHaveBeenCalled();
  });

  it('15. never obtains the deadline from payload', async () => {
    const harness = createHarness();

    const response = await harness.boundary.execute(
      createRequest({
        payload: {
          authoritativeDeadlineAt:
            '2099-01-01T00:00:00.000Z',
        },
      }),
      createInvocationContext()
    );

    expect(response.status).toBe('REJECTED');
    expect(harness.execute).not.toHaveBeenCalled();
  });

  it('16. never obtains the deadline from metadata', async () => {
    const harness = createHarness();

    await harness.boundary.execute(
      createRequest({
        metadata: {
          authoritativeDeadlineAt:
            '2099-01-01T00:00:00.000Z',
          safe: 'retained',
        },
      }),
      createInvocationContext()
    );

    const input = harness.execute.mock.calls[0][0];
    expect(input.authoritativeContext?.authoritativeDeadlineAt).toBe(
      '2026-07-28T12:00:30.000Z'
    );
    expect(input.metadata).toEqual({ safe: 'retained' });
  });

  it('17. isolates the propagated deadline from caller mutation', async () => {
    const request = { ...createRequest() };
    const decision = {
      ...createAllowedDecision({
        schemaVersion:
          AUTHORITATIVE_BOUNDARY_POLICY_SCHEMA_VERSION,
        tenantId: 'tenant-1',
        consumerId: 'consumer-1',
        source: 'trusted-adapter',
        requestedMode: 'SHADOW_ONLY',
        actor: {
          actorType: 'SERVICE',
          actorId: 'actor-1',
        },
      }),
    };
    const harness = createHarness({
      policyHandler: () => decision,
    });

    await harness.boundary.execute(
      request,
      createInvocationContext()
    );
    decision.effectiveTimeoutMs = 1;
    request.timeoutMs = 1;

    expect(
      harness.execute.mock.calls[0][0].authoritativeContext
        ?.authoritativeDeadlineAt
    ).toBe('2026-07-28T12:00:30.000Z');
  });

  it('18. preserves cancellation precedence after policy evaluation', async () => {
    const controller = new AbortController();
    const deadline = '2026-07-28T12:00:30.000Z';
    const harness = createHarness({
      clock: createClock(INGRESS_AT, INGRESS_AT, deadline),
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

  it('19. never records deadline or authorized timeout in audit events', async () => {
    const harness = createHarness();

    await harness.boundary.execute(
      createRequest(),
      createInvocationContext()
    );
    await Promise.resolve();
    await Promise.resolve();

    const audit = JSON.stringify(harness.logEvent.mock.calls);
    expect(audit).not.toContain('authoritativeDeadlineAt');
    expect(audit).not.toContain('2026-07-28T12:00:30.000Z');
    expect(audit).not.toContain('effectiveTimeoutMs');
  });

  it('20. keeps timeout failures publicly minimal and safe', async () => {
    const harness = createHarness();

    const response = await harness.boundary.execute(
      createRequest({ timeoutMs: 30_001 }),
      createInvocationContext()
    );

    expect(response.errors).toEqual([
      {
        code: 'TIMEOUT',
        message:
          'Requested timeout exceeds the authoritative policy limit',
        retryable: false,
      },
    ]);
    expect(response.errors[0].details).toBeUndefined();
  });

  it('21. requires deadline in every authoritative context', () => {
    const {
      authoritativeDeadlineAt: _authoritativeDeadlineAt,
      ...contextWithoutDeadline
    } = createValidAuthoritativeContext();

    expect(() =>
      validateAuthoritativeExecutionContextV1(
        contextWithoutDeadline
      )
    ).toThrow();
  });

  it('22. rejects a deadline before initiatedAt', () => {
    expect(() =>
      validateAuthoritativeExecutionContextV1({
        ...createValidAuthoritativeContext(),
        authoritativeDeadlineAt:
          '2026-07-28T11:59:59.999Z',
      })
    ).toThrow();
  });

  it('23. rejects a non-canonical authoritative deadline', () => {
    expect(() =>
      validateAuthoritativeExecutionContextV1({
        ...createValidAuthoritativeContext(),
        authoritativeDeadlineAt: '2026-07-28T12:00:30Z',
      })
    ).toThrow();
  });

  it('24. clones and freezes a validated authoritative deadline', () => {
    const input = createValidAuthoritativeContext();
    const context =
      validateAuthoritativeExecutionContextV1(input);

    expect(context).not.toBe(input);
    expect(context.authoritativeDeadlineAt).toBe(
      input.authoritativeDeadlineAt
    );
    expect(Object.isFrozen(context)).toBe(true);
  });
});
