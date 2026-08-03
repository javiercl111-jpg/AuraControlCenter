import { createHash } from "node:crypto";

import type { Firestore } from "firebase-admin/firestore";

import {
  RateLimitError,
  isRateLimitError,
} from "../../../rateLimits/rateLimitErrors";
import type { RateLimitRepository } from "../../../rateLimits/rateLimitPorts";
import type {
  RateLimitCounterCommandV1,
  RateLimitRepositoryResultV1,
} from "../../../rateLimits/rateLimitTypes";
import {
  validateRateLimitCounterCommandV1,
} from "../../../rateLimits/rateLimitValidation";
import {
  FIRESTORE_RATE_LIMIT_COLLECTION,
  type FirestoreRateLimitDocumentLocator,
} from "./firestoreRateLimitCollections";
import {
  FirestoreAdminRateLimitTransactionRunner,
  type FirestoreRateLimitTransactionRunner,
} from "./firestoreRateLimitTransaction";

const FIRESTORE_RATE_LIMIT_COUNTER_SCHEMA_VERSION =
  "FIRESTORE_RATE_LIMIT_COUNTER_V1" as const;

interface FirestoreRateLimitCounterV1
  extends Readonly<Record<string, unknown>>
{
  readonly schemaVersion:
    typeof FIRESTORE_RATE_LIMIT_COUNTER_SCHEMA_VERSION;
  readonly dimension: string;
  readonly environment: string;
  readonly keyFingerprint: string;
  readonly keyScheme: string;
  readonly keyVersion: string;
  readonly policyVersion: string;
  readonly bucket: string;
  readonly windowStartedAtMs: number;
  readonly windowEndsAtMs: number;
  readonly windowSeconds: number;
  readonly maxRequests: number;
  readonly burst: number;
  readonly effectiveLimit: number;
  readonly count: number;
  readonly createdAtMs: number;
  readonly updatedAtMs: number;
}

class FirestoreRateLimitKeyedQueue {
  readonly #tails = new Map<string, Promise<void>>();

