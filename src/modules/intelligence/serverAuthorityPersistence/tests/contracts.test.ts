import { describe, expect, it } from 'vitest';
import {
  AuthorityPersistenceContractError,
} from '../errors';
import {
  createAuthorityAdministrativeCommandV1,
  createAuthorityAuditEventV1,
  createAuthorityIdempotencyRecordV1,
  createAuthorityMigrationMetadataV1,
  createAuthorityOutboxEventV1,
  createAuthorityRepositoryResultV1,
  createAuthorityWritePreconditionV1,
  createPersistedTenantAliasRecordV1,
  createPersistedTenantAuthorityRecordV1,
  createPersistedTenantMembershipRecordV1,
} from '../factories';
import {
  createAuthorityAliasKeyV1,
  createAuthorityAuditEventIdV1,
  createAuthorityMembershipKeyV1,
  createAuthorityOutboxEventIdV1,
  validateTenantDocumentIdV1,
} from '../ids';
import {
  createAuthorityRepositoryResultFingerprintV1,
} from '../fingerprints';
import {
  assertTenantAuthorityTransitionV1,
  assertTenantMembershipTransitionV1,
  isTenantAuthorityTransitionAllowedV1,
  isTenantMembershipTransitionAllowedV1,
} from '../transitions';
import {
  AUTHORITY_AUDIT_EVENT_VERSION,
  AUTHORITY_COMMAND_VERSION,
  AUTHORITY_IDEMPOTENCY_RECORD_VERSION,
  AUTHORITY_MIGRATION_METADATA_VERSION,
  AUTHORITY_OUTBOX_EVENT_VERSION,
  AUTHORITY_REPOSITORY_RESULT_VERSION,
  AUTHORITY_TENANT_ROLE_VOCABULARY_VERSION,
  AUTHORITY_WRITE_PRECONDITION_VERSION,
  TENANT_ALIAS_RECORD_VERSION,
  TENANT_AUTHORITY_RECORD_VERSION,
  TENANT_MEMBERSHIP_RECORD_VERSION,
  type AuthorityOperationType,
} from '../types';
import {
  assertTenantAliasReservationCollisionFreeV1,
} from '../validators';

const CREATED_AT = '2026-07-29T10:00:00.000Z';
const CHANGED_AT = '2026-07-29T10:05:00.000Z';
const UPDATED_AT = '2026-07-29T10:10:00.000Z';
const COMPLETED_AT = '2026-07-29T10:15:00.000Z';
const FINGERPRINT = `sha256:${'a'.repeat(64)}`;
const TENANT_ID = 'tenantDoc001';
const PRINCIPAL_ID = 'firebase_uid_123';
const ACTOR = Object.freeze({
  actorType: 'USER' as const,
  actorId: PRINCIPAL_ID,
});

function validAppliedResult(
  overrides: Readonly<Record<string, unknown>> = {},
) {
  return {
    schemaVersion: AUTHORITY_REPOSITORY_RESULT_VERSION,
    operationId: 'operation:tenant-001',
    correlationId: 'correlation:authority-001',
    status: 'APPLIED',
    safeCode: 'TENANT_CREATED',
    resultingVersion: 1,
    resourceReference: `platform_tenants/${TENANT_ID}`,
    completedAt: COMPLETED_AT,
    retryDisposition: 'DO_NOT_RETRY',
    ...overrides,
  };
}

function validMigration(
  overrides: Readonly<Record<string, unknown>> = {},
) {
  return {
    schemaVersion: AUTHORITY_MIGRATION_METADATA_VERSION,
    authorityUse: 'PROHIBITED',
    migrationVersion: 'migration-v1',
    sourceSystem: 'legacy_platform',
    sourceReference: 'platform_tenants/legacy_tenant_001',
    classifiedVariant: 'AUTO_ID_WITH_TENANT_SLUG',
    migrationStatus: 'VALIDATED',
    validatedAt: CHANGED_AT,
    ...overrides,
  };
}

function validCanonicalizationInput(
  overrides: Readonly<Record<string, unknown>> = {},
) {
  return {
    schemaVersion: '1',
    canonicalDocumentId: TENANT_ID,
    classifiedVariant: 'AUTO_ID_WITH_TENANT_SLUG',
    classification: 'CANONICALIZABLE',
    sourceRecordVersion: 'legacy-v1',
    sourceRecordFingerprint: FINGERPRINT,
    canonicalTarget: {
      tenantId: TENANT_ID,
      status: 'PENDING',
      tenantSlug: 'tenant-alpha',
    },
    aliasesToReserve: [],
    migrationMetadata: validMigration(),
    conflictDisposition: 'NONE',
    ...overrides,
  };
}

