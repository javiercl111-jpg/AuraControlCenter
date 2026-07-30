import type {
  AuthorityOperationType,
} from '../serverAuthorityPersistence/types';
import type {
  AuthorityAuthenticationAssuranceLevel,
  AuthorityAuthenticationMethod,
  AuthorityPrincipalStatus,
  AuthorityPrincipalType,
} from '../serverPrincipalResolution/principalResolutionTypes';
import type {
  AuthorityPlatformBoundary,
  AuthorityTenantScopeStatus,
  AuthorityTenantScopeType,
} from '../serverTenantScopeResolution/tenantScopeResolutionTypes';

export const AUTHORITY_AUTHORIZATION_SCHEMA_VERSION = '1' as const;
export const AUTHORITY_AUTHORIZATION_OPERATION_BINDING_VERSION = '1' as const;
export const AUTHORITY_AUTHORIZATION_PRINCIPAL_BINDING_VERSION = '1' as const;
export const AUTHORITY_AUTHORIZATION_SCOPE_BINDING_VERSION = '1' as const;
export const AUTHORITY_AUTHORIZATION_RESOURCE_BINDING_VERSION = '1' as const;
export const AUTHORITY_AUTHORIZATION_POLICY_EVIDENCE_VERSION = '1' as const;
export const AUTHORITY_AUTHORIZATION_OBLIGATION_VERSION = '1' as const;
export const AUTHORITY_AUTHORIZATION_FRESHNESS_VERSION = '1' as const;
export const AUTHORITY_AUTHORIZATION_REQUEST_VERSION = '1' as const;
export const AUTHORITY_AUTHORIZATION_CONTEXT_VERSION = '1' as const;
export const AUTHORITY_AUTHORIZATION_RESULT_VERSION = '1' as const;
export const AUTHORITY_AUTHORIZATION_ERROR_VERSION = '1' as const;

export const AUTHORITY_AUTHORIZATION_DECISIONS = Object.freeze([
  'ALLOW',
  'DENY',
  'INDETERMINATE',
  'NOT_APPLICABLE',
] as const);

export type AuthorityAuthorizationDecision =
  (typeof AUTHORITY_AUTHORIZATION_DECISIONS)[number];

export const AUTHORITY_PERMISSIONS = Object.freeze([
  'authority.tenant.create',
  'authority.tenant.status.update',
  'authority.membership.create',
  'authority.membership.roles.update',
  'authority.membership.status.update',
  'authority.alias.reserve',
  'authority.alias.tombstone',
  'authority.legacy.canonicalize',
] as const);

export type AuthorityPermissionV1 =
  (typeof AUTHORITY_PERMISSIONS)[number];

export const AUTHORITY_AUTHORIZATION_RESOURCE_TYPES = Object.freeze([
  'TENANT',
  'MEMBERSHIP',
  'ALIAS',
  'LEGACY_TENANT_SOURCE',
] as const);

export type AuthorityAuthorizationResourceType =
  (typeof AUTHORITY_AUTHORIZATION_RESOURCE_TYPES)[number];

export interface AuthorityAuthorizationOperationBindingV1 {
  readonly schemaVersion:
    typeof AUTHORITY_AUTHORIZATION_OPERATION_BINDING_VERSION;
  readonly operationType: AuthorityOperationType;
  readonly permission: AuthorityPermissionV1;
  readonly commandVersion: string;
  readonly resourceType: AuthorityAuthorizationResourceType;
  readonly resourceId: string;
  readonly operationId?: string;
  readonly commandFingerprint?: string;
  readonly requestedAt: string;
  readonly channel: AuthorityAuthorizationChannel;
}

export interface AuthorityAuthorizationPrincipalBindingV1 {
  readonly schemaVersion:
    typeof AUTHORITY_AUTHORIZATION_PRINCIPAL_BINDING_VERSION;
  readonly principalId: string;
  readonly principalType: AuthorityPrincipalType;
  readonly principalStatus: AuthorityPrincipalStatus;
  readonly authenticationMethod: AuthorityAuthenticationMethod;
  readonly assuranceLevel: AuthorityAuthenticationAssuranceLevel;
  readonly principalBindingVersion: string;
  readonly principalEvidenceFingerprint: string;
  readonly resolvedAt: string;
  readonly validUntil: string;
}

