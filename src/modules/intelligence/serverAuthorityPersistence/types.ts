import type {
  BoundaryActorReferenceV1,
  BoundaryActorTypeV1,
} from '../os/boundary/types';
import type {
  TrustedServerPrincipalV1,
  TrustedServerPrincipalType,
  TrustedTenantMembershipRole,
} from '../serverComposition/types';
import type {
  AuthorityLegacySourceRecordVersionV1,
  AuthorityLegacyTenantAliasCandidateV1,
  AuthorityLegacyTenantSourceRecordV1,
} from './legacyTenantSources';

export const AUTHORITY_PERSISTENCE_SCHEMA_VERSION = '1' as const;
export const TENANT_AUTHORITY_RECORD_VERSION = '1' as const;
export const TENANT_MEMBERSHIP_RECORD_VERSION = '1' as const;
export const TENANT_ALIAS_RECORD_VERSION = '1' as const;
export const AUTHORITY_WRITE_PRECONDITION_VERSION = '1' as const;
export const AUTHORITY_COMMAND_VERSION = '1' as const;
export const AUTHORITY_IDEMPOTENCY_RECORD_VERSION = '1' as const;
export const AUTHORITY_REPOSITORY_RESULT_VERSION = '1' as const;
export const AUTHORITY_AUDIT_EVENT_VERSION = '1' as const;
export const AUTHORITY_OUTBOX_EVENT_VERSION = '1' as const;
export const AUTHORITY_MIGRATION_METADATA_VERSION = '1' as const;
export const AUTHORITY_PERSISTENCE_CONTRACT_ERROR_VERSION = '1' as const;
export const AUTHORITY_TENANT_ROLE_VOCABULARY_VERSION = '1' as const;
export const AUTHORITY_MEMBERSHIP_KEY_VERSION = '1' as const;
export const AUTHORITY_ALIAS_KEY_VERSION = '1' as const;
export const AUTHORITY_REPOSITORY_AUTHORIZATION_DECISION_VERSION =
  '1' as const;
export const AUTHORITY_REPOSITORY_INVOCATION_CONTEXT_VERSION =
  '1' as const;
export const AUTHORITY_OPERATION_BINDING_RECORD_VERSION = '1' as const;
export const AUTHORITY_OUTBOX_DELIVERY_RECORD_VERSION = '1' as const;
export const TENANT_ACTIVATION_PREREQUISITE_VERSION = '1' as const;
export const LEGACY_TENANT_CANONICALIZATION_INPUT_VERSION = '1' as const;
export const AUTHORITY_DETERMINISTIC_ID_VERSION = '1' as const;

export const TENANT_AUTHORITY_STATUSES = Object.freeze([
  'PENDING',
  'ACTIVE',
  'SUSPENDED',
  'DEACTIVATED',
  'DELETED',
] as const);

export type TenantAuthorityStatus =
  (typeof TENANT_AUTHORITY_STATUSES)[number];

export const TENANT_MEMBERSHIP_AUTHORITY_STATUSES = Object.freeze([
  'ACTIVE',
  'SUSPENDED',
  'REVOKED',
  'DELETED',
] as const);

export type TenantMembershipAuthorityStatus =
  (typeof TENANT_MEMBERSHIP_AUTHORITY_STATUSES)[number];

export const TENANT_ALIAS_TYPES = Object.freeze([
  'TENANT_SLUG',
  'LEGACY_TENANT_ID',
  'CLIENT_REFERENCE',
  'ORGANIZATION_REFERENCE',
] as const);

export type TenantAliasType = (typeof TENANT_ALIAS_TYPES)[number];

export const TENANT_ALIAS_STATUSES = Object.freeze([
  'ACTIVE',
  'TOMBSTONED',
] as const);

export type TenantAliasStatus = (typeof TENANT_ALIAS_STATUSES)[number];

export const AUTHORITY_MIGRATION_STATUSES = Object.freeze([
  'INVENTORIED',
  'CLASSIFIED',
  'SHADOWED',
  'VALIDATED',
  'APPLIED',
  'REJECTED',
  'ROLLED_BACK',
] as const);

export type AuthorityMigrationStatus =
  (typeof AUTHORITY_MIGRATION_STATUSES)[number];

