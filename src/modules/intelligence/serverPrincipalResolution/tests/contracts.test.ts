import { describe, expect, it } from 'vitest';
import {
  AuthorityPrincipalResolutionError,
  AuthorityPrincipalValidationError,
  createAuthorityAuthenticationClaimsSnapshotV1,
  createAuthorityPrincipalIdV1,
  createAuthorityPrincipalResolutionContextV1,
  createAuthorityPrincipalResolutionRequestV1,
  createAuthorityPrincipalResolutionResultV1,
  createResolvedHumanAuthorityPrincipalV1,
  createResolvedInternalServicePrincipalV1,
  createResolvedMigrationActorPrincipalV1,
  createResolvedSupportOperatorPrincipalV1,
  createResolvedSystemActorPrincipalV1,
  validateAuthorityAppCheckEvidenceV1,
  validateAuthorityAuthenticationAssuranceV1,
  validateAuthorityAuthenticationMethodV1,
  validateAuthorityFirebaseUidV1,
  validateAuthorityPlatformUserIdV1,
  validateAuthorityPrincipalFreshnessV1,
  validateAuthorityPrincipalResolutionRequestV1,
  validateAuthorityServicePrincipalIdV1,
  validateAuthorityTimestampV1,
  type AuthorityAuthenticationMethod,
  type AuthorityPrincipalResolverPort,
  type AuthorityPrincipalResolutionRequestV1,
  type AuthorityPrincipalResolutionResultV1,
} from '../index';

const AUTH_TIME = '2026-07-30T11:59:00.000Z';
const TOKEN_ISSUED_AT = '2026-07-30T12:00:00.000Z';
const TOKEN_EXPIRES_AT = '2026-07-30T13:00:00.000Z';
const AUTHENTICATED_AT = '2026-07-30T12:00:05.000Z';
const REVOCATION_CHECKED_AT = '2026-07-30T12:00:06.000Z';
const RESOLVED_AT = '2026-07-30T12:00:10.000Z';
const VALID_UNTIL = '2026-07-30T12:05:10.000Z';
const HASH_A = `sha256:${'a'.repeat(64)}`;
const HASH_B = `sha256:${'b'.repeat(64)}`;
const HASH_C = `sha256:${'c'.repeat(64)}`;

function appCheckValid(): Readonly<Record<string, unknown>> {
  return {
    schemaVersion: '1',
    status: 'REQUIRED_AND_VALID',
    applicationIdHash: HASH_A,
    attestationProvider: 'play_integrity',
    verifiedAt: AUTHENTICATED_AT,
    replayProtection: 'ENFORCED',
  };
}

function appCheckInternal(): Readonly<Record<string, unknown>> {
  return {
    schemaVersion: '1',
    status: 'NOT_APPLICABLE_INTERNAL_CALLER',
    reason: 'NON_APP_CALLER',
  };
}

function claimsSnapshot(): Readonly<Record<string, unknown>> {
  return {
    schemaVersion: '1',
    claimsVersion: 'claims-v1',
    tokenIssuedAt: TOKEN_ISSUED_AT,
    tokenAuthTime: AUTH_TIME,
    tokenExpiresAt: TOKEN_EXPIRES_AT,
    issuer: 'https://securetoken.example.test',
    audience: 'aura-control-center',
    subjectFingerprint: HASH_A,
    snapshotFingerprint: HASH_B,
  };
}

function firebaseBinding(
  overrides: Readonly<Record<string, unknown>> = {},
): Readonly<Record<string, unknown>> {
  return {
    schemaVersion: '1',
    bindingType: 'FIREBASE_USER',
    bindingId: 'binding_human_001',
    bindingVersion: 'binding-v1',
    authenticationMethod: 'FIREBASE_ID_TOKEN',
    firebaseUid: 'firebase_uid_001',
    platformUserId: 'platform_user_001',
    tokenIssuedAt: TOKEN_ISSUED_AT,
    tokenAuthTime: AUTH_TIME,
    authProvider: 'FEDERATED_OIDC',
    tokenIdHash: HASH_B,
    claimsVersion: 'claims-v1',
    ...overrides,
  };
}

