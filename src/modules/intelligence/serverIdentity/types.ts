import type {
  TrustedAuthenticationMethod,
  TrustedResourceScopeV1,
  TrustedServerPrincipalType,
  TrustedServerPrincipalV1,
  TrustedTenantMembershipRole,
  TrustedTenantMembershipV1,
} from '../serverComposition/types';

export const VERIFIED_IDENTITY_TENANT_BINDING_SCHEMA_VERSION = '1' as const;
export const VERIFIED_AUTHENTICATION_SUBJECT_VERSION = '1' as const;
export const VERIFIED_IDENTITY_BINDING_VERSION = '1' as const;
export const CANONICAL_TENANT_AUTHORITY_VERSION = '1' as const;
export const TENANT_SELECTOR_HINT_VERSION = '1' as const;
export const SERVER_OWNED_TENANT_MEMBERSHIP_VERSION = '1' as const;
export const IDENTITY_RESOLUTION_CONTRACT_VERSION = '1' as const;
export const IDENTITY_CLAIMS_PROJECTION_VERSION = '1' as const;
export const TENANT_MEMBERSHIP_KEY_VERSION = '1' as const;
export const VERIFIED_IDENTITY_TENANT_BINDING_CONTRACT_ERROR_VERSION = '1' as const;

export const VERIFIED_IDENTITY_PROVIDERS = [
  'FIREBASE_AUTH',
  'GOOGLE_CLOUD_IAM',
] as const;

export type VerifiedIdentityProvider = (typeof VERIFIED_IDENTITY_PROVIDERS)[number];

export const VERIFIED_AUTHENTICATION_ASSURANCE_LEVELS = [
  'STANDARD',
  'HARDWARE_BACKED',
  'WORKLOAD_ATTESTED',
] as const;

export type VerifiedAuthenticationAssuranceLevel =
  (typeof VERIFIED_AUTHENTICATION_ASSURANCE_LEVELS)[number];

export interface VerifiedAuthenticationSubjectV1 {
  readonly schemaVersion: typeof VERIFIED_AUTHENTICATION_SUBJECT_VERSION;
  readonly subjectType: TrustedServerPrincipalType;
  readonly provider: VerifiedIdentityProvider;
  readonly providerSubjectId: string;
  readonly authenticationMethod: TrustedAuthenticationMethod;
  readonly authenticatedAt: string;
  readonly tokenIssuedAt: string;
  readonly tokenExpiresAt: string;
  readonly revocationCheckedAt: string;
  readonly credentialVersion: string;
  readonly assurance?: VerifiedAuthenticationAssuranceLevel;
  readonly claimsFingerprint?: string;
}

interface VerifiedIdentityBindingBaseV1 {
  readonly schemaVersion: typeof VERIFIED_IDENTITY_BINDING_VERSION;
  readonly bindingVersion: string;
  readonly providerSubjectId: string;
  readonly canonicalPrincipalId: string;
  readonly bindingId: string;
  readonly status: 'ACTIVE';
  readonly verifiedAt: string;
  readonly resolverVersion: string;
}

export interface VerifiedUserIdentityBindingV1 extends VerifiedIdentityBindingBaseV1 {
  readonly principalType: 'USER';
  readonly provider: 'FIREBASE_AUTH';
  readonly firebaseUid: string;
}

export interface VerifiedServiceIdentityBindingV1 extends VerifiedIdentityBindingBaseV1 {
  readonly principalType: 'SERVICE';
  readonly provider: 'GOOGLE_CLOUD_IAM';
  readonly iamEvidenceFingerprint?: string;
}

export interface VerifiedSystemIdentityBindingV1 extends VerifiedIdentityBindingBaseV1 {
  readonly principalType: 'SYSTEM';
  readonly provider: 'GOOGLE_CLOUD_IAM';
  readonly iamEvidenceFingerprint?: string;
}

export type VerifiedIdentityBindingV1 =
  | VerifiedUserIdentityBindingV1
  | VerifiedServiceIdentityBindingV1
  | VerifiedSystemIdentityBindingV1;

