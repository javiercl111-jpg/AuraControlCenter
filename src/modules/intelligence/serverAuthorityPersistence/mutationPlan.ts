import {
  failAuthorityPersistenceContract,
  freezeArray,
  getClosedRecord,
  hasDefined,
  requireAuthorityResourceReference,
  requireEnumValue,
  requireExactLiteral,
  requireFingerprint,
  requireOperationalId,
  requirePositiveInteger,
} from './helpers';
import {
  createAuthorityIdempotencyDocumentIdV1,
  createAuthorityOperationBindingDocumentIdV1,
} from './ids';
import {
  AUTHORITY_LEGACY_TENANT_SOURCE_DESCRIPTOR_VERSION,
  AUTHORITY_LEGACY_TENANT_SOURCE_LOCATOR_VERSION,
  AUTHORITY_LEGACY_TENANT_SOURCE_COLLECTIONS,
  createAuthorityLegacyTenantPhysicalLocatorV1,
  validateAuthorityLegacySourceRecordVersionV1,
} from './legacyTenantSources';
import {
  AUTHORITY_MUTATION_PLAN_STATUSES,
  AUTHORITY_MUTATION_PLAN_VERSION,
  AUTHORITY_MUTATION_READ_EXPECTATIONS,
  AUTHORITY_REPOSITORY_COLLECTIONS,
  type AuthorityMutationExpectedReadV1,
  type AuthorityMutationPlanStatus,
  type AuthorityMutationPlanV1,
  type AuthorityMutationResourceWriteV1,
  type AuthorityRepositoryDocumentV1,
  type AuthorityResultingVersionV1,
} from './runtimeTypes';
import {
  AUTHORITY_OPERATION_TYPES,
  type AuthorityAuditEventV1,
  type AuthorityIdempotencyRecordV1,
  type AuthorityOperationBindingRecordV1,
  type AuthorityOutboxDeliveryRecordV1,
  type AuthorityOutboxEventV1,
} from './types';
import {
  validateAuthorityAuditEventV1,
  validateAuthorityIdempotencyRecordV1,
  validateAuthorityOperationBindingRecordV1,
  validateAuthorityOutboxDeliveryRecordV1,
  validateAuthorityOutboxEventV1,
  validateAuthorityRepositoryResultV1,
  validatePersistedTenantAliasRecordV1,
  validatePersistedTenantAuthorityRecordV1,
  validatePersistedTenantMembershipRecordV1,
} from './validators';

