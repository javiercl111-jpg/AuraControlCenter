import {
  validateAuthorityMutationPlanV1,
  type AuthorityMutationPlanV1,
  type AuthorityRepositoryCollection,
} from "@aura/intelligence-os/server";

import {
  createFirestoreAuthorityDocumentLocator,
} from "./firestoreAuthorityCollections";
import {
  serializeAuthorityFirestoreDocument,
} from "./firestoreAuthoritySerialization";
import type {
  FirestoreAuthorityTransaction,
} from "./firestoreAuthorityTransaction";

type FirestoreAuthorityWritableCollection = Exclude<
  AuthorityRepositoryCollection,
  "LEGACY_TENANT_SOURCES"
>;

function createDocument(
  transaction: FirestoreAuthorityTransaction,
  collection: FirestoreAuthorityWritableCollection,
  documentId: string,
  value: unknown,
): void {
  transaction.create(
    createFirestoreAuthorityDocumentLocator(collection, documentId),
    serializeAuthorityFirestoreDocument(value),
  );
}

export function applyFirestoreAuthorityMutationPlan(
  transaction: FirestoreAuthorityTransaction,
  planValue: AuthorityMutationPlanV1,
): void {
  const plan = validateAuthorityMutationPlanV1(planValue);
  plan.resourceWrites.forEach((write) => {
    const locator = createFirestoreAuthorityDocumentLocator(
      write.collection,
      write.documentId,
    );
    const data = serializeAuthorityFirestoreDocument(write.value);
    if (write.writeType === "CREATE") {
      transaction.create(locator, data);
    } else {
      transaction.update(locator, data);
    }
  });
  if (plan.idempotencyWrite !== undefined) {
    createDocument(
      transaction,
      "IDEMPOTENCY",
      plan.idempotencyWrite.documentId,
      plan.idempotencyWrite.value,
    );
  }
  if (plan.operationBindingWrite !== undefined) {
    createDocument(
      transaction,
      "OPERATION_BINDINGS",
      plan.operationBindingWrite.documentId,
      plan.operationBindingWrite.value,
    );
  }
  plan.auditEvents.forEach((event) =>
    createDocument(
      transaction,
      "AUDIT",
      event.documentId,
      event.value,
    ),
  );
  plan.outboxEvents.forEach((event) =>
    createDocument(
      transaction,
      "OUTBOX",
      event.documentId,
      event.value,
    ),
  );
  plan.outboxDeliveryRecords.forEach((record) =>
    createDocument(
      transaction,
      "OUTBOX_DELIVERY",
      record.documentId,
      record.value,
    ),
  );
}