export interface CanonicalTenantAuthorityV1 {
  readonly schemaVersion: typeof CANONICAL_TENANT_AUTHORITY_VERSION;
  readonly tenantId: string;
  readonly status: 'ACTIVE';
  readonly authorityVersion: string;
  readonly resolvedAt: string;
  readonly tenantRecordVersion: string;
  readonly tenantSlug?: string;
  readonly organizationReference?: string;
  readonly clientReference?: string;
}

export const TENANT_SELECTOR_STRATEGIES = [
  'EXPLICIT_CANONICAL_ID',
  'EXPLICIT_SLUG',
  'RESOURCE_BOUND',
] as const;

export type TenantSelectorStrategy = (typeof TENANT_SELECTOR_STRATEGIES)[number];

export type TenantSelectorHintV1 =
  | Readonly<{
      schemaVersion: typeof TENANT_SELECTOR_HINT_VERSION;
      hintClassification: 'NON_AUTHORITATIVE';
      selectionStrategy: 'EXPLICIT_CANONICAL_ID';
      canonicalTenantIdCandidate: string;
    }>
  | Readonly<{
      schemaVersion: typeof TENANT_SELECTOR_HINT_VERSION;
      hintClassification: 'NON_AUTHORITATIVE';
      selectionStrategy: 'EXPLICIT_SLUG';
      tenantSlugCandidate: string;
    }>
  | Readonly<{
      schemaVersion: typeof TENANT_SELECTOR_HINT_VERSION;
      hintClassification: 'NON_AUTHORITATIVE';
      selectionStrategy: 'RESOURCE_BOUND';
      resourceTenantReference: string;
    }>;

export const SERVER_OWNED_TENANT_MEMBERSHIP_STATUSES = [
  'ACTIVE',
  'SUSPENDED',
  'REVOKED',
  'DELETED',
] as const;

export type ServerOwnedTenantMembershipStatus =
  (typeof SERVER_OWNED_TENANT_MEMBERSHIP_STATUSES)[number];

export interface ServerOwnedTenantMembershipRecordV1 {
  readonly schemaVersion: typeof SERVER_OWNED_TENANT_MEMBERSHIP_VERSION;
  readonly membershipId: string;
  readonly principalType: TrustedServerPrincipalType;
  readonly principalId: string;
  readonly tenantId: string;
  readonly roles: readonly TrustedTenantMembershipRole[];
  readonly status: ServerOwnedTenantMembershipStatus;
  readonly membershipVersion: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly revokedAt?: string;
  readonly authorityVersion: string;
}

export interface CanonicalTenantMembershipKeyInputV1 {
  readonly principalType: TrustedServerPrincipalType;
  readonly principalId: string;
  readonly tenantId: string;
}

export interface ResolverInvocationIdentityV1 {
  readonly schemaVersion: typeof IDENTITY_RESOLUTION_CONTRACT_VERSION;
  readonly invocationId: string;
  readonly invokerType: 'SERVER_COMPONENT';
  readonly invokerId: string;
  readonly invokedAt: string;
  readonly resolverVersion: string;
}

export const NEUTRAL_AUTHENTICATION_TRANSPORTS = [
  'HTTPS_CALLABLE',
  'HTTPS_REQUEST',
  'INTERNAL_SERVICE',
  'BACKGROUND_TASK',
] as const;

export type NeutralAuthenticationTransport =
  (typeof NEUTRAL_AUTHENTICATION_TRANSPORTS)[number];

export interface NeutralAuthenticationContextV1 {
  readonly schemaVersion: typeof IDENTITY_RESOLUTION_CONTRACT_VERSION;
  readonly transport: NeutralAuthenticationTransport;
  readonly authenticationEventId?: string;
  readonly audience?: string;
  readonly issuer?: string;
}

export interface PrincipalResolutionInputV1 {
  readonly schemaVersion: typeof IDENTITY_RESOLUTION_CONTRACT_VERSION;
  readonly verifiedSubject: VerifiedAuthenticationSubjectV1;
  readonly resolverInvocation: ResolverInvocationIdentityV1;
  readonly authenticationContext?: NeutralAuthenticationContextV1;
}

