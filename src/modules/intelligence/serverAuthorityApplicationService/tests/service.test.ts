import { describe, expect, it } from 'vitest';
import type {
  AuthorityAuthorizationResultV1,
} from '../../serverAuthorityAuthorization/authorityAuthorizationTypes';
import type {
  AuthorityPrincipalResolutionResultV1,
} from '../../serverPrincipalResolution/principalResolutionTypes';
import type {
  AuthorityTenantScopeResolutionResultV1,
} from '../../serverTenantScopeResolution/tenantScopeResolutionTypes';
import {
  AUTHORITY_APPLICATION_STAGES,
  AuthorityApplicationServiceExecutionError,
  AuthorityApplicationServiceValidationError,
  createAuthorityApplicationServiceV1,
  validateAuthorityApplicationExecutionContextV1,
  validateAuthorityApplicationServiceDependenciesV1,
  validateAuthorityApplicationServiceRequestV1,
} from '../index';
import type {
  AuthorityApplicationResultStatus,
  AuthorityObligationVerificationResultV1,
} from '../authorityApplicationServiceTypes';
import {
  HASH_A,
  HASH_B,
  HASH_E,
  NOW,
  applicationRequest,
  authorizationDecision,
  dependencies,
  dependencyState,
  executionContext,
  repositoryResult,
  resolvedPrincipal,
  resolvedScope,
  verificationResult,
  type DependencyState,
} from './fixtures';

function principalFailure(
  status: Exclude<
    AuthorityPrincipalResolutionResultV1['status'],
    'RESOLVED'
  >,
): AuthorityPrincipalResolutionResultV1 {
  const mapping = {
    NOT_FOUND: ['AUTHENTICATION_BINDING_NOT_FOUND', 'DO_NOT_RETRY'],
    REJECTED: ['INVALID_RESOLUTION_REQUEST', 'DO_NOT_RETRY'],
    STALE: ['STALE_BINDING', 'RETRY_AFTER_REFRESH'],
    REVOKED: ['PRINCIPAL_REVOKED', 'DO_NOT_RETRY'],
    CONFLICT: [
      'PRINCIPAL_BINDING_CONFLICT',
      'RETRY_AFTER_OPERATOR_REVIEW',
    ],
    INTERNAL_ERROR: [
      'INTERNAL_RESOLUTION_FAILURE',
      'SAFE_TO_RETRY',
    ],
  } as const;
  const [reasonCode, retryDisposition] = mapping[status];
  return {
    schemaVersion: '1',
    status,
    reasonCode,
    retryDisposition,
    resolverVersion: 'principal-resolver-v1',
    resolvedAt: NOW,
  };
}

function scopeFailure(
  status: Exclude<
    AuthorityTenantScopeResolutionResultV1['status'],
    'RESOLVED'
  >,
): AuthorityTenantScopeResolutionResultV1 {
  const mapping = {
    NOT_FOUND: ['TENANT_NOT_FOUND', 'DO_NOT_RETRY'],
    REJECTED: ['TENANT_SELECTOR_INVALID', 'DO_NOT_RETRY'],
    STALE: ['TENANT_AUTHORITY_STALE', 'RETRY_AFTER_TENANT_REFRESH'],
    REVOKED: ['TENANT_REVOKED', 'DO_NOT_RETRY'],
    CONFLICT: [
      'PRINCIPAL_TENANT_BINDING_CONFLICT',
      'RETRY_AFTER_OPERATOR_REVIEW',
    ],
    AMBIGUOUS: [
      'TENANT_ALIAS_AMBIGUOUS',
      'RETRY_AFTER_OPERATOR_REVIEW',
    ],
    INTERNAL_ERROR: [
      'INTERNAL_RESOLUTION_FAILURE',
      'SAFE_TO_RETRY',
    ],
  } as const;
  const [reasonCode, retryDisposition] = mapping[status];
  return {
    schemaVersion: '1',
    status,
    reasonCode,
    retryDisposition,
    resolverVersion: 'scope-resolver-v1',
    resolvedAt: NOW,
  };
}

