import type {
  AuthorityLegacyTenantSourceDescriptorV1,
} from '../serverAuthorityPersistence/legacyTenantSources';
import type {
  TenantAliasType,
  TenantAuthorityStatus,
} from '../serverAuthorityPersistence/types';
import type {
  CanonicalTenantAuthorityV1,
} from '../serverIdentity/types';
import type {
  AuthorityPrincipalResolutionChannel,
  AuthorityPrincipalType,
} from '../serverPrincipalResolution/principalResolutionTypes';

export const AUTHORITY_TENANT_SCOPE_SCHEMA_VERSION = '1' as const;
export const AUTHORITY_TENANT_SELECTOR_VERSION = '1' as const;
export const AUTHORITY_TENANT_MEMBERSHIP_BINDING_VERSION = '1' as const;
export const AUTHORITY_TENANT_SCOPE_EVIDENCE_VERSION = '1' as const;
export const AUTHORITY_TENANT_SCOPE_FRESHNESS_VERSION = '1' as const;
export const AUTHORITY_TENANT_SCOPE_PRINCIPAL_REFERENCE_VERSION = '1' as const;
export const AUTHORITY_TENANT_SCOPE_REQUEST_VERSION = '1' as const;
export const AUTHORITY_TENANT_SCOPE_CONTEXT_VERSION = '1' as const;
export const AUTHORITY_TENANT_SCOPE_RESULT_VERSION = '1' as const;
export const AUTHORITY_TENANT_SCOPE_ERROR_VERSION = '1' as const;

export type AuthorityTenantIdV1 = CanonicalTenantAuthorityV1['tenantId'];

export const AUTHORITY_TENANT_SCOPE_TYPES = Object.freeze([
  'TENANT',
  'PLATFORM',
  'TENANT_BOOTSTRAP',
  'LEGACY_CANONICALIZATION',
  'MIGRATION',
  'SUPPORT',
] as const);

export type AuthorityTenantScopeType =
  (typeof AUTHORITY_TENANT_SCOPE_TYPES)[number];

export const AUTHORITY_TENANT_SCOPE_STATUSES = Object.freeze([
  'ACTIVE',
  'SUSPENDED',
  'REVOKED',
  'DISABLED',
  'PENDING_BOOTSTRAP',
  'LEGACY_PENDING_CANONICALIZATION',
] as const);

export type AuthorityTenantScopeStatus =
  (typeof AUTHORITY_TENANT_SCOPE_STATUSES)[number];

export const AUTHORITY_TENANT_SCOPE_RESOLUTION_SOURCES = Object.freeze([
  'CANONICAL_TENANT_AUTHORITY',
  'CANONICAL_MEMBERSHIP',
  'TENANT_ALIAS',
  'PLATFORM_AUTHORITY',
  'LEGACY_PLATFORM_TENANT',
  'MIGRATION_MANIFEST',
  'SUPPORT_SESSION',
  'BOOTSTRAP_REQUEST',
] as const);

export type AuthorityTenantScopeResolutionSource =
  (typeof AUTHORITY_TENANT_SCOPE_RESOLUTION_SOURCES)[number];

export const AUTHORITY_TENANT_SELECTOR_TYPES = Object.freeze([
  'TENANT_ID',
  'TENANT_ALIAS',
  'PLATFORM_SCOPE',
  'BOOTSTRAP_CANDIDATE',
  'LEGACY_SOURCE',
  'MIGRATION_TARGET',
  'SUPPORT_TARGET',
] as const);

export type AuthorityTenantSelectorType =
  (typeof AUTHORITY_TENANT_SELECTOR_TYPES)[number];

export interface AuthorityTenantAliasReferenceV1 {
  readonly aliasType: TenantAliasType;
  readonly normalizedAlias: string;
}