export interface AuthorityMigrationMetadataV1 {
  readonly schemaVersion: typeof AUTHORITY_MIGRATION_METADATA_VERSION;
  readonly authorityUse: 'PROHIBITED';
  readonly migrationVersion: string;
  readonly sourceSystem: string;
  readonly sourceLocatorKey: string;
  readonly sourceRecordVersion: AuthorityLegacySourceRecordVersionV1;
  readonly sourceRecordFingerprint: string;
  readonly classifiedVariant: string;
  readonly migrationStatus: AuthorityMigrationStatus;
  readonly validatedAt?: string;
  readonly appliedAt?: string;
  readonly rejectionCode?: string;
  readonly rollbackReference?: string;
}

export interface PersistedTenantAuthorityRecordV1 {
  readonly schemaVersion: typeof TENANT_AUTHORITY_RECORD_VERSION;
  readonly tenantId: string;
  readonly status: TenantAuthorityStatus;
  readonly authorityVersion: number;
  readonly recordVersion: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly createdBy: BoundaryActorReferenceV1;
  readonly updatedBy: BoundaryActorReferenceV1;
  readonly statusChangedAt: string;
  readonly statusReasonCode: string;
  readonly tenantSlug?: string;
  readonly organizationReference?: string;
  readonly clientReference?: string;
  readonly migrationState?: AuthorityMigrationMetadataV1;
  readonly legacyAliases?: readonly string[];
}

export interface PersistedTenantMembershipRecordV1 {
  readonly schemaVersion: typeof TENANT_MEMBERSHIP_RECORD_VERSION;
  readonly membershipId: string;
  readonly membershipKey: string;
  readonly principalType: TrustedServerPrincipalType;
  readonly principalId: string;
  readonly tenantId: string;
  readonly roles: readonly TrustedTenantMembershipRole[];
  readonly roleVocabularyVersion:
    typeof AUTHORITY_TENANT_ROLE_VOCABULARY_VERSION;
  readonly status: TenantMembershipAuthorityStatus;
  readonly membershipVersion: number;
  readonly authorityVersion: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly createdBy: BoundaryActorReferenceV1;
  readonly updatedBy: BoundaryActorReferenceV1;
  readonly revokedAt?: string;
  readonly revokedBy?: BoundaryActorReferenceV1;
  readonly revocationReasonCode?: string;
  readonly migrationState?: AuthorityMigrationMetadataV1;
}

export interface PersistedTenantAliasRecordV1 {
  readonly schemaVersion: typeof TENANT_ALIAS_RECORD_VERSION;
  readonly aliasKey: string;
  readonly aliasType: TenantAliasType;
  readonly normalizedAlias: string;
  readonly tenantId: string;
  readonly status: TenantAliasStatus;
  readonly aliasVersion: number;
  readonly authorityVersion: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly createdBy: BoundaryActorReferenceV1;
  readonly updatedBy: BoundaryActorReferenceV1;
  readonly tombstonedAt?: string;
  readonly tombstonedBy?: BoundaryActorReferenceV1;
  readonly tombstoneReasonCode?: string;
}

export interface TenantMembershipKeyInputV1 {
  readonly principalType: TrustedServerPrincipalType;
  readonly principalId: string;
  readonly tenantId: string;
}

export interface TenantAliasKeyInputV1 {
  readonly aliasType: TenantAliasType;
  readonly normalizedAlias: string;
}

export const AUTHORITY_WRITE_PRECONDITION_TYPES = Object.freeze([
  'MUST_NOT_EXIST',
  'MUST_EXIST_AT_VERSION',
  'MUST_MATCH_AUTHORITY_VERSION',
] as const);

export type AuthorityWritePreconditionType =
  (typeof AUTHORITY_WRITE_PRECONDITION_TYPES)[number];

export type AuthorityWritePreconditionV1 =
  | Readonly<{
      schemaVersion: typeof AUTHORITY_WRITE_PRECONDITION_VERSION;
      type: 'MUST_NOT_EXIST';
    }>
  | Readonly<{
      schemaVersion: typeof AUTHORITY_WRITE_PRECONDITION_VERSION;
      type: 'MUST_EXIST_AT_VERSION';
      recordVersion: number;
    }>
  | Readonly<{
      schemaVersion: typeof AUTHORITY_WRITE_PRECONDITION_VERSION;
      type: 'MUST_MATCH_AUTHORITY_VERSION';
      authorityVersion: number;
    }>;

