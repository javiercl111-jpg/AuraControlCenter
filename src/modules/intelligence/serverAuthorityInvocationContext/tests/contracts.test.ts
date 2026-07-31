import { describe, expect, it } from 'vitest';
import {
  AuthorityInvocationContextProjectionError,
  AuthorityInvocationContextValidationError,
  createAuthorityInvocationAuthorizationProjectionV1,
  createAuthorityInvocationContextResultV1,
  createAuthorityInvocationContextV1,
  createAuthorityInvocationFreshnessV1,
  createAuthorityInvocationIdempotencyV1,
  createAuthorityInvocationOperationBindingV1,
  createAuthorityInvocationPrincipalProjectionV1,
  createAuthorityInvocationRequestMetadataV1,
  createAuthorityInvocationScopeProjectionV1,
  createAuthorityObligationSatisfactionEvidenceV1,
  createAuthorityObligationSatisfactionSummaryV1,
  projectAuthorityInvocationContextToRepositoryV1,
} from '../index';

const PRINCIPAL_ID = 'apr_v1_human_binding_human_001';
const TENANT_ID = 'tenant_001';
const HASH_A = `sha256:${'a'.repeat(64)}`;
const HASH_B = `sha256:${'b'.repeat(64)}`;
const HASH_C = `sha256:${'c'.repeat(64)}`;
const HASH_D = `sha256:${'d'.repeat(64)}`;
const HASH_E = `sha256:${'e'.repeat(64)}`;
const HASH_F = `sha256:${'f'.repeat(64)}`;
const PRINCIPAL_RESOLVED_AT = '2026-07-30T11:50:00.000Z';
const SCOPE_RESOLVED_AT = '2026-07-30T11:51:00.000Z';
const RECEIVED_AT = '2026-07-30T11:59:00.000Z';
const EVALUATED_AT = '2026-07-30T12:00:00.000Z';
const CREATED_AT = '2026-07-30T12:01:00.000Z';
const OBLIGATION_VALID_UNTIL = '2026-07-30T12:05:00.000Z';
const AUTHORIZATION_VALID_UNTIL = '2026-07-30T12:10:00.000Z';
const SCOPE_VALID_UNTIL = '2026-07-30T12:15:00.000Z';
const PRINCIPAL_VALID_UNTIL = '2026-07-30T12:20:00.000Z';

type Input = Readonly<Record<string, unknown>>;

function principal(overrides: Input = {}): Input {
  return {
    schemaVersion: '1',
    principalId: PRINCIPAL_ID,
    principalType: 'HUMAN_USER',
    principalStatus: 'ACTIVE',
    authenticationMethod: 'FIREBASE_ID_TOKEN',
    assuranceLevel: 'HIGH',
    principalBindingVersion: 'principal-v1',
    principalEvidenceFingerprint: HASH_A,
    principalResolvedAt: PRINCIPAL_RESOLVED_AT,
    principalValidUntil: PRINCIPAL_VALID_UNTIL,
    ...overrides,
  };
}

function scopeBase(
  scopeType: string,
  scopeStatus = 'ACTIVE',
): Input {
  return {
    schemaVersion: '1',
    scopeType,
    scopeStatus,
    scopeEvidenceFingerprint: HASH_B,
    scopeResolvedAt: SCOPE_RESOLVED_AT,
    scopeValidUntil: SCOPE_VALID_UNTIL,
    bindingVersion: 'scope-binding-v1',
  };
}

function tenantScope(overrides: Input = {}): Input {
  return {
    ...scopeBase('TENANT'),
    tenantId: TENANT_ID,
    tenantAuthorityVersion: 'tenant-v1',
    membershipBindingVersion: 'membership-v1',
    ...overrides,
  };
}

function platformScope(): Input {
  return {
    ...scopeBase('PLATFORM'),
    platformBoundary: 'AUTHORITY_CONTROL_PLANE',
    operationCategory: 'TENANT_ADMINISTRATION',
  };
}

