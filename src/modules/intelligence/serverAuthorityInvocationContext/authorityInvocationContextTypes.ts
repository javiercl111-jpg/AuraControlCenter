import type {
  AuthorityAuthorizationChannel,
  AuthorityAuthorizationDecision,
  AuthorityAuthorizationDecisionReasonCode,
  AuthorityAuthorizationObligationType,
  AuthorityAuthorizationResourceType,
  AuthorityPermissionV1,
} from '../serverAuthorityAuthorization/authorityAuthorizationTypes';
import type {
  AuthorityOperationType,
  AuthorityRepositoryInvocationContextV1,
} from '../serverAuthorityPersistence/types';
import type {
  AuthorityAuthenticationAssuranceLevel,
  AuthorityAuthenticationMethod,
  AuthorityPrincipalStatus,
  AuthorityPrincipalType,
} from '../serverPrincipalResolution/principalResolutionTypes';
import type {
  AuthorityPlatformBoundary,
  AuthorityPlatformOperationCategory,
  AuthoritySupportImpersonationMode,
  AuthorityTenantScopeStatus,
  AuthorityTenantScopeType,
} from '../serverTenantScopeResolution/tenantScopeResolutionTypes';

export const AUTHORITY_INVOCATION_CONTEXT_VERSION = '1' as const;
export const AUTHORITY_INVOCATION_PRINCIPAL_PROJECTION_VERSION = '1' as const;
export const AUTHORITY_INVOCATION_SCOPE_PROJECTION_VERSION = '1' as const;
export const AUTHORITY_INVOCATION_AUTHORIZATION_PROJECTION_VERSION =
  '1' as const;
export const AUTHORITY_INVOCATION_OPERATION_BINDING_VERSION = '1' as const;
export const AUTHORITY_OBLIGATION_SATISFACTION_EVIDENCE_VERSION =
  '1' as const;
export const AUTHORITY_OBLIGATION_SATISFACTION_SUMMARY_VERSION =
  '1' as const;
export const AUTHORITY_INVOCATION_REQUEST_METADATA_VERSION = '1' as const;
export const AUTHORITY_INVOCATION_IDEMPOTENCY_VERSION = '1' as const;
export const AUTHORITY_INVOCATION_FRESHNESS_VERSION = '1' as const;
export const AUTHORITY_INVOCATION_CONTEXT_RESULT_VERSION = '1' as const;
export const AUTHORITY_INVOCATION_CONTEXT_ERROR_VERSION = '1' as const;

export const AUTHORITY_INVOCATION_AUTHORIZATION_STATUSES = Object.freeze([
  'CURRENT',
  'STALE',
] as const);
export type AuthorityInvocationAuthorizationStatus =
  (typeof AUTHORITY_INVOCATION_AUTHORIZATION_STATUSES)[number];

export const AUTHORITY_OBLIGATION_SATISFACTION_STATUSES = Object.freeze([
  'SATISFIED',
  'NOT_SATISFIED',
  'NOT_APPLICABLE',
  'STALE',
] as const);
export type AuthorityObligationSatisfactionStatus =
  (typeof AUTHORITY_OBLIGATION_SATISFACTION_STATUSES)[number];

export const AUTHORITY_INVOCATION_CONTEXT_STATUSES = Object.freeze([
  'READY',
  'NOT_AUTHORIZED',
  'STALE',
  'INCOMPLETE',
  'CONFLICT',
  'REJECTED',
] as const);
export type AuthorityInvocationContextStatus =
  (typeof AUTHORITY_INVOCATION_CONTEXT_STATUSES)[number];

export const AUTHORITY_INVOCATION_CONTEXT_RESULT_STATUSES = Object.freeze([
  'READY',
  'REJECTED',
  'STALE',
  'CONFLICT',
  'INCOMPLETE',
  'INTERNAL_ERROR',
] as const);
export type AuthorityInvocationContextResultStatus =
  (typeof AUTHORITY_INVOCATION_CONTEXT_RESULT_STATUSES)[number];

export const AUTHORITY_INVOCATION_CONTEXT_REASON_CODES = Object.freeze([
  'PRINCIPAL_NOT_ACTIVE',
  'PRINCIPAL_STALE',
  'SCOPE_NOT_ACTIVE',
  'SCOPE_STALE',
  'AUTHORIZATION_NOT_ALLOW',
  'AUTHORIZATION_STALE',
  'AUTHORIZATION_BINDING_MISMATCH',
  'OPERATION_PERMISSION_MISMATCH',
  'RESOURCE_SCOPE_MISMATCH',
  'TENANT_BINDING_MISMATCH',
  'IDEMPOTENCY_BINDING_MISMATCH',
  'OBLIGATION_MISSING',
  'OBLIGATION_NOT_SATISFIED',
  'OBLIGATION_STALE',
  'CONTEXT_FRESHNESS_INVALID',
  'CONTEXT_FINGERPRINT_INVALID',
  'INVOCATION_CONTEXT_INCOMPLETE',
  'INVOCATION_CONTEXT_CONFLICT',
  'INVALID_INVOCATION_CONTEXT',
  'INTERNAL_CONTEXT_FAILURE',
] as const);
export type AuthorityInvocationContextReasonCode =
  (typeof AUTHORITY_INVOCATION_CONTEXT_REASON_CODES)[number];

