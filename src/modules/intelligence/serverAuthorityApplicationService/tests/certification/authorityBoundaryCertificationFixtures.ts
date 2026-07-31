import type {
  AuthorityAuthenticationMethod,
} from '../../../serverPrincipalResolution/principalResolutionTypes';
import {
  createAuthorityMembershipKeyV1,
} from '../../../serverAuthorityPersistence/ids';

export const CERTIFICATION_HASH_A = `sha256:${'a'.repeat(64)}`;
export const CERTIFICATION_HASH_B = `sha256:${'b'.repeat(64)}`;
export const CERTIFICATION_HASH_C = `sha256:${'c'.repeat(64)}`;
export const CERTIFICATION_PRINCIPAL_ID =
  'apr_v1_human_binding_human_001';
export const CERTIFICATION_TENANT_ID = 'tenant_001';
export const CERTIFICATION_MEMBERSHIP_ID =
  createAuthorityMembershipKeyV1({
    principalType: 'USER',
    principalId: CERTIFICATION_PRINCIPAL_ID,
    tenantId: CERTIFICATION_TENANT_ID,
  });
export const CERTIFICATION_RESOLVED_AT =
  '2026-07-30T12:00:10.000Z';
export const CERTIFICATION_VALID_UNTIL =
  '2026-07-30T12:05:10.000Z';

type Input = Readonly<Record<string, unknown>>;

export function obligationDeclarationFixture(
  obligationType: string,
): Input {
  const declarations: Readonly<Record<string, Input>> = {
    REQUIRE_FRESH_AUTHENTICATION: {
      schemaVersion: '1',
      obligationType,
      maxAuthenticationAgeSeconds: 300,
    },
    REQUIRE_APP_CHECK: {
      schemaVersion: '1',
      obligationType,
      requiredStatus: 'REQUIRED_AND_VALID',
    },
    REQUIRE_MFA: {
      schemaVersion: '1',
      obligationType,
      minimumFactors: 2,
    },
    REQUIRE_IDEMPOTENCY_KEY: {
      schemaVersion: '1',
      obligationType,
      namespace: 'PRINCIPAL_SCOPE_OPERATION',
    },
    REQUIRE_EXPECTED_VERSION: {
      schemaVersion: '1',
      obligationType,
      versionSource: 'RESOURCE_AUTHORITY_VERSION',
    },
    REQUIRE_AUDIT_REASON: {
      schemaVersion: '1',
      obligationType,
      reasonCodeRequired: true,
    },
    REQUIRE_CHANGE_TICKET: {
      schemaVersion: '1',
      obligationType,
      ticketReferencePattern: 'CANONICAL_REFERENCE',
    },
    REQUIRE_SUPPORT_SESSION: {
      schemaVersion: '1',
      obligationType,
      supportSessionId: 'support_session_001',
    },
    REQUIRE_MIGRATION_MANIFEST: {
      schemaVersion: '1',
      obligationType,
      manifestVersion: 'manifest-v1',
    },
    MASK_NOT_FOUND: {
      schemaVersion: '1',
      obligationType,
      externalCode: 'PERMISSION_DENIED',
    },
    LIMIT_TO_TEST_ONLY: {
      schemaVersion: '1',
      obligationType,
      executionMode: 'TEST_ONLY',
    },
  };
  const declaration = declarations[obligationType];
  if (declaration === undefined) {
    throw new Error('Certification obligation type is invalid.');
  }
  return declaration;
}

function appCheckValid(): Input {
  return {
    schemaVersion: '1',
    status: 'REQUIRED_AND_VALID',
    applicationIdHash: CERTIFICATION_HASH_A,
    attestationProvider: 'play_integrity',
    verifiedAt: '2026-07-30T12:00:05.000Z',
    replayProtection: 'ENFORCED',
  };
}

function appCheckInternal(): Input {
  return {
    schemaVersion: '1',
    status: 'NOT_APPLICABLE_INTERNAL_CALLER',
    reason: 'NON_APP_CALLER',
  };
}

function assurance(
  authenticationMethod: AuthorityAuthenticationMethod,
  appCheckEvidence: Input,
  overrides: Input = {},
): Input {
  return {
    schemaVersion: '1',
    level: 'STANDARD',
    authenticationMethod,
    authenticatedAt: '2026-07-30T12:00:05.000Z',
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
  overrides: Input = {},
): Input {
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
    resolvedAt: CERTIFICATION_RESOLVED_AT,
    evidenceFingerprint: CERTIFICATION_HASH_C,
    ...overrides,
  };
}

