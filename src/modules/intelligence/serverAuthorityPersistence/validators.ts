import {
  TRUSTED_SERVER_PRINCIPAL_TYPES,
  TRUSTED_TENANT_MEMBERSHIP_ROLES,
  type TrustedServerPrincipalType,
  type TrustedTenantMembershipRole,
} from '../serverComposition/types';
import {
  createAuthorityAliasKeyV1,
  createAuthorityMembershipKeyV1,
} from './ids';
import {
  failAuthorityPersistenceContract,
  freezeArray,
  getClosedRecord,
  hasDefined,
  requireCanonicalActor,
  requireCanonicalDocumentId,
  requireCanonicalPrincipalId,
  requireCanonicalReference,
  requireCanonicalTimestamp,
  requireAuthorityResourceReference,
  requireEnumValue,
  requireExactLiteral,
  requireFingerprint,
  requireNonEmptyVersion,
  requireNonNegativeInteger,
  requireNormalizedAlias,
  requireOperationalId,
  requirePositiveInteger,
  requireReasonCode,
  requireTenantSlug,
  requireTimestampOrder,
  type PlainRecord,
} from './helpers';
import {
  assertTenantAuthorityTransitionV1,
  assertTenantMembershipTransitionV1,
} from './transitions';
import {
  AUTHORITY_AUDIT_EVENT_VERSION,
  AUTHORITY_COMMAND_VERSION,
  AUTHORITY_EVENT_TYPES,
  AUTHORITY_IDEMPOTENCY_RECORD_VERSION,
  AUTHORITY_IDEMPOTENCY_STATUSES,
  AUTHORITY_MIGRATION_METADATA_VERSION,
  AUTHORITY_MIGRATION_STATUSES,
  AUTHORITY_OPERATION_TYPES,
  AUTHORITY_OUTBOX_EVENT_VERSION,
  AUTHORITY_REPOSITORY_RESULT_STATUSES,
  AUTHORITY_REPOSITORY_RESULT_VERSION,
  AUTHORITY_RESOURCE_TYPES,
  AUTHORITY_TENANT_ROLE_VOCABULARY_VERSION,
  AUTHORITY_WRITE_PRECONDITION_TYPES,
  AUTHORITY_WRITE_PRECONDITION_VERSION,
  TENANT_ALIAS_RECORD_VERSION,
  TENANT_ALIAS_STATUSES,
  TENANT_ALIAS_TYPES,
  TENANT_AUTHORITY_RECORD_VERSION,
  TENANT_AUTHORITY_STATUSES,
  TENANT_MEMBERSHIP_AUTHORITY_STATUSES,
  TENANT_MEMBERSHIP_RECORD_VERSION,
  type AuthorityAdministrativeCommandV1,
  type AuthorityAuditEventV1,
  type AuthorityEventPayloadSummaryV1,
  type AuthorityEventType,
  type AuthorityIdempotencyRecordV1,
  type AuthorityMigrationMetadataV1,
  type AuthorityOperationType,
  type AuthorityOutboxEventV1,
  type AuthorityRepositoryResultV1,
  type AuthorityResourceType,
  type AuthorityWritePreconditionV1,
  type CanonicalizeLegacyTenantCommandV1,
  type ChangeTenantMembershipStatusCommandV1,
  type CreateTenantAuthorityCommandV1,
  type CreateTenantMembershipCommandV1,
  type PersistedTenantAliasRecordV1,
  type PersistedTenantAuthorityRecordV1,
  type PersistedTenantMembershipRecordV1,
  type ReserveTenantAliasCommandV1,
  type TenantAliasType,
  type TombstoneTenantAliasCommandV1,
  type UpdateTenantMembershipRolesCommandV1,
  type UpdateTenantStatusCommandV1,
} from './types';

const TENANT_RECORD_KEYS = [
  'schemaVersion',
  'tenantId',
  'status',
  'authorityVersion',
  'recordVersion',
  'createdAt',
  'updatedAt',
  'createdBy',
  'updatedBy',
  'statusChangedAt',
  'statusReasonCode',
  'tenantSlug',
  'organizationReference',
  'clientReference',
  'migrationState',
  'legacyAliases',
] as const;

const MEMBERSHIP_RECORD_KEYS = [
  'schemaVersion',
  'membershipId',
  'membershipKey',
  'principalType',
  'principalId',
  'tenantId',
  'roles',
  'roleVocabularyVersion',
  'status',
  'membershipVersion',
  'authorityVersion',
  'createdAt',
  'updatedAt',
  'createdBy',
  'updatedBy',
  'revokedAt',
  'revokedBy',
  'revocationReasonCode',
  'migrationState',
] as const;

const ALIAS_RECORD_KEYS = [
  'schemaVersion',
  'aliasKey',
  'aliasType',
  'normalizedAlias',
  'tenantId',
  'status',
  'aliasVersion',
  'authorityVersion',
  'createdAt',
  'updatedAt',
  'createdBy',
  'updatedBy',
  'tombstonedAt',
  'tombstonedBy',
  'tombstoneReasonCode',
] as const;

function validateRoles(
  value: unknown,
  principalType: TrustedServerPrincipalType,
): readonly TrustedTenantMembershipRole[] {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some(
      (role) =>
        typeof role !== 'string' ||
        !TRUSTED_TENANT_MEMBERSHIP_ROLES.includes(
          role as TrustedTenantMembershipRole,
        ),
    )
  ) {
    return failAuthorityPersistenceContract('INVALID_MEMBERSHIP_RECORD');
  }
  const roles = value as TrustedTenantMembershipRole[];
  if (new Set(roles).size !== roles.length) {
    return failAuthorityPersistenceContract('INVALID_MEMBERSHIP_RECORD');
  }
  const compatible =
    principalType === 'SYSTEM'
      ? roles.every((role) => role === 'TENANT_SYSTEM')
      : principalType === 'SERVICE'
        ? roles.every(
            (role) =>
              role === 'TENANT_SERVICE' || role === 'TENANT_MEMBER',
          )
        : roles.every(
            (role) =>
              role === 'TENANT_MEMBER' ||
              role === 'TENANT_OPERATOR' ||
              role === 'TENANT_ADMIN',
          );
  if (!compatible) {
    return failAuthorityPersistenceContract('INVALID_MEMBERSHIP_RECORD');
  }
  return freezeArray([...roles].sort());
}

function optionalCanonicalReference(
  value: unknown,
  issue:
    | 'INVALID_TENANT_RECORD'
    | 'INVALID_COMMAND',
): string | undefined {
  return value === undefined
    ? undefined
    : requireCanonicalReference(value, issue);
}

function optionalTenantSlug(
  value: unknown,
  issue:
    | 'INVALID_TENANT_RECORD'
    | 'INVALID_COMMAND',
): string | undefined {
  return value === undefined ? undefined : requireTenantSlug(value, issue);
}

