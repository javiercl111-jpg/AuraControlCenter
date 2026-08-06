export type BoundaryExecutionMode = 'DISABLED' | 'SHADOW_ONLY' | 'EVALUATION' | 'PRODUCTIVE';

export const BOUNDARY_INVOCATION_CONTEXT_VERSION = '1' as const;
export const AUTHORITATIVE_EXECUTION_CONTEXT_VERSION = '1' as const;

export const BOUNDARY_ACTOR_TYPES_V1 = Object.freeze([
  'USER',
  'SERVICE',
  'SYSTEM',
] as const);

export type BoundaryActorTypeV1 =
  (typeof BOUNDARY_ACTOR_TYPES_V1)[number];

export const AUTHORITATIVE_BOUNDARY_EXECUTION_MODES_V1 = Object.freeze([
  'SHADOW_ONLY',
  'EVALUATION',
] as const);

export type AuthoritativeBoundaryExecutionModeV1 =
  (typeof AUTHORITATIVE_BOUNDARY_EXECUTION_MODES_V1)[number];

export interface BoundaryActorReferenceV1 {
  readonly actorType: BoundaryActorTypeV1;
  readonly actorId: string;
}

export interface BoundaryInvocationContextV1 {
  readonly schemaVersion: typeof BOUNDARY_INVOCATION_CONTEXT_VERSION;
  readonly tenantId: string;
  readonly actor: BoundaryActorReferenceV1;
  readonly consumerId: string;
  readonly source: string;
  readonly requestId: string;
  readonly correlationId: string;
}

export interface AuthoritativeExecutionContextV1 {
  readonly schemaVersion:
    typeof AUTHORITATIVE_EXECUTION_CONTEXT_VERSION;
  readonly tenantId: string;
  readonly actor: BoundaryActorReferenceV1;
  readonly consumerId: string;
  readonly source: string;
  readonly requestId: string;
  readonly correlationId: string;
  readonly executionMode: AuthoritativeBoundaryExecutionModeV1;
  readonly initiatedAt: string;
  /** Canonical ISO instant derived from initiatedAt plus policy timeout. */
  readonly authoritativeDeadlineAt: string;
  readonly authorizationPolicyVersion: string;
}

export const AUTHORITATIVE_BOUNDARY_POLICY_SCHEMA_VERSION = '1' as const;

export const AUTHORITATIVE_BOUNDARY_POLICY_DECISIONS_V1 = Object.freeze([
  'ALLOWED',
  'DENIED',
] as const);

export type AuthoritativeBoundaryPolicyDecisionTypeV1 =
  (typeof AUTHORITATIVE_BOUNDARY_POLICY_DECISIONS_V1)[number];

export const AUTHORITATIVE_BOUNDARY_POLICY_REASON_CODES_V1 =
  Object.freeze([
    'POLICY_ALLOWED',
    'POLICY_DISABLED',
    'TENANT_NOT_ALLOWED',
    'CONSUMER_NOT_ALLOWED',
    'SOURCE_NOT_ALLOWED',
    'ACTOR_NOT_ALLOWED',
    'MODE_NOT_ALLOWED',
    'POLICY_NOT_FOUND',
    'POLICY_VERSION_UNSUPPORTED',
  ] as const);

export type AuthoritativeBoundaryPolicyReasonCodeV1 =
  (typeof AUTHORITATIVE_BOUNDARY_POLICY_REASON_CODES_V1)[number];

export type AuthoritativeBoundaryPolicyDenialReasonCodeV1 =
  Exclude<
    AuthoritativeBoundaryPolicyReasonCodeV1,
    'POLICY_ALLOWED'
  >;

export interface AuthoritativeBoundaryPolicyQueryV1 {
  readonly schemaVersion:
    typeof AUTHORITATIVE_BOUNDARY_POLICY_SCHEMA_VERSION;
  readonly tenantId: string;
  readonly consumerId: string;
  readonly source: string;
  readonly requestedMode: BoundaryExecutionMode;
  readonly actor: BoundaryActorReferenceV1;
}

