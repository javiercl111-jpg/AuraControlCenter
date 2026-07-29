import {
  createAuthorityIdempotencyRecordV1,
  createAuthorityMigrationMetadataV1,
  createAuthorityOperationBindingRecordV1,
  createAuthorityOutboxDeliveryRecordV1,
  createAuthorityOutboxEventV1,
  createAuthorityRepositoryResultV1,
  createPersistedTenantAliasRecordV1,
  createPersistedTenantAuthorityRecordV1,
  createPersistedTenantMembershipRecordV1,
} from './factories';
import {
  createAuthorityCommandFingerprintV1,
  createAuthorityRepositoryResultFingerprintV1,
  replayAuthorityRepositoryResultV1,
} from './fingerprints';
import {
  createAuthorityAuditEventIdV1,
  createAuthorityIdempotencyDocumentIdV1,
  createAuthorityMembershipKeyV1,
  createAuthorityOperationBindingDocumentIdV1,
  createAuthorityOutboxEventIdV1,
} from './ids';
import {
  createAuthorityMutationPlanV1,
} from './mutationPlan';
import type {
  AuthorityMutationExpectedReadV1,
  AuthorityMutationPlanStatus,
  AuthorityMutationPlanV1,
  AuthorityMutationResourceWriteV1,
  AuthorityRepositoryDocumentV1,
  AuthorityRepositorySnapshotV1,
  AuthorityResultingVersionV1,
} from './runtimeTypes';
import { validateAuthorityRepositorySnapshotV1 } from './snapshot';
import {
  getTenantAuthorityTransitionEventTypeV1,
  getTenantMembershipTransitionEventTypeV1,
} from './transitions';
import {
  AUTHORITY_AUDIT_EVENT_VERSION,
  AUTHORITY_IDEMPOTENCY_RECORD_VERSION,
  AUTHORITY_OPERATION_BINDING_RECORD_VERSION,
  AUTHORITY_OUTBOX_DELIVERY_RECORD_VERSION,
  AUTHORITY_OUTBOX_EVENT_VERSION,
  AUTHORITY_REPOSITORY_RESULT_VERSION,
  AUTHORITY_TENANT_ROLE_VOCABULARY_VERSION,
  TENANT_ALIAS_RECORD_VERSION,
  TENANT_AUTHORITY_RECORD_VERSION,
  TENANT_MEMBERSHIP_RECORD_VERSION,
  type AuthorityAdministrativeCommandV1,
  type AuthorityAuditEventV1,
  type AuthorityEventPayloadSummaryV1,
  type AuthorityEventType,
  type AuthorityIdempotencyRecordV1,
  type AuthorityOperationBindingRecordV1,
  type AuthorityOutboxDeliveryRecordV1,
  type AuthorityOutboxEventV1,
  type AuthorityRepositoryInvocationContextV1,
  type AuthorityRepositoryResultStatus,
  type AuthorityRepositoryResultV1,
  type AuthorityResourceType,
  type PersistedTenantAuthorityRecordV1,
  type PersistedTenantMembershipRecordV1,
} from './types';
import {
  validateAuthorityAdministrativeCommandV1,
  validateAuthorityAuditEventV1,
  validateAuthorityClockOutputV1,
  validateAuthorityRepositoryInvocationContextV1,
} from './validators';

interface MutationEventSpec {
  readonly eventType: AuthorityEventType;
  readonly resourceType: AuthorityResourceType;
  readonly resourceId: string;
  readonly beforeVersion?: number;
  readonly afterVersion?: number;
  readonly payloadSummary: AuthorityEventPayloadSummaryV1;
}

interface PlannedMutation {
  readonly status: 'APPLIED' | 'NO_OP' | 'REJECTED' | 'CONFLICT' | 'NOT_FOUND';
  readonly safeCode: string;
  readonly resourceReference?: string;
  readonly resultingVersion?: number;
  readonly expectedReads: readonly AuthorityMutationExpectedReadV1[];
  readonly resourceWrites?: readonly AuthorityMutationResourceWriteV1[];
  readonly events?: readonly MutationEventSpec[];
  readonly resultingVersions?: readonly AuthorityResultingVersionV1[];
}

function findDocument<T>(
  documents: readonly AuthorityRepositoryDocumentV1<T>[],
  documentId: string,
): AuthorityRepositoryDocumentV1<T> | undefined {
  return documents.find((entry) => entry.documentId === documentId);
}

function resourceReference(
  collection: 'TENANTS' | 'MEMBERSHIPS' | 'ALIASES',
  documentId: string,
): string {
  if (collection === 'TENANTS') {
    return `platform_tenants/${documentId}`;
  }
  if (collection === 'MEMBERSHIPS') {
    return `tenant_memberships/${documentId}`;
  }
  return `tenant_aliases/${documentId}`;
}

function createResult(
  command: AuthorityAdministrativeCommandV1,
  status: AuthorityRepositoryResultStatus,
  safeCode: string,
  occurredAt: string,
  resultingVersion?: number,
  reference?: string,
): AuthorityRepositoryResultV1 {
  return createAuthorityRepositoryResultV1({
    schemaVersion: AUTHORITY_REPOSITORY_RESULT_VERSION,
    operationId: command.operationId,
    correlationId: command.correlationId,
    status,
    safeCode,
    completedAt: occurredAt,
    retryDisposition:
      status === 'CONFLICT'
        ? 'RETRY_AFTER_READ'
        : status === 'INTERNAL_ERROR'
          ? 'SAFE_TO_RETRY_WITH_SAME_IDEMPOTENCY_KEY'
          : 'DO_NOT_RETRY',
    ...(resultingVersion === undefined
      ? {}
      : { resultingVersion, resourceReference: reference }),
  });
}

function ledgerReads(
  command: AuthorityAdministrativeCommandV1,
): readonly AuthorityMutationExpectedReadV1[] {
  return Object.freeze([
    Object.freeze({
      collection: 'IDEMPOTENCY' as const,
      documentId: createAuthorityIdempotencyDocumentIdV1(
        command.idempotencyKey,
      ),
      expectation: 'MUST_NOT_EXIST' as const,
    }),
    Object.freeze({
      collection: 'OPERATION_BINDINGS' as const,
      documentId: createAuthorityOperationBindingDocumentIdV1(
        command.operationId,
      ),
      expectation: 'MUST_NOT_EXIST' as const,
    }),
  ]);
}

function expectedResourceRead(
  collection: 'TENANTS' | 'MEMBERSHIPS' | 'ALIASES',
  documentId: string,
  command: AuthorityAdministrativeCommandV1,
): AuthorityMutationExpectedReadV1 {
  if (command.precondition.type === 'MUST_NOT_EXIST') {
    return Object.freeze({
      collection,
      documentId,
      expectation: 'MUST_NOT_EXIST',
    });
  }
  if (command.precondition.type === 'MUST_EXIST_AT_VERSION') {
    return Object.freeze({
      collection,
      documentId,
      expectation: 'MUST_EXIST_AT_VERSION',
      expectedVersion: command.precondition.recordVersion,
    });
  }
  return Object.freeze({
    collection,
    documentId,
    expectation: 'MUST_MATCH_AUTHORITY_VERSION',
    expectedVersion: command.precondition.authorityVersion,
  });
}