export const AUTHORITY_OPERATION_TYPES = Object.freeze([
  'CREATE_TENANT_AUTHORITY',
  'UPDATE_TENANT_STATUS',
  'CREATE_TENANT_MEMBERSHIP',
  'UPDATE_TENANT_MEMBERSHIP_ROLES',
  'CHANGE_TENANT_MEMBERSHIP_STATUS',
  'RESERVE_TENANT_ALIAS',
  'TOMBSTONE_TENANT_ALIAS',
  'CANONICALIZE_LEGACY_TENANT',
] as const);

export type AuthorityOperationType =
  (typeof AUTHORITY_OPERATION_TYPES)[number];

export const AUTHORITY_REPOSITORY_AUTHORIZATION_DECISIONS = Object.freeze([
  'ALLOWED',
  'DENIED',
] as const);

export type AuthorityRepositoryAuthorizationDecision =
  (typeof AUTHORITY_REPOSITORY_AUTHORIZATION_DECISIONS)[number];

export interface AuthorityRepositoryAuthorizationDecisionV1 {
  readonly schemaVersion:
    typeof AUTHORITY_REPOSITORY_AUTHORIZATION_DECISION_VERSION;
  readonly decisionVersion:
    typeof AUTHORITY_REPOSITORY_AUTHORIZATION_DECISION_VERSION;
  readonly decision: AuthorityRepositoryAuthorizationDecision;
  readonly authorizationVersion: string;
  readonly operationTypes: readonly AuthorityOperationType[];
  readonly principalType: TrustedServerPrincipalType;
  readonly principalId: string;
  readonly actorType: BoundaryActorTypeV1;
  readonly actorId: string;
  readonly decidedAt: string;
  readonly expiresAt?: string;
  readonly safeReasonCode: string;
}

export interface AuthorityRepositoryInvocationContextV1 {
  readonly schemaVersion:
    typeof AUTHORITY_REPOSITORY_INVOCATION_CONTEXT_VERSION;
  readonly principal: TrustedServerPrincipalV1;
  readonly actor: BoundaryActorReferenceV1;
  readonly authorizationDecision:
    AuthorityRepositoryAuthorizationDecisionV1;
  readonly authorizedOperationTypes: readonly AuthorityOperationType[];
  readonly consumerId: string;
  readonly source: string;
  readonly requestId: string;
  readonly correlationId: string;
  readonly initiatedAt: string;
  readonly authorizationVersion: string;
  /** Preserves the infrastructure signal by identity; never clone or freeze. */
  readonly cancellationSignal?: AbortSignal;
}

interface AuthorityAdministrativeCommandBaseV1 {
  readonly schemaVersion: typeof AUTHORITY_COMMAND_VERSION;
  readonly operationType: AuthorityOperationType;
  readonly operationId: string;
  readonly idempotencyKey: string;
  readonly actor: BoundaryActorReferenceV1;
  readonly requestedAt: string;
  readonly precondition: AuthorityWritePreconditionV1;
  readonly reasonCode: string;
  readonly requestId: string;
  readonly correlationId: string;
}

export interface CreateTenantAuthorityPayloadV1 {
  readonly tenantId: string;
  readonly initialStatus: 'PENDING';
  readonly tenantSlug?: string;
  readonly organizationReference?: string;
  readonly clientReference?: string;
}

export interface CreateTenantAuthorityCommandV1
  extends AuthorityAdministrativeCommandBaseV1 {
  readonly operationType: 'CREATE_TENANT_AUTHORITY';
  readonly precondition: Readonly<{
    schemaVersion: typeof AUTHORITY_WRITE_PRECONDITION_VERSION;
    type: 'MUST_NOT_EXIST';
  }>;
  readonly payload: CreateTenantAuthorityPayloadV1;
}