function freshness(overrides: Input = {}): Input {
  return {
    schemaVersion: '1',
    resolvedAt: CERTIFICATION_RESOLVED_AT,
    validUntil: CERTIFICATION_VALID_UNTIL,
    sourceVersion: 'identity-source-v1',
    bindingVersion: 'binding-v1',
    staleAfterSeconds: 300,
    ...overrides,
  };
}

function firebaseBinding(overrides: Input = {}): Input {
  return {
    schemaVersion: '1',
    bindingType: 'FIREBASE_USER',
    bindingId: 'binding_human_001',
    bindingVersion: 'binding-v1',
    authenticationMethod: 'FIREBASE_ID_TOKEN',
    firebaseUid: 'firebase_uid_001',
    platformUserId: 'platform_user_001',
    tokenIssuedAt: '2026-07-30T12:00:00.000Z',
    tokenAuthTime: '2026-07-30T11:59:00.000Z',
    authProvider: 'FEDERATED_OIDC',
    tokenIdHash: CERTIFICATION_HASH_B,
    claimsVersion: 'claims-v1',
    ...overrides,
  };
}

function claimsSnapshot(): Input {
  return {
    schemaVersion: '1',
    claimsVersion: 'claims-v1',
    tokenIssuedAt: '2026-07-30T12:00:00.000Z',
    tokenAuthTime: '2026-07-30T11:59:00.000Z',
    tokenExpiresAt: '2026-07-30T13:00:00.000Z',
    issuer: 'https://securetoken.example.test',
    audience: 'aura-control-center',
    subjectFingerprint: CERTIFICATION_HASH_A,
    snapshotFingerprint: CERTIFICATION_HASH_B,
  };
}

export function humanPrincipalFixture(overrides: Input = {}): Input {
  return {
    schemaVersion: '1',
    version: '1',
    principalId: CERTIFICATION_PRINCIPAL_ID,
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
    resolvedAt: CERTIFICATION_RESOLVED_AT,
    freshness: freshness({
      claimsVersion: 'claims-v1',
      revocationCheckedAt: '2026-07-30T12:00:06.000Z',
    }),
    ...overrides,
  };
}

export function servicePrincipalFixture(overrides: Input = {}): Input {
  return {
    schemaVersion: '1',
    version: '1',
    principalId: 'apr_v1_service_binding_service_001',
    principalType: 'INTERNAL_SERVICE',
    servicePrincipalId: 'service_principal_001',
    serviceName: 'authority_worker',
    status: 'ACTIVE',
    authenticationBinding: {
      schemaVersion: '1',
      bindingType: 'IAM_SERVICE',
      bindingId: 'binding_service_001',
      bindingVersion: 'binding-v1',
      authenticationMethod: 'IAM_OIDC',
      servicePrincipalId: 'service_principal_001',
      issuer: 'https://accounts.example.test',
      subject: 'service-account:authority-worker',
      audience: 'https://authority.example.test',
      issuedAt: '2026-07-30T12:00:00.000Z',
      credentialIdHash: CERTIFICATION_HASH_B,
    },
    assurance: assurance('IAM_OIDC', appCheckInternal(), {
      tokenRevocationChecked: false,
      secondFactorSatisfied: false,
    }),
    resolutionEvidence: evidence(
      'GOOGLE_CLOUD_IAM',
      'SERVICE_IDENTITY_REGISTRY',
      'STANDARD',
    ),
    resolvedAt: CERTIFICATION_RESOLVED_AT,
    freshness: freshness(),
    ...overrides,
  };
}

export function systemPrincipalFixture(overrides: Input = {}): Input {
  return {
    schemaVersion: '1',
    version: '1',
    principalId: 'apr_v1_system_binding_system_001',
    principalType: 'SYSTEM_ACTOR',
    systemActorId: 'system_actor_001',
    executionOrigin: 'authority_recovery',
    capabilityBindingId: 'capability_binding_001',
    status: 'ACTIVE',
    authenticationBinding: {
      schemaVersion: '1',
      bindingType: 'SYSTEM',
      bindingId: 'binding_system_001',
      bindingVersion: 'binding-v1',
      authenticationMethod: 'INTERNAL_SYSTEM_CAPABILITY',
      systemActorId: 'system_actor_001',
      executionOrigin: 'authority_recovery',
      capabilityBindingId: 'capability_binding_001',
      attestationFingerprint: CERTIFICATION_HASH_B,
    },
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
    resolvedAt: CERTIFICATION_RESOLVED_AT,
    freshness: freshness(),
    ...overrides,
  };
}

