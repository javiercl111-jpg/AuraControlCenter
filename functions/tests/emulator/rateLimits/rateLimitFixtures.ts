import type { RateLimitClock } from "../../../src/rateLimits/rateLimitPorts";
import {
  RATE_LIMIT_POLICY_SCHEMA_VERSION,
  type RateLimitDimension,
  type RateLimitEvaluationRequestV1,
  type RateLimitKeyV1,
  type RateLimitPolicyV1,
} from "../../../src/rateLimits/rateLimitTypes";
import {
  deriveRateLimitHmacKeyV1,
} from "../../../src/rateLimits/rateLimitKeys";

export const TEST_ENVIRONMENT = "emulator";
export const TEST_POLICY_VERSION = "rate-limit-test-v1";
export const TEST_KEY_VERSION = "emulator-key-v1";
export const TEST_WINDOW_SECONDS = 60;
export const TEST_NOW_MS = 120_250;
export const TEST_HMAC_SECRET = new Uint8Array(32).fill(7);

export class MutableRateLimitClock implements RateLimitClock {
  nowMs: number;

  constructor(nowMs = TEST_NOW_MS) {
    this.nowMs = nowMs;
  }

  nowEpochMilliseconds(): number {
    return this.nowMs;
  }
}

export function policy(
  overrides: Partial<RateLimitPolicyV1> = {},
): RateLimitPolicyV1 {
  return Object.freeze({
    schemaVersion: RATE_LIMIT_POLICY_SCHEMA_VERSION,
    version: TEST_POLICY_VERSION,
    dimension: "IP_HASH",
    windowSeconds: TEST_WINDOW_SECONDS,
    maxRequests: 10,
    burst: 0,
    enabled: true,
    environment: TEST_ENVIRONMENT,
    reason: "Emulator certification fixture.",
    owner: "Security Engineering",
    ...overrides,
  });
}

export function hmacKey(
  dimension: RateLimitDimension = "IP_HASH",
  canonicalValue = "synthetic-subject-a",
): RateLimitKeyV1 {
  return deriveRateLimitHmacKeyV1({
    dimension,
    canonicalValue,
    secret: TEST_HMAC_SECRET,
    keyVersion: TEST_KEY_VERSION,
  });
}

export function request(
  dimension: RateLimitDimension = "IP_HASH",
  key: RateLimitKeyV1 = hmacKey(dimension),
): RateLimitEvaluationRequestV1 {
  return Object.freeze({
    dimension,
    environment: TEST_ENVIRONMENT,
    key,
    metadata: Object.freeze({ fixture: "emulator" }),
  });
}