export interface UpdateTenantStatusPayloadV1 {
  readonly tenantId: string;
  readonly currentStatus: TenantAuthorityStatus;
  readonly targetStatus: TenantAuthorityStatus;
  readonly activationPrerequisite?: TenantActivationPrerequisiteV1;
}

export interface UpdateTenantStatusCommandV1
  extends AuthorityAdministrativeCommandBaseV1 {
  readonly operationType: 'UPDATE_TENANT_STATUS';
  readonly payload: UpdateTenantStatusPayloadV1;
}

export interface CreateTenantMembershipPayloadV1 {
  readonly principalType: TrustedServerPrincipalType;
  readonly principalId: string;
  readonly tenantId: string;
  readonly roles: readonly TrustedTenantMembershipRole[];
  readonly initialStatus: 'ACTIVE';
}

export interface CreateTenantMembershipCommandV1
  extends AuthorityAdministrativeCommandBaseV1 {
  readonly operationType: 'CREATE_TENANT_MEMBERSHIP';
  readonly precondition: Readonly<{
    schemaVersion: typeof AUTHORITY_WRITE_PRECONDITION_VERSION;
    type: 'MUST_NOT_EXIST';
  }>;
  readonly payload: CreateTenantMembershipPayloadV1;
}

export interface UpdateTenantMembershipRolesPayloadV1 {
  readonly membershipKey: string;
  readonly principalType: TrustedServerPrincipalType;
  readonly principalId: string;
  readonly tenantId: string;
  readonly roles: readonly TrustedTenantMembershipRole[];
}

export interface UpdateTenantMembershipRolesCommandV1
  extends AuthorityAdministrativeCommandBaseV1 {
  readonly operationType: 'UPDATE_TENANT_MEMBERSHIP_ROLES';
  readonly payload: UpdateTenantMembershipRolesPayloadV1;
}

export interface ChangeTenantMembershipStatusPayloadV1 {
  readonly membershipKey: string;
  readonly principalType: TrustedServerPrincipalType;
  readonly principalId: string;
  readonly tenantId: string;
  readonly currentStatus: TenantMembershipAuthorityStatus;
  readonly targetStatus: TenantMembershipAuthorityStatus;
}

export interface ChangeTenantMembershipStatusCommandV1
  extends AuthorityAdministrativeCommandBaseV1 {
  readonly operationType: 'CHANGE_TENANT_MEMBERSHIP_STATUS';
  readonly payload: ChangeTenantMembershipStatusPayloadV1;
}

export interface ReserveTenantAliasPayloadV1 {
  readonly aliasKey: string;
  readonly aliasType: TenantAliasType;
  readonly normalizedAlias: string;
  readonly tenantId: string;
}

export interface ReserveTenantAliasCommandV1
  extends AuthorityAdministrativeCommandBaseV1 {
  readonly operationType: 'RESERVE_TENANT_ALIAS';
  readonly precondition: Readonly<{
    schemaVersion: typeof AUTHORITY_WRITE_PRECONDITION_VERSION;
    type: 'MUST_NOT_EXIST';
  }>;
  readonly payload: ReserveTenantAliasPayloadV1;
}

export interface TombstoneTenantAliasPayloadV1 {
  readonly aliasKey: string;
  readonly aliasType: TenantAliasType;
  readonly normalizedAlias: string;
  readonly tenantId: string;
}

export interface TombstoneTenantAliasCommandV1
  extends AuthorityAdministrativeCommandBaseV1 {
  readonly operationType: 'TOMBSTONE_TENANT_ALIAS';
  readonly payload: TombstoneTenantAliasPayloadV1;
}

export interface TenantActivationPrerequisiteV1 {
  readonly schemaVersion: typeof TENANT_ACTIVATION_PREREQUISITE_VERSION;
  readonly tenantId: string;
  readonly tenantCurrentStatus: 'PENDING' | 'SUSPENDED';
  readonly tenantExpectedRecordVersion: number;
  readonly membershipKey: string;
  readonly membershipPrincipalType: 'USER';
  readonly membershipPrincipalId: string;
  readonly membershipTenantId: string;
  readonly membershipStatus: 'ACTIVE';
  readonly membershipRoles: readonly TrustedTenantMembershipRole[];
  readonly membershipExpectedVersion: number;
}

