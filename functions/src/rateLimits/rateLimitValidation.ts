import { RateLimitError } from "./rateLimitErrors";
import {
  RATE_LIMIT_COUNTER_COMMAND_SCHEMA_VERSION,
  RATE_LIMIT_DIMENSIONS,
  RATE_LIMIT_POLICY_SCHEMA_VERSION,
  type RateLimitCounterCommandV1,
  type RateLimitDimension,
  type RateLimitEvaluationRequestV1,
  type RateLimitKeyV1,
  type RateLimitMetadataV1,
  type RateLimitPolicyV1,
  type RateLimitRepositoryResultV1,
} from "./rateLimitTypes";

const MINIMUM_WINDOW_SECONDS = 1;
const MAXIMUM_WINDOW_SECONDS = 86_400;
const MAXIMUM_REQUESTS_PER_WINDOW = 1_000_000;
const MAXIMUM_BURST = 1_000_000;
const MAXIMUM_METADATA_ENTRIES = 16;
const MAXIMUM_METADATA_STRING_LENGTH = 128;
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;
const ENVIRONMENT_PATTERN = /^[a-z][a-z0-9_-]{0,31}$/;
const METADATA_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_.:-]{0,63}$/;
const HMAC_VALUE_PATTERN = /^[a-f0-9]{64}$/;
const OPAQUE_VALUE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SENSITIVE_DIMENSIONS = new Set<RateLimitDimension>([
  "EMAIL_HASH",
  "IP_HASH",
  "COMMERCIAL_CODE_HASH",
  "SESSION_HASH",
  "LINK_HASH",
]);

function configurationError(message: string): never {
  throw new RateLimitError("CONFIGURATION_ERROR", message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isDimension(value: unknown): value is RateLimitDimension {
  return (
    typeof value === "string" &&
    (RATE_LIMIT_DIMENSIONS as readonly string[]).includes(value)
  );
}

function assertIntegerInRange(
  value: unknown,
  minimum: number,
  maximum: number,
  field: string,
): asserts value is number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < minimum ||
    value > maximum
  ) {
    configurationError(`Rate-limit ${field} is invalid.`);
  }
}

export function validateRateLimitKeyV1(
  value: unknown,
  dimension: RateLimitDimension,
): RateLimitKeyV1 {
  if (!isRecord(value)) {
    configurationError("Rate-limit key is invalid.");
  }
  const scheme = value.scheme;
  const version = value.version;
  const keyValue = value.value;
  if (
    (scheme !== "HMAC_SHA256_V1" && scheme !== "OPAQUE_V1") ||
    typeof version !== "string" ||
    !IDENTIFIER_PATTERN.test(version) ||
    typeof keyValue !== "string"
  ) {
    configurationError("Rate-limit key contract is invalid.");
  }
  if (
    scheme === "HMAC_SHA256_V1" &&
    !HMAC_VALUE_PATTERN.test(keyValue)
  ) {
    configurationError("Rate-limit HMAC key is invalid.");
  }
  if (
    scheme === "OPAQUE_V1" &&
    !OPAQUE_VALUE_PATTERN.test(keyValue)
  ) {
    configurationError("Rate-limit opaque key is invalid.");
  }
  if (
    SENSITIVE_DIMENSIONS.has(dimension) &&
    scheme !== "HMAC_SHA256_V1"
  ) {
    configurationError(
      "Sensitive rate-limit dimensions require an HMAC key.",
    );
  }
  if (
    dimension === "GLOBAL" &&
    (scheme !== "OPAQUE_V1" || keyValue !== "global")
  ) {
    configurationError(
      "The GLOBAL rate-limit dimension requires the canonical global key.",
    );
  }
  return Object.freeze({ scheme, version, value: keyValue });
}

export function validateRateLimitMetadataV1(
  value: unknown,
): RateLimitMetadataV1 {
  if (value === undefined) return Object.freeze({});
  if (!isRecord(value)) {
    configurationError("Rate-limit metadata is invalid.");
  }
  const entries = Object.entries(value);
  if (entries.length > MAXIMUM_METADATA_ENTRIES) {
    configurationError("Rate-limit metadata has too many entries.");
  }
  const validated: Record<string, string | number | boolean> = {};
  for (const [key, entryValue] of entries) {
    if (!METADATA_KEY_PATTERN.test(key)) {
      configurationError("Rate-limit metadata key is invalid.");
    }
    if (
      typeof entryValue === "string" &&
      entryValue.length <= MAXIMUM_METADATA_STRING_LENGTH
    ) {
      validated[key] = entryValue;
      continue;
    }
    if (
      typeof entryValue === "number" &&
      Number.isFinite(entryValue)
    ) {
      validated[key] = entryValue;
      continue;
    }
    if (typeof entryValue === "boolean") {
      validated[key] = entryValue;
      continue;
    }
    configurationError("Rate-limit metadata value is invalid.");
  }
  return Object.freeze(validated);
}

