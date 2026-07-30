import {
  TRUSTED_SERVER_PRINCIPAL_TYPES,
  TRUSTED_TENANT_MEMBERSHIP_ROLES,
  type TrustedServerPrincipalType,
  type TrustedTenantMembershipRole,
} from '../serverComposition/types';
import {
  validateTrustedServerPrincipalV1,
} from '../serverComposition/validators';
import {
  createAuthorityAliasKeyV1,
  createAuthorityAuditEventIdV1,
  createAuthorityIdempotencyDocumentIdV1,
  createAuthorityMembershipKeyV1,
  createAuthorityOutboxEventIdV1,
} from './ids';
import { createCanonicalAuthorityHashV1 } from './canonicalHash';
import {
  createAuthorityLegacySourceRecordVersionKeyV1,
  validateAuthorityLegacySourceRecordVersionV1,
  validateAuthorityLegacyTenantAliasCandidateV1,
  validateAuthorityLegacyTenantSourceRecordV1,
  type AuthorityLegacyTenantAliasCandidateV1,
} from './legacyTenantSources';
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
  AUTHORITY_OPERATION_BINDING_RECORD_VERSION,
  AUTHORITY_OPERATION_BINDING_STATUSES,
  AUTHORITY_MIGRATION_METADATA_VERSION,
  AUTHORITY_MIGRATION_STATUSES,
  AUTHORITY_OPERATION_TYPES,
  AUTHORITY_OUTBOX_DELIVERY_RECORD_VERSION,
  AUTHORITY_OUTBOX_DELIVERY_STATUSES,
  AUTHORITY_OUTBOX_EVENT_VERSION,
  AUTHORITY_REPOSITORY_AUTHORIZATION_DECISION_VERSION,
  AUTHORITY_REPOSITORY_AUTHORIZATION_DECISIONS,
  AUTHORITY_REPOSITORY_INVOCATION_CONTEXT_VERSION,
  AUTHORITY_REPOSITORY_RESULT_STATUSES,
  AUTHORITY_REPOSITORY_RESULT_VERSION,
  AUTHORITY_RETRY_DISPOSITIONS,
  AUTHORITY_RESOURCE_TYPES,
  AUTHORITY_TENANT_ROLE_VOCABULARY_VERSION,
  AUTHORITY_WRITE_PRECONDITION_TYPES,
  AUTHORITY_WRITE_PRECONDITION_VERSION,
  LEGACY_TENANT_CANONICALIZATION_INPUT_VERSION,
  LEGACY_TENANT_CONFLICT_DISPOSITIONS,
  LEGACY_TENANT_VARIANTS,
  TENANT_ACTIVATION_PREREQUISITE_VERSION,
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
  type AuthorityOperationBindingRecordV1,
  type AuthorityOperationType,
  type AuthorityOutboxDeliveryRecordV1,
  type AuthorityOutboxEventV1,
  type AuthorityRepositoryAuthorizationDecisionV1,
  type AuthorityRepositoryInvocationContextV1,
  type AuthorityRepositoryResultV1,
  type AuthorityResourceType,
  type AuthorityWritePreconditionV1,
  type CanonicalizeLegacyTenantCommandV1,
  type ChangeTenantMembershipStatusCommandV1,
  type CreateTenantAuthorityCommandV1,
  type CreateTenantMembershipCommandV1,
  type LegacyTenantCanonicalTargetV1,
  type LegacyTenantCanonicalizationInputV1,
  type PersistedTenantAliasRecordV1,
  type PersistedTenantAuthorityRecordV1,
  type PersistedTenantMembershipRecordV1,
  type ReserveTenantAliasCommandV1,
  type TenantAliasType,
  type TenantActivationPrerequisiteV1,
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
    | 'INVALID_COMMAND'
    | 'INVALID_LEGACY_CANONICALIZATION',
): string | undefined {
  return value === undefined
    ? undefined
    : requireCanonicalReference(value, issue);
}

