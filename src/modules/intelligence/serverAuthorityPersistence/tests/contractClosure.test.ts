import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { AuthorityPersistenceContractError } from '../errors';
import {
  createAuthorityAdministrativeCommandV1,
  createAuthorityAuditEventV1,
  createAuthorityIdempotencyRecordV1,
  createAuthorityOperationBindingRecordV1,
  createAuthorityOutboxDeliveryRecordV1,
  createAuthorityRepositoryAuthorizationDecisionV1,
  createAuthorityRepositoryInvocationContextV1,
  createAuthorityRepositoryResultV1,
  createLegacyTenantCanonicalizationInputV1,
  createTenantActivationPrerequisiteV1,
} from '../factories';
import {
  createAuthorityCommandFingerprintV1,
  createAuthorityRepositoryResultFingerprintV1,
  replayAuthorityRepositoryResultV1,
} from '../fingerprints';
import {
  AUTHORITY_LEGACY_TENANT_SOURCE_DESCRIPTOR_VERSION,
  AUTHORITY_LEGACY_TENANT_SOURCE_LOCATOR_VERSION,
  createAuthorityLegacyTenantSourceDescriptorV1,
  decodeAuthorityLegacyTenantSourceRecordV1,
  type AuthorityLegacyTenantSourceRecordV1,
} from '../legacyTenantSources';
import {
  createAuthorityAuditEventIdV1,
  createAuthorityIdempotencyDocumentIdV1,
  createAuthorityMembershipKeyV1,
  createAuthorityOperationBindingDocumentIdV1,
  createAuthorityOutboxEventIdV1,
} from '../ids';
import type {
  AuthorityClockPort,
  AuthorityMutationRepositoryPort,
} from '../ports';
import {
  getTenantAuthorityTransitionEventTypeV1,
  getTenantMembershipTransitionEventTypeV1,
} from '../transitions';
import {
  AUTHORITY_AUDIT_EVENT_VERSION,
  AUTHORITY_COMMAND_VERSION,
  AUTHORITY_IDEMPOTENCY_RECORD_VERSION,
  AUTHORITY_OPERATION_BINDING_RECORD_VERSION,
  AUTHORITY_OUTBOX_DELIVERY_RECORD_VERSION,
  AUTHORITY_REPOSITORY_AUTHORIZATION_DECISION_VERSION,
  AUTHORITY_REPOSITORY_INVOCATION_CONTEXT_VERSION,
  AUTHORITY_REPOSITORY_RESULT_VERSION,
  AUTHORITY_WRITE_PRECONDITION_VERSION,
  LEGACY_TENANT_CANONICALIZATION_INPUT_VERSION,
  TENANT_ACTIVATION_PREREQUISITE_VERSION,
  type AuthorityEventPayloadSummaryV1,
  type AuthorityEventType,
  type AuthorityOperationType,
  type AuthorityRepositoryResultV1,
  type AuthorityResourceType,
} from '../types';
import {
  assertAuthorityIdempotencyRecordMatchesCommandV1,
  assertAuthorityOperationBindingMatchesCommandV1,
  assertLegacyTenantCanonicalizationInputIsNotAuthorityV1,
  validateAuthorityClockOutputV1,
} from '../validators';
import {
  assertAuthorityVersionOutcomeV1,
  shouldIncrementAuthorityVersionV1,
} from '../versioning';

const AUTHENTICATED_AT = '2026-07-29T09:59:00.000Z';
const DECIDED_AT = '2026-07-29T10:00:00.000Z';
const INITIATED_AT = '2026-07-29T10:01:00.000Z';
const REQUESTED_AT = '2026-07-29T10:02:00.000Z';
const EXPIRES_AT = '2026-07-29T10:10:00.000Z';
const COMPLETED_AT = '2026-07-29T10:03:00.000Z';
const LEASE_EXPIRES_AT = '2026-07-29T10:05:00.000Z';
const TENANT_ID = 'tenantContract001';
const PRINCIPAL_ID = 'principalContract001';
const REQUEST_ID = 'request:authority-contract-001';
const CORRELATION_ID = 'correlation:authority-contract-001';
const OPERATION_ID = 'operation:authority-contract-001';
const IDEMPOTENCY_KEY = 'idempotency:authority-contract-001';
const LEGACY_SOURCE_DOCUMENT_ID = 'AbCdEfGhIjKlMnOpQrSt';
const RESULT_REFERENCE = `platform_tenants/${TENANT_ID}`;

const ACTOR = Object.freeze({
  actorType: 'USER' as const,
  actorId: PRINCIPAL_ID,
});

function principal(
  overrides: Readonly<Record<string, unknown>> = {},
) {
  return {
    schemaVersion: '1',
    principalId: PRINCIPAL_ID,
    principalType: 'USER',
    authenticationMethod: 'FIREBASE_ID_TOKEN',
    provider: 'FIREBASE_AUTH',
    authenticatedAt: AUTHENTICATED_AT,
    ...overrides,
  };
}

function createOnlyPrecondition() {
  return {
    schemaVersion: AUTHORITY_WRITE_PRECONDITION_VERSION,
    type: 'MUST_NOT_EXIST',
  };
}

function expectedVersionPrecondition(version = 7) {
  return {
    schemaVersion: AUTHORITY_WRITE_PRECONDITION_VERSION,
    type: 'MUST_EXIST_AT_VERSION',
    recordVersion: version,
  };
}

