import { DiscoveryCapabilityError } from "./discoveryCapabilityErrors";
import {
  DISCOVERY_CAPABILITY_ERROR_CODES,
  DISCOVERY_CAPABILITY_VERSION,
  type DiscoveryCapabilityErrorCode,
  type DiscoveryCapabilityPurpose,
  type DiscoveryCapabilityType,
  type DiscoveryCapabilityV1,
} from "./discoveryCapabilityTypes";

const HASH = /^[a-f0-9]{64}$/;

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isTime(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

export function parseDiscoveryCapabilityV1(value: unknown): DiscoveryCapabilityV1 {
  if (!isObject(value)) {
    throw new DiscoveryCapabilityError("CAPABILITY_NOT_FOUND", "Capability unavailable.");
  }
  const valid =
    value.version === DISCOVERY_CAPABILITY_VERSION &&
    ["EXCHANGE", "SESSION", "REPORT"].includes(String(value.type)) &&
    typeof value.subjectId === "string" && value.subjectId.length > 0 &&
    typeof value.linkId === "string" && value.linkId.length > 0 &&
    (value.sessionId === null || typeof value.sessionId === "string") &&
    value.audience === "PUBLIC_DISCOVERY" &&
    ["DISCOVERY_TOKEN_EXCHANGE", "DISCOVERY_SESSION", "DISCOVERY_REPORT"]
      .includes(String(value.purpose)) &&
    Number.isSafeInteger(value.generation) && (value.generation as number) > 0 &&
    typeof value.tokenHash === "string" && HASH.test(value.tokenHash) &&
    isTime(value.issuedAt) && isTime(value.expiresAt) &&
    (value.consumedAt === null || isTime(value.consumedAt)) &&
    (value.completedAt === null || isTime(value.completedAt)) &&
    (value.revokedAt === null || isTime(value.revokedAt)) &&
    (value.revocationReason === null || typeof value.revocationReason === "string") &&
    isTime(value.createdAt) && isTime(value.updatedAt) &&
    (value.issuedAt as number) <= (value.updatedAt as number) &&
    (value.issuedAt as number) < (value.expiresAt as number);
  if (!valid) {
    throw new DiscoveryCapabilityError("COMPLETION_INTERNAL_FAILURE", "Capability is corrupt.");
  }
  return value as unknown as DiscoveryCapabilityV1;
}

export function authorizeDiscoveryCapabilityV1(
  value: unknown,
  input: Readonly<{
    now: number;
    tokenHash: string;
    type: DiscoveryCapabilityType;
    purpose: DiscoveryCapabilityPurpose;
    linkId?: string;
    sessionId?: string;
    subjectId?: string;
    generation?: number;
    allowCompletedSession?: boolean;
  }>,
): DiscoveryCapabilityV1 {
  const capability = parseDiscoveryCapabilityV1(value);
  if (capability.tokenHash !== input.tokenHash) {
    throw new DiscoveryCapabilityError("CAPABILITY_NOT_FOUND", "Capability unavailable.");
  }
  if (capability.type !== input.type || capability.purpose !== input.purpose) {
    throw new DiscoveryCapabilityError(
      input.type === "REPORT" ? "REPORT_CAPABILITY_REQUIRED" : "CAPABILITY_TYPE_MISMATCH",
      "Capability scope mismatch.",
    );
  }
  if (capability.expiresAt <= input.now) {
    throw new DiscoveryCapabilityError("CAPABILITY_EXPIRED", "Capability expired.");
  }
  if (capability.revokedAt !== null) {
    throw new DiscoveryCapabilityError("CAPABILITY_REVOKED", "Capability revoked.");
  }
  if (input.generation !== undefined && capability.generation !== input.generation) {
    throw new DiscoveryCapabilityError("CAPABILITY_GENERATION_MISMATCH", "Generation mismatch.");
  }
  if (
    (input.linkId !== undefined && capability.linkId !== input.linkId) ||
    (input.sessionId !== undefined && capability.sessionId !== input.sessionId) ||
    (input.subjectId !== undefined && capability.subjectId !== input.subjectId)
  ) {
    throw new DiscoveryCapabilityError("CAPABILITY_BINDING_MISMATCH", "Binding mismatch.");
  }
  if (capability.type === "EXCHANGE" && capability.consumedAt !== null) {
    throw new DiscoveryCapabilityError("CAPABILITY_ALREADY_CONSUMED", "Capability consumed.");
  }
  if (
    capability.type === "SESSION" && capability.completedAt !== null &&
    input.allowCompletedSession !== true
  ) {
    throw new DiscoveryCapabilityError("SESSION_ALREADY_COMPLETED", "Session completed.");
  }
  return capability;
}

export function isDiscoveryCapabilityErrorCode(
  value: unknown,
): value is DiscoveryCapabilityErrorCode {
  return typeof value === "string" &&
    (DISCOVERY_CAPABILITY_ERROR_CODES as readonly string[]).includes(value);
}
