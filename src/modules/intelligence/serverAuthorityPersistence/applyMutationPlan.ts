import {
  failAuthorityPersistenceContract,
} from './helpers';
import {
  validateAuthorityMutationPlanV1,
} from './mutationPlan';
import type {
  AuthorityMutationExpectedReadV1,
  AuthorityMutationResourceWriteV1,
  AuthorityRepositoryDocumentV1,
  AuthorityRepositorySnapshotV1,
} from './runtimeTypes';
import {
  AUTHORITY_REPOSITORY_SNAPSHOT_VERSION,
} from './runtimeTypes';
import {
  validateAuthorityRepositorySnapshotV1,
} from './snapshot';

function findDocument<T>(
  documents: readonly AuthorityRepositoryDocumentV1<T>[],
  documentId: string,
): AuthorityRepositoryDocumentV1<T> | undefined {
  return documents.find((entry) => entry.documentId === documentId);
}

function findExpectedReadValue(
  snapshot: AuthorityRepositorySnapshotV1,
  read: AuthorityMutationExpectedReadV1,
): unknown | undefined {
  switch (read.collection) {
    case 'TENANTS':
      return findDocument(snapshot.tenants, read.documentId)?.value;
    case 'MEMBERSHIPS':
      return findDocument(snapshot.memberships, read.documentId)?.value;
    case 'ALIASES':
      return findDocument(snapshot.aliases, read.documentId)?.value;
    case 'LEGACY_TENANT_SOURCES':
      return findDocument(snapshot.legacyTenantSources, read.documentId)
        ?.value;
    case 'IDEMPOTENCY':
      return findDocument(snapshot.idempotencyRecords, read.documentId)
        ?.value;
    case 'OPERATION_BINDINGS':
      return findDocument(snapshot.operationBindings, read.documentId)
        ?.value;
    case 'AUDIT':
      return findDocument(snapshot.auditEvents, read.documentId)?.value;
    case 'OUTBOX':
      return findDocument(snapshot.outboxEvents, read.documentId)?.value;
    case 'OUTBOX_DELIVERY':
      return findDocument(
        snapshot.outboxDeliveryRecords,
        read.documentId,
      )?.value;
  }
}

function readMatches(
  snapshot: AuthorityRepositorySnapshotV1,
  read: AuthorityMutationExpectedReadV1,
): boolean {
  const value = findExpectedReadValue(snapshot, read);
  if (read.expectation === 'MUST_NOT_EXIST') {
    return value === undefined;
  }
  if (read.expectation === 'MUST_EXIST') {
    return value !== undefined;
  }
  if (
    read.expectation === 'MUST_EXIST_AT_VERSION' ||
    read.expectation === 'MUST_MATCH_AUTHORITY_VERSION'
  ) {
    if (value === undefined || typeof value !== 'object' || value === null) {
      return false;
    }
    const versionKey =
      read.expectation === 'MUST_MATCH_AUTHORITY_VERSION'
        ? 'authorityVersion'
        : read.collection === 'TENANTS'
          ? 'recordVersion'
          : read.collection === 'MEMBERSHIPS'
            ? 'membershipVersion'
            : 'aliasVersion';
    return Reflect.get(value, versionKey) === read.expectedVersion;
  }
  if (!('expectedRecordVersion' in read)) {
    return false;
  }
  return (
    value !== undefined &&
    typeof value === 'object' &&
    value !== null &&
    Reflect.get(value, 'recordVersion') === read.expectedRecordVersion &&
    Reflect.get(value, 'sourceRecordVersion') ===
      read.expectedSourceRecordVersion &&
    Reflect.get(value, 'sourceRecordFingerprint') ===
      read.expectedSourceRecordFingerprint
  );
}

function assertExpectedReads(
  snapshot: AuthorityRepositorySnapshotV1,
  reads: readonly AuthorityMutationExpectedReadV1[],
): void {
  if (reads.some((read) => !readMatches(snapshot, read))) {
    failAuthorityPersistenceContract('ATOMIC_MUTATION_APPLY_FAILED');
  }
}

function applyDocument<T>(
  documents: readonly AuthorityRepositoryDocumentV1<T>[],
  write: AuthorityRepositoryDocumentV1<T>,
  writeType: 'CREATE' | 'REPLACE',
): readonly AuthorityRepositoryDocumentV1<T>[] {
  const exists = documents.some(
    (entry) => entry.documentId === write.documentId,
  );
  if (
    (writeType === 'CREATE' && exists) ||
    (writeType === 'REPLACE' && !exists)
  ) {
    return failAuthorityPersistenceContract(
      'ATOMIC_MUTATION_APPLY_FAILED',
    );
  }
  return writeType === 'CREATE'
    ? Object.freeze([...documents, write])
    : Object.freeze(
        documents.map((entry) =>
          entry.documentId === write.documentId ? write : entry,
        ),
      );
}

