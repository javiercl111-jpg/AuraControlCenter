import {
  AUTHORITY_COMMAND_VERSION,
  AUTHORITY_LEGACY_TENANT_SOURCE_DESCRIPTOR_VERSION,
  AUTHORITY_LEGACY_TENANT_SOURCE_LOCATOR_VERSION,
  AUTHORITY_MIGRATION_METADATA_VERSION,
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
  createPersistedTenantAliasRecordV1,
  createPersistedTenantAuthorityRecordV1,
  createPersistedTenantMembershipRecordV1,
  decodeAuthorityLegacyTenantSourceRecordV1,
  type AuthorityAdministrativeCommandV1,
  type AuthorityApplicationExecutionContextV1,
  type AuthorityApplicationServiceRequestV1,
  type AuthorityAuthorizationObligationType,
  type AuthorityAuthorizationOperationBindingV1,
  type AuthorityAuthorizationResourceBindingV1,
  type AuthorityLegacyTenantSourceRecordV1,
  type AuthorityOperationType,
  type PersistedTenantAliasRecordV1,
  type PersistedTenantAuthorityRecordV1,
  type PersistedTenantMembershipRecordV1,
  type TenantAuthorityStatus,
  type TenantMembershipAuthorityStatus,
} from "@aura/intelligence-os/server";

import {
  CREATED_AT,
  EVALUATED_AT,
  HASH_A,
  HASH_B,
  OBLIGATION_VALID_UNTIL,
  PRINCIPAL_ID,
  RECEIVED_AT,
  TENANT_ID,
  executionContext,
  principalRequest,
} from "../../../../src/modules/intelligence/serverAuthorityApplicationService/tests/fixtures";

export {
  HASH_A,
  HASH_B,
  PRINCIPAL_ID,
  TENANT_ID,
};

export const END_TO_END_OCCURRED_AT =
  "2026-07-30T12:01:30.000Z";
export const END_TO_END_DEADLINE_AT =
  "2026-07-30T12:03:00.000Z";
export const END_TO_END_COMMAND_FINGERPRINT = HASH_B;
export const END_TO_END_CONTEXT_FINGERPRINT =
  `sha256:${"e".repeat(64)}`;
export const END_TO_END_LEGACY_DOCUMENT_ID =
  "D9AbCdEfGhIjKlMnOpQr";

const ACTOR = Object.freeze({
  actorType: "USER" as const,
  actorId: PRINCIPAL_ID,
});

const OPERATION_PERMISSIONS: Readonly<
  Record<AuthorityOperationType, string>
> = Object.freeze({
  CREATE_TENANT_AUTHORITY: "authority.tenant.create",
  UPDATE_TENANT_STATUS: "authority.tenant.status.update",
  CREATE_TENANT_MEMBERSHIP: "authority.membership.create",
  UPDATE_TENANT_MEMBERSHIP_ROLES:
    "authority.membership.roles.update",
  CHANGE_TENANT_MEMBERSHIP_STATUS:
    "authority.membership.status.update",
  RESERVE_TENANT_ALIAS: "authority.alias.reserve",
  TOMBSTONE_TENANT_ALIAS: "authority.alias.tombstone",
  CANONICALIZE_LEGACY_TENANT:
    "authority.legacy.canonicalize",
});

function createOnly() {
  return Object.freeze({
    schemaVersion: AUTHORITY_WRITE_PRECONDITION_VERSION,
    type: "MUST_NOT_EXIST" as const,
  });
}

export function atRecordVersion(recordVersion: number) {
  return Object.freeze({
    schemaVersion: AUTHORITY_WRITE_PRECONDITION_VERSION,
    type: "MUST_EXIST_AT_VERSION" as const,
    recordVersion,
  });
}