function validTenant(
  overrides: Readonly<Record<string, unknown>> = {},
) {
  return {
    schemaVersion: TENANT_AUTHORITY_RECORD_VERSION,
    tenantId: TENANT_ID,
    status: 'ACTIVE',
    authorityVersion: 3,
    recordVersion: 7,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    createdBy: ACTOR,
    updatedBy: ACTOR,
    statusChangedAt: CHANGED_AT,
    statusReasonCode: 'TENANT_ACTIVATED',
    tenantSlug: 'tenant-alpha',
    organizationReference: 'organizations/org_001',
    clientReference: 'clients/client_001',
    ...overrides,
  };
}

function membershipKey(): string {
  return createAuthorityMembershipKeyV1({
    principalType: 'USER',
    principalId: PRINCIPAL_ID,
    tenantId: TENANT_ID,
  });
}

function validMembership(
  overrides: Readonly<Record<string, unknown>> = {},
) {
  const key = membershipKey();
  return {
    schemaVersion: TENANT_MEMBERSHIP_RECORD_VERSION,
    membershipId: key,
    membershipKey: key,
    principalType: 'USER',
    principalId: PRINCIPAL_ID,
    tenantId: TENANT_ID,
    roles: ['TENANT_ADMIN'],
    roleVocabularyVersion: AUTHORITY_TENANT_ROLE_VOCABULARY_VERSION,
    status: 'ACTIVE',
    membershipVersion: 4,
    authorityVersion: 3,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    createdBy: ACTOR,
    updatedBy: ACTOR,
    ...overrides,
  };
}

function aliasKey(): string {
  return createAuthorityAliasKeyV1({
    aliasType: 'TENANT_SLUG',
    normalizedAlias: 'tenant-alpha',
  });
}

function validAlias(
  overrides: Readonly<Record<string, unknown>> = {},
) {
  return {
    schemaVersion: TENANT_ALIAS_RECORD_VERSION,
    aliasKey: aliasKey(),
    aliasType: 'TENANT_SLUG',
    normalizedAlias: 'tenant-alpha',
    tenantId: TENANT_ID,
    status: 'ACTIVE',
    aliasVersion: 1,
    authorityVersion: 3,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    createdBy: ACTOR,
    updatedBy: ACTOR,
    ...overrides,
  };
}

function createOnlyPrecondition() {
  return {
    schemaVersion: AUTHORITY_WRITE_PRECONDITION_VERSION,
    type: 'MUST_NOT_EXIST',
  };
}

function expectedRecordVersionPrecondition() {
  return {
    schemaVersion: AUTHORITY_WRITE_PRECONDITION_VERSION,
    type: 'MUST_EXIST_AT_VERSION',
    recordVersion: 7,
  };
}

function command(
  operationType: AuthorityOperationType,
  payload: unknown,
  precondition: unknown,
  overrides: Readonly<Record<string, unknown>> = {},
) {
  return {
    schemaVersion: AUTHORITY_COMMAND_VERSION,
    operationType,
    operationId: `operation:${operationType.toLowerCase()}`,
    idempotencyKey: `idempotency:${operationType.toLowerCase()}`,
    actor: ACTOR,
    requestedAt: UPDATED_AT,
    precondition,
    reasonCode: 'ADMINISTRATIVE_CHANGE',
    requestId: 'request:authority-001',
    correlationId: 'correlation:authority-001',
    payload,
    ...overrides,
  };
}

function validAuditEvent(
  overrides: Readonly<Record<string, unknown>> = {},
) {
  const identity = {
    operationId: 'operation:tenant-status-001',
    eventType: 'TENANT_STATUS_CHANGED' as const,
    resourceType: 'TENANT' as const,
    resourceId: `platform_tenants/${TENANT_ID}`,
  };
  return {
    schemaVersion: AUTHORITY_AUDIT_EVENT_VERSION,
    eventId: createAuthorityAuditEventIdV1(identity),
    eventType: identity.eventType,
    operationId: identity.operationId,
    correlationId: 'correlation:authority-001',
    actor: ACTOR,
    resourceType: identity.resourceType,
    resourceId: identity.resourceId,
    reasonCode: 'ADMINISTRATIVE_CHANGE',
    beforeVersion: 6,
    afterVersion: 7,
    occurredAt: COMPLETED_AT,
    payloadSummary: {
      tenantStatusFrom: 'ACTIVE',
      tenantStatusTo: 'SUSPENDED',
    },
    ...overrides,
  };
}

