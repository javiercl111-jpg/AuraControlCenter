export const AUTHORITY_PRINCIPAL_RESOLUTION_SCHEMA_VERSION = '1' as const;
export const AUTHORITY_RESOLVED_PRINCIPAL_VERSION = '1' as const;
export const AUTHORITY_PRINCIPAL_ID_BINDING_VERSION = '1' as const;
export const AUTHORITY_AUTHENTICATION_BINDING_VERSION = '1' as const;
export const AUTHORITY_AUTHENTICATION_ASSURANCE_VERSION = '1' as const;
export const AUTHORITY_AUTHENTICATION_CLAIMS_SNAPSHOT_VERSION = '1' as const;
export const AUTHORITY_APP_CHECK_EVIDENCE_VERSION = '1' as const;
export const AUTHORITY_PRINCIPAL_RESOLUTION_EVIDENCE_VERSION = '1' as const;
export const AUTHORITY_PRINCIPAL_FRESHNESS_VERSION = '1' as const;
export const AUTHORITY_PRINCIPAL_RESOLUTION_REQUEST_VERSION = '1' as const;
export const AUTHORITY_PRINCIPAL_RESOLUTION_CONTEXT_VERSION = '1' as const;
export const AUTHORITY_PRINCIPAL_RESOLUTION_RESULT_VERSION = '1' as const;
export const AUTHORITY_PRINCIPAL_CONTRACT_ERROR_VERSION = '1' as const;

export const AUTHORITY_PRINCIPAL_TYPES = Object.freeze([
  'HUMAN_USER',
  'INTERNAL_SERVICE',
  'SYSTEM_ACTOR',
  'MIGRATION_ACTOR',
  'SUPPORT_OPERATOR',
] as const);

export type AuthorityPrincipalType =
  (typeof AUTHORITY_PRINCIPAL_TYPES)[number];

export const AUTHORITY_PRINCIPAL_STATUSES = Object.freeze([
  'ACTIVE',
  'SUSPENDED',
  'REVOKED',
  'DISABLED',
] as const);

export type AuthorityPrincipalStatus =
  (typeof AUTHORITY_PRINCIPAL_STATUSES)[number];

export const AUTHORITY_AUTHENTICATION_METHODS = Object.freeze([
  'FIREBASE_ID_TOKEN',
  'IAM_OIDC',
  'SERVICE_ACCOUNT_ASSERTION',
  'INTERNAL_SYSTEM_CAPABILITY',
  'MIGRATION_CAPABILITY',
  'SUPPORT_SESSION',
] as const);

export type AuthorityAuthenticationMethod =
  (typeof AUTHORITY_AUTHENTICATION_METHODS)[number];

export const AUTHORITY_FIREBASE_AUTH_PROVIDERS = Object.freeze([
  'FIREBASE_PASSWORD',
  'FEDERATED_OIDC',
  'SAML',
  'PHONE',
  'CUSTOM_TOKEN',
] as const);

export type AuthorityFirebaseAuthProvider =
  (typeof AUTHORITY_FIREBASE_AUTH_PROVIDERS)[number];

export const AUTHORITY_AUTHENTICATION_ASSURANCE_LEVELS = Object.freeze([
  'LOW',
  'STANDARD',
  'HIGH',
  'SYSTEM_ATTESTED',
] as const);

export type AuthorityAuthenticationAssuranceLevel =
  (typeof AUTHORITY_AUTHENTICATION_ASSURANCE_LEVELS)[number];

export const AUTHORITY_APP_CHECK_EVIDENCE_STATUSES = Object.freeze([
  'REQUIRED_AND_VALID',
  'NOT_APPLICABLE_INTERNAL_CALLER',
  'NOT_EVALUATED',
] as const);

export type AuthorityAppCheckEvidenceStatus =
  (typeof AUTHORITY_APP_CHECK_EVIDENCE_STATUSES)[number];

export type AuthorityAppCheckEvidenceV1 =
  | Readonly<{
      schemaVersion: typeof AUTHORITY_APP_CHECK_EVIDENCE_VERSION;
      status: 'REQUIRED_AND_VALID';
      applicationIdHash: string;
      attestationProvider: string;
      verifiedAt: string;
      replayProtection: 'ENFORCED';
    }>
  | Readonly<{
      schemaVersion: typeof AUTHORITY_APP_CHECK_EVIDENCE_VERSION;
      status: 'NOT_APPLICABLE_INTERNAL_CALLER';
      reason: 'NON_APP_CALLER';
    }>
  | Readonly<{
      schemaVersion: typeof AUTHORITY_APP_CHECK_EVIDENCE_VERSION;
      status: 'NOT_EVALUATED';
      reason: 'PRE_RESOLUTION_ONLY';
    }>;