function authorizationFailure(
  status: Exclude<AuthorityAuthorizationResultV1['status'], 'DECIDED'>,
): AuthorityAuthorizationResultV1 {
  const mapping = {
    REJECTED: ['AUTHORIZATION_REQUEST_INVALID', 'DO_NOT_RETRY'],
    STALE: ['POLICY_STALE', 'RETRY_AFTER_POLICY_REFRESH'],
    CONFLICT: ['BINDING_CONFLICT', 'RETRY_AFTER_OPERATOR_REVIEW'],
    INTERNAL_ERROR: [
      'INTERNAL_AUTHORIZATION_FAILURE',
      'SAFE_TO_RETRY',
    ],
  } as const;
  const [reasonCode, retryDisposition] = mapping[status];
  return {
    schemaVersion: '1',
    status,
    reasonCode,
    retryDisposition,
    evaluatorVersion: 'authorization-evaluator-v1',
    evaluatedAt: NOW,
  };
}

function obligationFailure(
  status: Exclude<
    AuthorityObligationVerificationResultV1['status'],
    'VERIFIED'
  >,
): AuthorityObligationVerificationResultV1 {
  const safeCodes = {
    REJECTED: 'OBLIGATIONS_REJECTED',
    STALE: 'OBLIGATIONS_STALE',
    INCOMPLETE: 'OBLIGATIONS_INCOMPLETE',
    CONFLICT: 'OBLIGATIONS_CONFLICT',
    INTERNAL_ERROR: 'OBLIGATIONS_INTERNAL_ERROR',
  } as const;
  return {
    schemaVersion: '1',
    status,
    safeCode: safeCodes[status],
    retryDisposition:
      status === 'STALE'
        ? 'RETRY_AFTER_OBLIGATION_SATISFACTION'
        : 'DO_NOT_RETRY',
    maskNotFound: false,
  };
}

async function execute(
  state: DependencyState = dependencyState(),
  request = applicationRequest(),
  context = executionContext(),
) {
  return createAuthorityApplicationServiceV1(
    dependencies(state),
  ).execute(request, context);
}

const principalCases = [
  ['NOT_FOUND', 'NOT_FOUND'],
  ['REJECTED', 'REJECTED'],
  ['STALE', 'STALE'],
  ['REVOKED', 'STALE'],
  ['CONFLICT', 'CONFLICT'],
  ['INTERNAL_ERROR', 'INTERNAL_ERROR'],
] as const;

const scopeCases = [
  ['NOT_FOUND', 'NOT_FOUND'],
  ['REJECTED', 'REJECTED'],
  ['STALE', 'STALE'],
  ['REVOKED', 'STALE'],
  ['CONFLICT', 'CONFLICT'],
  ['AMBIGUOUS', 'CONFLICT'],
  ['INTERNAL_ERROR', 'INTERNAL_ERROR'],
] as const;

const authorizationCases = [
  ['REJECTED', 'REJECTED'],
  ['STALE', 'STALE'],
  ['CONFLICT', 'CONFLICT'],
  ['INTERNAL_ERROR', 'INTERNAL_ERROR'],
] as const;

const obligationCases = [
  ['REJECTED', 'REJECTED'],
  ['STALE', 'STALE'],
  ['INCOMPLETE', 'REJECTED'],
  ['CONFLICT', 'CONFLICT'],
  ['INTERNAL_ERROR', 'INTERNAL_ERROR'],
] as const;

