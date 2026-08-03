export const RATE_LIMIT_POLICY_SCHEMA_VERSION =
  "RATE_LIMIT_POLICY_V1" as const;
export const RATE_LIMIT_DECISION_SCHEMA_VERSION =
  "RATE_LIMIT_DECISION_V1" as const;
export const RATE_LIMIT_COUNTER_COMMAND_SCHEMA_VERSION =
  "RATE_LIMIT_COUNTER_COMMAND_V1" as const;

export const RATE_LIMIT_DIMENSIONS = Object.freeze([
  "APP_ID",
  "EMAIL_HASH",
  "IP_HASH",
  "COMMERCIAL_CODE_HASH",
  "SESSION_HASH",
  "LINK_HASH",
  "GLOBAL",
  "CUSTOM",
] as const);

export type RateLimitDimension =
  (typeof RATE_LIMIT_DIMENSIONS)[number];

export type RateLimitKeyScheme =
  | "HMAC_SHA256_V1"
  | "OPAQUE_V1";

export interface RateLimitKeyV1 {
  readonly scheme: RateLimitKeyScheme;
  readonly version: string;
  readonly value: string;
}

export interface RateLimitPolicyV1 {
  readonly schemaVersion: typeof RATE_LIMIT_POLICY_SCHEMA_VERSION;
  readonly version: string;
  readonly dimension: RateLimitDimension;
  readonly windowSeconds: number;
  readonly maxRequests: number;
  readonly burst: number;
  readonly enabled: boolean;
  readonly environment: string;
  readonly reason: string;
  readonly owner: string;
}

export type RateLimitMetadataValue = string | number | boolean;
export type RateLimitMetadataV1 = Readonly<
  Record<string, RateLimitMetadataValue>
>;

export interface RateLimitEvaluationRequestV1 {
  readonly dimension: RateLimitDimension;
  readonly environment: string;
  readonly key: RateLimitKeyV1;
  readonly metadata?: RateLimitMetadataV1;
}

export interface RateLimitCounterCommandV1 {
  readonly schemaVersion:
    typeof RATE_LIMIT_COUNTER_COMMAND_SCHEMA_VERSION;
  readonly dimension: RateLimitDimension;
  readonly environment: string;
  readonly key: RateLimitKeyV1;
  readonly keyFingerprint: string;
  readonly policyVersion: string;
  readonly bucket: string;
  readonly windowStartedAtMs: number;
  readonly windowEndsAtMs: number;
  readonly evaluatedAtMs: number;
  readonly windowSeconds: number;
  readonly maxRequests: number;
  readonly burst: number;
  readonly effectiveLimit: number;
}

export interface RateLimitRepositoryResultV1 {
  readonly allowed: boolean;
  readonly currentCount: number;
  readonly remaining: number;
}

export type RateLimitDecisionCode =
  | "RATE_LIMIT_ALLOWED"
  | "RATE_LIMIT_EXCEEDED"
  | "POLICY_DISABLED";

export interface RateLimitDecisionV1 {
  readonly schemaVersion: typeof RATE_LIMIT_DECISION_SCHEMA_VERSION;
  readonly decision: "ALLOW" | "DENY";
  readonly code: RateLimitDecisionCode;
  readonly dimension: RateLimitDimension;
  readonly key: Readonly<{
    scheme: RateLimitKeyScheme;
    version: string;
    fingerprint: string;
  }>;
  readonly bucket: string;
  readonly quota: Readonly<{
    maxRequests: number;
    burst: number;
    effectiveLimit: number;
  }>;
  readonly window: Readonly<{
    seconds: number;
    startedAtMs: number;
    endsAtMs: number;
  }>;
  readonly remaining: number;
  readonly retryAfterSeconds: number;
  readonly policy: Readonly<{
    version: string;
    environment: string;
    reason: string;
    owner: string;
  }>;
  readonly metadata: RateLimitMetadataV1;
}