function command(
  operationType: AuthorityOperationType,
  payload: unknown,
  precondition: unknown,
  suffix: string,
  overrides: Readonly<Record<string, unknown>> = {},
): AuthorityAdministrativeCommandV1 {
  const identifierSuffix = suffix.replaceAll("-", "_");
  return createAuthorityAdministrativeCommandV1({
    schemaVersion: AUTHORITY_COMMAND_VERSION,
    operationType,
    operationId: `operation_d9_${identifierSuffix}`,
    idempotencyKey: `idempotency_d9_${identifierSuffix}`,
    actor: ACTOR,
    requestedAt: CREATED_AT,
    precondition,
    reasonCode: "ADMINISTRATIVE_CHANGE",
    requestId: `request_d9_${identifierSuffix}`,
    correlationId: `correlation_d9_${identifierSuffix}`,
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
      tenantSlug: `tenant-d9-${suffix}`,
    },
    createOnly(),
    suffix,
    overrides,
  );
}

export function updateTenantStatusCommand(
  currentStatus: TenantAuthorityStatus,
  targetStatus: TenantAuthorityStatus,
  suffix: string,
  activationPrerequisite?: unknown,
  precondition: unknown = atRecordVersion(1),
): AuthorityAdministrativeCommandV1 {
  return command(
    "UPDATE_TENANT_STATUS",
    {
      tenantId: TENANT_ID,
      currentStatus,
      targetStatus,
      ...(activationPrerequisite === undefined
        ? {}
        : { activationPrerequisite }),
    },
    precondition,
    suffix,
  );
}

export function membershipKey(): string {
  return createAuthorityMembershipKeyV1({
    principalType: "USER",
    principalId: PRINCIPAL_ID,
    tenantId: TENANT_ID,
  });
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

export function updateMembershipRolesCommand(
  roles: readonly string[],
  suffix: string,
  recordVersion = 1,
): AuthorityAdministrativeCommandV1 {
  return command(
    "UPDATE_TENANT_MEMBERSHIP_ROLES",
    {
      membershipKey: membershipKey(),
      principalType: "USER",
      principalId: PRINCIPAL_ID,
      tenantId: TENANT_ID,
      roles,
    },
    atRecordVersion(recordVersion),
    suffix,
  );
}

export function changeMembershipStatusCommand(
  currentStatus: TenantMembershipAuthorityStatus,
  targetStatus: TenantMembershipAuthorityStatus,
  suffix: string,
  recordVersion = 1,
): AuthorityAdministrativeCommandV1 {
  return command(
    "CHANGE_TENANT_MEMBERSHIP_STATUS",
    {
      membershipKey: membershipKey(),
      principalType: "USER",
      principalId: PRINCIPAL_ID,
      tenantId: TENANT_ID,
      currentStatus,
      targetStatus,
    },
    atRecordVersion(recordVersion),
    suffix,
  );
}

export function aliasKey(): string {
  return createAuthorityAliasKeyV1({
    aliasType: "TENANT_SLUG",
    normalizedAlias: "tenant-d9",
  });
}

export function reserveAliasCommand(
  suffix = "reserve-alias",
): AuthorityAdministrativeCommandV1 {
  return command(
    "RESERVE_TENANT_ALIAS",
    {
      aliasKey: aliasKey(),
      aliasType: "TENANT_SLUG",
      normalizedAlias: "tenant-d9",
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
      normalizedAlias: "tenant-d9",
      tenantId: TENANT_ID,
    },
    atRecordVersion(1),
    suffix,
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
      sourceDocumentId: END_TO_END_LEGACY_DOCUMENT_ID,
      sourceLocatorVersion:
        AUTHORITY_LEGACY_TENANT_SOURCE_LOCATOR_VERSION,
      authorityUse: "PROHIBITED",
    },
    {
      tenantSlug: "tenant-d9-legacy",
      status: "PENDING",
      clientId: "client_d9_001",
      organizationId: "organization_d9_001",
      recordVersion: 1,
      ...rawOverrides,
    },
    EVALUATED_AT,
  );
}