function bootstrapScope(): Input {
  return {
    ...scopeBase('TENANT_BOOTSTRAP', 'PENDING_BOOTSTRAP'),
    bootstrapRequestId: 'bootstrap_001',
    tenantIdCandidate: TENANT_ID,
    candidateFingerprint: HASH_C,
  };
}

function legacyScope(): Input {
  return {
    ...scopeBase(
      'LEGACY_CANONICALIZATION',
      'LEGACY_PENDING_CANONICALIZATION',
    ),
    sourceLocatorKey: 'PLATFORM_TENANTS:legacy_tenant_001',
    canonicalTenantCandidateId: TENANT_ID,
    sourceFingerprint: HASH_C,
  };
}

function migrationScope(): Input {
  return {
    ...scopeBase('MIGRATION'),
    migrationId: 'migration_001',
    migrationRunId: 'migration_run_001',
    manifestVersion: 'manifest-v1',
    scopeFingerprint: HASH_C,
    targetTenantIds: [TENANT_ID, 'tenant_002'],
  };
}

function supportScope(): Input {
  return {
    ...scopeBase('SUPPORT'),
    scopeValidUntil: AUTHORIZATION_VALID_UNTIL,
    supportSessionId: 'support_session_001',
    targetTenantId: TENANT_ID,
    sessionValidUntil: AUTHORIZATION_VALID_UNTIL,
    impersonationMode: 'EXPLICITLY_PROHIBITED',
  };
}

function operation(overrides: Input = {}): Input {
  return {
    schemaVersion: '1',
    operationType: 'UPDATE_TENANT_STATUS',
    permission: 'authority.tenant.status.update',
    resourceType: 'TENANT',
    resourceId: TENANT_ID,
    resourceTenantId: TENANT_ID,
    operationId: 'operation_001',
    commandFingerprint: HASH_C,
    authorizationInputFingerprint: HASH_D,
    consumerId: 'authority_application_service',
    source: 'authority_invocation_context',
    ...overrides,
  };
}

function authorization(overrides: Input = {}): Input {
  return {
    schemaVersion: '1',
    decision: 'ALLOW',
    permission: 'authority.tenant.status.update',
    principalId: PRINCIPAL_ID,
    scopeType: 'TENANT',
    tenantId: TENANT_ID,
    operationType: 'UPDATE_TENANT_STATUS',
    resourceType: 'TENANT',
    resourceId: TENANT_ID,
    resourceTenantId: TENANT_ID,
    policyId: 'authority_policy_001',
    policyVersion: 'policy-v1',
    decisionRuleId: 'tenant_status_update_rule',
    authorizationFingerprint: HASH_E,
    authorizationInputFingerprint: HASH_D,
    evaluatedAt: EVALUATED_AT,
    validUntil: AUTHORIZATION_VALID_UNTIL,
    declaredObligationTypes: ['REQUIRE_MFA'],
    obligationsFingerprint: HASH_F,
    reasonCode: 'POLICY_RULE_MATCHED',
    status: 'CURRENT',
    ...overrides,
  };
}

function obligation(overrides: Input = {}): Input {
  return {
    schemaVersion: '1',
    obligationType: 'REQUIRE_MFA',
    satisfactionStatus: 'SATISFIED',
    satisfiedAt: CREATED_AT,
    evidenceFingerprint: HASH_E,
    verifierVersion: 'verifier-v1',
    validUntil: OBLIGATION_VALID_UNTIL,
    safeReference: 'mfa_evidence_001',
    ...overrides,
  };
}

function summary(overrides: Input = {}): Input {
  return {
    schemaVersion: '1',
    total: 1,
    satisfied: 1,
    notApplicable: 0,
    stale: 0,
    notSatisfied: 0,
    fingerprint: HASH_F,
    ...overrides,
  };
}