describe('persisted tenant authority', () => {
  it('1 accepts a valid tenant document', () => {
    const result = createPersistedTenantAuthorityRecordV1(
      validTenant(),
      TENANT_ID,
    );
    expect(result).toMatchObject({
      tenantId: TENANT_ID,
      status: 'ACTIVE',
      recordVersion: 7,
    });
  });

  it('2 rejects a tenant document ID mismatch', () => {
    expect(() =>
      createPersistedTenantAuthorityRecordV1(
        validTenant(),
        'tenantDoc002',
      ),
    ).toThrow(AuthorityPersistenceContractError);
  });

  it('3 rejects aura_root case-insensitively', () => {
    expect(() =>
      createPersistedTenantAuthorityRecordV1(
        validTenant({ tenantId: 'AURA_ROOT' }),
        'AURA_ROOT',
      ),
    ).toThrow(AuthorityPersistenceContractError);
    expect(() => validateTenantDocumentIdV1('aura_root')).toThrow(
      AuthorityPersistenceContractError,
    );
  });

  it('4 rejects an unknown tenant status', () => {
    expect(() =>
      createPersistedTenantAuthorityRecordV1(
        validTenant({ status: 'GRACE_PERIOD' }),
        TENANT_ID,
      ),
    ).toThrow(AuthorityPersistenceContractError);
  });

  it('5 rejects non-positive versions and incoherent timestamps', () => {
    expect(() =>
      createPersistedTenantAuthorityRecordV1(
        validTenant({ recordVersion: 0 }),
        TENANT_ID,
      ),
    ).toThrow(AuthorityPersistenceContractError);
    expect(() =>
      createPersistedTenantAuthorityRecordV1(
        validTenant({ statusChangedAt: COMPLETED_AT }),
        TENANT_ID,
      ),
    ).toThrow(AuthorityPersistenceContractError);
  });

  it('6 accepts bounded, sorted migration aliases only with metadata', () => {
    const result = createPersistedTenantAuthorityRecordV1(
      validTenant({
        migrationState: validMigration(),
        legacyAliases: ['legacy-zeta', 'legacy-alpha'],
      }),
      TENANT_ID,
    );
    expect(result.legacyAliases).toEqual([
      'legacy-alpha',
      'legacy-zeta',
    ]);
  });
});

describe('persisted membership authority', () => {
  it('7 accepts a valid membership', () => {
    const result = createPersistedTenantMembershipRecordV1(
      validMembership(),
      membershipKey(),
    );
    expect(result.membershipId).toBe(membershipKey());
  });

  it('8 rejects a membership key mismatch', () => {
    expect(() =>
      createPersistedTenantMembershipRecordV1(
        validMembership({ membershipKey: 'wrong_membership_key' }),
        membershipKey(),
      ),
    ).toThrow(AuthorityPersistenceContractError);
  });

  it('9 rejects roles incompatible with the principal type', () => {
    const serviceKey = createAuthorityMembershipKeyV1({
      principalType: 'SERVICE',
      principalId: 'service_principal_123',
      tenantId: TENANT_ID,
    });
    expect(() =>
      createPersistedTenantMembershipRecordV1(
        validMembership({
          membershipId: serviceKey,
          membershipKey: serviceKey,
          principalType: 'SERVICE',
          principalId: 'service_principal_123',
          roles: ['TENANT_ADMIN'],
        }),
        serviceKey,
      ),
    ).toThrow(AuthorityPersistenceContractError);
  });

  it('10 enforces coherent revoked fields', () => {
    const revoked = createPersistedTenantMembershipRecordV1(
      validMembership({
        status: 'REVOKED',
        revokedAt: CHANGED_AT,
        revokedBy: ACTOR,
        revocationReasonCode: 'MEMBERSHIP_REVOKED',
      }),
      membershipKey(),
    );
    expect(revoked.status).toBe('REVOKED');
    expect(() =>
      createPersistedTenantMembershipRecordV1(
        validMembership({ status: 'REVOKED' }),
        membershipKey(),
      ),
    ).toThrow(AuthorityPersistenceContractError);
    expect(() =>
      createPersistedTenantMembershipRecordV1(
        validMembership({
          revokedAt: CHANGED_AT,
          revokedBy: ACTOR,
          revocationReasonCode: 'MEMBERSHIP_REVOKED',
        }),
        membershipKey(),
      ),
    ).toThrow(AuthorityPersistenceContractError);
  });

  it('11 sorts roles and rejects duplicates', () => {
    const result = createPersistedTenantMembershipRecordV1(
      validMembership({
        roles: ['TENANT_OPERATOR', 'TENANT_MEMBER'],
      }),
      membershipKey(),
    );
    expect(result.roles).toEqual(['TENANT_MEMBER', 'TENANT_OPERATOR']);
    expect(() =>
      createPersistedTenantMembershipRecordV1(
        validMembership({
          roles: ['TENANT_MEMBER', 'TENANT_MEMBER'],
        }),
        membershipKey(),
      ),
    ).toThrow(AuthorityPersistenceContractError);
  });
});

