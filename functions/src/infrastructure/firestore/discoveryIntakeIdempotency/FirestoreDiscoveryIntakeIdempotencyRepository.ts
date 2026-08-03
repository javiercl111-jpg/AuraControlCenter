import type {
  DocumentData,
  DocumentReference,
  Firestore,
  Transaction,
} from "firebase-admin/firestore";
import { Timestamp } from "firebase-admin/firestore";

import {
  DiscoveryIntakeIdempotencyError,
  classifyDiscoveryIntakeIdempotencyRecordV1,
  isDiscoveryIntakeIdempotencyError,
  planDiscoveryIntakeIdempotencyAcquireV1,
  planDiscoveryIntakeIdempotencyCompleteV1,
  planDiscoveryIntakeIdempotencyFailV1,
  readDiscoveryIntakeIdempotencyClock,
  validateDiscoveryIntakeIdempotencyPolicyV1,
  type DiscoveryIntakeAtomicCreateEffectV1,
  type DiscoveryIntakeIdempotencyAcquireCommandV1,
  type DiscoveryIntakeIdempotencyAcquireDecisionV1,
  type DiscoveryIntakeIdempotencyClock,
  type DiscoveryIntakeIdempotencyCompleteCommandV1,
  type DiscoveryIntakeIdempotencyFailCommandV1,
  type DiscoveryIntakeIdempotencyPolicyV1,
  type DiscoveryIntakeIdempotencyRecordV1,
  type DiscoveryIntakeIdempotencyRepository,
} from "../../../discovery/idempotency";
import {
  FIRESTORE_DISCOVERY_INTAKE_IDEMPOTENCY_COLLECTION,
  FIRESTORE_DISCOVERY_INTAKE_IDEMPOTENCY_NAMESPACE_COLLECTION,
  FIRESTORE_DISCOVERY_INTAKE_IDEMPOTENCY_NAMESPACE_VERSION,
} from "./firestoreDiscoveryIntakeIdempotencyCollections";
import {
  deserializeDiscoveryIntakeIdempotencyRecordV1,
  serializeDiscoveryIntakeIdempotencyRecordV1,
} from "./firestoreDiscoveryIntakeIdempotencySerialization";

const FIRESTORE_TRANSACTION_MAX_ATTEMPTS = 5;
const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/;

interface NamespaceRecordV1 {
  readonly version:
    typeof FIRESTORE_DISCOVERY_INTAKE_IDEMPOTENCY_NAMESPACE_VERSION;
  readonly namespaceHash: string;
  readonly activeRecordIds: readonly string[];
}

export interface FirestoreDiscoveryIdempotencyTestSeam {
  onTransactionAttempt?(input: Readonly<{
    operation: "ACQUIRE" | "COMPLETE" | "FAIL";
    attempt: number;
  }>): Promise<void>;
}

const systemClock: DiscoveryIntakeIdempotencyClock = Object.freeze({
  nowEpochMilliseconds: () => Date.now(),
});

function normalizeFailure(error: unknown): DiscoveryIntakeIdempotencyError {
  if (isDiscoveryIntakeIdempotencyError(error)) return error;
  return new DiscoveryIntakeIdempotencyError(
    "IDEMPOTENCY_INTERNAL_FAILURE",
    "Firestore idempotency transaction failed.",
    { cause: error },
  );
}

function readNamespace(
  value: DocumentData | undefined,
  expectedNamespaceHash: string,
  policy: DiscoveryIntakeIdempotencyPolicyV1,
): NamespaceRecordV1 {
  if (value === undefined) {
    return Object.freeze({
      version: FIRESTORE_DISCOVERY_INTAKE_IDEMPOTENCY_NAMESPACE_VERSION,
      namespaceHash: expectedNamespaceHash,
      activeRecordIds: Object.freeze([]),
    });
  }
  const activeRecordIds = value.activeRecordIds;
  if (
    value.version !== FIRESTORE_DISCOVERY_INTAKE_IDEMPOTENCY_NAMESPACE_VERSION ||
    value.namespaceHash !== expectedNamespaceHash ||
    !Array.isArray(activeRecordIds) ||
    activeRecordIds.length > policy.maxActiveRecordsPerNamespace ||
    new Set(activeRecordIds).size !== activeRecordIds.length ||
    !activeRecordIds.every(
      (recordId: unknown) =>
        typeof recordId === "string" && SHA256_HEX_PATTERN.test(recordId),
    )
  ) {
    throw new DiscoveryIntakeIdempotencyError(
      "IDEMPOTENCY_RECORD_CORRUPTED",
      "Idempotency namespace record is corrupted.",
    );
  }
  return Object.freeze({
    version: FIRESTORE_DISCOVERY_INTAKE_IDEMPOTENCY_NAMESPACE_VERSION,
    namespaceHash: expectedNamespaceHash,
    activeRecordIds: Object.freeze([...activeRecordIds] as string[]),
  });
}