function versionMatches(
  command: AuthorityAdministrativeCommandV1,
  recordVersion: number,
  authorityVersion: number,
): boolean {
  if (command.precondition.type === 'MUST_NOT_EXIST') {
    return false;
  }
  return command.precondition.type === 'MUST_EXIST_AT_VERSION'
    ? command.precondition.recordVersion === recordVersion
    : command.precondition.authorityVersion === authorityVersion;
}

function eventDocuments(
  command: AuthorityAdministrativeCommandV1,
  events: readonly MutationEventSpec[],
  occurredAt: string,
): Readonly<{
  auditEvents: readonly AuthorityRepositoryDocumentV1<AuthorityAuditEventV1>[];
  outboxEvents: readonly AuthorityRepositoryDocumentV1<AuthorityOutboxEventV1>[];
  outboxDeliveryRecords: readonly AuthorityRepositoryDocumentV1<AuthorityOutboxDeliveryRecordV1>[];
}> {
  const auditEvents = events.map((event) => {
    const eventId = createAuthorityAuditEventIdV1({
      operationId: command.operationId,
      eventType: event.eventType,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
    });
    const value = validateAuthorityAuditEventV1({
      schemaVersion: AUTHORITY_AUDIT_EVENT_VERSION,
      eventId,
      eventType: event.eventType,
      operationId: command.operationId,
      correlationId: command.correlationId,
      actor: command.actor,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
      reasonCode: command.reasonCode,
      ...(event.beforeVersion === undefined
        ? {}
        : { beforeVersion: event.beforeVersion }),
      ...(event.afterVersion === undefined
        ? {}
        : { afterVersion: event.afterVersion }),
      occurredAt,
      payloadSummary: event.payloadSummary,
    });
    return Object.freeze({ documentId: eventId, value });
  });
  const outboxEvents = events.map((event) => {
    const eventId = createAuthorityOutboxEventIdV1({
      operationId: command.operationId,
      eventType: event.eventType,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
    });
    const value = createAuthorityOutboxEventV1({
      schemaVersion: AUTHORITY_OUTBOX_EVENT_VERSION,
      eventId,
      eventType: event.eventType,
      operationId: command.operationId,
      correlationId: command.correlationId,
      actor: command.actor,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
      reasonCode: command.reasonCode,
      ...(event.beforeVersion === undefined
        ? {}
        : { beforeVersion: event.beforeVersion }),
      ...(event.afterVersion === undefined
        ? {}
        : { afterVersion: event.afterVersion }),
      occurredAt,
      payloadSummary: event.payloadSummary,
    });
    return Object.freeze({ documentId: eventId, value });
  });
  const outboxDeliveryRecords = outboxEvents.map((event) => {
    const value = createAuthorityOutboxDeliveryRecordV1({
      schemaVersion: AUTHORITY_OUTBOX_DELIVERY_RECORD_VERSION,
      eventId: event.documentId,
      deliveryStatus: 'PENDING',
      attemptCount: 0,
      availableAt: occurredAt,
      version: 1,
    });
    return Object.freeze({ documentId: event.documentId, value });
  });
  return Object.freeze({
    auditEvents: Object.freeze(auditEvents),
    outboxEvents: Object.freeze(outboxEvents),
    outboxDeliveryRecords: Object.freeze(outboxDeliveryRecords),
  });
}

function terminalLedger(
  command: AuthorityAdministrativeCommandV1,
  result: AuthorityRepositoryResultV1,
  requestFingerprint: string,
  occurredAt: string,
): Readonly<{
  idempotencyWrite: AuthorityRepositoryDocumentV1<AuthorityIdempotencyRecordV1>;
  operationBindingWrite: AuthorityRepositoryDocumentV1<AuthorityOperationBindingRecordV1>;
}> {
  const terminalStatus =
    result.status === 'REJECTED' ? 'REJECTED' : 'COMPLETED';
  const idempotencyValue = createAuthorityIdempotencyRecordV1({
    schemaVersion: AUTHORITY_IDEMPOTENCY_RECORD_VERSION,
    idempotencyKey: command.idempotencyKey,
    operationId: command.operationId,
    operationType: command.operationType,
    requestFingerprint,
    status: terminalStatus,
    startedAt: occurredAt,
    completedAt: occurredAt,
    exactRepositoryResult: result,
    resultFingerprint:
      createAuthorityRepositoryResultFingerprintV1(result),
    ...(terminalStatus === 'REJECTED'
      ? { failureCode: result.safeCode }
      : {}),
    version: 1,
  });
  const idempotencyDocumentId =
    createAuthorityIdempotencyDocumentIdV1(command.idempotencyKey);
  const bindingValue = createAuthorityOperationBindingRecordV1({
    schemaVersion: AUTHORITY_OPERATION_BINDING_RECORD_VERSION,
    operationId: command.operationId,
    idempotencyKey: command.idempotencyKey,
    operationType: command.operationType,
    requestFingerprint,
    status: terminalStatus,
    repositoryResultReference:
      `authority_idempotency/${idempotencyDocumentId}`,
    createdAt: occurredAt,
    completedAt: occurredAt,
    version: 1,
  });
  return Object.freeze({
    idempotencyWrite: Object.freeze({
      documentId: idempotencyDocumentId,
      value: idempotencyValue,
    }),
    operationBindingWrite: Object.freeze({
      documentId: createAuthorityOperationBindingDocumentIdV1(
        command.operationId,
      ),
      value: bindingValue,
    }),
  });
}

function planStatusForResult(
  status: PlannedMutation['status'],
): AuthorityMutationPlanStatus {
  if (status === 'APPLIED') {
    return 'APPLY';
  }
  if (status === 'NO_OP') {
    return 'NO_OP';
  }
  if (status === 'REJECTED') {
    return 'REJECT';
  }
  return status;
}