export type AuthorityTenantSelectorV1 =
  | Readonly<{
      schemaVersion: typeof AUTHORITY_TENANT_SELECTOR_VERSION;
      selectorType: 'TENANT_ID';
      requestedTenantId: AuthorityTenantIdV1;
    }>
  | Readonly<{
      schemaVersion: typeof AUTHORITY_TENANT_SELECTOR_VERSION;
      selectorType: 'TENANT_ALIAS';
      alias: AuthorityTenantAliasReferenceV1;
    }>
  | Readonly<{
      schemaVersion: typeof AUTHORITY_TENANT_SELECTOR_VERSION;
      selectorType: 'PLATFORM_SCOPE';
      platformScopeId: string;
      platformBoundary: AuthorityPlatformBoundary;
    }>
  | Readonly<{
      schemaVersion: typeof AUTHORITY_TENANT_SELECTOR_VERSION;
      selectorType: 'BOOTSTRAP_CANDIDATE';
      bootstrapRequestId: string;
      tenantIdCandidate: AuthorityTenantIdV1;
    }>
  | Readonly<{
      schemaVersion: typeof AUTHORITY_TENANT_SELECTOR_VERSION;
      selectorType: 'LEGACY_SOURCE';
      sourceDescriptor: AuthorityLegacyTenantSourceDescriptorV1;
    }>
  | Readonly<{
      schemaVersion: typeof AUTHORITY_TENANT_SELECTOR_VERSION;
      selectorType: 'MIGRATION_TARGET';
      migrationId: string;
      migrationRunId: string;
      targetTenantIds: readonly AuthorityTenantIdV1[];
    }>
  | Readonly<{
      schemaVersion: typeof AUTHORITY_TENANT_SELECTOR_VERSION;
      selectorType: 'SUPPORT_TARGET';
      supportSessionId: string;
      requestedTenantId: AuthorityTenantIdV1;
    }>;

export const AUTHORITY_TENANT_MEMBERSHIP_STATUSES = Object.freeze([
  'ACTIVE',
  'SUSPENDED',
  'REVOKED',
  'DISABLED',
] as const);

export type AuthorityTenantMembershipStatus =
  (typeof AUTHORITY_TENANT_MEMBERSHIP_STATUSES)[number];

export interface AuthorityTenantMembershipBindingV1 {
  readonly schemaVersion:
    typeof AUTHORITY_TENANT_MEMBERSHIP_BINDING_VERSION;
  readonly membershipId: string;
  readonly tenantId: AuthorityTenantIdV1;
  readonly principalId: string;
  readonly membershipStatus: AuthorityTenantMembershipStatus;
  readonly membershipVersion: string;
  readonly tenantAuthorityVersion: string;
  readonly roleSetVersion?: string;
  readonly bindingVersion: string;
  readonly resolvedAt: string;
  readonly source: 'CANONICAL_MEMBERSHIP';
  readonly evidenceFingerprint: string;
}

export interface AuthorityTenantScopeSourceVersionV1 {
  readonly source: AuthorityTenantScopeResolutionSource;
  readonly version: string;
}

export interface AuthorityTenantScopeResolutionEvidenceV1 {
  readonly schemaVersion: typeof AUTHORITY_TENANT_SCOPE_EVIDENCE_VERSION;
  readonly selectorType: AuthorityTenantSelectorType;
  readonly source: AuthorityTenantScopeResolutionSource;
  readonly tenantAuthorityVersion?: string;
  readonly membershipBindingVersion?: string;
  readonly aliasVersion?: string;
  readonly sourceDescriptorFingerprint?: string;
  readonly resolverVersion: string;
  readonly resolvedAt: string;
  readonly evidenceFingerprint: string;
  readonly principalId: string;
  readonly principalBindingVersion: string;
  readonly sourceVersions: readonly AuthorityTenantScopeSourceVersionV1[];
}

