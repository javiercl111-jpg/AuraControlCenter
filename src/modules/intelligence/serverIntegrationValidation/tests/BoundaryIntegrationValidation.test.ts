import { describe, expect, it } from 'vitest';
import {
  TrustedCompositionContractError,
  createTrustedServerExecutionResponseV1,
  createTrustedServerRequestContextV1,
} from '../../server';
import type {
  GovernedExecutionRequest,
  TrustedServerExecutionResponseV1,
} from '../../server';
import {
  INTEGRATION_ACTOR_ID,
  INTEGRATION_CONSUMER_ID,
  INTEGRATION_CORRELATION_ID,
  INTEGRATION_DEADLINE,
  INTEGRATION_NOW,
  INTEGRATION_REQUEST_ID,
  INTEGRATION_SOURCE,
  INTEGRATION_TENANT_ID,
  createBoundaryIntegrationFixture,
  createIntegrationBusinessPayload,
  createMissingPolicySnapshotInput,
  createPolicyEntryInput,
  createPolicySnapshotInput,
  createTrustedContextInput,
  withInvocationContext,
  withRequest,
} from './fixtures';

function serialized(
  response: TrustedServerExecutionResponseV1
): string {
  return JSON.stringify(response);
}

function expectNoDispatch(
  fixture: ReturnType<
    typeof createBoundaryIntegrationFixture
  >
): void {
  expect(fixture.observations.internalInputs).toHaveLength(0);
  expect(fixture.observations.bootstrapInputs).toHaveLength(0);
}