export const AUTHORITY_INVOCATION_CONTEXT_RETRY_DISPOSITIONS =
  Object.freeze([
    'DO_NOT_RETRY',
    'SAFE_TO_RETRY',
    'RETRY_AFTER_REAUTHENTICATION',
    'RETRY_AFTER_PRINCIPAL_REFRESH',
    'RETRY_AFTER_SCOPE_REFRESH',
    'RETRY_AFTER_AUTHORIZATION_REFRESH',
    'RETRY_AFTER_OBLIGATION_SATISFACTION',
    'RETRY_AFTER_OPERATOR_REVIEW',
  ] as const);
export type AuthorityInvocationContextRetryDisposition =
  (typeof AUTHORITY_INVOCATION_CONTEXT_RETRY_DISPOSITIONS)[number];

export interface AuthorityInvocationPrincipalProjectionV1 {
  readonly schemaVersion:
    typeof AUTHORITY_INVOCATION_PRINCIPAL_PROJECTION_VERSION;
  readonly principalId: string;
  readonly principalType: AuthorityPrincipalType;
  readonly principalStatus: AuthorityPrincipalStatus;
  readonly authenticationMethod: AuthorityAuthenticationMethod;
  readonly assuranceLevel: AuthorityAuthenticationAssuranceLevel;
  readonly principalBindingVersion: string;
  readonly principalEvidenceFingerprint: string;
  readonly principalResolvedAt: string;
  readonly principalValidUntil: string;
}

interface AuthorityInvocationScopeProjectionBaseV1 {
  readonly schemaVersion:
    typeof AUTHORITY_INVOCATION_SCOPE_PROJECTION_VERSION;
  readonly scopeType: AuthorityTenantScopeType;
  readonly scopeStatus: AuthorityTenantScopeStatus;
  readonly scopeEvidenceFingerprint: string;
  readonly scopeResolvedAt: string;
  readonly scopeValidUntil: string;
  readonly bindingVersion: string;
}

export type AuthorityInvocationScopeProjectionV1 =
  | Readonly<
      AuthorityInvocationScopeProjectionBaseV1 & {
        readonly scopeType: 'TENANT';
        readonly tenantId: string;
        readonly tenantAuthorityVersion: string;
        readonly membershipBindingVersion: string;
      }
    >
  | Readonly<
      AuthorityInvocationScopeProjectionBaseV1 & {
        readonly scopeType: 'PLATFORM';
        readonly platformBoundary: AuthorityPlatformBoundary;
        readonly operationCategory: AuthorityPlatformOperationCategory;
      }
    >
  | Readonly<
      AuthorityInvocationScopeProjectionBaseV1 & {
        readonly scopeType: 'TENANT_BOOTSTRAP';
        readonly bootstrapRequestId: string;
        readonly tenantIdCandidate: string;
        readonly candidateFingerprint: string;
      }
    >
  | Readonly<
      AuthorityInvocationScopeProjectionBaseV1 & {
        readonly scopeType: 'LEGACY_CANONICALIZATION';
        readonly sourceLocatorKey: string;
        readonly canonicalTenantCandidateId: string;
        readonly sourceFingerprint: string;
      }
    >
  | Readonly<
      AuthorityInvocationScopeProjectionBaseV1 & {
        readonly scopeType: 'MIGRATION';
        readonly migrationId: string;
        readonly migrationRunId: string;
        readonly manifestVersion: string;
        readonly scopeFingerprint: string;
        readonly targetTenantIds: readonly string[];
      }
    >
  | Readonly<
      AuthorityInvocationScopeProjectionBaseV1 & {
        readonly scopeType: 'SUPPORT';
        readonly supportSessionId: string;
        readonly targetTenantId: string;
        readonly sessionValidUntil: string;
        readonly impersonationMode: AuthoritySupportImpersonationMode;
      }
    >;

export interface AuthorityInvocationOperationBindingV1 {
  readonly schemaVersion:
    typeof AUTHORITY_INVOCATION_OPERATION_BINDING_VERSION;
  readonly operationType: AuthorityOperationType;
  readonly permission: AuthorityPermissionV1;
  readonly resourceType: AuthorityAuthorizationResourceType;
  readonly resourceId: string;
  readonly resourceTenantId?: string;
  readonly operationId: string;
  readonly commandFingerprint: string;
  readonly authorizationInputFingerprint: string;
  readonly consumerId: string;
  readonly source: string;
}