function command(
  overrides: Readonly<Record<string, unknown>> = {},
) {
  return {
    schemaVersion: AUTHORITY_COMMAND_VERSION,
    operationType: 'CREATE_TENANT_AUTHORITY',
    operationId: OPERATION_ID,
    idempotencyKey: IDEMPOTENCY_KEY,
    actor: ACTOR,
    requestedAt: REQUESTED_AT,
    precondition: createOnlyPrecondition(),
    reasonCode: 'ADMINISTRATIVE_CHANGE',
    requestId: REQUEST_ID,
    correlationId: CORRELATION_ID,
    payload: {
      tenantId: TENANT_ID,
      initialStatus: 'PENDING',
      tenantSlug: 'tenant-contract',
    },
    ...overrides,
  };
}

function membershipRolesCommand(
  roles: readonly string[],
  precondition: unknown = expectedVersionPrecondition(),
) {
  const membershipKey = createAuthorityMembershipKeyV1({
    principalType: 'USER',
    principalId: PRINCIPAL_ID,
    tenantId: TENANT_ID,
  });
  return command({
    operationType: 'UPDATE_TENANT_MEMBERSHIP_ROLES',
    precondition,
    payload: {
      membershipKey,
      principalType: 'USER',
      principalId: PRINCIPAL_ID,
      tenantId: TENANT_ID,
      roles,
    },
  });
}

function authorizationDecision(
  overrides: Readonly<Record<string, unknown>> = {},
) {
  return {
    schemaVersion: AUTHORITY_REPOSITORY_AUTHORIZATION_DECISION_VERSION,
    decisionVersion:
      AUTHORITY_REPOSITORY_AUTHORIZATION_DECISION_VERSION,
    decision: 'ALLOWED',
    authorizationVersion: 'authority-policy-v1',
    operationTypes: ['CREATE_TENANT_AUTHORITY'],
    principalType: 'USER',
    principalId: PRINCIPAL_ID,
    actorType: 'USER',
    actorId: PRINCIPAL_ID,
    decidedAt: DECIDED_AT,
    expiresAt: EXPIRES_AT,
    safeReasonCode: 'AUTHORITY_OPERATION_ALLOWED',
    ...overrides,
  };
}

function invocationContext(
  overrides: Readonly<Record<string, unknown>> = {},
) {
  return {
    schemaVersion: AUTHORITY_REPOSITORY_INVOCATION_CONTEXT_VERSION,
    principal: principal(),
    actor: ACTOR,
    authorizationDecision: authorizationDecision(),
    authorizedOperationTypes: ['CREATE_TENANT_AUTHORITY'],
    consumerId: 'AUTHORITY_ADMIN_CONTRACT_TEST',
    source: 'TRUSTED_AUTHORITY_CONTRACT_TEST',
    requestId: REQUEST_ID,
    correlationId: CORRELATION_ID,
    initiatedAt: INITIATED_AT,
    authorizationVersion: 'authority-policy-v1',
    ...overrides,
  };
}

function appliedResult(
  overrides: Readonly<Record<string, unknown>> = {},
) {
  return {
    schemaVersion: AUTHORITY_REPOSITORY_RESULT_VERSION,
    operationId: OPERATION_ID,
    correlationId: CORRELATION_ID,
    status: 'APPLIED',
    safeCode: 'TENANT_CREATED',
    completedAt: COMPLETED_AT,
    retryDisposition: 'DO_NOT_RETRY',
    resultingVersion: 1,
    resourceReference: RESULT_REFERENCE,
    ...overrides,
  };
}

function completedIdempotencyRecord(
  commandValue: unknown = command(),
) {
  const validatedCommand =
    createAuthorityAdministrativeCommandV1(commandValue);
  const exactRepositoryResult =
    createAuthorityRepositoryResultV1(appliedResult());
  return {
    schemaVersion: AUTHORITY_IDEMPOTENCY_RECORD_VERSION,
    idempotencyKey: validatedCommand.idempotencyKey,
    operationId: validatedCommand.operationId,
    operationType: validatedCommand.operationType,
    requestFingerprint:
      createAuthorityCommandFingerprintV1(validatedCommand),
    status: 'COMPLETED',
    startedAt: INITIATED_AT,
    completedAt: COMPLETED_AT,
    exactRepositoryResult,
    resultFingerprint:
      createAuthorityRepositoryResultFingerprintV1(
        exactRepositoryResult,
      ),
    version: 1,
  };
}

function completedOperationBinding(
  commandValue: unknown = command(),
) {
  const validatedCommand =
    createAuthorityAdministrativeCommandV1(commandValue);
  return {
    schemaVersion: AUTHORITY_OPERATION_BINDING_RECORD_VERSION,
    operationId: validatedCommand.operationId,
    idempotencyKey: validatedCommand.idempotencyKey,
    operationType: validatedCommand.operationType,
    requestFingerprint:
      createAuthorityCommandFingerprintV1(validatedCommand),
    status: 'COMPLETED',
    repositoryResultReference:
      `authority_idempotency/${createAuthorityIdempotencyDocumentIdV1(
        validatedCommand.idempotencyKey,
      )}`,
    createdAt: INITIATED_AT,
    completedAt: COMPLETED_AT,
    version: 1,
  };
}

