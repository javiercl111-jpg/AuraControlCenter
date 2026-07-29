import { describe, expect, it } from 'vitest';
import {
  TRUSTED_COMPOSITION_REGISTRY_VERSION,
  TRUSTED_CONSUMER_REGISTRY_V1,
  TRUSTED_SOURCE_REGISTRY_V1,
} from '../registry';
import {
  TrustedCompositionContractError,
} from '../errors';
import {
  createTrustedCompositionRootDependencies,
  createTrustedRequestIdentityV1,
  createTrustedSanitizedTransportContextV1,
  createTrustedServerExecutionResponseV1,
  createTrustedServerLifecycleV1,
  createTrustedServerPrincipalV1,
  createTrustedServerRequestContextV1,
  createTrustedTenantMembershipV1,
} from '../factories';
import {
  resolveTrustedRegistrySelectionV1,
} from '../validators';

const AUTHENTICATED_AT = '2026-07-29T11:58:00.000Z';
const RESOLVED_AT = '2026-07-29T11:59:00.000Z';
const GENERATED_AT = '2026-07-29T11:59:30.000Z';
const INITIATED_AT = '2026-07-29T12:00:00.000Z';
const DEADLINE_AT = '2026-07-29T12:01:00.000Z';
const COMPLETED_AT = '2026-07-29T12:00:10.000Z';

function principal(
  overrides: Readonly<Record<string, unknown>> = {}
): Readonly<Record<string, unknown>> {
  return {
    schemaVersion: '1',
    principalId: 'principal-system-001',
    principalType: 'SYSTEM',
    authenticationMethod: 'INTERNAL_TEST_ASSERTION',
    provider: 'AURA_INTERNAL_TEST',
    authenticatedAt: AUTHENTICATED_AT,
    claimsFingerprint: `sha256:${'a'.repeat(64)}`,
    ...overrides,
  };
}

function membership(
  overrides: Readonly<Record<string, unknown>> = {}
): Readonly<Record<string, unknown>> {
  return {
    schemaVersion: '1',
    tenantId: 'tenant-contract-001',
    principalId: 'principal-system-001',
    membershipId: 'membership-contract-001',
    roles: ['TENANT_SYSTEM'],
    status: 'ACTIVE',
    resolvedAt: RESOLVED_AT,
    resolverVersion: 'resolver:contract:v1',
    evidenceFingerprint: `sha256:${'b'.repeat(64)}`,
    ...overrides,
  };
}

function requestIdentity(
  overrides: Readonly<Record<string, unknown>> = {}
): Readonly<Record<string, unknown>> {
  return {
    schemaVersion: '1',
    requestId: 'request-contract-001',
    correlationId: 'correlation-contract-001',
    generationStrategy: 'DETERMINISTIC_TEST',
    generatedAt: GENERATED_AT,
    generatorVersion: 'generator:contract:v1',
    ...overrides,
  };
}

function lifecycle(
  overrides: Readonly<Record<string, unknown>> = {}
): Readonly<Record<string, unknown>> {
  return {
    schemaVersion: '1',
    transportAborted: false,
    transportDeadlineAt: DEADLINE_AT,
    ...overrides,
  };
}

function requestContext(
  overrides: Readonly<Record<string, unknown>> = {}
): Readonly<Record<string, unknown>> {
  return {
    schemaVersion: '1',
    transport: 'INTERNAL_TEST',
    authenticatedPrincipal: principal(),
    tenantMembership: membership(),
    consumer: 'INTELLIGENCE_OS_CONTRACT_TEST',
    source: 'TRUSTED_COMPOSITION_CONTRACT_TEST',
    requestIdentity: requestIdentity(),
    initiatedAt: INITIATED_AT,
    requestedExecutionMode: 'SHADOW_ONLY',
    cancellation: lifecycle(),
    sanitizedTransportContext: {
      schemaVersion: '1',
      traceId: 'trace-contract-001',
      region: 'us-central1',
      transportName: 'INTERNAL_TEST',
      invocationClass: 'TEST',
    },
    ...overrides,
  };
}

function registryInput(
  overrides: Readonly<Record<string, unknown>> = {}
): Readonly<Record<string, unknown>> {
  return {
    consumer: 'INTELLIGENCE_OS_CONTRACT_TEST',
    source: 'TRUSTED_COMPOSITION_CONTRACT_TEST',
    transport: 'INTERNAL_TEST',
    requestedExecutionMode: 'SHADOW_ONLY',
    ...overrides,
  };
}