export interface AuthorityInvocationAuthorizationProjectionV1 {
  readonly schemaVersion:
    typeof AUTHORITY_INVOCATION_AUTHORIZATION_PROJECTION_VERSION;
  readonly decision: AuthorityAuthorizationDecision;
  readonly permission: AuthorityPermissionV1;
  readonly principalId: string;
  readonly scopeType: AuthorityTenantScopeType;
  readonly tenantId?: string;
  readonly operationType: AuthorityOperationType;
  readonly resourceType: AuthorityAuthorizationResourceType;
  readonly resourceId: string;
  readonly resourceTenantId?: string;
  readonly policyId: string;
  readonly policyVersion: string;
  readonly decisionRuleId: string;
  readonly authorizationFingerprint: string;
  readonly authorizationInputFingerprint: string;
  readonly evaluatedAt: string;
  readonly validUntil: string;
  readonly declaredObligationTypes:
    readonly AuthorityAuthorizationObligationType[];
  readonly obligationsFingerprint: string;
  readonly reasonCode: AuthorityAuthorizationDecisionReasonCode;
  readonly status: AuthorityInvocationAuthorizationStatus;
}

export interface AuthorityObligationSatisfactionEvidenceV1 {
  readonly schemaVersion:
    typeof AUTHORITY_OBLIGATION_SATISFACTION_EVIDENCE_VERSION;
  readonly obligationType: AuthorityAuthorizationObligationType;
  readonly satisfactionStatus: AuthorityObligationSatisfactionStatus;
  readonly satisfiedAt: string;
  readonly evidenceFingerprint: string;
  readonly verifierVersion: string;
  readonly validUntil?: string;
  readonly safeReference?: string;
}

export interface AuthorityObligationSatisfactionSummaryV1 {
  readonly schemaVersion:
    typeof AUTHORITY_OBLIGATION_SATISFACTION_SUMMARY_VERSION;
  readonly total: number;
  readonly satisfied: number;
  readonly notApplicable: number;
  readonly stale: number;
  readonly notSatisfied: number;
  readonly fingerprint: string;
}

export interface AuthorityInvocationRequestMetadataV1 {
  readonly schemaVersion:
    typeof AUTHORITY_INVOCATION_REQUEST_METADATA_VERSION;
  readonly requestId: string;
  readonly correlationId: string;
  readonly causationId?: string;
  readonly channel: AuthorityAuthorizationChannel;
  readonly receivedAt: string;
  readonly createdAt: string;
  readonly traceId?: string;
  readonly clientRequestIdHash?: string;
}

export interface AuthorityInvocationIdempotencyV1 {
  readonly schemaVersion: typeof AUTHORITY_INVOCATION_IDEMPOTENCY_VERSION;
  readonly callerKeyHash: string;
  readonly namespaceVersion: string;
  readonly scopeFingerprint: string;
  readonly principalId: string;
  readonly tenantId?: string;
  readonly operationType: AuthorityOperationType;
  readonly operationId: string;
  readonly commandFingerprint: string;
  readonly createdAt: string;
}

export interface AuthorityInvocationFreshnessV1 {
  readonly schemaVersion: typeof AUTHORITY_INVOCATION_FRESHNESS_VERSION;
  readonly evaluatedAt: string;
  readonly validUntil: string;
  readonly principalValidUntil: string;
  readonly scopeValidUntil: string;
  readonly authorizationValidUntil: string;
  readonly obligationValidUntil?: string;
  readonly staleAfterSeconds: number;
}

export interface AuthorityInvocationContextV1 {
  readonly version: typeof AUTHORITY_INVOCATION_CONTEXT_VERSION;
  readonly principal: AuthorityInvocationPrincipalProjectionV1;
  readonly scope: AuthorityInvocationScopeProjectionV1;
  readonly authorization: AuthorityInvocationAuthorizationProjectionV1;
  readonly operation: AuthorityInvocationOperationBindingV1;
  readonly request: AuthorityInvocationRequestMetadataV1;
  readonly idempotency: AuthorityInvocationIdempotencyV1;
  readonly obligationSatisfaction:
    readonly AuthorityObligationSatisfactionEvidenceV1[];
  readonly obligationSummary: AuthorityObligationSatisfactionSummaryV1;
  readonly freshness: AuthorityInvocationFreshnessV1;
  readonly contextFingerprint: string;
  readonly createdAt: string;
  readonly status: AuthorityInvocationContextStatus;
}

export interface AuthorityInvocationContextSafeMetadataV1 {
  readonly requestId?: string;
  readonly correlationId?: string;
  readonly contextFingerprint?: string;
}

interface AuthorityInvocationContextFailureResultV1 {
  readonly schemaVersion:
    typeof AUTHORITY_INVOCATION_CONTEXT_RESULT_VERSION;
  readonly status: Exclude<AuthorityInvocationContextResultStatus, 'READY'>;
  readonly reasonCode: AuthorityInvocationContextReasonCode;
  readonly retryDisposition: AuthorityInvocationContextRetryDisposition;
  readonly safeMetadata?: AuthorityInvocationContextSafeMetadataV1;
}

export type AuthorityInvocationContextResultV1 =
  | Readonly<{
      readonly schemaVersion:
        typeof AUTHORITY_INVOCATION_CONTEXT_RESULT_VERSION;
      readonly status: 'READY';
      readonly context: AuthorityInvocationContextV1;
    }>
  | Readonly<AuthorityInvocationContextFailureResultV1>;

export type AuthorityRepositoryInvocationContextProjectionV1 =
  AuthorityRepositoryInvocationContextV1;
