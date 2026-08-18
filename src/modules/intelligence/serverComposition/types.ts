import type {
  AuthoritativeBoundaryExecutionModeV1,
} from '../os/boundary/types';

export const TRUSTED_SERVER_REQUEST_CONTEXT_VERSION = '1' as const;
export const TRUSTED_SERVER_PRINCIPAL_VERSION = '1' as const;
export const TRUSTED_TENANT_MEMBERSHIP_VERSION = '1' as const;
export const TRUSTED_REQUEST_IDENTITY_VERSION = '1' as const;
export const TRUSTED_SERVER_LIFECYCLE_VERSION = '1' as const;
export const TRUSTED_SANITIZED_TRANSPORT_CONTEXT_VERSION = '1' as const;
export const TRUSTED_SERVER_RESPONSE_VERSION = '1' as const;
export const TRUSTED_RESOLVER_INPUT_VERSION = '1' as const;

export const TRUSTED_SERVER_TRANSPORTS = Object.freeze([
  'FIREBASE_CALLABLE',
  'HTTPS_FUNCTION',
  'CLOUD_TASK',
  'INTERNAL_TEST',
] as const);

export type TrustedServerTransport =
  (typeof TRUSTED_SERVER_TRANSPORTS)[number];

export const TRUSTED_SERVER_PRINCIPAL_TYPES = Object.freeze([
  'USER',
  'SERVICE',
  'SYSTEM',
] as const);

export type TrustedServerPrincipalType =
  (typeof TRUSTED_SERVER_PRINCIPAL_TYPES)[number];

export const TRUSTED_AUTHENTICATION_METHODS = Object.freeze([
  'FIREBASE_ID_TOKEN',
  'OIDC_SERVICE_ACCOUNT',
  'WORKLOAD_IDENTITY',
  'INTERNAL_TEST_ASSERTION',
] as const);

export type TrustedAuthenticationMethod =
  (typeof TRUSTED_AUTHENTICATION_METHODS)[number];

export const TRUSTED_AUTHENTICATION_PROVIDERS = Object.freeze([
  'FIREBASE_AUTH',
  'GOOGLE_CLOUD_IAM',
  'AURA_INTERNAL_TEST',
] as const);

export type TrustedAuthenticationProvider =
  (typeof TRUSTED_AUTHENTICATION_PROVIDERS)[number];

export interface TrustedServerPrincipalV1 {
  readonly schemaVersion: typeof TRUSTED_SERVER_PRINCIPAL_VERSION;
  readonly principalId: string;
  readonly principalType: TrustedServerPrincipalType;
  readonly authenticationMethod: TrustedAuthenticationMethod;
  readonly provider: TrustedAuthenticationProvider;
  readonly authenticatedAt: string;
  readonly claimsFingerprint?: string;
}

export const TRUSTED_TENANT_MEMBERSHIP_ROLES = Object.freeze([
  'TENANT_MEMBER',
  'TENANT_OPERATOR',
  'TENANT_ADMIN',
  'TENANT_SERVICE',
  'TENANT_SYSTEM',
] as const);

export type TrustedTenantMembershipRole =
  (typeof TRUSTED_TENANT_MEMBERSHIP_ROLES)[number];

export const TRUSTED_TENANT_MEMBERSHIP_STATUSES = Object.freeze([
  'ACTIVE',
  'SUSPENDED',
  'REVOKED',
] as const);

export type TrustedTenantMembershipStatus =
  (typeof TRUSTED_TENANT_MEMBERSHIP_STATUSES)[number];

export interface TrustedTenantMembershipV1 {
  readonly schemaVersion: typeof TRUSTED_TENANT_MEMBERSHIP_VERSION;
  readonly tenantId: string;
  readonly principalId: string;
  readonly membershipId: string;
  readonly roles: readonly TrustedTenantMembershipRole[];
  readonly status: 'ACTIVE';
  readonly resolvedAt: string;
  readonly resolverVersion: string;
  readonly evidenceFingerprint?: string;
}

export const TRUSTED_REQUEST_GENERATION_STRATEGIES = Object.freeze([
  'SERVER_GENERATED',
  'INFRASTRUCTURE_VERIFIED',
  'DETERMINISTIC_TEST',
] as const);

export type TrustedRequestGenerationStrategy =
  (typeof TRUSTED_REQUEST_GENERATION_STRATEGIES)[number];

export interface TrustedRequestIdentityV1 {
  readonly schemaVersion: typeof TRUSTED_REQUEST_IDENTITY_VERSION;
  readonly requestId: string;
  readonly correlationId: string;
  readonly generationStrategy: TrustedRequestGenerationStrategy;
  readonly generatedAt: string;
  readonly generatorVersion: string;
}

