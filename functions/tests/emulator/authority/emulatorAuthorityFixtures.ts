import {
  AUTHORITY_COMMAND_VERSION,
  AUTHORITY_LEGACY_TENANT_SOURCE_DESCRIPTOR_VERSION,
  AUTHORITY_LEGACY_TENANT_SOURCE_LOCATOR_VERSION,
  AUTHORITY_MIGRATION_METADATA_VERSION,
  AUTHORITY_REPOSITORY_AUTHORIZATION_DECISION_VERSION,
  AUTHORITY_REPOSITORY_INVOCATION_CONTEXT_VERSION,
  AUTHORITY_TENANT_ROLE_VOCABULARY_VERSION,
  AUTHORITY_WRITE_PRECONDITION_VERSION,
  LEGACY_TENANT_CANONICALIZATION_INPUT_VERSION,
  TENANT_ACTIVATION_PREREQUISITE_VERSION,
  TENANT_ALIAS_RECORD_VERSION,
  TENANT_AUTHORITY_RECORD_VERSION,
  TENANT_MEMBERSHIP_RECORD_VERSION,
  createAuthorityAdministrativeCommandV1,
  createAuthorityAliasKeyV1,
  createAuthorityMembershipKeyV1,
  createAuthorityRepositoryInvocationContextV1,
  createPersistedTenantAliasRecordV1,
  createPersistedTenantAuthorityRecordV1,
  createPersistedTenantMembershipRecordV1,
  decodeAuthorityLegacyTenantSourceRecordV1,
  type AuthorityAdministrativeCommandV1,
  type AuthorityClockPort,
  type AuthorityLegacyTenantSourceRecordV1,
  type AuthorityOperationType,
  type AuthorityRepositoryInvocationContextV1,
  type PersistedTenantAliasRecordV1,
  type PersistedTenantAuthorityRecordV1,
  type PersistedTenantMembershipRecordV1,
  type TenantAuthorityStatus,
} from "@aura/intelligence-os/server";

export const AUTHENTICATED_AT =
  "2026-07-30T14:00:00.000Z";
export const DECIDED_AT = "2026-07-30T14:01:00.000Z";
export const INITIATED_AT = "2026-07-30T14:02:00.000Z";
export const REQUESTED_AT = "2026-07-30T14:03:00.000Z";
export const OCCURRED_AT = "2026-07-30T14:04:00.000Z";
export const PRINCIPAL_ID = "principalFirestore001";
export const TENANT_ID = "tenantFirestore001";
export const LEGACY_DOCUMENT_ID = "AbCdEfGhIjKlMnOpQrSt";

const ACTOR = Object.freeze({
  actorType: "USER" as const,
  actorId: PRINCIPAL_ID,
});

export class FixedEmulatorAuthorityClock
  implements AuthorityClockPort
{
  calls = 0;

  nowIso(): string {
    this.calls += 1;
    return OCCURRED_AT;
  }
}

export function createOnly() {
  return {
    schemaVersion: AUTHORITY_WRITE_PRECONDITION_VERSION,
    type: "MUST_NOT_EXIST",
  };
}

export function atRecordVersion(recordVersion: number) {
  return {
    schemaVersion: AUTHORITY_WRITE_PRECONDITION_VERSION,
    type: "MUST_EXIST_AT_VERSION",
    recordVersion,
  };
}

export function atAuthorityVersion(authorityVersion: number) {
  return {
    schemaVersion: AUTHORITY_WRITE_PRECONDITION_VERSION,
    type: "MUST_MATCH_AUTHORITY_VERSION",
    authorityVersion,
  };
}

function command(
  operationType: AuthorityOperationType,
  payload: unknown,
  precondition: unknown,
  suffix: string,
  overrides: Readonly<Record<string, unknown>> = {},
): AuthorityAdministrativeCommandV1 {
  return createAuthorityAdministrativeCommandV1({
    schemaVersion: AUTHORITY_COMMAND_VERSION,
    operationType,
    operationId: `operation:emulator:${suffix}`,
    idempotencyKey: `idempotency:emulator:${suffix}`,
    actor: ACTOR,
    requestedAt: REQUESTED_AT,
    precondition,
    reasonCode: "ADMINISTRATIVE_CHANGE",
    requestId: `request:emulator:${suffix}`,
    correlationId: `correlation:emulator:${suffix}`,
    payload,
    ...overrides,
  });
}

export function createTenantCommand(
  suffix = "create-tenant",
  tenantId = TENANT_ID,
  overrides: Readonly<Record<string, unknown>> = {},
): AuthorityAdministrativeCommandV1 {
  return command(
    "CREATE_TENANT_AUTHORITY",
    {
      tenantId,
      initialStatus: "PENDING",
      tenantSlug: `tenant-${suffix}`,
    },
    createOnly(),
    suffix,
    overrides,
  );
}