describe('persisted tenant aliases', () => {
  it('12 accepts a valid active alias', () => {
    expect(
      createPersistedTenantAliasRecordV1(validAlias(), aliasKey()).status,
    ).toBe('ACTIVE');
  });

  it('13 enforces coherent tombstone fields', () => {
    const tombstoned = createPersistedTenantAliasRecordV1(
      validAlias({
        status: 'TOMBSTONED',
        tombstonedAt: CHANGED_AT,
        tombstonedBy: ACTOR,
        tombstoneReasonCode: 'ALIAS_RETIRED',
      }),
      aliasKey(),
    );
    expect(tombstoned.status).toBe('TOMBSTONED');
    expect(() =>
      createPersistedTenantAliasRecordV1(
        validAlias({ status: 'TOMBSTONED' }),
        aliasKey(),
      ),
    ).toThrow(AuthorityPersistenceContractError);
  });

  it('14 derives deterministic reversible alias keys without hashes', () => {
    const first = createAuthorityAliasKeyV1({
      aliasType: 'CLIENT_REFERENCE',
      normalizedAlias: 'clients/client_001',
    });
    const second = createAuthorityAliasKeyV1({
      aliasType: 'CLIENT_REFERENCE',
      normalizedAlias: 'clients/client_001',
    });
    expect(first).toBe(second);
    expect(first).toContain('CLIENT_REFERENCE');
    expect(first).toContain('clients%2Fclient_001');
    expect(first).not.toMatch(/sha256/i);
  });

  it('15 rejects alias key mismatch and collision input', () => {
    expect(() =>
      createPersistedTenantAliasRecordV1(
        validAlias({ aliasKey: 'wrong_alias_key' }),
        aliasKey(),
      ),
    ).toThrow(AuthorityPersistenceContractError);
    expect(() =>
      assertTenantAliasReservationCollisionFreeV1(
        validAlias(),
        validAlias({ tenantId: 'tenantDoc002' }),
        aliasKey(),
      ),
    ).toThrow(AuthorityPersistenceContractError);
  });
});