function validateExpectedRead(
  value: unknown,
): AuthorityMutationExpectedReadV1 {
  const record = getClosedRecord(
    value,
    [
      'collection',
      'documentId',
      'expectation',
      'expectedVersion',
      'sourceCollection',
      'sourceDocumentId',
      'locatorKey',
      'expectedSourceRecordVersion',
      'expectedSourceRecordFingerprint',
    ],
    'INVALID_MUTATION_PLAN',
  );
  const collection = requireEnumValue(
    record.collection,
    AUTHORITY_REPOSITORY_COLLECTIONS,
    'INVALID_MUTATION_PLAN',
  );
  const documentId = requireAuthorityResourceReference(
    record.documentId,
    'INVALID_MUTATION_PLAN',
  );
  const expectation = requireEnumValue(
    record.expectation,
    AUTHORITY_MUTATION_READ_EXPECTATIONS,
    'INVALID_MUTATION_PLAN',
  );
  if (expectation === 'MUST_NOT_EXIST' || expectation === 'MUST_EXIST') {
    if (
      hasDefined(record, 'expectedVersion') ||
      hasDefined(record, 'sourceCollection') ||
      hasDefined(record, 'sourceDocumentId') ||
      hasDefined(record, 'locatorKey') ||
      hasDefined(record, 'expectedSourceRecordVersion') ||
      hasDefined(record, 'expectedSourceRecordFingerprint')
    ) {
      return failAuthorityPersistenceContract('INVALID_MUTATION_PLAN');
    }
    return Object.freeze({ collection, documentId, expectation });
  }
  if (
    expectation === 'MUST_EXIST_AT_VERSION' ||
    expectation === 'MUST_MATCH_AUTHORITY_VERSION'
  ) {
    if (
      (collection !== 'TENANTS' &&
        collection !== 'MEMBERSHIPS' &&
        collection !== 'ALIASES') ||
      !hasDefined(record, 'expectedVersion') ||
      hasDefined(record, 'sourceCollection') ||
      hasDefined(record, 'sourceDocumentId') ||
      hasDefined(record, 'locatorKey') ||
      hasDefined(record, 'expectedSourceRecordVersion') ||
      hasDefined(record, 'expectedSourceRecordFingerprint')
    ) {
      return failAuthorityPersistenceContract('INVALID_MUTATION_PLAN');
    }
    return Object.freeze({
      collection,
      documentId,
      expectation,
      expectedVersion: requirePositiveInteger(
        record.expectedVersion,
        'INVALID_MUTATION_PLAN',
      ),
    });
  }
  if (
    collection !== 'LEGACY_TENANT_SOURCES' ||
    hasDefined(record, 'expectedVersion') ||
    !hasDefined(record, 'sourceCollection') ||
    !hasDefined(record, 'sourceDocumentId') ||
    !hasDefined(record, 'locatorKey') ||
    !hasDefined(record, 'expectedSourceRecordVersion') ||
    !hasDefined(record, 'expectedSourceRecordFingerprint')
  ) {
    return failAuthorityPersistenceContract('INVALID_MUTATION_PLAN');
  }
  const sourceCollection = requireEnumValue(
    record.sourceCollection,
    AUTHORITY_LEGACY_TENANT_SOURCE_COLLECTIONS,
    'INVALID_MUTATION_PLAN',
  );
  const expectedLocator =
    createAuthorityLegacyTenantPhysicalLocatorV1({
      schemaVersion:
        AUTHORITY_LEGACY_TENANT_SOURCE_DESCRIPTOR_VERSION,
      sourceCollection,
      sourceDocumentId: record.sourceDocumentId,
      sourceLocatorVersion:
        AUTHORITY_LEGACY_TENANT_SOURCE_LOCATOR_VERSION,
      authorityUse: 'PROHIBITED',
    });
  const locatorKey = requireFingerprint(
    record.locatorKey,
    'INVALID_MUTATION_PLAN',
  );
  if (
    locatorKey !== expectedLocator.locatorKey ||
    documentId !== locatorKey
  ) {
    return failAuthorityPersistenceContract('INVALID_MUTATION_PLAN');
  }
  return Object.freeze({
    collection,
    documentId,
    expectation,
    sourceCollection,
    sourceDocumentId: expectedLocator.documentId,
    locatorKey,
    expectedSourceRecordVersion:
      validateAuthorityLegacySourceRecordVersionV1(
        record.expectedSourceRecordVersion,
      ),
    expectedSourceRecordFingerprint: requireFingerprint(
      record.expectedSourceRecordFingerprint,
      'INVALID_MUTATION_PLAN',
    ),
  });
}

function validateResourceWrite(
  value: unknown,
): AuthorityMutationResourceWriteV1 {
  const record = getClosedRecord(
    value,
    ['collection', 'documentId', 'writeType', 'value'],
    'INVALID_MUTATION_PLAN',
  );
  const collection = requireEnumValue(
    record.collection,
    ['TENANTS', 'MEMBERSHIPS', 'ALIASES'] as const,
    'INVALID_MUTATION_PLAN',
  );
  const documentId = requireAuthorityResourceReference(
    record.documentId,
    'INVALID_MUTATION_PLAN',
  );
  const writeType = requireEnumValue(
    record.writeType,
    ['CREATE', 'REPLACE'] as const,
    'INVALID_MUTATION_PLAN',
  );
  if (collection === 'TENANTS') {
    return Object.freeze({
      collection,
      documentId,
      writeType,
      value: validatePersistedTenantAuthorityRecordV1(
        record.value,
        documentId,
      ),
    });
  }
  if (collection === 'MEMBERSHIPS') {
    return Object.freeze({
      collection,
      documentId,
      writeType,
      value: validatePersistedTenantMembershipRecordV1(
        record.value,
        documentId,
      ),
    });
  }
  return Object.freeze({
    collection,
    documentId,
    writeType,
    value: validatePersistedTenantAliasRecordV1(
      record.value,
      documentId,
    ),
  });
}

type EventRecord =
  | AuthorityAuditEventV1
  | AuthorityOutboxEventV1
  | AuthorityOutboxDeliveryRecordV1;

function validateDocument<T extends EventRecord>(
  value: unknown,
  validator: (candidate: unknown) => T,
): AuthorityRepositoryDocumentV1<T> {
  const record = getClosedRecord(
    value,
    ['documentId', 'value'],
    'INVALID_MUTATION_PLAN',
  );
  const documentId = requireOperationalId(
    record.documentId,
    'INVALID_MUTATION_PLAN',
  );
  const validated = validator(record.value);
  if (documentId !== validated.eventId) {
    return failAuthorityPersistenceContract('INVALID_MUTATION_PLAN');
  }
  return Object.freeze({ documentId, value: validated });
}

function validateLedgerDocument<
  T extends AuthorityIdempotencyRecordV1 | AuthorityOperationBindingRecordV1,