function writeNamespace(
  transaction: Transaction,
  reference: DocumentReference,
  namespaceHash: string,
  activeRecordIds: readonly string[],
  now: number,
): void {
  transaction.set(reference, {
    version: FIRESTORE_DISCOVERY_INTAKE_IDEMPOTENCY_NAMESPACE_VERSION,
    namespaceHash,
    activeRecordIds: [...activeRecordIds].sort(),
    updatedAt: Timestamp.fromMillis(now),
  });
}

function validateEffect(effect: DiscoveryIntakeAtomicCreateEffectV1): void {
  if (
    effect.operation !== "CREATE" ||
    !/^[A-Za-z0-9_/-]{1,200}$/.test(effect.collectionPath) ||
    !/^[A-Za-z0-9_-]{8,128}$/.test(effect.documentId) ||
    typeof effect.data !== "object" || effect.data === null
  ) {
    throw new DiscoveryIntakeIdempotencyError(
      "IDEMPOTENCY_INTERNAL_FAILURE", "Invalid atomic completion effect.",
    );
  }
}

export class FirestoreDiscoveryIntakeIdempotencyRepository
implements DiscoveryIntakeIdempotencyRepository {
  readonly #firestore: Firestore;
  readonly #clock: DiscoveryIntakeIdempotencyClock;
  readonly #policy: DiscoveryIntakeIdempotencyPolicyV1;
  readonly #testSeam: FirestoreDiscoveryIdempotencyTestSeam;

  constructor(
    firestore: Firestore,
    policy: DiscoveryIntakeIdempotencyPolicyV1,
    clock: DiscoveryIntakeIdempotencyClock = systemClock,
    testSeam: FirestoreDiscoveryIdempotencyTestSeam = {},
  ) {
    this.#firestore = firestore;
    this.#policy = validateDiscoveryIntakeIdempotencyPolicyV1(policy);
    this.#clock = clock;
    this.#testSeam = testSeam;
  }

  #recordRef(recordId: string): DocumentReference {
    return this.#firestore
      .collection(FIRESTORE_DISCOVERY_INTAKE_IDEMPOTENCY_COLLECTION)
      .doc(recordId);
  }

  #namespaceRef(namespaceHash: string): DocumentReference {
    return this.#firestore
      .collection(FIRESTORE_DISCOVERY_INTAKE_IDEMPOTENCY_NAMESPACE_COLLECTION)
      .doc(namespaceHash);
  }

  async #activeRecordIds(
    transaction: Transaction,
    namespace: NamespaceRecordV1,
    currentRecordId: string,
    now: number,
  ): Promise<readonly string[]> {
    const otherIds = namespace.activeRecordIds.filter(
      (recordId) => recordId !== currentRecordId,
    );
    const snapshots = await Promise.all(
      otherIds.map((recordId) => transaction.get(this.#recordRef(recordId))),
    );
    const activeIds: string[] = [];
    snapshots.forEach((snapshot, index) => {
      if (!snapshot.exists) return;
      const classified = classifyDiscoveryIntakeIdempotencyRecordV1(
        deserializeDiscoveryIntakeIdempotencyRecordV1(snapshot.data()),
        now,
        this.#policy,
      );
      if (classified.classification === "CORRUPTED") {
        throw new DiscoveryIntakeIdempotencyError(
          "IDEMPOTENCY_RECORD_CORRUPTED",
          "Active idempotency namespace references a corrupt record.",
        );
      }
      if (
        classified.classification === "ACTIVE" &&
        classified.record.status === "PROCESSING"
      ) {
        activeIds.push(otherIds[index]);
      }
    });
    return Object.freeze(activeIds.sort());
  }

  async acquire(
    command: DiscoveryIntakeIdempotencyAcquireCommandV1,
  ): Promise<DiscoveryIntakeIdempotencyAcquireDecisionV1> {
    const now = readDiscoveryIntakeIdempotencyClock(this.#clock);
    let attempt = 0;
    try {
      const result = await this.#firestore.runTransaction(async (transaction) => {
        attempt += 1;
        const recordRef = this.#recordRef(command.recordId);
        const namespaceRef = this.#namespaceRef(command.namespaceHash);
        const [recordSnapshot, namespaceSnapshot] = await Promise.all([
          transaction.get(recordRef),
          transaction.get(namespaceRef),
        ]);
        const namespace = readNamespace(
          namespaceSnapshot.data(), command.namespaceHash, this.#policy,
        );
        const activeIds = await this.#activeRecordIds(
          transaction, namespace, command.recordId, now,
        );
        const plan = planDiscoveryIntakeIdempotencyAcquireV1(
          recordSnapshot.exists
            ? deserializeDiscoveryIntakeIdempotencyRecordV1(recordSnapshot.data())
            : null,
          command,
          now,
          this.#policy,
        );

        if (
          plan.outcome === "DECISION" &&
          plan.decision.decision === "ACQUIRED" &&
          !namespace.activeRecordIds.includes(command.recordId) &&
          activeIds.length >= this.#policy.maxActiveRecordsPerNamespace
        ) {
          return Object.freeze({
            errorCode: "IDEMPOTENCY_CARDINALITY_EXCEEDED" as const,
          });
        }

        if (plan.writeRecord !== null) {
          transaction.set(
            recordRef,
            serializeDiscoveryIntakeIdempotencyRecordV1(plan.writeRecord),
          );
          const nextActiveIds = plan.writeRecord.status === "PROCESSING"
            ? [...activeIds, command.recordId]
            : activeIds;
          writeNamespace(
            transaction,
            namespaceRef,
            command.namespaceHash,
            [...new Set(nextActiveIds)],
            now,
          );
        }
        await this.#testSeam.onTransactionAttempt?.({
          operation: "ACQUIRE", attempt,
        });
        return plan.outcome === "REJECTED"
          ? Object.freeze({ errorCode: plan.errorCode })
          : Object.freeze({ decision: plan.decision });
      }, { maxAttempts: FIRESTORE_TRANSACTION_MAX_ATTEMPTS });

      if ("errorCode" in result) {
        throw new DiscoveryIntakeIdempotencyError(
          result.errorCode,
          "Idempotency acquisition denied.",
        );
      }
      return result.decision;
    } catch (error: unknown) {
      throw normalizeFailure(error);
    }
  }

  async complete(
    command: DiscoveryIntakeIdempotencyCompleteCommandV1,
    effect: DiscoveryIntakeAtomicCreateEffectV1,
  ): Promise<DiscoveryIntakeIdempotencyRecordV1> {
    validateEffect(effect);
    const now = readDiscoveryIntakeIdempotencyClock(this.#clock);
    let attempt = 0;
    try {
      return await this.#firestore.runTransaction(async (transaction) => {
        attempt += 1;
        const recordRef = this.#recordRef(command.recordId);
        const namespaceRef = this.#namespaceRef(command.namespaceHash);
        const [recordSnapshot, namespaceSnapshot] = await Promise.all([
          transaction.get(recordRef),
          transaction.get(namespaceRef),
        ]);
        if (!recordSnapshot.exists) {
          throw new DiscoveryIntakeIdempotencyError(
            "IDEMPOTENCY_RECORD_CORRUPTED", "Idempotency record is missing.",
          );
        }
        const namespace = readNamespace(
          namespaceSnapshot.data(), command.namespaceHash, this.#policy,
        );
        const completed = planDiscoveryIntakeIdempotencyCompleteV1(
          deserializeDiscoveryIntakeIdempotencyRecordV1(recordSnapshot.data()),
          command,
          now,
          this.#policy,
        );
        transaction.create(
          this.#firestore.collection(effect.collectionPath).doc(effect.documentId),
          effect.data,
        );
        transaction.set(
          recordRef, serializeDiscoveryIntakeIdempotencyRecordV1(completed),
        );
        writeNamespace(
          transaction,
          namespaceRef,
          command.namespaceHash,
          namespace.activeRecordIds.filter(
            (recordId) => recordId !== command.recordId,
          ),
          now,
        );
        await this.#testSeam.onTransactionAttempt?.({
          operation: "COMPLETE", attempt,
        });
        return completed;
      }, { maxAttempts: FIRESTORE_TRANSACTION_MAX_ATTEMPTS });
    } catch (error: unknown) {
      throw normalizeFailure(error);
    }
  }

  async fail(command: DiscoveryIntakeIdempotencyFailCommandV1): Promise<void> {
    const now = readDiscoveryIntakeIdempotencyClock(this.#clock);
    let attempt = 0;
    try {
      await this.#firestore.runTransaction(async (transaction) => {
        attempt += 1;
        const recordRef = this.#recordRef(command.recordId);
        const namespaceRef = this.#namespaceRef(command.namespaceHash);
        const [recordSnapshot, namespaceSnapshot] = await Promise.all([
          transaction.get(recordRef), transaction.get(namespaceRef),
        ]);
        if (!recordSnapshot.exists) {
          throw new DiscoveryIntakeIdempotencyError(
            "IDEMPOTENCY_RECORD_CORRUPTED", "Idempotency record is missing.",
          );
        }
        const namespace = readNamespace(
          namespaceSnapshot.data(), command.namespaceHash, this.#policy,
        );
        const failed = planDiscoveryIntakeIdempotencyFailV1(
          deserializeDiscoveryIntakeIdempotencyRecordV1(recordSnapshot.data()),
          command, now, this.#policy,
        );
        transaction.set(
          recordRef, serializeDiscoveryIntakeIdempotencyRecordV1(failed),
        );
        writeNamespace(
          transaction,
          namespaceRef,
          command.namespaceHash,
          namespace.activeRecordIds.filter(
            (recordId) => recordId !== command.recordId,
          ),
          now,
        );
        await this.#testSeam.onTransactionAttempt?.({
          operation: "FAIL", attempt,
        });
      }, { maxAttempts: FIRESTORE_TRANSACTION_MAX_ATTEMPTS });
    } catch (error: unknown) {
      throw normalizeFailure(error);
    }
  }
}