export interface AuthorityAuthenticationAssuranceV1 {
  readonly schemaVersion: typeof AUTHORITY_AUTHENTICATION_ASSURANCE_VERSION;
  readonly level: AuthorityAuthenticationAssuranceLevel;
  readonly authenticationMethod: AuthorityAuthenticationMethod;
  readonly authenticatedAt: string;
  readonly freshnessWindowSeconds: number;
  readonly secondFactorSatisfied: boolean;
  readonly appCheckEvidence: AuthorityAppCheckEvidenceV1;
  readonly tokenRevocationChecked: boolean;
  readonly issuerValidated: boolean;
  readonly audienceValidated: boolean;
}

export interface AuthorityAuthenticationClaimsSnapshotV1 {
  readonly schemaVersion:
    typeof AUTHORITY_AUTHENTICATION_CLAIMS_SNAPSHOT_VERSION;
  readonly claimsVersion?: string;
  readonly tokenIssuedAt: string;
  readonly tokenAuthTime: string;
  readonly tokenExpiresAt: string;
  readonly issuer: string;
  readonly audience: string;
  readonly subjectFingerprint: string;
  readonly snapshotFingerprint: string;
}

interface AuthorityAuthenticationBindingBaseV1 {
  readonly schemaVersion: typeof AUTHORITY_AUTHENTICATION_BINDING_VERSION;
  readonly bindingId: string;
  readonly bindingVersion: string;
  readonly authenticationMethod: AuthorityAuthenticationMethod;
}

export interface AuthorityFirebaseUserAuthenticationBindingV1
  extends AuthorityAuthenticationBindingBaseV1 {
  readonly bindingType: 'FIREBASE_USER';
  readonly authenticationMethod: 'FIREBASE_ID_TOKEN';
  readonly firebaseUid: string;
  readonly platformUserId: string;
  readonly tokenIssuedAt: string;
  readonly tokenAuthTime: string;
  readonly authProvider: AuthorityFirebaseAuthProvider;
  readonly tokenIdHash?: string;
  readonly claimsVersion?: string;
}

export interface AuthorityIamServiceAuthenticationBindingV1
  extends AuthorityAuthenticationBindingBaseV1 {
  readonly bindingType: 'IAM_SERVICE';
  readonly authenticationMethod: 'IAM_OIDC' | 'SERVICE_ACCOUNT_ASSERTION';
  readonly servicePrincipalId: string;
  readonly issuer: string;
  readonly subject: string;
  readonly audience: string;
  readonly issuedAt: string;
  readonly credentialIdHash?: string;
}

export interface AuthoritySystemAuthenticationBindingV1
  extends AuthorityAuthenticationBindingBaseV1 {
  readonly bindingType: 'SYSTEM';
  readonly authenticationMethod: 'INTERNAL_SYSTEM_CAPABILITY';
  readonly systemActorId: string;
  readonly executionOrigin: string;
  readonly capabilityBindingId: string;
  readonly attestationFingerprint: string;
}

export interface AuthorityMigrationAuthenticationBindingV1
  extends AuthorityAuthenticationBindingBaseV1 {
  readonly bindingType: 'MIGRATION';
  readonly authenticationMethod: 'MIGRATION_CAPABILITY';
  readonly migrationId: string;
  readonly migrationRunId: string;
  readonly executionIdentity: string;
  readonly batchId: string;
  readonly attestationFingerprint: string;
}

export interface AuthoritySupportAuthenticationBindingV1
  extends AuthorityAuthenticationBindingBaseV1 {
  readonly bindingType: 'SUPPORT';
  readonly authenticationMethod: 'SUPPORT_SESSION';
  readonly operatorId: string;
  readonly supportSessionId: string;
  readonly operatorAuthentication:
    AuthorityFirebaseUserAuthenticationBindingV1;
}

export type AuthorityAuthenticationBindingV1 =
  | AuthorityFirebaseUserAuthenticationBindingV1
  | AuthorityIamServiceAuthenticationBindingV1
  | AuthoritySystemAuthenticationBindingV1
  | AuthorityMigrationAuthenticationBindingV1
  | AuthoritySupportAuthenticationBindingV1;

export interface AuthorityCanonicalPrincipalIdBindingV1 {
  readonly schemaVersion: typeof AUTHORITY_PRINCIPAL_ID_BINDING_VERSION;
  readonly bindingId: string;
  readonly bindingVersion: string;
  readonly principalType: AuthorityPrincipalType;
  readonly canonicalPrincipalId: string;
  readonly canonicalSubjectId: string;
  readonly status: 'ACTIVE';
  readonly evidenceFingerprint: string;
}

