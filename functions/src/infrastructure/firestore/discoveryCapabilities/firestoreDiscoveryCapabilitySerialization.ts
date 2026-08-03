import { Timestamp } from "firebase-admin/firestore";
import type {
  DiscoveryCapabilityV1,
  DiscoveryCompletionRecordV1,
} from "../../../discovery/capabilities";

const CAPABILITY_TIMES = [
  "issuedAt", "expiresAt", "consumedAt", "completedAt", "revokedAt",
  "createdAt", "updatedAt",
] as const;

export function serializeDiscoveryCapabilityV1(
  record: DiscoveryCapabilityV1,
): Record<string, unknown> {
  const data: Record<string, unknown> = { ...record };
  for (const field of CAPABILITY_TIMES) {
    data[field] = record[field] === null
      ? null
      : Timestamp.fromMillis(record[field] as number);
  }
  return data;
}

function millis(value: unknown): unknown {
  if (value instanceof Timestamp) return value.toMillis();
  if (value && typeof value === "object" && "toMillis" in value &&
      typeof value.toMillis === "function") {
    return (value.toMillis as () => number)();
  }
  return value;
}

export function deserializeDiscoveryCapabilityV1(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const data = { ...(value as Record<string, unknown>) };
  for (const field of CAPABILITY_TIMES) data[field] = millis(data[field]);
  return data;
}

export function serializeDiscoveryCompletionV1(
  record: DiscoveryCompletionRecordV1,
): Record<string, unknown> {
  return {
    ...record,
    createdAt: Timestamp.fromMillis(record.createdAt),
    completedAt: Timestamp.fromMillis(record.completedAt),
  };
}

export function deserializeDiscoveryCompletionV1(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const data = { ...(value as Record<string, unknown>) };
  data.createdAt = millis(data.createdAt);
  data.completedAt = millis(data.completedAt);
  return data;
}