export const LEGACY_TENANT_VARIANTS = Object.freeze([
  'AUTO_ID_WITH_TENANT_ID_SLUG',
  'AUTO_ID_WITH_TENANT_SLUG',
  'DOCUMENT_ID_EQUALS_TENANT_ID',
  'MISSING_SLUG',
  'STATUS_FIELD_ONLY',
  'TENANT_STATUS_FIELD_ONLY',
  'CONFLICTING_STATUS_FIELDS',
] as const);

export type LegacyTenantVariantV1 =
  (typeof LEGACY_TENANT_VARIANTS)[number];

export const LEGACY_TENANT_CANONICALIZATION_CLASSIFICATIONS =
  Object.freeze([
    'CANONICALIZABLE',
    'REQUIRES_REVIEW',
    'REJECTED',
  ] as const);

export type LegacyTenantCanonicalizationClassificationV1 =
  (typeof LEGACY_TENANT_CANONICALIZATION_CLASSIFICATIONS)[number];

export const LEGACY_TENANT_CONFLICT_DISPOSITIONS = Object.freeze([
  'NONE',
  'REQUIRE_REVIEW',
  'REJECT',
] as const);

export type LegacyTenantConflictDispositionV1 =
  (typeof LEGACY_TENANT_CONFLICT_DISPOSITIONS)[number];

export interface LegacyTenantCanonicalTargetV1 {
  readonly tenantId: string;
  readonly status: TenantAuthorityStatus;
  readonly tenantSlug?: string;
  readonly organizationReference?: string;
  readonly clientReference?: string;
}

export interface LegacyTenantAliasReservationV1 {
  readonly aliasKey: string;
  readonly aliasType: TenantAliasType;
  readonly normalizedAlias: string;
  readonly tenantId: string;
}

export interface LegacyTenantCanonicalizationInputV1 {
  readonly schemaVersion:
    typeof LEGACY_TENANT_CANONICALIZATION_INPUT_VERSION;
  readonly canonicalDocumentId: string;
  readonly sourceRecord: AuthorityLegacyTenantSourceRecordV1;
  readonly canonicalTarget: LegacyTenantCanonicalTargetV1;
  readonly selectedAliasCandidates:
    readonly AuthorityLegacyTenantAliasCandidateV1[];
  readonly migrationMetadata: AuthorityMigrationMetadataV1;
  readonly conflictDisposition: LegacyTenantConflictDispositionV1;
}

export interface CanonicalizeLegacyTenantPayloadV1 {
  readonly canonicalizationInput: LegacyTenantCanonicalizationInputV1;
}

export interface CanonicalizeLegacyTenantCommandV1
  extends AuthorityAdministrativeCommandBaseV1 {
  readonly operationType: 'CANONICALIZE_LEGACY_TENANT';
  readonly precondition: Readonly<{
    schemaVersion: typeof AUTHORITY_WRITE_PRECONDITION_VERSION;
    type: 'MUST_NOT_EXIST';
  }>;
  readonly payload: CanonicalizeLegacyTenantPayloadV1;
}

export type AuthorityAdministrativeCommandV1 =
  | CreateTenantAuthorityCommandV1
  | UpdateTenantStatusCommandV1
  | CreateTenantMembershipCommandV1
  | UpdateTenantMembershipRolesCommandV1
  | ChangeTenantMembershipStatusCommandV1
  | ReserveTenantAliasCommandV1
  | TombstoneTenantAliasCommandV1
  | CanonicalizeLegacyTenantCommandV1;

export const AUTHORITY_IDEMPOTENCY_STATUSES = Object.freeze([
  'IN_PROGRESS',
  'COMPLETED',
  'REJECTED',
] as const);

export type AuthorityIdempotencyStatus =
  (typeof AUTHORITY_IDEMPOTENCY_STATUSES)[number];

interface AuthorityIdempotencyRecordBaseV1 {
  readonly schemaVersion: typeof AUTHORITY_IDEMPOTENCY_RECORD_VERSION;
  readonly idempotencyKey: string;
  readonly operationId: string;
  readonly operationType: AuthorityOperationType;
  readonly requestFingerprint: string;
  readonly status: AuthorityIdempotencyStatus;
  readonly startedAt: string;
  readonly version: number;
}