describe('AI-02H1D.4 Boundary integration validation', () => {
  it('1. builds a certified and frozen trusted server request context', () => {
    const fixture = createBoundaryIntegrationFixture();

    expect(fixture.trustedContext).toMatchObject({
      transport: 'INTERNAL_TEST',
      consumer: INTEGRATION_CONSUMER_ID,
      source: INTEGRATION_SOURCE,
      requestedExecutionMode: 'SHADOW_ONLY',
    });
    expect(Object.isFrozen(fixture.trustedContext)).toBe(true);
  });

  it('2. preserves the fixture AbortSignal by identity', () => {
    const fixture = createBoundaryIntegrationFixture();

    expect(
      fixture.trustedContext.cancellation.cancellationSignal
    ).toBe(fixture.abortController.signal);
    expect(fixture.request.cancellationSignal).toBe(
      fixture.abortController.signal
    );
  });

  it('3. resolves the closed trusted consumer and source registries', () => {
    const fixture = createBoundaryIntegrationFixture();

    expect(fixture.registrySelection).toMatchObject({
      registryVersion: '1',
      transport: 'INTERNAL_TEST',
      requestedExecutionMode: 'SHADOW_ONLY',
    });
    expect(fixture.registrySelection.consumer.id).toBe(
      INTEGRATION_CONSUMER_ID
    );
    expect(fixture.registrySelection.source.id).toBe(
      INTEGRATION_SOURCE
    );
  });

  it('4. obtains an ALLOWED decision from the real policy producer', async () => {
    const fixture = createBoundaryIntegrationFixture();

    await fixture.execute();

    expect(fixture.observations.policyDecisions).toHaveLength(1);
    expect(fixture.observations.policyDecisions[0]).toMatchObject({
      decision: 'ALLOWED',
      reasonCode: 'POLICY_ALLOWED',
      effectiveExecutionMode: 'SHADOW_ONLY',
    });
  });

  it('5. completes the real governed Boundary in SHADOW_ONLY', async () => {
    const fixture = createBoundaryIntegrationFixture();
    const result = await fixture.execute();

    expect(result.boundaryResponse).toMatchObject({
      status: 'COMPLETED',
      mode: 'SHADOW_ONLY',
      requestId: INTEGRATION_REQUEST_ID,
      correlationId: INTEGRATION_CORRELATION_ID,
      errors: [],
    });
  });

  it('6. reaches the real bootstrapper and obtains ACCEPTED', async () => {
    const fixture = createBoundaryIntegrationFixture();

    await fixture.execute();

    expect(fixture.observations.bootstrapInputs).toHaveLength(1);
    expect(fixture.observations.bootstrapStates).toHaveLength(1);
    expect(fixture.observations.bootstrapStates[0]).toMatchObject({
      status: 'ACCEPTED',
      bootstrapId: INTEGRATION_REQUEST_ID,
    });
  });

  it('7. adapts the accepted bootstrap state to SUCCEEDED', async () => {
    const fixture = createBoundaryIntegrationFixture();

    await fixture.execute();

    expect(fixture.observations.internalResults[0]).toMatchObject({
      executionId: INTEGRATION_REQUEST_ID,
      sessionId: INTEGRATION_CORRELATION_ID,
      status: 'SUCCEEDED',
    });
  });

  it('8. propagates the authoritative context to the adapter', async () => {
    const fixture = createBoundaryIntegrationFixture();

    await fixture.execute();

    expect(
      fixture.observations.internalInputs[0]
        ?.authoritativeContext
    ).toMatchObject({
      tenantId: INTEGRATION_TENANT_ID,
      actor: {
        actorType: 'SYSTEM',
        actorId: INTEGRATION_ACTOR_ID,
      },
      consumerId: INTEGRATION_CONSUMER_ID,
      source: INTEGRATION_SOURCE,
      executionMode: 'SHADOW_ONLY',
      authoritativeDeadlineAt: INTEGRATION_DEADLINE,
    });
  });

  it('9. maps the completed execution to a trusted response', async () => {
    const fixture = createBoundaryIntegrationFixture();
    const result = await fixture.execute();

    expect(result.trustedResponse).toEqual({
      schemaVersion: '1',
      requestId: INTEGRATION_REQUEST_ID,
      correlationId: INTEGRATION_CORRELATION_ID,
      status: 'COMPLETED',
      safeCode: 'EXECUTION_COMPLETED',
      safeMessage: 'Execution completed',
      executionId: INTEGRATION_REQUEST_ID,
      resultSummary: {
        outcome: 'SUCCEEDED',
        warningCount: 0,
        durationMs: 0,
      },
      completedAt: INTEGRATION_NOW,
    });
  });

  it('10. preserves request and correlation identity end-to-end', async () => {
    const fixture = createBoundaryIntegrationFixture();
    const result = await fixture.execute();
    const bootstrapInput =
      fixture.observations.bootstrapInputs[0];

    expect(bootstrapInput?.bootstrapId).toBe(
      INTEGRATION_REQUEST_ID
    );
    expect(bootstrapInput?.correlationId).toBe(
      INTEGRATION_CORRELATION_ID
    );
    expect(result.trustedResponse.requestId).toBe(
      INTEGRATION_REQUEST_ID
    );
    expect(result.trustedResponse.correlationId).toBe(
      INTEGRATION_CORRELATION_ID
    );
  });

  it('11. propagates the certified policy version and no payload version', async () => {
    const fixture = createBoundaryIntegrationFixture();

    await fixture.execute();

    expect(
      fixture.observations.internalInputs[0]
        ?.authoritativeContext?.authorizationPolicyVersion
    ).toBe('policy-snapshot-contract-test-1');
  });

  it('12. creates the expected initial domain state from the real factories', async () => {
    const fixture = createBoundaryIntegrationFixture();

    await fixture.execute();

    const state = fixture.observations.bootstrapStates[0];
    expect(
      state?.status === 'ACCEPTED'
        ? state.initialDomainState.scenario.scenarioId
        : undefined
    ).toBe('PAYROLL_AUDIT');
    expect(
      state?.status === 'ACCEPTED'
        ? state.initialDomainState.evidence.length
        : 0
    ).toBe(1);
  });

  it('13. fails closed when an exact policy is missing', async () => {
    const fixture = createBoundaryIntegrationFixture({
      snapshot: createMissingPolicySnapshotInput(),
    });
    const result = await fixture.execute();

    expect(result.boundaryResponse.status).toBe('REJECTED');
    expect(
      fixture.observations.policyDecisions[0]?.reasonCode
    ).toBe('POLICY_NOT_FOUND');
    expectNoDispatch(fixture);
  });

  it('14. fails closed when the exact policy is disabled', async () => {
    const fixture = createBoundaryIntegrationFixture({
      snapshot: createPolicySnapshotInput([
        createPolicyEntryInput({ enabled: false }),
      ]),
    });
    const result = await fixture.execute();

    expect(result.boundaryResponse.status).toBe('REJECTED');
    expect(
      fixture.observations.policyDecisions[0]?.reasonCode
    ).toBe('POLICY_DISABLED');
    expectNoDispatch(fixture);
  });

  it('15. denies an unknown authoritative tenant in policy', async () => {
    const fixture = createBoundaryIntegrationFixture();
    const invocationContext = withInvocationContext(
      fixture.invocationContext,
      { tenantId: 'tenant-policy-unknown' }
    );
    const request = withRequest(fixture.request, {
      tenant: { tenantId: invocationContext.tenantId },
    });
    const result = await fixture.execute({
      request,
      invocationContext,
    });

    expect(result.boundaryResponse.status).toBe('REJECTED');
    expect(
      fixture.observations.policyDecisions[0]?.reasonCode
    ).toBe('TENANT_NOT_ALLOWED');
    expectNoDispatch(fixture);
  });

  it('16. rejects a tenant mismatch before policy evaluation', async () => {
    const fixture = createBoundaryIntegrationFixture();
    const request = withRequest(fixture.request, {
      tenant: { tenantId: 'tenant-request-spoofed' },
    });
    const result = await fixture.execute({ request });

    expect(result.boundaryResponse.status).toBe('REJECTED');
    expect(result.boundaryResponse.errors[0]?.code).toBe(
      'INVALID_TENANT_CONTEXT'
    );
    expect(fixture.observations.policyQueries).toHaveLength(0);
    expectNoDispatch(fixture);
  });

  it('17. denies an unknown authoritative actor in policy', async () => {
    const fixture = createBoundaryIntegrationFixture();
    const invocationContext = withInvocationContext(
      fixture.invocationContext,
      {
        actor: {
          actorType: 'SYSTEM',
          actorId: 'actor-policy-unknown',
        },
      }
    );
    const request = withRequest(fixture.request, {
      actor: invocationContext.actor,
    });
    const result = await fixture.execute({
      request,
      invocationContext,
    });

    expect(result.boundaryResponse.status).toBe('REJECTED');
    expect(
      fixture.observations.policyDecisions[0]?.reasonCode
    ).toBe('ACTOR_NOT_ALLOWED');
    expectNoDispatch(fixture);
  });

  it('18. rejects an actor mismatch before policy evaluation', async () => {
    const fixture = createBoundaryIntegrationFixture();
    const request = withRequest(fixture.request, {
      actor: {
        actorType: 'SYSTEM',
        actorId: 'actor-request-spoofed',
      },
    });
    const result = await fixture.execute({ request });

    expect(result.boundaryResponse.status).toBe('REJECTED');
    expect(result.boundaryResponse.errors[0]?.code).toBe(
      'INVALID_ACTOR_CONTEXT'
    );
    expect(fixture.observations.policyQueries).toHaveLength(0);
    expectNoDispatch(fixture);
  });

  it('19. rejects an unknown consumer at trusted registry admission', () => {
    expect(() =>
      createTrustedServerRequestContextV1(
        createTrustedContextInput(undefined, {
          consumer: 'UNKNOWN_CONSUMER',
        })
      )
    ).toThrow(TrustedCompositionContractError);
  });

  it('20. denies an unknown Boundary consumer in policy', async () => {
    const fixture = createBoundaryIntegrationFixture();
    const invocationContext = withInvocationContext(
      fixture.invocationContext,
      { consumerId: 'UNKNOWN_CONSUMER' }
    );
    const result = await fixture.execute({ invocationContext });

    expect(result.boundaryResponse.status).toBe('REJECTED');
    expect(
      fixture.observations.policyDecisions[0]?.reasonCode
    ).toBe('CONSUMER_NOT_ALLOWED');
    expectNoDispatch(fixture);
  });

  it('21. rejects an unknown source at trusted registry admission', () => {
    expect(() =>
      createTrustedServerRequestContextV1(
        createTrustedContextInput(undefined, {
          source: 'UNKNOWN_SOURCE',
        })
      )
    ).toThrow(TrustedCompositionContractError);
  });

  it('22. denies an unknown Boundary source in policy', async () => {
    const fixture = createBoundaryIntegrationFixture();
    const invocationContext = withInvocationContext(
      fixture.invocationContext,
      { source: 'UNKNOWN_SOURCE' }
    );
    const request = withRequest(fixture.request, {
      source: invocationContext.source,
    });
    const result = await fixture.execute({
      request,
      invocationContext,
    });

    expect(result.boundaryResponse.status).toBe('REJECTED');
    expect(
      fixture.observations.policyDecisions[0]?.reasonCode
    ).toBe('SOURCE_NOT_ALLOWED');
    expectNoDispatch(fixture);
  });

  it('23. rejects EVALUATION at trusted registry admission', () => {
    expect(() =>
      createTrustedServerRequestContextV1(
        createTrustedContextInput(undefined, {
          requestedExecutionMode: 'EVALUATION',
        })
      )
    ).toThrow(TrustedCompositionContractError);
  });

  it('24. denies EVALUATION at authoritative policy admission', async () => {
    const fixture = createBoundaryIntegrationFixture();
    const request = withRequest(fixture.request, {
      requestedMode: 'EVALUATION',
    });
    const result = await fixture.execute({ request });

    expect(result.boundaryResponse.status).toBe('REJECTED');
    expect(
      fixture.observations.policyDecisions[0]?.reasonCode
    ).toBe('MODE_NOT_ALLOWED');
    expectNoDispatch(fixture);
  });

  it('25. rejects PRODUCTIVE before consulting policy', async () => {
    const fixture = createBoundaryIntegrationFixture();
    const request = withRequest(fixture.request, {
      requestedMode: 'PRODUCTIVE',
    });
    const result = await fixture.execute({ request });

    expect(result.boundaryResponse.status).toBe('REJECTED');
    expect(result.boundaryResponse.errors[0]?.code).toBe(
      'MODE_NOT_ALLOWED'
    );
    expect(fixture.observations.policyQueries).toHaveLength(0);
    expectNoDispatch(fixture);
  });

  it('26. times out before dispatch at the authoritative deadline', async () => {
    const fixture = createBoundaryIntegrationFixture({
      clockTimestamps: [
        INTEGRATION_NOW,
        INTEGRATION_NOW,
        INTEGRATION_NOW,
        INTEGRATION_NOW,
        INTEGRATION_DEADLINE,
      ],
    });
    const result = await fixture.execute();

    expect(result.boundaryResponse.status).toBe('TIMED_OUT');
    expect(result.trustedResponse.status).toBe('TIMED_OUT');
    expectNoDispatch(fixture);
  });

  it('27. fails closed if the deadline expires inside the adapter', async () => {
    const fixture = createBoundaryIntegrationFixture({
      clockTimestamps: [
        INTEGRATION_NOW,
        INTEGRATION_NOW,
        INTEGRATION_NOW,
        INTEGRATION_NOW,
        INTEGRATION_NOW,
        INTEGRATION_DEADLINE,
      ],
    });
    const result = await fixture.execute();

    expect(result.boundaryResponse.status).toBe('FAILED');
    expect(result.boundaryResponse.errors[0]?.code).toBe('TIMEOUT');
    expect(result.trustedResponse.status).toBe('INTERNAL_ERROR');
    expect(fixture.observations.bootstrapInputs).toHaveLength(0);
  });

  it('28. cancels before Boundary validation through AbortSignal', async () => {
    const fixture = createBoundaryIntegrationFixture();
    fixture.abortController.abort();

    const result = await fixture.execute();

    expect(result.boundaryResponse.status).toBe('CANCELLED');
    expect(result.trustedResponse.status).toBe('CANCELLED');
    expect(fixture.observations.policyQueries).toHaveLength(0);
    expectNoDispatch(fixture);
  });

  it('29. rejects an absent authoritative invocation context', async () => {
    const fixture = createBoundaryIntegrationFixture();
    const result = await fixture.execute({
      invocationContext: null,
    });

    expect(result.boundaryResponse.status).toBe('REJECTED');
    expect(result.boundaryResponse.errors[0]?.code).toBe(
      'INVALID_REQUEST'
    );
    expectNoDispatch(fixture);
  });

  it('30. rejects payload authority spoofing before policy', async () => {
    const fixture = createBoundaryIntegrationFixture();
    const request = withRequest(fixture.request, {
      payload: {
        ...createIntegrationBusinessPayload(),
        tenantId: 'tenant-payload-spoofed',
      },
    });
    const result = await fixture.execute({ request });

    expect(result.boundaryResponse.status).toBe('REJECTED');
    expect(result.boundaryResponse.errors[0]?.code).toBe(
      'INVALID_TENANT_CONTEXT'
    );
    expect(fixture.observations.policyQueries).toHaveLength(0);
    expectNoDispatch(fixture);
  });

  it('31. fails closed for a business payload rejected by the adapter', async () => {
    const fixture = createBoundaryIntegrationFixture();
    const request = withRequest(fixture.request, {
      payload: {
        schemaVersion: '1',
        targetScenario: {},
        facts: [],
        policy: {},
      },
    });
    const result = await fixture.execute({ request });

    expect(result.boundaryResponse.status).toBe('FAILED');
    expect(result.boundaryResponse.errors[0]?.code).toBe(
      'INVALID_REQUEST'
    );
    expect(fixture.observations.bootstrapInputs).toHaveLength(0);
  });

  it('32. returns a closed trusted response key set', async () => {
    const fixture = createBoundaryIntegrationFixture();
    const result = await fixture.execute();

    expect(Object.keys(result.trustedResponse).sort()).toEqual([
      'completedAt',
      'correlationId',
      'executionId',
      'requestId',
      'resultSummary',
      'safeCode',
      'safeMessage',
      'schemaVersion',
      'status',
    ]);
  });

  it('33. never exposes rawData', async () => {
    const result =
      await createBoundaryIntegrationFixture().execute();

    expect(serialized(result.trustedResponse)).not.toContain(
      'rawData'
    );
    expect(serialized(result.trustedResponse)).not.toContain(
      'boundary-integration-fixture'
    );
  });

  it('34. never exposes a policy snapshot or table', async () => {
    const result =
      await createBoundaryIntegrationFixture().execute();
    const output = serialized(result.trustedResponse);

    expect(output).not.toContain('policySnapshot');
    expect(output).not.toContain('policyTable');
    expect(output).not.toContain('policy-contract-test-shadow');
  });

  it('35. never exposes tenant or actor internals', async () => {
    const result =
      await createBoundaryIntegrationFixture().execute();
    const output = serialized(result.trustedResponse);

    expect(output).not.toContain(INTEGRATION_TENANT_ID);
    expect(output).not.toContain(INTEGRATION_ACTOR_ID);
    expect(output).not.toContain('tenantInternals');
    expect(output).not.toContain('actorInternals');
  });

  it('36. never exposes payload or metadata', async () => {
    const result =
      await createBoundaryIntegrationFixture().execute();
    const output = serialized(result.trustedResponse);

    expect(output).not.toContain('payload');
    expect(output).not.toContain('metadata');
    expect(output).not.toContain('integration-validation');
    expect(output).not.toContain('must-not-propagate');
  });

  it('37. never exposes bridge result, audit, or stack', async () => {
    const result =
      await createBoundaryIntegrationFixture().execute();
    const output = serialized(result.trustedResponse);

    expect(output).not.toContain('bridgeResult');
    expect(output).not.toContain('bootstrapState');
    expect(output).not.toContain('audit');
    expect(output).not.toContain('stack');
  });

  it('38. sanitizes a rejected response without execution fields', async () => {
    const fixture = createBoundaryIntegrationFixture();
    const result = await fixture.execute({
      invocationContext: null,
    });

    expect(result.trustedResponse).toEqual({
      schemaVersion: '1',
      requestId: INTEGRATION_REQUEST_ID,
      correlationId: INTEGRATION_CORRELATION_ID,
      status: 'REJECTED',
      safeCode: 'REQUEST_REJECTED',
      safeMessage: 'Request rejected',
      completedAt: INTEGRATION_NOW,
    });
  });

  it('39. sanitizes a timed-out response without execution fields', async () => {
    const fixture = createBoundaryIntegrationFixture({
      clockTimestamps: [
        INTEGRATION_NOW,
        INTEGRATION_NOW,
        INTEGRATION_NOW,
        INTEGRATION_NOW,
        INTEGRATION_DEADLINE,
      ],
    });
    const result = await fixture.execute();

    expect(result.trustedResponse).toMatchObject({
      status: 'TIMED_OUT',
      safeCode: 'REQUEST_TIMED_OUT',
    });
    expect(result.trustedResponse).not.toHaveProperty('executionId');
    expect(result.trustedResponse).not.toHaveProperty(
      'resultSummary'
    );
  });

  it('40. sanitizes a cancelled response without execution fields', async () => {
    const fixture = createBoundaryIntegrationFixture();
    fixture.abortController.abort();
    const result = await fixture.execute();

    expect(result.trustedResponse).toMatchObject({
      status: 'CANCELLED',
      safeCode: 'REQUEST_CANCELLED',
    });
    expect(result.trustedResponse).not.toHaveProperty('executionId');
    expect(result.trustedResponse).not.toHaveProperty(
      'resultSummary'
    );
  });

  it('41. produces deterministic equivalent outputs from equivalent fixtures', async () => {
    const first =
      await createBoundaryIntegrationFixture().execute();
    const second =
      await createBoundaryIntegrationFixture().execute();

    expect(first.boundaryResponse).toEqual(
      second.boundaryResponse
    );
    expect(first.trustedResponse).toEqual(second.trustedResponse);
  });

  it('42. supports multiple independent executions with one producer', async () => {
    const firstFixture = createBoundaryIntegrationFixture();
    const secondFixture = createBoundaryIntegrationFixture({
      producer: firstFixture.policyProducer,
      requestId: 'request-boundary-integration-2',
      correlationId: 'correlation-boundary-integration-2',
    });

    const [first, second] = await Promise.all([
      firstFixture.execute(),
      secondFixture.execute(),
    ]);

    expect(first.trustedResponse.status).toBe('COMPLETED');
    expect(second.trustedResponse.status).toBe('COMPLETED');
    expect(first.trustedResponse.requestId).not.toBe(
      second.trustedResponse.requestId
    );
  });

  it('43. keeps repeated identical execution deterministic and state-isolated', async () => {
    const fixture = createBoundaryIntegrationFixture();

    const first = await fixture.execute();
    const second = await fixture.execute();

    expect(second.trustedResponse).toEqual(first.trustedResponse);
    expect(fixture.observations.bootstrapStates).toHaveLength(2);
    expect(fixture.observations.bootstrapStates[0]).toEqual(
      fixture.observations.bootstrapStates[1]
    );
  });

  it('44. isolates producer authority from later snapshot mutation', async () => {
    const entry = createPolicyEntryInput();
    const snapshot = createPolicySnapshotInput([entry]);
    const fixture = createBoundaryIntegrationFixture({ snapshot });

    entry.enabled = false;
    snapshot.authorizationPolicyVersion = 'mutated-version';
    const result = await fixture.execute();

    expect(result.trustedResponse.status).toBe('COMPLETED');
    expect(
      fixture.observations.policyDecisions[0]
        ?.authorizationPolicyVersion
    ).toBe('policy-snapshot-contract-test-1');
  });

  it('45. reuses one certified snapshot across equivalent producers', async () => {
    const snapshot = createPolicySnapshotInput();
    const first = createBoundaryIntegrationFixture({ snapshot });
    const second = createBoundaryIntegrationFixture({
      snapshot,
      requestId: 'request-snapshot-reuse',
      correlationId: 'correlation-snapshot-reuse',
    });

    const [firstResult, secondResult] = await Promise.all([
      first.execute(),
      second.execute(),
    ]);

    expect(firstResult.trustedResponse.status).toBe('COMPLETED');
    expect(secondResult.trustedResponse.status).toBe('COMPLETED');
    expect(first.observations.policyDecisions[0]?.reasonCode).toBe(
      second.observations.policyDecisions[0]?.reasonCode
    );
  });

  it('46. reuses a producer without mutable authorization leakage', async () => {
    const first = createBoundaryIntegrationFixture();
    const second = createBoundaryIntegrationFixture({
      producer: first.policyProducer,
      requestId: 'request-producer-reuse',
      correlationId: 'correlation-producer-reuse',
    });

    await first.execute();
    await second.execute();

    expect(first.observations.policyDecisions[0]).toMatchObject({
      decision: 'ALLOWED',
      reasonCode: 'POLICY_ALLOWED',
    });
    expect(second.observations.policyDecisions[0]).toMatchObject({
      decision: 'ALLOWED',
      reasonCode: 'POLICY_ALLOWED',
    });
  });

  it('47. keeps independent AbortSignals isolated across executions', async () => {
    const cancelled = createBoundaryIntegrationFixture();
    const active = createBoundaryIntegrationFixture({
      producer: cancelled.policyProducer,
      requestId: 'request-signal-isolation',
      correlationId: 'correlation-signal-isolation',
    });
    cancelled.abortController.abort();

    const [cancelledResult, activeResult] = await Promise.all([
      cancelled.execute(),
      active.execute(),
    ]);

    expect(cancelledResult.trustedResponse.status).toBe(
      'CANCELLED'
    );
    expect(activeResult.trustedResponse.status).toBe('COMPLETED');
  });

  it('48. rejects contradictory non-completed sanitizer input', () => {
    expect(() =>
      createTrustedServerExecutionResponseV1({
        requestId: INTEGRATION_REQUEST_ID,
        correlationId: INTEGRATION_CORRELATION_ID,
        status: 'REJECTED',
        completedAt: INTEGRATION_NOW,
        executionId: INTEGRATION_REQUEST_ID,
        resultSummary: {
          outcome: 'SUCCEEDED',
          warningCount: 0,
        },
        rawData: { secret: true },
      })
    ).toThrow(TrustedCompositionContractError);
  });

  it('49. rejects request and invocation identity mismatch', async () => {
    const fixture = createBoundaryIntegrationFixture();
    const request = withRequest(fixture.request, {
      requestId: 'request-boundary-mismatched',
    });
    const result = await fixture.execute({ request });

    expect(result.boundaryResponse.status).toBe('REJECTED');
    expect(result.boundaryResponse.errors[0]?.code).toBe(
      'INVALID_REQUEST'
    );
    expectNoDispatch(fixture);
  });

  it('50. keeps the authoritative source separate from scenario source', async () => {
    const fixture = createBoundaryIntegrationFixture();

    await fixture.execute();

    expect(
      fixture.observations.internalInputs[0]
        ?.authoritativeContext?.source
    ).toBe(INTEGRATION_SOURCE);
    expect(
      fixture.observations.bootstrapInputs[0]?.targetScenario
        .source
    ).toBe('AUTHORIZED_SYSTEM_CONFIGURATION');
    expect(
      fixture.observations.bootstrapInputs[0]?.context.source
    ).toBe(INTEGRATION_SOURCE);
  });

  it('51. propagates only sanitized operational metadata internally', async () => {
    const fixture = createBoundaryIntegrationFixture();

    await fixture.execute();

    expect(fixture.observations.internalInputs[0]?.metadata).toEqual({
      operationalLabel: 'integration-validation',
    });
  });

  it('52. keeps the trusted response deeply frozen', async () => {
    const result =
      await createBoundaryIntegrationFixture().execute();

    expect(Object.isFrozen(result.trustedResponse)).toBe(true);
    expect(
      result.trustedResponse.status === 'COMPLETED'
        ? Object.isFrozen(result.trustedResponse.resultSummary)
        : false
    ).toBe(true);
  });

  it('53. never mutates the caller business payload', async () => {
    const fixture = createBoundaryIntegrationFixture();
    const payload = createIntegrationBusinessPayload();
    const before = JSON.stringify(payload);
    const request: GovernedExecutionRequest = {
      ...fixture.request,
      payload,
    };

    await fixture.execute({ request });

    expect(JSON.stringify(payload)).toBe(before);
  });
});
