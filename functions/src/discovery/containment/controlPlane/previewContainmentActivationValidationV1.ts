import {
  DISCOVERY_CONTAINMENT_POLICY_SCHEMA_VERSION,
  DISCOVERY_EMERGENCY_QUOTA_OPERATIONS,
  type DiscoveryEmergencyGlobalQuotaV1,
} from "../discoveryContainmentTypes";
import {
  PREVIEW_CONTAINMENT_ACTIVATION_REQUEST_SCHEMA_VERSION,
  PREVIEW_CONTAINMENT_POLICY_PROPOSAL_SCHEMA_VERSION,
  PREVIEW_CONTAINMENT_TARGET_V1,
  PreviewContainmentActivationErrorV1,
  type PreviewContainmentActivationRequestV1,
  type PreviewContainmentPolicyProposalV1,
} from "./previewContainmentActivationTypesV1";

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;
const OPAQUE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const TENANT = /^tenant-[a-f0-9]{32,64}$/;
const ROLE = /^[A-Z][A-Z0-9_]{1,63}$/;
const REASON = /^[A-Z][A-Z0-9_]{1,95}$/;
const APP_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/;
const HASH = /^[a-f0-9]{64}$/;
const REQUEST_KEYS = [
  "schemaVersion", "requestId", "correlationId", "actor", "approver", "reason",
  "environment", "projectId", "region", "tenantId", "expectedCurrentVersion",
  "proposedVersion", "idempotencyKey", "dryRun", "apply",
] as const;
const PROPOSAL_KEYS = [
  "schemaVersion", "policyVersion", "tenantId", "publicIntakeEnabled",
  "advisorCodeResolutionEnabled", "tokenIssuanceEnabled", "sessionResolutionEnabled",
  "sessionCompletionEnabled", "conversationAiEnabled",
  "externalReportGenerationEnabled", "documentDownloadEnabled",
  "notificationFanoutEnabled", "blockedAppIds", "blockedCommercialCodeHashes",
  "emergencyGlobalQuota", "reason", "ownerRole", "approvedByRole", "ttlSeconds",
  "rollbackVersion", "status",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function invalid(code: "ACTIVATION_REQUEST_INVALID" | "ACTIVATION_POLICY_INVALID"): never {
  throw new PreviewContainmentActivationErrorV1(code);
}

function sortedUniqueList(value: unknown, pattern: RegExp): readonly string[] {
  if (!Array.isArray(value) || value.length > 100 ||
      value.some((entry) => typeof entry !== "string" || !pattern.test(entry)) ||
      new Set(value).size !== value.length) {
    invalid("ACTIVATION_POLICY_INVALID");
  }
  return Object.freeze([...value].sort()) as readonly string[];
}

function quota(value: unknown): DiscoveryEmergencyGlobalQuotaV1 {
  if (!isRecord(value) || Object.keys(value).length !==
      DISCOVERY_EMERGENCY_QUOTA_OPERATIONS.length) {
    invalid("ACTIVATION_POLICY_INVALID");
  }
  const output: Record<string, Readonly<{
    enabled: boolean; windowSeconds: number; maxRequests: number; burst: number;
  }>> = {};
  for (const operation of DISCOVERY_EMERGENCY_QUOTA_OPERATIONS) {
    const rule = value[operation];
    if (!isRecord(rule) || !hasExactKeys(rule,
      ["enabled", "windowSeconds", "maxRequests", "burst"]) ||
      typeof rule.enabled !== "boolean" ||
      !Number.isSafeInteger(rule.windowSeconds) || Number(rule.windowSeconds) < 1 ||
      Number(rule.windowSeconds) > 86_400 ||
      !Number.isSafeInteger(rule.maxRequests) || Number(rule.maxRequests) < 1 ||
      Number(rule.maxRequests) > 1_000_000 ||
      !Number.isSafeInteger(rule.burst) || Number(rule.burst) < 0 ||
      Number(rule.burst) > 1_000_000) {
      invalid("ACTIVATION_POLICY_INVALID");
    }
    output[operation] = Object.freeze({
      enabled: rule.enabled,
      windowSeconds: Number(rule.windowSeconds),
      maxRequests: Number(rule.maxRequests),
      burst: Number(rule.burst),
    });
  }
  return Object.freeze(output) as DiscoveryEmergencyGlobalQuotaV1;
}

export function validatePreviewContainmentActivationRequestV1(
  value: unknown,
  expectedTenantId: string,
): PreviewContainmentActivationRequestV1 {
  if (!isRecord(value) || !hasExactKeys(value, REQUEST_KEYS) ||
      value.schemaVersion !== PREVIEW_CONTAINMENT_ACTIVATION_REQUEST_SCHEMA_VERSION ||
      typeof value.requestId !== "string" || !OPAQUE_ID.test(value.requestId) ||
      typeof value.correlationId !== "string" || !OPAQUE_ID.test(value.correlationId) ||
      typeof value.actor !== "string" || !ROLE.test(value.actor) ||
      typeof value.approver !== "string" || !ROLE.test(value.approver) ||
      value.actor === value.approver ||
      typeof value.reason !== "string" || !REASON.test(value.reason) ||
      typeof value.tenantId !== "string" || !TENANT.test(value.tenantId) ||
      typeof value.proposedVersion !== "string" || !IDENTIFIER.test(value.proposedVersion) ||
      (value.expectedCurrentVersion !== null &&
        (typeof value.expectedCurrentVersion !== "string" ||
          !IDENTIFIER.test(value.expectedCurrentVersion))) ||
      typeof value.idempotencyKey !== "string" || !OPAQUE_ID.test(value.idempotencyKey) ||
      typeof value.dryRun !== "boolean" || typeof value.apply !== "boolean" ||
      value.dryRun === value.apply) {
    invalid("ACTIVATION_REQUEST_INVALID");
  }
  if (value.environment !== PREVIEW_CONTAINMENT_TARGET_V1.environment ||
      value.projectId !== PREVIEW_CONTAINMENT_TARGET_V1.projectId ||
      value.region !== PREVIEW_CONTAINMENT_TARGET_V1.region) {
    throw new PreviewContainmentActivationErrorV1("ACTIVATION_TARGET_REJECTED");
  }
  if (value.tenantId !== expectedTenantId) {
    throw new PreviewContainmentActivationErrorV1("ACTIVATION_TENANT_REJECTED");
  }
  return Object.freeze({ ...value }) as unknown as PreviewContainmentActivationRequestV1;
}

export function validatePreviewContainmentPolicyProposalV1(
  value: unknown,
): PreviewContainmentPolicyProposalV1 {
  if (!isRecord(value) || !hasExactKeys(value, PROPOSAL_KEYS) ||
      value.schemaVersion !== PREVIEW_CONTAINMENT_POLICY_PROPOSAL_SCHEMA_VERSION ||
      typeof value.policyVersion !== "string" || !IDENTIFIER.test(value.policyVersion) ||
      typeof value.tenantId !== "string" || !TENANT.test(value.tenantId) ||
      typeof value.reason !== "string" || !REASON.test(value.reason) ||
      typeof value.ownerRole !== "string" || !ROLE.test(value.ownerRole) ||
      typeof value.approvedByRole !== "string" || !ROLE.test(value.approvedByRole) ||
      value.ownerRole === value.approvedByRole ||
      !Number.isSafeInteger(value.ttlSeconds) || Number(value.ttlSeconds) < 60 ||
      Number(value.ttlSeconds) > 2_592_000 ||
      (value.rollbackVersion !== null &&
        (typeof value.rollbackVersion !== "string" || !IDENTIFIER.test(value.rollbackVersion))) ||
      value.rollbackVersion === value.policyVersion || value.status !== "ACTIVE") {
    invalid("ACTIVATION_POLICY_INVALID");
  }
  const switches = [
    "publicIntakeEnabled", "advisorCodeResolutionEnabled", "tokenIssuanceEnabled",
    "sessionResolutionEnabled", "sessionCompletionEnabled", "conversationAiEnabled",
    "externalReportGenerationEnabled", "documentDownloadEnabled",
    "notificationFanoutEnabled",
  ] as const;
  if (switches.some((key) => typeof value[key] !== "boolean")) {
    invalid("ACTIVATION_POLICY_INVALID");
  }
  return Object.freeze({
    schemaVersion: PREVIEW_CONTAINMENT_POLICY_PROPOSAL_SCHEMA_VERSION,
    policyVersion: value.policyVersion,
    tenantId: value.tenantId,
    publicIntakeEnabled: value.publicIntakeEnabled as boolean,
    advisorCodeResolutionEnabled: value.advisorCodeResolutionEnabled as boolean,
    tokenIssuanceEnabled: value.tokenIssuanceEnabled as boolean,
    sessionResolutionEnabled: value.sessionResolutionEnabled as boolean,
    sessionCompletionEnabled: value.sessionCompletionEnabled as boolean,
    conversationAiEnabled: value.conversationAiEnabled as boolean,
    externalReportGenerationEnabled: value.externalReportGenerationEnabled as boolean,
    documentDownloadEnabled: value.documentDownloadEnabled as boolean,
    notificationFanoutEnabled: value.notificationFanoutEnabled as boolean,
    blockedAppIds: sortedUniqueList(value.blockedAppIds, APP_ID),
    blockedCommercialCodeHashes: sortedUniqueList(value.blockedCommercialCodeHashes, HASH),
    emergencyGlobalQuota: quota(value.emergencyGlobalQuota),
    reason: value.reason,
    ownerRole: value.ownerRole,
    approvedByRole: value.approvedByRole,
    ttlSeconds: Number(value.ttlSeconds),
    rollbackVersion: value.rollbackVersion as string | null,
    status: "ACTIVE",
  });
}

export function materializePreviewContainmentPolicyV1(
  proposal: PreviewContainmentPolicyProposalV1,
  serverTimestamp: number,
) {
  return Object.freeze({
    version: DISCOVERY_CONTAINMENT_POLICY_SCHEMA_VERSION,
    policyVersion: proposal.policyVersion,
    environment: "PREVIEW" as const,
    publicIntakeEnabled: proposal.publicIntakeEnabled,
    advisorCodeResolutionEnabled: proposal.advisorCodeResolutionEnabled,
    tokenIssuanceEnabled: proposal.tokenIssuanceEnabled,
    sessionResolutionEnabled: proposal.sessionResolutionEnabled,
    sessionCompletionEnabled: proposal.sessionCompletionEnabled,
    conversationAiEnabled: proposal.conversationAiEnabled,
    externalReportGenerationEnabled: proposal.externalReportGenerationEnabled,
    documentDownloadEnabled: proposal.documentDownloadEnabled,
    notificationFanoutEnabled: proposal.notificationFanoutEnabled,
    blockedAppIds: proposal.blockedAppIds,
    blockedCommercialCodeHashes: proposal.blockedCommercialCodeHashes,
    emergencyGlobalQuota: proposal.emergencyGlobalQuota,
    reason: proposal.reason,
    ownerRole: proposal.ownerRole,
    approvedByRole: proposal.approvedByRole,
    createdAt: serverTimestamp,
    updatedAt: serverTimestamp,
    expiresAt: serverTimestamp + proposal.ttlSeconds * 1_000,
    rollbackVersion: proposal.rollbackVersion,
    status: proposal.status,
  });
}
