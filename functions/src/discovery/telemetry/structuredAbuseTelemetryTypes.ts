export const STRUCTURED_ABUSE_TELEMETRY_VERSION =
  "STRUCTURED_ABUSE_TELEMETRY_V1" as const;
export const STRUCTURED_ABUSE_EVENT_CATALOG_VERSION =
  "STRUCTURED_ABUSE_EVENT_CATALOG_V2" as const;

export const STRUCTURED_ABUSE_EVENT_TYPES_V1 = Object.freeze([
  "intake.accepted", "intake.rejected", "payload.invalid",
  "rateLimit.allowed", "rateLimit.denied",
  "idempotency.replay", "idempotency.expired",
  "capability.accepted", "capability.rejected",
  "completion.started", "completion.completed", "completion.replayed",
  "report.generated", "report.denied",
  "notification.emitted", "notification.skipped",
  "download.authorized", "download.denied",
] as const);

export const STRUCTURED_ABUSE_CONTAINMENT_EVENT_TYPES_V2 = Object.freeze([
  "containment.allowed",
  "containment.denied",
  "containment.policy_missing",
  "containment.policy_corrupted",
  "containment.policy_expired",
  "containment.selective_block",
  "containment.emergency_quota_exceeded",
  "containment.rollback_applied",
] as const);

export const STRUCTURED_ABUSE_EVENT_TYPES = Object.freeze([
  ...STRUCTURED_ABUSE_EVENT_TYPES_V1,
  ...STRUCTURED_ABUSE_CONTAINMENT_EVENT_TYPES_V2,
] as const);

export type StructuredAbuseEventType =
  (typeof STRUCTURED_ABUSE_EVENT_TYPES)[number];
export type StructuredAbuseSeverity = "INFO" | "WARN" | "ERROR" | "CRITICAL";
export type StructuredAbuseOutcome =
  | "ACCEPTED" | "REJECTED" | "ALLOWED" | "DENIED"
  | "COMPLETED" | "REPLAYED" | "EXPIRED" | "EMITTED" | "SKIPPED";
export type StructuredAbuseEnvironment =
  "DEVELOPMENT" | "TEST" | "STAGING" | "PRODUCTION";

export const STRUCTURED_ABUSE_METRIC_KEYS = Object.freeze([
  "requests", "rejections", "retries", "replays",
  "aiAttempts", "aiInputBytes", "aiOutputTokens",
  "pdfs", "pdfBytes", "downloads", "notifications",
] as const);

export type StructuredAbuseMetricKey =
  (typeof STRUCTURED_ABUSE_METRIC_KEYS)[number];

export interface StructuredAbuseSubjectV1 {
  readonly scheme: "HMAC_SHA256_V1" | "DERIVED_SHA256_V1";
  readonly hash: string;
}

export type StructuredAbuseMeasurementsV1 = Readonly<
  Partial<Record<StructuredAbuseMetricKey, number>>
>;

export interface StructuredAbuseTelemetryEventV1 {
  readonly version: typeof STRUCTURED_ABUSE_TELEMETRY_VERSION;
  readonly eventCatalogVersion: typeof STRUCTURED_ABUSE_EVENT_CATALOG_VERSION;
  readonly eventId: string;
  readonly correlationId: string;
  readonly requestId: string;
  readonly timestamp: number;
  readonly eventType: StructuredAbuseEventType;
  readonly severity: StructuredAbuseSeverity;
  readonly source: string;
  readonly outcome: StructuredAbuseOutcome;
  readonly reasonCode: string;
  readonly durationMs: number;
  readonly environment: StructuredAbuseEnvironment;
  readonly component: string;
  readonly subject?: StructuredAbuseSubjectV1;
  readonly measurements: StructuredAbuseMeasurementsV1;
  readonly expiresAt: number;
}

export interface StructuredAbuseTelemetryCommandV1 {
  readonly eventType: StructuredAbuseEventType;
  readonly severity?: StructuredAbuseSeverity;
  readonly source: string;
  readonly outcome: StructuredAbuseOutcome;
  readonly reasonCode: string;
  readonly durationMs: number;
  readonly environment: StructuredAbuseEnvironment;
  readonly component: string;
  readonly correlationKey: string;
  readonly requestKey: string;
  readonly subject?: StructuredAbuseSubjectV1;
  readonly measurements?: StructuredAbuseMeasurementsV1;
  readonly timestamp?: number;
}

export interface StructuredAbuseMetricAggregateV1 {
  readonly version: typeof STRUCTURED_ABUSE_TELEMETRY_VERSION;
  readonly date: string;
  readonly scope: string;
  readonly eventCount: number;
  readonly rejectionCount: number;
  readonly replayCount: number;
  readonly retryCount: number;
  readonly durationCount: number;
  readonly durationTotalMs: number;
  readonly durationMaxMs: number;
  readonly measurements: Record<StructuredAbuseMetricKey, number>;
  readonly cardinalityBuckets: boolean[];
  readonly createdAt: number;
  readonly updatedAt: number;
}