export interface AuthorityTenantScopeFreshnessV1 {
  readonly schemaVersion: typeof AUTHORITY_TENANT_SCOPE_FRESHNESS_VERSION;
  readonly resolvedAt: string;
  readonly validUntil: string;
  readonly tenantAuthorityVersion: string;
  readonly membershipVersion?: string;
  readonly aliasVersion?: string;
  readonly bindingVersion: string;
  readonly staleAfterSeconds: number;
}

interface ResolvedAuthorityTenantScopeBaseV1 {
  readonly schemaVersion: typeof AUTHORITY_TENANT_SCOPE_SCHEMA_VERSION;
  readonly version: typeof AUTHORITY_TENANT_SCOPE_SCHEMA_VERSION;
  readonly scopeType: AuthorityTenantScopeType;
  readonly status: AuthorityTenantScopeStatus;
  readonly resolvedAt: string;
  readonly freshness: AuthorityTenantScopeFreshnessV1;
  readonly resolutionEvidence: AuthorityTenantScopeResolutionEvidenceV1;
}

export interface ResolvedTenantAuthorityScopeV1
  extends ResolvedAuthorityTenantScopeBaseV1 {
  readonly scopeType: 'TENANT';
  readonly tenantId: AuthorityTenantIdV1;
  readonly canonicalTenantAuthorityVersion: string;
  readonly membershipBinding: AuthorityTenantMembershipBindingV1;
  readonly tenantStatus: TenantAuthorityStatus;
  readonly requestedTenantSelector?: AuthorityTenantSelectorV1;
  readonly source:
    | 'CANONICAL_TENANT_AUTHORITY'
    | 'CANONICAL_MEMBERSHIP'
    | 'TENANT_ALIAS';
}

export const AUTHORITY_PLATFORM_BOUNDARIES = Object.freeze([
  'AUTHORITY_CONTROL_PLANE',
  'TENANT_LIFECYCLE',
  'IDENTITY_GOVERNANCE',
] as const);

export type AuthorityPlatformBoundary =
  (typeof AUTHORITY_PLATFORM_BOUNDARIES)[number];

export const AUTHORITY_PLATFORM_OPERATION_CATEGORIES = Object.freeze([
  'TENANT_ADMINISTRATION',
  'IDENTITY_ADMINISTRATION',
  'PLATFORM_OBSERVATION',
] as const);

export type AuthorityPlatformOperationCategory =
  (typeof AUTHORITY_PLATFORM_OPERATION_CATEGORIES)[number];

export interface ResolvedPlatformAuthorityScopeV1
  extends ResolvedAuthorityTenantScopeBaseV1 {
  readonly scopeType: 'PLATFORM';
  readonly platformScopeId: string;
  readonly platformBoundary: AuthorityPlatformBoundary;
  readonly platformOperationCategory: AuthorityPlatformOperationCategory;
  readonly source: 'PLATFORM_AUTHORITY';
}

export const AUTHORITY_TENANT_BOOTSTRAP_OPERATIONS = Object.freeze([
  'CREATE_TENANT_AUTHORITY',
  'ESTABLISH_INITIAL_MEMBERSHIP',
] as const);

export type AuthorityTenantBootstrapOperation =
  (typeof AUTHORITY_TENANT_BOOTSTRAP_OPERATIONS)[number];

export interface ResolvedTenantBootstrapScopeV1
  extends ResolvedAuthorityTenantScopeBaseV1 {
  readonly scopeType: 'TENANT_BOOTSTRAP';
  readonly bootstrapRequestId: string;
  readonly tenantIdCandidate: AuthorityTenantIdV1;
  readonly bootstrapOperation: AuthorityTenantBootstrapOperation;
  readonly initiatingPrincipalId: string;
  readonly principalBindingVersion: string;
  readonly bootstrapReasonCode: string;
  readonly source: 'BOOTSTRAP_REQUEST';
}

export interface AuthorityLegacyCanonicalizationBindingV1 {
  readonly migrationId: string;
  readonly migrationRunId: string;
  readonly bindingVersion: string;
}