function buildPlan(
  command: AuthorityAdministrativeCommandV1,
  mutation: PlannedMutation,
  requestFingerprint: string,
  occurredAt: string,
  persistTerminalResult = true,
): AuthorityMutationPlanV1 {
  const result = createResult(
    command,
    mutation.status,
    mutation.safeCode,
    occurredAt,
    mutation.resultingVersion,
    mutation.resourceReference,
  );
  const events = eventDocuments(
    command,
    mutation.events ?? [],
    occurredAt,
  );
  const shouldPersist =
    persistTerminalResult &&
    (result.status === 'APPLIED' ||
      result.status === 'NO_OP' ||
      result.status === 'REJECTED');
  const ledger = shouldPersist
    ? terminalLedger(command, result, requestFingerprint, occurredAt)
    : undefined;
  return createAuthorityMutationPlanV1({
    schemaVersion: '1',
    operationId: command.operationId,
    correlationId: command.correlationId,
    operationType: command.operationType,
    planStatus: planStatusForResult(mutation.status),
    repositoryResult: result,
    expectedReads: mutation.expectedReads,
    resourceWrites: mutation.resourceWrites ?? [],
    ...(ledger === undefined ? {} : ledger),
    auditEvents: events.auditEvents,
    outboxEvents: events.outboxEvents,
    outboxDeliveryRecords: events.outboxDeliveryRecords,
    resultingVersions: mutation.resultingVersions ?? [],
    generatedAt: occurredAt,
  });
}

function buildReplayPlan(
  command: AuthorityAdministrativeCommandV1,
  result: AuthorityRepositoryResultV1,
): AuthorityMutationPlanV1 {
  return createAuthorityMutationPlanV1({
    schemaVersion: '1',
    operationId: command.operationId,
    correlationId: command.correlationId,
    operationType: command.operationType,
    planStatus: 'REPLAY',
    repositoryResult: replayAuthorityRepositoryResultV1(result),
    expectedReads: [
      {
        collection: 'IDEMPOTENCY',
        documentId: createAuthorityIdempotencyDocumentIdV1(
          command.idempotencyKey,
        ),
        expectation: 'MUST_EXIST',
      },
      {
        collection: 'OPERATION_BINDINGS',
        documentId: createAuthorityOperationBindingDocumentIdV1(
          command.operationId,
        ),
        expectation: 'MUST_EXIST',
      },
    ],
    resourceWrites: [],
    auditEvents: [],
    outboxEvents: [],
    outboxDeliveryRecords: [],
    resultingVersions: [],
    generatedAt: result.completedAt,
  });
}

function idempotencyPlan(
  command: AuthorityAdministrativeCommandV1,
  snapshot: AuthorityRepositorySnapshotV1,
  requestFingerprint: string,
  occurredAt: string,
): AuthorityMutationPlanV1 | undefined {
  const idempotency = findDocument(
    snapshot.idempotencyRecords,
    createAuthorityIdempotencyDocumentIdV1(command.idempotencyKey),
  );
  const binding = findDocument(
    snapshot.operationBindings,
    createAuthorityOperationBindingDocumentIdV1(command.operationId),
  );
  if (idempotency !== undefined) {
    const matches =
      idempotency.value.idempotencyKey === command.idempotencyKey &&
      idempotency.value.operationId === command.operationId &&
      idempotency.value.operationType === command.operationType &&
      idempotency.value.requestFingerprint === requestFingerprint;
    if (!matches) {
      return buildPlan(
        command,
        {
          status: 'CONFLICT',
          safeCode: 'IDEMPOTENCY_KEY_CONFLICT',
          expectedReads: [],
        },
        requestFingerprint,
        occurredAt,
        false,
      );
    }
    if (binding === undefined) {
      return buildPlan(
        command,
        {
          status: 'CONFLICT',
          safeCode: 'IDEMPOTENCY_STATE_CONFLICT',
          expectedReads: [],
        },
        requestFingerprint,
        occurredAt,
        false,
      );
    }
    const bindingMatches =
      binding.value.idempotencyKey === command.idempotencyKey &&
      binding.value.operationType === command.operationType &&
      binding.value.requestFingerprint === requestFingerprint;
    if (!bindingMatches) {
      return buildPlan(
        command,
        {
          status: 'CONFLICT',
          safeCode: 'OPERATION_ID_CONFLICT',
          expectedReads: [],
        },
        requestFingerprint,
        occurredAt,
        false,
      );
    }
    if (
      idempotency.value.status === 'COMPLETED' ||
      idempotency.value.status === 'REJECTED'
    ) {
      const expectedBindingStatus =
        idempotency.value.status === 'COMPLETED'
          ? 'COMPLETED'
          : 'REJECTED';
      if (binding.value.status !== expectedBindingStatus) {
        return buildPlan(
          command,
          {
            status: 'CONFLICT',
            safeCode: 'IDEMPOTENCY_STATE_CONFLICT',
            expectedReads: [],
          },
          requestFingerprint,
          occurredAt,
          false,
        );
      }
      return buildReplayPlan(
        command,
        idempotency.value.exactRepositoryResult,
      );
    }
    return buildPlan(
      command,
      {
        status: 'CONFLICT',
        safeCode: 'IDEMPOTENCY_IN_PROGRESS',
        expectedReads: [],
      },
      requestFingerprint,
      occurredAt,
      false,
    );
  }
  if (binding !== undefined) {
    return buildPlan(
      command,
      {
        status: 'CONFLICT',
        safeCode: 'OPERATION_ID_CONFLICT',
        expectedReads: [],
      },
      requestFingerprint,
      occurredAt,
      false,
    );
  }
  return undefined;
}

function planCreateTenant(
  command: Extract<
    AuthorityAdministrativeCommandV1,
    { readonly operationType: 'CREATE_TENANT_AUTHORITY' }
  >,
  snapshot: AuthorityRepositorySnapshotV1,
  occurredAt: string,
): PlannedMutation {
  const tenantId = command.payload.tenantId;
  const reference = resourceReference('TENANTS', tenantId);
  const reads = Object.freeze([
    ...ledgerReads(command),
    expectedResourceRead('TENANTS', tenantId, command),
  ]);
  if (findDocument(snapshot.tenants, tenantId) !== undefined) {
    return {
      status: 'CONFLICT',
      safeCode: 'TENANT_ALREADY_EXISTS',
      expectedReads: reads,
    };
  }
  const value = createPersistedTenantAuthorityRecordV1(
    {
      schemaVersion: TENANT_AUTHORITY_RECORD_VERSION,
      tenantId,
      status: 'PENDING',
      authorityVersion: 1,
      recordVersion: 1,
      createdAt: occurredAt,
      updatedAt: occurredAt,
      createdBy: command.actor,
      updatedBy: command.actor,
      statusChangedAt: occurredAt,
      statusReasonCode: command.reasonCode,
      ...(command.payload.tenantSlug === undefined
        ? {}
        : { tenantSlug: command.payload.tenantSlug }),
      ...(command.payload.organizationReference === undefined
        ? {}
        : {
            organizationReference:
              command.payload.organizationReference,
          }),
      ...(command.payload.clientReference === undefined
        ? {}
        : { clientReference: command.payload.clientReference }),
    },
    tenantId,
  );
  return {
    status: 'APPLIED',
    safeCode: 'TENANT_CREATED',
    resourceReference: reference,
    resultingVersion: 1,
    expectedReads: reads,
    resourceWrites: [
      {
        collection: 'TENANTS',
        documentId: tenantId,
        writeType: 'CREATE',
        value,
      },
    ],
    events: [
      {
        eventType: 'TENANT_CREATED',
        resourceType: 'TENANT',
        resourceId: reference,
        afterVersion: 1,
        payloadSummary: { tenantStatusTo: 'PENDING' },
      },
    ],
    resultingVersions: [
      { collection: 'TENANTS', documentId: tenantId, afterVersion: 1 },
    ],
  };
}