export interface TrustedServerLifecycleV1 {
  readonly schemaVersion: typeof TRUSTED_SERVER_LIFECYCLE_VERSION;
  readonly transportAborted: boolean;
  /**
   * Operational transport limit only. It cannot replace or synthesize the
   * authoritative policy deadline carried by AuthoritativeExecutionContextV1.
   */
  readonly transportDeadlineAt?: string;
  /** Preserves the infrastructure signal by identity; never clone or freeze. */
  readonly cancellationSignal?: AbortSignal;
}

export const TRUSTED_SERVER_INVOCATION_CLASSES = Object.freeze([
  'INTERACTIVE',
  'BACKGROUND',
  'SCHEDULED',
  'TEST',
] as const);

export type TrustedServerInvocationClass =
  (typeof TRUSTED_SERVER_INVOCATION_CLASSES)[number];

export interface TrustedSanitizedTransportContextV1 {
  readonly schemaVersion:
    typeof TRUSTED_SANITIZED_TRANSPORT_CONTEXT_VERSION;
  readonly traceId?: string;
  readonly region?: string;
  readonly transportName?: TrustedServerTransport;
  readonly invocationClass?: TrustedServerInvocationClass;
}

export type TrustedConsumerId =
  | 'INTELLIGENCE_OS_CONTRACT_TEST'
  | 'AURA_GROWTH';

export type TrustedSourceId =
  | 'TRUSTED_COMPOSITION_CONTRACT_TEST'
  | 'AURA_GROWTH';

export interface TrustedConsumerRegistryEntryV1 {
  readonly id: TrustedConsumerId;
  readonly version: string;
  readonly enabled: boolean;
  readonly allowedTransports: readonly TrustedServerTransport[];
  readonly allowedExecutionModes:
    readonly AuthoritativeBoundaryExecutionModeV1[];
  readonly description?: string;
  readonly contractVersion:
    typeof TRUSTED_SERVER_REQUEST_CONTEXT_VERSION;
}

export interface TrustedSourceRegistryEntryV1 {
  readonly id: TrustedSourceId;
  readonly version: string;
  readonly enabled: boolean;
  readonly allowedConsumerIds: readonly TrustedConsumerId[];
  readonly allowedTransports: readonly TrustedServerTransport[];
  readonly allowedExecutionModes:
    readonly AuthoritativeBoundaryExecutionModeV1[];
  readonly description?: string;
  readonly contractVersion:
    typeof TRUSTED_SERVER_REQUEST_CONTEXT_VERSION;
}

export interface TrustedConsumerRegistryV1 {
  readonly schemaVersion: string;
  readonly entries: Readonly<
    Record<TrustedConsumerId, TrustedConsumerRegistryEntryV1>
  >;
}

export interface TrustedSourceRegistryV1 {
  readonly schemaVersion: string;
  readonly entries: Readonly<
    Record<TrustedSourceId, TrustedSourceRegistryEntryV1>
  >;
}

export interface TrustedRegistrySelectionV1 {
  readonly registryVersion: string;
  readonly consumer: TrustedConsumerRegistryEntryV1;
  readonly source: TrustedSourceRegistryEntryV1;
  readonly transport: TrustedServerTransport;
  readonly requestedExecutionMode:
    AuthoritativeBoundaryExecutionModeV1;
}

export interface TrustedServerRequestContextV1 {
  readonly schemaVersion: typeof TRUSTED_SERVER_REQUEST_CONTEXT_VERSION;
  readonly transport: TrustedServerTransport;
  readonly authenticatedPrincipal: TrustedServerPrincipalV1;
  readonly tenantMembership: TrustedTenantMembershipV1;
  readonly consumer: TrustedConsumerId;
  readonly source: TrustedSourceId;
  readonly requestIdentity: TrustedRequestIdentityV1;
  readonly initiatedAt: string;
  readonly requestedExecutionMode:
    AuthoritativeBoundaryExecutionModeV1;
  readonly cancellation: TrustedServerLifecycleV1;
  /**
   * Allowlisted operational context only. It is never authority for tenant,
   * principal, consumer, source, request identity, or execution mode.
   */
  readonly sanitizedTransportContext?: TrustedSanitizedTransportContextV1;
}

export interface TrustedAuthenticationReferenceV1 {
  readonly schemaVersion: typeof TRUSTED_RESOLVER_INPUT_VERSION;
  readonly referenceId: string;
  readonly provider: TrustedAuthenticationProvider;
  readonly transport: TrustedServerTransport;
  readonly observedAt: string;
}

export const TRUSTED_RESOURCE_SCOPE_TYPES = Object.freeze([
  'TENANT_RESOURCE',
  'INTERNAL_TEST_SCOPE',
] as const);

