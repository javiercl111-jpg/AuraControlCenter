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
  FirestoreAuthorityDocumentLocator,
} from "../../../src/infrastructure/firestore/authorityPersistence/firestoreAuthorityCollections";
import type {
  FirestoreAuthorityDocumentData,
} from "../../../src/infrastructure/firestore/authorityPersistence/firestoreAuthoritySerialization";
import {
  serializeAuthorityFirestoreDocument,
} from "../../../src/infrastructure/firestore/authorityPersistence/firestoreAuthoritySerialization";
import type {
  FirestoreAuthorityReadSnapshot,
  FirestoreAuthorityTransaction,
  FirestoreAuthorityTransactionRunner,
} from "../../../src/infrastructure/firestore/authorityPersistence/firestoreAuthorityTransaction";
import {
  assertAuthorityEmulatorIsolation,
} from "./emulatorAuthorityIsolation";

export interface FirestoreAuthorityTransactionInstrumentation {
  afterRead?(
    locator: FirestoreAuthorityDocumentLocator,
    callbackAttempt: number,
  ): Promise<void>;
  beforeWrite?(
    locator: FirestoreAuthorityDocumentLocator,
    writeNumber: number,
    callbackAttempt: number,
  ): void;
}

export interface InstrumentedTransactionRunnerOptions {
  readonly abortFirstCallback?: boolean;
  readonly betweenFirstCallbackAndRetry?: () => Promise<void>;
}

class InstrumentedFirestoreAuthorityTransaction
  implements FirestoreAuthorityTransaction
{
  readonly #firestore: Firestore;
  readonly #transaction: Transaction;
  readonly #callbackAttempt: number;
  readonly #instrumentation:
    FirestoreAuthorityTransactionInstrumentation;
  #writeCount = 0;

  constructor(
    firestore: Firestore,
    transaction: Transaction,
    callbackAttempt: number,
    instrumentation:
      FirestoreAuthorityTransactionInstrumentation,
  ) {
    this.#firestore = firestore;
    this.#transaction = transaction;
    this.#callbackAttempt = callbackAttempt;
    this.#instrumentation = instrumentation;
  }

  async get(
    locator: FirestoreAuthorityDocumentLocator,
  ): Promise<FirestoreAuthorityReadSnapshot> {
    const snapshot = await this.#transaction.get(
      this.#firestore
        .collection(locator.collectionPath)
        .doc(locator.documentId),
    );
    await this.#instrumentation.afterRead?.(
      locator,
      this.#callbackAttempt,
    );
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
    this.#beforeWrite(locator);
    this.#transaction.create(
      this.#firestore
        .collection(locator.collectionPath)
        .doc(locator.documentId),
      data,
    );
  }

  update(
    locator: FirestoreAuthorityDocumentLocator,
    data: FirestoreAuthorityDocumentData,
  ): void {
    this.#beforeWrite(locator);
    this.#transaction.update(
      this.#firestore
        .collection(locator.collectionPath)
        .doc(locator.documentId),
      data,
    );
  }

  #beforeWrite(locator: FirestoreAuthorityDocumentLocator): void {
    this.#writeCount += 1;
    this.#instrumentation.beforeWrite?.(
      locator,
      this.#writeCount,
      this.#callbackAttempt,
    );
  }
}

export class InstrumentedFirestoreAuthorityTransactionRunner
  implements FirestoreAuthorityTransactionRunner
{
  readonly #firestore: Firestore;
  readonly #instrumentation:
    FirestoreAuthorityTransactionInstrumentation;
  readonly #options: InstrumentedTransactionRunnerOptions;
  #betweenAttempts: Promise<void> | undefined;
  callbackCount = 0;

  constructor(
    firestore: Firestore,
    instrumentation:
      FirestoreAuthorityTransactionInstrumentation = {},
    options: InstrumentedTransactionRunnerOptions = {},
  ) {
    this.#firestore = firestore;
    this.#instrumentation = instrumentation;
    this.#options = options;
  }

  runTransaction<T>(
    callback: (transaction: FirestoreAuthorityTransaction) => Promise<T>,
  ): Promise<T> {
    return this.#firestore.runTransaction(async (transaction) => {
      this.callbackCount += 1;
      if (
        this.callbackCount > 1 &&
        this.#betweenAttempts !== undefined
      ) {
        await this.#betweenAttempts;
      }
      const result = await callback(
        new InstrumentedFirestoreAuthorityTransaction(
          this.#firestore,
          transaction,
          this.callbackCount,
          this.#instrumentation,
        ),
      );
      if (
        this.#options.abortFirstCallback === true &&
        this.callbackCount === 1
      ) {
        this.#betweenAttempts =
          this.#options.betweenFirstCallbackAndRetry?.();
        throw Object.assign(
          new Error("Controlled Firestore transaction contention."),
          { code: 10 },
        );
      }
      return result;
    });
  }
}

export interface EmulatorAuthorityHarness {
  readonly app: App;
  readonly firestore: Firestore;
  clear(): Promise<void>;
  close(): Promise<void>;
  collectionIds(): Promise<readonly string[]>;
  count(collectionPath: string): Promise<number>;
  read(
    collectionPath: string,
    documentId: string,
  ): Promise<Readonly<Record<string, unknown>> | undefined>;
  seed(
    collectionPath: string,
    documentId: string,
    value: unknown,
  ): Promise<void>;
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
    modulusLength: 2048,
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

export function createEmulatorAuthorityHarness():
  EmulatorAuthorityHarness {
  const isolation = assertAuthorityEmulatorIsolation();
  const app = initializeApp(
    {
      projectId: isolation.projectId,
      credential: createEmulatorOnlyCredential(
        isolation.projectId,
      ),
    },
    `authority-emulator-${process.pid}-${Date.now()}`,
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
      const snapshot = await firestore
        .collection(collectionPath)
        .get();
      return snapshot.size;
    },
    async read(
      collectionPath: string,
      documentId: string,
    ): Promise<Readonly<Record<string, unknown>> | undefined> {
      const snapshot = await firestore
        .collection(collectionPath)
        .doc(documentId)
        .get();
      return snapshot.exists ? snapshot.data() : undefined;
    },
    async seed(
      collectionPath: string,
      documentId: string,
      value: unknown,
    ): Promise<void> {
      await firestore
        .collection(collectionPath)
        .doc(documentId)
        .create(serializeAuthorityFirestoreDocument(value));
    },
  };
}