>(
  value: unknown,
  validator: (candidate: unknown) => T,
  expectedId: (record: T) => string,
): AuthorityRepositoryDocumentV1<T> {
  const record = getClosedRecord(
    value,
    ['documentId', 'value'],
    'INVALID_MUTATION_PLAN',
  );
  const validated = validator(record.value);
  const documentId = requireOperationalId(
    record.documentId,
    'INVALID_MUTATION_PLAN',
  );
  if (documentId !== expectedId(validated)) {
    return failAuthorityPersistenceContract('INVALID_MUTATION_PLAN');
  }
  return Object.freeze({ documentId, value: validated });
}

function validateResultingVersion(
  value: unknown,
): AuthorityResultingVersionV1 {
  const record = getClosedRecord(
    value,
    [
      'collection',
      'documentId',
      'beforeVersion',
      'afterVersion',
    ],
    'INVALID_MUTATION_PLAN',
  );
  const beforeVersion =
    record.beforeVersion === undefined
      ? undefined
      : requirePositiveInteger(
          record.beforeVersion,
          'INVALID_MUTATION_PLAN',
        );
  const afterVersion = requirePositiveInteger(
    record.afterVersion,
    'INVALID_MUTATION_PLAN',
  );
  if (
    (beforeVersion === undefined && afterVersion !== 1) ||
    (beforeVersion !== undefined && afterVersion !== beforeVersion + 1)
  ) {
    return failAuthorityPersistenceContract('INVALID_MUTATION_PLAN');
  }
  return Object.freeze({
    collection: requireEnumValue(
      record.collection,
      ['TENANTS', 'MEMBERSHIPS', 'ALIASES'] as const,
      'INVALID_MUTATION_PLAN',
    ),
    documentId: requireAuthorityResourceReference(
      record.documentId,
      'INVALID_MUTATION_PLAN',
    ),
    ...(beforeVersion === undefined ? {} : { beforeVersion }),
    afterVersion,
  });
}

function validateArray<T>(
  value: unknown,
  validator: (candidate: unknown) => T,
  identity: (candidate: T) => string,
): readonly T[] {
  if (!Array.isArray(value)) {
    return failAuthorityPersistenceContract('INVALID_MUTATION_PLAN');
  }
  const validated = value.map(validator);
  validated.sort((left, right) =>
    identity(left).localeCompare(identity(right)),
  );
  if (
    validated.some(
      (candidate, index) =>
        index > 0 &&
        identity(validated[index - 1] as T) === identity(candidate),
    )
  ) {
    return failAuthorityPersistenceContract('INVALID_MUTATION_PLAN');
  }
  return freezeArray(validated);
}

function assertPlanShape(
  status: AuthorityMutationPlanStatus,
  resultStatus: string,
  resourceWriteCount: number,
  hasLedger: boolean,
  eventCount: number,
  versionCount: number,
): void {
  const expectedResultStatus =
    status === 'APPLY'
      ? 'APPLIED'
      : status === 'REJECT'
        ? 'REJECTED'
        : status === 'NO_OP'
          ? 'NO_OP'
          : status === 'CONFLICT'
            ? 'CONFLICT'
            : status === 'NOT_FOUND'
              ? 'NOT_FOUND'
              : undefined;
  if (
    (expectedResultStatus !== undefined &&
      resultStatus !== expectedResultStatus) ||
    (status === 'REPLAY' &&
      resultStatus !== 'APPLIED' &&
      resultStatus !== 'NO_OP' &&
      resultStatus !== 'REJECTED') ||
    (status === 'APPLY' &&
      (resourceWriteCount === 0 ||
        !hasLedger ||
        eventCount === 0 ||
        versionCount === 0)) ||
    (status === 'NO_OP' &&
      (resourceWriteCount !== 0 ||
        !hasLedger ||
        eventCount !== 0 ||
        versionCount !== 0)) ||
    ((status === 'REPLAY' ||
      status === 'CONFLICT' ||
      status === 'NOT_FOUND') &&
      (resourceWriteCount !== 0 ||
        hasLedger ||
        eventCount !== 0 ||
        versionCount !== 0)) ||
    (status === 'REJECT' &&
      (resourceWriteCount !== 0 ||
        eventCount !== 0 ||
        versionCount !== 0))
  ) {
    failAuthorityPersistenceContract('INVALID_MUTATION_PLAN');
  }
}