function request(overrides: Input = {}): Input {
  return {
    schemaVersion: '1',
    requestId: 'request_001',
    correlationId: 'correlation_001',
    causationId: 'causation_001',
    channel: 'FIREBASE_CALLABLE',
    receivedAt: RECEIVED_AT,
    createdAt: CREATED_AT,
    traceId: 'trace_001',
    clientRequestIdHash: HASH_A,
    ...overrides,
  };
}

function idempotency(overrides: Input = {}): Input {
  return {
    schemaVersion: '1',
    callerKeyHash: HASH_A,
    namespaceVersion: 'principal-scope-operation-v1',
    scopeFingerprint: HASH_B,
    principalId: PRINCIPAL_ID,
    tenantId: TENANT_ID,
    operationType: 'UPDATE_TENANT_STATUS',
    operationId: 'operation_001',
    commandFingerprint: HASH_C,
    createdAt: RECEIVED_AT,
    ...overrides,
  };
}

function freshness(overrides: Input = {}): Input {
  return {
    schemaVersion: '1',
    evaluatedAt: EVALUATED_AT,
    validUntil: OBLIGATION_VALID_UNTIL,
    principalValidUntil: PRINCIPAL_VALID_UNTIL,
    scopeValidUntil: SCOPE_VALID_UNTIL,
    authorizationValidUntil: AUTHORIZATION_VALID_UNTIL,
    obligationValidUntil: OBLIGATION_VALID_UNTIL,
    staleAfterSeconds: 300,
    ...overrides,
  };
}

function context(overrides: Input = {}): Input {
  return {
    version: '1',
    principal: principal(),
    scope: tenantScope(),
    authorization: authorization(),
    operation: operation(),
    request: request(),
    idempotency: idempotency(),
    obligationSatisfaction: [obligation()],
    obligationSummary: summary(),
    freshness: freshness(),
    contextFingerprint: HASH_A,
    createdAt: CREATED_AT,
    status: 'READY',
    ...overrides,
  };
}

function deniedContext(
  decision = 'DENY',
  reasonCode = 'PERMISSION_NOT_GRANTED',
): Input {
  return context({
    authorization: authorization({ decision, reasonCode }),
    status: 'NOT_AUTHORIZED',
  });
}