describe('Authority Application Service flow', () => {
  it('1 applies a fully authorized operation', async () => {
    const state = dependencyState();
    const result = await execute(state);
    expect(result.status).toBe('APPLIED');
    expect(result.safeCode).toBe('AUTHORITY_OPERATION_APPLIED');
    expect(result.metadata.resultingVersion).toBe(2);
    expect(state.repositoryCalls).toBe(1);
  });

  it('2 maps repository NO_OP to REPLAYED', async () => {
    const state = dependencyState();
    state.repositoryResult = repositoryResult('NO_OP');
    const result = await execute(state);
    expect(result.status).toBe('REPLAYED');
    expect(result.safeCode).toBe('AUTHORITY_OPERATION_REPLAYED');
  });

  it.each(principalCases)(
    'principal %s stops as %s before later dependencies',
    async (upstreamStatus, expectedStatus) => {
      const state = dependencyState();
      state.principalResult = principalFailure(upstreamStatus);
      const result = await execute(state);
      expect(result.status).toBe(expectedStatus);
      expect(result.safeCode).toBe('AUTHORITY_PRINCIPAL_NOT_RESOLVED');
      expect(state.scopeCalls).toBe(0);
      expect(state.repositoryCalls).toBe(0);
    },
  );

  it.each(scopeCases)(
    'scope %s stops as %s before authorization',
    async (upstreamStatus, expectedStatus) => {
      const state = dependencyState();
      state.scopeResult = scopeFailure(upstreamStatus);
      const result = await execute(state);
      expect(result.status).toBe(expectedStatus);
      expect(result.safeCode).toBe('AUTHORITY_SCOPE_NOT_RESOLVED');
      expect(state.authorizationCalls).toBe(0);
      expect(state.repositoryCalls).toBe(0);
    },
  );

  it.each([
    ['DENY', 'NOT_AUTHORIZED'],
    ['INDETERMINATE', 'REJECTED'],
    ['NOT_APPLICABLE', 'REJECTED'],
  ] as const)(
    'decision %s stops as %s',
    async (decision, expectedStatus) => {
      const state = dependencyState();
      state.authorizationResult = {
        schemaVersion: '1',
        status: 'DECIDED',
        decision: authorizationDecision(decision),
      };
      const result = await execute(state);
      expect(result.status).toBe(expectedStatus);
      expect(state.obligationCalls).toBe(0);
      expect(state.repositoryCalls).toBe(0);
    },
  );

  it.each(authorizationCases)(
    'authorization %s stops as %s',
    async (upstreamStatus, expectedStatus) => {
      const state = dependencyState();
      state.authorizationResult = authorizationFailure(upstreamStatus);
      const result = await execute(state);
      expect(result.status).toBe(expectedStatus);
      expect(result.safeCode).toBe(
        'AUTHORITY_AUTHORIZATION_NOT_EXECUTABLE',
      );
      expect(state.obligationCalls).toBe(0);
      expect(state.repositoryCalls).toBe(0);
    },
  );

  it('continues after VERIFIED obligations', async () => {
    const state = dependencyState();
    const result = await execute(state);
    expect(result.status).toBe('APPLIED');
    expect(state.obligationCalls).toBe(1);
    expect(state.fingerprintCalls).toBe(1);
  });

  it.each(obligationCases)(
    'obligation %s stops as %s',
    async (upstreamStatus, expectedStatus) => {
      const state = dependencyState();
      state.obligationResult = obligationFailure(upstreamStatus);
      const result = await execute(state);
      expect(result.status).toBe(expectedStatus);
      expect(result.safeCode).toBe(
        'AUTHORITY_OBLIGATIONS_NOT_VERIFIED',
      );
      expect(state.fingerprintCalls).toBe(0);
      expect(state.repositoryCalls).toBe(0);
    },
  );

  it('continues when the invocation context is READY', async () => {
    const result = await execute();
    expect(result.status).toBe('APPLIED');
    expect(result.stageTrace.at(5)?.stage).toBe('CONTEXT_CONSTRUCTION');
    expect(result.stageTrace.at(5)?.status).toBe('COMPLETED');
  });

  it.each([
    ['REJECTED', 'bad fingerprint'],
    ['STALE', 'stale principal'],
    ['CONFLICT', 'cross-principal decision'],
    ['INCOMPLETE', 'obligation summary'],
  ] as const)(
    'context %s condition stops fail-closed (%s)',
    async (condition, description) => {
      expect(description.length).toBeGreaterThan(0);
      const state = dependencyState();
      if (condition === 'REJECTED') {
        state.throwAt = 'FINGERPRINT';
        state.thrownError = new AuthorityApplicationServiceExecutionError(
          'AUTHORITY_CONTEXT_NOT_READY',
          'DO_NOT_RETRY',
        );
      } else if (condition === 'STALE') {
        state.principalResult = {
          schemaVersion: '1',
          status: 'RESOLVED',
          principal: resolvedPrincipal({
            freshness: {
              ...resolvedPrincipal().freshness,
              validUntil: NOW,
            },
          }),
        };
      } else if (condition === 'CONFLICT') {
        state.authorizationResult = {
          schemaVersion: '1',
          status: 'DECIDED',
          decision: authorizationDecision('ALLOW', [
            'REQUIRE_IDEMPOTENCY_KEY',
          ], {
            principalBinding: {
              ...authorizationDecision().principalBinding,
              principalId: 'apr_v1_human_binding_other_001',
            },
          }),
        };
      } else {
        state.obligationResult = obligationFailure('INCOMPLETE');
      }
      const result = await execute(state);
      expect(result.status).not.toBe('APPLIED');
      expect(state.repositoryCalls).toBe(0);
    },
  );
});