export function validateAuthorityMutationPlanV1(
  value: unknown,
): AuthorityMutationPlanV1 {
  const record = getClosedRecord(
    value,
    [
      'schemaVersion',
      'operationId',
      'correlationId',
      'operationType',
      'planStatus',
      'repositoryResult',
      'expectedReads',
      'resourceWrites',
      'idempotencyWrite',
      'operationBindingWrite',
      'auditEvents',
      'outboxEvents',
      'outboxDeliveryRecords',
      'resultingVersions',
      'generatedAt',
    ],
    'INVALID_MUTATION_PLAN',
  );
  const operationId = requireOperationalId(
    record.operationId,
    'INVALID_MUTATION_PLAN',
  );
  const correlationId = requireOperationalId(
    record.correlationId,
    'INVALID_MUTATION_PLAN',
  );
  const operationType = requireEnumValue(
    record.operationType,
    AUTHORITY_OPERATION_TYPES,
    'INVALID_MUTATION_PLAN',
  );
  const planStatus = requireEnumValue(
    record.planStatus,
    AUTHORITY_MUTATION_PLAN_STATUSES,
    'INVALID_MUTATION_PLAN',
  );
  const repositoryResult = validateAuthorityRepositoryResultV1(
    record.repositoryResult,
  );
  const expectedReads = validateArray(
    record.expectedReads,
    validateExpectedRead,
    (candidate) => `${candidate.collection}:${candidate.documentId}`,
  );
  const resourceWrites = validateArray(
    record.resourceWrites,
    validateResourceWrite,
    (candidate) => `${candidate.collection}:${candidate.documentId}`,
  );
  const idempotencyWrite =
    record.idempotencyWrite === undefined
      ? undefined
      : validateLedgerDocument(
          record.idempotencyWrite,
          validateAuthorityIdempotencyRecordV1,
          (candidate) =>
            createAuthorityIdempotencyDocumentIdV1(
              candidate.idempotencyKey,
            ),
        );
  const operationBindingWrite =
    record.operationBindingWrite === undefined
      ? undefined
      : validateLedgerDocument(
          record.operationBindingWrite,
          validateAuthorityOperationBindingRecordV1,
          (candidate) =>
            createAuthorityOperationBindingDocumentIdV1(
              candidate.operationId,
            ),
        );
  if (
    (idempotencyWrite === undefined) !==
    (operationBindingWrite === undefined)
  ) {
    return failAuthorityPersistenceContract('INVALID_MUTATION_PLAN');
  }
  const auditEvents = validateArray(
    record.auditEvents,
    (candidate) =>
      validateDocument(candidate, validateAuthorityAuditEventV1),
    (candidate) => candidate.documentId,
  );
  const outboxEvents = validateArray(
    record.outboxEvents,
    (candidate) =>
      validateDocument(candidate, validateAuthorityOutboxEventV1),
    (candidate) => candidate.documentId,
  );
  const outboxDeliveryRecords = validateArray(
    record.outboxDeliveryRecords,
    (candidate) =>
      validateDocument(
        candidate,
        validateAuthorityOutboxDeliveryRecordV1,
      ),
    (candidate) => candidate.documentId,
  );
  const resultingVersions = validateArray(
    record.resultingVersions,
    validateResultingVersion,
    (candidate) => `${candidate.collection}:${candidate.documentId}`,
  );
  if (
    repositoryResult.operationId !== operationId ||
    repositoryResult.correlationId !== correlationId ||
    repositoryResult.completedAt !== record.generatedAt ||
    auditEvents.length !== outboxEvents.length ||
    outboxEvents.length !== outboxDeliveryRecords.length ||
    outboxEvents.some(
      (event) =>
        !outboxDeliveryRecords.some(
          (delivery) => delivery.documentId === event.documentId,
        ),
    )
  ) {
    return failAuthorityPersistenceContract('INVALID_MUTATION_PLAN');
  }
  assertPlanShape(
    planStatus,
    repositoryResult.status,
    resourceWrites.length,
    idempotencyWrite !== undefined,
    auditEvents.length,
    resultingVersions.length,
  );
  return Object.freeze({
    schemaVersion: requireExactLiteral(
      record.schemaVersion,
      AUTHORITY_MUTATION_PLAN_VERSION,
      'INVALID_MUTATION_PLAN',
    ),
    operationId,
    correlationId,
    operationType,
    planStatus,
    repositoryResult,
    expectedReads,
    resourceWrites,
    ...(idempotencyWrite === undefined ? {} : { idempotencyWrite }),
    ...(operationBindingWrite === undefined
      ? {}
      : { operationBindingWrite }),
    auditEvents,
    outboxEvents,
    outboxDeliveryRecords,
    resultingVersions,
    generatedAt: record.generatedAt as string,
  });
}

export function createAuthorityMutationPlanV1(
  value: unknown,
): AuthorityMutationPlanV1 {
  return validateAuthorityMutationPlanV1(value);
}