function applyTenantWrites(
  documents: AuthorityRepositorySnapshotV1['tenants'],
  writes: readonly AuthorityMutationResourceWriteV1[],
): AuthorityRepositorySnapshotV1['tenants'] {
  return writes
    .filter(
      (
        write,
      ): write is Extract<
        AuthorityMutationResourceWriteV1,
        { readonly collection: 'TENANTS' }
      > => write.collection === 'TENANTS',
    )
    .reduce(
      (current, write) =>
        applyDocument(
          current,
          { documentId: write.documentId, value: write.value },
          write.writeType,
        ),
      documents,
    );
}

function applyMembershipWrites(
  documents: AuthorityRepositorySnapshotV1['memberships'],
  writes: readonly AuthorityMutationResourceWriteV1[],
): AuthorityRepositorySnapshotV1['memberships'] {
  return writes
    .filter(
      (
        write,
      ): write is Extract<
        AuthorityMutationResourceWriteV1,
        { readonly collection: 'MEMBERSHIPS' }
      > => write.collection === 'MEMBERSHIPS',
    )
    .reduce(
      (current, write) =>
        applyDocument(
          current,
          { documentId: write.documentId, value: write.value },
          write.writeType,
        ),
      documents,
    );
}

function applyAliasWrites(
  documents: AuthorityRepositorySnapshotV1['aliases'],
  writes: readonly AuthorityMutationResourceWriteV1[],
): AuthorityRepositorySnapshotV1['aliases'] {
  return writes
    .filter(
      (
        write,
      ): write is Extract<
        AuthorityMutationResourceWriteV1,
        { readonly collection: 'ALIASES' }
      > => write.collection === 'ALIASES',
    )
    .reduce(
      (current, write) =>
        applyDocument(
          current,
          { documentId: write.documentId, value: write.value },
          write.writeType,
        ),
      documents,
    );
}

function appendDocuments<T>(
  current: readonly AuthorityRepositoryDocumentV1<T>[],
  additions: readonly AuthorityRepositoryDocumentV1<T>[],
): readonly AuthorityRepositoryDocumentV1<T>[] {
  if (
    additions.some((addition) =>
      current.some(
        (existing) => existing.documentId === addition.documentId,
      ),
    )
  ) {
    return failAuthorityPersistenceContract(
      'ATOMIC_MUTATION_APPLY_FAILED',
    );
  }
  return Object.freeze([...current, ...additions]);
}

export function applyAuthorityMutationPlanV1(
  snapshotValue: unknown,
  planValue: unknown,
): AuthorityRepositorySnapshotV1 {
  const snapshot = validateAuthorityRepositorySnapshotV1(snapshotValue);
  const plan = validateAuthorityMutationPlanV1(planValue);
  assertExpectedReads(snapshot, plan.expectedReads);
  const idempotencyRecords =
    plan.idempotencyWrite === undefined
      ? snapshot.idempotencyRecords
      : appendDocuments(snapshot.idempotencyRecords, [
          plan.idempotencyWrite,
        ]);
  const operationBindings =
    plan.operationBindingWrite === undefined
      ? snapshot.operationBindings
      : appendDocuments(snapshot.operationBindings, [
          plan.operationBindingWrite,
        ]);
  return validateAuthorityRepositorySnapshotV1({
    schemaVersion: AUTHORITY_REPOSITORY_SNAPSHOT_VERSION,
    tenants: applyTenantWrites(snapshot.tenants, plan.resourceWrites),
    memberships: applyMembershipWrites(
      snapshot.memberships,
      plan.resourceWrites,
    ),
    aliases: applyAliasWrites(snapshot.aliases, plan.resourceWrites),
    legacyTenantSources: snapshot.legacyTenantSources,
    idempotencyRecords,
    operationBindings,
    auditEvents: appendDocuments(snapshot.auditEvents, plan.auditEvents),
    outboxEvents: appendDocuments(
      snapshot.outboxEvents,
      plan.outboxEvents,
    ),
    outboxDeliveryRecords: appendDocuments(
      snapshot.outboxDeliveryRecords,
      plan.outboxDeliveryRecords,
    ),
  });
}