describe('Authority Application Service integrity', () => {
  it('calls fingerprint exactly once', async () => {
    const state = dependencyState();
    await execute(state);
    expect(state.fingerprintCalls).toBe(1);
  });

  it('preserves a stable deterministic fingerprint', async () => {
    const first = await execute();
    const second = await execute();
    expect(first.metadata.contextFingerprint).toBe(HASH_E);
    expect(second.metadata.contextFingerprint).toBe(HASH_E);
  });

  it('projects exactly once before repository execution', async () => {
    const state = dependencyState();
    const result = await execute(state);
    expect(
      result.stageTrace.filter(
        ({ stage }) => stage === 'PERSISTENCE_PROJECTION',
      ),
    ).toHaveLength(1);
    expect(state.repositoryContext?.schemaVersion).toBe('1');
  });

  it('calls repository exactly once on APPLY', async () => {
    const state = dependencyState();
    await execute(state);
    expect(state.repositoryCalls).toBe(1);
  });

  it.each([
    'PRINCIPAL',
    'SCOPE',
    'AUTHORIZATION',
    'OBLIGATION',
    'FINGERPRINT',
  ] as const)(
    'never calls repository when %s dependency fails',
    async (stage) => {
      const state = dependencyState();
      state.throwAt = stage;
      const result = await execute(state);
      expect(result.status).not.toBe('APPLIED');
      expect(state.repositoryCalls).toBe(0);
    },
  );

  it('passes the exact validated command instance to repository', async () => {
    const state = dependencyState();
    const request = applicationRequest();
    await execute(state, request);
    expect(state.repositoryCommand).toBe(request.command);
  });

  it('preserves operationId across authorization, context, and repository', async () => {
    const state = dependencyState();
    const result = await execute(state);
    expect(state.repositoryCommand?.operationId).toBe('operation_001');
    expect(state.fingerprintInput?.operation.operationId).toBe(
      'operation_001',
    );
    expect(result.metadata.operationId).toBe('operation_001');
  });

  it('preserves command fingerprint in repository context', async () => {
    const state = dependencyState();
    await execute(state);
    expect(state.fingerprintInput?.operation.commandFingerprint).toBe(
      HASH_B,
    );
  });

  it('preserves idempotency key and canonical binding metadata', async () => {
    const state = dependencyState();
    await execute(state);
    expect(state.repositoryCommand?.idempotencyKey).toBe(
      'idempotency_001',
    );
    expect(state.fingerprintInput?.idempotency.commandFingerprint).toBe(
      HASH_B,
    );
    expect(state.fingerprintInput?.idempotency.callerKeyHash).toBe(HASH_A);
  });

  it.each([
    ['principal', { actor: { actorType: 'USER', actorId: 'other_001' } }],
    ['operation', { operationId: 'other_operation_001' }],
  ] as const)(
    'rejects cross-%s command binding mismatch',
    async (_kind, commandOverride) => {
      const base = applicationRequest();
      const request = applicationRequest(['REQUIRE_IDEMPOTENCY_KEY'], {
        command: { ...base.command, ...commandOverride },
      });
      const state = dependencyState();
      const result = await execute(state, request);
      expect(result.status).toBe('REJECTED');
      expect(state.repositoryCalls).toBe(0);
    },
  );

  it('rejects cross-tenant authorization binding mismatch', async () => {
    const state = dependencyState();
    state.authorizationResult = {
      schemaVersion: '1',
      status: 'DECIDED',
      decision: authorizationDecision('ALLOW', [
        'REQUIRE_IDEMPOTENCY_KEY',
      ], {
        resourceBinding: {
          schemaVersion: '1',
          resourceType: 'TENANT',
          tenantId: 'tenant_other_001',
        },
      }),
    };
    const result = await execute(state);
    expect(result.status).not.toBe('APPLIED');
    expect(state.repositoryCalls).toBe(0);
  });

  it('enforces expected version obligation', async () => {
    const obligations = ['REQUIRE_EXPECTED_VERSION'] as const;
    const state = dependencyState();
    state.authorizationResult = {
      schemaVersion: '1',
      status: 'DECIDED',
      decision: authorizationDecision('ALLOW', obligations),
    };
    state.obligationResult = verificationResult(obligations);
    const result = await execute(
      state,
      applicationRequest(obligations),
    );
    expect(result.status).toBe('APPLIED');
  });

  it('rejects an unsatisfied expected version obligation', async () => {
    const obligations = ['REQUIRE_EXPECTED_VERSION'] as const;
    const state = dependencyState();
    state.authorizationResult = {
      schemaVersion: '1',
      status: 'DECIDED',
      decision: authorizationDecision('ALLOW', obligations),
    };
    state.obligationResult = verificationResult(obligations);
    const base = applicationRequest(obligations);
    const result = await execute(
      state,
      applicationRequest(obligations, {
        command: {
          ...base.command,
          precondition: { schemaVersion: '1', type: 'MUST_NOT_EXIST' },
        },
      }),
    );
    expect(result.status).toBe('REJECTED');
    expect(state.repositoryCalls).toBe(0);
  });

  it('enforces the idempotency obligation binding', async () => {
    const base = applicationRequest();
    const state = dependencyState();
    const result = await execute(
      state,
      applicationRequest(['REQUIRE_IDEMPOTENCY_KEY'], {
        idempotency: {
          ...base.idempotency,
          idempotencyKey: 'different_idempotency_001',
        },
      }),
    );
    expect(result.status).toBe('REJECTED');
    expect(state.repositoryCalls).toBe(0);
  });

  it.each([
    ['INTERNAL_NON_PRODUCTIVE', 'REJECTED'],
    ['TEST_ONLY', 'APPLIED'],
  ] as const)(
    'LIMIT_TO_TEST_ONLY in %s mode maps to %s',
    async (executionMode, expectedStatus) => {
      const obligations = ['LIMIT_TO_TEST_ONLY'] as const;
      const state = dependencyState();
      state.authorizationResult = {
        schemaVersion: '1',
        status: 'DECIDED',
        decision: authorizationDecision('ALLOW', obligations),
      };
      state.obligationResult = verificationResult(obligations);
      const result = await execute(
        state,
        applicationRequest(obligations),
        executionContext({ executionMode }),
      );
      expect(result.status).toBe(expectedStatus);
    },
  );

  it('preserves MASK_NOT_FOUND as safe result metadata', async () => {
    const obligations = ['MASK_NOT_FOUND'] as const;
    const state = dependencyState();
    state.authorizationResult = {
      schemaVersion: '1',
      status: 'DECIDED',
      decision: authorizationDecision('ALLOW', obligations),
    };
    state.obligationResult = verificationResult(obligations);
    state.repositoryResult = repositoryResult('NOT_FOUND');
    const result = await execute(
      state,
      applicationRequest(obligations),
    );
    expect(result.status).toBe('NOT_FOUND');
    expect(result.metadata.maskNotFound).toBe(true);
  });

  it.each([
    ['principal', () => resolvedPrincipal({
      freshness: {
        ...resolvedPrincipal().freshness,
        validUntil: '2026-07-30T12:01:20.000Z',
        staleAfterSeconds: 70,
      },
    })],
    ['scope', () => resolvedScope({
      freshness: {
        ...resolvedScope().freshness,
        validUntil: '2026-07-30T12:01:20.000Z',
        staleAfterSeconds: 70,
      },
    })],
    ['authorization', () => authorizationDecision('ALLOW', [
      'REQUIRE_IDEMPOTENCY_KEY',
    ], {
      freshness: {
        ...authorizationDecision().freshness,
        validUntil: '2026-07-30T12:01:20.000Z',
        staleAfterSeconds: 50,
      },
      policyEvidence: {
        ...authorizationDecision().policyEvidence,
        validUntil: '2026-07-30T12:01:20.000Z',
      },
    })],
  ] as const)(
    'stops when %s freshness expires',
    async (boundary, staleValue) => {
      const state = dependencyState();
      if (boundary === 'principal') {
        state.principalResult = {
          schemaVersion: '1',
          status: 'RESOLVED',
          principal: staleValue() as ReturnType<typeof resolvedPrincipal>,
        };
      } else if (boundary === 'scope') {
        state.scopeResult = {
          schemaVersion: '1',
          status: 'RESOLVED',
          scope: staleValue() as ReturnType<typeof resolvedScope>,
        };
      } else {
        state.authorizationResult = {
          schemaVersion: '1',
          status: 'DECIDED',
          decision: staleValue() as ReturnType<typeof authorizationDecision>,
        };
      }
      const result = await execute(state);
      expect(result.status).toBe('STALE');
      expect(state.repositoryCalls).toBe(0);
    },
  );
});

