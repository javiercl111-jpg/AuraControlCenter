import type {
  AuthorityAuthorizationDecisionV1,
  AuthorityAuthorizationOperationBindingV1,
  AuthorityAuthorizationPriorDecisionReferenceV1,
  AuthorityAuthorizationResourceBindingV1,
  AuthorityAuthorizationRetryDisposition,
} from '../serverAuthorityAuthorization/authorityAuthorizationTypes';
import type {
  AuthorityInvocationContextV1,
  AuthorityObligationSatisfactionEvidenceV1,
  AuthorityObligationSatisfactionSummaryV1,
} from '../serverAuthorityInvocationContext/authorityInvocationContextTypes';
import type {
  AuthorityAdministrativeCommandV1,
  AuthorityRepositoryResultV1,
} from '../serverAuthorityPersistence/types';
import type {
  AuthorityPrincipalResolutionChannel,
  AuthorityPrincipalResolutionRequestV1,
  AuthorityPrincipalRetryDisposition,
  ResolvedAuthorityPrincipalV1,
} from '../serverPrincipalResolution/principalResolutionTypes';
import type {
  AuthorityTenantScopeOperationCategory,
  AuthorityTenantScopeRetryDisposition,
  AuthorityTenantSelectorV1,
  ResolvedAuthorityTenantScopeV1,
} from '../serverTenantScopeResolution/tenantScopeResolutionTypes';

export const AUTHORITY_APPLICATION_SERVICE_VERSION = '1' as const;
export const AUTHORITY_APPLICATION_SERVICE_REQUEST_VERSION = '1' as const;
export const AUTHORITY_APPLICATION_EXECUTION_CONTEXT_VERSION = '1' as const;
export const AUTHORITY_APPLICATION_IDEMPOTENCY_INPUT_VERSION = '1' as const;
export const AUTHORITY_APPLICATION_OBLIGATION_INPUT_VERSION = '1' as const;
export const AUTHORITY_OBLIGATION_VERIFICATION_RESULT_VERSION =
  '1' as const;
export const AUTHORITY_APPLICATION_STAGE_TRACE_VERSION = '1' as const;
export const AUTHORITY_APPLICATION_SERVICE_RESULT_VERSION = '1' as const;
export const AUTHORITY_APPLICATION_SERVICE_ERROR_VERSION = '1' as const;

export const AUTHORITY_APPLICATION_EXECUTION_MODES = Object.freeze([
  'INTERNAL_NON_PRODUCTIVE',
  'TEST_ONLY',
] as const);
export type AuthorityApplicationExecutionMode =
  (typeof AUTHORITY_APPLICATION_EXECUTION_MODES)[number];

export const AUTHORITY_APPLICATION_STAGES = Object.freeze([
  'REQUEST_VALIDATION',
  'PRINCIPAL_RESOLUTION',
  'TENANT_SCOPE_RESOLUTION',
  'AUTHORIZATION_EVALUATION',
  'OBLIGATION_VERIFICATION',
  'CONTEXT_CONSTRUCTION',
  'CONTEXT_FINGERPRINT',
  'PERSISTENCE_PROJECTION',
  'REPOSITORY_EXECUTION',
  'RESULT_MAPPING',
] as const);
export type AuthorityApplicationStage =
  (typeof AUTHORITY_APPLICATION_STAGES)[number];

export const AUTHORITY_APPLICATION_STAGE_STATUSES = Object.freeze([
  'COMPLETED',
  'STOPPED',
  'CANCELLED',
  'FAILED',
] as const);
export type AuthorityApplicationStageStatus =
  (typeof AUTHORITY_APPLICATION_STAGE_STATUSES)[number];

export const AUTHORITY_APPLICATION_RESULT_STATUSES = Object.freeze([
  'APPLIED',
  'REPLAYED',
  'REJECTED',
  'NOT_AUTHORIZED',
  'STALE',
  'CONFLICT',
  'NOT_FOUND',
  'CANCELLED',
  'TIMED_OUT',
  'UNAVAILABLE',
  'INTERNAL_ERROR',
] as const);
export type AuthorityApplicationResultStatus =
  (typeof AUTHORITY_APPLICATION_RESULT_STATUSES)[number];

export const AUTHORITY_OBLIGATION_VERIFICATION_STATUSES = Object.freeze([
  'VERIFIED',
  'REJECTED',
  'STALE',
  'INCOMPLETE',
  'CONFLICT',
  'INTERNAL_ERROR',
] as const);
export type AuthorityObligationVerificationStatus =
  (typeof AUTHORITY_OBLIGATION_VERIFICATION_STATUSES)[number];