function activationPrerequisiteSatisfied(
  command: Extract<
    AuthorityAdministrativeCommandV1,
    { readonly operationType: 'UPDATE_TENANT_STATUS' }
  >,
  snapshot: AuthorityRepositorySnapshotV1,
  tenant: PersistedTenantAuthorityRecordV1,
): boolean {
  const prerequisite = command.payload.activationPrerequisite;
  if (command.payload.targetStatus !== 'ACTIVE' || prerequisite === undefined) {
    return command.payload.targetStatus !== 'ACTIVE';
  }
  const membership = findDocument(
    snapshot.memberships,
    prerequisite.membershipKey,
  )?.value;
  return (
    prerequisite.tenantId === tenant.tenantId &&
    prerequisite.tenantCurrentStatus === tenant.status &&
    prerequisite.tenantExpectedRecordVersion === tenant.recordVersion &&
    membership !== undefined &&
    membership.membershipKey === prerequisite.membershipKey &&
    membership.principalType === prerequisite.membershipPrincipalType &&
    membership.principalId === prerequisite.membershipPrincipalId &&
    membership.tenantId === prerequisite.membershipTenantId &&
    membership.status === prerequisite.membershipStatus &&
    membership.membershipVersion ===
      prerequisite.membershipExpectedVersion &&
    membership.roles.length === prerequisite.membershipRoles.length &&
    membership.roles.every(
      (role, index) => role === prerequisite.membershipRoles[index],
    ) &&
    membership.roles.includes('TENANT_ADMIN')
  );
}

function planUpdateTenantStatus(
  command: Extract<
    AuthorityAdministrativeCommandV1,
    { readonly operationType: 'UPDATE_TENANT_STATUS' }
  >,
  snapshot: AuthorityRepositorySnapshotV1,
  occurredAt: string,
): PlannedMutation {
  const tenantId = command.payload.tenantId;
  const read = expectedResourceRead('TENANTS', tenantId, command);
  const reads: AuthorityMutationExpectedReadV1[] = [
    ...ledgerReads(command),
    read,
  ];
  const tenant = findDocument(snapshot.tenants, tenantId)?.value;
  if (tenant === undefined) {
    return {
      status: 'NOT_FOUND',
      safeCode: 'TENANT_NOT_FOUND',
      expectedReads: reads,
    };
  }
  if (
    !versionMatches(command, tenant.recordVersion, tenant.authorityVersion)
  ) {
    return {
      status: 'CONFLICT',
      safeCode: 'STALE_TENANT_VERSION',
      expectedReads: reads,
    };
  }
  if (tenant.status !== command.payload.currentStatus) {
    return {
      status: 'CONFLICT',
      safeCode: 'TENANT_STATUS_MISMATCH',
      expectedReads: reads,
    };
  }
  const prerequisite = command.payload.activationPrerequisite;
  if (prerequisite !== undefined) {
    const prerequisiteMembership = findDocument(
      snapshot.memberships,
      prerequisite.membershipKey,
    )?.value;
    reads.push(
      prerequisiteMembership === undefined
        ? {
            collection: 'MEMBERSHIPS',
            documentId: prerequisite.membershipKey,
            expectation: 'MUST_NOT_EXIST',
          }
        : {
            collection: 'MEMBERSHIPS',
            documentId: prerequisite.membershipKey,
            expectation: 'MUST_EXIST_AT_VERSION',
            expectedVersion:
              prerequisiteMembership.membershipVersion,
          },
    );
  }
  if (!activationPrerequisiteSatisfied(command, snapshot, tenant)) {
    return {
      status: 'REJECTED',
      safeCode: 'TENANT_ACTIVATION_PREREQUISITE_NOT_MET',
      expectedReads: reads,
    };
  }
  const afterVersion = tenant.authorityVersion + 1;
  const value = createPersistedTenantAuthorityRecordV1(
    {
      ...tenant,
      status: command.payload.targetStatus,
      authorityVersion: afterVersion,
      recordVersion: tenant.recordVersion + 1,
      updatedAt: occurredAt,
      updatedBy: command.actor,
      statusChangedAt: occurredAt,
      statusReasonCode: command.reasonCode,
    },
    tenantId,
  );
  const reference = resourceReference('TENANTS', tenantId);
  return {
    status: 'APPLIED',
    safeCode: 'TENANT_STATUS_UPDATED',
    resourceReference: reference,
    resultingVersion: afterVersion,
    expectedReads: reads,
    resourceWrites: [
      {
        collection: 'TENANTS',
        documentId: tenantId,
        writeType: 'REPLACE',
        value,
      },
    ],
    events: [
      {
        eventType: getTenantAuthorityTransitionEventTypeV1(
          tenant.status,
          command.payload.targetStatus,
        ),
        resourceType: 'TENANT',
        resourceId: reference,
        beforeVersion: tenant.authorityVersion,
        afterVersion,
        payloadSummary: {
          tenantStatusFrom: tenant.status,
          tenantStatusTo: command.payload.targetStatus,
        },
      },
    ],
    resultingVersions: [
      {
        collection: 'TENANTS',
        documentId: tenantId,
        beforeVersion: tenant.authorityVersion,
        afterVersion,
      },
    ],
  };
}

function tenantAllowsChildMutation(
  snapshot: AuthorityRepositorySnapshotV1,
  tenantId: string,
): 'MISSING' | 'DELETED' | 'ALLOWED' {
  const tenant = findDocument(snapshot.tenants, tenantId)?.value;
  if (tenant === undefined) {
    return 'MISSING';
  }
  return tenant.status === 'DELETED' ? 'DELETED' : 'ALLOWED';
}