export type AuthorityIdempotencyRecordV1 =
  | Readonly<
      AuthorityIdempotencyRecordBaseV1 & {
        status: 'IN_PROGRESS';
      }
    >
  | Readonly<
      AuthorityIdempotencyRecordBaseV1 & {
        status: 'COMPLETED';
        completedAt: string;
        exactRepositoryResult: AuthorityRepositoryResultV1;
        resultFingerprint: string;
      }
    >
  | Readonly<
      AuthorityIdempotencyRecordBaseV1 & {
        status: 'REJECTED';
        completedAt: string;
        exactRepositoryResult: AuthorityRepositoryResultV1;
        resultFingerprint: string;
        failureCode: string;
      }
    >;

export type AuthoritySingleTransactionIdempotencyRecordV1 = Extract<
  AuthorityIdempotencyRecordV1,
  { readonly status: 'COMPLETED' | 'REJECTED' }
>;

export const AUTHORITY_OPERATION_BINDING_STATUSES = Object.freeze([
  'BOUND',
  'COMPLETED',
  'REJECTED',
] as const);

export type AuthorityOperationBindingStatus =
  (typeof AUTHORITY_OPERATION_BINDING_STATUSES)[number];

interface AuthorityOperationBindingRecordBaseV1 {
  readonly schemaVersion: typeof AUTHORITY_OPERATION_BINDING_RECORD_VERSION;
  readonly operationId: string;
  readonly idempotencyKey: string;
  readonly operationType: AuthorityOperationType;
  readonly requestFingerprint: string;
  readonly status: AuthorityOperationBindingStatus;
  readonly createdAt: string;
  readonly version: number;
}

export type AuthorityOperationBindingRecordV1 =
  | Readonly<
      AuthorityOperationBindingRecordBaseV1 & {
        readonly status: 'BOUND';
      }
    >
  | Readonly<
      AuthorityOperationBindingRecordBaseV1 & {
        readonly status: 'COMPLETED' | 'REJECTED';
        readonly repositoryResultReference: string;
        readonly completedAt: string;
      }
    >;

export const AUTHORITY_REPOSITORY_RESULT_STATUSES = Object.freeze([
  'APPLIED',
  'NO_OP',
  'REJECTED',
  'CONFLICT',
  'NOT_FOUND',
  'INTERNAL_ERROR',
] as const);

export type AuthorityRepositoryResultStatus =
  (typeof AUTHORITY_REPOSITORY_RESULT_STATUSES)[number];

export const AUTHORITY_RETRY_DISPOSITIONS = Object.freeze([
  'DO_NOT_RETRY',
  'RETRY_AFTER_READ',
  'SAFE_TO_RETRY_WITH_SAME_IDEMPOTENCY_KEY',
] as const);

export type AuthorityRetryDisposition =
  (typeof AUTHORITY_RETRY_DISPOSITIONS)[number];

interface AuthorityRepositoryResultBaseV1 {
  readonly schemaVersion: typeof AUTHORITY_REPOSITORY_RESULT_VERSION;
  readonly operationId: string;
  readonly correlationId: string;
  readonly status: AuthorityRepositoryResultStatus;
  readonly safeCode: string;
  readonly completedAt: string;
  readonly retryDisposition: AuthorityRetryDisposition;
}

export type AuthorityRepositoryResultV1 =
  | Readonly<
      AuthorityRepositoryResultBaseV1 & {
        status: 'APPLIED';
        resultingVersion: number;
        resourceReference: string;
      }
    >
  | Readonly<
      AuthorityRepositoryResultBaseV1 & {
        status: 'NO_OP';
        resultingVersion?: number;
        resourceReference?: string;
      }
    >
  | Readonly<
      AuthorityRepositoryResultBaseV1 & {
        status:
          | 'REJECTED'
          | 'CONFLICT'
          | 'NOT_FOUND'
          | 'INTERNAL_ERROR';
      }
    >;