interface AuthorityAuthorizationScopeBindingBaseV1 {
  readonly schemaVersion:
    typeof AUTHORITY_AUTHORIZATION_SCOPE_BINDING_VERSION;
  readonly scopeType: AuthorityTenantScopeType;
  readonly scopeStatus: AuthorityTenantScopeStatus;
  readonly tenantAuthorityVersion: string;
  readonly membershipBindingVersion?: string;
  readonly scopeEvidenceFingerprint: string;
  readonly principalId: string;
  readonly resolvedAt: string;
  readonly validUntil: string;
}

export type AuthorityAuthorizationScopeBindingV1 =
  | Readonly<
      AuthorityAuthorizationScopeBindingBaseV1 & {
        readonly scopeType: 'TENANT';
        readonly tenantId: string;
        readonly membershipBindingVersion: string;
      }
    >
  | Readonly<
      AuthorityAuthorizationScopeBindingBaseV1 & {
        readonly scopeType: 'PLATFORM';
        readonly platformBoundary: AuthorityPlatformBoundary;
      }
    >
  | Readonly<
      AuthorityAuthorizationScopeBindingBaseV1 & {
        readonly scopeType: 'TENANT_BOOTSTRAP';
        readonly tenantIdCandidate: string;
        readonly bootstrapRequestId: string;
      }
    >
  | Readonly<
      AuthorityAuthorizationScopeBindingBaseV1 & {
        readonly scopeType: 'LEGACY_CANONICALIZATION';
        readonly canonicalTenantCandidate: string;
        readonly legacySourceFingerprint: string;
      }
    >
  | Readonly<
      AuthorityAuthorizationScopeBindingBaseV1 & {
        readonly scopeType: 'MIGRATION';
        readonly targetTenantId: string;
        readonly migrationId: string;
        readonly migrationRunId: string;
      }
    >
  | Readonly<
      AuthorityAuthorizationScopeBindingBaseV1 & {
        readonly scopeType: 'SUPPORT';
        readonly tenantId: string;
        readonly supportSessionId: string;
      }
    >;

export type AuthorityAuthorizationResourceBindingV1 =
  | Readonly<{
      schemaVersion:
        typeof AUTHORITY_AUTHORIZATION_RESOURCE_BINDING_VERSION;
      resourceType: 'TENANT';
      tenantId: string;
    }>
  | Readonly<{
      schemaVersion:
        typeof AUTHORITY_AUTHORIZATION_RESOURCE_BINDING_VERSION;
      resourceType: 'MEMBERSHIP';
      tenantId: string;
      membershipId: string;
      targetPrincipalId: string;
    }>
  | Readonly<{
      schemaVersion:
        typeof AUTHORITY_AUTHORIZATION_RESOURCE_BINDING_VERSION;
      resourceType: 'ALIAS';
      tenantId: string;
      aliasKey: string;
    }>
  | Readonly<{
      schemaVersion:
        typeof AUTHORITY_AUTHORIZATION_RESOURCE_BINDING_VERSION;
      resourceType: 'LEGACY_TENANT_SOURCE';
      sourceType: 'PLATFORM_TENANTS';
      sourceLocatorKey: string;
      canonicalTenantCandidate: string;
    }>;

export const AUTHORITY_AUTHORIZATION_POLICY_SOURCES = Object.freeze([
  'STATIC_POLICY_REGISTRY',
  'VERSIONED_POLICY_BUNDLE',
  'TEST_CERTIFIED_POLICY',
] as const);

export type AuthorityAuthorizationPolicySource =
  (typeof AUTHORITY_AUTHORIZATION_POLICY_SOURCES)[number];