export const AUTHORITY_PRINCIPAL_AUTHENTICATION_SOURCES = Object.freeze([
  'FIREBASE_AUTH',
  'GOOGLE_CLOUD_IAM',
  'INTERNAL_CAPABILITY_REGISTRY',
  'MIGRATION_MANIFEST',
  'SUPPORT_SESSION_REGISTRY',
] as const);

export type AuthorityPrincipalAuthenticationSource =
  (typeof AUTHORITY_PRINCIPAL_AUTHENTICATION_SOURCES)[number];

export const AUTHORITY_PRINCIPAL_BINDING_SOURCES = Object.freeze([
  'PLATFORM_IDENTITY_REGISTRY',
  'SERVICE_IDENTITY_REGISTRY',
  'SYSTEM_CAPABILITY_REGISTRY',
  'MIGRATION_REGISTRY',
  'SUPPORT_SESSION_REGISTRY',
] as const);

export type AuthorityPrincipalBindingSource =
  (typeof AUTHORITY_PRINCIPAL_BINDING_SOURCES)[number];

export const AUTHORITY_REVOCATION_CHECK_STATUSES = Object.freeze([
  'CHECKED_VALID',
  'NOT_APPLICABLE_INTERNAL_CALLER',
] as const);

export type AuthorityRevocationCheckStatus =
  (typeof AUTHORITY_REVOCATION_CHECK_STATUSES)[number];

export interface AuthorityPrincipalResolutionEvidenceV1 {
  readonly schemaVersion:
    typeof AUTHORITY_PRINCIPAL_RESOLUTION_EVIDENCE_VERSION;
  readonly authenticationSource: AuthorityPrincipalAuthenticationSource;
  readonly bindingSource: AuthorityPrincipalBindingSource;
  readonly canonicalBindingVersion: string;
  readonly claimsVersion?: string;
  readonly claimsSnapshot?: AuthorityAuthenticationClaimsSnapshotV1;
  readonly revocationCheckStatus: AuthorityRevocationCheckStatus;
  readonly assuranceLevel: AuthorityAuthenticationAssuranceLevel;
  readonly resolverVersion: string;
  readonly resolvedAt: string;
  readonly evidenceFingerprint: string;
}

export interface AuthorityPrincipalFreshnessV1 {
  readonly schemaVersion: typeof AUTHORITY_PRINCIPAL_FRESHNESS_VERSION;
  readonly resolvedAt: string;
  readonly validUntil: string;
  readonly sourceVersion: string;
  readonly claimsVersion?: string;
  readonly bindingVersion: string;
  readonly revocationCheckedAt?: string;
  readonly staleAfterSeconds: number;
}

interface ResolvedAuthorityPrincipalBaseV1 {
  readonly schemaVersion: typeof AUTHORITY_PRINCIPAL_RESOLUTION_SCHEMA_VERSION;
  readonly version: typeof AUTHORITY_RESOLVED_PRINCIPAL_VERSION;
  readonly principalId: string;
  readonly principalType: AuthorityPrincipalType;
  readonly status: AuthorityPrincipalStatus;
  readonly authenticationBinding: AuthorityAuthenticationBindingV1;
  readonly assurance: AuthorityAuthenticationAssuranceV1;
  readonly resolutionEvidence: AuthorityPrincipalResolutionEvidenceV1;
  readonly resolvedAt: string;
  readonly freshness: AuthorityPrincipalFreshnessV1;
}

export interface ResolvedHumanAuthorityPrincipalV1
  extends ResolvedAuthorityPrincipalBaseV1 {
  readonly principalType: 'HUMAN_USER';
  readonly firebaseUid: string;
  readonly platformUserId: string;
  readonly authenticationBinding:
    AuthorityFirebaseUserAuthenticationBindingV1;
}

export interface ResolvedInternalServicePrincipalV1
  extends ResolvedAuthorityPrincipalBaseV1 {
  readonly principalType: 'INTERNAL_SERVICE';
  readonly servicePrincipalId: string;
  readonly serviceName: string;
  readonly authenticationBinding:
    AuthorityIamServiceAuthenticationBindingV1;
}

export interface ResolvedSystemActorPrincipalV1
  extends ResolvedAuthorityPrincipalBaseV1 {
  readonly principalType: 'SYSTEM_ACTOR';
  readonly systemActorId: string;
  readonly executionOrigin: string;
  readonly capabilityBindingId: string;
  readonly authenticationBinding: AuthoritySystemAuthenticationBindingV1;
}

