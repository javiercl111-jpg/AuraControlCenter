import { createHash } from "node:crypto";

import {
  DISCOVERY_INTAKE_IDEMPOTENCY_POLICY_V1,
  type DiscoveryIntakeIdempotencyClock,
  type DiscoveryIntakeIdempotencyPolicyV1,
  type DiscoveryIntakeIdempotencyResultV1,
} from "../../../src/discovery/idempotency";

export const TEST_NOW_MS = 1_800_000_000_000;
export const TEST_SECRET = "emulator-only-idempotency-secret-value";

export class MutableIdempotencyClock
implements DiscoveryIntakeIdempotencyClock {
  constructor(public nowMs = TEST_NOW_MS) {}
  nowEpochMilliseconds(): number {
    return this.nowMs;
  }
}

export function hash(label: string): string {
  return createHash("sha256").update(label).digest("hex");
}

export function policy(
  overrides: Partial<DiscoveryIntakeIdempotencyPolicyV1> = {},
): DiscoveryIntakeIdempotencyPolicyV1 {
  return Object.freeze({
    ...DISCOVERY_INTAKE_IDEMPOTENCY_POLICY_V1,
    ...overrides,
  });
}

export function result(
  overrides: Partial<DiscoveryIntakeIdempotencyResultV1> = {},
): DiscoveryIntakeIdempotencyResultV1 {
  return Object.freeze({
    linkId: "link-document-000001",
    capabilityGenerationId: hash("attempt-1"),
    advisorDisplayName: null,
    organizationProfile: "UNKNOWN",
    requiresManualReview: false,
    ...overrides,
  });
}
