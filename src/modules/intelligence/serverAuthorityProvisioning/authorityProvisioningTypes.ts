export const AUTHORITY_PROVISIONING_SERVICE_VERSION =
  'AUTHORITY_PROVISIONING_SERVICE_V1' as const;
export const AUTHORITY_PROVISIONING_REQUEST_VERSION =
  'PROVISION_SYNTHETIC_PREVIEW_AUTHORITY_V1' as const;
export const AUTHORITY_RESOLUTION_REQUEST_VERSION =
  'RESOLVE_PREVIEW_AUTHORITY_V1' as const;
export const AUTHORITY_PROVISIONING_RECORD_VERSION =
  'PREVIEW_AUTHORITY_RECORD_V1' as const;
export const AUTHORITY_PROVISIONING_AUDIT_VERSION =
  'PREVIEW_AUTHORITY_AUDIT_V1' as const;
export const PREVIEW_SYNTHETIC_AUTHORITY_RETENTION_POLICY_VERSION =
  'PREVIEW_SYNTHETIC_AUTHORITY_RETENTION_POLICY_V1' as const;
export const CONTROLLED_PREVIEW_HAPPY_PATH =
  'CONTROLLED_PREVIEW_HAPPY_PATH' as const;

// Discovery intake is public and the remaining handlers use server-issued
// session capabilities. No tenant capability is assigned by this module.
export const PREVIEW_DISCOVERY_AUTHORITY_CAPABILITIES = Object.freeze([] as const);
export type PreviewDiscoveryAuthorityCapability =
  (typeof PREVIEW_DISCOVERY_AUTHORITY_CAPABILITIES)[number];

export type PreviewAuthorityEnvironment = 'PREVIEW';
export type PlatformPrincipalStatusV1 = 'ACTIVE' | 'DISABLED';
export type PlatformTenantStatusV1 = 'ACTIVE' | 'DISABLED';
export type TenantMembershipStatusV1 = 'ACTIVE' | 'DISABLED';

export interface PreviewSyntheticAuthorityMetadataV1 {
  readonly label: string;
  readonly approvedUse: typeof CONTROLLED_PREVIEW_HAPPY_PATH;
  readonly synthetic: true;
}

export interface PlatformPrincipalV1 {
  readonly schemaVersion: typeof AUTHORITY_PROVISIONING_RECORD_VERSION;
  readonly principalId: string;
  readonly authUid: string;
  readonly status: PlatformPrincipalStatusV1;
  readonly environment: PreviewAuthorityEnvironment;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly testMetadata: PreviewSyntheticAuthorityMetadataV1;
}

export interface PlatformTenantV1 {
  readonly schemaVersion: typeof AUTHORITY_PROVISIONING_RECORD_VERSION;
  readonly tenantId: string;
  readonly status: PlatformTenantStatusV1;
  readonly environment: PreviewAuthorityEnvironment;
  readonly tenantType: 'SYNTHETIC_TEST';
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly testMetadata: PreviewSyntheticAuthorityMetadataV1;
}

export interface TenantMembershipV1 {
  readonly schemaVersion: typeof AUTHORITY_PROVISIONING_RECORD_VERSION;
  readonly membershipId: string;
  readonly principalId: string;
  readonly tenantId: string;
  readonly status: TenantMembershipStatusV1;
  readonly environment: PreviewAuthorityEnvironment;
  readonly capabilities: readonly PreviewDiscoveryAuthorityCapability[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PreviewSyntheticAuthorityRetentionPolicyV1 {
  readonly version:
    typeof PREVIEW_SYNTHETIC_AUTHORITY_RETENTION_POLICY_VERSION;
  readonly principalRetention: 'PERMANENT_PREVIEW_FIXTURE';
  readonly tenantRetention: 'PERMANENT_PREVIEW_FIXTURE';
  readonly membershipRetention: 'PREVIEW_ENVIRONMENT_LIFETIME';
  readonly happyPathDataRetentionDays: 30;
  readonly cleanup: 'VERSIONED_AUTHORIZED_PROCEDURE';
  readonly approvedUse: typeof CONTROLLED_PREVIEW_HAPPY_PATH;
}

export interface ProvisionSyntheticPreviewAuthorityRequestV1 {
  readonly version: typeof AUTHORITY_PROVISIONING_REQUEST_VERSION;
  readonly requestId: string;
  readonly correlationId: string;
  readonly idempotencyKey: string;
  readonly authUid: string;
  readonly identityLabel: string;
  readonly tenantLabel: string;
  readonly requestedCapabilities:
    readonly PreviewDiscoveryAuthorityCapability[];
  readonly environment: PreviewAuthorityEnvironment;
  readonly retentionPolicy: PreviewSyntheticAuthorityRetentionPolicyV1;
  readonly requestedAt: string;
}

export interface ResolvePreviewAuthorityRequestV1 {
  readonly version: typeof AUTHORITY_RESOLUTION_REQUEST_VERSION;
  readonly authUid: string;
  readonly environment: PreviewAuthorityEnvironment;
  readonly expectedTenantId?: string;
  readonly requiredCapability?: PreviewDiscoveryAuthorityCapability;
}

export interface AuthorityProvisioningAuditRecordV1 {
  readonly schemaVersion: typeof AUTHORITY_PROVISIONING_AUDIT_VERSION;
  readonly auditId: string;
  readonly idempotencyKey: string;
  readonly requestFingerprint: string;
  readonly principalId: string;
  readonly tenantId: string;
  readonly membershipId: string;
  readonly environment: PreviewAuthorityEnvironment;
  readonly occurredAt: string;
  readonly approvedUse: typeof CONTROLLED_PREVIEW_HAPPY_PATH;
}

export interface AuthorityProvisioningLocatorsV1 {
  readonly principalLocator: string;
  readonly tenantLocator: string;
  readonly membershipLocator: string;
}

export interface ProvisionSyntheticPreviewAuthorityResponseV1
  extends AuthorityProvisioningLocatorsV1 {
  readonly version: typeof AUTHORITY_PROVISIONING_SERVICE_VERSION;
  readonly status: 'PROVISIONED' | 'REUSED';
  readonly assignedCapabilities:
    readonly PreviewDiscoveryAuthorityCapability[];
  readonly created: Readonly<{
    principal: boolean;
    tenant: boolean;
    membership: boolean;
  }>;
  readonly idempotencyResult: 'CREATED' | 'REPLAYED';
  readonly auditFingerprint: string;
  readonly occurredAt: string;
}

export interface ResolvedPreviewAuthorityV1
  extends AuthorityProvisioningLocatorsV1 {
  readonly version: typeof AUTHORITY_PROVISIONING_SERVICE_VERSION;
  readonly status: 'ACTIVE';
  readonly environment: PreviewAuthorityEnvironment;
  readonly effectiveCapabilities:
    readonly PreviewDiscoveryAuthorityCapability[];
}

export interface AuthorityProvisioningServiceV1 {
  readonly version: typeof AUTHORITY_PROVISIONING_SERVICE_VERSION;
  provisionSyntheticIdentityAuthority(
    request: unknown,
  ): Promise<ProvisionSyntheticPreviewAuthorityResponseV1>;
  resolveAuthority(request: unknown): Promise<ResolvedPreviewAuthorityV1>;
  inspectAuthority(request: unknown): Promise<ResolvedPreviewAuthorityV1>;
}