function planCreateMembership(
  command: Extract<
    AuthorityAdministrativeCommandV1,
    { readonly operationType: 'CREATE_TENANT_MEMBERSHIP' }
  >,
  snapshot: AuthorityRepositorySnapshotV1,
  occurredAt: string,
): PlannedMutation {
  const membershipKey = createAuthorityMembershipKeyV1({
    principalType: command.payload.principalType,
    principalId: command.payload.principalId,
    tenantId: command.payload.tenantId,
  });
  const reads = Object.freeze([
    ...ledgerReads(command),
    {
      collection: 'TENANTS' as const,
      documentId: command.payload.tenantId,
      expectation: 'MUST_EXIST' as const,
    },
    expectedResourceRead('MEMBERSHIPS', membershipKey, command),
  ]);
  const tenantState = tenantAllowsChildMutation(
    snapshot,
    command.payload.tenantId,
  );
  if (tenantState === 'MISSING') {
    return {
      status: 'NOT_FOUND',
      safeCode: 'TENANT_NOT_FOUND',
      expectedReads: reads,
    };
  }
  if (tenantState === 'DELETED') {
    return {
      status: 'REJECTED',
      safeCode: 'TENANT_DELETED',
      expectedReads: reads,
    };
  }
  if (findDocument(snapshot.memberships, membershipKey) !== undefined) {
    return {
      status: 'CONFLICT',
      safeCode: 'MEMBERSHIP_ALREADY_EXISTS',
      expectedReads: reads,
    };
  }
  const value = createPersistedTenantMembershipRecordV1(
    {
      schemaVersion: TENANT_MEMBERSHIP_RECORD_VERSION,
      membershipId: membershipKey,
      membershipKey,
      principalType: command.payload.principalType,
      principalId: command.payload.principalId,
      tenantId: command.payload.tenantId,
      roles: command.payload.roles,
      roleVocabularyVersion: AUTHORITY_TENANT_ROLE_VOCABULARY_VERSION,
      status: 'ACTIVE',
      membershipVersion: 1,
      authorityVersion: 1,
      createdAt: occurredAt,
      updatedAt: occurredAt,
      createdBy: command.actor,
      updatedBy: command.actor,
    },
    membershipKey,
  );
  const reference = resourceReference('MEMBERSHIPS', membershipKey);
  return {
    status: 'APPLIED',
    safeCode: 'MEMBERSHIP_CREATED',
    resourceReference: reference,
    resultingVersion: 1,
    expectedReads: reads,
    resourceWrites: [
      {
        collection: 'MEMBERSHIPS',
        documentId: membershipKey,
        writeType: 'CREATE',
        value,
      },
    ],
    events: [
      {
        eventType: 'MEMBERSHIP_CREATED',
        resourceType: 'MEMBERSHIP',
        resourceId: reference,
        afterVersion: 1,
        payloadSummary: {
          membershipStatusTo: 'ACTIVE',
          resultingRoleCount: command.payload.roles.length,
        },
      },
    ],
    resultingVersions: [
      {
        collection: 'MEMBERSHIPS',
        documentId: membershipKey,
        afterVersion: 1,
      },
    ],
  };
}

function membershipReads(
  command:
    | Extract<
        AuthorityAdministrativeCommandV1,
        { readonly operationType: 'UPDATE_TENANT_MEMBERSHIP_ROLES' }
      >
    | Extract<
        AuthorityAdministrativeCommandV1,
        { readonly operationType: 'CHANGE_TENANT_MEMBERSHIP_STATUS' }
      >,
): readonly AuthorityMutationExpectedReadV1[] {
  return Object.freeze([
    ...ledgerReads(command),
    {
      collection: 'TENANTS',
      documentId: command.payload.tenantId,
      expectation: 'MUST_EXIST',
    },
    expectedResourceRead(
      'MEMBERSHIPS',
      command.payload.membershipKey,
      command,
    ),
  ]);
}

function findEligibleMembership(
  command:
    | Extract<
        AuthorityAdministrativeCommandV1,
        { readonly operationType: 'UPDATE_TENANT_MEMBERSHIP_ROLES' }
      >
    | Extract<
        AuthorityAdministrativeCommandV1,
        { readonly operationType: 'CHANGE_TENANT_MEMBERSHIP_STATUS' }
      >,
  snapshot: AuthorityRepositorySnapshotV1,
): Readonly<{
  state:
    | 'READY'
    | 'TENANT_MISSING'
    | 'TENANT_DELETED'
    | 'MEMBERSHIP_MISSING'
    | 'STALE'
    | 'IDENTITY_MISMATCH';
  membership?: PersistedTenantMembershipRecordV1;
}> {
  const tenantState = tenantAllowsChildMutation(
    snapshot,
    command.payload.tenantId,
  );
  if (tenantState === 'MISSING') {
    return { state: 'TENANT_MISSING' };
  }
  if (tenantState === 'DELETED') {
    return { state: 'TENANT_DELETED' };
  }
  const membership = findDocument(
    snapshot.memberships,
    command.payload.membershipKey,
  )?.value;
  if (membership === undefined) {
    return { state: 'MEMBERSHIP_MISSING' };
  }
  if (
    membership.principalType !== command.payload.principalType ||
    membership.principalId !== command.payload.principalId ||
    membership.tenantId !== command.payload.tenantId
  ) {
    return { state: 'IDENTITY_MISMATCH' };
  }
  if (
    !versionMatches(
      command,
      membership.membershipVersion,
      membership.authorityVersion,
    )
  ) {
    return { state: 'STALE' };
  }
  return { state: 'READY', membership };
}

function failedMembershipLookup(
  state: ReturnType<typeof findEligibleMembership>['state'],
  reads: readonly AuthorityMutationExpectedReadV1[],
): PlannedMutation | undefined {
  if (state === 'READY') {
    return undefined;
  }
  if (state === 'TENANT_MISSING') {
    return {
      status: 'NOT_FOUND',
      safeCode: 'TENANT_NOT_FOUND',
      expectedReads: reads,
    };
  }
  if (state === 'MEMBERSHIP_MISSING') {
    return {
      status: 'NOT_FOUND',
      safeCode: 'MEMBERSHIP_NOT_FOUND',
      expectedReads: reads,
    };
  }
  if (state === 'TENANT_DELETED') {
    return {
      status: 'REJECTED',
      safeCode: 'TENANT_DELETED',
      expectedReads: reads,
    };
  }
  return {
    status: 'CONFLICT',
    safeCode:
      state === 'STALE'
        ? 'STALE_MEMBERSHIP_VERSION'
        : 'MEMBERSHIP_IDENTITY_MISMATCH',
    expectedReads: reads,
  };
}