export interface AuthorityAuthorizationPolicyEvidenceV1 {
  readonly schemaVersion:
    typeof AUTHORITY_AUTHORIZATION_POLICY_EVIDENCE_VERSION;
  readonly policyId: string;
  readonly policyVersion: string;
  readonly evaluatorVersion: string;
  readonly decisionRuleId: string;
  readonly evaluatedAt: string;
  readonly validUntil: string;
  readonly evidenceFingerprint: string;
  readonly inputFingerprint: string;
  readonly principalEvidenceFingerprint: string;
  readonly scopeEvidenceFingerprint: string;
  readonly policySource: AuthorityAuthorizationPolicySource;
  readonly matchedRuleReferences: readonly string[];
  readonly roleSetVersion?: string;
  readonly membershipVersion?: string;
}

export const AUTHORITY_AUTHORIZATION_OBLIGATION_TYPES = Object.freeze([
  'REQUIRE_FRESH_AUTHENTICATION',
  'REQUIRE_APP_CHECK',
  'REQUIRE_MFA',
  'REQUIRE_IDEMPOTENCY_KEY',
  'REQUIRE_EXPECTED_VERSION',
  'REQUIRE_AUDIT_REASON',
  'REQUIRE_CHANGE_TICKET',
  'REQUIRE_SUPPORT_SESSION',
  'REQUIRE_MIGRATION_MANIFEST',
  'MASK_NOT_FOUND',
  'LIMIT_TO_TEST_ONLY',
] as const);

export type AuthorityAuthorizationObligationType =
  (typeof AUTHORITY_AUTHORIZATION_OBLIGATION_TYPES)[number];

export type AuthorityAuthorizationObligationV1 =
  | Readonly<{
      schemaVersion: typeof AUTHORITY_AUTHORIZATION_OBLIGATION_VERSION;
      obligationType: 'REQUIRE_FRESH_AUTHENTICATION';
      maxAuthenticationAgeSeconds: number;
    }>
  | Readonly<{
      schemaVersion: typeof AUTHORITY_AUTHORIZATION_OBLIGATION_VERSION;
      obligationType: 'REQUIRE_APP_CHECK';
      requiredStatus: 'REQUIRED_AND_VALID';
    }>
  | Readonly<{
      schemaVersion: typeof AUTHORITY_AUTHORIZATION_OBLIGATION_VERSION;
      obligationType: 'REQUIRE_MFA';
      minimumFactors: 2;
    }>
  | Readonly<{
      schemaVersion: typeof AUTHORITY_AUTHORIZATION_OBLIGATION_VERSION;
      obligationType: 'REQUIRE_IDEMPOTENCY_KEY';
      namespace: 'PRINCIPAL_SCOPE_OPERATION';
    }>
  | Readonly<{
      schemaVersion: typeof AUTHORITY_AUTHORIZATION_OBLIGATION_VERSION;
      obligationType: 'REQUIRE_EXPECTED_VERSION';
      versionSource: 'RESOURCE_AUTHORITY_VERSION';
    }>
  | Readonly<{
      schemaVersion: typeof AUTHORITY_AUTHORIZATION_OBLIGATION_VERSION;
      obligationType: 'REQUIRE_AUDIT_REASON';
      reasonCodeRequired: true;
    }>
  | Readonly<{
      schemaVersion: typeof AUTHORITY_AUTHORIZATION_OBLIGATION_VERSION;
      obligationType: 'REQUIRE_CHANGE_TICKET';
      ticketReferencePattern: 'CANONICAL_REFERENCE';
    }>
  | Readonly<{
      schemaVersion: typeof AUTHORITY_AUTHORIZATION_OBLIGATION_VERSION;
      obligationType: 'REQUIRE_SUPPORT_SESSION';
      supportSessionId: string;
    }>
  | Readonly<{
      schemaVersion: typeof AUTHORITY_AUTHORIZATION_OBLIGATION_VERSION;
      obligationType: 'REQUIRE_MIGRATION_MANIFEST';
      manifestVersion: string;
    }>
  | Readonly<{
      schemaVersion: typeof AUTHORITY_AUTHORIZATION_OBLIGATION_VERSION;
      obligationType: 'MASK_NOT_FOUND';
      externalCode: 'PERMISSION_DENIED';
    }>
  | Readonly<{
      schemaVersion: typeof AUTHORITY_AUTHORIZATION_OBLIGATION_VERSION;
      obligationType: 'LIMIT_TO_TEST_ONLY';
      executionMode: 'TEST_ONLY';
    }>;

