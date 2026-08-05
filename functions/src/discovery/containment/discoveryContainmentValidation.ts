import { createHmac } from "node:crypto";
import { DiscoveryContainmentError } from "./discoveryContainmentErrors";
import {
  DISCOVERY_CONTAINMENT_AUDIT_SCHEMA_VERSION,
  DISCOVERY_CONTAINMENT_POLICY_SCHEMA_VERSION,
  DISCOVERY_CONTAINMENT_SURFACES,
  DISCOVERY_EMERGENCY_QUOTA_OPERATIONS,
  type DiscoveryContainmentAuditRecordV1,
  type DiscoveryContainmentEvaluationRequestV1,
  type DiscoveryContainmentPolicyV1,
  type DiscoveryEmergencyGlobalQuotaV1,
} from "./discoveryContainmentTypes";

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;
const ROLE = /^[A-Z][A-Z0-9_]{1,63}$/;
const REASON = /^[A-Z][A-Z0-9_]{1,95}$/;
const APP_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/;
const HASH = /^[a-f0-9]{64}$/;
const ENVIRONMENTS = ["LOCAL_DEMO", "PREVIEW", "STAGING", "PRODUCTION"];
const STATUSES = ["ACTIVE", "EXPIRED", "REVOKED", "INVALID"];
const MAX_BLOCKED_SUBJECTS = 100;
const MIN_SECRET_BYTES = 32;