function planUpdateMembershipRoles(
  command: Extract<
    AuthorityAdministrativeCommandV1,
    { readonly operationType: 'UPDATE_TENANT_MEMBERSHIP_ROLES' }
  >,
  snapshot: AuthorityRepositorySnapshotV1,
  occurredAt: string,
): PlannedMutation {
  const reads = membershipReads(command);
  const lookup = findEligibleMembership(command, snapshot);
  const failed = failedMembershipLookup(lookup.state, reads);
  if (failed !== undefined) {
    return failed;
  }
  const membership = lookup.membership as PersistedTenantMembershipRecordV1;
  if (membership.status === 'REVOKED' || membership.status === 'DELETED') {
    return {
      status: 'REJECTED',
      safeCode: 'MEMBERSHIP_TERMINAL',
      expectedReads: reads,
    };
  }
  const equalRoles =
    membership.roles.length === command.payload.roles.length &&
    membership.roles.every(
      (role, index) => role === command.payload.roles[index],
    );
  const reference = resourceReference(
    'MEMBERSHIPS',
    membership.membershipKey,
  );
  if (equalRoles) {
    return {
      status: 'NO_OP',
      safeCode: 'MEMBERSHIP_ROLES_UNCHANGED',
      resourceReference: reference,
      resultingVersion: membership.authorityVersion,
      expectedReads: reads,
    };
  }
  const afterVersion = membership.authorityVersion + 1;
  const value = createPersistedTenantMembershipRecordV1(
    {
      ...membership,
      roles: command.payload.roles,
      membershipVersion: membership.membershipVersion + 1,
      authorityVersion: afterVersion,
      updatedAt: occurredAt,
      updatedBy: command.actor,
    },
    membership.membershipKey,
  );
  return {
    status: 'APPLIED',
    safeCode: 'MEMBERSHIP_ROLES_UPDATED',
    resourceReference: reference,
    resultingVersion: afterVersion,
    expectedReads: reads,
    resourceWrites: [
      {
        collection: 'MEMBERSHIPS',
        documentId: membership.membershipKey,
        writeType: 'REPLACE',
        value,
      },
    ],
    events: [
      {
        eventType: 'MEMBERSHIP_ROLES_CHANGED',
        resourceType: 'MEMBERSHIP',
        resourceId: reference,
        beforeVersion: membership.authorityVersion,
        afterVersion,
        payloadSummary: {
          previousRoleCount: membership.roles.length,
          resultingRoleCount: command.payload.roles.length,
        },
      },
    ],
    resultingVersions: [
      {
        collection: 'MEMBERSHIPS',
        documentId: membership.membershipKey,
        beforeVersion: membership.authorityVersion,
        afterVersion,
      },
    ],
  };
}

function planChangeMembershipStatus(
  command: Extract<
    AuthorityAdministrativeCommandV1,
    { readonly operationType: 'CHANGE_TENANT_MEMBERSHIP_STATUS' }
  >,
  snapshot: AuthorityRepositorySnapshotV1,
  occurredAt: string,
): PlannedMutation {
  const reads = membershipReads(command);
  const lookup = findEligibleMembership(command, snapshot);
  const failed = failedMembershipLookup(lookup.state, reads);
  if (failed !== undefined) {
    return failed;
  }
  const membership = lookup.membership as PersistedTenantMembershipRecordV1;
  if (membership.status !== command.payload.currentStatus) {
    return {
      status: 'CONFLICT',
      safeCode: 'MEMBERSHIP_STATUS_MISMATCH',
      expectedReads: reads,
    };
  }
  const afterVersion = membership.authorityVersion + 1;
  const targetStatus = command.payload.targetStatus;
  const revocationFields =
    targetStatus === 'REVOKED'
      ? {
          revokedAt: occurredAt,
          revokedBy: command.actor,
          revocationReasonCode: command.reasonCode,
        }
      : targetStatus === 'DELETED'
        ? {
            ...(membership.revokedAt === undefined
              ? {}
              : { revokedAt: membership.revokedAt }),
            ...(membership.revokedBy === undefined
              ? {}
              : { revokedBy: membership.revokedBy }),
            ...(membership.revocationReasonCode === undefined
              ? {}
              : {
                  revocationReasonCode:
                    membership.revocationReasonCode,
                }),
          }
        : {};
  const value = createPersistedTenantMembershipRecordV1(
    {
      ...membership,
      status: targetStatus,
      membershipVersion: membership.membershipVersion + 1,
      authorityVersion: afterVersion,
      updatedAt: occurredAt,
      updatedBy: command.actor,
      ...revocationFields,
    },
    membership.membershipKey,
  );
  const reference = resourceReference(
    'MEMBERSHIPS',
    membership.membershipKey,
  );
  return {
    status: 'APPLIED',
    safeCode: 'MEMBERSHIP_STATUS_UPDATED',
    resourceReference: reference,
    resultingVersion: afterVersion,
    expectedReads: reads,
    resourceWrites: [
      {
        collection: 'MEMBERSHIPS',
        documentId: membership.membershipKey,
        writeType: 'REPLACE',
        value,
      },
    ],
    events: [
      {
        eventType: getTenantMembershipTransitionEventTypeV1(
          membership.status,
          targetStatus,
        ),
        resourceType: 'MEMBERSHIP',
        resourceId: reference,
        beforeVersion: membership.authorityVersion,
        afterVersion,
        payloadSummary: {
          membershipStatusFrom: membership.status,
          membershipStatusTo: targetStatus,
        },
      },
    ],
    resultingVersions: [
      {
        collection: 'MEMBERSHIPS',
        documentId: membership.membershipKey,
        beforeVersion: membership.authorityVersion,
        afterVersion,
      },
    ],
  };
}

function planReserveAlias(
  command: Extract<
    AuthorityAdministrativeCommandV1,
    { readonly operationType: 'RESERVE_TENANT_ALIAS' }
  >,
  snapshot: AuthorityRepositorySnapshotV1,
  occurredAt: string,
): PlannedMutation {
  const reads = Object.freeze([
    ...ledgerReads(command),
    {
      collection: 'TENANTS' as const,
      documentId: command.payload.tenantId,
      expectation: 'MUST_EXIST' as const,
    },
    expectedResourceRead(
      'ALIASES',
      command.payload.aliasKey,
      command,
    ),
  ]);
  const tenantState = tenantAllowsChildMutation(
    snapshot,
    command.payload.tenantId,
  );
  if (tenantState === 'MISSING') {
    return {
      status: 'NOT_FOUND',
      safeCode: 'TENANT_NOT_FOUND',
      expectedReads: reads,
    };
  }
  if (tenantState === 'DELETED') {
    return {
      status: 'REJECTED',
      safeCode: 'TENANT_DELETED',
      expectedReads: reads,
    };
  }
  if (findDocument(snapshot.aliases, command.payload.aliasKey) !== undefined) {
    return {
      status: 'CONFLICT',
      safeCode: 'ALIAS_COLLISION',
      expectedReads: reads,
    };
  }
  const value = createPersistedTenantAliasRecordV1(
    {
      schemaVersion: TENANT_ALIAS_RECORD_VERSION,
      aliasKey: command.payload.aliasKey,
      aliasType: command.payload.aliasType,
      normalizedAlias: command.payload.normalizedAlias,
      tenantId: command.payload.tenantId,
      status: 'ACTIVE',
      aliasVersion: 1,
      authorityVersion: 1,
      createdAt: occurredAt,
      updatedAt: occurredAt,
      createdBy: command.actor,
      updatedBy: command.actor,
    },
    command.payload.aliasKey,
  );
  const reference = resourceReference(
    'ALIASES',
    command.payload.aliasKey,
  );
  return {
    status: 'APPLIED',
    safeCode: 'ALIAS_RESERVED',
    resourceReference: reference,
    resultingVersion: 1,
    expectedReads: reads,
    resourceWrites: [
      {
        collection: 'ALIASES',
        documentId: command.payload.aliasKey,
        writeType: 'CREATE',
        value,
      },
    ],
    events: [
      {
        eventType: 'ALIAS_RESERVED',
        resourceType: 'ALIAS',
        resourceId: reference,
        afterVersion: 1,
        payloadSummary: {
          aliasType: command.payload.aliasType,
          aliasStatus: 'ACTIVE',
        },
      },
    ],
    resultingVersions: [
      {
        collection: 'ALIASES',
        documentId: command.payload.aliasKey,
        afterVersion: 1,
      },
    ],
  };
}