describe('Authority Application Service lifecycle and mapping', () => {
  it('cancels before request validation', async () => {
    const controller = new AbortController();
    controller.abort();
    const state = dependencyState();
    const result = await execute(
      state,
      applicationRequest(),
      executionContext({ cancellationSignal: controller.signal }),
    );
    expect(result.status).toBe('CANCELLED');
    expect(state.principalCalls).toBe(0);
  });

  it('cancels before principal dependency call', async () => {
    const controller = new AbortController();
    const state = dependencyState();
    state.controller = controller;
    const base = dependencies(state);
    const service = createAuthorityApplicationServiceV1({
      ...base,
      clock: {
        nowIso() {
          state.clockCalls += 1;
          if (state.clockCalls === 3) {
            controller.abort();
          }
          return NOW;
        },
      },
    });
    const result = await service.execute(
      applicationRequest(),
      executionContext({ cancellationSignal: controller.signal }),
    );
    expect(result.status).toBe('CANCELLED');
    expect(state.principalCalls).toBe(0);
  });

  it.each([
    ['after principal', 'PRINCIPAL'],
    ['before scope', 'PRINCIPAL'],
    ['before authorization', 'SCOPE'],
    ['before obligations', 'AUTHORIZATION'],
    ['before fingerprint', 'OBLIGATION'],
    ['before repository', 'FINGERPRINT'],
  ] as const)(
    'cancels %s without repository side effect',
    async (_boundary, abortAt) => {
      const controller = new AbortController();
      const state = dependencyState();
      state.abortAt = abortAt;
      state.controller = controller;
      const result = await execute(
        state,
        applicationRequest(),
        executionContext({ cancellationSignal: controller.signal }),
      );
      expect(result.status).toBe('CANCELLED');
      expect(state.repositoryCalls).toBe(0);
    },
  );

  it('maps deadline expiry to TIMED_OUT', async () => {
    const state = dependencyState();
    const result = await execute(
      state,
      applicationRequest(),
      executionContext({ deadlineAt: NOW }),
    );
    expect(result.status).toBe('TIMED_OUT');
    expect(state.principalCalls).toBe(0);
  });

  it('maps dependency unavailable safely', async () => {
    const state = dependencyState();
    state.throwAt = 'REPOSITORY';
    state.thrownError = new AuthorityApplicationServiceExecutionError(
      'AUTHORITY_DEPENDENCY_UNAVAILABLE',
      'RETRY_AFTER_DEPENDENCY_RECOVERY',
    );
    const result = await execute(state);
    expect(result.status).toBe('UNAVAILABLE');
    expect(result.safeCode).toBe('AUTHORITY_DEPENDENCY_UNAVAILABLE');
  });

  it('maps cancellation observed after repository without mapping success', async () => {
    const controller = new AbortController();
    const state = dependencyState();
    state.abortAt = 'REPOSITORY';
    state.controller = controller;
    const result = await execute(
      state,
      applicationRequest(),
      executionContext({ cancellationSignal: controller.signal }),
    );
    expect(result.status).toBe('CANCELLED');
    expect(result.stageTrace.at(-1)).toMatchObject({
      stage: 'REPOSITORY_EXECUTION',
      status: 'CANCELLED',
    });
  });

  it('rejects repository result identity drift', async () => {
    const state = dependencyState();
    state.repositoryResult = {
      ...repositoryResult(),
      operationId: 'different_operation_001',
    };
    const result = await execute(state);
    expect(result.status).toBe('REJECTED');
    expect(result.safeCode).toBe('AUTHORITY_COMMAND_BINDING_MISMATCH');
  });

  it.each([
    ['CONFLICT', 'CONFLICT'],
    ['NOT_FOUND', 'NOT_FOUND'],
    ['REJECTED', 'REJECTED'],
    ['NO_OP', 'REPLAYED'],
    ['INTERNAL_ERROR', 'INTERNAL_ERROR'],
  ] as const)(
    'maps repository %s to %s',
    async (repositoryStatus, expectedStatus) => {
      const state = dependencyState();
      state.repositoryResult = repositoryResult(repositoryStatus);
      const result = await execute(state);
      expect(result.status).toBe(expectedStatus);
    },
  );

  it('emits the exact successful stage order', async () => {
    const result = await execute();
    expect(result.stageTrace.map(({ stage }) => stage)).toEqual(
      AUTHORITY_APPLICATION_STAGES,
    );
    expect(result.stageTrace.every(({ status }) => status === 'COMPLETED'))
      .toBe(true);
  });

  it.each([
    'token',
    'claims',
    'firebaseUid',
    'payload',
    'document',
    'role',
    'isAdmin',
  ])('stage trace contains no sensitive %s material', async (word) => {
    const result = await execute();
    expect(JSON.stringify(result.stageTrace).toLowerCase()).not.toContain(
      word.toLowerCase(),
    );
  });
});

