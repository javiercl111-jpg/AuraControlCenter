import {
  AUTHORITY_REPOSITORY_READ_REGISTRY_ENTRY_VERSION,
  AUTHORITY_REPOSITORY_SNAPSHOT_VERSION,
  createAuthorityRepositoryReadRegistryEntryV1,
  decodeAuthorityLegacyTenantSourceRecordV1,
  validateAuthorityIdempotencyRecordV1,
  validateAuthorityLegacyTenantSourceRecordV1,
  validateAuthorityOperationBindingRecordV1,
  validateAuthorityRepositorySnapshotV1,
  validatePersistedTenantAliasRecordV1,
  validatePersistedTenantAuthorityRecordV1,
  validatePersistedTenantMembershipRecordV1,
  type AuthorityIdempotencyRecordV1,
  type AuthorityLegacyTenantSourceRecordV1,
  type AuthorityOperationBindingRecordV1,
  type AuthorityRepositoryDocumentV1,
  type AuthorityRepositoryReadRegistryEntryV1,
  type AuthorityRepositorySnapshotV1,
  type PersistedTenantAliasRecordV1,
  type PersistedTenantAuthorityRecordV1,
  type PersistedTenantMembershipRecordV1,
} from "@aura/intelligence-os/server";

import {
  deserializeAuthorityFirestoreDocument,
} from "./firestoreAuthoritySerialization";
import type {
  FirestoreAuthorityReadTarget,
} from "./firestoreAuthorityReadSet";
import type {
  FirestoreAuthorityTransaction,
} from "./firestoreAuthorityTransaction";

export type FirestoreAuthorityReadObservation =
  | Readonly<{
      target: FirestoreAuthorityReadTarget;
      exists: false;
    }>
  | Readonly<{
      target: FirestoreAuthorityReadTarget;
      exists: true;
      value: unknown;
    }>;

export interface FirestoreAuthorityReadAssembly {
  readonly snapshot: AuthorityRepositorySnapshotV1;
  readonly readRegistry: readonly AuthorityRepositoryReadRegistryEntryV1[];
  readonly observations: readonly FirestoreAuthorityReadObservation[];
}

export async function readFirestoreAuthorityDocuments(
  transaction: FirestoreAuthorityTransaction,
  targets: readonly FirestoreAuthorityReadTarget[],
): Promise<readonly FirestoreAuthorityReadObservation[]> {
  const observations: FirestoreAuthorityReadObservation[] = [];
  for (const target of targets) {
    const read = await transaction.get(target.locator);
    if (!read.exists) {
      observations.push(Object.freeze({ target, exists: false }));
      continue;
    }
    const data = deserializeAuthorityFirestoreDocument(read.data);
    switch (target.repositoryCollection) {
      case "TENANTS":
        observations.push(
          Object.freeze({
            target,
            exists: true,
            value: validatePersistedTenantAuthorityRecordV1(
              data,
              target.documentId,
            ),
          }),
        );
        break;
      case "MEMBERSHIPS":
        observations.push(
          Object.freeze({
            target,
            exists: true,
            value: validatePersistedTenantMembershipRecordV1(
              data,
              target.documentId,
            ),
          }),
        );
        break;
      case "ALIASES":
        observations.push(
          Object.freeze({
            target,
            exists: true,
            value: validatePersistedTenantAliasRecordV1(
              data,
              target.documentId,
            ),
          }),
        );
        break;
      case "IDEMPOTENCY":
        observations.push(
          Object.freeze({
            target,
            exists: true,
            value: validateAuthorityIdempotencyRecordV1(data),
          }),
        );
        break;
      case "OPERATION_BINDINGS":
        observations.push(
          Object.freeze({
            target,
            exists: true,
            value: validateAuthorityOperationBindingRecordV1(data),
          }),
        );
        break;
      case "LEGACY_TENANT_SOURCES":
        observations.push(
          Object.freeze({
            target,
            exists: true,
            value: decodeAuthorityLegacyTenantSourceRecordV1(
              target.sourceDescriptor,
              data,
              target.decodedAt,
            ),
          }),
        );
        break;
    }
  }
  return Object.freeze(observations);
}