export const AUTHORITY_APPLICATION_RETRY_DISPOSITIONS = Object.freeze([
  'DO_NOT_RETRY',
  'SAFE_TO_RETRY',
  'SAFE_TO_RETRY_WITH_SAME_IDEMPOTENCY_KEY',
  'RETRY_AFTER_REAUTHENTICATION',
  'RETRY_AFTER_PRINCIPAL_REFRESH',
  'RETRY_AFTER_SCOPE_REFRESH',
  'RETRY_AFTER_AUTHORIZATION_REFRESH',
  'RETRY_AFTER_OBLIGATION_SATISFACTION',
  'RETRY_AFTER_DEPENDENCY_RECOVERY',
  'RETRY_AFTER_OPERATOR_REVIEW',
] as const);
export type AuthorityApplicationRetryDisposition =
  (typeof AUTHORITY_APPLICATION_RETRY_DISPOSITIONS)[number];

export const AUTHORITY_APPLICATION_SAFE_CODES = Object.freeze([
  'AUTHORITY_OPERATION_APPLIED',
  'AUTHORITY_OPERATION_REPLAYED',
  'AUTHORITY_REQUEST_INVALID',
  'AUTHORITY_PRINCIPAL_NOT_RESOLVED',
  'AUTHORITY_SCOPE_NOT_RESOLVED',
  'AUTHORITY_NOT_AUTHORIZED',
  'AUTHORITY_AUTHORIZATION_NOT_EXECUTABLE',
  'AUTHORITY_OBLIGATIONS_NOT_VERIFIED',
  'AUTHORITY_CONTEXT_NOT_READY',
  'AUTHORITY_CONTEXT_PROJECTION_FAILED',
  'AUTHORITY_COMMAND_BINDING_MISMATCH',
  'AUTHORITY_IDEMPOTENCY_BINDING_MISMATCH',
  'AUTHORITY_OPERATION_STALE',
  'AUTHORITY_OPERATION_CONFLICT',
  'AUTHORITY_RESOURCE_NOT_AVAILABLE',
  'AUTHORITY_OPERATION_REJECTED',
  'AUTHORITY_OPERATION_CANCELLED',
  'AUTHORITY_OPERATION_TIMED_OUT',
  'AUTHORITY_DEPENDENCY_UNAVAILABLE',
  'AUTHORITY_INTERNAL_FAILURE',
] as const);
export type AuthorityApplicationSafeCode =
  (typeof AUTHORITY_APPLICATION_SAFE_CODES)[number];

export interface AuthorityApplicationIdempotencyInputV1 {
  readonly schemaVersion:
    typeof AUTHORITY_APPLICATION_IDEMPOTENCY_INPUT_VERSION;
  readonly idempotencyKey: string;
  readonly callerKeyHash: string;
  readonly namespaceVersion: string;
  readonly commandFingerprint: string;
}

export interface AuthorityApplicationObligationEvidenceInputV1 {
  readonly schemaVersion:
    typeof AUTHORITY_APPLICATION_OBLIGATION_INPUT_VERSION;
  readonly obligationType: AuthorityAuthorizationDecisionV1['obligations'][number]['obligationType'];
  readonly evidenceFingerprint: string;
  readonly observedAt: string;
  readonly validUntil?: string;
  readonly verifierReference?: string;
}

export interface AuthorityApplicationServiceRequestV1 {
  readonly schemaVersion:
    typeof AUTHORITY_APPLICATION_SERVICE_REQUEST_VERSION;
  readonly principalResolutionRequest:
    AuthorityPrincipalResolutionRequestV1;
  readonly tenantSelector: AuthorityTenantSelectorV1;
  readonly scopeOperationCategory?: AuthorityTenantScopeOperationCategory;
  readonly authorizationOperation:
    AuthorityAuthorizationOperationBindingV1;
  readonly authorizationResource:
    AuthorityAuthorizationResourceBindingV1;
  readonly priorDecisionReference?:
    AuthorityAuthorizationPriorDecisionReferenceV1;
  readonly command: AuthorityAdministrativeCommandV1;
  readonly idempotency: AuthorityApplicationIdempotencyInputV1;
  readonly obligationEvidence:
    readonly AuthorityApplicationObligationEvidenceInputV1[];
}

export interface AuthorityApplicationExecutionContextV1 {
  readonly schemaVersion:
    typeof AUTHORITY_APPLICATION_EXECUTION_CONTEXT_VERSION;
  readonly requestId: string;
  readonly correlationId: string;
  readonly causationId?: string;
  readonly channel: AuthorityPrincipalResolutionChannel;
  readonly receivedAt: string;
  readonly evaluatedAt: string;
  readonly createdAt: string;
  readonly deadlineAt?: string;
  readonly traceId?: string;
  readonly clientRequestIdHash?: string;
  readonly principalResolverVersion: string;
  readonly scopeResolverVersion: string;
  readonly authorizationEvaluatorVersion: string;
  readonly executionMode: AuthorityApplicationExecutionMode;
  /** Preserved by identity and never cloned or frozen. */
  readonly cancellationSignal?: AbortSignal;
}