export function authorityContext(
  commandValue: AuthorityAdministrativeCommandV1,
  cancellationSignal?: AbortSignal,
): AuthorityRepositoryInvocationContextV1 {
  return createAuthorityRepositoryInvocationContextV1(
    {
      schemaVersion:
        AUTHORITY_REPOSITORY_INVOCATION_CONTEXT_VERSION,
      principal: {
        schemaVersion: "1",
        principalId: PRINCIPAL_ID,
        principalType: "USER",
        authenticationMethod: "FIREBASE_ID_TOKEN",
        provider: "FIREBASE_AUTH",
        authenticatedAt: AUTHENTICATED_AT,
      },
      actor: ACTOR,
      authorizationDecision: {
        schemaVersion:
          AUTHORITY_REPOSITORY_AUTHORIZATION_DECISION_VERSION,
        decisionVersion:
          AUTHORITY_REPOSITORY_AUTHORIZATION_DECISION_VERSION,
        decision: "ALLOWED",
        authorizationVersion: "authority-policy-v1",
        operationTypes: [commandValue.operationType],
        principalType: "USER",
        principalId: PRINCIPAL_ID,
        actorType: "USER",
        actorId: PRINCIPAL_ID,
        decidedAt: DECIDED_AT,
        safeReasonCode: "AUTHORITY_OPERATION_ALLOWED",
      },
      authorizedOperationTypes: [commandValue.operationType],
      consumerId: "AUTHORITY_FIRESTORE_EMULATOR_TEST",
      source: "TRUSTED_FIRESTORE_EMULATOR_TEST",
      requestId: commandValue.requestId,
      correlationId: commandValue.correlationId,
      initiatedAt: INITIATED_AT,
      authorizationVersion: "authority-policy-v1",
      ...(cancellationSignal === undefined
        ? {}
        : { cancellationSignal }),
    },
    commandValue,
  );
}

export function tenantRecord(
  status: TenantAuthorityStatus = "PENDING",
  recordVersion = 1,
  authorityVersion = recordVersion,
): PersistedTenantAuthorityRecordV1 {
  return createPersistedTenantAuthorityRecordV1(
    {
      schemaVersion: TENANT_AUTHORITY_RECORD_VERSION,
      tenantId: TENANT_ID,
      status,
      authorityVersion,
      recordVersion,
      createdAt: AUTHENTICATED_AT,
      updatedAt: INITIATED_AT,
      createdBy: ACTOR,
      updatedBy: ACTOR,
      statusChangedAt: INITIATED_AT,
      statusReasonCode: "TEST_SETUP",
    },
    TENANT_ID,
  );
}

export function membershipKey(): string {
  return createAuthorityMembershipKeyV1({
    principalType: "USER",
    principalId: PRINCIPAL_ID,
    tenantId: TENANT_ID,
  });
}

export function membershipRecord(
  roles: readonly string[] = ["TENANT_ADMIN"],
  membershipVersion = 1,
  authorityVersion = membershipVersion,
): PersistedTenantMembershipRecordV1 {
  const key = membershipKey();
  return createPersistedTenantMembershipRecordV1(
    {
      schemaVersion: TENANT_MEMBERSHIP_RECORD_VERSION,
      membershipId: key,
      membershipKey: key,
      principalType: "USER",
      principalId: PRINCIPAL_ID,
      tenantId: TENANT_ID,
      roles,
      roleVocabularyVersion:
        AUTHORITY_TENANT_ROLE_VOCABULARY_VERSION,
      status: "ACTIVE",
      membershipVersion,
      authorityVersion,
      createdAt: AUTHENTICATED_AT,
      updatedAt: INITIATED_AT,
      createdBy: ACTOR,
      updatedBy: ACTOR,
    },
    key,
  );
}

export function aliasKey(): string {
  return createAuthorityAliasKeyV1({
    aliasType: "TENANT_SLUG",
    normalizedAlias: "tenant-firestore",
  });
}

export function aliasRecord(
  status: "ACTIVE" | "TOMBSTONED" = "ACTIVE",
  aliasVersion = 1,
): PersistedTenantAliasRecordV1 {
  const key = aliasKey();
  return createPersistedTenantAliasRecordV1(
    {
      schemaVersion: TENANT_ALIAS_RECORD_VERSION,
      aliasKey: key,
      aliasType: "TENANT_SLUG",
      normalizedAlias: "tenant-firestore",
      tenantId: TENANT_ID,
      status,
      aliasVersion,
      authorityVersion: aliasVersion,
      createdAt: AUTHENTICATED_AT,
      updatedAt: INITIATED_AT,
      createdBy: ACTOR,
      updatedBy: ACTOR,
      ...(status === "TOMBSTONED"
        ? {
            tombstonedAt: INITIATED_AT,
            tombstonedBy: ACTOR,
            tombstoneReasonCode: "TEST_TOMBSTONE",
          }
        : {}),
    },
    key,
  );
}