export function migrationPrincipalFixture(overrides: Input = {}): Input {
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
    authenticationBinding: {
      schemaVersion: '1',
      bindingType: 'MIGRATION',
      bindingId: 'binding_migration_001',
      bindingVersion: 'binding-v1',
      authenticationMethod: 'MIGRATION_CAPABILITY',
      migrationId: 'migration_001',
      migrationRunId: 'migration_run_001',
      executionIdentity: 'migration_executor_001',
      batchId: 'batch_001',
      attestationFingerprint: CERTIFICATION_HASH_B,
    },
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
    resolvedAt: CERTIFICATION_RESOLVED_AT,
    freshness: freshness(),
    ...overrides,
  };
}

export function supportPrincipalFixture(overrides: Input = {}): Input {
  return {
    schemaVersion: '1',
    version: '1',
    principalId: 'apr_v1_support_binding_support_001',
    principalType: 'SUPPORT_OPERATOR',
    operatorPrincipalId: 'support_operator_001',
    supportSessionId: 'support_session_001',
    impersonation: 'PROHIBITED',
    status: 'ACTIVE',
    authenticationBinding: {
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
    },
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
    resolvedAt: CERTIFICATION_RESOLVED_AT,
    freshness: freshness({
      claimsVersion: 'claims-v1',
      revocationCheckedAt: '2026-07-30T12:00:06.000Z',
    }),
    ...overrides,
  };
}

function scopeEvidence(
  selectorType: string,
  source: string,
  overrides: Input = {},
): Input {
  return {
    schemaVersion: '1',
    selectorType,
    source,
    resolverVersion: 'tenant-resolver-v1',
    resolvedAt: CERTIFICATION_RESOLVED_AT,
    evidenceFingerprint: CERTIFICATION_HASH_C,
    principalId: CERTIFICATION_PRINCIPAL_ID,
    principalBindingVersion: 'binding-v1',
    sourceVersions: [{ source, version: 'source-v1' }],
    ...overrides,
  };
}

function scopeFreshness(
  tenantAuthorityVersion: string,
  overrides: Input = {},
): Input {
  return {
    schemaVersion: '1',
    resolvedAt: CERTIFICATION_RESOLVED_AT,
    validUntil: CERTIFICATION_VALID_UNTIL,
    tenantAuthorityVersion,
    bindingVersion: 'binding-v1',
    staleAfterSeconds: 300,
    ...overrides,
  };
}

export function tenantScopeFixture(overrides: Input = {}): Input {
  return {
    schemaVersion: '1',
    version: '1',
    scopeType: 'TENANT',
    status: 'ACTIVE',
    tenantId: CERTIFICATION_TENANT_ID,
    canonicalTenantAuthorityVersion: 'tenant-v1',
    membershipBinding: {
      schemaVersion: '1',
      membershipId: CERTIFICATION_MEMBERSHIP_ID,
      tenantId: CERTIFICATION_TENANT_ID,
      principalId: CERTIFICATION_PRINCIPAL_ID,
      membershipStatus: 'ACTIVE',
      membershipVersion: 'membership-v1',
      tenantAuthorityVersion: 'tenant-v1',
      roleSetVersion: 'role-set-v1',
      bindingVersion: 'membership-binding-v1',
      resolvedAt: CERTIFICATION_RESOLVED_AT,
      source: 'CANONICAL_MEMBERSHIP',
      evidenceFingerprint: CERTIFICATION_HASH_B,
    },
    tenantStatus: 'ACTIVE',
    requestedTenantSelector: {
      schemaVersion: '1',
      selectorType: 'TENANT_ID',
      requestedTenantId: CERTIFICATION_TENANT_ID,
    },
    source: 'CANONICAL_MEMBERSHIP',
    resolvedAt: CERTIFICATION_RESOLVED_AT,
    freshness: scopeFreshness('tenant-v1', {
      membershipVersion: 'membership-v1',
    }),
    resolutionEvidence: scopeEvidence(
      'TENANT_ID',
      'CANONICAL_MEMBERSHIP',
      {
        tenantAuthorityVersion: 'tenant-v1',
        membershipBindingVersion: 'membership-binding-v1',
        sourceVersions: [
          { source: 'CANONICAL_MEMBERSHIP', version: 'membership-v1' },
          {
            source: 'CANONICAL_TENANT_AUTHORITY',
            version: 'tenant-v1',
          },
        ],
      },
    ),
    ...overrides,
  };
}

export function platformScopeFixture(overrides: Input = {}): Input {
  return {
    schemaVersion: '1',
    version: '1',
    scopeType: 'PLATFORM',
    status: 'ACTIVE',
    platformScopeId: 'platform_scope_001',
    platformBoundary: 'AUTHORITY_CONTROL_PLANE',
    platformOperationCategory: 'PLATFORM_OBSERVATION',
    source: 'PLATFORM_AUTHORITY',
    resolvedAt: CERTIFICATION_RESOLVED_AT,
    freshness: scopeFreshness('platform-v1'),
    resolutionEvidence: scopeEvidence(
      'PLATFORM_SCOPE',
      'PLATFORM_AUTHORITY',
    ),
    ...overrides,
  };
}