function assurance(
  authenticationMethod: AuthorityAuthenticationMethod,
  appCheckEvidence: Readonly<Record<string, unknown>>,
  overrides: Readonly<Record<string, unknown>> = {},
): Readonly<Record<string, unknown>> {
  return {
    schemaVersion: '1',
    level: 'STANDARD',
    authenticationMethod,
    authenticatedAt: AUTHENTICATED_AT,
    freshnessWindowSeconds: 300,
    secondFactorSatisfied: true,
    appCheckEvidence,
    tokenRevocationChecked:
      authenticationMethod === 'FIREBASE_ID_TOKEN' ||
      authenticationMethod === 'SUPPORT_SESSION',
    issuerValidated: true,
    audienceValidated: true,
    ...overrides,
  };
}

function evidence(
  authenticationSource: string,
  bindingSource: string,
  assuranceLevel: string,
  overrides: Readonly<Record<string, unknown>> = {},
): Readonly<Record<string, unknown>> {
  return {
    schemaVersion: '1',
    authenticationSource,
    bindingSource,
    canonicalBindingVersion: 'binding-v1',
    revocationCheckStatus:
      authenticationSource === 'FIREBASE_AUTH'
        ? 'CHECKED_VALID'
        : 'NOT_APPLICABLE_INTERNAL_CALLER',
    assuranceLevel,
    resolverVersion: 'resolver-v1',
    resolvedAt: RESOLVED_AT,
    evidenceFingerprint: HASH_C,
    ...overrides,
  };
}

function freshness(
  overrides: Readonly<Record<string, unknown>> = {},
): Readonly<Record<string, unknown>> {
  return {
    schemaVersion: '1',
    resolvedAt: RESOLVED_AT,
    validUntil: VALID_UNTIL,
    sourceVersion: 'identity-source-v1',
    bindingVersion: 'binding-v1',
    staleAfterSeconds: 300,
    ...overrides,
  };
}

function humanPrincipal(
  overrides: Readonly<Record<string, unknown>> = {},
): Readonly<Record<string, unknown>> {
  return {
    schemaVersion: '1',
    version: '1',
    principalId: 'apr_v1_human_binding_human_001',
    principalType: 'HUMAN_USER',
    firebaseUid: 'firebase_uid_001',
    platformUserId: 'platform_user_001',
    status: 'ACTIVE',
    authenticationBinding: firebaseBinding(),
    assurance: assurance('FIREBASE_ID_TOKEN', appCheckValid()),
    resolutionEvidence: evidence(
      'FIREBASE_AUTH',
      'PLATFORM_IDENTITY_REGISTRY',
      'STANDARD',
      {
        claimsVersion: 'claims-v1',
        claimsSnapshot: claimsSnapshot(),
      },
    ),
    resolvedAt: RESOLVED_AT,
    freshness: freshness({
      claimsVersion: 'claims-v1',
      revocationCheckedAt: REVOCATION_CHECKED_AT,
    }),
    ...overrides,
  };
}

function iamBinding(): Readonly<Record<string, unknown>> {
  return {
    schemaVersion: '1',
    bindingType: 'IAM_SERVICE',
    bindingId: 'binding_service_001',
    bindingVersion: 'binding-v1',
    authenticationMethod: 'IAM_OIDC',
    servicePrincipalId: 'service_principal_001',
    issuer: 'https://accounts.example.test',
    subject: 'service-account:authority-worker',
    audience: 'https://authority.example.test',
    issuedAt: TOKEN_ISSUED_AT,
    credentialIdHash: HASH_B,
  };
}