export const AUTHORITY_EVENT_TYPES = Object.freeze([
  'TENANT_CREATED',
  'TENANT_STATUS_CHANGED',
  'TENANT_ACTIVATED',
  'TENANT_SUSPENDED',
  'TENANT_REACTIVATED',
  'TENANT_DEACTIVATED',
  'TENANT_DELETED',
  'TENANT_CANONICALIZED',
  'MEMBERSHIP_CREATED',
  'MEMBERSHIP_ACTIVATED',
  'MEMBERSHIP_ROLES_CHANGED',
  'MEMBERSHIP_SUSPENDED',
  'MEMBERSHIP_REACTIVATED',
  'MEMBERSHIP_REVOKED',
  'MEMBERSHIP_DELETED',
  'ALIAS_RESERVED',
  'ALIAS_TOMBSTONED',
  'MIGRATION_APPLIED',
  'MIGRATION_REJECTED',
] as const);

export type AuthorityEventType = (typeof AUTHORITY_EVENT_TYPES)[number];

export const AUTHORITY_RESOURCE_TYPES = Object.freeze([
  'TENANT',
  'MEMBERSHIP',
  'ALIAS',
  'MIGRATION',
] as const);

export type AuthorityResourceType =
  (typeof AUTHORITY_RESOURCE_TYPES)[number];

export interface AuthorityEventPayloadSummaryV1 {
  readonly tenantStatusFrom?: TenantAuthorityStatus;
  readonly tenantStatusTo?: TenantAuthorityStatus;
  readonly membershipStatusFrom?: TenantMembershipAuthorityStatus;
  readonly membershipStatusTo?: TenantMembershipAuthorityStatus;
  readonly previousRoleCount?: number;
  readonly resultingRoleCount?: number;
  readonly aliasType?: TenantAliasType;
  readonly aliasStatus?: TenantAliasStatus;
  readonly migrationStatus?: AuthorityMigrationStatus;
}

interface AuthorityEventBaseV1 {
  readonly eventId: string;
  readonly eventType: AuthorityEventType;
  readonly operationId: string;
  readonly correlationId: string;
  readonly actor: BoundaryActorReferenceV1;
  readonly resourceType: AuthorityResourceType;
  readonly resourceId: string;
  readonly reasonCode: string;
  readonly beforeVersion?: number;
  readonly afterVersion?: number;
  readonly occurredAt: string;
  readonly payloadSummary: AuthorityEventPayloadSummaryV1;
}

export interface AuthorityAuditEventV1 extends AuthorityEventBaseV1 {
  readonly schemaVersion: typeof AUTHORITY_AUDIT_EVENT_VERSION;
}

export interface AuthorityOutboxEventV1 extends AuthorityEventBaseV1 {
  readonly schemaVersion: typeof AUTHORITY_OUTBOX_EVENT_VERSION;
}

export const AUTHORITY_OUTBOX_DELIVERY_STATUSES = Object.freeze([
  'PENDING',
  'LEASED',
  'DELIVERED',
  'FAILED_TERMINAL',
] as const);

export type AuthorityOutboxDeliveryStatus =
  (typeof AUTHORITY_OUTBOX_DELIVERY_STATUSES)[number];

interface AuthorityOutboxDeliveryRecordBaseV1 {
  readonly schemaVersion: typeof AUTHORITY_OUTBOX_DELIVERY_RECORD_VERSION;
  readonly eventId: string;
  readonly deliveryStatus: AuthorityOutboxDeliveryStatus;
  readonly attemptCount: number;
  readonly availableAt: string;
  readonly lastAttemptAt?: string;
  readonly version: number;
}

export type AuthorityOutboxDeliveryRecordV1 =
  | Readonly<
      AuthorityOutboxDeliveryRecordBaseV1 & {
        readonly deliveryStatus: 'PENDING';
      }
    >
  | Readonly<
      AuthorityOutboxDeliveryRecordBaseV1 & {
        readonly deliveryStatus: 'LEASED';
        readonly leaseOwner: string;
        readonly leaseExpiresAt: string;
      }
    >
  | Readonly<
      AuthorityOutboxDeliveryRecordBaseV1 & {
        readonly deliveryStatus: 'DELIVERED';
        readonly deliveredAt: string;
      }
    >
  | Readonly<
      AuthorityOutboxDeliveryRecordBaseV1 & {
        readonly deliveryStatus: 'FAILED_TERMINAL';
        readonly safeFailureCode: string;
      }
    >;