export interface ResolvedMigrationActorPrincipalV1
  extends ResolvedAuthorityPrincipalBaseV1 {
  readonly principalType: 'MIGRATION_ACTOR';
  readonly migrationId: string;
  readonly migrationRunId: string;
  readonly executionPrincipalId: string;
  readonly batchScope: string;
  readonly changeReference?: string;
  readonly authenticationBinding:
    AuthorityMigrationAuthenticationBindingV1;
}

export interface ResolvedSupportOperatorPrincipalV1
  extends ResolvedAuthorityPrincipalBaseV1 {
  readonly principalType: 'SUPPORT_OPERATOR';
  readonly operatorPrincipalId: string;
  readonly supportSessionId: string;
  readonly impersonation: 'PROHIBITED';
  readonly authenticationBinding:
    AuthoritySupportAuthenticationBindingV1;
}

export type ResolvedAuthorityPrincipalV1 =
  | ResolvedHumanAuthorityPrincipalV1
  | ResolvedInternalServicePrincipalV1
  | ResolvedSystemActorPrincipalV1
  | ResolvedMigrationActorPrincipalV1
  | ResolvedSupportOperatorPrincipalV1;

interface AuthorityPrincipalResolutionRequestBaseV1 {
  readonly schemaVersion:
    typeof AUTHORITY_PRINCIPAL_RESOLUTION_REQUEST_VERSION;
  readonly requestType: string;
  readonly authenticationMethod: AuthorityAuthenticationMethod;
}

export interface AuthorityFirebasePrincipalResolutionRequestV1
  extends AuthorityPrincipalResolutionRequestBaseV1 {
  readonly requestType: 'VERIFIED_FIREBASE_USER';
  readonly authenticationMethod: 'FIREBASE_ID_TOKEN';
  readonly firebaseUid: string;
  readonly tokenIssuedAt: string;
  readonly tokenAuthTime: string;
  readonly authenticatedAt: string;
  readonly authProvider: AuthorityFirebaseAuthProvider;
  readonly tokenIdHash?: string;
  readonly claimsVersion?: string;
  readonly revocationCheckedAt: string;
  readonly issuer: string;
  readonly audience: string;
  readonly appCheckEvidence: AuthorityAppCheckEvidenceV1;
}

export interface AuthorityIamPrincipalResolutionRequestV1
  extends AuthorityPrincipalResolutionRequestBaseV1 {
  readonly requestType: 'VERIFIED_IAM_SERVICE';
  readonly authenticationMethod: 'IAM_OIDC' | 'SERVICE_ACCOUNT_ASSERTION';
  readonly servicePrincipalId: string;
  readonly issuer: string;
  readonly subject: string;
  readonly audience: string;
  readonly issuedAt: string;
  readonly authenticatedAt: string;
  readonly credentialIdHash?: string;
}

export interface AuthoritySystemPrincipalResolutionRequestV1
  extends AuthorityPrincipalResolutionRequestBaseV1 {
  readonly requestType: 'VERIFIED_SYSTEM_CAPABILITY';
  readonly authenticationMethod: 'INTERNAL_SYSTEM_CAPABILITY';
  readonly systemActorId: string;
  readonly executionOrigin: string;
  readonly capabilityBindingId: string;
  readonly attestationFingerprint: string;
  readonly authenticatedAt: string;
}

export interface AuthorityMigrationPrincipalResolutionRequestV1
  extends AuthorityPrincipalResolutionRequestBaseV1 {
  readonly requestType: 'VERIFIED_MIGRATION_INVOCATION';
  readonly authenticationMethod: 'MIGRATION_CAPABILITY';
  readonly migrationId: string;
  readonly migrationRunId: string;
  readonly executionPrincipalId: string;
  readonly batchId: string;
  readonly batchScope: string;
  readonly changeReference?: string;
  readonly attestationFingerprint: string;
  readonly authenticatedAt: string;
}

export interface AuthoritySupportPrincipalResolutionRequestV1
  extends AuthorityPrincipalResolutionRequestBaseV1 {
  readonly requestType: 'VERIFIED_SUPPORT_SESSION';
  readonly authenticationMethod: 'SUPPORT_SESSION';
  readonly operatorPrincipalId: string;
  readonly supportSessionId: string;
  readonly firebaseUid: string;
  readonly tokenIssuedAt: string;
  readonly tokenAuthTime: string;
  readonly authenticatedAt: string;
  readonly authProvider: AuthorityFirebaseAuthProvider;
  readonly tokenIdHash?: string;
  readonly claimsVersion?: string;
  readonly revocationCheckedAt: string;
  readonly issuer: string;
  readonly audience: string;
  readonly appCheckEvidence: AuthorityAppCheckEvidenceV1;
}

