import { DiscoveryIntakeIdempotencyError } from "./discoveryIntakeIdempotencyErrors";
import {
  DISCOVERY_INTAKE_IDEMPOTENCY_POLICY_VERSION,
  type DiscoveryIntakeIdempotencyPolicyV1,
} from "./discoveryIntakeIdempotencyTypes";

const MINUTE_MS = 60 * 1_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export const DISCOVERY_INTAKE_IDEMPOTENCY_POLICY_V1 = Object.freeze({
  version: DISCOVERY_INTAKE_IDEMPOTENCY_POLICY_VERSION,
  leaseDurationMs: MINUTE_MS,
  processingRetentionMs: DAY_MS,
  completedRetentionMs: 7 * DAY_MS,
  failedRetentionMs: DAY_MS,
  maxAttempts: 3,
  maxLeaseRecoveries: 2,
  maxActiveRecordsPerNamespace: 3,
  cleanupBatchSize: 100,
  reason: "Bound public Discovery intake idempotency lifecycle and retention.",
  owner: "Aura Intelligence Security",
} satisfies DiscoveryIntakeIdempotencyPolicyV1);

function requirePositiveSafeInteger(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new DiscoveryIntakeIdempotencyError(
      "IDEMPOTENCY_INTERNAL_FAILURE",
      `Invalid idempotency policy field: ${field}.`,
    );
  }
}

export function validateDiscoveryIntakeIdempotencyPolicyV1(
  policy: DiscoveryIntakeIdempotencyPolicyV1,
): DiscoveryIntakeIdempotencyPolicyV1 {
  if (policy.version !== DISCOVERY_INTAKE_IDEMPOTENCY_POLICY_VERSION) {
    throw new DiscoveryIntakeIdempotencyError(
      "IDEMPOTENCY_INTERNAL_FAILURE",
      "Unsupported idempotency policy version.",
    );
  }
  requirePositiveSafeInteger(policy.leaseDurationMs, "leaseDurationMs");
  requirePositiveSafeInteger(
    policy.processingRetentionMs,
    "processingRetentionMs",
  );
  requirePositiveSafeInteger(
    policy.completedRetentionMs,
    "completedRetentionMs",
  );
  requirePositiveSafeInteger(policy.failedRetentionMs, "failedRetentionMs");
  requirePositiveSafeInteger(policy.maxAttempts, "maxAttempts");
  requirePositiveSafeInteger(
    policy.maxLeaseRecoveries,
    "maxLeaseRecoveries",
  );
  requirePositiveSafeInteger(
    policy.maxActiveRecordsPerNamespace,
    "maxActiveRecordsPerNamespace",
  );
  requirePositiveSafeInteger(policy.cleanupBatchSize, "cleanupBatchSize");
  if (
    policy.leaseDurationMs >= policy.processingRetentionMs ||
    policy.maxLeaseRecoveries >= policy.maxAttempts ||
    policy.reason.trim().length === 0 ||
    policy.owner.trim().length === 0
  ) {
    throw new DiscoveryIntakeIdempotencyError(
      "IDEMPOTENCY_INTERNAL_FAILURE",
      "Incoherent idempotency policy.",
    );
  }
  return policy;
}
