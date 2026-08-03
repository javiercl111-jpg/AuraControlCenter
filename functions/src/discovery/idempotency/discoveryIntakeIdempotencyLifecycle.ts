import { DiscoveryIntakeIdempotencyError } from "./discoveryIntakeIdempotencyErrors";
import type { DiscoveryIntakeIdempotencyClock } from "./discoveryIntakeIdempotencyPorts";
import { validateDiscoveryIntakeIdempotencyPolicyV1 } from "./discoveryIntakeIdempotencyPolicy";
import {
  DISCOVERY_INTAKE_IDEMPOTENCY_ERROR_CODES,
  DISCOVERY_INTAKE_IDEMPOTENCY_RECORD_VERSION,
  DISCOVERY_INTAKE_IDEMPOTENCY_RESULT_VERSION,
  type DiscoveryIntakeIdempotencyAcquireCommandV1,
  type DiscoveryIntakeIdempotencyAcquireDecisionV1,
  type DiscoveryIntakeIdempotencyCompleteCommandV1,
  type DiscoveryIntakeIdempotencyErrorCode,
  type DiscoveryIntakeIdempotencyFailCommandV1,
  type DiscoveryIntakeIdempotencyPolicyV1,
  type DiscoveryIntakeIdempotencyRecordClassificationV1,
  type DiscoveryIntakeIdempotencyRecordV1,
  type DiscoveryIntakeIdempotencyResultV1,
} from "./discoveryIntakeIdempotencyTypes";

const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/;
const IDENTIFIER_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;
const MILLISECONDS_PER_SECOND = 1_000;