export function validateAuthorityMigrationMetadataV1(
  value: unknown,
): AuthorityMigrationMetadataV1 {
  const record = getClosedRecord(
    value,
    [
      'schemaVersion',
      'authorityUse',
      'migrationVersion',
      'sourceSystem',
      'sourceReference',
      'classifiedVariant',
      'migrationStatus',
      'validatedAt',
      'appliedAt',
      'rejectionCode',
      'rollbackReference',
    ],
    'INVALID_MIGRATION_METADATA',
  );
  const migrationStatus = requireEnumValue(
    record.migrationStatus,
    AUTHORITY_MIGRATION_STATUSES,
    'INVALID_MIGRATION_METADATA',
  );
  const validatedAt =
    record.validatedAt === undefined
      ? undefined
      : requireCanonicalTimestamp(
          record.validatedAt,
          'INVALID_MIGRATION_METADATA',
        );
  const appliedAt =
    record.appliedAt === undefined
      ? undefined
      : requireCanonicalTimestamp(
          record.appliedAt,
          'INVALID_MIGRATION_METADATA',
        );
  const rejectionCode =
    record.rejectionCode === undefined
      ? undefined
      : requireReasonCode(
          record.rejectionCode,
          'INVALID_MIGRATION_METADATA',
        );
  const rollbackReference =
    record.rollbackReference === undefined
      ? undefined
      : requireCanonicalReference(
          record.rollbackReference,
          'INVALID_MIGRATION_METADATA',
        );
  if (
    (validatedAt !== undefined &&
      appliedAt !== undefined &&
      Date.parse(validatedAt) > Date.parse(appliedAt)) ||
    (migrationStatus === 'VALIDATED' &&
      (validatedAt === undefined ||
        appliedAt !== undefined ||
        rejectionCode !== undefined ||
        rollbackReference !== undefined)) ||
    (migrationStatus === 'APPLIED' &&
      (validatedAt === undefined ||
        appliedAt === undefined ||
        rejectionCode !== undefined ||
        rollbackReference !== undefined)) ||
    (migrationStatus === 'REJECTED' &&
      (rejectionCode === undefined ||
        appliedAt !== undefined ||
        rollbackReference !== undefined)) ||
    (migrationStatus === 'ROLLED_BACK' &&
      (validatedAt === undefined ||
        appliedAt === undefined ||
        rollbackReference === undefined ||
        rejectionCode !== undefined)) ||
    ((migrationStatus === 'INVENTORIED' ||
      migrationStatus === 'CLASSIFIED' ||
      migrationStatus === 'SHADOWED') &&
      (validatedAt !== undefined ||
        appliedAt !== undefined ||
        rejectionCode !== undefined ||
        rollbackReference !== undefined))
  ) {
    return failAuthorityPersistenceContract('INVALID_MIGRATION_METADATA');
  }
  return Object.freeze({
    schemaVersion: requireExactLiteral(
      record.schemaVersion,
      AUTHORITY_MIGRATION_METADATA_VERSION,
      'INVALID_MIGRATION_METADATA',
    ),
    authorityUse: requireExactLiteral(
      record.authorityUse,
      'PROHIBITED',
      'INVALID_MIGRATION_METADATA',
    ),
    migrationVersion: requireNonEmptyVersion(
      record.migrationVersion,
      'INVALID_MIGRATION_METADATA',
    ),
    sourceSystem: requireOperationalId(
      record.sourceSystem,
      'INVALID_MIGRATION_METADATA',
    ),
    sourceReference: requireCanonicalReference(
      record.sourceReference,
      'INVALID_MIGRATION_METADATA',
    ),
    classifiedVariant: requireReasonCode(
      record.classifiedVariant,
      'INVALID_MIGRATION_METADATA',
    ),
    migrationStatus,
    ...(validatedAt === undefined ? {} : { validatedAt }),
    ...(appliedAt === undefined ? {} : { appliedAt }),
    ...(rejectionCode === undefined ? {} : { rejectionCode }),
    ...(rollbackReference === undefined ? {} : { rollbackReference }),
  });
}

export function validatePersistedTenantAuthorityRecordV1(
  value: unknown,
  documentId: unknown,
): PersistedTenantAuthorityRecordV1 {
  const record = getClosedRecord(
    value,
    TENANT_RECORD_KEYS,
    'INVALID_TENANT_RECORD',
  );
  const tenantId = requireCanonicalDocumentId(
    record.tenantId,
    'INVALID_TENANT_RECORD',
  );
  const validatedDocumentId = requireCanonicalDocumentId(
    documentId,
    'INVALID_TENANT_RECORD',
  );
  if (tenantId !== validatedDocumentId) {
    return failAuthorityPersistenceContract('TENANT_DOCUMENT_ID_MISMATCH');
  }
  const createdAt = requireCanonicalTimestamp(
    record.createdAt,
    'INVALID_TENANT_RECORD',
  );
  const updatedAt = requireCanonicalTimestamp(
    record.updatedAt,
    'INVALID_TENANT_RECORD',
  );
  const statusChangedAt = requireCanonicalTimestamp(
    record.statusChangedAt,
    'INVALID_TENANT_RECORD',
  );
  requireTimestampOrder(
    createdAt,
    updatedAt,
    true,
    'INVALID_TENANT_RECORD',
  );
  requireTimestampOrder(
    createdAt,
    statusChangedAt,
    true,
    'INVALID_TENANT_RECORD',
  );
  requireTimestampOrder(
    statusChangedAt,
    updatedAt,
    true,
    'INVALID_TENANT_RECORD',
  );
  const tenantSlug = optionalTenantSlug(
    record.tenantSlug,
    'INVALID_TENANT_RECORD',
  );
  const organizationReference = optionalCanonicalReference(
    record.organizationReference,
    'INVALID_TENANT_RECORD',
  );
  const clientReference = optionalCanonicalReference(
    record.clientReference,
    'INVALID_TENANT_RECORD',
  );
  const migrationState =
    record.migrationState === undefined
      ? undefined
      : validateAuthorityMigrationMetadataV1(record.migrationState);
  let legacyAliases: readonly string[] | undefined;
  if (record.legacyAliases !== undefined) {
    if (
      !Array.isArray(record.legacyAliases) ||
      record.legacyAliases.length === 0 ||
      record.legacyAliases.length > 32 ||
      migrationState === undefined
    ) {
      return failAuthorityPersistenceContract('INVALID_TENANT_RECORD');
    }
    const aliases = record.legacyAliases.map((alias) =>
      requireNormalizedAlias(
        alias,
        'LEGACY_TENANT_ID',
        'INVALID_TENANT_RECORD',
      ),
    );
    if (new Set(aliases).size !== aliases.length) {
      return failAuthorityPersistenceContract('INVALID_TENANT_RECORD');
    }
    legacyAliases = freezeArray([...aliases].sort());
  }
  return Object.freeze({
    schemaVersion: requireExactLiteral(
      record.schemaVersion,
      TENANT_AUTHORITY_RECORD_VERSION,
      'INVALID_TENANT_RECORD',
    ),
    tenantId,
    status: requireEnumValue(
      record.status,
      TENANT_AUTHORITY_STATUSES,
      'INVALID_TENANT_RECORD',
    ),
    authorityVersion: requirePositiveInteger(
      record.authorityVersion,
      'INVALID_TENANT_RECORD',
    ),
    recordVersion: requirePositiveInteger(
      record.recordVersion,
      'INVALID_TENANT_RECORD',
    ),
    createdAt,
    updatedAt,
    createdBy: requireCanonicalActor(
      record.createdBy,
      'INVALID_TENANT_RECORD',
    ),
    updatedBy: requireCanonicalActor(
      record.updatedBy,
      'INVALID_TENANT_RECORD',
    ),
    statusChangedAt,
    statusReasonCode: requireReasonCode(
      record.statusReasonCode,
      'INVALID_TENANT_RECORD',
    ),
    ...(tenantSlug === undefined ? {} : { tenantSlug }),
    ...(organizationReference === undefined
      ? {}
      : { organizationReference }),
    ...(clientReference === undefined ? {} : { clientReference }),
    ...(migrationState === undefined ? {} : { migrationState }),
    ...(legacyAliases === undefined ? {} : { legacyAliases }),
  });
}

