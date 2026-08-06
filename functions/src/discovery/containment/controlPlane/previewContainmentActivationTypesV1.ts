import type {
  DiscoveryContainmentPolicyV1,
  DiscoveryEmergencyGlobalQuotaV1,
} from "../discoveryContainmentTypes";

export const PREVIEW_CONTAINMENT_ACTIVATION_REQUEST_SCHEMA_VERSION =
  "PREVIEW_CONTAINMENT_ACTIVATION_REQUEST_V1" as const;
export const PREVIEW_CONTAINMENT_POLICY_PROPOSAL_SCHEMA_VERSION =
  "PREVIEW_CONTAINMENT_POLICY_PROPOSAL_V1" as const;
export const PREVIEW_CONTAINMENT_ACTIVATION_AUDIT_SCHEMA_VERSION =
  "PREVIEW_CONTAINMENT_ACTIVATION_AUDIT_V1" as const;

export const PREVIEW_CONTAINMENT_TARGET_V1 = Object.freeze({
  environment: "PREVIEW" as const,
  projectId: "aura-intel-preview" as const,
  region: "us-central1" as const,
});

export interface PreviewContainmentActivationRequestV1 {
  readonly schemaVersion: typeof PREVIEW_CONTAINMENT_ACTIVATION_REQUEST_SCHEMA_VERSION;
  readonly requestId: string;
  readonly correlationId: string;
  readonly actor: string;
  readonly approver: string;
  readonly reason: string;
  readonly environment: "PREVIEW";
  readonly projectId: "aura-intel-preview";
  readonly region: "us-central1";
  readonly tenantId: string;
  readonly expectedCurrentVersion: string | null;
  readonly proposedVersion: string;
  readonly idempotencyKey: string;
  readonly dryRun: boolean;
  readonly apply: boolean;
}

export interface PreviewContainmentPolicyProposalV1 {
  readonly schemaVersion: typeof PREVIEW_CONTAINMENT_POLICY_PROPOSAL_SCHEMA_VERSION;
  readonly policyVersion: string;
  readonly tenantId: string;
  readonly publicIntakeEnabled: boolean;
  readonly advisorCodeResolutionEnabled: boolean;
  readonly tokenIssuanceEnabled: boolean;
  readonly sessionResolutionEnabled: boolean;
  readonly sessionCompletionEnabled: boolean;
  readonly conversationAiEnabled: boolean;
  readonly externalReportGenerationEnabled: boolean;
  readonly documentDownloadEnabled: boolean;
  readonly notificationFanoutEnabled: boolean;
  readonly blockedAppIds: readonly string[];
  readonly blockedCommercialCodeHashes: readonly string[];
  readonly emergencyGlobalQuota: DiscoveryEmergencyGlobalQuotaV1;
  readonly reason: string;
  readonly ownerRole: string;
  readonly approvedByRole: string;
  readonly ttlSeconds: number;
  readonly rollbackVersion: string | null;
  readonly status: "ACTIVE";
}

export type PreviewContainmentActivationErrorCodeV1 =
  | "ACTIVATION_REQUEST_INVALID"
  | "ACTIVATION_TARGET_REJECTED"
  | "ACTIVATION_TENANT_REJECTED"
  | "ACTIVATION_AUTHORITY_REJECTED"
  | "ACTIVATION_POLICY_INVALID"
  | "ACTIVATION_CAS_MISMATCH"
  | "ACTIVATION_ORPHAN_POINTER"
  | "ACTIVATION_VERSION_IMMUTABLE"
  | "ACTIVATION_IDEMPOTENCY_CONFLICT"
  | "ACTIVATION_DUPLICATE_REJECTED"
  | "ACTIVATION_STATE_CORRUPTED";

export class PreviewContainmentActivationErrorV1 extends Error {
  constructor(readonly code: PreviewContainmentActivationErrorCodeV1) {
    super(code);
    this.name = "PreviewContainmentActivationErrorV1";
  }
}

export interface PreviewContainmentActivationAuthorityVerifierV1 {
  verify(input: Readonly<{
    actor: string;
    approver: string;
    reason: string;
    tenantId: string;
    projectId: "aura-intel-preview";
  }>): Promise<"ALLOW" | "DENY">;
}

export interface PreviewContainmentServerClockV1 {
  nowEpochMilliseconds(): number;
}

export interface PreviewContainmentActivationAuditV1 {
  readonly schemaVersion: typeof PREVIEW_CONTAINMENT_ACTIVATION_AUDIT_SCHEMA_VERSION;
  readonly requestId: string;
  readonly correlationId: string;
  readonly actor: string;
  readonly approver: string;
  readonly reason: string;
  readonly tenantId: string;
  readonly projectId: "aura-intel-preview";
  readonly region: "us-central1";
  readonly previousVersion: string | null;
  readonly proposedVersion: string;
  readonly idempotencyKey: string;
  readonly fingerprint: string;
  readonly result: "APPLIED";
  readonly serverTimestamp: number;
}

export type PreviewContainmentActivationDecisionV1 =
  | "DRY_RUN_VALIDATED" | "APPLIED" | "REPLAY";

export interface PreviewContainmentActivationStoreV1 {
  execute(input: Readonly<{
    request: PreviewContainmentActivationRequestV1;
    proposal: PreviewContainmentPolicyProposalV1;
    policy: DiscoveryContainmentPolicyV1;
    fingerprint: string;
    auditId: string;
    serverTimestamp: number;
  }>): Promise<Readonly<{
    decision: PreviewContainmentActivationDecisionV1;
    previousVersion: string | null;
    proposedVersion: string;
    fingerprint: string;
    auditId: string | null;
  }>>;
}
