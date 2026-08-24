export const GROWTH_EXTERNAL_ACTION_TYPES_V1 = Object.freeze([
  'SOCIAL_PUBLISH',
  'SOCIAL_SCHEDULE',
  'EMAIL_SEND',
  'CRM_ACTION',
  'DISCOVERY_ACTION',
  'MULTIMEDIA_RENDER',
  'ASSET_TRANSFORM',
  'CAMPAIGN_ACTION',
] as const);

export type GrowthExternalActionTypeV1 =
  (typeof GROWTH_EXTERNAL_ACTION_TYPES_V1)[number];


export const GROWTH_EXTERNAL_ACTION_TARGETS_V1 = Object.freeze([
  'LINKEDIN',
  'INSTAGRAM',
  'FACEBOOK',
  'YOUTUBE',
  'AURA_MAIL',
  'AURA_CRM',
  'EXECUTIVE_DISCOVERY',
  'MULTIMEDIA_ENGINE',
  'ASSET_LIBRARY',
  'CAMPAIGN_RUNTIME',
] as const);

export type GrowthExternalActionTargetV1 =
  (typeof GROWTH_EXTERNAL_ACTION_TARGETS_V1)[number];


export type GrowthExternalActionActorTypeV1 =
  | 'USER'
  | 'SERVICE'
  | 'SYSTEM';


export interface GrowthExternalActionAuthorityV1 {
  readonly tenantId: string;

  readonly actor: {
    readonly actorId: string;
    readonly actorType: GrowthExternalActionActorTypeV1;
  };
}


export interface GrowthExternalActionCorrelationV1 {
  readonly requestId: string;
  readonly correlationId: string;
  readonly source: 'AURA_GROWTH';
  readonly sourceRecommendationId?: string;
}


export type GrowthExternalActionAuthorizationStateV1 =
  | 'NOT_REQUIRED'
  | 'PENDING'
  | 'AUTHORIZED'
  | 'REJECTED'
  | 'EXPIRED';


export interface GrowthExternalActionAuthorizationV1 {
  readonly required: boolean;
  readonly state: GrowthExternalActionAuthorizationStateV1;

  readonly policyId?: string;
  readonly authorizedBy?: string;
  readonly authorizedAt?: string;
  readonly expiresAt?: string;
}


export type GrowthExternalActionRiskClassificationV1 =
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | 'CRITICAL';


export type GrowthExternalActionExecutionStateV1 =
  | 'PROPOSED'
  | 'WAITING_AUTHORIZATION'
  | 'AUTHORIZED'
  | 'SCHEDULED'
  | 'EXECUTING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'REJECTED'
  | 'CANCELLED';


export interface GrowthExternalActionScheduleV1 {
  readonly executeAt?: string;
  readonly timezone?: string;
}


export interface GrowthExternalActionRetryPolicyV1 {
  readonly enabled: boolean;
  readonly maxAttempts: number;
  readonly backoffStrategy:
    | 'NONE'
    | 'FIXED'
    | 'EXPONENTIAL';

  readonly initialDelayMs?: number;
  readonly maxDelayMs?: number;
}


export interface GrowthExternalActionPayloadReferenceV1 {
  readonly payloadType: string;

  /**
   * Opaque reference only.
   *
   * Provider credentials, secrets and raw sensitive payloads
   * must not be embedded in this contract.
   */
  readonly referenceId: string;

  readonly version?: string;
}


export interface GrowthExternalActionEvidenceV1 {
  readonly evidenceId: string;
  readonly evidenceType: string;
  readonly recordedAt: string;
  readonly reference?: string;
}


export interface GrowthExternalActionFailureV1 {
  readonly code: string;
  readonly message: string;
  readonly retryable: boolean;
}


export interface GrowthExternalActionReceiptV1 {
  readonly receiptId: string;
  readonly actionId: string;
  readonly state: GrowthExternalActionExecutionStateV1;

  readonly providerExecutionId?: string;
  readonly executedAt?: string;

  readonly evidence: readonly GrowthExternalActionEvidenceV1[];

  readonly failure?: GrowthExternalActionFailureV1;
}


export interface GrowthExternalActionRequestV1 {
  readonly actionId: string;

  readonly authority: GrowthExternalActionAuthorityV1;

  readonly correlation: GrowthExternalActionCorrelationV1;

  readonly actionType: GrowthExternalActionTypeV1;

  readonly target: GrowthExternalActionTargetV1;

  readonly payload:
    GrowthExternalActionPayloadReferenceV1;

  readonly authorization:
    GrowthExternalActionAuthorizationV1;

  readonly schedule:
    GrowthExternalActionScheduleV1;

  readonly idempotencyKey: string;

  readonly risk:
    GrowthExternalActionRiskClassificationV1;

  readonly executionState:
    GrowthExternalActionExecutionStateV1;

  readonly retryPolicy:
    GrowthExternalActionRetryPolicyV1;
}


export interface GrowthExternalActionResultV1 {
  readonly actionId: string;
  readonly requestId: string;
  readonly correlationId: string;

  readonly state:
    GrowthExternalActionExecutionStateV1;

  readonly receipt?: GrowthExternalActionReceiptV1;

  readonly warnings: readonly string[];

  readonly failure?: GrowthExternalActionFailureV1;
}