export function validatePersistedTenantMembershipRecordV1(
  value: unknown,
  documentId: unknown,
): PersistedTenantMembershipRecordV1 {
  const record = getClosedRecord(
    value,
    MEMBERSHIP_RECORD_KEYS,
    'INVALID_MEMBERSHIP_RECORD',
  );
  const principalType = requireEnumValue(
    record.principalType,
    TRUSTED_SERVER_PRINCIPAL_TYPES,
    'INVALID_MEMBERSHIP_RECORD',
  );
  const principalId = requireCanonicalPrincipalId(
    record.principalId,
    'INVALID_MEMBERSHIP_RECORD',
  );
  const tenantId = requireCanonicalDocumentId(
    record.tenantId,
    'INVALID_MEMBERSHIP_RECORD',
  );
  const expectedKey = createAuthorityMembershipKeyV1({
    principalType,
    principalId,
    tenantId,
  });
  if (
    record.membershipId !== expectedKey ||
    record.membershipKey !== expectedKey
  ) {
    return failAuthorityPersistenceContract('MEMBERSHIP_KEY_MISMATCH');
  }
  if (documentId !== expectedKey) {
    return failAuthorityPersistenceContract(
      'MEMBERSHIP_DOCUMENT_ID_MISMATCH',
    );
  }
  const status = requireEnumValue(
    record.status,
    TENANT_MEMBERSHIP_AUTHORITY_STATUSES,
    'INVALID_MEMBERSHIP_RECORD',
  );
  const createdAt = requireCanonicalTimestamp(
    record.createdAt,
    'INVALID_MEMBERSHIP_RECORD',
  );
  const updatedAt = requireCanonicalTimestamp(
    record.updatedAt,
    'INVALID_MEMBERSHIP_RECORD',
  );
  requireTimestampOrder(
    createdAt,
    updatedAt,
    true,
    'INVALID_MEMBERSHIP_RECORD',
  );
  const hasRevokedAt = hasDefined(record, 'revokedAt');
  const hasRevokedBy = hasDefined(record, 'revokedBy');
  const hasRevocationReason = hasDefined(record, 'revocationReasonCode');
  const hasAllRevocationFields =
    hasRevokedAt && hasRevokedBy && hasRevocationReason;
  const hasAnyRevocationField =
    hasRevokedAt || hasRevokedBy || hasRevocationReason;
  if (
    (status === 'REVOKED' && !hasAllRevocationFields) ||
    ((status === 'ACTIVE' || status === 'SUSPENDED') &&
      hasAnyRevocationField) ||
    (status === 'DELETED' &&
      hasAnyRevocationField &&
      !hasAllRevocationFields)
  ) {
    return failAuthorityPersistenceContract('INVALID_MEMBERSHIP_RECORD');
  }
  const revokedAt =
    hasRevokedAt
      ? requireCanonicalTimestamp(
          record.revokedAt,
          'INVALID_MEMBERSHIP_RECORD',
        )
      : undefined;
  if (revokedAt !== undefined) {
    requireTimestampOrder(
      createdAt,
      revokedAt,
      true,
      'INVALID_MEMBERSHIP_RECORD',
    );
    requireTimestampOrder(
      revokedAt,
      updatedAt,
      true,
      'INVALID_MEMBERSHIP_RECORD',
    );
  }
  const migrationState =
    record.migrationState === undefined
      ? undefined
      : validateAuthorityMigrationMetadataV1(record.migrationState);
  return Object.freeze({
    schemaVersion: requireExactLiteral(
      record.schemaVersion,
      TENANT_MEMBERSHIP_RECORD_VERSION,
      'INVALID_MEMBERSHIP_RECORD',
    ),
    membershipId: expectedKey,
    membershipKey: expectedKey,
    principalType,
    principalId,
    tenantId,
    roles: validateRoles(record.roles, principalType),
    roleVocabularyVersion: requireExactLiteral(
      record.roleVocabularyVersion,
      AUTHORITY_TENANT_ROLE_VOCABULARY_VERSION,
      'INVALID_MEMBERSHIP_RECORD',
    ),
    status,
    membershipVersion: requirePositiveInteger(
      record.membershipVersion,
      'INVALID_MEMBERSHIP_RECORD',
    ),
    authorityVersion: requirePositiveInteger(
      record.authorityVersion,
      'INVALID_MEMBERSHIP_RECORD',
    ),
    createdAt,
    updatedAt,
    createdBy: requireCanonicalActor(
      record.createdBy,
      'INVALID_MEMBERSHIP_RECORD',
    ),
    updatedBy: requireCanonicalActor(
      record.updatedBy,
      'INVALID_MEMBERSHIP_RECORD',
    ),
    ...(revokedAt === undefined ? {} : { revokedAt }),
    ...(hasRevokedBy
      ? {
          revokedBy: requireCanonicalActor(
            record.revokedBy,
            'INVALID_MEMBERSHIP_RECORD',
          ),
        }
      : {}),
    ...(hasRevocationReason
      ? {
          revocationReasonCode: requireReasonCode(
            record.revocationReasonCode,
            'INVALID_MEMBERSHIP_RECORD',
          ),
        }
      : {}),
    ...(migrationState === undefined ? {} : { migrationState }),
  });
}