  async run<T>(key: string, work: () => Promise<T>): Promise<T> {
    const previous = this.#tails.get(key) ?? Promise.resolve();
    let releaseCurrent: (() => void) | undefined;
    const currentGate = new Promise<void>((resolve) => {
      releaseCurrent = resolve;
    });
    const currentTail = previous
      .catch(() => undefined)
      .then(() => currentGate);
    this.#tails.set(key, currentTail);
    await previous.catch(() => undefined);
    try {
      return await work();
    } finally {
      releaseCurrent?.();
      if (this.#tails.get(key) === currentTail) {
        this.#tails.delete(key);
      }
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

export function buildFirestoreRateLimitCounterId(
  command: RateLimitCounterCommandV1,
): string {
  return createHash("sha256")
    .update(
      [
        command.environment,
        command.dimension,
        command.keyFingerprint,
        command.policyVersion,
        command.bucket,
      ].join("\0"),
      "utf8",
    )
    .digest("hex");
}

function locator(
  command: RateLimitCounterCommandV1,
): FirestoreRateLimitDocumentLocator {
  return Object.freeze({
    collectionPath: FIRESTORE_RATE_LIMIT_COLLECTION,
    documentId: buildFirestoreRateLimitCounterId(command),
  });
}

function corrupted(message: string): never {
  throw new RateLimitError("COUNTER_CORRUPTED", message);
}

function readCounter(
  value: unknown,
  command: RateLimitCounterCommandV1,
): FirestoreRateLimitCounterV1 {
  if (!isRecord(value)) {
    corrupted("Rate-limit counter document is not an object.");
  }
  const expected = {
    schemaVersion: FIRESTORE_RATE_LIMIT_COUNTER_SCHEMA_VERSION,
    dimension: command.dimension,
    environment: command.environment,
    keyFingerprint: command.keyFingerprint,
    keyScheme: command.key.scheme,
    keyVersion: command.key.version,
    policyVersion: command.policyVersion,
    bucket: command.bucket,
    windowStartedAtMs: command.windowStartedAtMs,
    windowEndsAtMs: command.windowEndsAtMs,
    windowSeconds: command.windowSeconds,
    maxRequests: command.maxRequests,
    burst: command.burst,
    effectiveLimit: command.effectiveLimit,
  } as const;
  for (const [field, expectedValue] of Object.entries(expected)) {
    if (value[field] !== expectedValue) {
      corrupted(`Rate-limit counter ${field} does not match.`);
    }
  }
  if (
    !Number.isSafeInteger(value.count) ||
    (value.count as number) < 1 ||
    (value.count as number) > command.effectiveLimit ||
    !Number.isSafeInteger(value.createdAtMs) ||
    (value.createdAtMs as number) < command.windowStartedAtMs ||
    !Number.isSafeInteger(value.updatedAtMs) ||
    (value.updatedAtMs as number) < (value.createdAtMs as number) ||
    (value.updatedAtMs as number) >= command.windowEndsAtMs
  ) {
    corrupted("Rate-limit counter state is invalid.");
  }
  return value as unknown as FirestoreRateLimitCounterV1;
}

function createCounter(
  command: RateLimitCounterCommandV1,
): FirestoreRateLimitCounterV1 {
  return Object.freeze({
    schemaVersion: FIRESTORE_RATE_LIMIT_COUNTER_SCHEMA_VERSION,
    dimension: command.dimension,
    environment: command.environment,
    keyFingerprint: command.keyFingerprint,
    keyScheme: command.key.scheme,
    keyVersion: command.key.version,
    policyVersion: command.policyVersion,
    bucket: command.bucket,
    windowStartedAtMs: command.windowStartedAtMs,
    windowEndsAtMs: command.windowEndsAtMs,
    windowSeconds: command.windowSeconds,
    maxRequests: command.maxRequests,
    burst: command.burst,
    effectiveLimit: command.effectiveLimit,
    count: 1,
    createdAtMs: command.evaluatedAtMs,
    updatedAtMs: command.evaluatedAtMs,
  });
}

export class FirestoreRateLimitRepository
  implements RateLimitRepository
{
  readonly #transactionRunner: FirestoreRateLimitTransactionRunner;
  readonly #keyedQueue = new FirestoreRateLimitKeyedQueue();

  constructor(
    firestore: Firestore,
    transactionRunner?: FirestoreRateLimitTransactionRunner,
  ) {
    this.#transactionRunner =
      transactionRunner ??
      new FirestoreAdminRateLimitTransactionRunner(firestore);
  }

  async consume(
    commandValue: RateLimitCounterCommandV1,
  ): Promise<RateLimitRepositoryResultV1> {
    const command = validateRateLimitCounterCommandV1(commandValue);
    const counterLocator = locator(command);
    try {
      return await this.#keyedQueue.run(
        counterLocator.documentId,
        () =>
          this.#transactionRunner.runTransaction(
            async (transaction) => {
              const snapshot = await transaction.get(counterLocator);
              if (!snapshot.exists) {
                transaction.create(
                  counterLocator,
                  createCounter(command),
                );
                return Object.freeze({
                  allowed: true,
                  currentCount: 1,
                  remaining: command.effectiveLimit - 1,
                });
              }

              const counter = readCounter(snapshot.data, command);
              if (command.evaluatedAtMs < counter.updatedAtMs) {
                throw new RateLimitError(
                  "CLOCK_ERROR",
                  "Rate-limit clock moved backwards within a window.",
                );
              }
              if (counter.count >= command.effectiveLimit) {
                return Object.freeze({
                  allowed: false,
                  currentCount: counter.count,
                  remaining: 0,
                });
              }
              const currentCount = counter.count + 1;
              transaction.update(counterLocator, {
                count: currentCount,
                updatedAtMs: command.evaluatedAtMs,
              });
              return Object.freeze({
                allowed: true,
                currentCount,
                remaining:
                  command.effectiveLimit - currentCount,
              });
            },
          ),
      );
    } catch (error: unknown) {
      if (isRateLimitError(error)) throw error;
      throw new RateLimitError(
        "INTERNAL_RATE_LIMIT_FAILURE",
        "Firestore rate-limit transaction failed; request denied.",
        { cause: error },
      );
    }
  }
}