function planTombstoneAlias(
  command: Extract<
    AuthorityAdministrativeCommandV1,
    { readonly operationType: 'TOMBSTONE_TENANT_ALIAS' }
  >,
  snapshot: AuthorityRepositorySnapshotV1,
  occurredAt: string,
): PlannedMutation {
  const reads = Object.freeze([
    ...ledgerReads(command),
    expectedResourceRead(
      'ALIASES',
      command.payload.aliasKey,
      command,
    ),
  ]);
  const alias = findDocument(
    snapshot.aliases,
    command.payload.aliasKey,
  )?.value;
  if (alias === undefined) {
    return {
      status: 'NOT_FOUND',
      safeCode: 'ALIAS_NOT_FOUND',
      expectedReads: reads,
    };
  }
  if (
    alias.tenantId !== command.payload.tenantId ||
    alias.aliasType !== command.payload.aliasType ||
    alias.normalizedAlias !== command.payload.normalizedAlias
  ) {
    return {
      status: 'CONFLICT',
      safeCode: 'ALIAS_OWNERSHIP_MISMATCH',
      expectedReads: reads,
    };
  }
  if (
    !versionMatches(command, alias.aliasVersion, alias.authorityVersion)
  ) {
    return {
      status: 'CONFLICT',
      safeCode: 'STALE_ALIAS_VERSION',
      expectedReads: reads,
    };
  }
  const reference = resourceReference('ALIASES', alias.aliasKey);
  if (alias.status === 'TOMBSTONED') {
    return {
      status: 'NO_OP',
      safeCode: 'ALIAS_ALREADY_TOMBSTONED',
      resourceReference: reference,
      resultingVersion: alias.authorityVersion,
      expectedReads: reads,
    };
  }
  const afterVersion = alias.authorityVersion + 1;
  const value = createPersistedTenantAliasRecordV1(
    {
      ...alias,
      status: 'TOMBSTONED',
      aliasVersion: alias.aliasVersion + 1,
      authorityVersion: afterVersion,
      updatedAt: occurredAt,
      updatedBy: command.actor,
      tombstonedAt: occurredAt,
      tombstonedBy: command.actor,
      tombstoneReasonCode: command.reasonCode,
    },
    alias.aliasKey,
  );
  return {
    status: 'APPLIED',
    safeCode: 'ALIAS_TOMBSTONED',
    resourceReference: reference,
    resultingVersion: afterVersion,
    expectedReads: reads,
    resourceWrites: [
      {
        collection: 'ALIASES',
        documentId: alias.aliasKey,
        writeType: 'REPLACE',
        value,
      },
    ],
    events: [
      {
        eventType: 'ALIAS_TOMBSTONED',
        resourceType: 'ALIAS',
        resourceId: reference,
        beforeVersion: alias.authorityVersion,
        afterVersion,
        payloadSummary: {
          aliasType: alias.aliasType,
          aliasStatus: 'TOMBSTONED',
        },
      },
    ],
    resultingVersions: [
      {
        collection: 'ALIASES',
        documentId: alias.aliasKey,
        beforeVersion: alias.authorityVersion,
        afterVersion,
      },
    ],
  };
}