export function validatePersistedTenantAliasRecordV1(
  value: unknown,
  documentId: unknown,
): PersistedTenantAliasRecordV1 {
  const record = getClosedRecord(
    value,
    ALIAS_RECORD_KEYS,
    'INVALID_ALIAS_RECORD',
  );
  const aliasType = requireEnumValue(
    record.aliasType,
    TENANT_ALIAS_TYPES,
    'INVALID_ALIAS_RECORD',
  );
  const normalizedAlias = requireNormalizedAlias(
    record.normalizedAlias,
    aliasType,
    'INVALID_ALIAS_RECORD',
  );
  const expectedKey = createAuthorityAliasKeyV1({
    aliasType,
    normalizedAlias,
  });
  if (record.aliasKey !== expectedKey) {
    return failAuthorityPersistenceContract('ALIAS_KEY_MISMATCH');
  }
  if (documentId !== expectedKey) {
    return failAuthorityPersistenceContract('ALIAS_DOCUMENT_ID_MISMATCH');
  }
  const status = requireEnumValue(
    record.status,
    TENANT_ALIAS_STATUSES,
    'INVALID_ALIAS_RECORD',
  );
  const createdAt = requireCanonicalTimestamp(
    record.createdAt,
    'INVALID_ALIAS_RECORD',
  );
  const updatedAt = requireCanonicalTimestamp(
    record.updatedAt,
    'INVALID_ALIAS_RECORD',
  );
  requireTimestampOrder(
    createdAt,
    updatedAt,
    true,
    'INVALID_ALIAS_RECORD',
  );
  const hasTombstonedAt = hasDefined(record, 'tombstonedAt');
  const hasTombstonedBy = hasDefined(record, 'tombstonedBy');
  const hasTombstoneReason = hasDefined(record, 'tombstoneReasonCode');
  const hasAllTombstoneFields =
    hasTombstonedAt && hasTombstonedBy && hasTombstoneReason;
  if (
    (status === 'TOMBSTONED' && !hasAllTombstoneFields) ||
    (status === 'ACTIVE' &&
      (hasTombstonedAt || hasTombstonedBy || hasTombstoneReason))
  ) {
    return failAuthorityPersistenceContract('INVALID_ALIAS_RECORD');
  }
  const tombstonedAt =
    hasTombstonedAt
      ? requireCanonicalTimestamp(
          record.tombstonedAt,
          'INVALID_ALIAS_RECORD',
        )
      : undefined;
  if (tombstonedAt !== undefined) {
    requireTimestampOrder(
      createdAt,
      tombstonedAt,
      true,
      'INVALID_ALIAS_RECORD',
    );
    requireTimestampOrder(
      tombstonedAt,
      updatedAt,
      true,
      'INVALID_ALIAS_RECORD',
    );
  }
  return Object.freeze({
    schemaVersion: requireExactLiteral(
      record.schemaVersion,
      TENANT_ALIAS_RECORD_VERSION,
      'INVALID_ALIAS_RECORD',
    ),
    aliasKey: expectedKey,
    aliasType,
    normalizedAlias,
    tenantId: requireCanonicalDocumentId(
      record.tenantId,
      'INVALID_ALIAS_RECORD',
    ),
    status,
    aliasVersion: requirePositiveInteger(
      record.aliasVersion,
      'INVALID_ALIAS_RECORD',
    ),
    authorityVersion: requirePositiveInteger(
      record.authorityVersion,
      'INVALID_ALIAS_RECORD',
    ),
    createdAt,
    updatedAt,
    createdBy: requireCanonicalActor(
      record.createdBy,
      'INVALID_ALIAS_RECORD',
    ),
    updatedBy: requireCanonicalActor(
      record.updatedBy,
      'INVALID_ALIAS_RECORD',
    ),
    ...(tombstonedAt === undefined ? {} : { tombstonedAt }),
    ...(hasTombstonedBy
      ? {
          tombstonedBy: requireCanonicalActor(
            record.tombstonedBy,
            'INVALID_ALIAS_RECORD',
          ),
        }
      : {}),
    ...(hasTombstoneReason
      ? {
          tombstoneReasonCode: requireReasonCode(
            record.tombstoneReasonCode,
            'INVALID_ALIAS_RECORD',
          ),
        }
      : {}),
  });
}

export function assertTenantAliasReservationCollisionFreeV1(
  existingValue: unknown | undefined,
  candidateValue: unknown,
  documentId: unknown,
): PersistedTenantAliasRecordV1 {
  const candidate = validatePersistedTenantAliasRecordV1(
    candidateValue,
    documentId,
  );
  if (candidate.status !== 'ACTIVE') {
    return failAuthorityPersistenceContract('INVALID_ALIAS_RECORD');
  }
  if (existingValue === undefined) {
    return candidate;
  }
  const existing = validatePersistedTenantAliasRecordV1(
    existingValue,
    documentId,
  );
  if (
    existing.status !== 'ACTIVE' ||
    existing.tenantId !== candidate.tenantId ||
    existing.aliasType !== candidate.aliasType ||
    existing.normalizedAlias !== candidate.normalizedAlias
  ) {
    return failAuthorityPersistenceContract('ALIAS_COLLISION');
  }
  return candidate;
}

export function validateAuthorityWritePreconditionV1(
  value: unknown,
): AuthorityWritePreconditionV1 {
  const broadRecord = getClosedRecord(
    value,
    ['schemaVersion', 'type', 'recordVersion', 'authorityVersion'],
    'INVALID_PRECONDITION',
  );
  const type = requireEnumValue(
    broadRecord.type,
    AUTHORITY_WRITE_PRECONDITION_TYPES,
    'INVALID_PRECONDITION',
  );
  const schemaVersion = requireExactLiteral(
    broadRecord.schemaVersion,
    AUTHORITY_WRITE_PRECONDITION_VERSION,
    'INVALID_PRECONDITION',
  );
  if (type === 'MUST_NOT_EXIST') {
    if (
      hasDefined(broadRecord, 'recordVersion') ||
      hasDefined(broadRecord, 'authorityVersion')
    ) {
      return failAuthorityPersistenceContract('INVALID_PRECONDITION');
    }
    return Object.freeze({ schemaVersion, type });
  }
  if (type === 'MUST_EXIST_AT_VERSION') {
    if (
      !hasDefined(broadRecord, 'recordVersion') ||
      hasDefined(broadRecord, 'authorityVersion')
    ) {
      return failAuthorityPersistenceContract('INVALID_PRECONDITION');
    }
    return Object.freeze({
      schemaVersion,
      type,
      recordVersion: requirePositiveInteger(
        broadRecord.recordVersion,
        'INVALID_PRECONDITION',
      ),
    });
  }
  if (
    !hasDefined(broadRecord, 'authorityVersion') ||
    hasDefined(broadRecord, 'recordVersion')
  ) {
    return failAuthorityPersistenceContract('INVALID_PRECONDITION');
  }
  return Object.freeze({
    schemaVersion,
    type,
    authorityVersion: requirePositiveInteger(
      broadRecord.authorityVersion,
      'INVALID_PRECONDITION',
    ),
  });
}

function validateCommandBase(
  record: PlainRecord,
  operationType: AuthorityOperationType,
): Readonly<{
  schemaVersion: typeof AUTHORITY_COMMAND_VERSION;
  operationType: AuthorityOperationType;
  operationId: string;
  idempotencyKey: string;
  actor: ReturnType<typeof requireCanonicalActor>;
  requestedAt: string;
  precondition: AuthorityWritePreconditionV1;
  reasonCode: string;
  correlationId: string;
}> {
  return Object.freeze({
    schemaVersion: requireExactLiteral(
      record.schemaVersion,
      AUTHORITY_COMMAND_VERSION,
      'INVALID_COMMAND',
    ),
    operationType,
    operationId: requireOperationalId(
      record.operationId,
      'INVALID_COMMAND',
    ),
    idempotencyKey: requireOperationalId(
      record.idempotencyKey,
      'INVALID_COMMAND',
    ),
    actor: requireCanonicalActor(record.actor, 'INVALID_COMMAND'),
    requestedAt: requireCanonicalTimestamp(
      record.requestedAt,
      'INVALID_COMMAND',
    ),
    precondition: validateAuthorityWritePreconditionV1(record.precondition),
    reasonCode: requireReasonCode(record.reasonCode, 'INVALID_COMMAND'),
    correlationId: requireOperationalId(
      record.correlationId,
      'INVALID_COMMAND',
    ),
  });
}

function requireCreatePrecondition(
  precondition: AuthorityWritePreconditionV1,
): asserts precondition is Extract<
  AuthorityWritePreconditionV1,
  { readonly type: 'MUST_NOT_EXIST' }
