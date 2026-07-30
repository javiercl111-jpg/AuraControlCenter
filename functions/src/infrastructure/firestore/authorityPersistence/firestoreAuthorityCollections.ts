import type {
  AuthorityRepositoryCollection,
} from "@aura/intelligence-os/server";

export const FIRESTORE_AUTHORITY_COLLECTIONS = Object.freeze({
  TENANTS: "platform_tenants",
  MEMBERSHIPS: "tenant_memberships",
  ALIASES: "tenant_aliases",
  IDEMPOTENCY: "authority_idempotency",
  OPERATION_BINDINGS: "authority_operation_bindings",
  AUDIT: "authority_audit_events",
  OUTBOX: "authority_outbox_events",
  OUTBOX_DELIVERY: "authority_outbox_delivery",
} as const);

export type FirestoreAuthorityCollectionPath =
  (typeof FIRESTORE_AUTHORITY_COLLECTIONS)[keyof typeof FIRESTORE_AUTHORITY_COLLECTIONS];

export interface FirestoreAuthorityDocumentLocator {
  readonly collectionPath: FirestoreAuthorityCollectionPath;
  readonly documentId: string;
}

type FirestoreBackedAuthorityCollection = Exclude<
  AuthorityRepositoryCollection,
  "LEGACY_TENANT_SOURCES"
>;

export function getFirestoreAuthorityCollectionPath(
  collection: FirestoreBackedAuthorityCollection,
): FirestoreAuthorityCollectionPath {
  switch (collection) {
    case "TENANTS":
      return FIRESTORE_AUTHORITY_COLLECTIONS.TENANTS;
    case "MEMBERSHIPS":
      return FIRESTORE_AUTHORITY_COLLECTIONS.MEMBERSHIPS;
    case "ALIASES":
      return FIRESTORE_AUTHORITY_COLLECTIONS.ALIASES;
    case "IDEMPOTENCY":
      return FIRESTORE_AUTHORITY_COLLECTIONS.IDEMPOTENCY;
    case "OPERATION_BINDINGS":
      return FIRESTORE_AUTHORITY_COLLECTIONS.OPERATION_BINDINGS;
    case "AUDIT":
      return FIRESTORE_AUTHORITY_COLLECTIONS.AUDIT;
    case "OUTBOX":
      return FIRESTORE_AUTHORITY_COLLECTIONS.OUTBOX;
    case "OUTBOX_DELIVERY":
      return FIRESTORE_AUTHORITY_COLLECTIONS.OUTBOX_DELIVERY;
  }
}

export function createFirestoreAuthorityDocumentLocator(
  collection: FirestoreBackedAuthorityCollection,
  documentId: string,
): FirestoreAuthorityDocumentLocator {
  return Object.freeze({
    collectionPath: getFirestoreAuthorityCollectionPath(collection),
    documentId,
  });
}

export function createFirestoreLegacyTenantDocumentLocator(
  sourceCollection: "PLATFORM_TENANTS",
  documentId: string,
): FirestoreAuthorityDocumentLocator {
  switch (sourceCollection) {
    case "PLATFORM_TENANTS":
      return Object.freeze({
        collectionPath: FIRESTORE_AUTHORITY_COLLECTIONS.TENANTS,
        documentId,
      });
  }
}