describe('Authority Application Service contracts and factory', () => {
  it('serializes validation errors with safe fields only', () => {
    const error = new AuthorityApplicationServiceValidationError(
      'INVALID_REQUEST',
      'request',
    );
    expect(error.toJSON()).toEqual({
      version: '1',
      code: 'AUTHORITY_APPLICATION_SERVICE_VALIDATION_FAILED',
      safeMessage: 'Authority application service value is invalid.',
      issue: 'INVALID_REQUEST',
      field: 'request',
      safeCode: 'AUTHORITY_REQUEST_INVALID',
      retryDisposition: 'DO_NOT_RETRY',
    });
    expect(JSON.stringify(error.toJSON())).not.toContain('firebase_uid');
  });

  it('validates closed dependencies', () => {
    const state = dependencyState();
    expect(
      validateAuthorityApplicationServiceDependenciesV1(
        dependencies(state),
      ).repository,
    ).toBeDefined();
  });

  it('rejects unknown dependency fields', () => {
    const state = dependencyState();
    const value = { ...dependencies(state), hiddenRuntime: {} };
    expect(() =>
      validateAuthorityApplicationServiceDependenciesV1(value),
    ).toThrow(AuthorityApplicationServiceValidationError);
  });

  it.each([
    'principalResolver',
    'tenantScopeResolver',
    'authorizationEvaluator',
    'obligationVerifier',
    'contextFingerprintProvider',
    'repository',
    'clock',
  ] as const)('rejects invalid %s dependency', (dependencyName) => {
    const state = dependencyState();
    const value = {
      ...dependencies(state),
      [dependencyName]: Object.freeze({}),
    };
    expect(() =>
      validateAuthorityApplicationServiceDependenciesV1(value),
    ).toThrow(AuthorityApplicationServiceValidationError);
  });

  it('does not call clock during factory creation', () => {
    const state = dependencyState();
    createAuthorityApplicationServiceV1(dependencies(state));
    expect(state.clockCalls).toBe(0);
  });

  it('returns a frozen service with exactly version and execute', () => {
    const service = createAuthorityApplicationServiceV1(
      dependencies(dependencyState()),
    );
    expect(Object.isFrozen(service)).toBe(true);
    expect(Object.keys(service).sort()).toEqual(['execute', 'version']);
  });

  it('produces deterministic results with deterministic fakes', async () => {
    const first = await execute();
    const second = await execute();
    expect(first).toEqual(second);
  });

  it.each([
    ['request', () => validateAuthorityApplicationServiceRequestV1({
      ...applicationRequest(),
      unknownField: true,
    })],
    ['context', () => validateAuthorityApplicationExecutionContextV1({
      ...executionContext(),
      unknownField: true,
    })],
  ])('rejects unknown %s fields', (_name, validate) => {
    expect(validate).toThrow(AuthorityApplicationServiceValidationError);
  });

  it('keeps the result and its trace immutable', async () => {
    const result = await execute();
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.stageTrace)).toBe(true);
    expect(Object.isFrozen(result.metadata)).toBe(true);
  });

  it('returns only the closed result status vocabulary', async () => {
    const result = await execute();
    expect([
      'APPLIED',
      'REPLAYED',
      'REJECTED',
      'NOT_AUTHORIZED',
      'STALE',
      'CONFLICT',
      'NOT_FOUND',
      'CANCELLED',
      'TIMED_OUT',
      'UNAVAILABLE',
      'INTERNAL_ERROR',
    ] satisfies readonly AuthorityApplicationResultStatus[]).toContain(
      result.status,
    );
  });
});