function activationPrerequisite(
  overrides: Readonly<Record<string, unknown>> = {},
) {
  const membershipKey = createAuthorityMembershipKeyV1({
    principalType: 'USER',
    principalId: PRINCIPAL_ID,
    tenantId: TENANT_ID,
  });
  return {
    schemaVersion: TENANT_ACTIVATION_PREREQUISITE_VERSION,
    tenantId: TENANT_ID,
    tenantCurrentStatus: 'PENDING',
    tenantExpectedRecordVersion: 7,
    membershipKey,
    membershipPrincipalType: 'USER',
    membershipPrincipalId: PRINCIPAL_ID,
    membershipTenantId: TENANT_ID,
    membershipStatus: 'ACTIVE',
    membershipRoles: ['TENANT_ADMIN'],
    membershipExpectedVersion: 3,
    ...overrides,
  };
}

function legacySource(
  rawOverrides: Readonly<Record<string, unknown>> = {},
) {
  return decodeAuthorityLegacyTenantSourceRecordV1(
    createAuthorityLegacyTenantSourceDescriptorV1({
      schemaVersion:
        AUTHORITY_LEGACY_TENANT_SOURCE_DESCRIPTOR_VERSION,
      sourceCollection: 'PLATFORM_TENANTS',
      sourceDocumentId: LEGACY_SOURCE_DOCUMENT_ID,
      sourceLocatorVersion:
        AUTHORITY_LEGACY_TENANT_SOURCE_LOCATOR_VERSION,
      authorityUse: 'PROHIBITED',
    }),
    {
      tenantSlug: 'tenant-contract',
      status: 'PENDING',
      clientId: 'client_contract',
      recordVersion: 1,
      ...rawOverrides,
    },
    DECIDED_AT,
  );
}

function migrationMetadata(
  sourceRecord: AuthorityLegacyTenantSourceRecordV1 = legacySource(),
  overrides: Readonly<Record<string, unknown>> = {},
) {
  return {
    schemaVersion: '1',
    authorityUse: 'PROHIBITED',
    migrationVersion: 'migration-v1',
    sourceSystem: 'legacy_platform',
    sourceLocatorKey: sourceRecord.sourceLocator.locatorKey,
    sourceRecordVersion: sourceRecord.sourceRecordVersion,
    sourceRecordFingerprint: sourceRecord.sourceRecordFingerprint,
    classifiedVariant: sourceRecord.classifiedVariant,
    migrationStatus: 'VALIDATED',
    validatedAt: DECIDED_AT,
    ...overrides,
  };
}

function legacyInput(
  overrides: Readonly<Record<string, unknown>> = {},
) {
  const sourceRecord = legacySource();
  return {
    schemaVersion: LEGACY_TENANT_CANONICALIZATION_INPUT_VERSION,
    canonicalDocumentId: TENANT_ID,
    sourceRecord,
    canonicalTarget: {
      tenantId: TENANT_ID,
      status: 'PENDING',
      tenantSlug: 'tenant-contract',
    },
    selectedAliasCandidates: sourceRecord.aliasCandidates,
    migrationMetadata: migrationMetadata(sourceRecord),
    conflictDisposition: 'NONE',
    ...overrides,
  };
}

function eventResourceType(
  eventType: AuthorityEventType,
): AuthorityResourceType {
  if (eventType.startsWith('TENANT_')) {
    return 'TENANT';
  }
  if (eventType.startsWith('MEMBERSHIP_')) {
    return 'MEMBERSHIP';
  }
  return 'MIGRATION';
}

function auditEvent(
  eventType: AuthorityEventType,
  payloadSummary: AuthorityEventPayloadSummaryV1,
) {
  const resourceType = eventResourceType(eventType);
  const resourceId =
    resourceType === 'TENANT'
      ? RESULT_REFERENCE
      : `tenant_memberships/${createAuthorityMembershipKeyV1({
          principalType: 'USER',
          principalId: PRINCIPAL_ID,
          tenantId: TENANT_ID,
        })}`;
  const identity = {
    operationId: OPERATION_ID,
    eventType,
    resourceType,
    resourceId,
  };
  return {
    schemaVersion: AUTHORITY_AUDIT_EVENT_VERSION,
    eventId: createAuthorityAuditEventIdV1(identity),
    eventType,
    operationId: OPERATION_ID,
    correlationId: CORRELATION_ID,
    actor: ACTOR,
    resourceType,
    resourceId,
    reasonCode: 'ADMINISTRATIVE_CHANGE',
    beforeVersion: 1,
    afterVersion: 2,
    occurredAt: COMPLETED_AT,
    payloadSummary,
  };
}

function pendingDelivery(
  overrides: Readonly<Record<string, unknown>> = {},
) {
  return {
    schemaVersion: AUTHORITY_OUTBOX_DELIVERY_RECORD_VERSION,
    eventId: createAuthorityOutboxEventIdV1({
      operationId: OPERATION_ID,
      eventType: 'TENANT_CREATED',
      resourceType: 'TENANT',
      resourceId: RESULT_REFERENCE,
    }),
    deliveryStatus: 'PENDING',
    attemptCount: 0,
    availableAt: INITIATED_AT,
    version: 1,
    ...overrides,
  };
}