> {
  if (precondition.type !== 'MUST_NOT_EXIST') {
    failAuthorityPersistenceContract('BLIND_WRITE_PROHIBITED');
  }
}

function requireUpdatePrecondition(
  precondition: AuthorityWritePreconditionV1,
): void {
  if (precondition.type === 'MUST_NOT_EXIST') {
    failAuthorityPersistenceContract('BLIND_WRITE_PROHIBITED');
  }
}

function validateMembershipIdentityPayload(
  record: PlainRecord,
): Readonly<{
  membershipKey: string;
  principalType: TrustedServerPrincipalType;
  principalId: string;
  tenantId: string;
}> {
  const principalType = requireEnumValue(
    record.principalType,
    TRUSTED_SERVER_PRINCIPAL_TYPES,
    'INVALID_COMMAND',
  );
  const principalId = requireCanonicalPrincipalId(
    record.principalId,
    'INVALID_COMMAND',
  );
  const tenantId = requireCanonicalDocumentId(
    record.tenantId,
    'INVALID_COMMAND',
  );
  const membershipKey = createAuthorityMembershipKeyV1({
    principalType,
    principalId,
    tenantId,
  });
  if (record.membershipKey !== membershipKey) {
    return failAuthorityPersistenceContract('MEMBERSHIP_KEY_MISMATCH');
  }
  return Object.freeze({
    membershipKey,
    principalType,
    principalId,
    tenantId,
  });
}

function validateAliasIdentityPayload(
  record: PlainRecord,
): Readonly<{
  aliasKey: string;
  aliasType: TenantAliasType;
  normalizedAlias: string;
  tenantId: string;
}> {
  const aliasType = requireEnumValue(
    record.aliasType,
    TENANT_ALIAS_TYPES,
    'INVALID_COMMAND',
  );
  const normalizedAlias = requireNormalizedAlias(
    record.normalizedAlias,
    aliasType,
    'INVALID_COMMAND',
  );
  const aliasKey = createAuthorityAliasKeyV1({
    aliasType,
    normalizedAlias,
  });
  if (record.aliasKey !== aliasKey) {
    return failAuthorityPersistenceContract('ALIAS_KEY_MISMATCH');
  }
  return Object.freeze({
    aliasKey,
    aliasType,
    normalizedAlias,
    tenantId: requireCanonicalDocumentId(
      record.tenantId,
      'INVALID_COMMAND',
    ),
  });
}

function validateCreateTenantAuthorityCommand(
  record: PlainRecord,
  base: ReturnType<typeof validateCommandBase>,
): CreateTenantAuthorityCommandV1 {
  requireCreatePrecondition(base.precondition);
  const payload = getClosedRecord(
    record.payload,
    [
      'tenantId',
      'initialStatus',
      'tenantSlug',
      'organizationReference',
      'clientReference',
    ],
    'INVALID_COMMAND',
  );
  const tenantSlug = optionalTenantSlug(
    payload.tenantSlug,
    'INVALID_COMMAND',
  );
  const organizationReference = optionalCanonicalReference(
    payload.organizationReference,
    'INVALID_COMMAND',
  );
  const clientReference = optionalCanonicalReference(
    payload.clientReference,
    'INVALID_COMMAND',
  );
  return Object.freeze({
    ...base,
    operationType: 'CREATE_TENANT_AUTHORITY',
    precondition: base.precondition,
    payload: Object.freeze({
      tenantId: requireCanonicalDocumentId(
        payload.tenantId,
        'INVALID_COMMAND',
      ),
      initialStatus: requireExactLiteral(
        payload.initialStatus,
        'PENDING',
        'INVALID_COMMAND',
      ),
      ...(tenantSlug === undefined ? {} : { tenantSlug }),
      ...(organizationReference === undefined
        ? {}
        : { organizationReference }),
      ...(clientReference === undefined ? {} : { clientReference }),
    }),
  });
}

function validateUpdateTenantStatusCommand(
  record: PlainRecord,
  base: ReturnType<typeof validateCommandBase>,
): UpdateTenantStatusCommandV1 {
  requireUpdatePrecondition(base.precondition);
  const payload = getClosedRecord(
    record.payload,
    ['tenantId', 'currentStatus', 'targetStatus'],
    'INVALID_COMMAND',
  );
  const currentStatus = requireEnumValue(
    payload.currentStatus,
    TENANT_AUTHORITY_STATUSES,
    'INVALID_COMMAND',
  );
  const targetStatus = requireEnumValue(
    payload.targetStatus,
    TENANT_AUTHORITY_STATUSES,
    'INVALID_COMMAND',
  );
  assertTenantAuthorityTransitionV1(currentStatus, targetStatus);
  return Object.freeze({
    ...base,
    operationType: 'UPDATE_TENANT_STATUS',
    payload: Object.freeze({
      tenantId: requireCanonicalDocumentId(
        payload.tenantId,
        'INVALID_COMMAND',
      ),
      currentStatus,
      targetStatus,
    }),
  });
}

function validateCreateTenantMembershipCommand(
  record: PlainRecord,
  base: ReturnType<typeof validateCommandBase>,
): CreateTenantMembershipCommandV1 {
  requireCreatePrecondition(base.precondition);
  const payload = getClosedRecord(
    record.payload,
    ['principalType', 'principalId', 'tenantId', 'roles', 'initialStatus'],
    'INVALID_COMMAND',
  );
  const principalType = requireEnumValue(
    payload.principalType,
    TRUSTED_SERVER_PRINCIPAL_TYPES,
    'INVALID_COMMAND',
  );
  return Object.freeze({
    ...base,
    operationType: 'CREATE_TENANT_MEMBERSHIP',
    precondition: base.precondition,
    payload: Object.freeze({
      principalType,
      principalId: requireCanonicalPrincipalId(
        payload.principalId,
        'INVALID_COMMAND',
      ),
      tenantId: requireCanonicalDocumentId(
        payload.tenantId,
        'INVALID_COMMAND',
      ),
      roles: validateRoles(payload.roles, principalType),
      initialStatus: requireExactLiteral(
        payload.initialStatus,
        'ACTIVE',
        'INVALID_COMMAND',
      ),
    }),
  });
}

function validateUpdateMembershipRolesCommand(
  record: PlainRecord,
  base: ReturnType<typeof validateCommandBase>,
): UpdateTenantMembershipRolesCommandV1 {
  requireUpdatePrecondition(base.precondition);
  const payload = getClosedRecord(
    record.payload,
    [
      'membershipKey',
      'principalType',
      'principalId',
      'tenantId',
      'roles',
    ],
    'INVALID_COMMAND',
  );
  const identity = validateMembershipIdentityPayload(payload);
  return Object.freeze({
    ...base,
    operationType: 'UPDATE_TENANT_MEMBERSHIP_ROLES',
    payload: Object.freeze({
      ...identity,
      roles: validateRoles(payload.roles, identity.principalType),
    }),
  });
}