export interface AuthorityObligationVerificationContextV1 {
  readonly command: AuthorityAdministrativeCommandV1;
  readonly principal: ResolvedAuthorityPrincipalV1;
  readonly scope: ResolvedAuthorityTenantScopeV1;
  readonly evaluatedAt: string;
  readonly executionMode: AuthorityApplicationExecutionMode;
}

export interface AuthorityObligationVerificationSuccessV1 {
  readonly schemaVersion:
    typeof AUTHORITY_OBLIGATION_VERIFICATION_RESULT_VERSION;
  readonly status: 'VERIFIED';
  readonly evidence:
    readonly AuthorityObligationSatisfactionEvidenceV1[];
  readonly summary: AuthorityObligationSatisfactionSummaryV1;
  readonly obligationsFingerprint: string;
  readonly safeCode: 'OBLIGATIONS_VERIFIED';
  readonly retryDisposition: 'DO_NOT_RETRY';
  readonly maskNotFound: boolean;
}

export interface AuthorityObligationVerificationFailureV1 {
  readonly schemaVersion:
    typeof AUTHORITY_OBLIGATION_VERIFICATION_RESULT_VERSION;
  readonly status: Exclude<
    AuthorityObligationVerificationStatus,
    'VERIFIED'
  >;
  readonly safeCode:
    | 'OBLIGATIONS_REJECTED'
    | 'OBLIGATIONS_STALE'
    | 'OBLIGATIONS_INCOMPLETE'
    | 'OBLIGATIONS_CONFLICT'
    | 'OBLIGATIONS_INTERNAL_ERROR';
  readonly retryDisposition: AuthorityApplicationRetryDisposition;
  readonly maskNotFound: boolean;
}

export type AuthorityObligationVerificationResultV1 =
  | Readonly<AuthorityObligationVerificationSuccessV1>
  | Readonly<AuthorityObligationVerificationFailureV1>;

export type AuthorityInvocationContextFingerprintInputV1 = Readonly<
  Omit<AuthorityInvocationContextV1, 'contextFingerprint'>
>;

export interface AuthorityApplicationStageTraceV1 {
  readonly schemaVersion:
    typeof AUTHORITY_APPLICATION_STAGE_TRACE_VERSION;
  readonly stage: AuthorityApplicationStage;
  readonly status: AuthorityApplicationStageStatus;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly safeCode?: AuthorityApplicationSafeCode;
  readonly retryDisposition?: AuthorityApplicationRetryDisposition;
}

export interface AuthorityApplicationResultMetadataV1 {
  readonly operationId: string;
  readonly correlationId: string;
  readonly contextFingerprint?: string;
  readonly repositorySafeCode?: string;
  readonly resultingVersion?: number;
  readonly resourceReference?: string;
  readonly maskNotFound: boolean;
}

interface AuthorityApplicationServiceResultBaseV1 {
  readonly schemaVersion:
    typeof AUTHORITY_APPLICATION_SERVICE_RESULT_VERSION;
  readonly status: AuthorityApplicationResultStatus;
  readonly safeCode: AuthorityApplicationSafeCode;
  readonly retryDisposition: AuthorityApplicationRetryDisposition;
  readonly stageTrace: readonly AuthorityApplicationStageTraceV1[];
  readonly metadata: AuthorityApplicationResultMetadataV1;
}

export type AuthorityApplicationServiceResultV1 = Readonly<
  AuthorityApplicationServiceResultBaseV1
>;

export interface AuthorityApplicationServiceV1 {
  readonly version: typeof AUTHORITY_APPLICATION_SERVICE_VERSION;
  execute(
    request: AuthorityApplicationServiceRequestV1,
    context: AuthorityApplicationExecutionContextV1,
  ): Promise<AuthorityApplicationServiceResultV1>;
}

export interface AuthorityApplicationResolvedInputsV1 {
  readonly principal: ResolvedAuthorityPrincipalV1;
  readonly scope: ResolvedAuthorityTenantScopeV1;
  readonly decision: AuthorityAuthorizationDecisionV1;
  readonly obligationVerification:
    AuthorityObligationVerificationSuccessV1;
}

export type AuthorityApplicationRepositoryResultV1 =
  AuthorityRepositoryResultV1;

export type AuthorityApplicationUpstreamRetryDisposition =
  | AuthorityPrincipalRetryDisposition
  | AuthorityTenantScopeRetryDisposition
  | AuthorityAuthorizationRetryDisposition;
