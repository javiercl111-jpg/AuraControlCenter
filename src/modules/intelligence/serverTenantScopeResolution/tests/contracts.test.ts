import { describe, expect, it } from 'vitest';
import {
  createAuthorityMembershipKeyV1,
} from '../../serverAuthorityPersistence/ids';
import {
  AuthorityTenantScopeResolutionError,
  AuthorityTenantScopeValidationError,
  createAuthorityTenantMembershipBindingV1,
  createAuthorityTenantScopeResolutionRequestV1,
  createAuthorityTenantScopeResolutionResultV1,
  createAuthorityTenantSelectorV1,
  createResolvedLegacyCanonicalizationScopeV1,
  createResolvedMigrationTenantScopeV1,
  createResolvedPlatformAuthorityScopeV1,
  createResolvedSupportTenantScopeV1,
  createResolvedTenantAuthorityScopeV1,
  createResolvedTenantBootstrapScopeV1,
  validateAuthorityTenantIdV1,
  validateAuthorityTenantScopeFreshnessV1,
  type AuthorityTenantScopeResolutionResultV1,
} from '../index';

const RESOLVED_AT = '2026-07-30T12:00:00.000Z';
const VALID_UNTIL = '2026-07-30T12:05:00.000Z';
const SUPPORT_UNTIL = '2026-07-30T12:10:00.000Z';
const HASH_A = `sha256:${'a'.repeat(64)}`;
const HASH_B = `sha256:${'b'.repeat(64)}`;
const HASH_C = `sha256:${'c'.repeat(64)}`;
const TENANT_ID = 'tenant_001';
const PRINCIPAL_ID = 'apr_v1_human_binding_human_001';
const MEMBERSHIP_ID = createAuthorityMembershipKeyV1({
  principalType: 'USER',
  principalId: PRINCIPAL_ID,
  tenantId: TENANT_ID,
});
const PRINCIPAL_BINDING_VERSION = 'principal-binding-v1';

function selectorTenant(): Readonly<Record<string, unknown>> {
  return {
    schemaVersion: '1',
    selectorType: 'TENANT_ID',
    requestedTenantId: TENANT_ID,
  };
}

function selectorAlias(
  normalizedAlias = 'tenant-alpha',
): Readonly<Record<string, unknown>> {
  return {
    schemaVersion: '1',
    selectorType: 'TENANT_ALIAS',
    alias: {
      aliasType: 'TENANT_SLUG',
      normalizedAlias,
    },
  };
}

function legacyDescriptor(): Readonly<Record<string, unknown>> {
  return {
    schemaVersion: '1',
    sourceCollection: 'PLATFORM_TENANTS',
    sourceDocumentId: 'legacy_tenant_001',
    sourceLocatorVersion: '1',
    expectedSourceRecordVersion: {
      schemaVersion: '1',
      provenance: 'CONTENT_FINGERPRINT_ONLY',
      contentFingerprint: HASH_A,
    },
    expectedSourceFingerprint: HASH_B,
    authorityUse: 'PROHIBITED',
  };
}

function principalReference(): Readonly<Record<string, unknown>> {
  return {
    schemaVersion: '1',
    principalId: PRINCIPAL_ID,
    principalType: 'HUMAN_USER',
    principalBindingVersion: PRINCIPAL_BINDING_VERSION,
    principalEvidenceFingerprint: HASH_A,
    principalResolvedAt: '2026-07-30T11:59:00.000Z',
  };
}

function membership(
  overrides: Readonly<Record<string, unknown>> = {},
): Readonly<Record<string, unknown>> {
  return {
    schemaVersion: '1',
    membershipId: MEMBERSHIP_ID,
    tenantId: TENANT_ID,
    principalId: PRINCIPAL_ID,
    membershipStatus: 'ACTIVE',
    membershipVersion: 'membership-v1',
    tenantAuthorityVersion: 'tenant-v1',
    roleSetVersion: 'role-set-v1',
    bindingVersion: 'membership-binding-v1',
    resolvedAt: RESOLVED_AT,
    source: 'CANONICAL_MEMBERSHIP',
    evidenceFingerprint: HASH_B,
    ...overrides,
  };
}