function servicePrincipal(
  overrides: Readonly<Record<string, unknown>> = {},
): Readonly<Record<string, unknown>> {
  return {
    schemaVersion: '1',
    version: '1',
    principalId: 'apr_v1_service_binding_service_001',
    principalType: 'INTERNAL_SERVICE',
    servicePrincipalId: 'service_principal_001',
    serviceName: 'authority_worker',
    status: 'ACTIVE',
    authenticationBinding: iamBinding(),
    assurance: assurance('IAM_OIDC', appCheckInternal(), {
      tokenRevocationChecked: false,
      secondFactorSatisfied: false,
    }),
    resolutionEvidence: evidence(
      'GOOGLE_CLOUD_IAM',
      'SERVICE_IDENTITY_REGISTRY',
      'STANDARD',
    ),
    resolvedAt: RESOLVED_AT,
    freshness: freshness(),
    ...overrides,
  };
}

function systemBinding(): Readonly<Record<string, unknown>> {
  return {
    schemaVersion: '1',
    bindingType: 'SYSTEM',
    bindingId: 'binding_system_001',
    bindingVersion: 'binding-v1',
    authenticationMethod: 'INTERNAL_SYSTEM_CAPABILITY',
    systemActorId: 'system_actor_001',
    executionOrigin: 'authority_recovery',
    capabilityBindingId: 'capability_binding_001',
    attestationFingerprint: HASH_B,
  };
}

function systemPrincipal(): Readonly<Record<string, unknown>> {
  return {
    schemaVersion: '1',
    version: '1',
    principalId: 'apr_v1_system_binding_system_001',
    principalType: 'SYSTEM_ACTOR',
    systemActorId: 'system_actor_001',
    executionOrigin: 'authority_recovery',
    capabilityBindingId: 'capability_binding_001',
    status: 'ACTIVE',
    authenticationBinding: systemBinding(),
    assurance: assurance(
      'INTERNAL_SYSTEM_CAPABILITY',
      appCheckInternal(),
      {
        level: 'SYSTEM_ATTESTED',
        tokenRevocationChecked: false,
        secondFactorSatisfied: false,
      },
    ),
    resolutionEvidence: evidence(
      'INTERNAL_CAPABILITY_REGISTRY',
      'SYSTEM_CAPABILITY_REGISTRY',
      'SYSTEM_ATTESTED',
    ),
    resolvedAt: RESOLVED_AT,
    freshness: freshness(),
  };
}

function migrationBinding(): Readonly<Record<string, unknown>> {
  return {
    schemaVersion: '1',
    bindingType: 'MIGRATION',
    bindingId: 'binding_migration_001',
    bindingVersion: 'binding-v1',
    authenticationMethod: 'MIGRATION_CAPABILITY',
    migrationId: 'migration_001',
    migrationRunId: 'migration_run_001',
    executionIdentity: 'migration_executor_001',
    batchId: 'batch_001',
    attestationFingerprint: HASH_B,
  };
}

function migrationPrincipal(): Readonly<Record<string, unknown>> {
  return {
    schemaVersion: '1',
    version: '1',
    principalId: 'apr_v1_migration_binding_migration_001',
    principalType: 'MIGRATION_ACTOR',
    migrationId: 'migration_001',
    migrationRunId: 'migration_run_001',
    executionPrincipalId: 'migration_executor_001',
    batchScope: 'legacy-platform-tenants-batch-001',
    changeReference: 'change-ticket-001',
    status: 'ACTIVE',
    authenticationBinding: migrationBinding(),
    assurance: assurance('MIGRATION_CAPABILITY', appCheckInternal(), {
      level: 'SYSTEM_ATTESTED',
      tokenRevocationChecked: false,
      secondFactorSatisfied: false,
    }),
    resolutionEvidence: evidence(
      'MIGRATION_MANIFEST',
      'MIGRATION_REGISTRY',
      'SYSTEM_ATTESTED',
    ),
    resolvedAt: RESOLVED_AT,
    freshness: freshness(),
  };
}