describe('authoritative invocation closure', () => {
  it('1 accepts a valid invocation context', () => {
    const result = createAuthorityRepositoryInvocationContextV1(
      invocationContext(),
      command(),
    );
    expect(result.actor).toEqual(ACTOR);
    expect(() =>
      createAuthorityRepositoryInvocationContextV1(undefined, command()),
    ).toThrow(AuthorityPersistenceContractError);
  });

  it('2 rejects a DENIED decision', () => {
    expect(() =>
      createAuthorityRepositoryInvocationContextV1(
        invocationContext({
          authorizationDecision: authorizationDecision({
            decision: 'DENIED',
            safeReasonCode: 'AUTHORITY_OPERATION_DENIED',
          }),
        }),
        command(),
      ),
    ).toThrow(AuthorityPersistenceContractError);
  });

  it('3 rejects a principal and actor mismatch', () => {
    expect(() =>
      createAuthorityRepositoryInvocationContextV1(
        invocationContext({
          actor: { actorType: 'USER', actorId: 'otherPrincipal001' },
        }),
        command(),
      ),
    ).toThrow(AuthorityPersistenceContractError);
  });

  it('4 rejects a command actor mismatch', () => {
    expect(() =>
      createAuthorityRepositoryInvocationContextV1(
        invocationContext(),
        command({
          actor: { actorType: 'USER', actorId: 'otherPrincipal001' },
        }),
      ),
    ).toThrow(AuthorityPersistenceContractError);
  });

  it('5 rejects an operation not expressly authorized', () => {
    const operationTypes = ['UPDATE_TENANT_STATUS'];
    expect(() =>
      createAuthorityRepositoryInvocationContextV1(
        invocationContext({
          authorizationDecision: authorizationDecision({
            operationTypes,
          }),
          authorizedOperationTypes: operationTypes,
        }),
        command(),
      ),
    ).toThrow(AuthorityPersistenceContractError);
  });

  it('6 rejects a requestId mismatch', () => {
    expect(() =>
      createAuthorityRepositoryInvocationContextV1(
        invocationContext({ requestId: 'request:other-001' }),
        command(),
      ),
    ).toThrow(AuthorityPersistenceContractError);
  });

  it('7 rejects a correlationId mismatch', () => {
    expect(() =>
      createAuthorityRepositoryInvocationContextV1(
        invocationContext({
          correlationId: 'correlation:other-001',
        }),
        command(),
      ),
    ).toThrow(AuthorityPersistenceContractError);
  });

  it('8 rejects expired authorization', () => {
    expect(() =>
      createAuthorityRepositoryInvocationContextV1(
        invocationContext({
          authorizationDecision: authorizationDecision({
            expiresAt: '2026-07-29T10:01:30.000Z',
          }),
        }),
        command(),
      ),
    ).toThrow(AuthorityPersistenceContractError);
  });

  it('9 preserves AbortSignal identity without freezing it', () => {
    const controller = new AbortController();
    const result = createAuthorityRepositoryInvocationContextV1(
      invocationContext({ cancellationSignal: controller.signal }),
      command(),
    );
    expect(result.cancellationSignal).toBe(controller.signal);
    expect(Object.isFrozen(controller.signal)).toBe(false);
  });

  it('10 keeps the repository port free of Firebase types', () => {
    const source = fs.readFileSync(
      path.resolve(
        process.cwd(),
        'src/modules/intelligence/serverAuthorityPersistence/ports.ts',
      ),
      'utf8',
    );
    expect(source).toContain('AuthorityMutationRepositoryPort');
    expect(source).not.toMatch(/firebase|firestore/i);
    const structuralPort: AuthorityMutationRepositoryPort = {
      async execute(): Promise<AuthorityRepositoryResultV1> {
        return createAuthorityRepositoryResultV1(appliedResult());
      },
    };
    expect(typeof structuralPort.execute).toBe('function');
  });

  it('11 keeps the clock port neutral and validates its output', () => {
    const clock: AuthorityClockPort = {
      nowIso: () => INITIATED_AT,
    };
    expect(validateAuthorityClockOutputV1(clock.nowIso())).toBe(
      INITIATED_AT,
    );
    expect(() => validateAuthorityClockOutputV1('not-a-time')).toThrow(
      AuthorityPersistenceContractError,
    );
  });
});

describe('idempotency and operation binding closure', () => {
  it('12 preserves an exact result in COMPLETED idempotency', () => {
    const result = createAuthorityIdempotencyRecordV1(
      completedIdempotencyRecord(),
    );
    expect(result.status).toBe('COMPLETED');
    if (result.status === 'COMPLETED') {
      expect(result.exactRepositoryResult).toEqual(
        createAuthorityRepositoryResultV1(appliedResult()),
      );
    }
  });

  it('13 replays an equivalent immutable repository result', () => {
    const original = createAuthorityRepositoryResultV1(appliedResult());
    const replay = replayAuthorityRepositoryResultV1(original);
    expect(replay).toEqual(original);
    expect(replay).not.toBe(original);
    expect(Object.isFrozen(replay)).toBe(true);
  });

  it('14 rejects COMPLETED without an exact result', () => {
    const invalid: Record<string, unknown> = {
      ...completedIdempotencyRecord(),
    };
    Reflect.deleteProperty(invalid, 'exactRepositoryResult');
    expect(() => createAuthorityIdempotencyRecordV1(invalid)).toThrow(
      AuthorityPersistenceContractError,
    );
  });

  it('15 rejects a result fingerprint mismatch', () => {
    expect(() =>
      createAuthorityIdempotencyRecordV1({
        ...completedIdempotencyRecord(),
        resultFingerprint: `sha256:${'b'.repeat(64)}`,
      }),
    ).toThrow(AuthorityPersistenceContractError);
  });

  it('16 accepts a valid operation binding', () => {
    expect(
      createAuthorityOperationBindingRecordV1(
        completedOperationBinding(),
      ).status,
    ).toBe('COMPLETED');
  });

  it('17 rejects an operationId rebound to a different key', () => {
    expect(() =>
      assertAuthorityOperationBindingMatchesCommandV1(
        {
          ...completedOperationBinding(),
          idempotencyKey: 'idempotency:different-contract-001',
        },
        command(),
      ),
    ).toThrow(AuthorityPersistenceContractError);
  });

  it('18 rejects an operationId rebound to a different fingerprint', () => {
    expect(() =>
      assertAuthorityOperationBindingMatchesCommandV1(
        {
          ...completedOperationBinding(),
          requestFingerprint: `sha256:${'c'.repeat(64)}`,
        },
        command(),
      ),
    ).toThrow(AuthorityPersistenceContractError);
    expect(() =>
      assertAuthorityIdempotencyRecordMatchesCommandV1(
        {
          ...completedIdempotencyRecord(),
          requestFingerprint: `sha256:${'c'.repeat(64)}`,
        },
        command(),
      ),
    ).toThrow(AuthorityPersistenceContractError);
  });
});

