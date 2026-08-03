import type {
  Firestore,
  Transaction,
} from "firebase-admin/firestore";

import type {
  FirestoreRateLimitDocumentLocator,
} from "./firestoreRateLimitCollections";

export type FirestoreRateLimitDocumentData = Readonly<
  Record<string, unknown>
>;

export type FirestoreRateLimitReadSnapshot =
  | Readonly<{ exists: false }>
  | Readonly<{
      exists: true;
      data: unknown;
    }>;

export interface FirestoreRateLimitTransaction {
  get(
    locator: FirestoreRateLimitDocumentLocator,
  ): Promise<FirestoreRateLimitReadSnapshot>;
  create(
    locator: FirestoreRateLimitDocumentLocator,
    data: FirestoreRateLimitDocumentData,
  ): void;
  update(
    locator: FirestoreRateLimitDocumentLocator,
    data: FirestoreRateLimitDocumentData,
  ): void;
}

export interface FirestoreRateLimitTransactionRunner {
  runTransaction<T>(
    callback: (
      transaction: FirestoreRateLimitTransaction,
    ) => Promise<T>,
  ): Promise<T>;
}

const FIRESTORE_RATE_LIMIT_TRANSACTION_MAX_ATTEMPTS = 100;

class FirestoreAdminRateLimitTransaction
  implements FirestoreRateLimitTransaction
{
  readonly #firestore: Firestore;
  readonly #transaction: Transaction;

  constructor(firestore: Firestore, transaction: Transaction) {
    this.#firestore = firestore;
    this.#transaction = transaction;
  }

  async get(
    locator: FirestoreRateLimitDocumentLocator,
  ): Promise<FirestoreRateLimitReadSnapshot> {
    const snapshot = await this.#transaction.get(
      this.#firestore
        .collection(locator.collectionPath)
        .doc(locator.documentId),
    );
    if (!snapshot.exists) return Object.freeze({ exists: false });
    return Object.freeze({
      exists: true,
      data: snapshot.data(),
    });
  }

  create(
    locator: FirestoreRateLimitDocumentLocator,
    data: FirestoreRateLimitDocumentData,
  ): void {
    this.#transaction.create(
      this.#firestore
        .collection(locator.collectionPath)
        .doc(locator.documentId),
      data,
    );
  }

  update(
    locator: FirestoreRateLimitDocumentLocator,
    data: FirestoreRateLimitDocumentData,
  ): void {
    this.#transaction.update(
      this.#firestore
        .collection(locator.collectionPath)
        .doc(locator.documentId),
      data,
    );
  }
}

export class FirestoreAdminRateLimitTransactionRunner
  implements FirestoreRateLimitTransactionRunner
{
  readonly #firestore: Firestore;

  constructor(firestore: Firestore) {
    this.#firestore = firestore;
  }

  runTransaction<T>(
    callback: (
      transaction: FirestoreRateLimitTransaction,
    ) => Promise<T>,
  ): Promise<T> {
    return this.#firestore.runTransaction(
      (transaction) =>
        callback(
          new FirestoreAdminRateLimitTransaction(
            this.#firestore,
            transaction,
          ),
        ),
      { maxAttempts: FIRESTORE_RATE_LIMIT_TRANSACTION_MAX_ATTEMPTS },
    );
  }
}