export interface AuthorityAuthorizationFreshnessV1 {
  readonly schemaVersion: typeof AUTHORITY_AUTHORIZATION_FRESHNESS_VERSION;
  readonly evaluatedAt: string;
  readonly validUntil: string;
  readonly principalValidUntil: string;
  readonly scopeValidUntil: string;
  readonly policyVersion: string;
  readonly inputFingerprint: string;
  readonly staleAfterSeconds: number;
}

export const AUTHORITY_AUTHORIZATION_ALLOW_REASON_CODES = Object.freeze([
  'POLICY_RULE_MATCHED',
  'REQUIRED_OBLIGATIONS_SATISFIABLE',
] as const);

export const AUTHORITY_AUTHORIZATION_DENY_REASON_CODES = Object.freeze([
  'PRINCIPAL_INACTIVE',
  'PRINCIPAL_ASSURANCE_INSUFFICIENT',
  'APP_CHECK_REQUIRED',
  'SCOPE_INACTIVE',
  'MEMBERSHIP_INACTIVE',
  'PERMISSION_NOT_GRANTED',
  'RESOURCE_OUTSIDE_SCOPE',
  'CROSS_TENANT_ACCESS_DENIED',
  'PLATFORM_SCOPE_DENIED',
  'BOOTSTRAP_NOT_AUTHORIZED',
  'LEGACY_CANONICALIZATION_NOT_AUTHORIZED',
  'MIGRATION_SCOPE_DENIED',
  'SUPPORT_SCOPE_DENIED',
  'POLICY_EXPLICIT_DENY',
  'OPERATION_NOT_SUPPORTED',
] as const);

export const AUTHORITY_AUTHORIZATION_EVALUATION_REASON_CODES = Object.freeze([
  'AUTHORIZATION_REQUEST_INVALID',
  'PRINCIPAL_BINDING_STALE',
  'SCOPE_BINDING_STALE',
  'POLICY_STALE',
  'BINDING_CONFLICT',
  'POLICY_NOT_FOUND',
  'POLICY_EVALUATION_FAILED',
  'INTERNAL_AUTHORIZATION_FAILURE',
] as const);

export const AUTHORITY_AUTHORIZATION_DECISION_REASON_CODES = Object.freeze([
  ...AUTHORITY_AUTHORIZATION_ALLOW_REASON_CODES,
  ...AUTHORITY_AUTHORIZATION_DENY_REASON_CODES,
  'POLICY_NOT_FOUND',
] as const);

export type AuthorityAuthorizationDecisionReasonCode =
  (typeof AUTHORITY_AUTHORIZATION_DECISION_REASON_CODES)[number];

export type AuthorityAuthorizationEvaluationReasonCode =
  (typeof AUTHORITY_AUTHORIZATION_EVALUATION_REASON_CODES)[number];

export interface AuthorityAuthorizationDecisionV1 {
  readonly schemaVersion: typeof AUTHORITY_AUTHORIZATION_SCHEMA_VERSION;
  readonly version: typeof AUTHORITY_AUTHORIZATION_SCHEMA_VERSION;
  readonly decision: AuthorityAuthorizationDecision;
  readonly permission: AuthorityPermissionV1;
  readonly principalBinding: AuthorityAuthorizationPrincipalBindingV1;
  readonly scopeBinding: AuthorityAuthorizationScopeBindingV1;
  readonly operationBinding: AuthorityAuthorizationOperationBindingV1;
  readonly resourceBinding: AuthorityAuthorizationResourceBindingV1;
  readonly policyEvidence: AuthorityAuthorizationPolicyEvidenceV1;
  readonly obligations: readonly AuthorityAuthorizationObligationV1[];
  readonly freshness: AuthorityAuthorizationFreshnessV1;
  readonly reasonCodes: readonly AuthorityAuthorizationDecisionReasonCode[];
  readonly decisionFingerprint: string;
  readonly evaluatedAt: string;
}