export type AuthorityPrincipalResolutionRequestV1 =
  | AuthorityFirebasePrincipalResolutionRequestV1
  | AuthorityIamPrincipalResolutionRequestV1
  | AuthoritySystemPrincipalResolutionRequestV1
  | AuthorityMigrationPrincipalResolutionRequestV1
  | AuthoritySupportPrincipalResolutionRequestV1;

export const AUTHORITY_PRINCIPAL_RESOLUTION_CHANNELS = Object.freeze([
  'FIREBASE_CALLABLE',
  'HTTPS_SERVER',
  'INTERNAL_SERVICE',
  'BACKGROUND_TASK',
  'MIGRATION_TOOL',
  'SUPPORT_TOOL',
] as const);

export type AuthorityPrincipalResolutionChannel =
  (typeof AUTHORITY_PRINCIPAL_RESOLUTION_CHANNELS)[number];

export interface AuthorityPrincipalResolutionContextV1 {
  readonly schemaVersion:
    typeof AUTHORITY_PRINCIPAL_RESOLUTION_CONTEXT_VERSION;
  readonly requestId: string;
  readonly correlationId: string;
  readonly channel: AuthorityPrincipalResolutionChannel;
  readonly resolverVersion: string;
  readonly resolutionTime: string;
}

export const AUTHORITY_PRINCIPAL_RESOLUTION_STATUSES = Object.freeze([
  'RESOLVED',
  'NOT_FOUND',
  'REJECTED',
  'STALE',
  'REVOKED',
  'CONFLICT',
  'INTERNAL_ERROR',
] as const);

export type AuthorityPrincipalResolutionStatus =
  (typeof AUTHORITY_PRINCIPAL_RESOLUTION_STATUSES)[number];

export const AUTHORITY_PRINCIPAL_RESOLUTION_REASON_CODES = Object.freeze([
  'AUTHENTICATION_BINDING_NOT_FOUND',
  'CANONICAL_USER_BINDING_NOT_FOUND',
  'PRINCIPAL_DISABLED',
  'PRINCIPAL_REVOKED',
  'STALE_AUTHENTICATION',
  'STALE_BINDING',
  'CLAIMS_VERSION_MISMATCH',
  'INVALID_ISSUER',
  'INVALID_AUDIENCE',
  'INVALID_APP_CHECK_EVIDENCE',
  'PRINCIPAL_BINDING_CONFLICT',
  'UNSUPPORTED_PRINCIPAL_TYPE',
  'INVALID_RESOLUTION_REQUEST',
  'INTERNAL_RESOLUTION_FAILURE',
] as const);

export type AuthorityPrincipalResolutionReasonCode =
  (typeof AUTHORITY_PRINCIPAL_RESOLUTION_REASON_CODES)[number];

export const AUTHORITY_PRINCIPAL_RETRY_DISPOSITIONS = Object.freeze([
  'DO_NOT_RETRY',
  'SAFE_TO_RETRY',
  'RETRY_AFTER_REAUTHENTICATION',
  'RETRY_AFTER_REFRESH',
  'RETRY_AFTER_OPERATOR_REVIEW',
] as const);

export type AuthorityPrincipalRetryDisposition =
  (typeof AUTHORITY_PRINCIPAL_RETRY_DISPOSITIONS)[number];

export interface AuthorityPrincipalResolutionSafeMetadataV1 {
  readonly resolverReference?: string;
  readonly evidenceFingerprint?: string;
}

interface AuthorityPrincipalResolutionFailureV1 {
  readonly schemaVersion:
    typeof AUTHORITY_PRINCIPAL_RESOLUTION_RESULT_VERSION;
  readonly status: Exclude<AuthorityPrincipalResolutionStatus, 'RESOLVED'>;
  readonly reasonCode: AuthorityPrincipalResolutionReasonCode;
  readonly retryDisposition: AuthorityPrincipalRetryDisposition;
  readonly resolverVersion: string;
  readonly resolvedAt: string;
  readonly safeMetadata?: AuthorityPrincipalResolutionSafeMetadataV1;
}

export type AuthorityPrincipalResolutionResultV1 =
  | Readonly<{
      schemaVersion:
        typeof AUTHORITY_PRINCIPAL_RESOLUTION_RESULT_VERSION;
      status: 'RESOLVED';
      principal: ResolvedAuthorityPrincipalV1;
    }>
  | Readonly<AuthorityPrincipalResolutionFailureV1>;