function appendObservation(
  observation: Extract<
    FirestoreAuthorityReadObservation,
    { readonly exists: true }
  >,
  documents: {
    tenants: AuthorityRepositoryDocumentV1<PersistedTenantAuthorityRecordV1>[];
    memberships: AuthorityRepositoryDocumentV1<PersistedTenantMembershipRecordV1>[];
    aliases: AuthorityRepositoryDocumentV1<PersistedTenantAliasRecordV1>[];
    legacyTenantSources: AuthorityRepositoryDocumentV1<AuthorityLegacyTenantSourceRecordV1>[];
    idempotencyRecords: AuthorityRepositoryDocumentV1<AuthorityIdempotencyRecordV1>[];
    operationBindings: AuthorityRepositoryDocumentV1<AuthorityOperationBindingRecordV1>[];
  },
): void {
  const { target, value } = observation;
  switch (target.repositoryCollection) {
    case "TENANTS":
      documents.tenants.push({
        documentId: target.documentId,
        value: validatePersistedTenantAuthorityRecordV1(
          value,
          target.documentId,
        ),
      });
      break;
    case "MEMBERSHIPS":
      documents.memberships.push({
        documentId: target.documentId,
        value: validatePersistedTenantMembershipRecordV1(
          value,
          target.documentId,
        ),
      });
      break;
    case "ALIASES":
      documents.aliases.push({
        documentId: target.documentId,
        value: validatePersistedTenantAliasRecordV1(
          value,
          target.documentId,
        ),
      });
      break;
    case "IDEMPOTENCY":
      documents.idempotencyRecords.push({
        documentId: target.documentId,
        value: validateAuthorityIdempotencyRecordV1(value),
      });
      break;
    case "OPERATION_BINDINGS":
      documents.operationBindings.push({
        documentId: target.documentId,
        value: validateAuthorityOperationBindingRecordV1(value),
      });
      break;
    case "LEGACY_TENANT_SOURCES":
      documents.legacyTenantSources.push({
        documentId: target.documentId,
        value: validateAuthorityLegacyTenantSourceRecordV1(
          value,
          target.documentId,
        ),
      });
      break;
  }
}

function createLegacyReadRegistry(
  observations: readonly FirestoreAuthorityReadObservation[],
): readonly AuthorityRepositoryReadRegistryEntryV1[] {
  return Object.freeze(
    observations.flatMap((observation) => {
      const target = observation.target;
      if (target.repositoryCollection !== "LEGACY_TENANT_SOURCES") {
        return [];
      }
      if (!observation.exists) {
        return [
          createAuthorityRepositoryReadRegistryEntryV1({
            schemaVersion:
              AUTHORITY_REPOSITORY_READ_REGISTRY_ENTRY_VERSION,
            collection: target.sourceDescriptor.sourceCollection,
            documentId: target.sourceDescriptor.sourceDocumentId,
            locatorKey: target.documentId,
            readStatus: "ABSENT",
            authorityUse: "PROHIBITED",
          }),
        ];
      }
      const source = validateAuthorityLegacyTenantSourceRecordV1(
        observation.value,
        target.documentId,
      );
      return [
        createAuthorityRepositoryReadRegistryEntryV1({
          schemaVersion:
            AUTHORITY_REPOSITORY_READ_REGISTRY_ENTRY_VERSION,
          collection: target.sourceDescriptor.sourceCollection,
          documentId: target.sourceDescriptor.sourceDocumentId,
          locatorKey: target.documentId,
          readStatus: "PRESENT",
          recordFingerprint: source.sourceRecordFingerprint,
          recordVersion: source.sourceRecordVersion,
          authorityUse: "PROHIBITED",
        }),
      ];
    }),
  );
}

export function assembleFirestoreAuthorityReadSnapshot(
  observations: readonly FirestoreAuthorityReadObservation[],
): FirestoreAuthorityReadAssembly {
  const documents = {
    tenants: [] as AuthorityRepositoryDocumentV1<PersistedTenantAuthorityRecordV1>[],
    memberships: [] as AuthorityRepositoryDocumentV1<PersistedTenantMembershipRecordV1>[],
    aliases: [] as AuthorityRepositoryDocumentV1<PersistedTenantAliasRecordV1>[],
    legacyTenantSources: [] as AuthorityRepositoryDocumentV1<AuthorityLegacyTenantSourceRecordV1>[],
    idempotencyRecords: [] as AuthorityRepositoryDocumentV1<AuthorityIdempotencyRecordV1>[],
    operationBindings: [] as AuthorityRepositoryDocumentV1<AuthorityOperationBindingRecordV1>[],
  };
  observations.forEach((observation) => {
    if (observation.exists) {
      appendObservation(observation, documents);
    }
  });
  const snapshot = validateAuthorityRepositorySnapshotV1({
    schemaVersion: AUTHORITY_REPOSITORY_SNAPSHOT_VERSION,
    ...documents,
    auditEvents: [],
    outboxEvents: [],
    outboxDeliveryRecords: [],
  });
  return Object.freeze({
    snapshot,
    readRegistry: createLegacyReadRegistry(observations),
    observations: Object.freeze([...observations]),
  });
}