function corrupted(message: string): never {
  throw new DiscoveryContainmentError("CONTAINMENT_POLICY_CORRUPTED", message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validInteger(
  value: unknown,
  minimum = 0,
  maximum = Number.MAX_SAFE_INTEGER,
): value is number {
  return Number.isSafeInteger(value) &&
    (value as number) >= minimum && (value as number) <= maximum;
}

function readBoundedUniqueList(
  value: unknown,
  pattern: RegExp,
  field: string,
): readonly string[] {
  if (!Array.isArray(value) || value.length > MAX_BLOCKED_SUBJECTS ||
      value.some((entry) => typeof entry !== "string" || !pattern.test(entry)) ||
      new Set(value).size !== value.length) {
    corrupted(`Containment ${field} is invalid.`);
  }
  return Object.freeze([...value].sort());
}

function validateEmergencyQuota(value: unknown): DiscoveryEmergencyGlobalQuotaV1 {
  if (!isRecord(value) ||
      Object.keys(value).length !== DISCOVERY_EMERGENCY_QUOTA_OPERATIONS.length) {
    corrupted("Containment emergency quota is invalid.");
  }
  const output: Record<string, unknown> = {};
  for (const operation of DISCOVERY_EMERGENCY_QUOTA_OPERATIONS) {
    const rule = value[operation];
    if (!isRecord(rule) || Object.keys(rule).some((key) =>
      !["enabled", "windowSeconds", "maxRequests", "burst"].includes(key)) ||
      typeof rule.enabled !== "boolean" ||
      !validInteger(rule.windowSeconds, 1, 86_400) ||
      !validInteger(rule.maxRequests, 1, 1_000_000) ||
      !validInteger(rule.burst, 0, 1_000_000) ||
      !Number.isSafeInteger(rule.maxRequests + rule.burst)) {
      corrupted(`Containment emergency quota ${operation} is invalid.`);
    }
    output[operation] = Object.freeze({
      enabled: rule.enabled,
      windowSeconds: rule.windowSeconds,
      maxRequests: rule.maxRequests,
      burst: rule.burst,
    });
  }
  return Object.freeze(output) as DiscoveryEmergencyGlobalQuotaV1;
}

export function validateDiscoveryContainmentPolicyV1(
  value: unknown,
): DiscoveryContainmentPolicyV1 {
  if (!isRecord(value) || value.version !== DISCOVERY_CONTAINMENT_POLICY_SCHEMA_VERSION ||
      typeof value.policyVersion !== "string" || !IDENTIFIER.test(value.policyVersion) ||
      typeof value.environment !== "string" || !ENVIRONMENTS.includes(value.environment) ||
      typeof value.reason !== "string" || !REASON.test(value.reason) ||
      typeof value.ownerRole !== "string" || !ROLE.test(value.ownerRole) ||
      typeof value.approvedByRole !== "string" || !ROLE.test(value.approvedByRole) ||
      !validInteger(value.createdAt) || !validInteger(value.updatedAt) ||
      !validInteger(value.expiresAt, 1) || value.updatedAt < value.createdAt ||
      value.expiresAt <= value.updatedAt ||
      typeof value.status !== "string" || !STATUSES.includes(value.status) ||
      (value.rollbackVersion !== null &&
        (typeof value.rollbackVersion !== "string" || !IDENTIFIER.test(value.rollbackVersion))) ||
      value.rollbackVersion === value.policyVersion) {
    corrupted("Containment policy contract is invalid.");
  }
  const switches = [
    "publicIntakeEnabled", "advisorCodeResolutionEnabled", "tokenIssuanceEnabled",
    "sessionResolutionEnabled", "sessionCompletionEnabled", "conversationAiEnabled",
    "externalReportGenerationEnabled", "documentDownloadEnabled",
    "notificationFanoutEnabled",
  ] as const;
  if (switches.some((field) => typeof value[field] !== "boolean")) {
    corrupted("Containment switch contract is invalid.");
  }
  return Object.freeze({
    version: DISCOVERY_CONTAINMENT_POLICY_SCHEMA_VERSION,
    policyVersion: value.policyVersion,
    environment: value.environment as DiscoveryContainmentPolicyV1["environment"],
    publicIntakeEnabled: value.publicIntakeEnabled as boolean,
    advisorCodeResolutionEnabled: value.advisorCodeResolutionEnabled as boolean,
    tokenIssuanceEnabled: value.tokenIssuanceEnabled as boolean,
    sessionResolutionEnabled: value.sessionResolutionEnabled as boolean,
    sessionCompletionEnabled: value.sessionCompletionEnabled as boolean,
    conversationAiEnabled: value.conversationAiEnabled as boolean,
    externalReportGenerationEnabled: value.externalReportGenerationEnabled as boolean,
    documentDownloadEnabled: value.documentDownloadEnabled as boolean,
    notificationFanoutEnabled: value.notificationFanoutEnabled as boolean,
    blockedAppIds: readBoundedUniqueList(value.blockedAppIds, APP_ID, "blockedAppIds"),
    blockedCommercialCodeHashes: readBoundedUniqueList(
      value.blockedCommercialCodeHashes, HASH, "blockedCommercialCodeHashes",
    ),
    emergencyGlobalQuota: validateEmergencyQuota(value.emergencyGlobalQuota),
    reason: value.reason,
    ownerRole: value.ownerRole,
    approvedByRole: value.approvedByRole,
    createdAt: value.createdAt as number,
    updatedAt: value.updatedAt as number,
    expiresAt: value.expiresAt as number,
    rollbackVersion: value.rollbackVersion as string | null,
    status: value.status as DiscoveryContainmentPolicyV1["status"],
  });
}

export function validateDiscoveryContainmentRequestV1(
  value: unknown,
): DiscoveryContainmentEvaluationRequestV1 {
  if (!isRecord(value) || typeof value.surface !== "string" ||
      !DISCOVERY_CONTAINMENT_SURFACES.includes(value.surface as never) ||
      typeof value.environment !== "string" || !ENVIRONMENTS.includes(value.environment) ||
      (value.appId !== undefined &&
        (typeof value.appId !== "string" || !APP_ID.test(value.appId))) ||
      (value.commercialCodeHash !== undefined &&
        (typeof value.commercialCodeHash !== "string" ||
          !HASH.test(value.commercialCodeHash)))) {
    throw new DiscoveryContainmentError(
      "CONTAINMENT_CONFIGURATION_ERROR", "Containment evaluation request is invalid.",
    );
  }
  return Object.freeze({
    surface: value.surface as DiscoveryContainmentEvaluationRequestV1["surface"],
    environment: value.environment as DiscoveryContainmentEvaluationRequestV1["environment"],
    ...(value.appId ? { appId: value.appId as string } : {}),
    ...(value.commercialCodeHash
      ? { commercialCodeHash: value.commercialCodeHash as string } : {}),
  });
}

export function deriveBlockedCommercialCodeHashV1(
  code: string,
  secret: string,
): string {
  const normalized = code.trim().toUpperCase();
  if (!/^[A-Z0-9_-]{2,64}$/.test(normalized) ||
      Buffer.byteLength(secret, "utf8") < MIN_SECRET_BYTES) {
    throw new DiscoveryContainmentError(
      "CONTAINMENT_CONFIGURATION_ERROR", "Commercial code hashing input is invalid.",
    );
  }
  return createHmac("sha256", secret)
    .update("aura:discovery-containment:commercial-code:v1\0", "utf8")
    .update(normalized, "utf8")
    .digest("hex");
}

export function validateDiscoveryContainmentAuditV1(
  value: unknown,
): DiscoveryContainmentAuditRecordV1 {
  if (!isRecord(value) || value.version !== DISCOVERY_CONTAINMENT_AUDIT_SCHEMA_VERSION ||
      typeof value.auditId !== "string" || !/^audit_[a-f0-9]{48}$/.test(value.auditId) ||
      typeof value.policyVersion !== "string" || !IDENTIFIER.test(value.policyVersion) ||
      (value.previousPolicyVersion !== null &&
        (typeof value.previousPolicyVersion !== "string" ||
          !IDENTIFIER.test(value.previousPolicyVersion))) ||
      !["ACTIVATE", "UPDATE", "EXPIRE", "REVOKE", "ROLLBACK"].includes(String(value.action)) ||
      !ENVIRONMENTS.includes(String(value.environment)) ||
      typeof value.actorRole !== "string" || !ROLE.test(value.actorRole) ||
      typeof value.approverRole !== "string" || !ROLE.test(value.approverRole) ||
      typeof value.reasonCode !== "string" || !REASON.test(value.reasonCode) ||
      !validInteger(value.timestamp) || !validInteger(value.expiresAt, 1) ||
      (value.rollbackVersion !== null &&
        (typeof value.rollbackVersion !== "string" || !IDENTIFIER.test(value.rollbackVersion))) ||
      !["APPLIED", "REJECTED"].includes(String(value.result))) {
    throw new DiscoveryContainmentError(
      "CONTAINMENT_CONFIGURATION_ERROR", "Containment audit record is invalid.",
    );
  }
  return Object.freeze({ ...value }) as unknown as DiscoveryContainmentAuditRecordV1;
}
