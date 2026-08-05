import type { RuntimeEnvironmentV1 } from "../runtimeContracts";

export const DISCOVERY_CONTAINMENT_POLICY_SCHEMA_VERSION =
  "DISCOVERY_CONTAINMENT_POLICY_V1" as const;
export const DISCOVERY_CONTAINMENT_DECISION_SCHEMA_VERSION =
  "DISCOVERY_CONTAINMENT_DECISION_V1" as const;
export const DISCOVERY_CONTAINMENT_AUDIT_SCHEMA_VERSION =
  "DISCOVERY_CONTAINMENT_AUDIT_V1" as const;

export const DISCOVERY_CONTAINMENT_SURFACES = Object.freeze([
  "PUBLIC_INTAKE",
  "ADVISOR_CODE_RESOLUTION",
  "TOKEN_ISSUANCE",
  "SESSION_RESOLUTION",
  "SESSION_COMPLETION",
  "CONVERSATION_AI",
  "EXTERNAL_REPORT_GENERATION",
  "DOCUMENT_DOWNLOAD",
  "NOTIFICATION_FANOUT",
] as const);

export type DiscoveryContainmentSurface =
  (typeof DISCOVERY_CONTAINMENT_SURFACES)[number];

export const DISCOVERY_EMERGENCY_QUOTA_OPERATIONS = Object.freeze([
  "INTAKE", "AI_EVALUATION", "COMPLETION",
  "REPORT_GENERATION", "DOWNLOAD", "NOTIFICATION",
] as const);

export type DiscoveryEmergencyQuotaOperation =
  (typeof DISCOVERY_EMERGENCY_QUOTA_OPERATIONS)[number];

export type DiscoveryContainmentEnvironment = RuntimeEnvironmentV1;
export type DiscoveryContainmentPolicyStatus =
  "ACTIVE" | "EXPIRED" | "REVOKED" | "INVALID";

export interface DiscoveryEmergencyQuotaRuleV1 {
  readonly enabled: boolean;
  readonly windowSeconds: number;
  readonly maxRequests: number;
  readonly burst: number;
}

export type DiscoveryEmergencyGlobalQuotaV1 = Readonly<Record<
  DiscoveryEmergencyQuotaOperation,
  DiscoveryEmergencyQuotaRuleV1
>>;

export interface DiscoveryContainmentPolicyV1 {
  readonly version: typeof DISCOVERY_CONTAINMENT_POLICY_SCHEMA_VERSION;
  readonly policyVersion: string;
  readonly environment: DiscoveryContainmentEnvironment;
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
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly expiresAt: number;
  readonly rollbackVersion: string | null;
  readonly status: DiscoveryContainmentPolicyStatus;
}

export interface DiscoveryContainmentEvaluationRequestV1 {
  readonly surface: DiscoveryContainmentSurface;
  readonly environment: DiscoveryContainmentEnvironment;
  readonly appId?: string;
  readonly commercialCodeHash?: string;
}

export type DiscoveryContainmentErrorCode =
  | "CONTAINMENT_DISABLED"
  | "CONTAINMENT_POLICY_NOT_FOUND"
  | "CONTAINMENT_POLICY_CORRUPTED"
  | "CONTAINMENT_POLICY_EXPIRED"
  | "CONTAINMENT_SUBJECT_BLOCKED"
  | "EMERGENCY_QUOTA_EXCEEDED"
  | "CONTAINMENT_ROLLBACK_INVALID"
  | "CONTAINMENT_CONFIGURATION_ERROR"
  | "CONTAINMENT_INTERNAL_FAILURE";

export interface DiscoveryContainmentDecisionV1 {
  readonly version: typeof DISCOVERY_CONTAINMENT_DECISION_SCHEMA_VERSION;
  readonly decision: "ALLOW" | "DENY" | "DEGRADED_ALLOW";
  readonly code: "CONTAINMENT_ALLOWED" | DiscoveryContainmentErrorCode;
  readonly surface: DiscoveryContainmentSurface;
  readonly environment: DiscoveryContainmentEnvironment;
  readonly policyVersion: string | null;
  readonly retryAfterSeconds: number;
}

export type DiscoveryContainmentAuditAction =
  "ACTIVATE" | "UPDATE" | "EXPIRE" | "REVOKE" | "ROLLBACK";
export type DiscoveryContainmentAuditResult = "APPLIED" | "REJECTED";

export interface DiscoveryContainmentAuditRecordV1 {
  readonly version: typeof DISCOVERY_CONTAINMENT_AUDIT_SCHEMA_VERSION;
  readonly auditId: string;
  readonly policyVersion: string;
  readonly previousPolicyVersion: string | null;
  readonly action: DiscoveryContainmentAuditAction;
  readonly environment: DiscoveryContainmentEnvironment;
  readonly actorRole: string;
  readonly approverRole: string;
  readonly reasonCode: string;
  readonly timestamp: number;
  readonly expiresAt: number;
  readonly rollbackVersion: string | null;
  readonly result: DiscoveryContainmentAuditResult;
}