describe('Authority invocation context contracts', () => {
  it('1 validates a minimal principal projection without identity aliases', () => {
    const value = createAuthorityInvocationPrincipalProjectionV1(
      principal(),
    );
    expect(value.principalId).toBe(PRINCIPAL_ID);
    expect(value).not.toHaveProperty('firebaseUid');
    expect(value).not.toHaveProperty('platformUserId');
  });

  it('2 validates the tenant scope projection', () => {
    expect(createAuthorityInvocationScopeProjectionV1(tenantScope())).toMatchObject({
      scopeType: 'TENANT',
      tenantId: TENANT_ID,
    });
  });

  it('3 keeps platform scope free of a synthetic tenant', () => {
    const value =
      createAuthorityInvocationScopeProjectionV1(platformScope());
    expect(value.scopeType).toBe('PLATFORM');
    expect(value).not.toHaveProperty('tenantId');
  });

  it.each([
    ['4 bootstrap', bootstrapScope(), 'TENANT_BOOTSTRAP'],
    ['5 legacy', legacyScope(), 'LEGACY_CANONICALIZATION'],
    ['6 migration', migrationScope(), 'MIGRATION'],
    ['7 support', supportScope(), 'SUPPORT'],
  ])('%s projection is valid', (_name, input, expected) => {
    expect(createAuthorityInvocationScopeProjectionV1(input).scopeType).toBe(
      expected,
    );
  });

  it('8 validates an ALLOW authorization projection', () => {
    expect(
      createAuthorityInvocationAuthorizationProjectionV1(authorization())
        .decision,
    ).toBe('ALLOW');
  });

  it.each([
    ['9 DENY', deniedContext()],
    ['10 INDETERMINATE', deniedContext('INDETERMINATE', 'POLICY_NOT_FOUND')],
    [
      '11 NOT_APPLICABLE',
      deniedContext('NOT_APPLICABLE', 'OPERATION_NOT_SUPPORTED'),
    ],
  ])('%s is representable but cannot reach persistence', (_name, input) => {
    expect(createAuthorityInvocationContextV1(input).status).toBe(
      'NOT_AUTHORIZED',
    );
    expect(() =>
      projectAuthorityInvocationContextToRepositoryV1(input),
    ).toThrow(AuthorityInvocationContextProjectionError);
  });

  it('12 rejects an operation/permission mismatch', () => {
    expect(() =>
      createAuthorityInvocationOperationBindingV1(
        operation({ permission: 'authority.alias.reserve' }),
      ),
    ).toThrow(AuthorityInvocationContextValidationError);
  });

  it('13 rejects a principal mismatch', () => {
    expect(() =>
      createAuthorityInvocationContextV1(
        context({
          idempotency: idempotency({ principalId: 'other_principal' }),
        }),
      ),
    ).toThrow(AuthorityInvocationContextValidationError);
  });

  it('14 rejects a scope mismatch', () => {
    expect(() =>
      createAuthorityInvocationContextV1(
        context({
          authorization: authorization({
            scopeType: 'PLATFORM',
            tenantId: undefined,
            resourceTenantId: undefined,
          }),
        }),
      ),
    ).toThrow(AuthorityInvocationContextValidationError);
  });

  it('15 rejects a tenant mismatch', () => {
    expect(() =>
      createAuthorityInvocationContextV1(
        context({
          idempotency: idempotency({ tenantId: 'tenant_002' }),
        }),
      ),
    ).toThrow(AuthorityInvocationContextValidationError);
  });

  it('16 rejects a resource-scope mismatch', () => {
    expect(() =>
      createAuthorityInvocationContextV1(
        context({
          operation: operation({ resourceTenantId: 'tenant_002' }),
          authorization: authorization({
            resourceTenantId: 'tenant_002',
          }),
        }),
      ),
    ).toThrow(AuthorityInvocationContextValidationError);
  });

  it.each([
    ['17 operationId', { operationId: 'operation_002' }],
    ['18 command fingerprint', { commandFingerprint: HASH_D }],
    ['19 cross-principal', { principalId: 'other_principal' }],
    ['20 cross-tenant', { tenantId: 'tenant_002' }],
    ['21 cross-operation', { operationType: 'RESERVE_TENANT_ALIAS' }],
  ])('rejects %s idempotency reuse', (_name, overrides) => {
    expect(() =>
      createAuthorityInvocationContextV1(
        context({ idempotency: idempotency(overrides) }),
      ),
    ).toThrow(AuthorityInvocationContextValidationError);
  });

  it.each([
    ['22 satisfied', 'SATISFIED'],
    ['23 not applicable', 'NOT_APPLICABLE'],
  ])('accepts an obligation marked %s', (_name, satisfactionStatus) => {
    const obligationSummary =
      satisfactionStatus === 'SATISFIED'
        ? summary()
        : summary({ satisfied: 0, notApplicable: 1 });
    expect(
      createAuthorityInvocationContextV1(
        context({
          obligationSatisfaction: [obligation({ satisfactionStatus })],
          obligationSummary,
        }),
      ).status,
    ).toBe('READY');
  });

  it('24 rejects a missing obligation', () => {
    expect(() =>
      createAuthorityInvocationContextV1(
        context({
          obligationSatisfaction: [],
          obligationSummary: summary({
            total: 0,
            satisfied: 0,
          }),
        }),
      ),
    ).toThrow(AuthorityInvocationContextValidationError);
  });

  it('25 rejects a duplicate obligation', () => {
    expect(() =>
      createAuthorityInvocationContextV1(
        context({
          obligationSatisfaction: [obligation(), obligation()],
          obligationSummary: summary({ total: 2, satisfied: 2 }),
        }),
      ),
    ).toThrow(AuthorityInvocationContextValidationError);
  });

  it.each([
    ['26 not satisfied', 'NOT_SATISFIED', { notSatisfied: 1 }],
    ['27 stale', 'STALE', { stale: 1 }],
  ])('a READY context rejects an obligation %s', (_name, status, counts) => {
    expect(() =>
      createAuthorityInvocationContextV1(
        context({
          obligationSatisfaction: [
            obligation({ satisfactionStatus: status }),
          ],
          obligationSummary: summary({
            satisfied: 0,
            ...counts,
          }),
        }),
      ),
    ).toThrow(AuthorityInvocationContextValidationError);
  });

  it('28 rejects an undeclared obligation', () => {
    expect(() =>
      createAuthorityInvocationContextV1(
        context({
          obligationSatisfaction: [
            obligation({ obligationType: 'REQUIRE_APP_CHECK' }),
          ],
        }),
      ),
    ).toThrow(AuthorityInvocationContextValidationError);
  });

  it('29 validates exact summary counts', () => {
    expect(
      createAuthorityObligationSatisfactionSummaryV1(summary()).total,
    ).toBe(1);
    expect(() =>
      createAuthorityObligationSatisfactionSummaryV1(
        summary({ total: 2 }),
      ),
    ).toThrow(AuthorityInvocationContextValidationError);
  });

  it('30 rejects an obligation fingerprint mismatch', () => {
    expect(() =>
      createAuthorityInvocationContextV1(
        context({
          obligationSummary: summary({ fingerprint: HASH_E }),
        }),
      ),
    ).toThrow(AuthorityInvocationContextValidationError);
  });

  it('31 accepts freshness at the exact minimum', () => {
    expect(createAuthorityInvocationFreshnessV1(freshness()).validUntil).toBe(
      OBLIGATION_VALID_UNTIL,
    );
  });

  it.each([
    [
      '32 principal',
      {
        validUntil: PRINCIPAL_VALID_UNTIL,
        staleAfterSeconds: 1_200,
      },
    ],
    [
      '33 scope',
      { validUntil: SCOPE_VALID_UNTIL, staleAfterSeconds: 900 },
    ],
    [
      '34 authorization',
      {
        validUntil: AUTHORIZATION_VALID_UNTIL,
        staleAfterSeconds: 600,
      },
    ],
  ])('rejects freshness extending past %s', (_name, overrides) => {
    expect(() =>
      createAuthorityInvocationFreshnessV1(freshness(overrides)),
    ).toThrow(AuthorityInvocationContextValidationError);
  });

  it('35 bounds support scope by session expiry', () => {
    expect(() =>
      createAuthorityInvocationScopeProjectionV1({
        ...supportScope(),
        scopeValidUntil: PRINCIPAL_VALID_UNTIL,
      }),
    ).toThrow(AuthorityInvocationContextValidationError);
  });

  it('36 validates request metadata without authority fields', () => {
    expect(
      createAuthorityInvocationRequestMetadataV1(request()).requestId,
    ).toBe('request_001');
  });

  it('37 preserves distinct request, correlation, causation, and operation IDs', () => {
    const value = createAuthorityInvocationContextV1(context());
    expect([
      value.request.requestId,
      value.request.correlationId,
      value.request.causationId,
      value.operation.operationId,
    ]).toEqual([
      'request_001',
      'correlation_001',
      'causation_001',
      'operation_001',
    ]);
  });

  it.each([
    ['38 caller ALLOW', { callerAllow: true }],
    ['39 role', { role: 'admin' }],
    ['40 raw token', { token: 'secret' }],
    ['41 claims', { claims: {} }],
  ])('rejects forbidden request metadata: %s', (_name, extra) => {
    expect(() =>
      createAuthorityInvocationRequestMetadataV1({
        ...request(),
        ...extra,
      }),
    ).toThrow(AuthorityInvocationContextValidationError);
  });

  it('42 validates a READY context', () => {
    expect(createAuthorityInvocationContextV1(context()).status).toBe(
      'READY',
    );
  });

  it.each([
    ['43 NOT_AUTHORIZED', deniedContext(), 'NOT_AUTHORIZED'],
    [
      '44 STALE',
      context({
        authorization: authorization({ status: 'STALE' }),
        status: 'STALE',
      }),
      'STALE',
    ],
    ['45 INCOMPLETE', context({ status: 'INCOMPLETE' }), 'INCOMPLETE'],
    ['46 CONFLICT', context({ status: 'CONFLICT' }), 'CONFLICT'],
    ['46b REJECTED', context({ status: 'REJECTED' }), 'REJECTED'],
  ])('validates %s rich context', (_name, input, expected) => {
    expect(createAuthorityInvocationContextV1(input).status).toBe(expected);
  });

  it('47 rejects an unknown context status', () => {
    expect(() =>
      createAuthorityInvocationContextV1(
        context({ status: 'UNKNOWN' }),
      ),
    ).toThrow(AuthorityInvocationContextValidationError);
  });

  it('48 READY requires an active principal', () => {
    expect(() =>
      createAuthorityInvocationContextV1(
        context({
          principal: principal({ principalStatus: 'SUSPENDED' }),
        }),
      ),
    ).toThrow(AuthorityInvocationContextValidationError);
  });

  it('49 READY requires a compatible scope status', () => {
    expect(() =>
      createAuthorityInvocationContextV1(
        context({ scope: tenantScope({ scopeStatus: 'SUSPENDED' }) }),
      ),
    ).toThrow(AuthorityInvocationContextValidationError);
  });

  it('50 READY requires ALLOW', () => {
    expect(() =>
      createAuthorityInvocationContextV1(
        context({
          authorization: authorization({
            decision: 'DENY',
            reasonCode: 'PERMISSION_NOT_GRANTED',
          }),
        }),
      ),
    ).toThrow(AuthorityInvocationContextValidationError);
  });

  it('51 READY requires all obligations', () => {
    expect(() =>
      createAuthorityInvocationContextV1(
        context({
          obligationSatisfaction: [],
          obligationSummary: summary({ total: 0, satisfied: 0 }),
        }),
      ),
    ).toThrow(AuthorityInvocationContextValidationError);
  });

  it('52 READY requires consistent input fingerprints', () => {
    expect(() =>
      createAuthorityInvocationContextV1(
        context({
          operation: operation({
            authorizationInputFingerprint: HASH_E,
          }),
        }),
      ),
    ).toThrow(AuthorityInvocationContextValidationError);
  });

  it('53 projects the exact repository context shape', () => {
    const projected = projectAuthorityInvocationContextToRepositoryV1(
      context(),
    );
    expect(Object.keys(projected).sort()).toEqual(
      [
        'schemaVersion',
        'principal',
        'actor',
        'authorizationDecision',
        'authorizedOperationTypes',
        'consumerId',
        'source',
        'requestId',
        'correlationId',
        'initiatedAt',
        'authorizationVersion',
      ].sort(),
    );
  });

  it('54 projects the minimal ALLOWED decision', () => {
    expect(
      projectAuthorityInvocationContextToRepositoryV1(context())
        .authorizationDecision,
    ).toEqual({
      schemaVersion: '1',
      decisionVersion: '1',
      decision: 'ALLOWED',
      authorizationVersion: 'policy-v1',
      operationTypes: ['UPDATE_TENANT_STATUS'],
      principalType: 'USER',
      principalId: PRINCIPAL_ID,
      actorType: 'USER',
      actorId: PRINCIPAL_ID,
      decidedAt: EVALUATED_AT,
      expiresAt: OBLIGATION_VALID_UNTIL,
      safeReasonCode: 'POLICY_RULE_MATCHED',
    });
  });

  it('55 excludes rich evidence from persistence', () => {
    const serialized = JSON.stringify(
      projectAuthorityInvocationContextToRepositoryV1(context()),
    );
    expect(serialized).not.toContain('obligationSatisfaction');
    expect(serialized).not.toContain('authorizationInputFingerprint');
    expect(serialized).not.toContain('decisionRuleId');
    expect(serialized).not.toContain('scopeEvidenceFingerprint');
  });

  it.each([
    ['56 non-READY', context({ status: 'CONFLICT' })],
    ['57 DENY', deniedContext()],
    [
      '58 stale',
      context({
        authorization: authorization({ status: 'STALE' }),
        status: 'STALE',
      }),
    ],
  ])('projection rejects %s context', (_name, input) => {
    expect(() =>
      projectAuthorityInvocationContextToRepositoryV1(input),
    ).toThrow(AuthorityInvocationContextProjectionError);
  });

  it('60 returns deeply immutable factory outputs', () => {
    const value = createAuthorityInvocationContextV1(context());
    expect(Object.isFrozen(value)).toBe(true);
    expect(Object.isFrozen(value.principal)).toBe(true);
    expect(Object.isFrozen(value.obligationSatisfaction)).toBe(true);
    expect(Object.isFrozen(value.obligationSatisfaction[0])).toBe(true);
  });

  it('61 factories are deterministic', () => {
    expect(createAuthorityInvocationContextV1(context())).toEqual(
      createAuthorityInvocationContextV1(context()),
    );
  });

  it('validates individual obligation, operation, idempotency, and request factories', () => {
    expect(
      createAuthorityObligationSatisfactionEvidenceV1(obligation())
        .obligationType,
    ).toBe('REQUIRE_MFA');
    expect(
      createAuthorityInvocationOperationBindingV1(operation())
        .operationId,
    ).toBe('operation_001');
    expect(
      createAuthorityInvocationIdempotencyV1(idempotency()).tenantId,
    ).toBe(TENANT_ID);
  });

  it('validates READY and safe failure result unions', () => {
    expect(
      createAuthorityInvocationContextResultV1({
        schemaVersion: '1',
        status: 'READY',
        context: context(),
      }).status,
    ).toBe('READY');
    expect(
      createAuthorityInvocationContextResultV1({
        schemaVersion: '1',
        status: 'CONFLICT',
        reasonCode: 'INVOCATION_CONTEXT_CONFLICT',
        retryDisposition: 'RETRY_AFTER_OPERATOR_REVIEW',
        safeMetadata: {
          requestId: 'request_001',
          contextFingerprint: HASH_A,
        },
      }).status,
    ).toBe('CONFLICT');
  });

  it('rejects a principal/authentication-method mismatch', () => {
    expect(() =>
      createAuthorityInvocationPrincipalProjectionV1(
        principal({ authenticationMethod: 'IAM_OIDC' }),
      ),
    ).toThrow(AuthorityInvocationContextValidationError);
  });

  it('rejects invalid context fingerprints and unknown symbol keys', () => {
    expect(() =>
      createAuthorityInvocationContextV1(
        context({ contextFingerprint: 'not-a-fingerprint' }),
      ),
    ).toThrow(AuthorityInvocationContextValidationError);
    const symbol = Symbol('hidden');
    expect(() =>
      createAuthorityInvocationRequestMetadataV1({
        ...request(),
        [symbol]: 'hidden',
      }),
    ).toThrow(AuthorityInvocationContextValidationError);
  });

  it('rejects class instances and non-finite summary values', () => {
    class RequestInstance {}
    expect(() =>
      createAuthorityInvocationRequestMetadataV1(
        new RequestInstance(),
      ),
    ).toThrow(AuthorityInvocationContextValidationError);
    expect(() =>
      createAuthorityObligationSatisfactionSummaryV1(
        summary({ total: Number.POSITIVE_INFINITY }),
      ),
    ).toThrow(AuthorityInvocationContextValidationError);
  });
});