export interface TenantMembershipResolutionInputV1 {
  readonly schemaVersion: typeof IDENTITY_RESOLUTION_CONTRACT_VERSION;
  readonly trustedPrincipal: TrustedServerPrincipalV1;
  readonly tenantSelector: TenantSelectorHintV1;
  readonly consumerId: string;
  readonly source: string;
  readonly resourceScope: TrustedResourceScopeV1;
  readonly resolverInvocation: ResolverInvocationIdentityV1;
}

export const PRINCIPAL_RESOLUTION_REJECTION_REASONS = [
  'SUBJECT_INVALID',
  'SUBJECT_EXPIRED',
  'REVOCATION_UNVERIFIED',
  'IDENTITY_BINDING_INVALID',
  'IDENTITY_BINDING_INCONSISTENT',
  'PRINCIPAL_NOT_ACTIVE',
] as const;

export type PrincipalResolutionRejectionReason =
  (typeof PRINCIPAL_RESOLUTION_REJECTION_REASONS)[number];

export type PrincipalResolutionResultV1 =
  | Readonly<{
      schemaVersion: typeof IDENTITY_RESOLUTION_CONTRACT_VERSION;
      status: 'RESOLVED';
      principal: TrustedServerPrincipalV1;
      bindingVersion: string;
      resolverVersion: string;
      resolvedAt: string;
    }>
  | Readonly<{
      schemaVersion: typeof IDENTITY_RESOLUTION_CONTRACT_VERSION;
      status: 'REJECTED';
      reasonCode: PrincipalResolutionRejectionReason;
      resolverVersion: string;
      resolvedAt: string;
    }>;

export const TENANT_MEMBERSHIP_RESOLUTION_REASONS = [
  'TENANT_SELECTOR_REQUIRED',
  'TENANT_SELECTOR_INVALID',
  'TENANT_NOT_FOUND',
  'TENANT_AMBIGUOUS',
  'MEMBERSHIP_NOT_FOUND',
  'MEMBERSHIP_DUPLICATE',
  'MEMBERSHIP_INACTIVE',
  'PRINCIPAL_MISMATCH',
  'TENANT_MISMATCH',
  'TENANT_INACTIVE',
] as const;

export type TenantMembershipResolutionReason =
  (typeof TENANT_MEMBERSHIP_RESOLUTION_REASONS)[number];

export type TenantMembershipResolutionResultV1 =
  | Readonly<{
      schemaVersion: typeof IDENTITY_RESOLUTION_CONTRACT_VERSION;
      status: 'RESOLVED';
      tenant: CanonicalTenantAuthorityV1;
      membership: TrustedTenantMembershipV1;
      membershipVersion: string;
      resolverVersion: string;
      resolvedAt: string;
    }>
  | Readonly<{
      schemaVersion: typeof IDENTITY_RESOLUTION_CONTRACT_VERSION;
      status: 'REJECTED' | 'AMBIGUOUS';
      reasonCode: TenantMembershipResolutionReason;
      resolverVersion: string;
      resolvedAt: string;
    }>;

export interface IdentityClaimsProjectionV1 {
  readonly schemaVersion: typeof IDENTITY_CLAIMS_PROJECTION_VERSION;
  readonly classification: 'DERIVED';
  readonly authorityUse: 'PROHIBITED';
  readonly principalType: TrustedServerPrincipalType;
  readonly canonicalPrincipalId: string;
  readonly projectionVersion: string;
  readonly sourceBindingVersion: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly claimsFingerprint?: string;
  readonly tenantId?: string;
  readonly roles?: readonly TrustedTenantMembershipRole[];
}

export interface TrustedPrincipalFromVerifiedBindingInputV1 {
  readonly subject: VerifiedAuthenticationSubjectV1;
  readonly binding: VerifiedIdentityBindingV1;
}

export interface TrustedTenantMembershipFromAuthorityInputV1 {
  readonly principal: TrustedServerPrincipalV1;
  readonly tenant: CanonicalTenantAuthorityV1;
  readonly membership: ServerOwnedTenantMembershipRecordV1;
  readonly resolvedAt: string;
  readonly resolverVersion: string;
}