interface AuthoritativeBoundaryPolicyDecisionBaseV1 {
  readonly schemaVersion:
    typeof AUTHORITATIVE_BOUNDARY_POLICY_SCHEMA_VERSION;
  /**
   * Stable opaque identifier supplied by the policy producer. Boundary must
   * never synthesize it from request data, timestamps or tenant identity.
   */
  readonly authorizationPolicyVersion: string;
  readonly evaluatedTenantId: string;
  readonly evaluatedConsumerId: string;
  readonly evaluatedSource: string;
  readonly evaluatedActor: BoundaryActorReferenceV1;
  readonly requestedMode: BoundaryExecutionMode;
}

export interface AuthoritativeBoundaryPolicyAllowedDecisionV1
  extends AuthoritativeBoundaryPolicyDecisionBaseV1 {
  readonly decision: 'ALLOWED';
  readonly reasonCode: 'POLICY_ALLOWED';
  readonly effectiveExecutionMode:
    AuthoritativeBoundaryExecutionModeV1;
  /** Producer-resolved timeout; this contract supplies no default. */
  readonly effectiveTimeoutMs: number;
}

export interface AuthoritativeBoundaryPolicyDeniedDecisionV1
  extends AuthoritativeBoundaryPolicyDecisionBaseV1 {
  readonly decision: 'DENIED';
  readonly reasonCode:
    AuthoritativeBoundaryPolicyDenialReasonCodeV1;
}

export type AuthoritativeBoundaryPolicyDecisionV1 =
  | AuthoritativeBoundaryPolicyAllowedDecisionV1
  | AuthoritativeBoundaryPolicyDeniedDecisionV1;

/**
 * Canonical authority vocabulary reserved for H0B conflict detection.
 * H0A exposes the closed inventory but performs no payload comparison.
 */
export const BOUNDARY_RESERVED_AUTHORITY_FIELDS = Object.freeze([
  'tenant',
  'tenantId',
  'actor',
  'actorId',
  'actorType',
  'consumerId',
  'source',
  'requestId',
  'correlationId',
  'requestedMode',
  'executionMode',
  'authoritativeDeadlineAt',
  'authorizationPolicyVersion',
] as const);

export type BoundaryReservedAuthorityField =
  (typeof BOUNDARY_RESERVED_AUTHORITY_FIELDS)[number];

export type BoundaryStatus =
  | 'REJECTED'
  | 'ACCEPTED'
  | 'COMPLETED'
  | 'PARTIAL'
  | 'FAILED'
  | 'CANCELLED'
  | 'TIMED_OUT';

export interface BoundaryTenantContext {
  readonly tenantId: string;
  readonly companyId?: string;
}

export interface BoundaryActorContext {
  readonly actorId: string;
  readonly actorType: string;
  readonly roles?: readonly string[];
}

export interface GovernedExecutionRequest {
  readonly requestId: string;
  readonly correlationId: string;
  readonly tenant: BoundaryTenantContext;
  readonly actor: BoundaryActorContext;
  readonly source: string;
  readonly requestedMode: BoundaryExecutionMode;
  readonly payload: unknown;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly timeoutMs?: number;
  readonly cancellationSignal?: AbortSignal;
}

export interface BoundaryPublicWarning {
  readonly code: string;
  readonly message: string;
}

export interface BoundaryPublicError {
  readonly code: string;
  readonly message: string;
  readonly retryable: boolean;
  readonly details?: Readonly<Record<string, string | number | boolean>>;
}

export interface GovernedExecutionResponse {
  readonly requestId: string;
  readonly correlationId: string;
  readonly mode: BoundaryExecutionMode;
  readonly status: BoundaryStatus;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly durationMs: number;
  readonly resultSummary?: Readonly<Record<string, unknown>>;
  readonly comparisonSummary?: Readonly<Record<string, unknown>>;
  readonly semanticProjection?: Readonly<Record<string, unknown>>;
  readonly warnings: readonly BoundaryPublicWarning[];
  readonly errors: readonly BoundaryPublicError[];
}

const DEFAULT_BOUNDARY_TYPES = {};
export default DEFAULT_BOUNDARY_TYPES;