function optionalTenantSlug(
  value: unknown,
  issue:
    | 'INVALID_TENANT_RECORD'
    | 'INVALID_COMMAND'
    | 'INVALID_LEGACY_CANONICALIZATION',
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
      'sourceLocatorKey',
      'sourceRecordVersion',
      'sourceRecordFingerprint',
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
    sourceLocatorKey: requireFingerprint(
      record.sourceLocatorKey,
      'INVALID_MIGRATION_METADATA',
    ),
    sourceRecordVersion:
      validateAuthorityLegacySourceRecordVersionV1(
        record.sourceRecordVersion,
      ),
    sourceRecordFingerprint: requireFingerprint(
      record.sourceRecordFingerprint,
      'INVALID_MIGRATION_METADATA',
    ),
    classifiedVariant: requireEnumValue(
      record.classifiedVariant,
      LEGACY_TENANT_VARIANTS,
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
  requestId: string;
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
    requestId: requireOperationalId(record.requestId, 'INVALID_COMMAND'),
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

export function validateTenantActivationPrerequisiteV1(
  value: unknown,
): TenantActivationPrerequisiteV1 {
  const record = getClosedRecord(
    value,
    [
      'schemaVersion',
      'tenantId',
      'tenantCurrentStatus',
      'tenantExpectedRecordVersion',
      'membershipKey',
      'membershipPrincipalType',
      'membershipPrincipalId',
      'membershipTenantId',
      'membershipStatus',
      'membershipRoles',
      'membershipExpectedVersion',
    ],
    'INVALID_ACTIVATION_PREREQUISITE',
  );
  const tenantId = requireCanonicalDocumentId(
    record.tenantId,
    'INVALID_ACTIVATION_PREREQUISITE',
  );
  const membershipPrincipalType = requireExactLiteral(
    record.membershipPrincipalType,
    'USER',
    'INVALID_ACTIVATION_PREREQUISITE',
  );
  const membershipPrincipalId = requireCanonicalPrincipalId(
    record.membershipPrincipalId,
    'INVALID_ACTIVATION_PREREQUISITE',
  );
  const membershipTenantId = requireCanonicalDocumentId(
    record.membershipTenantId,
    'INVALID_ACTIVATION_PREREQUISITE',
  );
  const membershipKey = createAuthorityMembershipKeyV1({
    principalType: membershipPrincipalType,
    principalId: membershipPrincipalId,
    tenantId: membershipTenantId,
  });
  let membershipRoles: readonly TrustedTenantMembershipRole[];
  try {
    membershipRoles = validateRoles(
      record.membershipRoles,
      membershipPrincipalType,
    );
  } catch {
    return failAuthorityPersistenceContract(
      'INVALID_ACTIVATION_PREREQUISITE',
    );
  }
  if (
    membershipTenantId !== tenantId ||
    record.membershipKey !== membershipKey ||
    !membershipRoles.includes('TENANT_ADMIN')
  ) {
    return failAuthorityPersistenceContract(
      'INVALID_ACTIVATION_PREREQUISITE',
    );
  }
  return Object.freeze({
    schemaVersion: requireExactLiteral(
      record.schemaVersion,
      TENANT_ACTIVATION_PREREQUISITE_VERSION,
      'INVALID_ACTIVATION_PREREQUISITE',
    ),
    tenantId,
    tenantCurrentStatus: requireEnumValue(
      record.tenantCurrentStatus,
      ['PENDING', 'SUSPENDED'] as const,
      'INVALID_ACTIVATION_PREREQUISITE',
    ),
    tenantExpectedRecordVersion: requirePositiveInteger(
      record.tenantExpectedRecordVersion,
      'INVALID_ACTIVATION_PREREQUISITE',
    ),
    membershipKey,
    membershipPrincipalType,
    membershipPrincipalId,
    membershipTenantId,
    membershipStatus: requireExactLiteral(
      record.membershipStatus,
      'ACTIVE',
      'INVALID_ACTIVATION_PREREQUISITE',
    ),
    membershipRoles,
    membershipExpectedVersion: requirePositiveInteger(
      record.membershipExpectedVersion,
      'INVALID_ACTIVATION_PREREQUISITE',
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
    [
      'tenantId',
      'currentStatus',
      'targetStatus',
      'activationPrerequisite',
    ],
    'INVALID_COMMAND',
  );
  const tenantId = requireCanonicalDocumentId(
    payload.tenantId,
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
  const activationPrerequisite =
    payload.activationPrerequisite === undefined
      ? undefined
      : validateTenantActivationPrerequisiteV1(
          payload.activationPrerequisite,
        );
  if (
    (targetStatus === 'ACTIVE' && activationPrerequisite === undefined) ||
    (targetStatus !== 'ACTIVE' && activationPrerequisite !== undefined) ||
    (activationPrerequisite !== undefined &&
      (activationPrerequisite.tenantId !== tenantId ||
        activationPrerequisite.tenantCurrentStatus !== currentStatus ||
        (base.precondition.type === 'MUST_EXIST_AT_VERSION' &&
          activationPrerequisite.tenantExpectedRecordVersion !==
            base.precondition.recordVersion)))
  ) {
    return failAuthorityPersistenceContract('INVALID_COMMAND');
  }
  return Object.freeze({
    ...base,
    operationType: 'UPDATE_TENANT_STATUS',
    payload: Object.freeze({
      tenantId,
      currentStatus,
      targetStatus,
      ...(activationPrerequisite === undefined
        ? {}
        : { activationPrerequisite }),
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

function validateLegacyTenantCanonicalTargetV1(
  value: unknown,
): LegacyTenantCanonicalTargetV1 {
  const record = getClosedRecord(
    value,
    [
      'tenantId',
      'status',
      'tenantSlug',
      'organizationReference',
      'clientReference',
    ],
    'INVALID_LEGACY_CANONICALIZATION',
  );
  const tenantSlug = optionalTenantSlug(
    record.tenantSlug,
    'INVALID_LEGACY_CANONICALIZATION',
  );
  const organizationReference = optionalCanonicalReference(
    record.organizationReference,
    'INVALID_LEGACY_CANONICALIZATION',
  );
  const clientReference = optionalCanonicalReference(
    record.clientReference,
    'INVALID_LEGACY_CANONICALIZATION',
  );
  return Object.freeze({
    tenantId: requireCanonicalDocumentId(
      record.tenantId,
      'INVALID_LEGACY_CANONICALIZATION',
    ),
    status: requireEnumValue(
      record.status,
      TENANT_AUTHORITY_STATUSES,
      'INVALID_LEGACY_CANONICALIZATION',
    ),
    ...(tenantSlug === undefined ? {} : { tenantSlug }),
    ...(organizationReference === undefined
      ? {}
      : { organizationReference }),
    ...(clientReference === undefined ? {} : { clientReference }),
  });
}

function legacyAliasCandidateKey(
  candidate: AuthorityLegacyTenantAliasCandidateV1,
): string {
  return [
    candidate.aliasType,
    candidate.normalizedAlias,
    candidate.sourceField,
    candidate.confidence,
    candidate.disposition,
  ].join(':');
}

function expectedConflictDisposition(
  classification:
    LegacyTenantCanonicalizationInputV1['sourceRecord']['classificationDisposition'],
): LegacyTenantCanonicalizationInputV1['conflictDisposition'] {
  switch (classification) {
    case 'CANONICALIZABLE':
      return 'NONE';
    case 'REQUIRES_REVIEW':
      return 'REQUIRE_REVIEW';
    case 'REJECTED':
      return 'REJECT';
  }
}

export function validateLegacyTenantCanonicalizationInputV1(
  value: unknown,
): LegacyTenantCanonicalizationInputV1 {
  const record = getClosedRecord(
    value,
    [
      'schemaVersion',
      'canonicalDocumentId',
      'sourceRecord',
      'canonicalTarget',
      'selectedAliasCandidates',
      'migrationMetadata',
      'conflictDisposition',
    ],
    'INVALID_LEGACY_CANONICALIZATION',
  );
  const sourceRecord =
    validateAuthorityLegacyTenantSourceRecordV1(record.sourceRecord);
  const conflictDisposition = requireEnumValue(
    record.conflictDisposition,
    LEGACY_TENANT_CONFLICT_DISPOSITIONS,
    'INVALID_LEGACY_CANONICALIZATION',
  );
  const canonicalTarget = validateLegacyTenantCanonicalTargetV1(
    record.canonicalTarget,
  );
  const canonicalDocumentId = requireCanonicalDocumentId(
    record.canonicalDocumentId,
    'INVALID_LEGACY_CANONICALIZATION',
  );
  if (
    !Array.isArray(record.selectedAliasCandidates) ||
    record.selectedAliasCandidates.length > 8
  ) {
    return failAuthorityPersistenceContract(
      'INVALID_LEGACY_CANONICALIZATION',
    );
  }
  const selectedAliasCandidates = record.selectedAliasCandidates
    .map(validateAuthorityLegacyTenantAliasCandidateV1)
    .sort((left, right) =>
      legacyAliasCandidateKey(left).localeCompare(
        legacyAliasCandidateKey(right),
      ),
    );
  const migrationMetadata = validateAuthorityMigrationMetadataV1(
    record.migrationMetadata,
  );
  const sourceCandidateKeys = new Set(
    sourceRecord.aliasCandidates.map(legacyAliasCandidateKey),
  );
  const selectedCandidateKeys = selectedAliasCandidates.map(
    legacyAliasCandidateKey,
  );
  const selectedSlug = selectedAliasCandidates.find(
    (candidate) => candidate.aliasType === 'TENANT_SLUG',
  );
  const selectedClientReference = selectedAliasCandidates.find(
    (candidate) => candidate.aliasType === 'CLIENT_REFERENCE',
  );
  const selectedOrganizationReference = selectedAliasCandidates.find(
    (candidate) => candidate.aliasType === 'ORGANIZATION_REFERENCE',
  );
  if (
    canonicalDocumentId !== canonicalTarget.tenantId ||
    new Set(selectedCandidateKeys).size !==
      selectedCandidateKeys.length ||
    selectedAliasCandidates.some(
      (candidate) =>
        candidate.disposition !== 'RESERVE' ||
        candidate.confidence === 'AMBIGUOUS' ||
        !sourceCandidateKeys.has(legacyAliasCandidateKey(candidate)),
    ) ||
    conflictDisposition !==
      expectedConflictDisposition(
        sourceRecord.classificationDisposition,
      ) ||
    migrationMetadata.classifiedVariant !==
      sourceRecord.classifiedVariant ||
    migrationMetadata.sourceLocatorKey !==
      sourceRecord.sourceLocator.locatorKey ||
    migrationMetadata.sourceRecordFingerprint !==
      sourceRecord.sourceRecordFingerprint ||
    createAuthorityLegacySourceRecordVersionKeyV1(
      migrationMetadata.sourceRecordVersion,
    ) !==
      createAuthorityLegacySourceRecordVersionKeyV1(
        sourceRecord.sourceRecordVersion,
      ) ||
    (sourceRecord.normalizedStatus !== undefined &&
      canonicalTarget.status !== sourceRecord.normalizedStatus) ||
    canonicalDocumentId.toLowerCase() ===
      sourceRecord.observedTenantSlug?.toLowerCase() ||
    canonicalDocumentId.toLowerCase() ===
      selectedSlug?.normalizedAlias ||
    (canonicalTarget.tenantSlug === undefined) !==
      (selectedSlug === undefined) ||
    (canonicalTarget.tenantSlug !== undefined &&
      canonicalTarget.tenantSlug !== selectedSlug?.normalizedAlias) ||
    (canonicalTarget.clientReference !== undefined &&
      canonicalTarget.clientReference.toLowerCase() !==
        selectedClientReference?.normalizedAlias) ||
    (canonicalTarget.organizationReference !== undefined &&
      canonicalTarget.organizationReference.toLowerCase() !==
        selectedOrganizationReference?.normalizedAlias)
  ) {
    return failAuthorityPersistenceContract(
      'INVALID_LEGACY_CANONICALIZATION',
    );
  }
  return Object.freeze({
    schemaVersion: requireExactLiteral(
      record.schemaVersion,
      LEGACY_TENANT_CANONICALIZATION_INPUT_VERSION,
      'INVALID_LEGACY_CANONICALIZATION',
    ),
    canonicalDocumentId,
    sourceRecord,
    canonicalTarget,
    selectedAliasCandidates: freezeArray(selectedAliasCandidates),
    migrationMetadata,
    conflictDisposition,
  });
}

function validateCanonicalizeLegacyTenantCommand(
  record: PlainRecord,
  base: ReturnType<typeof validateCommandBase>,
): CanonicalizeLegacyTenantCommandV1 {
  const precondition = base.precondition;
  requireCreatePrecondition(precondition);
  const payload = getClosedRecord(
    record.payload,
    ['canonicalizationInput'],
    'INVALID_COMMAND',
  );
  const canonicalizationInput =
    validateLegacyTenantCanonicalizationInputV1(
      payload.canonicalizationInput,
  );
  if (
    canonicalizationInput.sourceRecord.classificationDisposition !==
      'CANONICALIZABLE' ||
    canonicalizationInput.conflictDisposition !== 'NONE' ||
    canonicalizationInput.migrationMetadata.migrationStatus !== 'VALIDATED'
  ) {
    return failAuthorityPersistenceContract(
      'LEGACY_CANONICALIZATION_NOT_APPLICABLE',
    );
  }
  return Object.freeze({
    ...base,
    precondition,
    operationType: 'CANONICALIZE_LEGACY_TENANT',
    payload: Object.freeze({
      canonicalizationInput,
    }),
  });
}

function assertCanonicalizationInputIsNotAuthority(
  input: LegacyTenantCanonicalizationInputV1,
): void {
  if (input.migrationMetadata.authorityUse !== 'PROHIBITED') {
    failAuthorityPersistenceContract('MIGRATION_METADATA_NOT_AUTHORITY');
  }
}

export function assertLegacyTenantCanonicalizationInputIsNotAuthorityV1(
  value: unknown,
): LegacyTenantCanonicalizationInputV1 {
  const input = validateLegacyTenantCanonicalizationInputV1(value);
  assertCanonicalizationInputIsNotAuthority(input);
  return input;
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
      'requestId',
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

function validateAuthorizedOperationTypes(
  value: unknown,
  issue:
    | 'INVALID_AUTHORIZATION_DECISION'
    | 'INVALID_INVOCATION_CONTEXT',
): readonly AuthorityOperationType[] {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some(
      (operationType) =>
        typeof operationType !== 'string' ||
        !AUTHORITY_OPERATION_TYPES.includes(
          operationType as AuthorityOperationType,
        ),
    )
  ) {
    return failAuthorityPersistenceContract(issue);
  }
  const operationTypes = value as AuthorityOperationType[];
  if (new Set(operationTypes).size !== operationTypes.length) {
    return failAuthorityPersistenceContract(issue);
  }
  return freezeArray([...operationTypes].sort());
}

export function validateAuthorityRepositoryAuthorizationDecisionV1(
  value: unknown,
): AuthorityRepositoryAuthorizationDecisionV1 {
  const record = getClosedRecord(
    value,
    [
      'schemaVersion',
      'decisionVersion',
      'decision',
      'authorizationVersion',
      'operationTypes',
      'principalType',
      'principalId',
      'actorType',
      'actorId',
      'decidedAt',
      'expiresAt',
      'safeReasonCode',
    ],
    'INVALID_AUTHORIZATION_DECISION',
  );
  const principalType = requireEnumValue(
    record.principalType,
    TRUSTED_SERVER_PRINCIPAL_TYPES,
    'INVALID_AUTHORIZATION_DECISION',
  );
  const principalId = requireCanonicalPrincipalId(
    record.principalId,
    'INVALID_AUTHORIZATION_DECISION',
  );
  const actor = requireCanonicalActor(
    {
      actorType: record.actorType,
      actorId: record.actorId,
    },
    'INVALID_AUTHORIZATION_DECISION',
  );
  if (
    actor.actorType !== principalType ||
    actor.actorId !== principalId
  ) {
    return failAuthorityPersistenceContract(
      'INVALID_AUTHORIZATION_DECISION',
    );
  }
  const decidedAt = requireCanonicalTimestamp(
    record.decidedAt,
    'INVALID_AUTHORIZATION_DECISION',
  );
  const expiresAt =
    record.expiresAt === undefined
      ? undefined
      : requireCanonicalTimestamp(
          record.expiresAt,
          'INVALID_AUTHORIZATION_DECISION',
        );
  if (expiresAt !== undefined) {
    requireTimestampOrder(
      decidedAt,
      expiresAt,
      false,
      'INVALID_AUTHORIZATION_DECISION',
    );
  }
  return Object.freeze({
    schemaVersion: requireExactLiteral(
      record.schemaVersion,
      AUTHORITY_REPOSITORY_AUTHORIZATION_DECISION_VERSION,
      'INVALID_AUTHORIZATION_DECISION',
    ),
    decisionVersion: requireExactLiteral(
      record.decisionVersion,
      AUTHORITY_REPOSITORY_AUTHORIZATION_DECISION_VERSION,
      'INVALID_AUTHORIZATION_DECISION',
    ),
    decision: requireEnumValue(
      record.decision,
      AUTHORITY_REPOSITORY_AUTHORIZATION_DECISIONS,
      'INVALID_AUTHORIZATION_DECISION',
    ),
    authorizationVersion: requireNonEmptyVersion(
      record.authorizationVersion,
      'INVALID_AUTHORIZATION_DECISION',
    ),
    operationTypes: validateAuthorizedOperationTypes(
      record.operationTypes,
      'INVALID_AUTHORIZATION_DECISION',
    ),
    principalType,
    principalId,
    actorType: actor.actorType,
    actorId: actor.actorId,
    decidedAt,
    ...(expiresAt === undefined ? {} : { expiresAt }),
    safeReasonCode: requireReasonCode(
      record.safeReasonCode,
      'INVALID_AUTHORIZATION_DECISION',
    ),
  });
}

function isAbortSignal(value: unknown): value is AbortSignal {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  return (
    typeof Reflect.get(value, 'aborted') === 'boolean' &&
    typeof Reflect.get(value, 'addEventListener') === 'function' &&
    typeof Reflect.get(value, 'removeEventListener') === 'function'
  );
}

function arraysEqual(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

export function validateAuthorityRepositoryInvocationContextV1(
  value: unknown,
  commandValue: unknown,
): AuthorityRepositoryInvocationContextV1 {
  const command = validateAuthorityAdministrativeCommandV1(commandValue);
  const record = getClosedRecord(
    value,
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
      'cancellationSignal',
    ],
    'INVALID_INVOCATION_CONTEXT',
  );
  let principal: ReturnType<typeof validateTrustedServerPrincipalV1>;
  try {
    principal = validateTrustedServerPrincipalV1(record.principal);
  } catch {
    return failAuthorityPersistenceContract('INVALID_INVOCATION_CONTEXT');
  }
  const actor = requireCanonicalActor(
    record.actor,
    'INVALID_INVOCATION_CONTEXT',
  );
  const authorizationDecision =
    validateAuthorityRepositoryAuthorizationDecisionV1(
      record.authorizationDecision,
    );
  const authorizedOperationTypes = validateAuthorizedOperationTypes(
    record.authorizedOperationTypes,
    'INVALID_INVOCATION_CONTEXT',
  );
  const requestId = requireOperationalId(
    record.requestId,
    'INVALID_INVOCATION_CONTEXT',
  );
  const correlationId = requireOperationalId(
    record.correlationId,
    'INVALID_INVOCATION_CONTEXT',
  );
  const initiatedAt = requireCanonicalTimestamp(
    record.initiatedAt,
    'INVALID_INVOCATION_CONTEXT',
  );
  const authorizationVersion = requireNonEmptyVersion(
    record.authorizationVersion,
    'INVALID_INVOCATION_CONTEXT',
  );
  const cancellationSignal =
    record.cancellationSignal === undefined
      ? undefined
      : record.cancellationSignal;
  if (
    authorizationDecision.decision !== 'ALLOWED' ||
    !authorizedOperationTypes.includes(command.operationType)
  ) {
    return failAuthorityPersistenceContract('OPERATION_NOT_AUTHORIZED');
  }
  if (
    (cancellationSignal !== undefined &&
      !isAbortSignal(cancellationSignal)) ||
    principal.principalType !== actor.actorType ||
    principal.principalId !== actor.actorId ||
    authorizationDecision.principalType !== principal.principalType ||
    authorizationDecision.principalId !== principal.principalId ||
    authorizationDecision.actorType !== actor.actorType ||
    authorizationDecision.actorId !== actor.actorId ||
    authorizationDecision.authorizationVersion !== authorizationVersion ||
    !arraysEqual(
      authorizationDecision.operationTypes,
      authorizedOperationTypes,
    ) ||
    command.actor.actorType !== actor.actorType ||
    command.actor.actorId !== actor.actorId ||
    requestId !== command.requestId ||
    correlationId !== command.correlationId ||
    Date.parse(authorizationDecision.decidedAt) > Date.parse(initiatedAt) ||
    Date.parse(initiatedAt) > Date.parse(command.requestedAt)
  ) {
    return failAuthorityPersistenceContract(
      'INVOCATION_CONTEXT_MISMATCH',
    );
  }
  if (
    authorizationDecision.expiresAt !== undefined &&
    (Date.parse(initiatedAt) >=
      Date.parse(authorizationDecision.expiresAt) ||
      Date.parse(command.requestedAt) >=
        Date.parse(authorizationDecision.expiresAt))
  ) {
    return failAuthorityPersistenceContract('AUTHORIZATION_EXPIRED');
  }
  return Object.freeze({
    schemaVersion: requireExactLiteral(
      record.schemaVersion,
      AUTHORITY_REPOSITORY_INVOCATION_CONTEXT_VERSION,
      'INVALID_INVOCATION_CONTEXT',
    ),
    principal,
    actor,
    authorizationDecision,
    authorizedOperationTypes,
    consumerId: requireOperationalId(
      record.consumerId,
      'INVALID_INVOCATION_CONTEXT',
    ),
    source: requireOperationalId(
      record.source,
      'INVALID_INVOCATION_CONTEXT',
    ),
    requestId,
    correlationId,
    initiatedAt,
    authorizationVersion,
    ...(cancellationSignal === undefined
      ? {}
      : { cancellationSignal }),
  });
}

export function validateAuthorityClockOutputV1(value: unknown): string {
  return requireCanonicalTimestamp(value, 'INVALID_CLOCK_OUTPUT');
}

export function validateAuthorityIdempotencyRecordV1(
  value: unknown,
): AuthorityIdempotencyRecordV1 {
  const record = getClosedRecord(
    value,
    [
      'schemaVersion',
      'idempotencyKey',
      'operationId',
      'operationType',
      'requestFingerprint',
      'status',
      'startedAt',
      'completedAt',
      'exactRepositoryResult',
      'resultFingerprint',
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
    operationId: requireOperationalId(
      record.operationId,
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
      hasDefined(record, 'exactRepositoryResult') ||
      hasDefined(record, 'resultFingerprint') ||
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
  if (
    !hasDefined(record, 'exactRepositoryResult') ||
    !hasDefined(record, 'resultFingerprint') ||
    (status === 'COMPLETED' && hasDefined(record, 'failureCode')) ||
    (status === 'REJECTED' && !hasDefined(record, 'failureCode'))
  ) {
    return failAuthorityPersistenceContract('INVALID_IDEMPOTENCY_RECORD');
  }
  const exactRepositoryResult = validateAuthorityRepositoryResultV1(
    record.exactRepositoryResult,
  );
  const resultFingerprint = requireFingerprint(
    record.resultFingerprint,
    'INVALID_IDEMPOTENCY_RECORD',
  );
  const expectedResultFingerprint = createCanonicalAuthorityHashV1(
    'authority-repository-result-fingerprint:v1',
    exactRepositoryResult,
    'INVALID_IDEMPOTENCY_RECORD',
  );
  if (
    exactRepositoryResult.operationId !== base.operationId ||
    exactRepositoryResult.completedAt !== completedAt ||
    resultFingerprint !== expectedResultFingerprint ||
    (status === 'COMPLETED' &&
      exactRepositoryResult.status !== 'APPLIED' &&
      exactRepositoryResult.status !== 'NO_OP') ||
    (status === 'REJECTED' &&
      exactRepositoryResult.status !== 'REJECTED')
  ) {
    return failAuthorityPersistenceContract('INVALID_IDEMPOTENCY_RECORD');
  }
  if (status === 'COMPLETED') {
    return Object.freeze({
      ...base,
      status,
      completedAt,
      exactRepositoryResult,
      resultFingerprint,
    });
  }
  const failureCode = requireReasonCode(
    record.failureCode,
    'INVALID_IDEMPOTENCY_RECORD',
  );
  if (failureCode !== exactRepositoryResult.safeCode) {
    return failAuthorityPersistenceContract('INVALID_IDEMPOTENCY_RECORD');
  }
  return Object.freeze({
    ...base,
    status,
    completedAt,
    exactRepositoryResult,
    resultFingerprint,
    failureCode,
  });
}

export function validateAuthorityOperationBindingRecordV1(
  value: unknown,
): AuthorityOperationBindingRecordV1 {
  const record = getClosedRecord(
    value,
    [
      'schemaVersion',
      'operationId',
      'idempotencyKey',
      'operationType',
      'requestFingerprint',
      'status',
      'repositoryResultReference',
      'createdAt',
      'completedAt',
      'version',
    ],
    'INVALID_OPERATION_BINDING',
  );
  const status = requireEnumValue(
    record.status,
    AUTHORITY_OPERATION_BINDING_STATUSES,
    'INVALID_OPERATION_BINDING',
  );
  const base = {
    schemaVersion: requireExactLiteral(
      record.schemaVersion,
      AUTHORITY_OPERATION_BINDING_RECORD_VERSION,
      'INVALID_OPERATION_BINDING',
    ),
    operationId: requireOperationalId(
      record.operationId,
      'INVALID_OPERATION_BINDING',
    ),
    idempotencyKey: requireOperationalId(
      record.idempotencyKey,
      'INVALID_OPERATION_BINDING',
    ),
    operationType: requireEnumValue(
      record.operationType,
      AUTHORITY_OPERATION_TYPES,
      'INVALID_OPERATION_BINDING',
    ),
    requestFingerprint: requireFingerprint(
      record.requestFingerprint,
      'INVALID_OPERATION_BINDING',
    ),
    status,
    createdAt: requireCanonicalTimestamp(
      record.createdAt,
      'INVALID_OPERATION_BINDING',
    ),
    version: requirePositiveInteger(
      record.version,
      'INVALID_OPERATION_BINDING',
    ),
  } as const;
  if (status === 'BOUND') {
    if (
      hasDefined(record, 'repositoryResultReference') ||
      hasDefined(record, 'completedAt')
    ) {
      return failAuthorityPersistenceContract(
        'INVALID_OPERATION_BINDING',
      );
    }
    return Object.freeze({ ...base, status });
  }
  if (
    !hasDefined(record, 'repositoryResultReference') ||
    !hasDefined(record, 'completedAt')
  ) {
    return failAuthorityPersistenceContract('INVALID_OPERATION_BINDING');
  }
  const completedAt = requireCanonicalTimestamp(
    record.completedAt,
    'INVALID_OPERATION_BINDING',
  );
  requireTimestampOrder(
    base.createdAt,
    completedAt,
    true,
    'INVALID_OPERATION_BINDING',
  );
  const repositoryResultReference = requireAuthorityResourceReference(
    record.repositoryResultReference,
    'INVALID_OPERATION_BINDING',
  );
  const expectedRepositoryResultReference =
    `authority_idempotency/${createAuthorityIdempotencyDocumentIdV1(
      base.idempotencyKey,
    )}`;
  if (repositoryResultReference !== expectedRepositoryResultReference) {
    return failAuthorityPersistenceContract('INVALID_OPERATION_BINDING');
  }
  return Object.freeze({
    ...base,
    status,
    repositoryResultReference,
    completedAt,
  });
}

function createValidatedCommandFingerprint(
  command: AuthorityAdministrativeCommandV1,
): string {
  return createCanonicalAuthorityHashV1(
    'authority-command-fingerprint:v1',
    command,
    'INVALID_COMMAND_FINGERPRINT',
  );
}

export function assertAuthorityIdempotencyRecordMatchesCommandV1(
  value: unknown,
  commandValue: unknown,
): AuthorityIdempotencyRecordV1 {
  const record = validateAuthorityIdempotencyRecordV1(value);
  const command = validateAuthorityAdministrativeCommandV1(commandValue);
  if (
    record.idempotencyKey !== command.idempotencyKey ||
    record.operationId !== command.operationId ||
    record.operationType !== command.operationType ||
    record.requestFingerprint !== createValidatedCommandFingerprint(command)
  ) {
    return failAuthorityPersistenceContract(
      'IDEMPOTENCY_BINDING_MISMATCH',
    );
  }
  return record;
}

export function assertAuthorityOperationBindingMatchesCommandV1(
  value: unknown,
  commandValue: unknown,
): AuthorityOperationBindingRecordV1 {
  const record = validateAuthorityOperationBindingRecordV1(value);
  const command = validateAuthorityAdministrativeCommandV1(commandValue);
  if (
    record.operationId !== command.operationId ||
    record.idempotencyKey !== command.idempotencyKey ||
    record.operationType !== command.operationType ||
    record.requestFingerprint !== createValidatedCommandFingerprint(command)
  ) {
    return failAuthorityPersistenceContract(
      'OPERATION_BINDING_MISMATCH',
    );
  }
  return record;
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
      'retryDisposition',
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
    retryDisposition: requireEnumValue(
      record.retryDisposition,
      AUTHORITY_RETRY_DISPOSITIONS,
      'INVALID_REPOSITORY_RESULT',
    ),
  } as const;
  const expectedRetryDisposition =
    base.status === 'CONFLICT'
      ? 'RETRY_AFTER_READ'
      : base.status === 'INTERNAL_ERROR'
        ? 'SAFE_TO_RETRY_WITH_SAME_IDEMPOTENCY_KEY'
        : 'DO_NOT_RETRY';
  if (base.retryDisposition !== expectedRetryDisposition) {
    return failAuthorityPersistenceContract('INVALID_REPOSITORY_RESULT');
  }
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
    (eventType === 'TENANT_ACTIVATED' &&
      exactKeys('tenantStatusFrom', 'tenantStatusTo') &&
      payload.tenantStatusFrom === 'PENDING' &&
      payload.tenantStatusTo === 'ACTIVE') ||
    (eventType === 'TENANT_SUSPENDED' &&
      exactKeys('tenantStatusFrom', 'tenantStatusTo') &&
      payload.tenantStatusFrom === 'ACTIVE' &&
      payload.tenantStatusTo === 'SUSPENDED') ||
    (eventType === 'TENANT_REACTIVATED' &&
      exactKeys('tenantStatusFrom', 'tenantStatusTo') &&
      payload.tenantStatusFrom === 'SUSPENDED' &&
      payload.tenantStatusTo === 'ACTIVE') ||
    (eventType === 'TENANT_DEACTIVATED' &&
      exactKeys('tenantStatusFrom', 'tenantStatusTo') &&
      payload.tenantStatusTo === 'DEACTIVATED') ||
    (eventType === 'TENANT_DELETED' &&
      exactKeys('tenantStatusFrom', 'tenantStatusTo') &&
      payload.tenantStatusFrom === 'DEACTIVATED' &&
      payload.tenantStatusTo === 'DELETED') ||
    (eventType === 'TENANT_CANONICALIZED' &&
      exactKeys('migrationStatus') &&
      payload.migrationStatus === 'APPLIED') ||
    (eventType === 'MEMBERSHIP_CREATED' &&
      exactKeys('membershipStatusTo', 'resultingRoleCount') &&
      payload.membershipStatusTo === 'ACTIVE') ||
    (eventType === 'MEMBERSHIP_ACTIVATED' &&
      exactKeys('membershipStatusTo') &&
      payload.membershipStatusTo === 'ACTIVE') ||
    (eventType === 'MEMBERSHIP_ROLES_CHANGED' &&
      exactKeys('previousRoleCount', 'resultingRoleCount')) ||
    (eventType === 'MEMBERSHIP_SUSPENDED' &&
      exactKeys('membershipStatusFrom', 'membershipStatusTo') &&
      payload.membershipStatusTo === 'SUSPENDED') ||
    (eventType === 'MEMBERSHIP_REACTIVATED' &&
      exactKeys('membershipStatusFrom', 'membershipStatusTo') &&
      payload.membershipStatusFrom === 'SUSPENDED' &&
      payload.membershipStatusTo === 'ACTIVE') ||
    (eventType === 'MEMBERSHIP_REVOKED' &&
      exactKeys('membershipStatusFrom', 'membershipStatusTo') &&
      payload.membershipStatusTo === 'REVOKED') ||
    (eventType === 'MEMBERSHIP_DELETED' &&
      exactKeys('membershipStatusFrom', 'membershipStatusTo') &&
      payload.membershipStatusFrom === 'REVOKED' &&
      payload.membershipStatusTo === 'DELETED') ||
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
    (eventType === 'TENANT_STATUS_CHANGED' ||
      eventType === 'TENANT_ACTIVATED' ||
      eventType === 'TENANT_SUSPENDED' ||
      eventType === 'TENANT_REACTIVATED' ||
      eventType === 'TENANT_DEACTIVATED' ||
      eventType === 'TENANT_DELETED') &&
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
      eventType === 'MEMBERSHIP_REACTIVATED' ||
      eventType === 'MEMBERSHIP_REVOKED' ||
      eventType === 'MEMBERSHIP_DELETED') &&
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
  const operationId = requireOperationalId(record.operationId, issue);
  const resourceId = requireAuthorityResourceReference(
    record.resourceId,
    issue,
  );
  const eventId = requireOperationalId(record.eventId, issue);
  const expectedEventId =
    issue === 'INVALID_AUDIT_EVENT'
      ? createAuthorityAuditEventIdV1({
          operationId,
          eventType,
          resourceType,
          resourceId,
        })
      : createAuthorityOutboxEventIdV1({
          operationId,
          eventType,
          resourceType,
          resourceId,
        });
  if (eventId !== expectedEventId) {
    return failAuthorityPersistenceContract(issue);
  }
  return Object.freeze({
    schemaVersion: requireExactLiteral(
      record.schemaVersion,
      schemaVersion,
      issue,
    ),
    eventId,
    eventType,
    operationId,
    correlationId: requireOperationalId(record.correlationId, issue),
    actor: requireCanonicalActor(record.actor, issue),
    resourceType,
    resourceId,
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

export function validateAuthorityOutboxDeliveryRecordV1(
  value: unknown,
): AuthorityOutboxDeliveryRecordV1 {
  const record = getClosedRecord(
    value,
    [
      'schemaVersion',
      'eventId',
      'deliveryStatus',
      'attemptCount',
      'availableAt',
      'leaseOwner',
      'leaseExpiresAt',
      'lastAttemptAt',
      'deliveredAt',
      'safeFailureCode',
      'version',
    ],
    'INVALID_OUTBOX_DELIVERY',
  );
  const deliveryStatus = requireEnumValue(
    record.deliveryStatus,
    AUTHORITY_OUTBOX_DELIVERY_STATUSES,
    'INVALID_OUTBOX_DELIVERY',
  );
  const availableAt = requireCanonicalTimestamp(
    record.availableAt,
    'INVALID_OUTBOX_DELIVERY',
  );
  const lastAttemptAt =
    record.lastAttemptAt === undefined
      ? undefined
      : requireCanonicalTimestamp(
          record.lastAttemptAt,
          'INVALID_OUTBOX_DELIVERY',
        );
  const eventId = requireOperationalId(
    record.eventId,
    'INVALID_OUTBOX_DELIVERY',
  );
  if (!/^aoutbox_v1_[a-f0-9]{64}$/.test(eventId)) {
    return failAuthorityPersistenceContract('INVALID_OUTBOX_DELIVERY');
  }
  const base = {
    schemaVersion: requireExactLiteral(
      record.schemaVersion,
      AUTHORITY_OUTBOX_DELIVERY_RECORD_VERSION,
      'INVALID_OUTBOX_DELIVERY',
    ),
    eventId,
    deliveryStatus,
    attemptCount: requireNonNegativeInteger(
      record.attemptCount,
      'INVALID_OUTBOX_DELIVERY',
    ),
    availableAt,
    ...(lastAttemptAt === undefined ? {} : { lastAttemptAt }),
    version: requirePositiveInteger(
      record.version,
      'INVALID_OUTBOX_DELIVERY',
    ),
  } as const;
  const hasLeaseOwner = hasDefined(record, 'leaseOwner');
  const hasLeaseExpiry = hasDefined(record, 'leaseExpiresAt');
  const hasDeliveredAt = hasDefined(record, 'deliveredAt');
  const hasFailure = hasDefined(record, 'safeFailureCode');
  if (lastAttemptAt !== undefined && base.attemptCount === 0) {
    return failAuthorityPersistenceContract('INVALID_OUTBOX_DELIVERY');
  }
  if (deliveryStatus === 'PENDING') {
    if (
      hasLeaseOwner ||
      hasLeaseExpiry ||
      hasDeliveredAt ||
      hasFailure ||
      (lastAttemptAt !== undefined &&
        Date.parse(lastAttemptAt) > Date.parse(availableAt))
    ) {
      return failAuthorityPersistenceContract(
        'INVALID_OUTBOX_DELIVERY',
      );
    }
    return Object.freeze({ ...base, deliveryStatus });
  }
  if (deliveryStatus === 'LEASED') {
    if (
      !hasLeaseOwner ||
      !hasLeaseExpiry ||
      hasDeliveredAt ||
      hasFailure ||
      base.attemptCount === 0
    ) {
      return failAuthorityPersistenceContract(
        'INVALID_OUTBOX_DELIVERY',
      );
    }
    const leaseExpiresAt = requireCanonicalTimestamp(
      record.leaseExpiresAt,
      'INVALID_OUTBOX_DELIVERY',
    );
    requireTimestampOrder(
      availableAt,
      leaseExpiresAt,
      false,
      'INVALID_OUTBOX_DELIVERY',
    );
    if (
      lastAttemptAt !== undefined &&
      (Date.parse(lastAttemptAt) < Date.parse(availableAt) ||
        Date.parse(lastAttemptAt) > Date.parse(leaseExpiresAt))
    ) {
      return failAuthorityPersistenceContract(
        'INVALID_OUTBOX_DELIVERY',
      );
    }
    return Object.freeze({
      ...base,
      deliveryStatus,
      leaseOwner: requireOperationalId(
        record.leaseOwner,
        'INVALID_OUTBOX_DELIVERY',
      ),
      leaseExpiresAt,
    });
  }
  if (deliveryStatus === 'DELIVERED') {
    if (
      hasLeaseOwner ||
      hasLeaseExpiry ||
      !hasDeliveredAt ||
      hasFailure ||
      base.attemptCount === 0
    ) {
      return failAuthorityPersistenceContract(
        'INVALID_OUTBOX_DELIVERY',
      );
    }
    const deliveredAt = requireCanonicalTimestamp(
      record.deliveredAt,
      'INVALID_OUTBOX_DELIVERY',
    );
    requireTimestampOrder(
      availableAt,
      deliveredAt,
      true,
      'INVALID_OUTBOX_DELIVERY',
    );
    if (
      lastAttemptAt !== undefined &&
      (Date.parse(lastAttemptAt) < Date.parse(availableAt) ||
        Date.parse(lastAttemptAt) > Date.parse(deliveredAt))
    ) {
      return failAuthorityPersistenceContract(
        'INVALID_OUTBOX_DELIVERY',
      );
    }
    return Object.freeze({
      ...base,
      deliveryStatus,
      deliveredAt,
    });
  }
  if (
    hasLeaseOwner ||
    hasLeaseExpiry ||
    hasDeliveredAt ||
    !hasFailure ||
    base.attemptCount === 0
  ) {
    return failAuthorityPersistenceContract('INVALID_OUTBOX_DELIVERY');
  }
  if (
    lastAttemptAt !== undefined &&
    Date.parse(lastAttemptAt) < Date.parse(availableAt)
  ) {
    return failAuthorityPersistenceContract('INVALID_OUTBOX_DELIVERY');
  }
  return Object.freeze({
    ...base,
    deliveryStatus,
    safeFailureCode: requireReasonCode(
      record.safeFailureCode,
      'INVALID_OUTBOX_DELIVERY',
    ),
  });
}