describe('fingerprints, IDs, and authority versions', () => {
  it('19 creates a deterministic command fingerprint', () => {
    expect(createAuthorityCommandFingerprintV1(command())).toBe(
      createAuthorityCommandFingerprintV1(command()),
    );
  });

  it('20 canonicalizes role and alias ordering before fingerprinting', () => {
    expect(
      createAuthorityCommandFingerprintV1(
        membershipRolesCommand(['TENANT_ADMIN', 'TENANT_MEMBER']),
      ),
    ).toBe(
      createAuthorityCommandFingerprintV1(
        membershipRolesCommand(['TENANT_MEMBER', 'TENANT_ADMIN']),
      ),
    );
    const sourceRecord = legacySource();
    const aliases = sourceRecord.aliasCandidates;
    const canonicalizationCommand = (orderedAliases: readonly unknown[]) =>
      command({
        operationType: 'CANONICALIZE_LEGACY_TENANT',
        precondition: createOnlyPrecondition(),
        payload: {
          canonicalizationInput: legacyInput({
            sourceRecord,
            selectedAliasCandidates: orderedAliases,
            migrationMetadata: migrationMetadata(sourceRecord),
          }),
        },
      });
    expect(
      createAuthorityCommandFingerprintV1(
        canonicalizationCommand(aliases),
      ),
    ).toBe(
      createAuthorityCommandFingerprintV1(
        canonicalizationCommand([...aliases].reverse()),
      ),
    );
  });

  it('21 changes the fingerprint when payload changes', () => {
    expect(createAuthorityCommandFingerprintV1(command())).not.toBe(
      createAuthorityCommandFingerprintV1(
        command({
          payload: {
            tenantId: TENANT_ID,
            initialStatus: 'PENDING',
            tenantSlug: 'tenant-contract-two',
          },
        }),
      ),
    );
  });

  it('22 changes the fingerprint when precondition changes', () => {
    expect(
      createAuthorityCommandFingerprintV1(
        membershipRolesCommand(['TENANT_ADMIN']),
      ),
    ).not.toBe(
      createAuthorityCommandFingerprintV1(
        membershipRolesCommand(
          ['TENANT_ADMIN'],
          {
            schemaVersion: AUTHORITY_WRITE_PRECONDITION_VERSION,
            type: 'MUST_MATCH_AUTHORITY_VERSION',
            authorityVersion: 7,
          },
        ),
      ),
    );
  });

  it('23 creates deterministic audit event IDs', () => {
    const input = {
      operationId: OPERATION_ID,
      eventType: 'TENANT_CREATED',
      resourceType: 'TENANT',
      resourceId: RESULT_REFERENCE,
    };
    expect(createAuthorityAuditEventIdV1(input)).toBe(
      createAuthorityAuditEventIdV1({
        resourceId: RESULT_REFERENCE,
        resourceType: 'TENANT',
        eventType: 'TENANT_CREATED',
        operationId: OPERATION_ID,
      }),
    );
    expect(() =>
      createAuthorityAuditEventV1({
        ...auditEvent('TENANT_ACTIVATED', {
          tenantStatusFrom: 'PENDING',
          tenantStatusTo: 'ACTIVE',
        }),
        eventId: 'event:non-deterministic',
      }),
    ).toThrow(AuthorityPersistenceContractError);
  });

  it('24 creates deterministic idempotency document IDs', () => {
    expect(createAuthorityIdempotencyDocumentIdV1(IDEMPOTENCY_KEY)).toBe(
      createAuthorityIdempotencyDocumentIdV1(IDEMPOTENCY_KEY),
    );
  });

  it('25 creates deterministic operation binding document IDs', () => {
    expect(
      createAuthorityOperationBindingDocumentIdV1(OPERATION_ID),
    ).toBe(createAuthorityOperationBindingDocumentIdV1(OPERATION_ID));
  });

  it('26 requires authority creation to start at one', () => {
    expect(
      shouldIncrementAuthorityVersionV1(
        'CREATE_TENANT_AUTHORITY',
        undefined,
        1,
      ),
    ).toBe(true);
    expect(() =>
      shouldIncrementAuthorityVersionV1(
        'CREATE_TENANT_AUTHORITY',
        undefined,
        2,
      ),
    ).toThrow(AuthorityPersistenceContractError);
  });

  it('27 requires APPLIED to increment exactly once', () => {
    expect(() =>
      assertAuthorityVersionOutcomeV1(
        'UPDATE_TENANT_STATUS',
        'APPLIED',
        3,
        4,
      ),
    ).not.toThrow();
    expect(() =>
      assertAuthorityVersionOutcomeV1(
        'UPDATE_TENANT_STATUS',
        'APPLIED',
        3,
        3,
      ),
    ).toThrow(AuthorityPersistenceContractError);
  });

  it('28 prevents NO_OP from incrementing authorityVersion', () => {
    expect(() =>
      assertAuthorityVersionOutcomeV1(
        'UPDATE_TENANT_STATUS',
        'NO_OP',
        3,
        3,
      ),
    ).not.toThrow();
  });

  it('29 prevents replay from incrementing authorityVersion', () => {
    expect(() =>
      assertAuthorityVersionOutcomeV1(
        'UPDATE_TENANT_STATUS',
        'REPLAY',
        4,
        4,
      ),
    ).not.toThrow();
  });

  it('30 rejects authorityVersion jumps', () => {
    expect(() =>
      assertAuthorityVersionOutcomeV1(
        'UPDATE_TENANT_STATUS',
        'APPLIED',
        3,
        5,
      ),
    ).toThrow(AuthorityPersistenceContractError);
  });
});