function supportBinding(): Readonly<Record<string, unknown>> {
  return {
    schemaVersion: '1',
    bindingType: 'SUPPORT',
    bindingId: 'binding_support_001',
    bindingVersion: 'binding-v1',
    authenticationMethod: 'SUPPORT_SESSION',
    operatorId: 'support_operator_001',
    supportSessionId: 'support_session_001',
    operatorAuthentication: firebaseBinding({
      bindingId: 'binding_support_operator_001',
      platformUserId: 'support_operator_001',
    }),
  };
}

function supportPrincipal(): Readonly<Record<string, unknown>> {
  return {
    schemaVersion: '1',
    version: '1',
    principalId: 'apr_v1_support_binding_support_001',
    principalType: 'SUPPORT_OPERATOR',
    operatorPrincipalId: 'support_operator_001',
    supportSessionId: 'support_session_001',
    impersonation: 'PROHIBITED',
    status: 'ACTIVE',
    authenticationBinding: supportBinding(),
    assurance: assurance('SUPPORT_SESSION', appCheckValid()),
    resolutionEvidence: evidence(
      'FIREBASE_AUTH',
      'SUPPORT_SESSION_REGISTRY',
      'STANDARD',
      {
        claimsVersion: 'claims-v1',
        claimsSnapshot: claimsSnapshot(),
      },
    ),
    resolvedAt: RESOLVED_AT,
    freshness: freshness({
      claimsVersion: 'claims-v1',
      revocationCheckedAt: REVOCATION_CHECKED_AT,
    }),
  };
}

function firebaseRequest(
  overrides: Readonly<Record<string, unknown>> = {},
): Readonly<Record<string, unknown>> {
  return {
    schemaVersion: '1',
    requestType: 'VERIFIED_FIREBASE_USER',
    authenticationMethod: 'FIREBASE_ID_TOKEN',
    firebaseUid: 'firebase_uid_001',
    tokenIssuedAt: TOKEN_ISSUED_AT,
    tokenAuthTime: AUTH_TIME,
    authenticatedAt: AUTHENTICATED_AT,
    authProvider: 'FEDERATED_OIDC',
    tokenIdHash: HASH_B,
    claimsVersion: 'claims-v1',
    revocationCheckedAt: REVOCATION_CHECKED_AT,
    issuer: 'https://securetoken.example.test',
    audience: 'authority-project',
    appCheckEvidence: appCheckValid(),
    ...overrides,
  };
}

function failureResult(
  status: string,
  reasonCode: string,
  retryDisposition: string,
): Readonly<Record<string, unknown>> {
  return {
    schemaVersion: '1',
    status,
    reasonCode,
    retryDisposition,
    resolverVersion: 'resolver-v1',
    resolvedAt: RESOLVED_AT,
    safeMetadata: {
      resolverReference: 'resolver_reference_001',
      evidenceFingerprint: HASH_C,
    },
  };
}

