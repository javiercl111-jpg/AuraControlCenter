import { generateKeyPairSync } from "node:crypto";

import {
  cert,
  deleteApp,
  initializeApp,
  type App,
} from "firebase-admin/app";
import {
  getFirestore,
  type Firestore,
  type Transaction,
} from "firebase-admin/firestore";

import type {
  FirestoreRateLimitDocumentLocator,
} from "../../../src/infrastructure/firestore/rateLimits/firestoreRateLimitCollections";
import type {
  FirestoreRateLimitDocumentData,
  FirestoreRateLimitReadSnapshot,
  FirestoreRateLimitTransaction,
  FirestoreRateLimitTransactionRunner,
} from "../../../src/infrastructure/firestore/rateLimits/firestoreRateLimitTransaction";
import {
  assertRateLimitEmulatorIsolation,
} from "./emulatorRateLimitIsolation";

const INSTRUMENTED_TRANSACTION_MAX_ATTEMPTS = 100;

export interface InstrumentedRateLimitTransactionOptions {
  readonly abortFirstCallback?: boolean;
}

class InstrumentedFirestoreRateLimitTransaction
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

export class InstrumentedFirestoreRateLimitTransactionRunner
  implements FirestoreRateLimitTransactionRunner
{
  readonly #firestore: Firestore;
  readonly #options: InstrumentedRateLimitTransactionOptions;
  callbackCount = 0;

  constructor(
    firestore: Firestore,
    options: InstrumentedRateLimitTransactionOptions = {},
  ) {
    this.#firestore = firestore;
    this.#options = options;
  }

  runTransaction<T>(
    callback: (
      transaction: FirestoreRateLimitTransaction,
    ) => Promise<T>,
  ): Promise<T> {
    return this.#firestore.runTransaction(
      async (transaction) => {
        this.callbackCount += 1;
        const result = await callback(
          new InstrumentedFirestoreRateLimitTransaction(
            this.#firestore,
            transaction,
          ),
        );
        if (
          this.#options.abortFirstCallback === true &&
          this.callbackCount === 1
        ) {
          throw Object.assign(
            new Error("Controlled Firestore transaction conflict."),
            { code: 10 },
          );
        }
        return result;
      },
      { maxAttempts: INSTRUMENTED_TRANSACTION_MAX_ATTEMPTS },
    );
  }
}

export interface EmulatorRateLimitHarness {
  readonly app: App;
  readonly firestore: Firestore;
  clear(): Promise<void>;
  close(): Promise<void>;
  collectionIds(): Promise<readonly string[]>;
  count(collectionPath: string): Promise<number>;
}

async function clearFirestoreEmulator(
  projectId: string,
  emulatorHost: string,
): Promise<void> {
  const endpoint =
    `http://${emulatorHost}/emulator/v1/projects/` +
    `${encodeURIComponent(projectId)}/databases/(default)/documents`;
  const response = await fetch(endpoint, { method: "DELETE" });
  if (!response.ok) {
    throw new Error(
      `Firestore Emulator cleanup failed with status ${response.status}.`,
    );
  }
}

function createEmulatorOnlyCredential(projectId: string) {
  const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2_048,
    privateKeyEncoding: {
      format: "pem",
      type: "pkcs8",
    },
    publicKeyEncoding: {
      format: "pem",
      type: "spki",
    },
  });
  return cert({
    projectId,
    clientEmail: `emulator-only@${projectId}.iam.gserviceaccount.com`,
    privateKey,
  });
}

let harnessInstance = 0;

export function createEmulatorRateLimitHarness(
  isolation = assertRateLimitEmulatorIsolation(),
): EmulatorRateLimitHarness {
  harnessInstance += 1;
  const app = initializeApp(
    {
      projectId: isolation.projectId,
      credential: createEmulatorOnlyCredential(isolation.projectId),
    },
    `rate-limit-emulator-${process.pid}-${harnessInstance}`,
  );
  const firestore = getFirestore(app);
  return {
    app,
    firestore,
    async clear(): Promise<void> {
      await clearFirestoreEmulator(
        isolation.projectId,
        isolation.emulatorHost,
      );
    },
    async close(): Promise<void> {
      await firestore.terminate();
      await deleteApp(app);
    },
    async collectionIds(): Promise<readonly string[]> {
      const collections = await firestore.listCollections();
      return collections
        .map((collection) => collection.id)
        .sort();
    },
    async count(collectionPath: string): Promise<number> {
      return (await firestore.collection(collectionPath).get()).size;
    },
  };
}