function validateChangeMembershipStatusCommand(
  record: PlainRecord,
  base: ReturnType<typeof validateCommandBase>,
): ChangeTenantMembershipStatusCommandV1 {
  requireUpdatePrecondition(base.precondition);
  const payload = getClosedRecord(
    record.payload,
    [
      'membershipKey',
      'principalType',
      'principalId',
      'tenantId',
      'currentStatus',
      'targetStatus',
    ],
    'INVALID_COMMAND',
  );
  const identity = validateMembershipIdentityPayload(payload);
  const currentStatus = requireEnumValue(
    payload.currentStatus,
    TENANT_MEMBERSHIP_AUTHORITY_STATUSES,
    'INVALID_COMMAND',
  );
  const targetStatus = requireEnumValue(
    payload.targetStatus,
    TENANT_MEMBERSHIP_AUTHORITY_STATUSES,
    'INVALID_COMMAND',
  );
  assertTenantMembershipTransitionV1(currentStatus, targetStatus);
  return Object.freeze({
    ...base,
    operationType: 'CHANGE_TENANT_MEMBERSHIP_STATUS',
    payload: Object.freeze({
      ...identity,
      currentStatus,
      targetStatus,
    }),
  });
}

function validateReserveAliasCommand(
  record: PlainRecord,
  base: ReturnType<typeof validateCommandBase>,
): ReserveTenantAliasCommandV1 {
  requireCreatePrecondition(base.precondition);
  const payload = getClosedRecord(
    record.payload,
    ['aliasKey', 'aliasType', 'normalizedAlias', 'tenantId'],
    'INVALID_COMMAND',
  );
  return Object.freeze({
    ...base,
    operationType: 'RESERVE_TENANT_ALIAS',
    precondition: base.precondition,
    payload: validateAliasIdentityPayload(payload),
  });
}

function validateTombstoneAliasCommand(
  record: PlainRecord,
  base: ReturnType<typeof validateCommandBase>,
): TombstoneTenantAliasCommandV1 {
  requireUpdatePrecondition(base.precondition);
  const payload = getClosedRecord(
    record.payload,
    ['aliasKey', 'aliasType', 'normalizedAlias', 'tenantId'],
    'INVALID_COMMAND',
  );
  return Object.freeze({
    ...base,
    operationType: 'TOMBSTONE_TENANT_ALIAS',
    payload: validateAliasIdentityPayload(payload),
  });
}

function validateCanonicalizeLegacyTenantCommand(
  record: PlainRecord,
  base: ReturnType<typeof validateCommandBase>,
): CanonicalizeLegacyTenantCommandV1 {
  requireUpdatePrecondition(base.precondition);
  const payload = getClosedRecord(
    record.payload,
    [
      'tenantId',
      'canonicalStatus',
      'tenantSlug',
      'organizationReference',
      'clientReference',
      'migrationMetadata',
    ],
    'INVALID_COMMAND',
  );
  const migrationMetadata = validateAuthorityMigrationMetadataV1(
    payload.migrationMetadata,
  );
  if (migrationMetadata.migrationStatus !== 'VALIDATED') {
    return failAuthorityPersistenceContract('INVALID_COMMAND');
  }
  const tenantSlug = optionalTenantSlug(
    payload.tenantSlug,
    'INVALID_COMMAND',
  );
  const organizationReference = optionalCanonicalReference(
    payload.organizationReference,
    'INVALID_COMMAND',
  );
  const clientReference = optionalCanonicalReference(
    payload.clientReference,
    'INVALID_COMMAND',
  );
  return Object.freeze({
    ...base,
    operationType: 'CANONICALIZE_LEGACY_TENANT',
    payload: Object.freeze({
      tenantId: requireCanonicalDocumentId(
        payload.tenantId,
        'INVALID_COMMAND',
      ),
      canonicalStatus: requireEnumValue(
        payload.canonicalStatus,
        TENANT_AUTHORITY_STATUSES,
        'INVALID_COMMAND',
      ),
      ...(tenantSlug === undefined ? {} : { tenantSlug }),
      ...(organizationReference === undefined
        ? {}
        : { organizationReference }),
      ...(clientReference === undefined ? {} : { clientReference }),
      migrationMetadata,
    }),
  });
}

export function validateAuthorityAdministrativeCommandV1(
  value: unknown,
): AuthorityAdministrativeCommandV1 {
  const record = getClosedRecord(
    value,
    [
      'schemaVersion',
      'operationType',
      'operationId',
      'idempotencyKey',
      'actor',
      'requestedAt',
      'precondition',
      'reasonCode',
      'correlationId',
      'payload',
    ],
    'INVALID_COMMAND',
  );
  const operationType = requireEnumValue(
    record.operationType,
    AUTHORITY_OPERATION_TYPES,
    'INVALID_COMMAND',
  );
  const base = validateCommandBase(record, operationType);
  switch (operationType) {
    case 'CREATE_TENANT_AUTHORITY':
      return validateCreateTenantAuthorityCommand(record, base);
    case 'UPDATE_TENANT_STATUS':
      return validateUpdateTenantStatusCommand(record, base);
    case 'CREATE_TENANT_MEMBERSHIP':
      return validateCreateTenantMembershipCommand(record, base);
    case 'UPDATE_TENANT_MEMBERSHIP_ROLES':
      return validateUpdateMembershipRolesCommand(record, base);
    case 'CHANGE_TENANT_MEMBERSHIP_STATUS':
      return validateChangeMembershipStatusCommand(record, base);
    case 'RESERVE_TENANT_ALIAS':
      return validateReserveAliasCommand(record, base);
    case 'TOMBSTONE_TENANT_ALIAS':
      return validateTombstoneAliasCommand(record, base);
    case 'CANONICALIZE_LEGACY_TENANT':
      return validateCanonicalizeLegacyTenantCommand(record, base);
  }
}

export function validateAuthorityIdempotencyRecordV1(
  value: unknown,
): AuthorityIdempotencyRecordV1 {
  const record = getClosedRecord(
    value,
    [
      'schemaVersion',
      'idempotencyKey',
      'operationType',
      'requestFingerprint',
      'status',
      'startedAt',
      'completedAt',
      'resultReference',
      'failureCode',
      'version',
    ],
    'INVALID_IDEMPOTENCY_RECORD',
  );
  const schemaVersion = requireExactLiteral(
    record.schemaVersion,
    AUTHORITY_IDEMPOTENCY_RECORD_VERSION,
    'INVALID_IDEMPOTENCY_RECORD',
  );
  const status = requireEnumValue(
    record.status,
    AUTHORITY_IDEMPOTENCY_STATUSES,
    'INVALID_IDEMPOTENCY_RECORD',
  );
  const base = {
    schemaVersion,
    idempotencyKey: requireOperationalId(
      record.idempotencyKey,
      'INVALID_IDEMPOTENCY_RECORD',
    ),
    operationType: requireEnumValue(
      record.operationType,
      AUTHORITY_OPERATION_TYPES,
      'INVALID_IDEMPOTENCY_RECORD',
    ),
    requestFingerprint: requireFingerprint(
      record.requestFingerprint,
      'INVALID_IDEMPOTENCY_RECORD',
    ),
    status,
    startedAt: requireCanonicalTimestamp(
      record.startedAt,
      'INVALID_IDEMPOTENCY_RECORD',
    ),
    version: requirePositiveInteger(
      record.version,
      'INVALID_IDEMPOTENCY_RECORD',
    ),
  } as const;
  if (status === 'IN_PROGRESS') {
    if (
      hasDefined(record, 'completedAt') ||
      hasDefined(record, 'resultReference') ||
      hasDefined(record, 'failureCode')
    ) {
      return failAuthorityPersistenceContract(
        'INVALID_IDEMPOTENCY_RECORD',
      );
    }
    return Object.freeze({
      ...base,
      status: 'IN_PROGRESS',
    });
  }
  if (!hasDefined(record, 'completedAt')) {
    return failAuthorityPersistenceContract('INVALID_IDEMPOTENCY_RECORD');
  }
  const completedAt = requireCanonicalTimestamp(
    record.completedAt,
    'INVALID_IDEMPOTENCY_RECORD',
  );
  requireTimestampOrder(
    base.startedAt,
    completedAt,
    true,
    'INVALID_IDEMPOTENCY_RECORD',
  );
  if (status === 'COMPLETED') {
    if (
      !hasDefined(record, 'resultReference') ||
      hasDefined(record, 'failureCode')
    ) {
      return failAuthorityPersistenceContract(
        'INVALID_IDEMPOTENCY_RECORD',
      );
    }
    return Object.freeze({
      ...base,
      status,
      completedAt,
      resultReference: requireAuthorityResourceReference(
        record.resultReference,
        'INVALID_IDEMPOTENCY_RECORD',
      ),
    });
  }
  if (
    !hasDefined(record, 'failureCode') ||
    hasDefined(record, 'resultReference')
  ) {
    return failAuthorityPersistenceContract('INVALID_IDEMPOTENCY_RECORD');
  }
  return Object.freeze({
    ...base,
    status,
    completedAt,
    failureCode: requireReasonCode(
      record.failureCode,
      'INVALID_IDEMPOTENCY_RECORD',
    ),
  });
}