function dependencies(): Readonly<Record<string, unknown>> {
  return {
    featurePolicyPort: {
      async getEffectivePolicy() {
        return undefined;
      },
      async evaluateAuthoritativePolicy() {
        throw new Error('Not executed by contract validation');
      },
    },
    executionPort: new (class ContractExecutionPort {
      async execute() {
        throw new Error('Not executed by contract validation');
      }
    })(),
    clockPort: {
      now() {
        return INITIATED_AT;
      },
    },
    auditPort: {
      async logEvent() {
        return undefined;
      },
    },
    requestIdentityFactory: {
      createIdentity() {
        return createTrustedRequestIdentityV1(requestIdentity());
      },
    },
    registry: {
      resolve(value: unknown) {
        return resolveTrustedRegistrySelectionV1(value);
      },
    },
    tenantAuthorityResolver: {
      async resolveMembership() {
        return createTrustedTenantMembershipV1(membership());
      },
    },
    principalResolver: {
      async resolvePrincipal() {
        return createTrustedServerPrincipalV1(principal());
      },
    },
    responseSanitizer: {
      sanitize(value: unknown) {
        return createTrustedServerExecutionResponseV1(value);
      },
    },
  };
}

describe('AI-02H1C trusted composition contracts', () => {
  it('1. accepts a valid trusted request context', () => {
    const output = createTrustedServerRequestContextV1(
      requestContext()
    );
    expect(output.schemaVersion).toBe('1');
    expect(output.transport).toBe('INTERNAL_TEST');
    expect(output.requestedExecutionMode).toBe('SHADOW_ONLY');
  });

  it('2. rejects an absent request context', () => {
    expect(() =>
      createTrustedServerRequestContextV1(undefined)
    ).toThrow(TrustedCompositionContractError);
  });

  it('3. accepts a valid USER principal', () => {
    const output = createTrustedServerPrincipalV1(
      principal({
        principalId: 'principal-user-001',
        principalType: 'USER',
        authenticationMethod: 'FIREBASE_ID_TOKEN',
        provider: 'FIREBASE_AUTH',
      })
    );
    expect(output.principalType).toBe('USER');
  });

  it('4. accepts a valid SERVICE principal', () => {
    const output = createTrustedServerPrincipalV1(
      principal({
        principalId: 'principal-service-001',
        principalType: 'SERVICE',
        authenticationMethod: 'OIDC_SERVICE_ACCOUNT',
        provider: 'GOOGLE_CLOUD_IAM',
      })
    );
    expect(output.principalType).toBe('SERVICE');
  });

  it('5. accepts a SYSTEM principal only under an explicit contract', () => {
    const output = createTrustedServerPrincipalV1(
      principal({
        authenticationMethod: 'WORKLOAD_IDENTITY',
        provider: 'GOOGLE_CLOUD_IAM',
      })
    );
    expect(output).toMatchObject({
      principalType: 'SYSTEM',
      authenticationMethod: 'WORKLOAD_IDENTITY',
      provider: 'GOOGLE_CLOUD_IAM',
    });
  });

  it('6. rejects an ANONYMOUS principal', () => {
    expect(() =>
      createTrustedServerPrincipalV1(
        principal({ principalType: 'ANONYMOUS' })
      )
    ).toThrow(TrustedCompositionContractError);
  });

  it('7. accepts a valid resolved tenant membership', () => {
    const output = createTrustedTenantMembershipV1(membership());
    expect(output).toMatchObject({
      tenantId: 'tenant-contract-001',
      status: 'ACTIVE',
    });
  });

  it('8. rejects the aura_root fallback tenant', () => {
    expect(() =>
      createTrustedTenantMembershipV1(
        membership({ tenantId: 'aura_root' })
      )
    ).toThrow(TrustedCompositionContractError);
  });

  it('9. rejects an inactive membership', () => {
    expect(() =>
      createTrustedTenantMembershipV1(
        membership({ status: 'SUSPENDED' })
      )
    ).toThrow(TrustedCompositionContractError);
  });

  it('10. rejects inconsistent principal and membership authority', () => {
    expect(() =>
      createTrustedServerRequestContextV1(
        requestContext({
          tenantMembership: membership({
            principalId: 'principal-other-001',
          }),
        })
      )
    ).toThrow(TrustedCompositionContractError);
  });

  it('11. accepts a registered test-only consumer', () => {
    expect(
      resolveTrustedRegistrySelectionV1(registryInput()).consumer.id
    ).toBe('INTELLIGENCE_OS_CONTRACT_TEST');
  });

  it('12. rejects an unknown consumer', () => {
    expect(() =>
      resolveTrustedRegistrySelectionV1(
        registryInput({ consumer: 'UNKNOWN_CONSUMER' })
      )
    ).toThrow(TrustedCompositionContractError);
  });

  it('13. accepts a registered test-only source', () => {
    expect(
      resolveTrustedRegistrySelectionV1(registryInput()).source.id
    ).toBe('TRUSTED_COMPOSITION_CONTRACT_TEST');
  });

  it('14. rejects an unknown source', () => {
    expect(() =>
      resolveTrustedRegistrySelectionV1(
        registryInput({ source: 'UNKNOWN_SOURCE' })
      )
    ).toThrow(TrustedCompositionContractError);
  });

  it('15. accepts the transport allowed by both registry entries', () => {
    expect(
      resolveTrustedRegistrySelectionV1(registryInput()).transport
    ).toBe('INTERNAL_TEST');
  });

  it('16. rejects a transport not allowed by the initial registry', () => {
    expect(() =>
      resolveTrustedRegistrySelectionV1(
        registryInput({ transport: 'HTTPS_FUNCTION' })
      )
    ).toThrow(TrustedCompositionContractError);
  });

  it('17. allows SHADOW_ONLY in the initial registry', () => {
    expect(
      resolveTrustedRegistrySelectionV1(registryInput())
        .requestedExecutionMode
    ).toBe('SHADOW_ONLY');
  });

  it('18. blocks EVALUATION in the initial registry', () => {
    expect(() =>
      resolveTrustedRegistrySelectionV1(
        registryInput({ requestedExecutionMode: 'EVALUATION' })
      )
    ).toThrow(TrustedCompositionContractError);
  });

  it('19. blocks PRODUCTIVE in the initial registry', () => {
    expect(() =>
      resolveTrustedRegistrySelectionV1(
        registryInput({ requestedExecutionMode: 'PRODUCTIVE' })
      )
    ).toThrow(TrustedCompositionContractError);
  });

  it('20. accepts a valid server-side requestId', () => {
    expect(
      createTrustedRequestIdentityV1(requestIdentity()).requestId
    ).toBe('request-contract-001');
  });

  it('21. rejects an invalid requestId', () => {
    expect(() =>
      createTrustedRequestIdentityV1(
        requestIdentity({ requestId: '../token@example.com' })
      )
    ).toThrow(TrustedCompositionContractError);
  });

  it('22. accepts a valid server-side correlationId', () => {
    expect(
      createTrustedRequestIdentityV1(requestIdentity()).correlationId
    ).toBe('correlation-contract-001');
  });

  it('23. rejects an invalid correlationId', () => {
    expect(() =>
      createTrustedRequestIdentityV1(
        requestIdentity({ correlationId: 'a/b' })
      )
    ).toThrow(TrustedCompositionContractError);
  });

  it('24. never obtains authority from a business payload', () => {
    expect(() =>
      createTrustedServerRequestContextV1({
        ...requestContext(),
        payload: {
          tenantId: 'tenant-payload',
          principalId: 'principal-payload',
        },
      })
    ).toThrow(TrustedCompositionContractError);
  });

  it('25. never lets sanitized transport context replace authority', () => {
    expect(() =>
      createTrustedSanitizedTransportContextV1({
        schemaVersion: '1',
        traceId: 'trace-contract-001',
        tenantId: 'tenant-forbidden',
      })
    ).toThrow(TrustedCompositionContractError);
    expect(() =>
      createTrustedServerRequestContextV1({
        schemaVersion: '1',
        transport: 'INTERNAL_TEST',
        sanitizedTransportContext: {
          schemaVersion: '1',
          traceId: 'trace-contract-001',
        },
      })
    ).toThrow(TrustedCompositionContractError);
  });

  it('26. accepts a valid lifecycle contract', () => {
    const output = createTrustedServerLifecycleV1(lifecycle());
    expect(output.transportDeadlineAt).toBe(DEADLINE_AT);
    expect(output.transportAborted).toBe(false);
  });

  it('27. preserves AbortSignal identity', () => {
    const controller = new AbortController();
    const output = createTrustedServerLifecycleV1(
      lifecycle({ cancellationSignal: controller.signal })
    );
    expect(output.cancellationSignal).toBe(controller.signal);
  });

  it('28. does not freeze AbortSignal', () => {
    const controller = new AbortController();
    const output = createTrustedServerLifecycleV1(
      lifecycle({ cancellationSignal: controller.signal })
    );
    expect(Object.isFrozen(output)).toBe(true);
    expect(Object.isFrozen(controller.signal)).toBe(false);
  });

  it('29. rejects an invalid timestamp', () => {
    expect(() =>
      createTrustedServerRequestContextV1(
        requestContext({ initiatedAt: 'not-a-timestamp' })
      )
    ).toThrow(TrustedCompositionContractError);
  });

  it('30. clones and freezes canonical data contracts', () => {
    const output = createTrustedServerRequestContextV1(
      requestContext()
    );
    expect(Object.isFrozen(output)).toBe(true);
    expect(Object.isFrozen(output.authenticatedPrincipal)).toBe(true);
    expect(Object.isFrozen(output.tenantMembership)).toBe(true);
    expect(Object.isFrozen(output.tenantMembership.roles)).toBe(true);
    expect(Object.isFrozen(output.requestIdentity)).toBe(true);
    expect(Object.isFrozen(output.cancellation)).toBe(true);
    expect(Object.isFrozen(output.sanitizedTransportContext)).toBe(
      true
    );
  });

  it('31. prevents later input mutation from changing a contract', () => {
    const roles = ['TENANT_SYSTEM'];
    const input: Record<string, unknown> = {
      ...membership(),
      roles,
    };
    const output = createTrustedTenantMembershipV1(input);
    roles[0] = 'TENANT_ADMIN';
    input.tenantId = 'tenant-mutated-001';

    expect(output.roles).toEqual(['TENANT_SYSTEM']);
    expect(output.tenantId).toBe('tenant-contract-001');
  });

  it('32. creates a valid sanitized COMPLETED response', () => {
    const output = createTrustedServerExecutionResponseV1({
      requestId: 'request-contract-001',
      correlationId: 'correlation-contract-001',
      status: 'COMPLETED',
      executionId: 'execution-contract-001',
      completedAt: COMPLETED_AT,
      resultSummary: {
        outcome: 'SUCCEEDED',
        warningCount: 0,
        durationMs: 10,
      },
    });
    expect(output).toMatchObject({
      status: 'COMPLETED',
      safeCode: 'EXECUTION_COMPLETED',
      executionId: 'execution-contract-001',
    });
  });

  it('33. creates a valid sanitized REJECTED response', () => {
    const output = createTrustedServerExecutionResponseV1({
      requestId: 'request-contract-001',
      correlationId: 'correlation-contract-001',
      status: 'REJECTED',
      completedAt: COMPLETED_AT,
    });
    expect(output).toEqual({
      schemaVersion: '1',
      requestId: 'request-contract-001',
      correlationId: 'correlation-contract-001',
      status: 'REJECTED',
      safeCode: 'REQUEST_REJECTED',
      safeMessage: 'Request rejected',
      completedAt: COMPLETED_AT,
    });
  });

  it('34. rejects a contradictory response', () => {
    expect(() =>
      createTrustedServerExecutionResponseV1({
        requestId: 'request-contract-001',
        correlationId: 'correlation-contract-001',
        status: 'REJECTED',
        executionId: 'execution-forbidden-001',
        completedAt: COMPLETED_AT,
      })
    ).toThrow(TrustedCompositionContractError);
  });

  it('35. strips rawData and unsafe result summary fields', () => {
    const output = createTrustedServerExecutionResponseV1({
      requestId: 'request-contract-001',
      correlationId: 'correlation-contract-001',
      status: 'COMPLETED',
      executionId: 'execution-contract-001',
      completedAt: COMPLETED_AT,
      rawData: {
        payload: 'secret',
        policyDecision: 'secret',
      },
      resultSummary: {
        outcome: 'SUCCEEDED',
        warningCount: 0,
        payload: 'secret',
        stack: 'secret',
      },
    });
    expect(JSON.stringify(output)).not.toContain('secret');
    if (output.status !== 'COMPLETED') {
      throw new Error('Expected a completed response');
    }
    expect(Object.keys(output.resultSummary ?? {})).toEqual([
      'outcome',
      'warningCount',
    ]);
  });

  it('36. accepts complete composition dependency contracts', () => {
    const output = createTrustedCompositionRootDependencies(
      dependencies()
    );
    expect(Object.isFrozen(output)).toBe(true);
    expect(typeof output.executionPort.execute).toBe('function');
    expect(typeof output.principalResolver.resolvePrincipal).toBe(
      'function'
    );
  });

  it('37. rejects a missing required composition dependency', () => {
    expect(() =>
      createTrustedCompositionRootDependencies({
        ...dependencies(),
        auditPort: undefined,
      })
    ).toThrow(TrustedCompositionContractError);
  });

  it('keeps the canonical registry at stable version 1', () => {
    expect(TRUSTED_COMPOSITION_REGISTRY_VERSION).toBe('1');
    expect(TRUSTED_CONSUMER_REGISTRY_V1.schemaVersion).toBe('1');
    expect(TRUSTED_SOURCE_REGISTRY_V1.schemaVersion).toBe('1');
    expect(Object.isFrozen(TRUSTED_CONSUMER_REGISTRY_V1)).toBe(true);
    expect(Object.isFrozen(TRUSTED_SOURCE_REGISTRY_V1)).toBe(true);
  });
});