describe('preconditions and administrative commands', () => {
  it('16 accepts an explicit create-only precondition', () => {
    expect(
      createAuthorityWritePreconditionV1(createOnlyPrecondition()),
    ).toEqual(createOnlyPrecondition());
  });

  it('17 rejects a blind update represented as MUST_NOT_EXIST', () => {
    expect(() =>
      createAuthorityAdministrativeCommandV1(
        command(
          'UPDATE_TENANT_STATUS',
          {
            tenantId: TENANT_ID,
            currentStatus: 'ACTIVE',
            targetStatus: 'SUSPENDED',
          },
          createOnlyPrecondition(),
        ),
      ),
    ).toThrow(AuthorityPersistenceContractError);
  });

  it('18 accepts exact record and authority version preconditions', () => {
    expect(
      createAuthorityWritePreconditionV1(
        expectedRecordVersionPrecondition(),
      ),
    ).toMatchObject({ type: 'MUST_EXIST_AT_VERSION', recordVersion: 7 });
    expect(
      createAuthorityWritePreconditionV1({
        schemaVersion: AUTHORITY_WRITE_PRECONDITION_VERSION,
        type: 'MUST_MATCH_AUTHORITY_VERSION',
        authorityVersion: 3,
      }),
    ).toMatchObject({
      type: 'MUST_MATCH_AUTHORITY_VERSION',
      authorityVersion: 3,
    });
  });

  it('19 validates all eight closed command payloads', () => {
    const key = membershipKey();
    const alias = aliasKey();
    const cases = [
      command(
        'CREATE_TENANT_AUTHORITY',
        {
          tenantId: TENANT_ID,
          initialStatus: 'PENDING',
          tenantSlug: 'tenant-alpha',
        },
        createOnlyPrecondition(),
      ),
      command(
        'UPDATE_TENANT_STATUS',
        {
          tenantId: TENANT_ID,
          currentStatus: 'ACTIVE',
          targetStatus: 'SUSPENDED',
        },
        expectedRecordVersionPrecondition(),
      ),
      command(
        'CREATE_TENANT_MEMBERSHIP',
        {
          principalType: 'USER',
          principalId: PRINCIPAL_ID,
          tenantId: TENANT_ID,
          roles: ['TENANT_ADMIN'],
          initialStatus: 'ACTIVE',
        },
        createOnlyPrecondition(),
      ),
      command(
        'UPDATE_TENANT_MEMBERSHIP_ROLES',
        {
          membershipKey: key,
          principalType: 'USER',
          principalId: PRINCIPAL_ID,
          tenantId: TENANT_ID,
          roles: ['TENANT_OPERATOR'],
        },
        expectedRecordVersionPrecondition(),
      ),
      command(
        'CHANGE_TENANT_MEMBERSHIP_STATUS',
        {
          membershipKey: key,
          principalType: 'USER',
          principalId: PRINCIPAL_ID,
          tenantId: TENANT_ID,
          currentStatus: 'ACTIVE',
          targetStatus: 'SUSPENDED',
        },
        expectedRecordVersionPrecondition(),
      ),
      command(
        'RESERVE_TENANT_ALIAS',
        {
          aliasKey: alias,
          aliasType: 'TENANT_SLUG',
          normalizedAlias: 'tenant-alpha',
          tenantId: TENANT_ID,
        },
        createOnlyPrecondition(),
      ),
      command(
        'TOMBSTONE_TENANT_ALIAS',
        {
          aliasKey: alias,
          aliasType: 'TENANT_SLUG',
          normalizedAlias: 'tenant-alpha',
          tenantId: TENANT_ID,
        },
        expectedRecordVersionPrecondition(),
      ),
      command(
        'CANONICALIZE_LEGACY_TENANT',
        {
          canonicalizationInput: validCanonicalizationInput(),
        },
        expectedRecordVersionPrecondition(),
      ),
    ];
    expect(
      cases.map(
        (value) =>
          createAuthorityAdministrativeCommandV1(value).operationType,
      ),
    ).toEqual([
      'CREATE_TENANT_AUTHORITY',
      'UPDATE_TENANT_STATUS',
      'CREATE_TENANT_MEMBERSHIP',
      'UPDATE_TENANT_MEMBERSHIP_ROLES',
      'CHANGE_TENANT_MEMBERSHIP_STATUS',
      'RESERVE_TENANT_ALIAS',
      'TOMBSTONE_TENANT_ALIAS',
      'CANONICALIZE_LEGACY_TENANT',
    ]);
  });

  it('20 requires operationId and correlationId', () => {
    const source = command(
      'CREATE_TENANT_AUTHORITY',
      { tenantId: TENANT_ID, initialStatus: 'PENDING' },
      createOnlyPrecondition(),
    );
    expect(() =>
      createAuthorityAdministrativeCommandV1({
        ...source,
        operationId: '',
      }),
    ).toThrow(AuthorityPersistenceContractError);
    expect(() =>
      createAuthorityAdministrativeCommandV1({
        ...source,
        correlationId: '',
      }),
    ).toThrow(AuthorityPersistenceContractError);
  });

  it('21 rejects command payload keys inconsistent with derived IDs', () => {
    expect(() =>
      createAuthorityAdministrativeCommandV1(
        command(
          'RESERVE_TENANT_ALIAS',
          {
            aliasKey: 'wrong_alias_key',
            aliasType: 'TENANT_SLUG',
            normalizedAlias: 'tenant-alpha',
            tenantId: TENANT_ID,
          },
          createOnlyPrecondition(),
        ),
      ),
    ).toThrow(AuthorityPersistenceContractError);
  });
});

