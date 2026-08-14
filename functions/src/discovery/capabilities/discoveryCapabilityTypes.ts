export const DISCOVERY_CAPABILITY_VERSION = "DISCOVERY_CAPABILITY_V1" as const;
export const DISCOVERY_COMPLETION_VERSION = "DISCOVERY_COMPLETION_V1" as const;

export type DiscoveryCapabilityType = "EXCHANGE" | "SESSION" | "REPORT";
export type DiscoveryCapabilityPurpose =
  | "DISCOVERY_TOKEN_EXCHANGE"
  | "DISCOVERY_SESSION"
  | "DISCOVERY_REPORT";

export interface DiscoveryCapabilityV1 {
  readonly version: typeof DISCOVERY_CAPABILITY_VERSION;
  readonly type: DiscoveryCapabilityType;
  readonly subjectId: string;
  readonly linkId: string;
  readonly sessionId: string | null;
  readonly audience: "PUBLIC_DISCOVERY";
  readonly purpose: DiscoveryCapabilityPurpose;
  readonly generation: number;
  readonly tokenHash: string;
  readonly issuedAt: number;
  readonly expiresAt: number;
  readonly consumedAt: number | null;
  readonly completedAt: number | null;
  readonly revokedAt: number | null;
  readonly revocationReason: string | null;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly synthetic?: true;
  readonly environment?: "PREVIEW";
  readonly projectId?: "aura-intel-preview";
  readonly tenantId?: string;
  readonly fixtureLocator?: string;
  readonly requiredCapability?: "EVALUATE_CONVERSATION";
  readonly capabilityScope?: "DISCOVERY_SESSION";
  readonly issuedByActorId?: string;
  readonly issuerVersion?: "SYNTHETIC_DISCOVERY_CAPABILITY_ISSUER_V1";
}

export const DISCOVERY_CAPABILITY_ERROR_CODES = Object.freeze([
  "CAPABILITY_NOT_FOUND",
  "CAPABILITY_EXPIRED",
  "CAPABILITY_REVOKED",
  "CAPABILITY_ALREADY_CONSUMED",
  "CAPABILITY_TYPE_MISMATCH",
  "CAPABILITY_BINDING_MISMATCH",
  "CAPABILITY_GENERATION_MISMATCH",
  "SESSION_ALREADY_COMPLETED",
  "COMPLETION_REQUEST_CONFLICT",
  "COMPLETION_INTERNAL_FAILURE",
  "REPORT_CAPABILITY_REQUIRED",
] as const);

export type DiscoveryCapabilityErrorCode =
  (typeof DISCOVERY_CAPABILITY_ERROR_CODES)[number];

export interface DiscoveryCompletionRecordV1 {
  readonly version: typeof DISCOVERY_COMPLETION_VERSION;
  readonly completionId: string;
  readonly requestHash: string;
  readonly sessionCapabilityHash: string;
  readonly reportCapabilityHash: string;
  readonly reportCapabilityGeneration: number;
  readonly linkId: string;
  readonly sessionId: string;
  readonly dossierId: string;
  readonly reportId: string;
  readonly eventId: string;
  readonly notificationKey: string;
  readonly prospectId: string | null;
  readonly resolutionStatus: string | null;
  readonly trustDecision: string;
  readonly companyName: string;
  readonly prospectName: string;
  readonly advisorUid: string | null;
  readonly advisorId: string | null;
  readonly createdAt: number;
  readonly completedAt: number;
}

export interface DiscoveryCompletionPublicResultV1 {
  readonly dossierId: string;
  readonly reportId: string;
  readonly reportCapabilityToken: string;
  readonly trustDecision: string;
}

export interface DiscoveryStructuredCompletionPublicResultV1 {
  readonly dossierId: string;
  readonly trustDecision: string;
  readonly structuredResultAvailable: true;
}

export function createDiscoveryStructuredCompletionPublicResultV1(
  completion: DiscoveryCompletionRecordV1,
): DiscoveryStructuredCompletionPublicResultV1 {
  return Object.freeze({
    dossierId: completion.dossierId,
    trustDecision: completion.trustDecision,
    structuredResultAvailable: true,
  });
}

export function createDiscoveryCompletionPublicResultV1(
  completion: DiscoveryCompletionRecordV1,
  reportCapabilityToken: string,
): DiscoveryCompletionPublicResultV1 {
  return Object.freeze({
    dossierId: completion.dossierId,
    reportId: completion.reportId,
    reportCapabilityToken,
    trustDecision: completion.trustDecision,
  });
}