describe('Authority principal resolution contracts', () => {
  it('1 creates a valid human principal', () => {
    expect(
      createResolvedHumanAuthorityPrincipalV1(humanPrincipal()),
    ).toMatchObject({
      principalType: 'HUMAN_USER',
      firebaseUid: 'firebase_uid_001',
      platformUserId: 'platform_user_001',
    });
  });

  it('2 creates a valid internal service principal', () => {
    expect(
      createResolvedInternalServicePrincipalV1(servicePrincipal()),
    ).toMatchObject({
      principalType: 'INTERNAL_SERVICE',
      servicePrincipalId: 'service_principal_001',
    });
  });

  it('3 creates a valid system actor principal', () => {
    expect(
      createResolvedSystemActorPrincipalV1(systemPrincipal()),
    ).toMatchObject({
      principalType: 'SYSTEM_ACTOR',
      capabilityBindingId: 'capability_binding_001',
    });
  });

  it('4 creates a valid migration actor principal', () => {
    expect(
      createResolvedMigrationActorPrincipalV1(migrationPrincipal()),
    ).toMatchObject({
      principalType: 'MIGRATION_ACTOR',
      migrationRunId: 'migration_run_001',
    });
  });

  it('5 creates a valid support operator without impersonation', () => {
    expect(
      createResolvedSupportOperatorPrincipalV1(supportPrincipal()),
    ).toMatchObject({
      principalType: 'SUPPORT_OPERATOR',
      impersonation: 'PROHIBITED',
    });
  });

  it('6 rejects email as canonical principal ID', () => {
    expect(() =>
      createAuthorityPrincipalIdV1({
        schemaVersion: '1',
        bindingId: 'binding_human_001',
        bindingVersion: 'binding-v1',
        principalType: 'HUMAN_USER',
        canonicalPrincipalId: 'person@example.test',
        canonicalSubjectId: 'canonical_subject_001',
        status: 'ACTIVE',
        evidenceFingerprint: HASH_A,
      }),
    ).toThrow(AuthorityPrincipalValidationError);
  });

  it('7 does not accept employeeId as Firebase UID', () => {
    const { firebaseUid: omitted, ...withoutUid } = firebaseRequest();
    expect(omitted).toBeDefined();
    expect(() =>
      createAuthorityPrincipalResolutionRequestV1({
        ...withoutUid,
        employeeId: 'employee_001',
      }),
    ).toThrow(AuthorityPrincipalValidationError);
  });

  it('8 rejects role as a principal type', () => {
    expect(() =>
      createResolvedHumanAuthorityPrincipalV1({
        ...humanPrincipal(),
        principalType: 'PLATFORM_ADMIN',
      }),
    ).toThrow(AuthorityPrincipalValidationError);
  });

  it('9 rejects unknown principal type', () => {
    expect(() =>
      createResolvedHumanAuthorityPrincipalV1({
        ...humanPrincipal(),
        principalType: 'UNKNOWN',
      }),
    ).toThrow(AuthorityPrincipalValidationError);
  });

  it('10 rejects unknown fields', () => {
    expect(() =>
      createResolvedHumanAuthorityPrincipalV1({
        ...humanPrincipal(),
        permission: 'AUTHORITY_WRITE',
      }),
    ).toThrow(AuthorityPrincipalValidationError);
  });

  it('11 rejects empty IDs', () => {
    expect(() => validateAuthorityPlatformUserIdV1('')).toThrow(
      AuthorityPrincipalValidationError,
    );
  });

  it('12 rejects surrounding whitespace', () => {
    expect(() =>
      validateAuthorityServicePrincipalIdV1(' service_001'),
    ).toThrow(AuthorityPrincipalValidationError);
  });

  it('13 rejects path separators in IDs', () => {
    expect(() =>
      validateAuthorityPlatformUserIdV1('platform/user/001'),
    ).toThrow(AuthorityPrincipalValidationError);
  });

  it('14 rejects oversized IDs', () => {
    expect(() =>
      validateAuthorityPlatformUserIdV1(`user_${'x'.repeat(130)}`),
    ).toThrow(AuthorityPrincipalValidationError);
  });

  it('15 rejects invalid Firebase UID', () => {
    expect(() => validateAuthorityFirebaseUidV1('user@example.test')).toThrow(
      AuthorityPrincipalValidationError,
    );
  });

  it('16 rejects invalid platform user ID', () => {
    expect(() =>
      validateAuthorityPlatformUserIdV1('platform user'),
    ).toThrow(AuthorityPrincipalValidationError);
  });

  it('17 rejects invalid service principal ID', () => {
    expect(() =>
      validateAuthorityServicePrincipalIdV1('service@example.test'),
    ).toThrow(AuthorityPrincipalValidationError);
  });

  it('18 rejects raw tokens', () => {
    expect(() =>
      createAuthorityPrincipalResolutionRequestV1({
        ...firebaseRequest(),
        rawToken: 'header.payload.signature',
      }),
    ).toThrow(AuthorityPrincipalValidationError);
  });

  it('19 accepts a safe snapshot and rejects complete claims objects', () => {
    expect(
      createAuthorityAuthenticationClaimsSnapshotV1(claimsSnapshot()),
    ).toEqual(claimsSnapshot());
    expect(() =>
      createAuthorityPrincipalResolutionRequestV1({
        ...firebaseRequest(),
        claims: { role: 'PLATFORM_ADMIN' },
      }),
    ).toThrow(AuthorityPrincipalValidationError);
  });

  it('20 rejects passwords', () => {
    expect(() =>
      createAuthorityPrincipalResolutionRequestV1({
        ...firebaseRequest(),
        password: 'not-accepted',
      }),
    ).toThrow(AuthorityPrincipalValidationError);
  });

  it('21 rejects unsupported authentication methods', () => {
    expect(() => validateAuthorityAuthenticationMethodV1('EMAIL')).toThrow(
      AuthorityPrincipalValidationError,
    );
  });

  it('22 validates assurance evidence', () => {
    expect(
      validateAuthorityAuthenticationAssuranceV1(
        assurance('FIREBASE_ID_TOKEN', appCheckValid()),
      ),
    ).toMatchObject({
      level: 'STANDARD',
      authenticationMethod: 'FIREBASE_ID_TOKEN',
    });
  });

  it('23 keeps assurance free of permissions', () => {
    const value = validateAuthorityAuthenticationAssuranceV1(
      assurance('FIREBASE_ID_TOKEN', appCheckValid()),
    );
    expect(value).not.toHaveProperty('permission');
    expect(value).not.toHaveProperty('role');
  });

  it('24 validates required App Check for app callers', () => {
    expect(validateAuthorityAppCheckEvidenceV1(appCheckValid()).status).toBe(
      'REQUIRED_AND_VALID',
    );
  });

  it('25 validates not-applicable App Check for internal callers', () => {
    expect(
      validateAuthorityAppCheckEvidenceV1(appCheckInternal()).status,
    ).toBe('NOT_APPLICABLE_INTERNAL_CALLER');
  });

  it('26 rejects a bypass App Check state', () => {
    expect(() =>
      validateAuthorityAppCheckEvidenceV1({
        schemaVersion: '1',
        status: 'BYPASSED',
        reason: 'ADMIN',
      }),
    ).toThrow(AuthorityPrincipalValidationError);
  });

  it('27 rejects non-canonical timestamps', () => {
    expect(() => validateAuthorityTimestampV1('2026-07-30')).toThrow(
      AuthorityPrincipalValidationError,
    );
  });

  it('28 represents historical freshness and reports STALE separately', () => {
    expect(
      validateAuthorityPrincipalFreshnessV1({
        schemaVersion: '1',
        resolvedAt: '2020-01-01T00:00:00.000Z',
        validUntil: '2020-01-01T00:05:00.000Z',
        sourceVersion: 'source-v1',
        bindingVersion: 'binding-v1',
        staleAfterSeconds: 300,
      }),
    ).toBeDefined();
    expect(
      createAuthorityPrincipalResolutionResultV1(
        failureResult(
          'STALE',
          'STALE_AUTHENTICATION',
          'RETRY_AFTER_REAUTHENTICATION',
        ),
      ).status,
    ).toBe('STALE');
  });

  it('29 rejects invalid freshness ordering', () => {
    expect(() =>
      validateAuthorityPrincipalFreshnessV1(
        freshness({ validUntil: RESOLVED_AT }),
      ),
    ).toThrow(AuthorityPrincipalValidationError);
  });

  it('30 represents a suspended principal contractually', () => {
    expect(
      createResolvedHumanAuthorityPrincipalV1(
        humanPrincipal({ status: 'SUSPENDED' }),
      ).status,
    ).toBe('SUSPENDED');
  });

  it('31 creates a revoked resolution result', () => {
    expect(
      createAuthorityPrincipalResolutionResultV1(
        failureResult('REVOKED', 'PRINCIPAL_REVOKED', 'DO_NOT_RETRY'),
      ).status,
    ).toBe('REVOKED');
  });

  it('32 creates a disabled rejection result', () => {
    const result = createAuthorityPrincipalResolutionResultV1(
      failureResult('REJECTED', 'PRINCIPAL_DISABLED', 'DO_NOT_RETRY'),
    );
    expect(result).toMatchObject({
      status: 'REJECTED',
      reasonCode: 'PRINCIPAL_DISABLED',
    });
  });

  it('33 creates a stale binding result', () => {
    expect(
      createAuthorityPrincipalResolutionResultV1(
        failureResult('STALE', 'STALE_BINDING', 'RETRY_AFTER_REFRESH'),
      ).status,
    ).toBe('STALE');
  });

  it('34 creates a not-found result', () => {
    expect(
      createAuthorityPrincipalResolutionResultV1(
        failureResult(
          'NOT_FOUND',
          'AUTHENTICATION_BINDING_NOT_FOUND',
          'DO_NOT_RETRY',
        ),
      ).status,
    ).toBe('NOT_FOUND');
  });

  it('35 creates a conflict result requiring operator review', () => {
    expect(
      createAuthorityPrincipalResolutionResultV1(
        failureResult(
          'CONFLICT',
          'PRINCIPAL_BINDING_CONFLICT',
          'RETRY_AFTER_OPERATOR_REVIEW',
        ),
      ).status,
    ).toBe('CONFLICT');
  });

  it('36 creates a safe internal-error result', () => {
    const result = createAuthorityPrincipalResolutionResultV1(
      failureResult(
        'INTERNAL_ERROR',
        'INTERNAL_RESOLUTION_FAILURE',
        'SAFE_TO_RETRY',
      ),
    );
    expect(JSON.stringify(result)).not.toMatch(/stack|token|firebaseUid/i);
  });

  it('37 serializes errors without sensitive details or stack', () => {
    const error = new AuthorityPrincipalResolutionError(
      'RETRY_AFTER_REAUTHENTICATION',
    );
    expect(error.toJSON()).toEqual({
      version: '1',
      code: 'AUTHORITY_PRINCIPAL_RESOLUTION_FAILED',
      safeMessage: 'Authority principal resolution failed.',
      retryDisposition: 'RETRY_AFTER_REAUTHENTICATION',
    });
    expect(error.toJSON()).not.toHaveProperty('stack');
  });

  it('38 deeply freezes resolved outputs', () => {
    const principal = createResolvedHumanAuthorityPrincipalV1(
      humanPrincipal(),
    );
    expect(Object.isFrozen(principal)).toBe(true);
    expect(Object.isFrozen(principal.authenticationBinding)).toBe(true);
    expect(Object.isFrozen(principal.assurance)).toBe(true);
    expect(Object.isFrozen(principal.assurance.appCheckEvidence)).toBe(true);
    expect(Object.isFrozen(principal.resolutionEvidence)).toBe(true);
    expect(Object.isFrozen(principal.freshness)).toBe(true);
  });

  it('39 produces deterministic factory outputs', () => {
    expect(
      createResolvedHumanAuthorityPrincipalV1(humanPrincipal()),
    ).toEqual(
      createResolvedHumanAuthorityPrincipalV1(humanPrincipal()),
    );
  });

  it('40 validates a Firebase resolution request without public identity fields', () => {
    const request = createAuthorityPrincipalResolutionRequestV1(
      firebaseRequest(),
    );
    expect(request.requestType).toBe('VERIFIED_FIREBASE_USER');
    expect(request).not.toHaveProperty('principalId');
    expect(request).not.toHaveProperty('tenantId');
    expect(request).not.toHaveProperty('role');
  });

  it('41 validates resolver context with injected time and no cancellation', () => {
    const context = createAuthorityPrincipalResolutionContextV1({
      schemaVersion: '1',
      requestId: 'request_001',
      correlationId: 'correlation_001',
      channel: 'FIREBASE_CALLABLE',
      resolverVersion: 'resolver-v1',
      resolutionTime: RESOLVED_AT,
    });
    expect(context.resolutionTime).toBe(RESOLVED_AT);
    expect(context).not.toHaveProperty('cancellationSignal');
  });

  it('42 rejects cancellation in the serializable resolver context', () => {
    expect(() =>
      createAuthorityPrincipalResolutionContextV1({
        schemaVersion: '1',
        requestId: 'request_001',
        correlationId: 'correlation_001',
        channel: 'FIREBASE_CALLABLE',
        resolverVersion: 'resolver-v1',
        resolutionTime: RESOLVED_AT,
        cancellationSignal: {},
      }),
    ).toThrow(AuthorityPrincipalValidationError);
  });

  it('43 exposes the minimal asynchronous resolver port shape', async () => {
    const resolved = createAuthorityPrincipalResolutionResultV1({
      schemaVersion: '1',
      status: 'RESOLVED',
      principal: humanPrincipal(),
    });
    const port: AuthorityPrincipalResolverPort = {
      resolve: async (
        request: AuthorityPrincipalResolutionRequestV1,
      ): Promise<AuthorityPrincipalResolutionResultV1> => {
        expect(request.schemaVersion).toBe('1');
        return resolved;
      },
    };
    await expect(
      port.resolve(
        createAuthorityPrincipalResolutionRequestV1(firebaseRequest()),
        createAuthorityPrincipalResolutionContextV1({
          schemaVersion: '1',
          requestId: 'request_001',
          correlationId: 'correlation_001',
          channel: 'FIREBASE_CALLABLE',
          resolverVersion: 'resolver-v1',
          resolutionTime: RESOLVED_AT,
        }),
      ),
    ).resolves.toEqual(resolved);
  });

  it('44 rejects non-plain records and class instances', () => {
    class ResolutionRequest {
      readonly requestType = 'VERIFIED_FIREBASE_USER';
    }
    expect(() =>
      validateAuthorityPrincipalResolutionRequestV1(
        new ResolutionRequest(),
      ),
    ).toThrow(AuthorityPrincipalValidationError);
  });

  it('45 rejects symbol keys', () => {
    const value: Record<PropertyKey, unknown> = {
      ...firebaseRequest(),
      [Symbol('secret')]: 'hidden',
    };
    expect(() =>
      validateAuthorityPrincipalResolutionRequestV1(value),
    ).toThrow(AuthorityPrincipalValidationError);
  });

  it('46 rejects undefined optional properties when present', () => {
    expect(() =>
      validateAuthorityPrincipalResolutionRequestV1({
        ...firebaseRequest(),
        tokenIdHash: undefined,
      }),
    ).toThrow(AuthorityPrincipalValidationError);
  });

  it('47 rejects non-finite freshness windows', () => {
    expect(() =>
      validateAuthorityAuthenticationAssuranceV1(
        assurance('FIREBASE_ID_TOKEN', appCheckValid(), {
          freshnessWindowSeconds: Number.POSITIVE_INFINITY,
        }),
      ),
    ).toThrow(AuthorityPrincipalValidationError);
  });

  it('48 returns the canonical ID from a server-owned binding', () => {
    expect(
      createAuthorityPrincipalIdV1({
        schemaVersion: '1',
        bindingId: 'binding_human_001',
        bindingVersion: 'binding-v1',
        principalType: 'HUMAN_USER',
        canonicalPrincipalId: 'apr_v1_human_binding_human_001',
        canonicalSubjectId: 'canonical_subject_001',
        status: 'ACTIVE',
        evidenceFingerprint: HASH_A,
      }),
    ).toBe('apr_v1_human_binding_human_001');
  });
});