export function legacySource(
  rawOverrides: Readonly<Record<string, unknown>> = {},
): AuthorityLegacyTenantSourceRecordV1 {
  return decodeAuthorityLegacyTenantSourceRecordV1(
    {
      schemaVersion:
        AUTHORITY_LEGACY_TENANT_SOURCE_DESCRIPTOR_VERSION,
      sourceCollection: "PLATFORM_TENANTS",
      sourceDocumentId: LEGACY_DOCUMENT_ID,
      sourceLocatorVersion:
        AUTHORITY_LEGACY_TENANT_SOURCE_LOCATOR_VERSION,
      authorityUse: "PROHIBITED",
    },
    {
      tenantSlug: "tenant-legacy-firestore",
      status: "PENDING",
      clientId: "client_firestore_001",
      organizationId: "organization_firestore_001",
      recordVersion: 1,
      ...rawOverrides,
    },
    DECIDED_AT,
  );
}

export function legacyCommand(
  source = legacySource(),
  suffix = "canonicalize",
): AuthorityAdministrativeCommandV1 {
  const selectedAliasCandidates = source.aliasCandidates.filter(
    (candidate) =>
      candidate.disposition === "RESERVE" &&
      candidate.confidence !== "AMBIGUOUS",
  );
  return command(
    "CANONICALIZE_LEGACY_TENANT",
    {
      canonicalizationInput: {
        schemaVersion:
          LEGACY_TENANT_CANONICALIZATION_INPUT_VERSION,
        canonicalDocumentId: TENANT_ID,
        sourceRecord: source,
        canonicalTarget: {
          tenantId: TENANT_ID,
          status: source.normalizedStatus ?? "PENDING",
          tenantSlug: "tenant-legacy-firestore",
        },
        selectedAliasCandidates,
        migrationMetadata: {
          schemaVersion: AUTHORITY_MIGRATION_METADATA_VERSION,
          authorityUse: "PROHIBITED",
          migrationVersion: "firestore-emulator-v1",
          sourceSystem: "legacy_platform",
          sourceLocatorKey: source.sourceLocator.locatorKey,
          sourceRecordVersion: source.sourceRecordVersion,
          sourceRecordFingerprint: source.sourceRecordFingerprint,
          classifiedVariant: source.classifiedVariant,
          migrationStatus: "VALIDATED",
          validatedAt: DECIDED_AT,
        },
        conflictDisposition: "NONE",
      },
    },
    createOnly(),
    suffix,
  );
}

export function updateStatusCommand(
  currentStatus: TenantAuthorityStatus,
  targetStatus: TenantAuthorityStatus,
  suffix: string,
  activationPrerequisiteValue?: unknown,
  precondition: unknown = atRecordVersion(1),
): AuthorityAdministrativeCommandV1 {
  return command(
    "UPDATE_TENANT_STATUS",
    {
      tenantId: TENANT_ID,
      currentStatus,
      targetStatus,
      ...(activationPrerequisiteValue === undefined
        ? {}
        : {
            activationPrerequisite:
              activationPrerequisiteValue,
          }),
    },
    precondition,
    suffix,
  );
}

export function activationPrerequisite() {
  return {
    schemaVersion: TENANT_ACTIVATION_PREREQUISITE_VERSION,
    tenantId: TENANT_ID,
    tenantCurrentStatus: "PENDING",
    tenantExpectedRecordVersion: 1,
    membershipKey: membershipKey(),
    membershipPrincipalType: "USER",
    membershipPrincipalId: PRINCIPAL_ID,
    membershipTenantId: TENANT_ID,
    membershipStatus: "ACTIVE",
    membershipRoles: ["TENANT_ADMIN"],
    membershipExpectedVersion: 1,
  };
}

export function createMembershipCommand(
  suffix = "create-membership",
): AuthorityAdministrativeCommandV1 {
  return command(
    "CREATE_TENANT_MEMBERSHIP",
    {
      principalType: "USER",
      principalId: PRINCIPAL_ID,
      tenantId: TENANT_ID,
      roles: ["TENANT_ADMIN"],
      initialStatus: "ACTIVE",
    },
    createOnly(),
    suffix,
  );
}

export function reserveAliasCommand(
  suffix = "reserve-alias",
): AuthorityAdministrativeCommandV1 {
  return command(
    "RESERVE_TENANT_ALIAS",
    {
      aliasKey: aliasKey(),
      aliasType: "TENANT_SLUG",
      normalizedAlias: "tenant-firestore",
      tenantId: TENANT_ID,
    },
    createOnly(),
    suffix,
  );
}

export function tombstoneAliasCommand(
  suffix = "tombstone-alias",
): AuthorityAdministrativeCommandV1 {
  return command(
    "TOMBSTONE_TENANT_ALIAS",
    {
      aliasKey: aliasKey(),
      aliasType: "TENANT_SLUG",
      normalizedAlias: "tenant-firestore",
      tenantId: TENANT_ID,
    },
    atRecordVersion(1),
    suffix,
  );
}
