import { createHash, createHmac } from "crypto";
import {
  STRUCTURED_ABUSE_EVENT_TYPES,
  STRUCTURED_ABUSE_METRIC_KEYS,
  STRUCTURED_ABUSE_TELEMETRY_VERSION,
  type StructuredAbuseSubjectV1,
  type StructuredAbuseTelemetryEventV1,
} from "./structuredAbuseTelemetryTypes";

const ID = /^[a-z0-9][a-z0-9_-]{7,127}$/;
const LABEL = /^[A-Za-z][A-Za-z0-9_.-]{1,79}$/;
const REASON = /^[A-Z][A-Z0-9_]{1,95}$/;
const HEX_64 = /^[a-f0-9]{64}$/;
const FORBIDDEN_KEYS = new Set([
  "email", "phone", "telephone", "token", "capability", "signedUrl",
  "downloadUrl", "prompt", "response", "geminiPrompt", "geminiResponse",
  "companyName", "contactName", "prospectName", "rawPayload", "payload",
]);

export class StructuredAbuseTelemetryError extends Error {
  constructor(readonly code: "TELEMETRY_INVALID" | "TELEMETRY_REDACTION_FAILED") {
    super(code);
    this.name = "StructuredAbuseTelemetryError";
  }
}

export function deriveTelemetrySubjectHashV1(
  value: string,
  secret: string,
): StructuredAbuseSubjectV1 {
  if (!value || !secret) throw new StructuredAbuseTelemetryError("TELEMETRY_INVALID");
  return Object.freeze({
    scheme: "HMAC_SHA256_V1",
    hash: createHmac("sha256", secret).update(value).digest("hex"),
  });
}

export function deriveTelemetryDerivedSubjectV1(value: string): StructuredAbuseSubjectV1 {
  if (!value) throw new StructuredAbuseTelemetryError("TELEMETRY_INVALID");
  return Object.freeze({
    scheme: "DERIVED_SHA256_V1",
    hash: createHash("sha256").update(value).digest("hex"),
  });
}

export function normalizeTelemetryReasonCodeV1(error: unknown): string {
  const code = error && typeof error === "object" && "code" in error
    ? (error as { code?: unknown }).code : undefined;
  if (typeof code === "string" && /^[A-Za-z][A-Za-z0-9_-]{1,95}$/.test(code)) {
    return code.toUpperCase().replace(/-/g, "_");
  }
  const message = error instanceof Error ? error.message : "";
  return REASON.test(message) ? message : "INTERNAL_FAILURE";
}

export function deriveTelemetryIdentifierV1(
  prefix: "evt" | "corr" | "req" | "metric",
  value: string,
): string {
  if (!value) throw new StructuredAbuseTelemetryError("TELEMETRY_INVALID");
  return `${prefix}_${createHash("sha256").update(value).digest("hex").slice(0, 48)}`;
}

function validateNoForbiddenKeys(value: unknown): void {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_KEYS.has(key)) {
      throw new StructuredAbuseTelemetryError("TELEMETRY_REDACTION_FAILED");
    }
    validateNoForbiddenKeys(child);
  }
}

export function validateStructuredAbuseTelemetryEventV1(
  value: StructuredAbuseTelemetryEventV1,
): StructuredAbuseTelemetryEventV1 {
  validateNoForbiddenKeys(value);
  if (
    value.version !== STRUCTURED_ABUSE_TELEMETRY_VERSION ||
    !ID.test(value.eventId) || !ID.test(value.correlationId) ||
    !ID.test(value.requestId) || !Number.isSafeInteger(value.timestamp) ||
    value.timestamp < 0 || !STRUCTURED_ABUSE_EVENT_TYPES.includes(value.eventType) ||
    !["INFO", "WARN", "ERROR", "CRITICAL"].includes(value.severity) ||
    !LABEL.test(value.source) || !LABEL.test(value.component) ||
    !["ACCEPTED", "REJECTED", "ALLOWED", "DENIED", "COMPLETED", "REPLAYED", "EXPIRED", "EMITTED", "SKIPPED"].includes(value.outcome) ||
    !REASON.test(value.reasonCode) || !Number.isSafeInteger(value.durationMs) ||
    value.durationMs < 0 || value.durationMs > 3_600_000 ||
    !["DEVELOPMENT", "TEST", "STAGING", "PRODUCTION"].includes(value.environment) ||
    !Number.isSafeInteger(value.expiresAt) || value.expiresAt <= value.timestamp
  ) throw new StructuredAbuseTelemetryError("TELEMETRY_INVALID");
  if (value.subject && (
    !["HMAC_SHA256_V1", "DERIVED_SHA256_V1"].includes(value.subject.scheme) ||
    !HEX_64.test(value.subject.hash)
  )) throw new StructuredAbuseTelemetryError("TELEMETRY_INVALID");
  for (const [key, measurement] of Object.entries(value.measurements)) {
    if (!STRUCTURED_ABUSE_METRIC_KEYS.includes(key as never) ||
        !Number.isSafeInteger(measurement) || measurement < 0 ||
        measurement > 1_000_000_000) {
      throw new StructuredAbuseTelemetryError("TELEMETRY_INVALID");
    }
  }
  return Object.freeze(value);
}

export function serializeStructuredAbuseTelemetryEventV1(
  event: StructuredAbuseTelemetryEventV1,
): Record<string, unknown> {
  const valid = validateStructuredAbuseTelemetryEventV1(event);
  return {
    version: valid.version, eventId: valid.eventId,
    correlationId: valid.correlationId, requestId: valid.requestId,
    timestamp: valid.timestamp, eventType: valid.eventType,
    severity: valid.severity, source: valid.source, outcome: valid.outcome,
    reasonCode: valid.reasonCode, durationMs: valid.durationMs,
    environment: valid.environment, component: valid.component,
    ...(valid.subject ? { subject: { ...valid.subject } } : {}),
    measurements: { ...valid.measurements }, expiresAt: valid.expiresAt,
  };
}