export function validateAuthorityRepositoryResultV1(
  value: unknown,
): AuthorityRepositoryResultV1 {
  const record = getClosedRecord(
    value,
    [
      'schemaVersion',
      'operationId',
      'correlationId',
      'status',
      'safeCode',
      'resultingVersion',
      'resourceReference',
      'completedAt',
    ],
    'INVALID_REPOSITORY_RESULT',
  );
  const base = {
    schemaVersion: requireExactLiteral(
      record.schemaVersion,
      AUTHORITY_REPOSITORY_RESULT_VERSION,
      'INVALID_REPOSITORY_RESULT',
    ),
    operationId: requireOperationalId(
      record.operationId,
      'INVALID_REPOSITORY_RESULT',
    ),
    correlationId: requireOperationalId(
      record.correlationId,
      'INVALID_REPOSITORY_RESULT',
    ),
    status: requireEnumValue(
      record.status,
      AUTHORITY_REPOSITORY_RESULT_STATUSES,
      'INVALID_REPOSITORY_RESULT',
    ),
    safeCode: requireReasonCode(
      record.safeCode,
      'INVALID_REPOSITORY_RESULT',
    ),
    completedAt: requireCanonicalTimestamp(
      record.completedAt,
      'INVALID_REPOSITORY_RESULT',
    ),
  } as const;
  const hasVersion = hasDefined(record, 'resultingVersion');
  const hasReference = hasDefined(record, 'resourceReference');
  if (base.status === 'APPLIED') {
    if (!hasVersion || !hasReference) {
      return failAuthorityPersistenceContract('INVALID_REPOSITORY_RESULT');
    }
    return Object.freeze({
      ...base,
      status: 'APPLIED',
      resultingVersion: requirePositiveInteger(
        record.resultingVersion,
        'INVALID_REPOSITORY_RESULT',
      ),
      resourceReference: requireAuthorityResourceReference(
        record.resourceReference,
        'INVALID_REPOSITORY_RESULT',
      ),
    });
  }
  if (base.status === 'NO_OP') {
    if (hasVersion !== hasReference) {
      return failAuthorityPersistenceContract('INVALID_REPOSITORY_RESULT');
    }
    return Object.freeze({
      ...base,
      status: 'NO_OP',
      ...(hasVersion
        ? {
            resultingVersion: requirePositiveInteger(
              record.resultingVersion,
              'INVALID_REPOSITORY_RESULT',
            ),
            resourceReference: requireAuthorityResourceReference(
              record.resourceReference,
              'INVALID_REPOSITORY_RESULT',
            ),
          }
        : {}),
    });
  }
  if (hasVersion || hasReference) {
    return failAuthorityPersistenceContract('INVALID_REPOSITORY_RESULT');
  }
  return Object.freeze({
    ...base,
    status: base.status,
  });
}

function validateEventPayloadSummary(
  value: unknown,
): AuthorityEventPayloadSummaryV1 {
  const record = getClosedRecord(
    value,
    [
      'tenantStatusFrom',
      'tenantStatusTo',
      'membershipStatusFrom',
      'membershipStatusTo',
      'previousRoleCount',
      'resultingRoleCount',
      'aliasType',
      'aliasStatus',
      'migrationStatus',
    ],
    'SENSITIVE_EVENT_DATA',
  );
  const tenantStatusFrom =
    record.tenantStatusFrom === undefined
      ? undefined
      : requireEnumValue(
          record.tenantStatusFrom,
          TENANT_AUTHORITY_STATUSES,
          'INVALID_AUDIT_EVENT',
        );
  const tenantStatusTo =
    record.tenantStatusTo === undefined
      ? undefined
      : requireEnumValue(
          record.tenantStatusTo,
          TENANT_AUTHORITY_STATUSES,
          'INVALID_AUDIT_EVENT',
        );
  const membershipStatusFrom =
    record.membershipStatusFrom === undefined
      ? undefined
      : requireEnumValue(
          record.membershipStatusFrom,
          TENANT_MEMBERSHIP_AUTHORITY_STATUSES,
          'INVALID_AUDIT_EVENT',
        );
  const membershipStatusTo =
    record.membershipStatusTo === undefined
      ? undefined
      : requireEnumValue(
          record.membershipStatusTo,
          TENANT_MEMBERSHIP_AUTHORITY_STATUSES,
          'INVALID_AUDIT_EVENT',
        );
  const previousRoleCount =
    record.previousRoleCount === undefined
      ? undefined
      : requireNonNegativeInteger(
          record.previousRoleCount,
          'INVALID_AUDIT_EVENT',
        );
  const resultingRoleCount =
    record.resultingRoleCount === undefined
      ? undefined
      : requireNonNegativeInteger(
          record.resultingRoleCount,
          'INVALID_AUDIT_EVENT',
        );
  const aliasType =
    record.aliasType === undefined
      ? undefined
      : requireEnumValue(
          record.aliasType,
          TENANT_ALIAS_TYPES,
          'INVALID_AUDIT_EVENT',
        );
  const aliasStatus =
    record.aliasStatus === undefined
      ? undefined
      : requireEnumValue(
          record.aliasStatus,
          TENANT_ALIAS_STATUSES,
          'INVALID_AUDIT_EVENT',
        );
  const migrationStatus =
    record.migrationStatus === undefined
      ? undefined
      : requireEnumValue(
          record.migrationStatus,
          AUTHORITY_MIGRATION_STATUSES,
          'INVALID_AUDIT_EVENT',
        );
  return Object.freeze({
    ...(tenantStatusFrom === undefined ? {} : { tenantStatusFrom }),
    ...(tenantStatusTo === undefined ? {} : { tenantStatusTo }),
    ...(membershipStatusFrom === undefined
      ? {}
      : { membershipStatusFrom }),
    ...(membershipStatusTo === undefined ? {} : { membershipStatusTo }),
    ...(previousRoleCount === undefined ? {} : { previousRoleCount }),
    ...(resultingRoleCount === undefined ? {} : { resultingRoleCount }),
    ...(aliasType === undefined ? {} : { aliasType }),
    ...(aliasStatus === undefined ? {} : { aliasStatus }),
    ...(migrationStatus === undefined ? {} : { migrationStatus }),
  });
}

