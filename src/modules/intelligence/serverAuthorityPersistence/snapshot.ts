import {
  createAuthorityIdempotencyDocumentIdV1,
  createAuthorityOperationBindingDocumentIdV1,
} from './ids';
import {
  failAuthorityPersistenceContract,
  freezeArray,
  getClosedRecord,
  requireAuthorityResourceReference,
  requireExactLiteral,
} from './helpers';
import {
  AUTHORITY_REPOSITORY_SNAPSHOT_VERSION,
  type AuthorityRepositoryDocumentV1,
  type AuthorityRepositorySnapshotV1,
} from './runtimeTypes';
import {
  type AuthorityAuditEventV1,
  type AuthorityIdempotencyRecordV1,
  type AuthorityOperationBindingRecordV1,
  type AuthorityOutboxDeliveryRecordV1,
  type AuthorityOutboxEventV1,
  type PersistedTenantAliasRecordV1,
  type PersistedTenantAuthorityRecordV1,
  type PersistedTenantMembershipRecordV1,
} from './types';
import {
  validateAuthorityLegacyTenantSourceRecordV1,
} from './legacyTenantSources';
import {
  validateAuthorityAuditEventV1,
  validateAuthorityIdempotencyRecordV1,
  validateAuthorityOperationBindingRecordV1,
  validateAuthorityOutboxDeliveryRecordV1,
  validateAuthorityOutboxEventV1,
  validatePersistedTenantAliasRecordV1,
  validatePersistedTenantAuthorityRecordV1,
  validatePersistedTenantMembershipRecordV1,
} from './validators';

type DocumentValidator<T> = (value: unknown, documentId: string) => T;

function validateDocumentArray<T>(
  value: unknown,
  validator: DocumentValidator<T>,
): readonly AuthorityRepositoryDocumentV1<T>[] {
  if (!Array.isArray(value)) {
    return failAuthorityPersistenceContract('INVALID_REPOSITORY_SNAPSHOT');
  }
  const documents = value.map((candidate) => {
    const record = getClosedRecord(
      candidate,
      ['documentId', 'value'],
      'INVALID_REPOSITORY_SNAPSHOT',
    );
    const documentId = requireAuthorityResourceReference(
      record.documentId,
      'INVALID_REPOSITORY_SNAPSHOT',
    );
    return Object.freeze({
      documentId,
      value: validator(record.value, documentId),
    });
  });
  documents.sort((left, right) =>
    left.documentId.localeCompare(right.documentId),
  );
  if (
    documents.some(
      (entry, index) =>
        index > 0 &&
        documents[index - 1]?.documentId === entry.documentId,
    )
  ) {
    return failAuthorityPersistenceContract(
      'DUPLICATE_REPOSITORY_DOCUMENT',
    );
  }
  return freezeArray(documents);
}

function validateTenant(
  value: unknown,
  documentId: string,
): PersistedTenantAuthorityRecordV1 {
  return validatePersistedTenantAuthorityRecordV1(value, documentId);
}

function validateMembership(
  value: unknown,
  documentId: string,
): PersistedTenantMembershipRecordV1 {
  return validatePersistedTenantMembershipRecordV1(value, documentId);
}

function validateAlias(
  value: unknown,
  documentId: string,
): PersistedTenantAliasRecordV1 {
  return validatePersistedTenantAliasRecordV1(value, documentId);
}

function validateIdempotency(
  value: unknown,
  documentId: string,
): AuthorityIdempotencyRecordV1 {
  const record = validateAuthorityIdempotencyRecordV1(value);
  if (
    documentId !==
    createAuthorityIdempotencyDocumentIdV1(record.idempotencyKey)
  ) {
    return failAuthorityPersistenceContract(
      'REPOSITORY_DOCUMENT_ID_MISMATCH',
    );
  }
  return record;
}

function validateOperationBinding(
  value: unknown,
  documentId: string,
): AuthorityOperationBindingRecordV1 {
  const record = validateAuthorityOperationBindingRecordV1(value);
  if (
    documentId !==
    createAuthorityOperationBindingDocumentIdV1(record.operationId)
  ) {
    return failAuthorityPersistenceContract(
      'REPOSITORY_DOCUMENT_ID_MISMATCH',
    );
  }
  return record;
}

