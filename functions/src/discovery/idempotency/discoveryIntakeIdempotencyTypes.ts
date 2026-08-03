export const DISCOVERY_INTAKE_IDEMPOTENCY_RECORD_VERSION =
  "DISCOVERY_INTAKE_IDEMPOTENCY_V1" as const;

export const DISCOVERY_INTAKE_IDEMPOTENCY_RESULT_VERSION =
  "DISCOVERY_INTAKE_RESULT_V1" as const;

export const DISCOVERY_INTAKE_IDEMPOTENCY_POLICY_VERSION =
  "DISCOVERY_INTAKE_IDEMPOTENCY_POLICY_V1" as const;

export const DISCOVERY_INTAKE_IDEMPOTENCY_STATUSES = Object.freeze([
  "PROCESSING",
  "COMPLETED",
  "FAILED_FINAL",
] as const);

export type DiscoveryIntakeIdempotencyStatus =
  (typeof DISCOVERY_INTAKE_IDEMPOTENCY_STATUSES)[number];

export interface DiscoveryIntakeIdempotencyResultV1 {
  readonly linkId: string;
  readonly capabilityGenerationId: string;
  readonly advisorDisplayName: string | null;
  readonly organizationProfile: string;
  readonly requiresManualReview: boolean;
}

export interface DiscoveryIntakeIdempotencyRecordV1 {
  readonly version: typeof DISCOVERY_INTAKE_IDEMPOTENCY_RECORD_VERSION;
  readonly status: DiscoveryIntakeIdempotencyStatus;
  readonly requestHash: string;
  readonly namespaceHash: string;
  readonly processingAttemptId: string | null;
  readonly attemptCount: number;
  readonly leaseRecoveryCount: number;
  readonly leaseExpiresAt: number | null;
  readonly expiresAt: number;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly completedAt: number | null;
  readonly failedAt: number | null;
  readonly failureCode: DiscoveryIntakeIdempotencyErrorCode | null;
  readonly result: DiscoveryIntakeIdempotencyResultV1 | null;
  readonly resultVersion:
    | typeof DISCOVERY_INTAKE_IDEMPOTENCY_RESULT_VERSION
    | null;
}

export interface DiscoveryIntakeIdempotencyPolicyV1 {
  readonly version: typeof DISCOVERY_INTAKE_IDEMPOTENCY_POLICY_VERSION;
  readonly leaseDurationMs: number;
  readonly processingRetentionMs: number;
  readonly completedRetentionMs: number;
  readonly failedRetentionMs: number;
  readonly maxAttempts: number;
  readonly maxLeaseRecoveries: number;
  readonly maxActiveRecordsPerNamespace: number;
  readonly cleanupBatchSize: number;
  readonly reason: string;
  readonly owner: string;
}

export const DISCOVERY_INTAKE_IDEMPOTENCY_ERROR_CODES = Object.freeze([
  "IDEMPOTENCY_RECORD_EXPIRED",
  "IDEMPOTENCY_RECORD_CORRUPTED",
  "IDEMPOTENCY_ATTEMPTS_EXCEEDED",
  "IDEMPOTENCY_LEASE_RECOVERY_EXCEEDED",
  "IDEMPOTENCY_REQUEST_CONFLICT",
  "IDEMPOTENCY_CARDINALITY_EXCEEDED",
  "IDEMPOTENCY_CLEANUP_FAILURE",
  "IDEMPOTENCY_INTERNAL_FAILURE",
] as const);

export type DiscoveryIntakeIdempotencyErrorCode =
  (typeof DISCOVERY_INTAKE_IDEMPOTENCY_ERROR_CODES)[number];

export type DiscoveryIntakeIdempotencyRecordClassificationV1 =
  | Readonly<{
      classification: "ACTIVE";
      record: DiscoveryIntakeIdempotencyRecordV1;
    }>
  | Readonly<{
      classification: "EXPIRED";
      record: DiscoveryIntakeIdempotencyRecordV1;
    }>
  | Readonly<{
      classification: "CORRUPTED";
    }>;

export type DiscoveryIntakeIdempotencyAcquireDecisionV1 =
  | Readonly<{
      decision: "ACQUIRED";
      processingAttemptId: string;
      attemptCount: number;
      leaseRecoveryCount: number;
    }>
  | Readonly<{
      decision: "PROCESSING";
      retryAfterSeconds: number;
    }>
  | Readonly<{
      decision: "CACHED";
      result: DiscoveryIntakeIdempotencyResultV1;
    }>;

export interface DiscoveryIntakeIdempotencyAcquireCommandV1 {
  readonly recordId: string;
  readonly requestHash: string;
  readonly namespaceHash: string;
  readonly processingAttemptId: string;
}

export interface DiscoveryIntakeIdempotencyCompleteCommandV1 {
  readonly recordId: string;
  readonly requestHash: string;
  readonly namespaceHash: string;
  readonly processingAttemptId: string;
  readonly result: DiscoveryIntakeIdempotencyResultV1;
}

export interface DiscoveryIntakeIdempotencyFailCommandV1 {
  readonly recordId: string;
  readonly requestHash: string;
  readonly namespaceHash: string;
  readonly processingAttemptId: string;
  readonly failureCode: DiscoveryIntakeIdempotencyErrorCode;
}

export interface DiscoveryIntakeAtomicCreateEffectV1 {
  readonly operation: "CREATE";
  readonly collectionPath: string;
  readonly documentId: string;
  readonly data: Readonly<Record<string, unknown>>;
}

export interface DiscoveryIntakeIdempotencyCleanupRequestV1 {
  readonly batchSize?: number;
  readonly dryRun?: boolean;
}

export interface DiscoveryIntakeIdempotencyCleanupResultV1 {
  readonly scanned: number;
  readonly deleted: number;
  readonly wouldDelete: number;
  readonly skipped: number;
  readonly errors: number;
  readonly oldestExpiredAt: number | null;
  readonly maxExpiredAgeMs: number;
}