export interface ResolvedLegacyCanonicalizationScopeV1
  extends ResolvedAuthorityTenantScopeBaseV1 {
  readonly scopeType: 'LEGACY_CANONICALIZATION';
  readonly legacySourceDescriptor: AuthorityLegacyTenantSourceDescriptorV1;
  readonly canonicalTenantCandidate: AuthorityTenantIdV1;
  readonly aliasCandidates: readonly AuthorityTenantAliasReferenceV1[];
  readonly canonicalizationBinding:
    AuthorityLegacyCanonicalizationBindingV1;
  readonly source: 'LEGACY_PLATFORM_TENANT';
}

export interface ResolvedMigrationTenantScopeV1
  extends ResolvedAuthorityTenantScopeBaseV1 {
  readonly scopeType: 'MIGRATION';
  readonly migrationId: string;
  readonly migrationRunId: string;
  readonly manifestVersion: string;
  readonly targetTenantIds: readonly AuthorityTenantIdV1[];
  readonly batchId: string;
  readonly batchScope: string;
  readonly scopeFingerprint: string;
  readonly source: 'MIGRATION_MANIFEST';
}

export const AUTHORITY_SUPPORT_IMPERSONATION_MODES = Object.freeze([
  'NONE',
  'EXPLICITLY_PROHIBITED',
  'OBSERVE_ONLY_REFERENCE',
] as const);

export type AuthoritySupportImpersonationMode =
  (typeof AUTHORITY_SUPPORT_IMPERSONATION_MODES)[number];

export interface ResolvedSupportTenantScopeV1
  extends ResolvedAuthorityTenantScopeBaseV1 {
  readonly scopeType: 'SUPPORT';
  readonly supportSessionId: string;
  readonly operatorPrincipalId: string;
  readonly requestedTenantId: AuthorityTenantIdV1;
  readonly supportScopeReasonCode: string;
  readonly allowedUntil: string;
  readonly impersonationMode: AuthoritySupportImpersonationMode;
  readonly source: 'SUPPORT_SESSION';
}

export type ResolvedAuthorityTenantScopeV1 =
  | ResolvedTenantAuthorityScopeV1
  | ResolvedPlatformAuthorityScopeV1
  | ResolvedTenantBootstrapScopeV1
  | ResolvedLegacyCanonicalizationScopeV1
  | ResolvedMigrationTenantScopeV1
  | ResolvedSupportTenantScopeV1;

export interface AuthorityResolvedPrincipalReferenceV1 {
  readonly schemaVersion:
    typeof AUTHORITY_TENANT_SCOPE_PRINCIPAL_REFERENCE_VERSION;
  readonly principalId: string;
  readonly principalType: AuthorityPrincipalType;
  readonly principalBindingVersion: string;
  readonly principalEvidenceFingerprint: string;
  readonly principalResolvedAt: string;
}

export const AUTHORITY_TENANT_SCOPE_OPERATION_CATEGORIES = Object.freeze([
  'TENANT_OPERATION',
  'PLATFORM_OPERATION',
  'BOOTSTRAP_OPERATION',
  'CANONICALIZATION_OPERATION',
  'MIGRATION_OPERATION',
  'SUPPORT_OPERATION',
] as const);

export type AuthorityTenantScopeOperationCategory =
  (typeof AUTHORITY_TENANT_SCOPE_OPERATION_CATEGORIES)[number];

export interface AuthorityTenantScopeResolutionRequestV1 {
  readonly schemaVersion: typeof AUTHORITY_TENANT_SCOPE_REQUEST_VERSION;
  readonly principalReference: AuthorityResolvedPrincipalReferenceV1;
  readonly selector: AuthorityTenantSelectorV1;
  readonly channel: AuthorityPrincipalResolutionChannel;
  readonly requestId: string;
  readonly correlationId: string;
  readonly resolutionTime: string;
  readonly operationCategory?: AuthorityTenantScopeOperationCategory;
}

