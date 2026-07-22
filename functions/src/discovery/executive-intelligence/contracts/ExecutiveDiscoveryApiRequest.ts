export const EXECUTIVE_DISCOVERY_SCHEMA_VERSION = "1.0" as const;
export const EXECUTIVE_DISCOVERY_CAPABILITY_VERSION = "1.0.0" as const;

export const DiscoveryEvidenceSourceType = {
  USER_RESPONSE: "USER_RESPONSE",
  CONVERSATION_TURN: "CONVERSATION_TURN",
  ORGANIZATION_PROFILE: "ORGANIZATION_PROFILE",
  STRUCTURED_FIELD: "STRUCTURED_FIELD",
  DOCUMENT_REFERENCE: "DOCUMENT_REFERENCE",
  SYSTEM_OBSERVATION: "SYSTEM_OBSERVATION",
} as const;

export type DiscoveryEvidenceSourceType =
  (typeof DiscoveryEvidenceSourceType)[keyof typeof DiscoveryEvidenceSourceType];

export const DiscoveryEvidenceClassification = {
  USER_CONFIRMED: "USER_CONFIRMED",
  INFERRED: "INFERRED",
  SYSTEM_OBSERVED: "SYSTEM_OBSERVED",
  MISSING: "MISSING",
} as const;

export type DiscoveryEvidenceClassification =
  (typeof DiscoveryEvidenceClassification)[keyof typeof DiscoveryEvidenceClassification];

export type DiscoveryJsonPrimitive = string | number | boolean | null;

export type DiscoveryJsonValue =
  | DiscoveryJsonPrimitive
  | readonly DiscoveryJsonValue[]
  | { readonly [key: string]: DiscoveryJsonValue };

export type DiscoveryMetadata = Readonly<Record<string, DiscoveryJsonPrimitive>>;

export interface ExecutiveDiscoveryEvidence {
  readonly evidenceId: string;
  readonly sourceType: DiscoveryEvidenceSourceType;
  readonly sourceReference: string;
  readonly fieldId?: string;
  readonly questionId?: string;
  readonly value: DiscoveryJsonValue;
  readonly normalizedValue?: DiscoveryJsonValue;
  readonly capturedAt: string;
  readonly classification: DiscoveryEvidenceClassification;
  readonly consentScope: string;
  readonly confidence: number;
  readonly hash?: string;
  readonly metadata?: DiscoveryMetadata;
}

export interface ExecutiveDiscoveryConsentAssertion {
  readonly receiptId: string;
  readonly privacyConsent: boolean;
  readonly diagnosticProcessingConsent: boolean;
  readonly marketingConsent?: boolean;
  readonly consentVersion: string;
  readonly capturedAt: string;
}

/** Wire DTO accepted by Aura Intelligence evaluateExecutiveDiscoveryV1. */
export interface ExecutiveDiscoveryApiRequest {
  readonly schemaVersion: typeof EXECUTIVE_DISCOVERY_SCHEMA_VERSION;
  readonly capabilityVersion: string;
  readonly requestId: string;
  readonly correlationId: string;
  readonly idempotencyKey: string;
  readonly organizationId: string;
  readonly tenantId: string;
  readonly companyId: string;
  readonly sessionId: string;
  readonly discoveryDefinitionVersion: string;
  readonly locale: string;
  readonly requestedAt: string;
  readonly evidence: readonly ExecutiveDiscoveryEvidence[];
  readonly consentAssertion: Readonly<ExecutiveDiscoveryConsentAssertion>;
  readonly metadata?: DiscoveryMetadata;
}