export const AUTHORITY_AUTHORIZATION_CHANNELS = Object.freeze([
  'FIREBASE_CALLABLE',
  'HTTPS_SERVER',
  'INTERNAL_SERVICE',
  'BACKGROUND_TASK',
  'MIGRATION_TOOL',
  'SUPPORT_TOOL',
] as const);

export type AuthorityAuthorizationChannel =
  (typeof AUTHORITY_AUTHORIZATION_CHANNELS)[number];

export interface AuthorityAuthorizationPriorDecisionReferenceV1 {
  readonly decisionFingerprint: string;
  readonly policyVersion: string;
  readonly evaluatedAt: string;
}

export interface AuthorityAuthorizationRequestV1 {
  readonly schemaVersion: typeof AUTHORITY_AUTHORIZATION_REQUEST_VERSION;
  readonly principalBinding: AuthorityAuthorizationPrincipalBindingV1;
  readonly scopeBinding: AuthorityAuthorizationScopeBindingV1;
  readonly operationBinding: AuthorityAuthorizationOperationBindingV1;
  readonly resourceBinding: AuthorityAuthorizationResourceBindingV1;
  readonly channel: AuthorityAuthorizationChannel;
  readonly requestId: string;
  readonly correlationId: string;
  readonly evaluatedAtInput: string;
  readonly priorDecisionReference?:
    AuthorityAuthorizationPriorDecisionReferenceV1;
}

export interface AuthorityAuthorizationEvaluationContextV1 {
  readonly schemaVersion: typeof AUTHORITY_AUTHORIZATION_CONTEXT_VERSION;
  readonly requestId: string;
  readonly correlationId: string;
  readonly evaluatedAt: string;
  readonly channel: AuthorityAuthorizationChannel;
  readonly evaluatorVersion: string;
  readonly cancellationPolicy: 'EXTERNAL_EXECUTION_CONTEXT';
}

export const AUTHORITY_AUTHORIZATION_RESULT_STATUSES = Object.freeze([
  'DECIDED',
  'REJECTED',
  'STALE',
  'CONFLICT',
  'INTERNAL_ERROR',
] as const);

export type AuthorityAuthorizationResultStatus =
  (typeof AUTHORITY_AUTHORIZATION_RESULT_STATUSES)[number];

export const AUTHORITY_AUTHORIZATION_RETRY_DISPOSITIONS = Object.freeze([
  'DO_NOT_RETRY',
  'SAFE_TO_RETRY',
  'RETRY_AFTER_REAUTHENTICATION',
  'RETRY_AFTER_PRINCIPAL_REFRESH',
  'RETRY_AFTER_SCOPE_REFRESH',
  'RETRY_AFTER_POLICY_REFRESH',
  'RETRY_AFTER_OPERATOR_REVIEW',
] as const);

export type AuthorityAuthorizationRetryDisposition =
  (typeof AUTHORITY_AUTHORIZATION_RETRY_DISPOSITIONS)[number];

export interface AuthorityAuthorizationSafeMetadataV1 {
  readonly evaluatorReference?: string;
  readonly evidenceFingerprint?: string;
}

interface AuthorityAuthorizationFailureResultV1 {
  readonly schemaVersion: typeof AUTHORITY_AUTHORIZATION_RESULT_VERSION;
  readonly status: Exclude<AuthorityAuthorizationResultStatus, 'DECIDED'>;
  readonly reasonCode: AuthorityAuthorizationEvaluationReasonCode;
  readonly retryDisposition: AuthorityAuthorizationRetryDisposition;
  readonly evaluatorVersion: string;
  readonly evaluatedAt: string;
  readonly safeMetadata?: AuthorityAuthorizationSafeMetadataV1;
}

export type AuthorityAuthorizationResultV1 =
  | Readonly<{
      schemaVersion: typeof AUTHORITY_AUTHORIZATION_RESULT_VERSION;
      status: 'DECIDED';
      decision: AuthorityAuthorizationDecisionV1;
    }>
  | Readonly<AuthorityAuthorizationFailureResultV1>;