function evidence(
  selectorType: string,
  source: string,
  overrides: Readonly<Record<string, unknown>> = {},
): Readonly<Record<string, unknown>> {
  return {
    schemaVersion: '1',
    selectorType,
    source,
    resolverVersion: 'tenant-resolver-v1',
    resolvedAt: RESOLVED_AT,
    evidenceFingerprint: HASH_C,
    principalId: PRINCIPAL_ID,
    principalBindingVersion: PRINCIPAL_BINDING_VERSION,
    sourceVersions: [{ source, version: 'source-v1' }],
    ...overrides,
  };
}

function freshness(
  tenantAuthorityVersion: string,
  overrides: Readonly<Record<string, unknown>> = {},
): Readonly<Record<string, unknown>> {
  return {
    schemaVersion: '1',
    resolvedAt: RESOLVED_AT,
    validUntil: VALID_UNTIL,
    tenantAuthorityVersion,
    bindingVersion: PRINCIPAL_BINDING_VERSION,
    staleAfterSeconds: 300,
    ...overrides,
  };
}

function tenantScope(
  overrides: Readonly<Record<string, unknown>> = {},
): Readonly<Record<string, unknown>> {
  return {
    schemaVersion: '1',
    version: '1',
    scopeType: 'TENANT',
    status: 'ACTIVE',
    tenantId: TENANT_ID,
    canonicalTenantAuthorityVersion: 'tenant-v1',
    membershipBinding: membership(),
    tenantStatus: 'ACTIVE',
    requestedTenantSelector: selectorTenant(),
    source: 'CANONICAL_MEMBERSHIP',
    resolvedAt: RESOLVED_AT,
    freshness: freshness('tenant-v1', {
      membershipVersion: 'membership-v1',
    }),
    resolutionEvidence: evidence(
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

function platformScope(
  overrides: Readonly<Record<string, unknown>> = {},
): Readonly<Record<string, unknown>> {
  return {
    schemaVersion: '1',
    version: '1',
    scopeType: 'PLATFORM',
    status: 'ACTIVE',
    platformScopeId: 'platform_scope_001',
    platformBoundary: 'AUTHORITY_CONTROL_PLANE',
    platformOperationCategory: 'PLATFORM_OBSERVATION',
    source: 'PLATFORM_AUTHORITY',
    resolvedAt: RESOLVED_AT,
    freshness: freshness('platform-v1'),
    resolutionEvidence: evidence(
      'PLATFORM_SCOPE',
      'PLATFORM_AUTHORITY',
    ),
    ...overrides,
  };
}

function bootstrapScope(
  overrides: Readonly<Record<string, unknown>> = {},
): Readonly<Record<string, unknown>> {
  return {
    schemaVersion: '1',
    version: '1',
    scopeType: 'TENANT_BOOTSTRAP',
    status: 'PENDING_BOOTSTRAP',
    bootstrapRequestId: 'bootstrap_request_001',
    tenantIdCandidate: 'tenant_candidate_001',
    bootstrapOperation: 'CREATE_TENANT_AUTHORITY',
    initiatingPrincipalId: PRINCIPAL_ID,
    principalBindingVersion: PRINCIPAL_BINDING_VERSION,
    bootstrapReasonCode: 'INITIAL_TENANT_CREATION',
    source: 'BOOTSTRAP_REQUEST',
    resolvedAt: RESOLVED_AT,
    freshness: freshness('bootstrap-v1'),
    resolutionEvidence: evidence(
      'BOOTSTRAP_CANDIDATE',
      'BOOTSTRAP_REQUEST',
    ),
    ...overrides,
  };
}

function legacyScope(
  overrides: Readonly<Record<string, unknown>> = {},
): Readonly<Record<string, unknown>> {
  return {
    schemaVersion: '1',
    version: '1',
    scopeType: 'LEGACY_CANONICALIZATION',
    status: 'LEGACY_PENDING_CANONICALIZATION',
    legacySourceDescriptor: legacyDescriptor(),
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
    resolvedAt: RESOLVED_AT,
    freshness: freshness('legacy-source-v1'),
    resolutionEvidence: evidence(
      'LEGACY_SOURCE',
      'LEGACY_PLATFORM_TENANT',
      { sourceDescriptorFingerprint: HASH_A },
    ),
    ...overrides,
  };
}

function migrationScope(
  overrides: Readonly<Record<string, unknown>> = {},
): Readonly<Record<string, unknown>> {
  return {
    schemaVersion: '1',
    version: '1',
    scopeType: 'MIGRATION',
    status: 'ACTIVE',
    migrationId: 'migration_001',
    migrationRunId: 'migration_run_001',
    manifestVersion: 'manifest-v1',
    targetTenantIds: ['tenant_002', TENANT_ID],
    batchId: 'batch_001',
    batchScope: 'canonicalization_batch_001',
    scopeFingerprint: HASH_A,
    source: 'MIGRATION_MANIFEST',
    resolvedAt: RESOLVED_AT,
    freshness: freshness('manifest-v1'),
    resolutionEvidence: evidence(
      'MIGRATION_TARGET',
      'MIGRATION_MANIFEST',
    ),
    ...overrides,
  };
}

function supportScope(
  overrides: Readonly<Record<string, unknown>> = {},
): Readonly<Record<string, unknown>> {
  return {
    schemaVersion: '1',
    version: '1',
    scopeType: 'SUPPORT',
    status: 'ACTIVE',
    supportSessionId: 'support_session_001',
    operatorPrincipalId: PRINCIPAL_ID,
    requestedTenantId: TENANT_ID,
    supportScopeReasonCode: 'CUSTOMER_INCIDENT_REVIEW',
    allowedUntil: SUPPORT_UNTIL,
    impersonationMode: 'EXPLICITLY_PROHIBITED',
    source: 'SUPPORT_SESSION',
    resolvedAt: RESOLVED_AT,
    freshness: freshness('support-session-v1'),
    resolutionEvidence: evidence(
      'SUPPORT_TARGET',
      'SUPPORT_SESSION',
    ),
    ...overrides,
  };
}

function resolutionRequest(
  overrides: Readonly<Record<string, unknown>> = {},
): Readonly<Record<string, unknown>> {
  return {
    schemaVersion: '1',
    principalReference: principalReference(),
    selector: selectorTenant(),
    channel: 'FIREBASE_CALLABLE',
    requestId: 'request_001',
    correlationId: 'correlation_001',
    resolutionTime: RESOLVED_AT,
    operationCategory: 'TENANT_OPERATION',
    ...overrides,
  };
}

function failureResult(
  status: string,
  resultReasonCode: string,
  retryDisposition: string,
): Readonly<Record<string, unknown>> {
  return {
    schemaVersion: '1',
    status,
    reasonCode: resultReasonCode,
    retryDisposition,
    resolverVersion: 'tenant-resolver-v1',
    resolvedAt: RESOLVED_AT,
  };
}

describe('Authority tenant and scope contracts', () => {
  it('1 creates a valid tenant scope', () => {
    expect(createResolvedTenantAuthorityScopeV1(tenantScope())).toMatchObject({
      scopeType: 'TENANT',
      tenantId: TENANT_ID,
    });
  });

  it('2 creates a platform scope without a tenant ID', () => {
    expect(
      createResolvedPlatformAuthorityScopeV1(platformScope()),
    ).toMatchObject({ scopeType: 'PLATFORM' });
  });

  it('3 creates a valid bootstrap scope', () => {
    expect(
      createResolvedTenantBootstrapScopeV1(bootstrapScope()),
    ).toMatchObject({ status: 'PENDING_BOOTSTRAP' });
  });

  it('4 creates a valid legacy canonicalization scope', () => {
    expect(
      createResolvedLegacyCanonicalizationScopeV1(legacyScope()),
    ).toMatchObject({ scopeType: 'LEGACY_CANONICALIZATION' });
  });

  it('5 creates a valid migration scope', () => {
    expect(
      createResolvedMigrationTenantScopeV1(migrationScope()),
    ).toMatchObject({ migrationId: 'migration_001' });
  });

  it('6 creates a valid support scope', () => {
    expect(
      createResolvedSupportTenantScopeV1(supportScope()),
    ).toMatchObject({ impersonationMode: 'EXPLICITLY_PROHIBITED' });
  });

  it('7 rejects email as a tenant ID', () => {
    expect(() => validateAuthorityTenantIdV1('tenant@example.test')).toThrow(
      AuthorityTenantScopeValidationError,
    );
  });

  it('8 does not accept companyId as an automatic tenant ID', () => {
    expect(() =>
      createAuthorityTenantSelectorV1({
        ...selectorTenant(),
        companyId: 'company_001',
      }),
    ).toThrow(AuthorityTenantScopeValidationError);
  });

  it('9 has no first-tenant fallback when selector is missing', () => {
    const { selector: omitted, ...withoutSelector } = resolutionRequest();
    expect(omitted).toBeDefined();
    expect(() =>
      createAuthorityTenantScopeResolutionRequestV1(withoutSelector),
    ).toThrow(AuthorityTenantScopeValidationError);
  });

  it('10 rejects role as a scope type', () => {
    expect(() =>
      createAuthorityTenantSelectorV1({
        schemaVersion: '1',
        selectorType: 'TENANT_ADMIN',
      }),
    ).toThrow(AuthorityTenantScopeValidationError);
  });

  it('11 rejects superadmin as a scope', () => {
    expect(() =>
      createAuthorityTenantSelectorV1({
        schemaVersion: '1',
        selectorType: 'SUPERADMIN',
      }),
    ).toThrow(AuthorityTenantScopeValidationError);
  });

  it('12 rejects unknown scope types', () => {
    expect(() =>
      createResolvedTenantAuthorityScopeV1({
        ...tenantScope(),
        scopeType: 'UNKNOWN',
      }),
    ).toThrow(AuthorityTenantScopeValidationError);
  });

  it('13 rejects unknown fields', () => {
    expect(() =>
      createResolvedTenantAuthorityScopeV1({
        ...tenantScope(),
        permission: 'tenant.write',
      }),
    ).toThrow(AuthorityTenantScopeValidationError);
  });

  it('14 rejects an empty tenant ID', () => {
    expect(() => validateAuthorityTenantIdV1('')).toThrow(
      AuthorityTenantScopeValidationError,
    );
  });

  it('15 rejects tenant ID whitespace', () => {
    expect(() => validateAuthorityTenantIdV1(' tenant_001')).toThrow(
      AuthorityTenantScopeValidationError,
    );
  });

  it('16 rejects tenant paths', () => {
    expect(() => validateAuthorityTenantIdV1('tenants/tenant_001')).toThrow(
      AuthorityTenantScopeValidationError,
    );
  });

  it('17 rejects wildcards', () => {
    expect(() => validateAuthorityTenantIdV1('*')).toThrow(
      AuthorityTenantScopeValidationError,
    );
  });

  it('18 rejects oversized tenant IDs', () => {
    expect(() => validateAuthorityTenantIdV1(`t${'x'.repeat(128)}`)).toThrow(
      AuthorityTenantScopeValidationError,
    );
  });

  it('19 validates an explicit tenant selector', () => {
    expect(createAuthorityTenantSelectorV1(selectorTenant())).toEqual(
      selectorTenant(),
    );
  });

  it('20 validates an explicit normalized alias selector', () => {
    expect(createAuthorityTenantSelectorV1(selectorAlias())).toEqual(
      selectorAlias(),
    );
  });

  it('21 normalizes aliases only through explicit closed rules', () => {
    expect(() =>
      createAuthorityTenantSelectorV1(selectorAlias('Tenant-Alpha')),
    ).toThrow(AuthorityTenantScopeValidationError);
  });

  it('22 rejects arbitrary collection paths', () => {
    expect(() =>
      createAuthorityTenantSelectorV1({
        ...selectorTenant(),
        collectionPath: 'platform_tenants/tenant_001',
      }),
    ).toThrow(AuthorityTenantScopeValidationError);
  });

  it('23 validates a membership binding without roles', () => {
    expect(createAuthorityTenantMembershipBindingV1(membership())).toEqual(
      membership(),
    );
  });

  it.each([
    ['simple ID', 'membership_001'],
    ['physical path', `authority_memberships/${MEMBERSHIP_ID}`],
    ['platform path', `platform_tenants/${MEMBERSHIP_ID}`],
    ['URL', `https://${MEMBERSHIP_ID}`],
    ['traversal', MEMBERSHIP_ID.replace('|', '..')],
    ['incorrect framing', MEMBERSHIP_ID.replace(
      `${PRINCIPAL_ID.length}:${PRINCIPAL_ID}`,
      `${PRINCIPAL_ID.length + 1}:${PRINCIPAL_ID}`,
    )],
  ] as const)(
    'rejects a non-canonical membership binding: %s',
    (_name, membershipId) => {
      expect(() =>
        createAuthorityTenantMembershipBindingV1(
          membership({ membershipId }),
        ),
      ).toThrow(AuthorityTenantScopeValidationError);
    },
  );

  it('24 rejects a membership principal mismatch', () => {
    expect(() =>
      createResolvedTenantAuthorityScopeV1({
        ...tenantScope(),
        membershipBinding: membership({
          principalId: 'apr_v1_human_other_binding_001',
        }),
      }),
    ).toThrow(AuthorityTenantScopeValidationError);
  });

  it('25 rejects a membership tenant mismatch', () => {
    expect(() =>
      createResolvedTenantAuthorityScopeV1({
        ...tenantScope(),
        membershipBinding: membership({ tenantId: 'tenant_002' }),
      }),
    ).toThrow(AuthorityTenantScopeValidationError);
  });

  it('26 represents inactive membership contractually', () => {
    expect(
      createAuthorityTenantMembershipBindingV1(
        membership({ membershipStatus: 'SUSPENDED' }),
      ).membershipStatus,
    ).toBe('SUSPENDED');
  });

  it('27 validates exact freshness', () => {
    expect(
      validateAuthorityTenantScopeFreshnessV1(freshness('tenant-v1')),
    ).toMatchObject({ staleAfterSeconds: 300 });
  });

  it('28 rejects invalid freshness ordering', () => {
    expect(() =>
      validateAuthorityTenantScopeFreshnessV1(
        freshness('tenant-v1', { validUntil: RESOLVED_AT }),
      ),
    ).toThrow(AuthorityTenantScopeValidationError);
  });

  it('29 validates a stale result', () => {
    expect(
      createAuthorityTenantScopeResolutionResultV1(
        failureResult(
          'STALE',
          'MEMBERSHIP_STALE',
          'RETRY_AFTER_MEMBERSHIP_REFRESH',
        ),
      ),
    ).toMatchObject({ status: 'STALE' });
  });

  it('30 validates a not-found result', () => {
    expect(
      createAuthorityTenantScopeResolutionResultV1(
        failureResult('NOT_FOUND', 'TENANT_NOT_FOUND', 'DO_NOT_RETRY'),
      ),
    ).toMatchObject({ status: 'NOT_FOUND' });
  });

  it('31 validates an ambiguous result without candidates', () => {
    expect(
      createAuthorityTenantScopeResolutionResultV1(
        failureResult(
          'AMBIGUOUS',
          'TENANT_ALIAS_AMBIGUOUS',
          'DO_NOT_RETRY',
        ),
      ),
    ).toEqual(
      failureResult(
        'AMBIGUOUS',
        'TENANT_ALIAS_AMBIGUOUS',
        'DO_NOT_RETRY',
      ),
    );
  });

  it('32 validates a conflict result', () => {
    expect(
      createAuthorityTenantScopeResolutionResultV1(
        failureResult(
          'CONFLICT',
          'PRINCIPAL_TENANT_BINDING_CONFLICT',
          'RETRY_AFTER_OPERATOR_REVIEW',
        ),
      ),
    ).toMatchObject({ status: 'CONFLICT' });
  });

  it('33 serializes internal errors safely', () => {
    const error = new AuthorityTenantScopeResolutionError('SAFE_TO_RETRY');
    expect(error.toJSON()).toEqual({
      version: '1',
      code: 'AUTHORITY_TENANT_SCOPE_RESOLUTION_FAILED',
      safeMessage: 'Authority tenant scope resolution failed.',
      retryDisposition: 'SAFE_TO_RETRY',
    });
    expect(JSON.stringify(error)).not.toMatch(
      /stack|tenant_001|platform_tenants/i,
    );
  });

  it('34 keeps platform scope free of synthetic tenant IDs', () => {
    const scope = createResolvedPlatformAuthorityScopeV1(platformScope());
    expect(Object.keys(scope)).not.toContain('tenantId');
  });

  it('35 grants no permission from platform scope', () => {
    expect(Object.keys(platformScope())).not.toContain('permission');
  });

  it('36 grants no permission from bootstrap scope', () => {
    expect(Object.keys(bootstrapScope())).not.toContain('permission');
  });

  it('37 rejects migration wildcard targets', () => {
    expect(() =>
      createResolvedMigrationTenantScopeV1(
        migrationScope({ targetTenantIds: ['*'] }),
      ),
    ).toThrow(AuthorityTenantScopeValidationError);
  });

  it('38 returns a deterministic sorted migration target set', () => {
    expect(
      createResolvedMigrationTenantScopeV1(migrationScope())
        .targetTenantIds,
    ).toEqual(['tenant_001', 'tenant_002']);
  });

  it('39 rejects full support impersonation', () => {
    expect(() =>
      createResolvedSupportTenantScopeV1(
        supportScope({ impersonationMode: 'FULL_IMPERSONATION' }),
      ),
    ).toThrow(AuthorityTenantScopeValidationError);
  });

  it('40 represents support session expiry explicitly', () => {
    expect(
      createResolvedSupportTenantScopeV1(supportScope()).allowedUntil,
    ).toBe(SUPPORT_UNTIL);
    expect(
      createAuthorityTenantScopeResolutionResultV1(
        failureResult(
          'STALE',
          'SUPPORT_SESSION_EXPIRED',
          'RETRY_AFTER_REFRESH',
        ),
      ),
    ).toMatchObject({ reasonCode: 'SUPPORT_SESSION_EXPIRED' });
  });

  it('41 rejects raw tokens in resolution requests', () => {
    expect(() =>
      createAuthorityTenantScopeResolutionRequestV1({
        ...resolutionRequest(),
        rawToken: 'header.payload.signature',
      }),
    ).toThrow(AuthorityTenantScopeValidationError);
  });

  it('42 rejects claims objects in resolution requests', () => {
    expect(() =>
      createAuthorityTenantScopeResolutionRequestV1({
        ...resolutionRequest(),
        claims: { tenantId: TENANT_ID },
      }),
    ).toThrow(AuthorityTenantScopeValidationError);
  });

  it('43 rejects authorization decisions in resolution requests', () => {
    expect(() =>
      createAuthorityTenantScopeResolutionRequestV1({
        ...resolutionRequest(),
        authorizationDecision: 'ALLOW',
      }),
    ).toThrow(AuthorityTenantScopeValidationError);
  });

  it('44 rejects permission fields in resolution requests', () => {
    expect(() =>
      createAuthorityTenantScopeResolutionRequestV1({
        ...resolutionRequest(),
        permission: 'tenant.write',
      }),
    ).toThrow(AuthorityTenantScopeValidationError);
  });

  it('45 rejects role fields in resolution requests', () => {
    expect(() =>
      createAuthorityTenantScopeResolutionRequestV1({
        ...resolutionRequest(),
        role: 'PLATFORM_ADMIN',
      }),
    ).toThrow(AuthorityTenantScopeValidationError);
  });

  it('46 accepts plain null-prototype records', () => {
    const value = Object.assign(Object.create(null), selectorTenant());
    expect(createAuthorityTenantSelectorV1(value)).toEqual(selectorTenant());
  });

  it('47 rejects class instances', () => {
    class TenantSelector {
      readonly schemaVersion = '1';
      readonly selectorType = 'TENANT_ID';
      readonly requestedTenantId = TENANT_ID;
    }
    expect(() =>
      createAuthorityTenantSelectorV1(new TenantSelector()),
    ).toThrow(AuthorityTenantScopeValidationError);
  });

  it('48 returns deeply immutable outputs', () => {
    const scope = createResolvedTenantAuthorityScopeV1(tenantScope());
    expect(Object.isFrozen(scope)).toBe(true);
    expect(Object.isFrozen(scope.membershipBinding)).toBe(true);
    expect(Object.isFrozen(scope.resolutionEvidence.sourceVersions)).toBe(
      true,
    );
  });

  it('49 produces deterministic factory output', () => {
    const first: AuthorityTenantScopeResolutionResultV1 =
      createAuthorityTenantScopeResolutionResultV1({
        schemaVersion: '1',
        status: 'RESOLVED',
        scope: tenantScope(),
      });
    const second = createAuthorityTenantScopeResolutionResultV1({
      schemaVersion: '1',
      status: 'RESOLVED',
      scope: tenantScope(),
    });
    expect(first).toEqual(second);
  });
});