describe('closed transition matrices', () => {
  it('22 accepts certified tenant transitions', () => {
    expect(isTenantAuthorityTransitionAllowedV1('PENDING', 'ACTIVE')).toBe(
      true,
    );
    expect(() =>
      assertTenantAuthorityTransitionV1('ACTIVE', 'SUSPENDED'),
    ).not.toThrow();
  });

  it('23 rejects tenant jumps and makes DELETED terminal', () => {
    expect(() =>
      assertTenantAuthorityTransitionV1('PENDING', 'DELETED'),
    ).toThrow(AuthorityPersistenceContractError);
    expect(() =>
      assertTenantAuthorityTransitionV1('DELETED', 'ACTIVE'),
    ).toThrow(AuthorityPersistenceContractError);
  });

  it('24 accepts certified membership transitions', () => {
    expect(
      isTenantMembershipTransitionAllowedV1('ACTIVE', 'REVOKED'),
    ).toBe(true);
    expect(() =>
      assertTenantMembershipTransitionV1('SUSPENDED', 'ACTIVE'),
    ).not.toThrow();
  });

  it('25 rejects membership jumps and makes DELETED terminal', () => {
    expect(() =>
      assertTenantMembershipTransitionV1('ACTIVE', 'DELETED'),
    ).toThrow(AuthorityPersistenceContractError);
    expect(() =>
      assertTenantMembershipTransitionV1('DELETED', 'ACTIVE'),
    ).toThrow(AuthorityPersistenceContractError);
  });
});

describe('idempotency and repository-safe results', () => {
  it('26 accepts coherent idempotency lifecycle states', () => {
    const exactRepositoryResult =
      createAuthorityRepositoryResultV1(validAppliedResult());
    expect(
      createAuthorityIdempotencyRecordV1({
        schemaVersion: AUTHORITY_IDEMPOTENCY_RECORD_VERSION,
        idempotencyKey: 'idempotency:tenant-001',
        operationId: exactRepositoryResult.operationId,
        operationType: 'CREATE_TENANT_AUTHORITY',
        requestFingerprint: FINGERPRINT,
        status: 'COMPLETED',
        startedAt: CREATED_AT,
        completedAt: COMPLETED_AT,
        exactRepositoryResult,
        resultFingerprint:
          createAuthorityRepositoryResultFingerprintV1(
            exactRepositoryResult,
          ),
        version: 2,
      }).status,
    ).toBe('COMPLETED');
  });

  it('27 rejects contradictory idempotency fields', () => {
    expect(() =>
      createAuthorityIdempotencyRecordV1({
        schemaVersion: AUTHORITY_IDEMPOTENCY_RECORD_VERSION,
        idempotencyKey: 'idempotency:tenant-001',
        operationId: 'operation:tenant-001',
        operationType: 'CREATE_TENANT_AUTHORITY',
        requestFingerprint: FINGERPRINT,
        status: 'IN_PROGRESS',
        startedAt: CREATED_AT,
        completedAt: COMPLETED_AT,
        version: 1,
      }),
    ).toThrow(AuthorityPersistenceContractError);
  });

  it('28 accepts a closed APPLIED result', () => {
    expect(
      createAuthorityRepositoryResultV1(validAppliedResult()),
    ).toMatchObject({ status: 'APPLIED', resultingVersion: 1 });
  });

  it('29 rejects a contradictory rejected result', () => {
    expect(() =>
      createAuthorityRepositoryResultV1({
        schemaVersion: AUTHORITY_REPOSITORY_RESULT_VERSION,
        operationId: 'operation:tenant-001',
        correlationId: 'correlation:authority-001',
        status: 'REJECTED',
        safeCode: 'REQUEST_REJECTED',
        resultingVersion: 1,
        resourceReference: `platform_tenants/${TENANT_ID}`,
        completedAt: COMPLETED_AT,
        retryDisposition: 'DO_NOT_RETRY',
      }),
    ).toThrow(AuthorityPersistenceContractError);
  });
});