export function bootstrapScopeFixture(overrides: Input = {}): Input {
  return {
    schemaVersion: '1',
    version: '1',
    scopeType: 'TENANT_BOOTSTRAP',
    status: 'PENDING_BOOTSTRAP',
    bootstrapRequestId: 'bootstrap_request_001',
    tenantIdCandidate: 'tenant_candidate_001',
    bootstrapOperation: 'CREATE_TENANT_AUTHORITY',
    initiatingPrincipalId: CERTIFICATION_PRINCIPAL_ID,
    principalBindingVersion: 'binding-v1',
    bootstrapReasonCode: 'INITIAL_TENANT_CREATION',
    source: 'BOOTSTRAP_REQUEST',
    resolvedAt: CERTIFICATION_RESOLVED_AT,
    freshness: scopeFreshness('bootstrap-v1'),
    resolutionEvidence: scopeEvidence(
      'BOOTSTRAP_CANDIDATE',
      'BOOTSTRAP_REQUEST',
    ),
    ...overrides,
  };
}

export function legacyScopeFixture(overrides: Input = {}): Input {
  return {
    schemaVersion: '1',
    version: '1',
    scopeType: 'LEGACY_CANONICALIZATION',
    status: 'LEGACY_PENDING_CANONICALIZATION',
    legacySourceDescriptor: {
      schemaVersion: '1',
      sourceCollection: 'PLATFORM_TENANTS',
      sourceDocumentId: 'legacy_tenant_001',
      sourceLocatorVersion: '1',
      expectedSourceRecordVersion: {
        schemaVersion: '1',
        provenance: 'CONTENT_FINGERPRINT_ONLY',
        contentFingerprint: CERTIFICATION_HASH_A,
      },
      expectedSourceFingerprint: CERTIFICATION_HASH_B,
      authorityUse: 'PROHIBITED',
    },
    canonicalTenantCandidate: 'tenant_canonical_001',
    aliasCandidates: [
      {
        aliasType: 'LEGACY_TENANT_ID',
        normalizedAlias: 'legacy_tenant_001',
      },
    ],
    canonicalizationBinding: {
      migrationId: 'migration_001',
      migrationRunId: 'migration_run_001',
      bindingVersion: 'canonicalization-binding-v1',
    },
    source: 'LEGACY_PLATFORM_TENANT',
    resolvedAt: CERTIFICATION_RESOLVED_AT,
    freshness: scopeFreshness('legacy-source-v1'),
    resolutionEvidence: scopeEvidence(
      'LEGACY_SOURCE',
      'LEGACY_PLATFORM_TENANT',
      { sourceDescriptorFingerprint: CERTIFICATION_HASH_A },
    ),
    ...overrides,
  };
}

export function migrationScopeFixture(overrides: Input = {}): Input {
  return {
    schemaVersion: '1',
    version: '1',
    scopeType: 'MIGRATION',
    status: 'ACTIVE',
    migrationId: 'migration_001',
    migrationRunId: 'migration_run_001',
    manifestVersion: 'manifest-v1',
    targetTenantIds: ['tenant_002', CERTIFICATION_TENANT_ID],
    batchId: 'batch_001',
    batchScope: 'canonicalization_batch_001',
    scopeFingerprint: CERTIFICATION_HASH_A,
    source: 'MIGRATION_MANIFEST',
    resolvedAt: CERTIFICATION_RESOLVED_AT,
    freshness: scopeFreshness('manifest-v1'),
    resolutionEvidence: scopeEvidence(
      'MIGRATION_TARGET',
      'MIGRATION_MANIFEST',
    ),
    ...overrides,
  };
}

export function supportScopeFixture(overrides: Input = {}): Input {
  return {
    schemaVersion: '1',
    version: '1',
    scopeType: 'SUPPORT',
    status: 'ACTIVE',
    supportSessionId: 'support_session_001',
    operatorPrincipalId: CERTIFICATION_PRINCIPAL_ID,
    requestedTenantId: CERTIFICATION_TENANT_ID,
    supportScopeReasonCode: 'CUSTOMER_INCIDENT_REVIEW',
    allowedUntil: '2026-07-30T12:10:00.000Z',
    impersonationMode: 'EXPLICITLY_PROHIBITED',
    source: 'SUPPORT_SESSION',
    resolvedAt: CERTIFICATION_RESOLVED_AT,
    freshness: scopeFreshness('support-session-v1'),
    resolutionEvidence: scopeEvidence(
      'SUPPORT_TARGET',
      'SUPPORT_SESSION',
    ),
    ...overrides,
  };
}