export function validateRateLimitPolicyV1(
  value: unknown,
): RateLimitPolicyV1 {
  if (!isRecord(value)) {
    configurationError("Rate-limit policy is invalid.");
  }
  if (
    value.schemaVersion !== RATE_LIMIT_POLICY_SCHEMA_VERSION ||
    typeof value.version !== "string" ||
    !IDENTIFIER_PATTERN.test(value.version) ||
    !isDimension(value.dimension) ||
    typeof value.enabled !== "boolean" ||
    typeof value.environment !== "string" ||
    !ENVIRONMENT_PATTERN.test(value.environment) ||
    typeof value.reason !== "string" ||
    value.reason.length === 0 ||
    value.reason.length > 128 ||
    typeof value.owner !== "string" ||
    value.owner.length === 0 ||
    value.owner.length > 128
  ) {
    configurationError("Rate-limit policy contract is invalid.");
  }
  assertIntegerInRange(
    value.windowSeconds,
    MINIMUM_WINDOW_SECONDS,
    MAXIMUM_WINDOW_SECONDS,
    "windowSeconds",
  );
  assertIntegerInRange(
    value.maxRequests,
    1,
    MAXIMUM_REQUESTS_PER_WINDOW,
    "maxRequests",
  );
  assertIntegerInRange(
    value.burst,
    0,
    MAXIMUM_BURST,
    "burst",
  );
  if (!Number.isSafeInteger(value.maxRequests + value.burst)) {
    configurationError("Rate-limit effective quota is invalid.");
  }
  return Object.freeze({
    schemaVersion: RATE_LIMIT_POLICY_SCHEMA_VERSION,
    version: value.version,
    dimension: value.dimension,
    windowSeconds: value.windowSeconds,
    maxRequests: value.maxRequests,
    burst: value.burst,
    enabled: value.enabled,
    environment: value.environment,
    reason: value.reason,
    owner: value.owner,
  });
}

export function validateRateLimitEvaluationRequestV1(
  value: unknown,
): RateLimitEvaluationRequestV1 {
  if (
    !isRecord(value) ||
    !isDimension(value.dimension) ||
    typeof value.environment !== "string" ||
    !ENVIRONMENT_PATTERN.test(value.environment)
  ) {
    configurationError("Rate-limit evaluation request is invalid.");
  }
  return Object.freeze({
    dimension: value.dimension,
    environment: value.environment,
    key: validateRateLimitKeyV1(value.key, value.dimension),
    metadata: validateRateLimitMetadataV1(value.metadata),
  });
}

export function validateRateLimitCounterCommandV1(
  value: RateLimitCounterCommandV1,
): RateLimitCounterCommandV1 {
  if (
    value.schemaVersion !==
      RATE_LIMIT_COUNTER_COMMAND_SCHEMA_VERSION ||
    !isDimension(value.dimension) ||
    typeof value.environment !== "string" ||
    !ENVIRONMENT_PATTERN.test(value.environment) ||
    typeof value.keyFingerprint !== "string" ||
    !HMAC_VALUE_PATTERN.test(value.keyFingerprint) ||
    typeof value.policyVersion !== "string" ||
    !IDENTIFIER_PATTERN.test(value.policyVersion) ||
    typeof value.bucket !== "string" ||
    !IDENTIFIER_PATTERN.test(value.bucket)
  ) {
    configurationError("Rate-limit counter command is invalid.");
  }
  validateRateLimitKeyV1(value.key, value.dimension);
  assertIntegerInRange(
    value.windowSeconds,
    MINIMUM_WINDOW_SECONDS,
    MAXIMUM_WINDOW_SECONDS,
    "counter windowSeconds",
  );
  assertIntegerInRange(
    value.maxRequests,
    1,
    MAXIMUM_REQUESTS_PER_WINDOW,
    "counter maxRequests",
  );
  assertIntegerInRange(
    value.burst,
    0,
    MAXIMUM_BURST,
    "counter burst",
  );
  for (const [field, numberValue] of [
    ["windowStartedAtMs", value.windowStartedAtMs],
    ["windowEndsAtMs", value.windowEndsAtMs],
    ["evaluatedAtMs", value.evaluatedAtMs],
    ["effectiveLimit", value.effectiveLimit],
  ] as const) {
    if (
      !Number.isSafeInteger(numberValue) ||
      numberValue < 0
    ) {
      configurationError(`Rate-limit ${field} is invalid.`);
    }
  }
  if (
    value.effectiveLimit !== value.maxRequests + value.burst ||
    value.windowEndsAtMs <= value.windowStartedAtMs ||
    value.evaluatedAtMs < value.windowStartedAtMs ||
    value.evaluatedAtMs >= value.windowEndsAtMs
  ) {
    configurationError("Rate-limit counter boundaries are invalid.");
  }
  return value;
}

export function validateRateLimitRepositoryResultV1(
  value: unknown,
  effectiveLimit: number,
): RateLimitRepositoryResultV1 {
  if (
    !isRecord(value) ||
    typeof value.allowed !== "boolean" ||
    !Number.isSafeInteger(value.currentCount) ||
    !Number.isSafeInteger(value.remaining) ||
    (value.currentCount as number) < 0 ||
    (value.currentCount as number) > effectiveLimit ||
    value.remaining !== effectiveLimit - (value.currentCount as number) ||
    (value.allowed === false && value.remaining !== 0)
  ) {
    throw new RateLimitError(
      "COUNTER_CORRUPTED",
      "Rate-limit repository result is corrupted.",
    );
  }
  return Object.freeze({
    allowed: value.allowed,
    currentCount: value.currentCount as number,
    remaining: value.remaining as number,
  });
}
