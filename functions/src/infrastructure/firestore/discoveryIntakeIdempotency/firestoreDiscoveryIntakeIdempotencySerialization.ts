import { Timestamp } from "firebase-admin/firestore";

import type {
  DiscoveryIntakeIdempotencyRecordV1,
} from "../../../discovery/idempotency";

const TIMESTAMP_FIELDS = Object.freeze([
  "leaseExpiresAt",
  "expiresAt",
  "createdAt",
  "updatedAt",
  "completedAt",
  "failedAt",
] as const);

export function serializeDiscoveryIntakeIdempotencyRecordV1(
  record: DiscoveryIntakeIdempotencyRecordV1,
): Readonly<Record<string, unknown>> {
  const serialized: Record<string, unknown> = { ...record };
  for (const field of TIMESTAMP_FIELDS) {
    const value = record[field];
    serialized[field] = value === null
      ? null
      : Timestamp.fromMillis(value);
  }
  return Object.freeze(serialized);
}

function timestampToMilliseconds(value: unknown): unknown {
  if (value instanceof Timestamp) return value.toMillis();
  if (
    typeof value === "object" && value !== null &&
    "toMillis" in value && typeof value.toMillis === "function"
  ) {
    return (value.toMillis as () => number)();
  }
  return value;
}

export function deserializeDiscoveryIntakeIdempotencyRecordV1(
  value: unknown,
): unknown {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return value;
  }
  const deserialized: Record<string, unknown> = {
    ...(value as Record<string, unknown>),
  };
  for (const field of TIMESTAMP_FIELDS) {
    deserialized[field] = timestampToMilliseconds(deserialized[field]);
  }
  return deserialized;
}