function expectedResourceType(eventType: AuthorityEventType): AuthorityResourceType {
  if (eventType.startsWith('TENANT_')) {
    return 'TENANT';
  }
  if (eventType.startsWith('MEMBERSHIP_')) {
    return 'MEMBERSHIP';
  }
  if (eventType.startsWith('ALIAS_')) {
    return 'ALIAS';
  }
  return 'MIGRATION';
}

function assertEventPayloadMatchesType(
  eventType: AuthorityEventType,
  payload: AuthorityEventPayloadSummaryV1,
): void {
  const keys = Object.keys(payload);
  const exactKeys = (...expected: readonly string[]): boolean =>
    keys.length === expected.length &&
    expected.every((key) => keys.includes(key));
  const valid =
    (eventType === 'TENANT_CREATED' &&
      exactKeys('tenantStatusTo')) ||
    (eventType === 'TENANT_STATUS_CHANGED' &&
      exactKeys('tenantStatusFrom', 'tenantStatusTo')) ||
    (eventType === 'TENANT_CANONICALIZED' &&
      exactKeys('migrationStatus') &&
      payload.migrationStatus === 'APPLIED') ||
    (eventType === 'MEMBERSHIP_CREATED' &&
      exactKeys('membershipStatusTo', 'resultingRoleCount') &&
      payload.membershipStatusTo === 'ACTIVE') ||
    (eventType === 'MEMBERSHIP_ROLES_CHANGED' &&
      exactKeys('previousRoleCount', 'resultingRoleCount')) ||
    (eventType === 'MEMBERSHIP_SUSPENDED' &&
      exactKeys('membershipStatusFrom', 'membershipStatusTo') &&
      payload.membershipStatusTo === 'SUSPENDED') ||
    (eventType === 'MEMBERSHIP_REVOKED' &&
      exactKeys('membershipStatusFrom', 'membershipStatusTo') &&
      payload.membershipStatusTo === 'REVOKED') ||
    (eventType === 'ALIAS_RESERVED' &&
      exactKeys('aliasType', 'aliasStatus') &&
      payload.aliasStatus === 'ACTIVE') ||
    (eventType === 'ALIAS_TOMBSTONED' &&
      exactKeys('aliasType', 'aliasStatus') &&
      payload.aliasStatus === 'TOMBSTONED') ||
    (eventType === 'MIGRATION_APPLIED' &&
      exactKeys('migrationStatus') &&
      payload.migrationStatus === 'APPLIED') ||
    (eventType === 'MIGRATION_REJECTED' &&
      exactKeys('migrationStatus') &&
      payload.migrationStatus === 'REJECTED');
  if (!valid) {
    failAuthorityPersistenceContract('INVALID_AUDIT_EVENT');
  }
  if (
    eventType === 'TENANT_STATUS_CHANGED' &&
    payload.tenantStatusFrom !== undefined &&
    payload.tenantStatusTo !== undefined
  ) {
    assertTenantAuthorityTransitionV1(
      payload.tenantStatusFrom,
      payload.tenantStatusTo,
    );
  }
  if (
    (eventType === 'MEMBERSHIP_SUSPENDED' ||
      eventType === 'MEMBERSHIP_REVOKED') &&
    payload.membershipStatusFrom !== undefined &&
    payload.membershipStatusTo !== undefined
  ) {
    assertTenantMembershipTransitionV1(
      payload.membershipStatusFrom,
      payload.membershipStatusTo,
    );
  }
}

function validateAuthorityEventBase(
  value: unknown,
  schemaVersion:
    | typeof AUTHORITY_AUDIT_EVENT_VERSION
    | typeof AUTHORITY_OUTBOX_EVENT_VERSION,
  issue: 'INVALID_AUDIT_EVENT' | 'INVALID_OUTBOX_EVENT',
) {
  const record = getClosedRecord(
    value,
    [
      'schemaVersion',
      'eventId',
      'eventType',
      'operationId',
      'correlationId',
      'actor',
      'resourceType',
      'resourceId',
      'reasonCode',
      'beforeVersion',
      'afterVersion',
      'occurredAt',
      'payloadSummary',
    ],
    issue,
  );
  const eventType = requireEnumValue(
    record.eventType,
    AUTHORITY_EVENT_TYPES,
    issue,
  );
  const resourceType = requireEnumValue(
    record.resourceType,
    AUTHORITY_RESOURCE_TYPES,
    issue,
  );
  if (resourceType !== expectedResourceType(eventType)) {
    return failAuthorityPersistenceContract(issue);
  }
  const beforeVersion =
    record.beforeVersion === undefined
      ? undefined
      : requirePositiveInteger(record.beforeVersion, issue);
  const afterVersion =
    record.afterVersion === undefined
      ? undefined
      : requirePositiveInteger(record.afterVersion, issue);
  if (
    beforeVersion !== undefined &&
    afterVersion !== undefined &&
    afterVersion <= beforeVersion
  ) {
    return failAuthorityPersistenceContract(issue);
  }
  const payloadSummary = validateEventPayloadSummary(record.payloadSummary);
  try {
    assertEventPayloadMatchesType(eventType, payloadSummary);
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      error.name === 'AuthorityPersistenceContractError'
    ) {
      return failAuthorityPersistenceContract(issue);
    }
    throw error;
  }
  return Object.freeze({
    schemaVersion: requireExactLiteral(
      record.schemaVersion,
      schemaVersion,
      issue,
    ),
    eventId: requireOperationalId(record.eventId, issue),
    eventType,
    operationId: requireOperationalId(record.operationId, issue),
    correlationId: requireOperationalId(record.correlationId, issue),
    actor: requireCanonicalActor(record.actor, issue),
    resourceType,
    resourceId: requireAuthorityResourceReference(record.resourceId, issue),
    reasonCode: requireReasonCode(record.reasonCode, issue),
    ...(beforeVersion === undefined ? {} : { beforeVersion }),
    ...(afterVersion === undefined ? {} : { afterVersion }),
    occurredAt: requireCanonicalTimestamp(record.occurredAt, issue),
    payloadSummary,
  });
}

export function validateAuthorityAuditEventV1(
  value: unknown,
): AuthorityAuditEventV1 {
  return validateAuthorityEventBase(
    value,
    AUTHORITY_AUDIT_EVENT_VERSION,
    'INVALID_AUDIT_EVENT',
  );
}

export function validateAuthorityOutboxEventV1(
  value: unknown,
): AuthorityOutboxEventV1 {
  return validateAuthorityEventBase(
    value,
    AUTHORITY_OUTBOX_EVENT_VERSION,
    'INVALID_OUTBOX_EVENT',
  );
}
