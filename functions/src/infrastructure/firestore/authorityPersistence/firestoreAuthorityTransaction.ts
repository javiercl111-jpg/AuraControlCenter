import type {
  Firestore,
  Transaction,
} from "firebase-admin/firestore";

import type {
  FirestoreAuthorityDocumentData,
} from "./firestoreAuthoritySerialization";
import type {
  FirestoreAuthorityDocumentLocator,
} from "./firestoreAuthorityCollections";

export type FirestoreAuthorityReadSnapshot =
  | Readonly<{
      exists: false;
    }>
  | Readonly<{
      exists: true;
      data: unknown;
    }>;

export interface FirestoreAuthorityTransaction {
  get(
    locator: FirestoreAuthorityDocumentLocator,
  ): Promise<FirestoreAuthorityReadSnapshot>;
  create(
    locator: FirestoreAuthorityDocumentLocator,
    data: FirestoreAuthorityDocumentData,
  ): void;
  update(
    locator: FirestoreAuthorityDocumentLocator,
    data: FirestoreAuthorityDocumentData,
  ): void;
}

export interface FirestoreAuthorityTransactionRunner {
  runTransaction<T>(
    callback: (transaction: FirestoreAuthorityTransaction) => Promise<T>,
  ): Promise<T>;
}

class FirestoreAdminAuthorityTransaction
  implements FirestoreAuthorityTransaction
{
  readonly #firestore: Firestore;
  readonly #transaction: Transaction;

  constructor(firestore: Firestore, transaction: Transaction) {
    this.#firestore = firestore;
    this.#transaction = transaction;
  }

  async get(
    locator: FirestoreAuthorityDocumentLocator,
  ): Promise<FirestoreAuthorityReadSnapshot> {
    const reference = this.#firestore
      .collection(locator.collectionPath)
      .doc(locator.documentId);
    const snapshot = await this.#transaction.get(reference);
    if (!snapshot.exists) {
      return Object.freeze({ exists: false });
    }
    return Object.freeze({
      exists: true,
      data: snapshot.data(),
    });
  }

  create(
    locator: FirestoreAuthorityDocumentLocator,
    data: FirestoreAuthorityDocumentData,
  ): void {
    const reference = this.#firestore
      .collection(locator.collectionPath)
      .doc(locator.documentId);
    this.#transaction.create(reference, data);
  }

  update(
    locator: FirestoreAuthorityDocumentLocator,
    data: FirestoreAuthorityDocumentData,
  ): void {
    const reference = this.#firestore
      .collection(locator.collectionPath)
      .doc(locator.documentId);
    this.#transaction.update(reference, data);
  }
}

export class FirestoreAdminAuthorityTransactionRunner
  implements FirestoreAuthorityTransactionRunner
{
  readonly #firestore: Firestore;

  constructor(firestore: Firestore) {
    this.#firestore = firestore;
  }

  runTransaction<T>(
    callback: (transaction: FirestoreAuthorityTransaction) => Promise<T>,
  ): Promise<T> {
    return this.#firestore.runTransaction((transaction) =>
      callback(
        new FirestoreAdminAuthorityTransaction(
          this.#firestore,
          transaction,
        ),
      ),
    );
  }
}