export type TrustedResourceScopeType =
  (typeof TRUSTED_RESOURCE_SCOPE_TYPES)[number];

export interface TrustedResourceScopeV1 {
  readonly schemaVersion: typeof TRUSTED_RESOLVER_INPUT_VERSION;
  readonly resourceType: TrustedResourceScopeType;
  readonly resourceId: string;
}

export interface TrustedPrincipalResolutionInputV1 {
  readonly schemaVersion: typeof TRUSTED_RESOLVER_INPUT_VERSION;
  readonly authenticationReference: TrustedAuthenticationReferenceV1;
}

export interface TrustedTenantAuthorityResolutionInputV1 {
  readonly schemaVersion: typeof TRUSTED_RESOLVER_INPUT_VERSION;
  readonly principal: TrustedServerPrincipalV1;
  readonly resourceScope: TrustedResourceScopeV1;
  readonly consumer: TrustedConsumerId;
  readonly source: TrustedSourceId;
}

export interface TrustedRequestIdentityFactoryInputV1 {
  readonly schemaVersion: typeof TRUSTED_RESOLVER_INPUT_VERSION;
  readonly transport: TrustedServerTransport;
  readonly consumer: TrustedConsumerId;
  readonly source: TrustedSourceId;
  readonly initiatedAt: string;
}

export const TRUSTED_SERVER_RESPONSE_STATUSES = Object.freeze([
  'COMPLETED',
  'REJECTED',
  'CANCELLED',
  'TIMED_OUT',
  'INTERNAL_ERROR',
] as const);

export type TrustedServerExecutionStatus =
  (typeof TRUSTED_SERVER_RESPONSE_STATUSES)[number];

export const TRUSTED_SERVER_RESPONSE_SAFE_CODES = Object.freeze([
  'EXECUTION_COMPLETED',
  'REQUEST_REJECTED',
  'REQUEST_CANCELLED',
  'REQUEST_TIMED_OUT',
  'INTERNAL_ERROR',
] as const);

export type TrustedServerResponseSafeCode =
  (typeof TRUSTED_SERVER_RESPONSE_SAFE_CODES)[number];

export const TRUSTED_SERVER_RESULT_OUTCOMES = Object.freeze([
  'SUCCEEDED',
  'PARTIAL',
  'NO_RESULT',
] as const);

export type TrustedServerResultOutcome =
  (typeof TRUSTED_SERVER_RESULT_OUTCOMES)[number];

export interface TrustedServerResultSummaryV1 {
  readonly outcome: TrustedServerResultOutcome;
  readonly warningCount: number;
  readonly durationMs?: number;
}

interface TrustedServerExecutionResponseBaseV1 {
  readonly schemaVersion: typeof TRUSTED_SERVER_RESPONSE_VERSION;
  readonly requestId: string;
  readonly correlationId: string;
  readonly status: TrustedServerExecutionStatus;
  readonly safeCode: TrustedServerResponseSafeCode;
  readonly safeMessage: string;
  readonly completedAt: string;
}

export interface TrustedServerCompletedResponseV1
  extends TrustedServerExecutionResponseBaseV1 {
  readonly status: 'COMPLETED';
  readonly safeCode: 'EXECUTION_COMPLETED';
  readonly executionId: string;
  readonly resultSummary?: TrustedServerResultSummaryV1;
}

export interface TrustedServerRejectedResponseV1
  extends TrustedServerExecutionResponseBaseV1 {
  readonly status: 'REJECTED';
  readonly safeCode: 'REQUEST_REJECTED';
}

export interface TrustedServerCancelledResponseV1
  extends TrustedServerExecutionResponseBaseV1 {
  readonly status: 'CANCELLED';
  readonly safeCode: 'REQUEST_CANCELLED';
}

export interface TrustedServerTimedOutResponseV1
  extends TrustedServerExecutionResponseBaseV1 {
  readonly status: 'TIMED_OUT';
  readonly safeCode: 'REQUEST_TIMED_OUT';
}

export interface TrustedServerInternalErrorResponseV1
  extends TrustedServerExecutionResponseBaseV1 {
  readonly status: 'INTERNAL_ERROR';
  readonly safeCode: 'INTERNAL_ERROR';
}

export type TrustedServerExecutionResponseV1 =
  | TrustedServerCompletedResponseV1
  | TrustedServerRejectedResponseV1
  | TrustedServerCancelledResponseV1
  | TrustedServerTimedOutResponseV1
  | TrustedServerInternalErrorResponseV1;

export interface TrustedServerResponseSourceV1 {
  readonly requestId: string;
  readonly correlationId: string;
  readonly status: TrustedServerExecutionStatus;
  readonly completedAt: string;
  readonly executionId?: string;
  readonly resultSummary?: unknown;
}