function planCanonicalization(
  command: Extract<
    AuthorityAdministrativeCommandV1,
    { readonly operationType: 'CANONICALIZE_LEGACY_TENANT' }
  >,
  snapshot: AuthorityRepositorySnapshotV1,
  occurredAt: string,
): PlannedMutation {
  const input = command.payload.canonicalizationInput;
  const sourceReference = input.migrationMetadata.sourceReference;
  const source = findDocument(
    snapshot.legacyTenantSources,
    sourceReference,
  )?.value;
  const expectedRecordVersion =
    command.precondition.type === 'MUST_EXIST_AT_VERSION'
      ? command.precondition.recordVersion
      : command.precondition.type === 'MUST_MATCH_AUTHORITY_VERSION'
        ? command.precondition.authorityVersion
        : 0;
  const sourceRead: AuthorityMutationExpectedReadV1 = {
    collection: 'LEGACY_TENANT_SOURCES',
    documentId: sourceReference,
    expectation: 'MUST_MATCH_SOURCE',
    expectedRecordVersion,
    expectedSourceRecordVersion: input.sourceRecordVersion,
    expectedSourceRecordFingerprint: input.sourceRecordFingerprint,
  };
  const reads: AuthorityMutationExpectedReadV1[] = [
    ...ledgerReads(command),
    sourceRead,
    {
      collection: 'TENANTS',
      documentId: input.canonicalDocumentId,
      expectation: 'MUST_NOT_EXIST',
    },
    ...input.aliasesToReserve.map(
      (alias): AuthorityMutationExpectedReadV1 => ({
        collection: 'ALIASES',
        documentId: alias.aliasKey,
        expectation: 'MUST_NOT_EXIST',
      }),
    ),
  ];
  if (source === undefined) {
    return {
      status: 'NOT_FOUND',
      safeCode: 'LEGACY_SOURCE_NOT_FOUND',
      expectedReads: reads,
    };
  }
  if (
    source.recordVersion !== expectedRecordVersion ||
    source.sourceRecordVersion !== input.sourceRecordVersion ||
    source.sourceRecordFingerprint !== input.sourceRecordFingerprint ||
    source.classifiedVariant !== input.classifiedVariant ||
    source.authorityUse !== 'PROHIBITED'
  ) {
    return {
      status: 'CONFLICT',
      safeCode: 'LEGACY_SOURCE_MISMATCH',
      expectedReads: reads,
    };
  }
  if (
    findDocument(snapshot.tenants, input.canonicalDocumentId) !== undefined
  ) {
    return {
      status: 'CONFLICT',
      safeCode: 'TENANT_ALREADY_EXISTS',
      expectedReads: reads,
    };
  }
  if (
    input.aliasesToReserve.some(
      (alias) =>
        findDocument(snapshot.aliases, alias.aliasKey) !== undefined,
    )
  ) {
    return {
      status: 'CONFLICT',
      safeCode: 'ALIAS_COLLISION',
      expectedReads: reads,
    };
  }
  const migrationState = createAuthorityMigrationMetadataV1({
    ...input.migrationMetadata,
    migrationStatus: 'APPLIED',
    appliedAt: occurredAt,
  });
  const legacyAliases = input.aliasesToReserve
    .filter((alias) => alias.aliasType === 'LEGACY_TENANT_ID')
    .map((alias) => alias.normalizedAlias);
  const tenant = createPersistedTenantAuthorityRecordV1(
    {
      schemaVersion: TENANT_AUTHORITY_RECORD_VERSION,
      tenantId: input.canonicalTarget.tenantId,
      status: input.canonicalTarget.status,
      authorityVersion: 1,
      recordVersion: 1,
      createdAt: occurredAt,
      updatedAt: occurredAt,
      createdBy: command.actor,
      updatedBy: command.actor,
      statusChangedAt: occurredAt,
      statusReasonCode: command.reasonCode,
      ...(input.canonicalTarget.tenantSlug === undefined
        ? {}
        : { tenantSlug: input.canonicalTarget.tenantSlug }),
      ...(input.canonicalTarget.organizationReference === undefined
        ? {}
        : {
            organizationReference:
              input.canonicalTarget.organizationReference,
          }),
      ...(input.canonicalTarget.clientReference === undefined
        ? {}
        : { clientReference: input.canonicalTarget.clientReference }),
      migrationState,
      ...(legacyAliases.length === 0 ? {} : { legacyAliases }),
    },
    input.canonicalDocumentId,
  );
  const aliases = input.aliasesToReserve.map((alias) =>
    createPersistedTenantAliasRecordV1(
      {
        schemaVersion: TENANT_ALIAS_RECORD_VERSION,
        aliasKey: alias.aliasKey,
        aliasType: alias.aliasType,
        normalizedAlias: alias.normalizedAlias,
        tenantId: alias.tenantId,
        status: 'ACTIVE',
        aliasVersion: 1,
        authorityVersion: 1,
        createdAt: occurredAt,
        updatedAt: occurredAt,
        createdBy: command.actor,
        updatedBy: command.actor,
      },
      alias.aliasKey,
    ),
  );
  const tenantReference = resourceReference(
    'TENANTS',
    input.canonicalDocumentId,
  );
  const migrationReference =
    `authority_migrations/${input.canonicalDocumentId}`;
  return {
    status: 'APPLIED',
    safeCode: 'LEGACY_TENANT_CANONICALIZED',
    resourceReference: tenantReference,
    resultingVersion: 1,
    expectedReads: reads,
    resourceWrites: [
      {
        collection: 'TENANTS',
        documentId: input.canonicalDocumentId,
        writeType: 'CREATE',
        value: tenant,
      },
      ...aliases.map(
        (value): AuthorityMutationResourceWriteV1 => ({
          collection: 'ALIASES',
          documentId: value.aliasKey,
          writeType: 'CREATE',
          value,
        }),
      ),
    ],
    events: [
      {
        eventType: 'TENANT_CANONICALIZED',
        resourceType: 'TENANT',
        resourceId: tenantReference,
        afterVersion: 1,
        payloadSummary: { migrationStatus: 'APPLIED' },
      },
      {
        eventType: 'MIGRATION_APPLIED',
        resourceType: 'MIGRATION',
        resourceId: migrationReference,
        payloadSummary: { migrationStatus: 'APPLIED' },
      },
    ],
    resultingVersions: [
      {
        collection: 'TENANTS',
        documentId: input.canonicalDocumentId,
        afterVersion: 1,
      },
      ...aliases.map(
        (value): AuthorityResultingVersionV1 => ({
          collection: 'ALIASES',
          documentId: value.aliasKey,
          afterVersion: 1,
        }),
      ),
    ],
  };
}

function planOperation(
  command: AuthorityAdministrativeCommandV1,
  snapshot: AuthorityRepositorySnapshotV1,
  occurredAt: string,
): PlannedMutation {
  switch (command.operationType) {
    case 'CREATE_TENANT_AUTHORITY':
      return planCreateTenant(command, snapshot, occurredAt);
    case 'UPDATE_TENANT_STATUS':
      return planUpdateTenantStatus(command, snapshot, occurredAt);
    case 'CREATE_TENANT_MEMBERSHIP':
      return planCreateMembership(command, snapshot, occurredAt);
    case 'UPDATE_TENANT_MEMBERSHIP_ROLES':
      return planUpdateMembershipRoles(command, snapshot, occurredAt);
    case 'CHANGE_TENANT_MEMBERSHIP_STATUS':
      return planChangeMembershipStatus(command, snapshot, occurredAt);
    case 'RESERVE_TENANT_ALIAS':
      return planReserveAlias(command, snapshot, occurredAt);
    case 'TOMBSTONE_TENANT_ALIAS':
      return planTombstoneAlias(command, snapshot, occurredAt);
    case 'CANONICALIZE_LEGACY_TENANT':
      return planCanonicalization(command, snapshot, occurredAt);
  }
}

export function createAuthorityCancellationResultV1(
  commandValue: unknown,
  occurredAtValue: unknown,
): AuthorityRepositoryResultV1 {
  const command = validateAuthorityAdministrativeCommandV1(commandValue);
  const occurredAt = validateAuthorityClockOutputV1(occurredAtValue);
  return createResult(
    command,
    'REJECTED',
    'OPERATION_CANCELLED',
    occurredAt,
  );
}

export function planAuthorityMutationV1(
  commandValue: unknown,
  contextValue: unknown,
  snapshotValue: unknown,
  occurredAtValue: unknown,
): AuthorityMutationPlanV1 {
  const command = validateAuthorityAdministrativeCommandV1(commandValue);
  const context = validateAuthorityRepositoryInvocationContextV1(
    contextValue,
    command,
  );
  const snapshot = validateAuthorityRepositorySnapshotV1(snapshotValue);
  const occurredAt = validateAuthorityClockOutputV1(occurredAtValue);
  const requestFingerprint = createAuthorityCommandFingerprintV1(command);
  if (context.cancellationSignal?.aborted === true) {
    return buildPlan(
      command,
      {
        status: 'REJECTED',
        safeCode: 'OPERATION_CANCELLED',
        expectedReads: [],
      },
      requestFingerprint,
      occurredAt,
      false,
    );
  }
  const replayOrConflict = idempotencyPlan(
    command,
    snapshot,
    requestFingerprint,
    occurredAt,
  );
  if (replayOrConflict !== undefined) {
    return replayOrConflict;
  }
  return buildPlan(
    command,
    planOperation(command, snapshot, occurredAt),
    requestFingerprint,
    occurredAt,
  );
}

export type {
  AuthorityAdministrativeCommandV1,
  AuthorityRepositoryInvocationContextV1,
};
