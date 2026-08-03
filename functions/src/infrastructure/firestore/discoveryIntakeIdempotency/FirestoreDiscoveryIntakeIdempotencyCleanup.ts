import type { Firestore } from "firebase-admin/firestore";
import { Timestamp } from "firebase-admin/firestore";

import {
  DiscoveryIntakeIdempotencyError,
  classifyDiscoveryIntakeIdempotencyRecordV1,
  readDiscoveryIntakeIdempotencyClock,
  validateDiscoveryIntakeIdempotencyPolicyV1,
  type DiscoveryIntakeIdempotencyCleanupPort,
  type DiscoveryIntakeIdempotencyCleanupRequestV1,
  type DiscoveryIntakeIdempotencyCleanupResultV1,
  type DiscoveryIntakeIdempotencyClock,
  type DiscoveryIntakeIdempotencyPolicyV1,
} from "../../../discovery/idempotency";
import {
  FIRESTORE_DISCOVERY_INTAKE_IDEMPOTENCY_COLLECTION,
  FIRESTORE_DISCOVERY_INTAKE_IDEMPOTENCY_NAMESPACE_COLLECTION,
  FIRESTORE_DISCOVERY_INTAKE_IDEMPOTENCY_NAMESPACE_VERSION,
} from "./firestoreDiscoveryIntakeIdempotencyCollections";
import {
  deserializeDiscoveryIntakeIdempotencyRecordV1,
} from "./firestoreDiscoveryIntakeIdempotencySerialization";

const CLEANUP_TRANSACTION_MAX_ATTEMPTS = 5;
const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/;

const systemClock: DiscoveryIntakeIdempotencyClock = Object.freeze({
  nowEpochMilliseconds: () => Date.now(),
});

export class FirestoreDiscoveryIntakeIdempotencyCleanup
implements DiscoveryIntakeIdempotencyCleanupPort {
  readonly #firestore: Firestore;
  readonly #policy: DiscoveryIntakeIdempotencyPolicyV1;
  readonly #clock: DiscoveryIntakeIdempotencyClock;

  constructor(
    firestore: Firestore,
    policy: DiscoveryIntakeIdempotencyPolicyV1,
    clock: DiscoveryIntakeIdempotencyClock = systemClock,
  ) {
    this.#firestore = firestore;
    this.#policy = validateDiscoveryIntakeIdempotencyPolicyV1(policy);
    this.#clock = clock;
  }

  async cleanup(
    request: DiscoveryIntakeIdempotencyCleanupRequestV1 = {},
  ): Promise<DiscoveryIntakeIdempotencyCleanupResultV1> {
    const now = readDiscoveryIntakeIdempotencyClock(this.#clock);
    const batchSize = request.batchSize ?? this.#policy.cleanupBatchSize;
    if (
      !Number.isSafeInteger(batchSize) || batchSize <= 0 ||
      batchSize > this.#policy.cleanupBatchSize
    ) {
      throw new DiscoveryIntakeIdempotencyError(
        "IDEMPOTENCY_CLEANUP_FAILURE", "Invalid cleanup batch size.",
      );
    }

    let snapshots;
    try {
      snapshots = await this.#firestore
        .collection(FIRESTORE_DISCOVERY_INTAKE_IDEMPOTENCY_COLLECTION)
        .where("expiresAt", "<=", Timestamp.fromMillis(now))
        .orderBy("expiresAt", "asc")
        .limit(batchSize)
        .get();
    } catch (error: unknown) {
      throw new DiscoveryIntakeIdempotencyError(
        "IDEMPOTENCY_CLEANUP_FAILURE", "Cleanup selection failed.",
        { cause: error },
      );
    }

    let deleted = 0;
    let wouldDelete = 0;
    let skipped = 0;
    let errors = 0;
    let oldestExpiredAt: number | null = null;

    for (const candidate of snapshots.docs) {
      try {
        const candidateRecord = deserializeDiscoveryIntakeIdempotencyRecordV1(
          candidate.data(),
        );
        const classified = classifyDiscoveryIntakeIdempotencyRecordV1(
          candidateRecord, now, this.#policy,
        );
        if (classified.classification !== "EXPIRED") {
          skipped += 1;
          if (classified.classification === "CORRUPTED") errors += 1;
          continue;
        }
        wouldDelete += 1;
        oldestExpiredAt = oldestExpiredAt === null
          ? classified.record.expiresAt
          : Math.min(oldestExpiredAt, classified.record.expiresAt);
        if (request.dryRun === true) continue;

        const deletion = await this.#firestore.runTransaction(
          async (transaction) => {
            const latest = await transaction.get(candidate.ref);
            if (!latest.exists) return false;
            const latestClassified = classifyDiscoveryIntakeIdempotencyRecordV1(
              deserializeDiscoveryIntakeIdempotencyRecordV1(latest.data()),
              now,
              this.#policy,
            );
            if (latestClassified.classification !== "EXPIRED") return false;
            const namespaceRef = this.#firestore
              .collection(
                FIRESTORE_DISCOVERY_INTAKE_IDEMPOTENCY_NAMESPACE_COLLECTION,
              )
              .doc(latestClassified.record.namespaceHash);
            const namespaceSnapshot = await transaction.get(namespaceRef);
            if (namespaceSnapshot.exists) {
              const data = namespaceSnapshot.data();
              const activeRecordIds = data?.activeRecordIds;
              if (
                data?.version !==
                  FIRESTORE_DISCOVERY_INTAKE_IDEMPOTENCY_NAMESPACE_VERSION ||
                data.namespaceHash !== latestClassified.record.namespaceHash ||
                !Array.isArray(activeRecordIds) ||
                activeRecordIds.length >
                  this.#policy.maxActiveRecordsPerNamespace ||
                !activeRecordIds.every(
                  (recordId: unknown) =>
                    typeof recordId === "string" &&
                    SHA256_HEX_PATTERN.test(recordId),
                )
              ) {
                throw new DiscoveryIntakeIdempotencyError(
                  "IDEMPOTENCY_CLEANUP_FAILURE",
                  "Cleanup namespace record is corrupted.",
                );
              }
              transaction.set(namespaceRef, {
                version:
                  FIRESTORE_DISCOVERY_INTAKE_IDEMPOTENCY_NAMESPACE_VERSION,
                namespaceHash: latestClassified.record.namespaceHash,
                activeRecordIds: activeRecordIds.filter(
                  (recordId: string) => recordId !== candidate.id,
                ),
                updatedAt: Timestamp.fromMillis(now),
              });
            }
            transaction.delete(candidate.ref);
            return true;
          },
          { maxAttempts: CLEANUP_TRANSACTION_MAX_ATTEMPTS },
        );
        if (deletion) deleted += 1;
        else skipped += 1;
      } catch (_error: unknown) {
        errors += 1;
        skipped += 1;
      }
    }

    return Object.freeze({
      scanned: snapshots.size,
      deleted,
      wouldDelete,
      skipped,
      errors,
      oldestExpiredAt,
      maxExpiredAgeMs: oldestExpiredAt === null ? 0 : now - oldestExpiredAt,
    });
  }
}