export type DiscoveryIntakeIdempotencyAcquirePlanV1 =
  | Readonly<{
      outcome: "DECISION";
      decision: DiscoveryIntakeIdempotencyAcquireDecisionV1;
      writeRecord: DiscoveryIntakeIdempotencyRecordV1 | null;
    }>
  | Readonly<{
      outcome: "REJECTED";
      errorCode: DiscoveryIntakeIdempotencyErrorCode;
      writeRecord: DiscoveryIntakeIdempotencyRecordV1 | null;
    }>;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTimestamp(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function isNullableTimestamp(value: unknown): value is number | null {
  return value === null || isTimestamp(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isErrorCode(value: unknown): value is DiscoveryIntakeIdempotencyErrorCode {
  return typeof value === "string" &&
    (DISCOVERY_INTAKE_IDEMPOTENCY_ERROR_CODES as readonly string[])
      .includes(value);
}

function isResult(value: unknown): value is DiscoveryIntakeIdempotencyResultV1 {
  if (!isObject(value)) return false;
  return (
    typeof value.linkId === "string" &&
    IDENTIFIER_PATTERN.test(value.linkId) &&
    typeof value.capabilityGenerationId === "string" &&
    SHA256_HEX_PATTERN.test(value.capabilityGenerationId) &&
    isNullableString(value.advisorDisplayName) &&
    typeof value.organizationProfile === "string" &&
    value.organizationProfile.length > 0 &&
    value.organizationProfile.length <= 100 &&
    typeof value.requiresManualReview === "boolean"
  );
}

function hasCommonRecordContract(
  value: Record<string, unknown>,
  policy: DiscoveryIntakeIdempotencyPolicyV1,
): boolean {
  return (
    value.version === DISCOVERY_INTAKE_IDEMPOTENCY_RECORD_VERSION &&
    ["PROCESSING", "COMPLETED", "FAILED_FINAL"].includes(String(value.status)) &&
    typeof value.requestHash === "string" &&
    SHA256_HEX_PATTERN.test(value.requestHash) &&
    typeof value.namespaceHash === "string" &&
    SHA256_HEX_PATTERN.test(value.namespaceHash) &&
    isNullableString(value.processingAttemptId) &&
    Number.isSafeInteger(value.attemptCount) &&
    (value.attemptCount as number) >= 1 &&
    (value.attemptCount as number) <= policy.maxAttempts &&
    Number.isSafeInteger(value.leaseRecoveryCount) &&
    (value.leaseRecoveryCount as number) >= 0 &&
    (value.leaseRecoveryCount as number) <= policy.maxLeaseRecoveries &&
    isNullableTimestamp(value.leaseExpiresAt) &&
    isTimestamp(value.expiresAt) &&
    isTimestamp(value.createdAt) &&
    isTimestamp(value.updatedAt) &&
    isNullableTimestamp(value.completedAt) &&
    isNullableTimestamp(value.failedAt) &&
    (value.failureCode === null || isErrorCode(value.failureCode)) &&
    (value.result === null || isResult(value.result)) &&
    (value.resultVersion === null ||
      value.resultVersion === DISCOVERY_INTAKE_IDEMPOTENCY_RESULT_VERSION) &&
    (value.createdAt as number) <= (value.updatedAt as number) &&
    (value.createdAt as number) < (value.expiresAt as number)
  );
}

function hasStateContract(value: Record<string, unknown>): boolean {
  if (value.status === "PROCESSING") {
    return (
      typeof value.processingAttemptId === "string" &&
      SHA256_HEX_PATTERN.test(value.processingAttemptId) &&
      typeof value.leaseExpiresAt === "number" &&
      value.leaseExpiresAt > (value.createdAt as number) &&
      value.leaseExpiresAt <= (value.expiresAt as number) &&
      value.completedAt === null && value.failedAt === null &&
      value.failureCode === null && value.result === null &&
      value.resultVersion === null
    );
  }
  if (value.status === "COMPLETED") {
    return (
      value.processingAttemptId === null && value.leaseExpiresAt === null &&
      typeof value.completedAt === "number" &&
      value.completedAt >= (value.createdAt as number) &&
      value.completedAt <= (value.updatedAt as number) &&
      value.failedAt === null && value.failureCode === null &&
      isResult(value.result) &&
      value.resultVersion === DISCOVERY_INTAKE_IDEMPOTENCY_RESULT_VERSION
    );
  }
  return (
    value.processingAttemptId === null && value.leaseExpiresAt === null &&
    value.completedAt === null && typeof value.failedAt === "number" &&
    value.failedAt >= (value.createdAt as number) &&
    value.failedAt <= (value.updatedAt as number) &&
    isErrorCode(value.failureCode) && value.result === null &&
    value.resultVersion === null
  );
}

export function readDiscoveryIntakeIdempotencyClock(
  clock: DiscoveryIntakeIdempotencyClock,
): number {
  let now: number;
  try {
    now = clock.nowEpochMilliseconds();
  } catch (error: unknown) {
    throw new DiscoveryIntakeIdempotencyError(
      "IDEMPOTENCY_INTERNAL_FAILURE", "Idempotency clock failed.", { cause: error },
    );
  }
  if (!isTimestamp(now)) {
    throw new DiscoveryIntakeIdempotencyError(
      "IDEMPOTENCY_INTERNAL_FAILURE", "Idempotency clock returned an invalid value.",
    );
  }
  return now;
}

export function classifyDiscoveryIntakeIdempotencyRecordV1(
  value: unknown,
  now: number,
  policyValue: DiscoveryIntakeIdempotencyPolicyV1,
): DiscoveryIntakeIdempotencyRecordClassificationV1 {
  const policy = validateDiscoveryIntakeIdempotencyPolicyV1(policyValue);
  if (!isTimestamp(now) || !isObject(value) ||
      !hasCommonRecordContract(value, policy) || !hasStateContract(value)) {
    return Object.freeze({ classification: "CORRUPTED" });
  }
  const record = value as unknown as DiscoveryIntakeIdempotencyRecordV1;
  return Object.freeze({
    classification: record.expiresAt <= now ? "EXPIRED" : "ACTIVE",
    record,
  });
}

function createProcessingRecord(
  command: DiscoveryIntakeIdempotencyAcquireCommandV1,
  now: number,
  policy: DiscoveryIntakeIdempotencyPolicyV1,
): DiscoveryIntakeIdempotencyRecordV1 {
  return Object.freeze({
    version: DISCOVERY_INTAKE_IDEMPOTENCY_RECORD_VERSION,
    status: "PROCESSING",
    requestHash: command.requestHash,
    namespaceHash: command.namespaceHash,
    processingAttemptId: command.processingAttemptId,
    attemptCount: 1,
    leaseRecoveryCount: 0,
    leaseExpiresAt: now + policy.leaseDurationMs,
    expiresAt: now + policy.processingRetentionMs,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    failedAt: null,
    failureCode: null,
    result: null,
    resultVersion: null,
  });
}

function createFailedRecord(
  record: DiscoveryIntakeIdempotencyRecordV1,
  now: number,
  policy: DiscoveryIntakeIdempotencyPolicyV1,
  failureCode: DiscoveryIntakeIdempotencyErrorCode,
): DiscoveryIntakeIdempotencyRecordV1 {
  return Object.freeze({
    ...record,
    status: "FAILED_FINAL",
    processingAttemptId: null,
    leaseExpiresAt: null,
    expiresAt: now + policy.failedRetentionMs,
    updatedAt: now,
    completedAt: null,
    failedAt: now,
    failureCode,
    result: null,
    resultVersion: null,
  });
}

function reject(
  errorCode: DiscoveryIntakeIdempotencyErrorCode,
  writeRecord: DiscoveryIntakeIdempotencyRecordV1 | null = null,
): DiscoveryIntakeIdempotencyAcquirePlanV1 {
  return Object.freeze({ outcome: "REJECTED", errorCode, writeRecord });
}

export function planDiscoveryIntakeIdempotencyAcquireV1(
  existingValue: unknown | null,
  command: DiscoveryIntakeIdempotencyAcquireCommandV1,
  now: number,
  policyValue: DiscoveryIntakeIdempotencyPolicyV1,
): DiscoveryIntakeIdempotencyAcquirePlanV1 {
  const policy = validateDiscoveryIntakeIdempotencyPolicyV1(policyValue);
  if (!isTimestamp(now) || !SHA256_HEX_PATTERN.test(command.recordId) ||
      !SHA256_HEX_PATTERN.test(command.requestHash) ||
      !SHA256_HEX_PATTERN.test(command.namespaceHash) ||
      !SHA256_HEX_PATTERN.test(command.processingAttemptId)) {
    return reject("IDEMPOTENCY_INTERNAL_FAILURE");
  }
  if (existingValue === null) {
    const record = createProcessingRecord(command, now, policy);
    return Object.freeze({
      outcome: "DECISION",
      decision: Object.freeze({
        decision: "ACQUIRED",
        processingAttemptId: command.processingAttemptId,
        attemptCount: 1,
        leaseRecoveryCount: 0,
      }),
      writeRecord: record,
    });
  }

  const classified = classifyDiscoveryIntakeIdempotencyRecordV1(
    existingValue, now, policy,
  );
  if (classified.classification === "CORRUPTED") {
    return reject("IDEMPOTENCY_RECORD_CORRUPTED");
  }
  const record = classified.record;
  if (record.requestHash !== command.requestHash ||
      record.namespaceHash !== command.namespaceHash) {
    return reject("IDEMPOTENCY_REQUEST_CONFLICT");
  }
  if (classified.classification === "EXPIRED") {
    return reject("IDEMPOTENCY_RECORD_EXPIRED");
  }
  if (record.status === "COMPLETED") {
    return Object.freeze({
      outcome: "DECISION",
      decision: Object.freeze({ decision: "CACHED", result: record.result! }),
      writeRecord: null,
    });
  }
  if (record.status === "FAILED_FINAL") {
    return reject(record.failureCode ?? "IDEMPOTENCY_INTERNAL_FAILURE");
  }
  if (record.leaseExpiresAt! > now) {
    return Object.freeze({
      outcome: "DECISION",
      decision: Object.freeze({
        decision: "PROCESSING",
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((record.leaseExpiresAt! - now) / MILLISECONDS_PER_SECOND),
        ),
      }),
      writeRecord: null,
    });
  }
  if (record.attemptCount >= policy.maxAttempts) {
    return reject(
      "IDEMPOTENCY_ATTEMPTS_EXCEEDED",
      createFailedRecord(record, now, policy, "IDEMPOTENCY_ATTEMPTS_EXCEEDED"),
    );
  }
  if (record.leaseRecoveryCount >= policy.maxLeaseRecoveries) {
    return reject(
      "IDEMPOTENCY_LEASE_RECOVERY_EXCEEDED",
      createFailedRecord(
        record, now, policy, "IDEMPOTENCY_LEASE_RECOVERY_EXCEEDED",
      ),
    );
  }
  const recovered: DiscoveryIntakeIdempotencyRecordV1 = Object.freeze({
    ...record,
    processingAttemptId: command.processingAttemptId,
    attemptCount: record.attemptCount + 1,
    leaseRecoveryCount: record.leaseRecoveryCount + 1,
    leaseExpiresAt: Math.min(record.expiresAt, now + policy.leaseDurationMs),
    updatedAt: now,
  });
  return Object.freeze({
    outcome: "DECISION",
    decision: Object.freeze({
      decision: "ACQUIRED",
      processingAttemptId: command.processingAttemptId,
      attemptCount: recovered.attemptCount,
      leaseRecoveryCount: recovered.leaseRecoveryCount,
    }),
    writeRecord: recovered,
  });
}

function requireActiveProcessingRecord(
  existingValue: unknown,
  command: Readonly<{
    requestHash: string;
    namespaceHash: string;
    processingAttemptId: string;
  }>,
  now: number,
  policy: DiscoveryIntakeIdempotencyPolicyV1,
): DiscoveryIntakeIdempotencyRecordV1 {
  const classified = classifyDiscoveryIntakeIdempotencyRecordV1(
    existingValue, now, policy,
  );
  if (classified.classification === "CORRUPTED") {
    throw new DiscoveryIntakeIdempotencyError(
      "IDEMPOTENCY_RECORD_CORRUPTED", "Idempotency record is corrupted.",
    );
  }
  if (classified.classification === "EXPIRED") {
    throw new DiscoveryIntakeIdempotencyError(
      "IDEMPOTENCY_RECORD_EXPIRED", "Idempotency record expired.",
    );
  }
  const record = classified.record;
  if (record.status !== "PROCESSING" ||
      record.requestHash !== command.requestHash ||
      record.namespaceHash !== command.namespaceHash ||
      record.processingAttemptId !== command.processingAttemptId) {
    throw new DiscoveryIntakeIdempotencyError(
      "IDEMPOTENCY_REQUEST_CONFLICT",
      "Idempotency processing fence did not match.",
    );
  }
  return record;
}

export function planDiscoveryIntakeIdempotencyCompleteV1(
  existingValue: unknown,
  command: DiscoveryIntakeIdempotencyCompleteCommandV1,
  now: number,
  policyValue: DiscoveryIntakeIdempotencyPolicyV1,
): DiscoveryIntakeIdempotencyRecordV1 {
  const policy = validateDiscoveryIntakeIdempotencyPolicyV1(policyValue);
  const record = requireActiveProcessingRecord(
    existingValue, command, now, policy,
  );
  if (!isResult(command.result)) {
    throw new DiscoveryIntakeIdempotencyError(
      "IDEMPOTENCY_INTERNAL_FAILURE", "Idempotency result is invalid.",
    );
  }
  return Object.freeze({
    ...record,
    status: "COMPLETED",
    processingAttemptId: null,
    leaseExpiresAt: null,
    expiresAt: now + policy.completedRetentionMs,
    updatedAt: now,
    completedAt: now,
    failedAt: null,
    failureCode: null,
    result: Object.freeze({ ...command.result }),
    resultVersion: DISCOVERY_INTAKE_IDEMPOTENCY_RESULT_VERSION,
  });
}

export function planDiscoveryIntakeIdempotencyFailV1(
  existingValue: unknown,
  command: DiscoveryIntakeIdempotencyFailCommandV1,
  now: number,
  policyValue: DiscoveryIntakeIdempotencyPolicyV1,
): DiscoveryIntakeIdempotencyRecordV1 {
  const policy = validateDiscoveryIntakeIdempotencyPolicyV1(policyValue);
  const record = requireActiveProcessingRecord(
    existingValue, command, now, policy,
  );
  return createFailedRecord(record, now, policy, command.failureCode);
}