describe('event vocabulary and transition mapping', () => {
  it('31 maps and validates tenant activation', () => {
    expect(
      getTenantAuthorityTransitionEventTypeV1('PENDING', 'ACTIVE'),
    ).toBe('TENANT_ACTIVATED');
    expect(
      createAuthorityAuditEventV1(
        auditEvent('TENANT_ACTIVATED', {
          tenantStatusFrom: 'PENDING',
          tenantStatusTo: 'ACTIVE',
        }),
      ).eventType,
    ).toBe('TENANT_ACTIVATED');
  });

  it('32 maps and validates tenant reactivation', () => {
    expect(
      getTenantAuthorityTransitionEventTypeV1('SUSPENDED', 'ACTIVE'),
    ).toBe('TENANT_REACTIVATED');
    expect(
      createAuthorityAuditEventV1(
        auditEvent('TENANT_REACTIVATED', {
          tenantStatusFrom: 'SUSPENDED',
          tenantStatusTo: 'ACTIVE',
        }),
      ).eventType,
    ).toBe('TENANT_REACTIVATED');
  });

  it('33 maps and validates tenant deletion', () => {
    expect(
      getTenantAuthorityTransitionEventTypeV1('DEACTIVATED', 'DELETED'),
    ).toBe('TENANT_DELETED');
    expect(
      createAuthorityAuditEventV1(
        auditEvent('TENANT_DELETED', {
          tenantStatusFrom: 'DEACTIVATED',
          tenantStatusTo: 'DELETED',
        }),
      ).eventType,
    ).toBe('TENANT_DELETED');
  });

  it('34 validates membership activation without a prior authority status', () => {
    expect(
      createAuthorityAuditEventV1(
        auditEvent('MEMBERSHIP_ACTIVATED', {
          membershipStatusTo: 'ACTIVE',
        }),
      ).eventType,
    ).toBe('MEMBERSHIP_ACTIVATED');
  });

  it('35 maps and validates membership reactivation', () => {
    expect(
      getTenantMembershipTransitionEventTypeV1('SUSPENDED', 'ACTIVE'),
    ).toBe('MEMBERSHIP_REACTIVATED');
    expect(
      createAuthorityAuditEventV1(
        auditEvent('MEMBERSHIP_REACTIVATED', {
          membershipStatusFrom: 'SUSPENDED',
          membershipStatusTo: 'ACTIVE',
        }),
      ).eventType,
    ).toBe('MEMBERSHIP_REACTIVATED');
  });

  it('36 maps and validates membership deletion', () => {
    expect(
      getTenantMembershipTransitionEventTypeV1('REVOKED', 'DELETED'),
    ).toBe('MEMBERSHIP_DELETED');
    expect(
      createAuthorityAuditEventV1(
        auditEvent('MEMBERSHIP_DELETED', {
          membershipStatusFrom: 'REVOKED',
          membershipStatusTo: 'DELETED',
        }),
      ).eventType,
    ).toBe('MEMBERSHIP_DELETED');
  });
});