export function legacyCanonicalizationCommand(
  source = legacySource(),
  suffix = "legacy-canonicalization",
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
          tenantSlug: "tenant-d9-legacy",
        },
        selectedAliasCandidates,
        migrationMetadata: {
          schemaVersion: AUTHORITY_MIGRATION_METADATA_VERSION,
          authorityUse: "PROHIBITED",
          migrationVersion: "authority-d9-v1",
          sourceSystem: "legacy_platform",
          sourceLocatorKey: source.sourceLocator.locatorKey,
          sourceRecordVersion: source.sourceRecordVersion,
          sourceRecordFingerprint: source.sourceRecordFingerprint,
          classifiedVariant: source.classifiedVariant,
          migrationStatus: "VALIDATED",
          validatedAt: EVALUATED_AT,
        },
        conflictDisposition: "NONE",
      },
    },
    createOnly(),
    suffix,
  );
}

export function activationPrerequisite() {
  return Object.freeze({
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
  });
}

function authorizationResource(
  commandValue: AuthorityAdministrativeCommandV1,
): AuthorityAuthorizationResourceBindingV1 {
  switch (commandValue.operationType) {
    case "CREATE_TENANT_AUTHORITY":
    case "UPDATE_TENANT_STATUS":
      return Object.freeze({
        schemaVersion: "1",
        resourceType: "TENANT",
        tenantId: commandValue.payload.tenantId,
      });
    case "CREATE_TENANT_MEMBERSHIP":
      return Object.freeze({
        schemaVersion: "1",
        resourceType: "MEMBERSHIP",
        tenantId: commandValue.payload.tenantId,
        membershipId: createAuthorityMembershipKeyV1({
          principalType: commandValue.payload.principalType,
          principalId: commandValue.payload.principalId,
          tenantId: commandValue.payload.tenantId,
        }),
        targetPrincipalId: commandValue.payload.principalId,
      });
    case "UPDATE_TENANT_MEMBERSHIP_ROLES":
    case "CHANGE_TENANT_MEMBERSHIP_STATUS":
      return Object.freeze({
        schemaVersion: "1",
        resourceType: "MEMBERSHIP",
        tenantId: commandValue.payload.tenantId,
        membershipId: commandValue.payload.membershipKey,
        targetPrincipalId: commandValue.payload.principalId,
      });
    case "RESERVE_TENANT_ALIAS":
    case "TOMBSTONE_TENANT_ALIAS":
      return Object.freeze({
        schemaVersion: "1",
        resourceType: "ALIAS",
        tenantId: commandValue.payload.tenantId,
        aliasKey: commandValue.payload.aliasKey,
      });
    case "CANONICALIZE_LEGACY_TENANT":
      return Object.freeze({
        schemaVersion: "1",
        resourceType: "LEGACY_TENANT_SOURCE",
        sourceType: "PLATFORM_TENANTS",
        sourceLocatorKey:
          commandValue.payload.canonicalizationInput.sourceRecord
            .sourceLocator.locatorKey,
        canonicalTenantCandidate:
          commandValue.payload.canonicalizationInput.canonicalTarget
            .tenantId,
      });
  }
}

function authorizationOperation(
  commandValue: AuthorityAdministrativeCommandV1,
  resource: AuthorityAuthorizationResourceBindingV1,
): AuthorityAuthorizationOperationBindingV1 {
  const resourceId = resource.resourceType === "TENANT"
    ? resource.tenantId
    : resource.resourceType === "MEMBERSHIP"
      ? resource.membershipId
      : resource.resourceType === "ALIAS"
        ? resource.aliasKey
        : resource.sourceLocatorKey;
  return Object.freeze({
    schemaVersion: "1",
    operationType: commandValue.operationType,
    permission: OPERATION_PERMISSIONS[commandValue.operationType],
    commandVersion: commandValue.schemaVersion,
    resourceType: resource.resourceType,
    resourceId,
    operationId: commandValue.operationId,
    commandFingerprint: END_TO_END_COMMAND_FINGERPRINT,
    requestedAt: commandValue.requestedAt,
    channel: "FIREBASE_CALLABLE",
  });
}