export interface AuthorityTenantScopeResolutionContextV1 {
  readonly schemaVersion: typeof AUTHORITY_TENANT_SCOPE_CONTEXT_VERSION;
  readonly requestId: string;
  readonly correlationId: string;
  readonly channel: AuthorityPrincipalResolutionChannel;
  readonly resolutionTime: string;
  readonly resolverVersion: string;
  readonly cancellationPolicy: 'EXTERNAL_EXECUTION_CONTEXT';
}

export const AUTHORITY_TENANT_SCOPE_RESOLUTION_STATUSES = Object.freeze([
  'RESOLVED',
  'NOT_FOUND',
  'REJECTED',
  'STALE',
  'REVOKED',
  'CONFLICT',
  'AMBIGUOUS',
  'INTERNAL_ERROR',
] as const);

export type AuthorityTenantScopeResolutionStatus =
  (typeof AUTHORITY_TENANT_SCOPE_RESOLUTION_STATUSES)[number];

export const AUTHORITY_TENANT_SCOPE_REASON_CODES = Object.freeze([
  'TENANT_NOT_FOUND',
  'TENANT_DISABLED',
  'TENANT_REVOKED',
  'TENANT_AUTHORITY_STALE',
  'TENANT_SELECTOR_INVALID',
  'TENANT_ALIAS_NOT_FOUND',
  'TENANT_ALIAS_AMBIGUOUS',
  'MEMBERSHIP_NOT_FOUND',
  'MEMBERSHIP_INACTIVE',
  'MEMBERSHIP_STALE',
  'PRINCIPAL_TENANT_BINDING_CONFLICT',
  'PLATFORM_SCOPE_NOT_SUPPORTED',
  'BOOTSTRAP_SCOPE_INVALID',
  'LEGACY_SOURCE_NOT_FOUND',
  'LEGACY_SOURCE_CONFLICT',
  'MIGRATION_SCOPE_INVALID',
  'SUPPORT_SCOPE_INVALID',
  'SUPPORT_SESSION_EXPIRED',
  'INVALID_RESOLUTION_REQUEST',
  'INTERNAL_RESOLUTION_FAILURE',
] as const);

export type AuthorityTenantScopeReasonCode =
  (typeof AUTHORITY_TENANT_SCOPE_REASON_CODES)[number];

export const AUTHORITY_TENANT_SCOPE_RETRY_DISPOSITIONS = Object.freeze([
  'DO_NOT_RETRY',
  'SAFE_TO_RETRY',
  'RETRY_AFTER_REFRESH',
  'RETRY_AFTER_MEMBERSHIP_REFRESH',
  'RETRY_AFTER_TENANT_REFRESH',
  'RETRY_AFTER_OPERATOR_REVIEW',
] as const);

export type AuthorityTenantScopeRetryDisposition =
  (typeof AUTHORITY_TENANT_SCOPE_RETRY_DISPOSITIONS)[number];

export interface AuthorityTenantScopeSafeMetadataV1 {
  readonly resolverReference?: string;
  readonly evidenceFingerprint?: string;
}

interface AuthorityTenantScopeFailureResultV1 {
  readonly schemaVersion: typeof AUTHORITY_TENANT_SCOPE_RESULT_VERSION;
  readonly status: Exclude<AuthorityTenantScopeResolutionStatus, 'RESOLVED'>;
  readonly reasonCode: AuthorityTenantScopeReasonCode;
  readonly retryDisposition: AuthorityTenantScopeRetryDisposition;
  readonly resolverVersion: string;
  readonly resolvedAt: string;
  readonly safeMetadata?: AuthorityTenantScopeSafeMetadataV1;
}

export type AuthorityTenantScopeResolutionResultV1 =
  | Readonly<{
      schemaVersion: typeof AUTHORITY_TENANT_SCOPE_RESULT_VERSION;
      status: 'RESOLVED';
      scope: ResolvedAuthorityTenantScopeV1;
    }>
  | Readonly<AuthorityTenantScopeFailureResultV1>;