describe('outbox delivery closure', () => {
  it('37 accepts PENDING without a lease', () => {
    expect(
      createAuthorityOutboxDeliveryRecordV1(pendingDelivery())
        .deliveryStatus,
    ).toBe('PENDING');
  });

  it('38 accepts a complete LEASED state', () => {
    expect(
      createAuthorityOutboxDeliveryRecordV1(
        pendingDelivery({
          deliveryStatus: 'LEASED',
          attemptCount: 1,
          leaseOwner: 'authority-worker-001',
          leaseExpiresAt: LEASE_EXPIRES_AT,
          lastAttemptAt: REQUESTED_AT,
        }),
      ).deliveryStatus,
    ).toBe('LEASED');
  });

  it('39 rejects an incomplete lease', () => {
    expect(() =>
      createAuthorityOutboxDeliveryRecordV1(
        pendingDelivery({
          deliveryStatus: 'LEASED',
          attemptCount: 1,
          leaseOwner: 'authority-worker-001',
        }),
      ),
    ).toThrow(AuthorityPersistenceContractError);
  });

  it('40 accepts a complete DELIVERED state', () => {
    expect(
      createAuthorityOutboxDeliveryRecordV1(
        pendingDelivery({
          deliveryStatus: 'DELIVERED',
          attemptCount: 1,
          lastAttemptAt: REQUESTED_AT,
          deliveredAt: COMPLETED_AT,
        }),
      ).deliveryStatus,
    ).toBe('DELIVERED');
  });

  it('41 rejects DELIVERED with an active lease', () => {
    expect(() =>
      createAuthorityOutboxDeliveryRecordV1(
        pendingDelivery({
          deliveryStatus: 'DELIVERED',
          attemptCount: 1,
          deliveredAt: COMPLETED_AT,
          leaseOwner: 'authority-worker-001',
          leaseExpiresAt: LEASE_EXPIRES_AT,
        }),
      ),
    ).toThrow(AuthorityPersistenceContractError);
  });

  it('42 accepts a terminal failure with a safe code', () => {
    expect(
      createAuthorityOutboxDeliveryRecordV1(
        pendingDelivery({
          deliveryStatus: 'FAILED_TERMINAL',
          attemptCount: 3,
          lastAttemptAt: COMPLETED_AT,
          safeFailureCode: 'DELIVERY_REJECTED',
        }),
      ).deliveryStatus,
    ).toBe('FAILED_TERMINAL');
  });
});

describe('activation and legacy canonicalization closure', () => {
  it('43 accepts an exact administrative activation prerequisite', () => {
    expect(
      createTenantActivationPrerequisiteV1(activationPrerequisite())
        .membershipStatus,
    ).toBe('ACTIVE');
    const activationCommand = createAuthorityAdministrativeCommandV1(
      command({
        operationType: 'UPDATE_TENANT_STATUS',
        precondition: expectedVersionPrecondition(),
        payload: {
          tenantId: TENANT_ID,
          currentStatus: 'PENDING',
          targetStatus: 'ACTIVE',
          activationPrerequisite: activationPrerequisite(),
        },
      }),
    );
    expect(activationCommand.operationType).toBe('UPDATE_TENANT_STATUS');
  });

  it('44 rejects activation without TENANT_ADMIN', () => {
    expect(() =>
      createTenantActivationPrerequisiteV1(
        activationPrerequisite({
          membershipRoles: ['TENANT_OPERATOR'],
        }),
      ),
    ).toThrow(AuthorityPersistenceContractError);
  });

  it('45 rejects a membership and tenant mismatch', () => {
    expect(() =>
      createTenantActivationPrerequisiteV1(
        activationPrerequisite({
          membershipTenantId: 'tenantContract002',
        }),
      ),
    ).toThrow(AuthorityPersistenceContractError);
  });

  it('46 accepts a classified legacy variant', () => {
    expect(
      createLegacyTenantCanonicalizationInputV1(legacyInput())
        .sourceRecord.classificationDisposition,
    ).toBe('CANONICALIZABLE');
  });

  it('47 requires review for conflicting status fields', () => {
    const sourceRecord = legacySource({
      status: 'ACTIVE',
      tenantStatus: 'SUSPENDED',
    });
    const result = createLegacyTenantCanonicalizationInputV1(
      legacyInput({
        sourceRecord,
        migrationMetadata: migrationMetadata(sourceRecord),
        conflictDisposition: 'REQUIRE_REVIEW',
      }),
    );
    expect(result.sourceRecord.classificationDisposition).toBe(
      'REQUIRES_REVIEW',
    );
    expect(() =>
      createAuthorityAdministrativeCommandV1(
        command({
          operationType: 'CANONICALIZE_LEGACY_TENANT',
          precondition: createOnlyPrecondition(),
          payload: { canonicalizationInput: result },
        }),
      ),
    ).toThrow(AuthorityPersistenceContractError);
  });

  it('48 rejects an unknown legacy variant', () => {
    const sourceRecord = legacySource();
    expect(() =>
      createLegacyTenantCanonicalizationInputV1(
        legacyInput({
          sourceRecord: {
            ...sourceRecord,
            classifiedVariant: 'UNKNOWN_LEGACY_VARIANT',
          },
        }),
      ),
    ).toThrow(AuthorityPersistenceContractError);
  });

  it('49 proves migration metadata cannot grant authority', () => {
    const result =
      assertLegacyTenantCanonicalizationInputIsNotAuthorityV1(
        legacyInput(),
      );
    expect(result.migrationMetadata.authorityUse).toBe('PROHIBITED');
    expect(() =>
      createLegacyTenantCanonicalizationInputV1(
        legacyInput({
          migrationMetadata: migrationMetadata(legacySource(), {
            authorityUse: 'ALLOWED',
          }),
        }),
      ),
    ).toThrow(AuthorityPersistenceContractError);
  });

  it('50 enforces retry disposition coherently with result status', () => {
    expect(
      createAuthorityRepositoryResultV1({
        ...appliedResult(),
        status: 'CONFLICT',
        safeCode: 'STALE_VERSION',
        retryDisposition: 'RETRY_AFTER_READ',
        resultingVersion: undefined,
        resourceReference: undefined,
      }).retryDisposition,
    ).toBe('RETRY_AFTER_READ');
    expect(() =>
      createAuthorityRepositoryResultV1({
        ...appliedResult(),
        status: 'CONFLICT',
        safeCode: 'STALE_VERSION',
        retryDisposition: 'DO_NOT_RETRY',
        resultingVersion: undefined,
        resourceReference: undefined,
      }),
    ).toThrow(AuthorityPersistenceContractError);
  });
});