export interface EndToEndRequestOptions {
  readonly evidenceTypes?: readonly AuthorityAuthorizationObligationType[];
  readonly resourceOverride?: AuthorityAuthorizationResourceBindingV1;
}

export function applicationRequestFor(
  commandValue: AuthorityAdministrativeCommandV1,
  options: EndToEndRequestOptions = {},
): AuthorityApplicationServiceRequestV1 {
  const resource =
    options.resourceOverride ?? authorizationResource(commandValue);
  const operation = authorizationOperation(commandValue, resource);
  const evidenceTypes = options.evidenceTypes ?? [
    "REQUIRE_IDEMPOTENCY_KEY",
  ];
  return Object.freeze({
    schemaVersion: "1",
    principalResolutionRequest: principalRequest(),
    tenantSelector: {
      schemaVersion: "1",
      selectorType: "TENANT_ID",
      requestedTenantId: TENANT_ID,
    },
    scopeOperationCategory: "TENANT_OPERATION",
    authorizationOperation: operation,
    authorizationResource: resource,
    command: commandValue,
    idempotency: {
      schemaVersion: "1",
      idempotencyKey: commandValue.idempotencyKey,
      callerKeyHash: HASH_A,
      namespaceVersion: "principal-scope-operation-v1",
      commandFingerprint: END_TO_END_COMMAND_FINGERPRINT,
    },
    obligationEvidence: Object.freeze(
      evidenceTypes.map((obligationType) => Object.freeze({
        schemaVersion: "1" as const,
        obligationType,
        evidenceFingerprint: HASH_A,
        observedAt: CREATED_AT,
        validUntil: OBLIGATION_VALID_UNTIL,
        verifierReference: "authority-d9-evidence",
      })),
    ),
  });
}

export function testExecutionContext(
  overrides: Readonly<Record<string, unknown>> = {},
): AuthorityApplicationExecutionContextV1 {
  return executionContext({
    receivedAt: RECEIVED_AT,
    evaluatedAt: EVALUATED_AT,
    createdAt: CREATED_AT,
    deadlineAt: END_TO_END_DEADLINE_AT,
    executionMode: "TEST_ONLY",
    ...overrides,
  });
}

export function tenantRecord(
  status: TenantAuthorityStatus = "PENDING",
  recordVersion = 1,
): PersistedTenantAuthorityRecordV1 {
  return createPersistedTenantAuthorityRecordV1(
    {
      schemaVersion: TENANT_AUTHORITY_RECORD_VERSION,
      tenantId: TENANT_ID,
      status,
      authorityVersion: recordVersion,
      recordVersion,
      createdAt: RECEIVED_AT,
      updatedAt: CREATED_AT,
      createdBy: ACTOR,
      updatedBy: ACTOR,
      statusChangedAt: CREATED_AT,
      statusReasonCode: "D9_TEST_SETUP",
    },
    TENANT_ID,
  );
}

export function membershipRecord(
  roles: readonly string[] = ["TENANT_ADMIN"],
  membershipVersion = 1,
  status: TenantMembershipAuthorityStatus = "ACTIVE",
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
      status,
      membershipVersion,
      authorityVersion: membershipVersion,
      createdAt: RECEIVED_AT,
      updatedAt: CREATED_AT,
      createdBy: ACTOR,
      updatedBy: ACTOR,
    },
    key,
  );
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
      normalizedAlias: "tenant-d9",
      tenantId: TENANT_ID,
      status,
      aliasVersion,
      authorityVersion: aliasVersion,
      createdAt: RECEIVED_AT,
      updatedAt: CREATED_AT,
      createdBy: ACTOR,
      updatedBy: ACTOR,
      ...(status === "TOMBSTONED"
        ? {
            tombstonedAt: CREATED_AT,
            tombstonedBy: ACTOR,
            tombstoneReasonCode: "D9_TEST_TOMBSTONE",
          }
        : {}),
    },
    key,
  );
}
