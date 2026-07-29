import type {
  AuthorityAdministrativeCommandV1,
  AuthorityAuditEventV1,
  AuthorityIdempotencyRecordV1,
  AuthorityOperationBindingRecordV1,
  AuthorityOperationType,
  AuthorityOutboxDeliveryRecordV1,
  AuthorityOutboxEventV1,
  AuthorityRepositoryResultV1,
  LegacyTenantVariantV1,
  PersistedTenantAliasRecordV1,
  PersistedTenantAuthorityRecordV1,
  PersistedTenantMembershipRecordV1,
} from './types';

export const AUTHORITY_REPOSITORY_SNAPSHOT_VERSION = '1' as const;
export const AUTHORITY_LEGACY_SOURCE_RECORD_VERSION = '1' as const;
export const AUTHORITY_MUTATION_PLAN_VERSION = '1' as const;

export const AUTHORITY_REPOSITORY_COLLECTIONS = Object.freeze([
  'TENANTS',
  'MEMBERSHIPS',
  'ALIASES',
  'LEGACY_TENANT_SOURCES',
  'IDEMPOTENCY',
  'OPERATION_BINDINGS',
  'AUDIT',
  'OUTBOX',
  'OUTBOX_DELIVERY',
] as const);

export type AuthorityRepositoryCollection =
  (typeof AUTHORITY_REPOSITORY_COLLECTIONS)[number];

export interface AuthorityRepositoryDocumentV1<T> {
  readonly documentId: string;
  readonly value: T;
}

export interface AuthorityLegacyTenantSourceRecordV1 {
  readonly schemaVersion: typeof AUTHORITY_LEGACY_SOURCE_RECORD_VERSION;
  readonly sourceReference: string;
  readonly recordVersion: number;
  readonly sourceRecordVersion: string;
  readonly sourceRecordFingerprint: string;
  readonly classifiedVariant: LegacyTenantVariantV1;
  readonly authorityUse: 'PROHIBITED';
}

export interface AuthorityRepositorySnapshotV1 {
  readonly schemaVersion: typeof AUTHORITY_REPOSITORY_SNAPSHOT_VERSION;
  readonly tenants: readonly AuthorityRepositoryDocumentV1<PersistedTenantAuthorityRecordV1>[];
  readonly memberships: readonly AuthorityRepositoryDocumentV1<PersistedTenantMembershipRecordV1>[];
  readonly aliases: readonly AuthorityRepositoryDocumentV1<PersistedTenantAliasRecordV1>[];
  readonly legacyTenantSources: readonly AuthorityRepositoryDocumentV1<AuthorityLegacyTenantSourceRecordV1>[];
  readonly idempotencyRecords: readonly AuthorityRepositoryDocumentV1<AuthorityIdempotencyRecordV1>[];
  readonly operationBindings: readonly AuthorityRepositoryDocumentV1<AuthorityOperationBindingRecordV1>[];
  readonly auditEvents: readonly AuthorityRepositoryDocumentV1<AuthorityAuditEventV1>[];
  readonly outboxEvents: readonly AuthorityRepositoryDocumentV1<AuthorityOutboxEventV1>[];
  readonly outboxDeliveryRecords: readonly AuthorityRepositoryDocumentV1<AuthorityOutboxDeliveryRecordV1>[];
}

export const AUTHORITY_MUTATION_PLAN_STATUSES = Object.freeze([
  'APPLY',
  'REPLAY',
  'REJECT',
  'CONFLICT',
  'NOT_FOUND',
  'NO_OP',
] as const);

export type AuthorityMutationPlanStatus =
  (typeof AUTHORITY_MUTATION_PLAN_STATUSES)[number];

export const AUTHORITY_MUTATION_READ_EXPECTATIONS = Object.freeze([
  'MUST_NOT_EXIST',
  'MUST_EXIST',
  'MUST_EXIST_AT_VERSION',
  'MUST_MATCH_AUTHORITY_VERSION',
  'MUST_MATCH_SOURCE',
] as const);

export type AuthorityMutationExpectedReadV1 =
  | Readonly<{
      collection: AuthorityRepositoryCollection;
      documentId: string;
      expectation: 'MUST_NOT_EXIST' | 'MUST_EXIST';
    }>
  | Readonly<{
      collection: 'TENANTS' | 'MEMBERSHIPS' | 'ALIASES';
      documentId: string;
      expectation:
        | 'MUST_EXIST_AT_VERSION'
        | 'MUST_MATCH_AUTHORITY_VERSION';
      expectedVersion: number;
    }>
  | Readonly<{
      collection: 'LEGACY_TENANT_SOURCES';
      documentId: string;
      expectation: 'MUST_MATCH_SOURCE';
      expectedRecordVersion: number;
      expectedSourceRecordVersion: string;
      expectedSourceRecordFingerprint: string;
    }>;

export type AuthorityMutationResourceWriteV1 =
  | Readonly<{
      collection: 'TENANTS';
      documentId: string;
      writeType: 'CREATE' | 'REPLACE';
      value: PersistedTenantAuthorityRecordV1;
    }>
  | Readonly<{
      collection: 'MEMBERSHIPS';
      documentId: string;
      writeType: 'CREATE' | 'REPLACE';
      value: PersistedTenantMembershipRecordV1;
    }>
  | Readonly<{
      collection: 'ALIASES';
      documentId: string;
      writeType: 'CREATE' | 'REPLACE';
      value: PersistedTenantAliasRecordV1;
    }>;

export interface AuthorityResultingVersionV1 {
  readonly collection: 'TENANTS' | 'MEMBERSHIPS' | 'ALIASES';
  readonly documentId: string;
  readonly beforeVersion?: number;
  readonly afterVersion: number;
}

export interface AuthorityMutationPlanV1 {
  readonly schemaVersion: typeof AUTHORITY_MUTATION_PLAN_VERSION;
  readonly operationId: string;
  readonly correlationId: string;
  readonly operationType: AuthorityOperationType;
  readonly planStatus: AuthorityMutationPlanStatus;
  readonly repositoryResult: AuthorityRepositoryResultV1;
  readonly expectedReads: readonly AuthorityMutationExpectedReadV1[];
  readonly resourceWrites: readonly AuthorityMutationResourceWriteV1[];
  readonly idempotencyWrite?: AuthorityRepositoryDocumentV1<AuthorityIdempotencyRecordV1>;
  readonly operationBindingWrite?: AuthorityRepositoryDocumentV1<AuthorityOperationBindingRecordV1>;
  readonly auditEvents: readonly AuthorityRepositoryDocumentV1<AuthorityAuditEventV1>[];
  readonly outboxEvents: readonly AuthorityRepositoryDocumentV1<AuthorityOutboxEventV1>[];
  readonly outboxDeliveryRecords: readonly AuthorityRepositoryDocumentV1<AuthorityOutboxDeliveryRecordV1>[];
  readonly resultingVersions: readonly AuthorityResultingVersionV1[];
  readonly generatedAt: string;
}

export interface AuthorityMutationPlannerInputV1 {
  readonly command: AuthorityAdministrativeCommandV1;
  readonly snapshot: AuthorityRepositorySnapshotV1;
}