describe('immutability and architectural restrictions', () => {
  it('51 factories clone caller-owned structures', () => {
    const operationTypes = ['CREATE_TENANT_AUTHORITY'];
    const result = createAuthorityRepositoryAuthorizationDecisionV1(
      authorizationDecision({ operationTypes }),
    );
    expect(result.operationTypes).not.toBe(operationTypes);
  });

  it('52 factories freeze returned structures', () => {
    const result = createAuthorityRepositoryInvocationContextV1(
      invocationContext(),
      command(),
    );
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.principal)).toBe(true);
    expect(Object.isFrozen(result.authorizationDecision)).toBe(true);
    expect(Object.isFrozen(result.authorizedOperationTypes)).toBe(true);
  });

  it('53 caller mutation cannot alter canonicalized aliases', () => {
    const sourceRecord = legacySource();
    const aliases = sourceRecord.aliasCandidates.map((candidate) => ({
      ...candidate,
    }));
    const result = createLegacyTenantCanonicalizationInputV1(
      legacyInput({
        sourceRecord,
        selectedAliasCandidates: aliases,
        migrationMetadata: migrationMetadata(sourceRecord),
      }),
    );
    aliases[0].normalizedAlias = 'changed-alias';
    expect(result.selectedAliasCandidates[0]?.normalizedAlias).not.toBe(
      'changed-alias',
    );
  });

  it('54 has no Firebase imports', () => {
    expect(productionSource()).not.toMatch(
      /from\s+['"](?:firebase|firebase-admin|firebase-functions)/i,
    );
  });

  it('55 has no Firestore imports or API calls', () => {
    expect(productionSource()).not.toMatch(
      /from\s+['"][^'"]*firestore|runTransaction|getFirestore/i,
    );
  });

  it('56 has no Functions imports or handlers', () => {
    expect(productionSource()).not.toMatch(
      /firebase-functions|\bonCall\b|\bonRequest\b/,
    );
  });

  it('57 has no ambient clock, randomness, or environment access', () => {
    expect(productionSource()).not.toMatch(
      /Date\.now|new\s+Date\s*\(\s*\)|Math\.random|randomUUID|process\.env/,
    );
  });

  it('58 exports the closed contract allowlist from the server entrypoint', () => {
    const entrypoint = fs.readFileSync(
      path.resolve(
        process.cwd(),
        'src/modules/intelligence/server.ts',
      ),
      'utf8',
    );
    expect(entrypoint).toContain('AuthorityMutationRepositoryPort');
    expect(entrypoint).toContain(
      'AuthorityRepositoryInvocationContextV1',
    );
    expect(entrypoint).toContain(
      'createAuthorityCommandFingerprintV1',
    );
  });

  it('59 remains a Node-only package boundary', () => {
    const packageDefinition = JSON.parse(
      fs.readFileSync(
        path.resolve(
          process.cwd(),
          'packages/aura-intelligence-os/package.json',
        ),
        'utf8',
      ),
    ) as Record<string, unknown>;
    expect(packageDefinition.type).toBe('commonjs');
    expect(productionSource()).not.toMatch(/\bReact\b|window\.|document\./);
  });

  it('60 keeps deterministic outputs reproducible across constructions', () => {
    const first = createAuthorityCommandFingerprintV1(command());
    const second = createAuthorityCommandFingerprintV1({
      ...command(),
      payload: {
        tenantSlug: 'tenant-contract',
        initialStatus: 'PENDING',
        tenantId: TENANT_ID,
      },
    });
    expect(second).toBe(first);
  });

  it('61 retains the structural Node 20 validation gate', () => {
    const workflow = fs.readFileSync(
      path.resolve(
        process.cwd(),
        '.github/workflows/intelligence-os-node20.yml',
      ),
      'utf8',
    );
    expect(workflow).toMatch(/node-version:\s*20/);
    expect(workflow).toContain('assert:node20');
  });

  it('62 contains only the authorized in-memory repository runtime', () => {
    expect(productionSource()).toMatch(
      /\bclass\s+InMemoryAuthorityMutationRepository\b/,
    );
    expect(productionSource()).not.toMatch(
      /\bclass\s+.*(?:Firestore|Firebase).*Adapter\b/,
    );
    expect(productionSource()).not.toMatch(
      /\b(?:create|set|update|delete)\s*\(\s*(?:document|snapshot|ref)/,
    );
  });
});

function productionSource(): string {
  const moduleRoot = path.resolve(
    process.cwd(),
    'src/modules/intelligence/serverAuthorityPersistence',
  );
  return fs
    .readdirSync(moduleRoot)
    .filter((file) => file.endsWith('.ts'))
    .map((file) => fs.readFileSync(path.join(moduleRoot, file), 'utf8'))
    .join('\n');
}

const PORT_COMPILE_ONLY_OPERATION: AuthorityOperationType =
  'CREATE_TENANT_AUTHORITY';
void PORT_COMPILE_ONLY_OPERATION;