function validateAudit(
  value: unknown,
  documentId: string,
): AuthorityAuditEventV1 {
  const record = validateAuthorityAuditEventV1(value);
  if (documentId !== record.eventId) {
    return failAuthorityPersistenceContract(
      'REPOSITORY_DOCUMENT_ID_MISMATCH',
    );
  }
  return record;
}

function validateOutbox(
  value: unknown,
  documentId: string,
): AuthorityOutboxEventV1 {
  const record = validateAuthorityOutboxEventV1(value);
  if (documentId !== record.eventId) {
    return failAuthorityPersistenceContract(
      'REPOSITORY_DOCUMENT_ID_MISMATCH',
    );
  }
  return record;
}

function validateDelivery(
  value: unknown,
  documentId: string,
): AuthorityOutboxDeliveryRecordV1 {
  const record = validateAuthorityOutboxDeliveryRecordV1(value);
  if (documentId !== record.eventId) {
    return failAuthorityPersistenceContract(
      'REPOSITORY_DOCUMENT_ID_MISMATCH',
    );
  }
  return record;
}

export function validateAuthorityRepositorySnapshotV1(
  value: unknown,
): AuthorityRepositorySnapshotV1 {
  const record = getClosedRecord(
    value,
    [
      'schemaVersion',
      'tenants',
      'memberships',
      'aliases',
      'legacyTenantSources',
      'idempotencyRecords',
      'operationBindings',
      'auditEvents',
      'outboxEvents',
      'outboxDeliveryRecords',
    ],
    'INVALID_REPOSITORY_SNAPSHOT',
  );
  const outboxEvents = validateDocumentArray(
    record.outboxEvents,
    validateOutbox,
  );
  const outboxDeliveryRecords = validateDocumentArray(
    record.outboxDeliveryRecords,
    validateDelivery,
  );
  const outboxIds = new Set(outboxEvents.map((entry) => entry.documentId));
  if (
    outboxDeliveryRecords.some(
      (entry) => !outboxIds.has(entry.documentId),
    )
  ) {
    return failAuthorityPersistenceContract(
      'INVALID_REPOSITORY_SNAPSHOT',
    );
  }
  return Object.freeze({
    schemaVersion: requireExactLiteral(
      record.schemaVersion,
      AUTHORITY_REPOSITORY_SNAPSHOT_VERSION,
      'INVALID_REPOSITORY_SNAPSHOT',
    ),
    tenants: validateDocumentArray(record.tenants, validateTenant),
    memberships: validateDocumentArray(
      record.memberships,
      validateMembership,
    ),
    aliases: validateDocumentArray(record.aliases, validateAlias),
    legacyTenantSources: validateDocumentArray(
      record.legacyTenantSources,
      validateAuthorityLegacyTenantSourceRecordV1,
    ),
    idempotencyRecords: validateDocumentArray(
      record.idempotencyRecords,
      validateIdempotency,
    ),
    operationBindings: validateDocumentArray(
      record.operationBindings,
      validateOperationBinding,
    ),
    auditEvents: validateDocumentArray(record.auditEvents, validateAudit),
    outboxEvents,
    outboxDeliveryRecords,
  });
}

export function createEmptyAuthorityRepositorySnapshotV1(): AuthorityRepositorySnapshotV1 {
  return validateAuthorityRepositorySnapshotV1({
    schemaVersion: AUTHORITY_REPOSITORY_SNAPSHOT_VERSION,
    tenants: [],
    memberships: [],
    aliases: [],
    legacyTenantSources: [],
    idempotencyRecords: [],
    operationBindings: [],
    auditEvents: [],
    outboxEvents: [],
    outboxDeliveryRecords: [],
  });
}

export function cloneAuthorityRepositorySnapshotV1(
  value: unknown,
): AuthorityRepositorySnapshotV1 {
  return validateAuthorityRepositorySnapshotV1(value);
}