describe('neutral audit, outbox, and migration contracts', () => {
  it('30 accepts a valid audit event', () => {
    expect(createAuthorityAuditEventV1(validAuditEvent()).eventType).toBe(
      'TENANT_STATUS_CHANGED',
    );
  });

  it('31 rejects PII or arbitrary data in audit summaries', () => {
    expect(() =>
      createAuthorityAuditEventV1(
        validAuditEvent({
          payloadSummary: {
            tenantStatusFrom: 'ACTIVE',
            tenantStatusTo: 'SUSPENDED',
            email: 'person@example.com',
          },
        }),
      ),
    ).toThrow(AuthorityPersistenceContractError);
  });

  it('32 accepts a valid neutral outbox event', () => {
    const source = validAuditEvent();
    expect(
      createAuthorityOutboxEventV1({
        ...source,
        schemaVersion: AUTHORITY_OUTBOX_EVENT_VERSION,
        eventId: createAuthorityOutboxEventIdV1({
          operationId: source.operationId,
          eventType: source.eventType,
          resourceType: source.resourceType,
          resourceId: source.resourceId,
        }),
      }).eventType,
    ).toBe('TENANT_STATUS_CHANGED');
  });

  it('33 accepts migration metadata explicitly prohibited as authority', () => {
    const metadata = createAuthorityMigrationMetadataV1(validMigration());
    expect(metadata).toMatchObject({
      migrationStatus: 'VALIDATED',
      authorityUse: 'PROHIBITED',
    });
  });

  it('34 cannot validate migration metadata as tenant authority', () => {
    expect(() =>
      createPersistedTenantAuthorityRecordV1(
        validMigration(),
        TENANT_ID,
      ),
    ).toThrow(AuthorityPersistenceContractError);
  });
});

describe('determinism, cloning, freezing, and closed input', () => {
  it('35 clones caller-owned role arrays and actors', () => {
    const roles = ['TENANT_ADMIN'];
    const createdBy = {
      actorType: 'USER',
      actorId: PRINCIPAL_ID,
    };
    const result = createPersistedTenantMembershipRecordV1(
      validMembership({ roles, createdBy }),
      membershipKey(),
    );
    expect(result.roles).not.toBe(roles);
    expect(result.createdBy).not.toBe(createdBy);
  });

  it('36 deeply freezes returned contract structures', () => {
    const membership = createPersistedTenantMembershipRecordV1(
      validMembership(),
      membershipKey(),
    );
    const tenant = createPersistedTenantAuthorityRecordV1(
      validTenant({ migrationState: validMigration() }),
      TENANT_ID,
    );
    expect(Object.isFrozen(membership)).toBe(true);
    expect(Object.isFrozen(membership.roles)).toBe(true);
    expect(Object.isFrozen(membership.createdBy)).toBe(true);
    expect(Object.isFrozen(tenant.migrationState)).toBe(true);
  });

  it('37 caller mutation after construction cannot alter authority', () => {
    const roles = ['TENANT_ADMIN'];
    const actor = {
      actorType: 'USER',
      actorId: PRINCIPAL_ID,
    };
    const result = createPersistedTenantMembershipRecordV1(
      validMembership({ roles, createdBy: actor }),
      membershipKey(),
    );
    roles[0] = 'TENANT_MEMBER';
    actor.actorId = 'attacker_123';
    expect(result.roles).toEqual(['TENANT_ADMIN']);
    expect(result.createdBy.actorId).toBe(PRINCIPAL_ID);
  });

  it('38 rejects unknown fields throughout contracts', () => {
    expect(() =>
      createPersistedTenantAuthorityRecordV1(
        validTenant({ firebaseUid: PRINCIPAL_ID }),
        TENANT_ID,
      ),
    ).toThrow(AuthorityPersistenceContractError);
    expect(() =>
      createAuthorityWritePreconditionV1({
        ...createOnlyPrecondition(),
        expectedVersion: 1,
      }),
    ).toThrow(AuthorityPersistenceContractError);
  });

  it('39 returns generic errors without authority values', () => {
    try {
      createPersistedTenantAuthorityRecordV1(
        validTenant({ tenantId: 'aura_root' }),
        'aura_root',
      );
      throw new Error('Expected rejection');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(AuthorityPersistenceContractError);
      expect((error as Error).message).toBe(
        'Authority persistence contract is invalid.',
      );
      expect((error as Error).message).not.toContain('aura_root');
    }
  });
});
