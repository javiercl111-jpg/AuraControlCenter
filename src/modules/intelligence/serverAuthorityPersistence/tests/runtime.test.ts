import { describe, expect, it } from 'vitest';

import { InMemoryAuthorityMutationRepository } from '../InMemoryAuthorityMutationRepository';
import { applyAuthorityMutationPlanV1 } from '../applyMutationPlan';
import { AuthorityPersistenceContractError } from '../errors';
import {
  createAuthorityAdministrativeCommandV1,
  createAuthorityRepositoryInvocationContextV1,
  createPersistedTenantAliasRecordV1,
  createPersistedTenantAuthorityRecordV1,
  createPersistedTenantMembershipRecordV1,
} from '../factories';
import {
  createAuthorityAliasKeyV1,
  createAuthorityMembershipKeyV1,
} from '../ids';
import { planAuthorityMutationV1 } from '../planner';
import type { AuthorityClockPort } from '../ports';
import {
  AUTHORITY_LEGACY_SOURCE_RECORD_VERSION,
  AUTHORITY_REPOSITORY_SNAPSHOT_VERSION,
  type AuthorityRepositorySnapshotV1,
} from '../runtimeTypes';
import {
  createEmptyAuthorityRepositorySnapshotV1,
  validateAuthorityRepositorySnapshotV1,
} from '../snapshot';
import {
  AUTHORITY_COMMAND_VERSION,
  AUTHORITY_REPOSITORY_AUTHORIZATION_DECISION_VERSION,
  AUTHORITY_REPOSITORY_INVOCATION_CONTEXT_VERSION,
  AUTHORITY_TENANT_ROLE_VOCABULARY_VERSION,
  AUTHORITY_WRITE_PRECONDITION_VERSION,
  LEGACY_TENANT_CANONICALIZATION_INPUT_VERSION,
  TENANT_ACTIVATION_PREREQUISITE_VERSION,
  TENANT_ALIAS_RECORD_VERSION,
  TENANT_AUTHORITY_RECORD_VERSION,
  TENANT_MEMBERSHIP_RECORD_VERSION,
  type AuthorityAdministrativeCommandV1,
  type AuthorityOperationType,
  type AuthorityRepositoryInvocationContextV1,
  type PersistedTenantAliasRecordV1,
  type PersistedTenantAuthorityRecordV1,
  type PersistedTenantMembershipRecordV1,
  type TenantAuthorityStatus,
  type TenantMembershipAuthorityStatus,
} from '../types';

const AUTHENTICATED_AT = '2026-07-29T09:00:00.000Z';
const DECIDED_AT = '2026-07-29T09:01:00.000Z';
const INITIATED_AT = '2026-07-29T09:02:00.000Z';
const REQUESTED_AT = '2026-07-29T09:03:00.000Z';
const OCCURRED_AT = '2026-07-29T09:04:00.000Z';
const PRINCIPAL_ID = 'principalRuntime001';
const TENANT_ID = 'tenantRuntime001';
const ACTOR = Object.freeze({
  actorType: 'USER' as const,
  actorId: PRINCIPAL_ID,
});
const SOURCE_FINGERPRINT = `sha256:${'a'.repeat(64)}`;

function operationId(suffix: string): string {
  return `operation:runtime:${suffix}`;
}

function idempotencyKey(suffix: string): string {
  return `idempotency:runtime:${suffix}`;
}

function createOnly() {
  return {
    schemaVersion: AUTHORITY_WRITE_PRECONDITION_VERSION,
    type: 'MUST_NOT_EXIST',
  };
}

function atRecordVersion(recordVersion: number) {
  return {
    schemaVersion: AUTHORITY_WRITE_PRECONDITION_VERSION,
    type: 'MUST_EXIST_AT_VERSION',
    recordVersion,
  };
}

function command(
  operationType: AuthorityOperationType,
  payload: unknown,
  precondition: unknown,
  suffix: string,
  overrides: Readonly<Record<string, unknown>> = {},
): AuthorityAdministrativeCommandV1 {
  return createAuthorityAdministrativeCommandV1({
    schemaVersion: AUTHORITY_COMMAND_VERSION,
    operationType,
    operationId: operationId(suffix),
    idempotencyKey: idempotencyKey(suffix),
    actor: ACTOR,
    requestedAt: REQUESTED_AT,
    precondition,
    reasonCode: 'ADMINISTRATIVE_CHANGE',
    requestId: `request:runtime:${suffix}`,
    correlationId: `correlation:runtime:${suffix}`,
    payload,
    ...overrides,
  });
}

function createTenantCommand(
  suffix = 'create-tenant',
  tenantId = TENANT_ID,
): AuthorityAdministrativeCommandV1 {
  return command(
    'CREATE_TENANT_AUTHORITY',
    {
      tenantId,
      initialStatus: 'PENDING',
      tenantSlug: `tenant-${suffix.replaceAll(':', '-')}`,
    },
    createOnly(),
    suffix,
  );
}

function principal() {
  return {
    schemaVersion: '1',
    principalId: PRINCIPAL_ID,
    principalType: 'USER',
    authenticationMethod: 'FIREBASE_ID_TOKEN',
    provider: 'FIREBASE_AUTH',
    authenticatedAt: AUTHENTICATED_AT,
  };
}

function context(
  commandValue: AuthorityAdministrativeCommandV1,
  cancellationSignal?: AbortSignal,
): AuthorityRepositoryInvocationContextV1 {
  return createAuthorityRepositoryInvocationContextV1(
    {
      schemaVersion: AUTHORITY_REPOSITORY_INVOCATION_CONTEXT_VERSION,
      principal: principal(),
      actor: ACTOR,
      authorizationDecision: {
        schemaVersion:
          AUTHORITY_REPOSITORY_AUTHORIZATION_DECISION_VERSION,
        decisionVersion:
          AUTHORITY_REPOSITORY_AUTHORIZATION_DECISION_VERSION,
        decision: 'ALLOWED',
        authorizationVersion: 'authority-policy-v1',
        operationTypes: [commandValue.operationType],
        principalType: 'USER',
        principalId: PRINCIPAL_ID,
        actorType: 'USER',
        actorId: PRINCIPAL_ID,
        decidedAt: DECIDED_AT,
        safeReasonCode: 'AUTHORITY_OPERATION_ALLOWED',
      },
      authorizedOperationTypes: [commandValue.operationType],
      consumerId: 'AUTHORITY_RUNTIME_TEST',
      source: 'TRUSTED_RUNTIME_TEST',
      requestId: commandValue.requestId,
      correlationId: commandValue.correlationId,
      initiatedAt: INITIATED_AT,
      authorizationVersion: 'authority-policy-v1',
      ...(cancellationSignal === undefined
        ? {}
        : { cancellationSignal }),
    },
    commandValue,
  );
}

class FixedClock implements AuthorityClockPort {
  calls = 0;
  private readonly value: string;
  private readonly onCall: (() => void) | undefined;

  constructor(
    value = OCCURRED_AT,
    onCall?: () => void,
  ) {
    this.value = value;
    this.onCall = onCall;
  }

  nowIso(): string {
    this.calls += 1;
    this.onCall?.();
    return this.value;
  }
}

class CountingAbortSignal extends EventTarget implements AbortSignal {
  onabort: AbortSignal['onabort'] = null;
  readonly reason: unknown = undefined;
  private reads = 0;

  get aborted(): boolean {
    this.reads += 1;
    return this.reads >= 6;
  }

  throwIfAborted(): void {}
}

function tenantRecord(
  status: TenantAuthorityStatus = 'PENDING',
  recordVersion = 1,
  authorityVersion = recordVersion,
  tenantId = TENANT_ID,
): PersistedTenantAuthorityRecordV1 {
  return createPersistedTenantAuthorityRecordV1(
    {
      schemaVersion: TENANT_AUTHORITY_RECORD_VERSION,
      tenantId,
      status,
      authorityVersion,
      recordVersion,
      createdAt: AUTHENTICATED_AT,
      updatedAt: INITIATED_AT,
      createdBy: ACTOR,
      updatedBy: ACTOR,
      statusChangedAt: INITIATED_AT,
      statusReasonCode: 'TEST_SETUP',
    },
    tenantId,
  );
}

function membershipKey(tenantId = TENANT_ID): string {
  return createAuthorityMembershipKeyV1({
    principalType: 'USER',
    principalId: PRINCIPAL_ID,
    tenantId,
  });
}

function membershipRecord(
  status: TenantMembershipAuthorityStatus = 'ACTIVE',
  roles: readonly string[] = ['TENANT_ADMIN'],
  membershipVersion = 1,
  authorityVersion = membershipVersion,
): PersistedTenantMembershipRecordV1 {
  const key = membershipKey();
  return createPersistedTenantMembershipRecordV1(
    {
      schemaVersion: TENANT_MEMBERSHIP_RECORD_VERSION,
      membershipId: key,
      membershipKey: key,
      principalType: 'USER',
      principalId: PRINCIPAL_ID,
      tenantId: TENANT_ID,
      roles,
      roleVocabularyVersion: AUTHORITY_TENANT_ROLE_VOCABULARY_VERSION,
      status,
      membershipVersion,
      authorityVersion,
      createdAt: AUTHENTICATED_AT,
      updatedAt: INITIATED_AT,
      createdBy: ACTOR,
      updatedBy: ACTOR,
      ...(status === 'REVOKED' || status === 'DELETED'
        ? {
            revokedAt: INITIATED_AT,
            revokedBy: ACTOR,
            revocationReasonCode: 'TEST_REVOCATION',
          }
        : {}),
    },
    key,
  );
}

function aliasRecord(
  status: 'ACTIVE' | 'TOMBSTONED' = 'ACTIVE',
  aliasVersion = 1,
): PersistedTenantAliasRecordV1 {
  const aliasKey = createAuthorityAliasKeyV1({
    aliasType: 'TENANT_SLUG',
    normalizedAlias: 'tenant-runtime',
  });
  return createPersistedTenantAliasRecordV1(
    {
      schemaVersion: TENANT_ALIAS_RECORD_VERSION,
      aliasKey,
      aliasType: 'TENANT_SLUG',
      normalizedAlias: 'tenant-runtime',
      tenantId: TENANT_ID,
      status,
      aliasVersion,
      authorityVersion: aliasVersion,
      createdAt: AUTHENTICATED_AT,
      updatedAt: INITIATED_AT,
      createdBy: ACTOR,
      updatedBy: ACTOR,
      ...(status === 'TOMBSTONED'
        ? {
            tombstonedAt: INITIATED_AT,
            tombstonedBy: ACTOR,
            tombstoneReasonCode: 'TEST_TOMBSTONE',
          }
        : {}),
    },
    aliasKey,
  );
}

function snapshot(
  overrides: Readonly<Record<string, unknown>> = {},
): AuthorityRepositorySnapshotV1 {
  return validateAuthorityRepositorySnapshotV1({
    ...createEmptyAuthorityRepositorySnapshotV1(),
    ...overrides,
  });
}

function tenantSnapshot(
  tenant = tenantRecord(),
): AuthorityRepositorySnapshotV1 {
  return snapshot({
    tenants: [{ documentId: tenant.tenantId, value: tenant }],
  });
}

function membershipSnapshot(
  membership = membershipRecord(),
  tenant = tenantRecord('ACTIVE'),
): AuthorityRepositorySnapshotV1 {
  return snapshot({
    tenants: [{ documentId: tenant.tenantId, value: tenant }],
    memberships: [
      { documentId: membership.membershipKey, value: membership },
    ],
  });
}

function updateTenantCommand(
  currentStatus: TenantAuthorityStatus,
  targetStatus: TenantAuthorityStatus,
  suffix: string,
  recordVersion = 1,
  activationPrerequisite?: unknown,
): AuthorityAdministrativeCommandV1 {
  return command(
    'UPDATE_TENANT_STATUS',
    {
      tenantId: TENANT_ID,
      currentStatus,
      targetStatus,
      ...(activationPrerequisite === undefined
        ? {}
        : { activationPrerequisite }),
    },
    atRecordVersion(recordVersion),
    suffix,
  );
}

function activationPrerequisite(
  roles: readonly string[] = ['TENANT_ADMIN'],
) {
  return {
    schemaVersion: TENANT_ACTIVATION_PREREQUISITE_VERSION,
    tenantId: TENANT_ID,
    tenantCurrentStatus: 'PENDING',
    tenantExpectedRecordVersion: 1,
    membershipKey: membershipKey(),
    membershipPrincipalType: 'USER',
    membershipPrincipalId: PRINCIPAL_ID,
    membershipTenantId: TENANT_ID,
    membershipStatus: 'ACTIVE',
    membershipRoles: roles,
    membershipExpectedVersion: 1,
  };
}

function createMembershipCommand(
  suffix: string,
): AuthorityAdministrativeCommandV1 {
  return command(
    'CREATE_TENANT_MEMBERSHIP',
    {
      principalType: 'USER',
      principalId: PRINCIPAL_ID,
      tenantId: TENANT_ID,
      roles: ['TENANT_ADMIN'],
      initialStatus: 'ACTIVE',
    },
    createOnly(),
    suffix,
  );
}

function rolesCommand(
  roles: readonly string[],
  suffix: string,
  version = 1,
): AuthorityAdministrativeCommandV1 {
  return command(
    'UPDATE_TENANT_MEMBERSHIP_ROLES',
    {
      membershipKey: membershipKey(),
      principalType: 'USER',
      principalId: PRINCIPAL_ID,
      tenantId: TENANT_ID,
      roles,
    },
    atRecordVersion(version),
    suffix,
  );
}

function membershipStatusCommand(
  currentStatus: TenantMembershipAuthorityStatus,
  targetStatus: TenantMembershipAuthorityStatus,
  suffix: string,
  version = 1,
): AuthorityAdministrativeCommandV1 {
  return command(
    'CHANGE_TENANT_MEMBERSHIP_STATUS',
    {
      membershipKey: membershipKey(),
      principalType: 'USER',
      principalId: PRINCIPAL_ID,
      tenantId: TENANT_ID,
      currentStatus,
      targetStatus,
    },
    atRecordVersion(version),
    suffix,
  );
}

function reserveAliasCommand(
  suffix: string,
): AuthorityAdministrativeCommandV1 {
  const aliasKey = createAuthorityAliasKeyV1({
    aliasType: 'TENANT_SLUG',
    normalizedAlias: 'tenant-runtime',
  });
  return command(
    'RESERVE_TENANT_ALIAS',
    {
      aliasKey,
      aliasType: 'TENANT_SLUG',
      normalizedAlias: 'tenant-runtime',
      tenantId: TENANT_ID,
    },
    createOnly(),
    suffix,
  );
}

function tombstoneAliasCommand(
  suffix: string,
  version = 1,
): AuthorityAdministrativeCommandV1 {
  const aliasKey = createAuthorityAliasKeyV1({
    aliasType: 'TENANT_SLUG',
    normalizedAlias: 'tenant-runtime',
  });
  return command(
    'TOMBSTONE_TENANT_ALIAS',
    {
      aliasKey,
      aliasType: 'TENANT_SLUG',
      normalizedAlias: 'tenant-runtime',
      tenantId: TENANT_ID,
    },
    atRecordVersion(version),
    suffix,
  );
}

function legacyFixture() {
  const sourceReference = 'legacy_tenants/sourceRuntime001';
  const aliasKey = createAuthorityAliasKeyV1({
    aliasType: 'LEGACY_TENANT_ID',
    normalizedAlias: 'legacy-runtime-001',
  });
  const canonicalizationInput = {
    schemaVersion: LEGACY_TENANT_CANONICALIZATION_INPUT_VERSION,
    canonicalDocumentId: TENANT_ID,
    classifiedVariant: 'AUTO_ID_WITH_TENANT_SLUG',
    classification: 'CANONICALIZABLE',
    sourceRecordVersion: 'legacy-v1',
    sourceRecordFingerprint: SOURCE_FINGERPRINT,
    canonicalTarget: {
      tenantId: TENANT_ID,
      status: 'PENDING',
      tenantSlug: 'tenant-runtime',
    },
    aliasesToReserve: [
      {
        aliasKey,
        aliasType: 'LEGACY_TENANT_ID',
        normalizedAlias: 'legacy-runtime-001',
        tenantId: TENANT_ID,
      },
    ],
    migrationMetadata: {
      schemaVersion: '1',
      authorityUse: 'PROHIBITED',
      migrationVersion: 'migration-v1',
      sourceSystem: 'LEGACY_TENANTS',
      sourceReference,
      classifiedVariant: 'AUTO_ID_WITH_TENANT_SLUG',
      migrationStatus: 'VALIDATED',
      validatedAt: REQUESTED_AT,
    },
    conflictDisposition: 'NONE',
  };
  const commandValue = command(
    'CANONICALIZE_LEGACY_TENANT',
    { canonicalizationInput },
    atRecordVersion(1),
    'canonicalize',
  );
  const source = {
    schemaVersion: AUTHORITY_LEGACY_SOURCE_RECORD_VERSION,
    sourceReference,
    recordVersion: 1,
    sourceRecordVersion: 'legacy-v1',
    sourceRecordFingerprint: SOURCE_FINGERPRINT,
    classifiedVariant: 'AUTO_ID_WITH_TENANT_SLUG',
    authorityUse: 'PROHIBITED',
  };
  return {
    commandValue,
    sourceReference,
    source,
    aliasKey,
    canonicalizationInput,
  };
}

describe('authority mutation runtime', () => {
  it('1 accepts an empty repository snapshot', () => {
    expect(createEmptyAuthorityRepositorySnapshotV1().tenants).toEqual(
      [],
    );
  });

  it('2 rejects duplicate repository documents', () => {
    const tenant = tenantRecord();
    expect(() =>
      snapshot({
        tenants: [
          { documentId: TENANT_ID, value: tenant },
          { documentId: TENANT_ID, value: tenant },
        ],
      }),
    ).toThrow(AuthorityPersistenceContractError);
  });

  it('2b rejects a snapshot document ID mismatch', () => {
    expect(() =>
      snapshot({
        tenants: [
          {
            documentId: 'tenantRuntimeOther',
            value: tenantRecord(),
          },
        ],
      }),
    ).toThrow(AuthorityPersistenceContractError);
  });

  it('3 clones, canonically sorts, and freezes snapshots', () => {
    const left = tenantRecord('PENDING', 1, 1, 'tenantRuntime002');
    const right = tenantRecord('PENDING', 1, 1, 'tenantRuntime001');
    const result = snapshot({
      tenants: [
        { documentId: left.tenantId, value: left },
        { documentId: right.tenantId, value: right },
      ],
    });
    expect(result.tenants.map((entry) => entry.documentId)).toEqual([
      'tenantRuntime001',
      'tenantRuntime002',
    ]);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.tenants)).toBe(true);
  });

  it('4 plans without mutating the input snapshot', () => {
    const initial = createEmptyAuthorityRepositorySnapshotV1();
    const before = structuredClone(initial);
    const commandValue = createTenantCommand();
    planAuthorityMutationV1(
      commandValue,
      context(commandValue),
      initial,
      OCCURRED_AT,
    );
    expect(initial).toEqual(before);
  });

  it('5 creates a tenant with versions starting at one', async () => {
    const commandValue = createTenantCommand();
    const repository = new InMemoryAuthorityMutationRepository(
      createEmptyAuthorityRepositorySnapshotV1(),
      new FixedClock(),
    );
    const result = await repository.execute(
      commandValue,
      context(commandValue),
    );
    expect(result).toMatchObject({
      status: 'APPLIED',
      safeCode: 'TENANT_CREATED',
      resultingVersion: 1,
    });
    expect(repository.getSnapshotForTesting().tenants[0]?.value).toMatchObject(
      { status: 'PENDING', recordVersion: 1, authorityVersion: 1 },
    );
  });

  it('6 returns conflict for a duplicate tenant', async () => {
    const commandValue = createTenantCommand();
    const repository = new InMemoryAuthorityMutationRepository(
      tenantSnapshot(),
      new FixedClock(),
    );
    expect(
      await repository.execute(commandValue, context(commandValue)),
    ).toMatchObject({ status: 'CONFLICT', safeCode: 'TENANT_ALREADY_EXISTS' });
  });

  it('7 replays an exact completed tenant result', async () => {
    const commandValue = createTenantCommand();
    const repository = new InMemoryAuthorityMutationRepository(
      createEmptyAuthorityRepositorySnapshotV1(),
      new FixedClock(),
    );
    const first = await repository.execute(
      commandValue,
      context(commandValue),
    );
    const replay = await repository.execute(
      commandValue,
      context(commandValue),
    );
    expect(replay).toEqual(first);
  });

  it('8 conflicts when an idempotency key has another fingerprint', async () => {
    const original = createTenantCommand('same-key-one');
    const repository = new InMemoryAuthorityMutationRepository(
      createEmptyAuthorityRepositorySnapshotV1(),
      new FixedClock(),
    );
    await repository.execute(original, context(original));
    const changed = createTenantCommand(
      'same-key-two',
      'tenantRuntime002',
    );
    const reusedKey = command(
      changed.operationType,
      changed.payload,
      changed.precondition,
      'same-key-two',
      { idempotencyKey: original.idempotencyKey },
    );
    expect(
      await repository.execute(reusedKey, context(reusedKey)),
    ).toMatchObject({
      status: 'CONFLICT',
      safeCode: 'IDEMPOTENCY_KEY_CONFLICT',
    });
  });

  it('9 conflicts when operationId is rebound to another key', async () => {
    const original = createTenantCommand('same-operation-one');
    const repository = new InMemoryAuthorityMutationRepository(
      createEmptyAuthorityRepositorySnapshotV1(),
      new FixedClock(),
    );
    await repository.execute(original, context(original));
    const changed = createTenantCommand(
      'same-operation-two',
      'tenantRuntime002',
    );
    const rebound = command(
      changed.operationType,
      changed.payload,
      changed.precondition,
      'same-operation-two',
      { operationId: original.operationId },
    );
    expect(
      await repository.execute(rebound, context(rebound)),
    ).toMatchObject({
      status: 'CONFLICT',
      safeCode: 'OPERATION_ID_CONFLICT',
    });
  });

  it('10 updates tenant status and increments exactly once', async () => {
    const commandValue = updateTenantCommand(
      'PENDING',
      'DEACTIVATED',
      'tenant-deactivate',
    );
    const repository = new InMemoryAuthorityMutationRepository(
      tenantSnapshot(),
      new FixedClock(),
    );
    expect(
      await repository.execute(commandValue, context(commandValue)),
    ).toMatchObject({ status: 'APPLIED', resultingVersion: 2 });
    expect(repository.getSnapshotForTesting().tenants[0]?.value).toMatchObject(
      { status: 'DEACTIVATED', recordVersion: 2, authorityVersion: 2 },
    );
  });

  it('11 rejects a stale tenant version with a conflict', async () => {
    const commandValue = updateTenantCommand(
      'PENDING',
      'DEACTIVATED',
      'tenant-stale',
      2,
    );
    const repository = new InMemoryAuthorityMutationRepository(
      tenantSnapshot(),
      new FixedClock(),
    );
    expect(
      await repository.execute(commandValue, context(commandValue)),
    ).toMatchObject({ status: 'CONFLICT', safeCode: 'STALE_TENANT_VERSION' });
  });

  it('12 treats an invalid tenant transition as a contract error', () => {
    expect(() =>
      updateTenantCommand('PENDING', 'SUSPENDED', 'invalid-transition'),
    ).toThrow(AuthorityPersistenceContractError);
  });

  it('13 activates with the exact administrative prerequisite', async () => {
    const commandValue = updateTenantCommand(
      'PENDING',
      'ACTIVE',
      'tenant-activate',
      1,
      activationPrerequisite(),
    );
    const repository = new InMemoryAuthorityMutationRepository(
      membershipSnapshot(membershipRecord(), tenantRecord()),
      new FixedClock(),
    );
    expect(
      await repository.execute(commandValue, context(commandValue)),
    ).toMatchObject({ status: 'APPLIED', resultingVersion: 2 });
  });

  it('14 rejects activation when stored membership lacks admin', async () => {
    const commandValue = updateTenantCommand(
      'PENDING',
      'ACTIVE',
      'tenant-activate-reject',
      1,
      activationPrerequisite(),
    );
    const repository = new InMemoryAuthorityMutationRepository(
      membershipSnapshot(
        membershipRecord('ACTIVE', ['TENANT_OPERATOR']),
        tenantRecord(),
      ),
      new FixedClock(),
    );
    expect(
      await repository.execute(commandValue, context(commandValue)),
    ).toMatchObject({
      status: 'REJECTED',
      safeCode: 'TENANT_ACTIVATION_PREREQUISITE_NOT_MET',
    });
  });

  it('15 keeps a deleted tenant terminal for child writes', async () => {
    const commandValue = createMembershipCommand('deleted-tenant');
    const repository = new InMemoryAuthorityMutationRepository(
      tenantSnapshot(tenantRecord('DELETED')),
      new FixedClock(),
    );
    expect(
      await repository.execute(commandValue, context(commandValue)),
    ).toMatchObject({ status: 'REJECTED', safeCode: 'TENANT_DELETED' });
  });

  it('16 creates a membership', async () => {
    const commandValue = createMembershipCommand('create-membership');
    const repository = new InMemoryAuthorityMutationRepository(
      tenantSnapshot(tenantRecord('ACTIVE')),
      new FixedClock(),
    );
    expect(
      await repository.execute(commandValue, context(commandValue)),
    ).toMatchObject({ status: 'APPLIED', safeCode: 'MEMBERSHIP_CREATED' });
  });

  it('17 conflicts on duplicate membership', async () => {
    const commandValue = createMembershipCommand('duplicate-membership');
    const repository = new InMemoryAuthorityMutationRepository(
      membershipSnapshot(),
      new FixedClock(),
    );
    expect(
      await repository.execute(commandValue, context(commandValue)),
    ).toMatchObject({
      status: 'CONFLICT',
      safeCode: 'MEMBERSHIP_ALREADY_EXISTS',
    });
  });

  it('18 rejects a membership key mismatch contractually', () => {
    expect(() =>
      command(
        'UPDATE_TENANT_MEMBERSHIP_ROLES',
        {
          membershipKey: 'invalidMembershipKey',
          principalType: 'USER',
          principalId: PRINCIPAL_ID,
          tenantId: TENANT_ID,
          roles: ['TENANT_ADMIN'],
        },
        atRecordVersion(1),
        'membership-key-mismatch',
      ),
    ).toThrow(AuthorityPersistenceContractError);
  });

  it('19 updates normalized membership roles', async () => {
    const commandValue = rolesCommand(
      ['TENANT_OPERATOR', 'TENANT_ADMIN'],
      'roles-update',
    );
    const repository = new InMemoryAuthorityMutationRepository(
      membershipSnapshot(),
      new FixedClock(),
    );
    expect(
      await repository.execute(commandValue, context(commandValue)),
    ).toMatchObject({ status: 'APPLIED', resultingVersion: 2 });
  });

  it('20 returns NO_OP for semantically equal roles', async () => {
    const commandValue = rolesCommand(
      ['TENANT_ADMIN'],
      'roles-no-op',
    );
    const repository = new InMemoryAuthorityMutationRepository(
      membershipSnapshot(),
      new FixedClock(),
    );
    expect(
      await repository.execute(commandValue, context(commandValue)),
    ).toMatchObject({ status: 'NO_OP', resultingVersion: 1 });
  });

  it('21 does not increment or emit events for a roles NO_OP', async () => {
    const commandValue = rolesCommand(
      ['TENANT_ADMIN'],
      'roles-no-increment',
    );
    const repository = new InMemoryAuthorityMutationRepository(
      membershipSnapshot(),
      new FixedClock(),
    );
    await repository.execute(commandValue, context(commandValue));
    const state = repository.getSnapshotForTesting();
    expect(state.memberships[0]?.value.authorityVersion).toBe(1);
    expect(state.auditEvents).toHaveLength(0);
  });

  it('22 suspends membership authority', async () => {
    const commandValue = membershipStatusCommand(
      'ACTIVE',
      'SUSPENDED',
      'membership-suspend',
    );
    const repository = new InMemoryAuthorityMutationRepository(
      membershipSnapshot(),
      new FixedClock(),
    );
    expect(
      await repository.execute(commandValue, context(commandValue)),
    ).toMatchObject({ status: 'APPLIED', resultingVersion: 2 });
  });

  it('23 reactivates suspended membership authority', async () => {
    const commandValue = membershipStatusCommand(
      'SUSPENDED',
      'ACTIVE',
      'membership-reactivate',
    );
    const repository = new InMemoryAuthorityMutationRepository(
      membershipSnapshot(membershipRecord('SUSPENDED')),
      new FixedClock(),
    );
    expect(
      await repository.execute(commandValue, context(commandValue)),
    ).toMatchObject({ status: 'APPLIED' });
  });

  it('24 completes revocation fields from the command context', async () => {
    const commandValue = membershipStatusCommand(
      'ACTIVE',
      'REVOKED',
      'membership-revoke',
    );
    const repository = new InMemoryAuthorityMutationRepository(
      membershipSnapshot(),
      new FixedClock(),
    );
    await repository.execute(commandValue, context(commandValue));
    expect(
      repository.getSnapshotForTesting().memberships[0]?.value,
    ).toMatchObject({
      status: 'REVOKED',
      revokedAt: OCCURRED_AT,
      revokedBy: ACTOR,
      revocationReasonCode: 'ADMINISTRATIVE_CHANGE',
    });
  });

  it('25 deletes only a previously revoked membership', async () => {
    const commandValue = membershipStatusCommand(
      'REVOKED',
      'DELETED',
      'membership-delete',
    );
    const repository = new InMemoryAuthorityMutationRepository(
      membershipSnapshot(membershipRecord('REVOKED')),
      new FixedClock(),
    );
    await repository.execute(commandValue, context(commandValue));
    expect(
      repository.getSnapshotForTesting().memberships[0]?.value.status,
    ).toBe('DELETED');
  });

  it('26 rejects invalid membership transitions contractually', () => {
    expect(() =>
      membershipStatusCommand(
        'ACTIVE',
        'DELETED',
        'invalid-membership-transition',
      ),
    ).toThrow(AuthorityPersistenceContractError);
  });

  it('27 reserves an active alias', async () => {
    const commandValue = reserveAliasCommand('reserve-alias');
    const repository = new InMemoryAuthorityMutationRepository(
      tenantSnapshot(tenantRecord('ACTIVE')),
      new FixedClock(),
    );
    expect(
      await repository.execute(commandValue, context(commandValue)),
    ).toMatchObject({ status: 'APPLIED', safeCode: 'ALIAS_RESERVED' });
  });

  it('28 conflicts on an alias collision', async () => {
    const commandValue = reserveAliasCommand('alias-collision');
    const repository = new InMemoryAuthorityMutationRepository(
      snapshot({
        tenants: [{ documentId: TENANT_ID, value: tenantRecord('ACTIVE') }],
        aliases: [
          {
            documentId: aliasRecord().aliasKey,
            value: aliasRecord(),
          },
        ],
      }),
      new FixedClock(),
    );
    expect(
      await repository.execute(commandValue, context(commandValue)),
    ).toMatchObject({ status: 'CONFLICT', safeCode: 'ALIAS_COLLISION' });
  });

  it('29 tombstones an owned alias', async () => {
    const commandValue = tombstoneAliasCommand('tombstone-alias');
    const repository = new InMemoryAuthorityMutationRepository(
      snapshot({
        aliases: [
          {
            documentId: aliasRecord().aliasKey,
            value: aliasRecord(),
          },
        ],
      }),
      new FixedClock(),
    );
    expect(
      await repository.execute(commandValue, context(commandValue)),
    ).toMatchObject({ status: 'APPLIED', safeCode: 'ALIAS_TOMBSTONED' });
  });

  it('30 never reactivates a tombstoned alias', async () => {
    const commandValue = tombstoneAliasCommand(
      'tombstone-no-reactivate',
      2,
    );
    const tombstoned = aliasRecord('TOMBSTONED', 2);
    const repository = new InMemoryAuthorityMutationRepository(
      snapshot({
        aliases: [
          { documentId: tombstoned.aliasKey, value: tombstoned },
        ],
      }),
      new FixedClock(),
    );
    expect(
      await repository.execute(commandValue, context(commandValue)),
    ).toMatchObject({ status: 'NO_OP', safeCode: 'ALIAS_ALREADY_TOMBSTONED' });
    expect(
      repository.getSnapshotForTesting().aliases[0]?.value.status,
    ).toBe('TOMBSTONED');
  });

  it('31 canonicalizes a validated legacy source', async () => {
    const fixture = legacyFixture();
    const repository = new InMemoryAuthorityMutationRepository(
      snapshot({
        legacyTenantSources: [
          {
            documentId: fixture.sourceReference,
            value: fixture.source,
          },
        ],
      }),
      new FixedClock(),
    );
    expect(
      await repository.execute(
        fixture.commandValue,
        context(fixture.commandValue),
      ),
    ).toMatchObject({
      status: 'APPLIED',
      safeCode: 'LEGACY_TENANT_CANONICALIZED',
    });
    const state = repository.getSnapshotForTesting();
    expect(state.tenants[0]?.value.migrationState).toMatchObject({
      authorityUse: 'PROHIBITED',
      migrationStatus: 'APPLIED',
    });
    expect(state.aliases).toHaveLength(1);
  });

  it('32 rejects a review-required canonicalization contract', () => {
    const fixture = legacyFixture();
    expect(() =>
      command(
        'CANONICALIZE_LEGACY_TENANT',
        {
          canonicalizationInput: {
            ...fixture.canonicalizationInput,
            classifiedVariant: 'CONFLICTING_STATUS_FIELDS',
            classification: 'REQUIRES_REVIEW',
            conflictDisposition: 'REQUIRE_REVIEW',
            migrationMetadata: {
              ...fixture.canonicalizationInput.migrationMetadata,
              classifiedVariant: 'CONFLICTING_STATUS_FIELDS',
            },
          },
        },
        atRecordVersion(1),
        'canonicalize-review',
      ),
    ).toThrow(AuthorityPersistenceContractError);
  });

  it('33 rejects canonicalization alias collision without partial writes', async () => {
    const fixture = legacyFixture();
    const collision = createPersistedTenantAliasRecordV1(
      {
        schemaVersion: TENANT_ALIAS_RECORD_VERSION,
        aliasKey: fixture.aliasKey,
        aliasType: 'LEGACY_TENANT_ID',
        normalizedAlias: 'legacy-runtime-001',
        tenantId: 'tenantRuntimeOther',
        status: 'ACTIVE',
        aliasVersion: 1,
        authorityVersion: 1,
        createdAt: AUTHENTICATED_AT,
        updatedAt: INITIATED_AT,
        createdBy: ACTOR,
        updatedBy: ACTOR,
      },
      fixture.aliasKey,
    );
    const repository = new InMemoryAuthorityMutationRepository(
      snapshot({
        legacyTenantSources: [
          {
            documentId: fixture.sourceReference,
            value: fixture.source,
          },
        ],
        aliases: [{ documentId: fixture.aliasKey, value: collision }],
      }),
      new FixedClock(),
    );
    expect(
      await repository.execute(
        fixture.commandValue,
        context(fixture.commandValue),
      ),
    ).toMatchObject({ status: 'CONFLICT', safeCode: 'ALIAS_COLLISION' });
    expect(repository.getSnapshotForTesting().tenants).toHaveLength(0);
  });

  it('34 generates audit in the same atomic snapshot', async () => {
    const commandValue = createTenantCommand('atomic-audit');
    const repository = new InMemoryAuthorityMutationRepository(
      createEmptyAuthorityRepositorySnapshotV1(),
      new FixedClock(),
    );
    await repository.execute(commandValue, context(commandValue));
    expect(repository.getSnapshotForTesting().auditEvents).toHaveLength(1);
  });

  it('35 generates outbox in the same atomic snapshot', async () => {
    const commandValue = createTenantCommand('atomic-outbox');
    const repository = new InMemoryAuthorityMutationRepository(
      createEmptyAuthorityRepositorySnapshotV1(),
      new FixedClock(),
    );
    await repository.execute(commandValue, context(commandValue));
    expect(repository.getSnapshotForTesting().outboxEvents).toHaveLength(1);
  });

  it('36 generates a PENDING delivery record', async () => {
    const commandValue = createTenantCommand('atomic-delivery');
    const repository = new InMemoryAuthorityMutationRepository(
      createEmptyAuthorityRepositorySnapshotV1(),
      new FixedClock(),
    );
    await repository.execute(commandValue, context(commandValue));
    expect(
      repository.getSnapshotForTesting().outboxDeliveryRecords[0]?.value,
    ).toMatchObject({
      deliveryStatus: 'PENDING',
      attemptCount: 0,
      availableAt: OCCURRED_AT,
    });
  });

  it('37 rejects stale apply atomically without mutating the source', () => {
    const commandValue = createTenantCommand('atomic-apply');
    const initial = createEmptyAuthorityRepositorySnapshotV1();
    const plan = planAuthorityMutationV1(
      commandValue,
      context(commandValue),
      initial,
      OCCURRED_AT,
    );
    const changed = tenantSnapshot();
    expect(() =>
      applyAuthorityMutationPlanV1(changed, plan),
    ).toThrow(AuthorityPersistenceContractError);
    expect(changed.auditEvents).toHaveLength(0);
  });

  it('38 cancels before planning without persistence', async () => {
    const controller = new AbortController();
    controller.abort();
    const commandValue = createTenantCommand('cancel-before-plan');
    const repository = new InMemoryAuthorityMutationRepository(
      createEmptyAuthorityRepositorySnapshotV1(),
      new FixedClock(),
    );
    expect(
      await repository.execute(
        commandValue,
        context(commandValue, controller.signal),
      ),
    ).toMatchObject({ status: 'REJECTED', safeCode: 'OPERATION_CANCELLED' });
    expect(repository.getSnapshotForTesting().idempotencyRecords).toHaveLength(
      0,
    );
  });

  it('39 cancels at the pre-apply check without persistence', async () => {
    const signal = new CountingAbortSignal();
    const commandValue = createTenantCommand('cancel-before-apply');
    const repository = new InMemoryAuthorityMutationRepository(
      createEmptyAuthorityRepositorySnapshotV1(),
      new FixedClock(),
    );
    expect(
      await repository.execute(
        commandValue,
        context(commandValue, signal),
      ),
    ).toMatchObject({ status: 'REJECTED', safeCode: 'OPERATION_CANCELLED' });
    expect(repository.getSnapshotForTesting().tenants).toHaveLength(0);
  });

  it('40 calls the injected clock exactly once per execution', async () => {
    const clock = new FixedClock();
    const commandValue = createTenantCommand('clock-once');
    const repository = new InMemoryAuthorityMutationRepository(
      createEmptyAuthorityRepositorySnapshotV1(),
      clock,
    );
    await repository.execute(commandValue, context(commandValue));
    expect(clock.calls).toBe(1);
  });

  it('41 produces deterministic plans', () => {
    const commandValue = createTenantCommand('deterministic-plan');
    const initial = createEmptyAuthorityRepositorySnapshotV1();
    expect(
      planAuthorityMutationV1(
        commandValue,
        context(commandValue),
        initial,
        OCCURRED_AT,
      ),
    ).toEqual(
      planAuthorityMutationV1(
        commandValue,
        context(commandValue),
        initial,
        OCCURRED_AT,
      ),
    );
  });

  it('42 produces deterministic event IDs', () => {
    const commandValue = createTenantCommand('deterministic-events');
    const first = planAuthorityMutationV1(
      commandValue,
      context(commandValue),
      createEmptyAuthorityRepositorySnapshotV1(),
      OCCURRED_AT,
    );
    const second = planAuthorityMutationV1(
      commandValue,
      context(commandValue),
      createEmptyAuthorityRepositorySnapshotV1(),
      OCCURRED_AT,
    );
    expect(first.auditEvents[0]?.documentId).toBe(
      second.auditEvents[0]?.documentId,
    );
    expect(first.outboxEvents[0]?.documentId).toBe(
      second.outboxEvents[0]?.documentId,
    );
  });

  it('43 can reuse a frozen snapshot for independent plans', () => {
    const initial = createEmptyAuthorityRepositorySnapshotV1();
    const first = createTenantCommand('snapshot-reuse-one', 'tenantReuse001');
    const second = createTenantCommand('snapshot-reuse-two', 'tenantReuse002');
    expect(
      planAuthorityMutationV1(first, context(first), initial, OCCURRED_AT)
        .planStatus,
    ).toBe('APPLY');
    expect(
      planAuthorityMutationV1(second, context(second), initial, OCCURRED_AT)
        .planStatus,
    ).toBe('APPLY');
  });

  it('44 reuses one repository across sequential operations', async () => {
    const repository = new InMemoryAuthorityMutationRepository(
      createEmptyAuthorityRepositorySnapshotV1(),
      new FixedClock(),
    );
    const first = createTenantCommand('repo-reuse-one', 'tenantReuse001');
    const second = createTenantCommand('repo-reuse-two', 'tenantReuse002');
    await repository.execute(first, context(first));
    await repository.execute(second, context(second));
    expect(repository.getSnapshotForTesting().tenants).toHaveLength(2);
  });

  it('45 deterministically conflicts the second stale update', async () => {
    const repository = new InMemoryAuthorityMutationRepository(
      tenantSnapshot(),
      new FixedClock(),
    );
    const first = updateTenantCommand(
      'PENDING',
      'DEACTIVATED',
      'concurrent-first',
    );
    const second = updateTenantCommand(
      'PENDING',
      'DEACTIVATED',
      'concurrent-second',
    );
    expect(
      await repository.execute(first, context(first)),
    ).toMatchObject({ status: 'APPLIED' });
    expect(
      await repository.execute(second, context(second)),
    ).toMatchObject({ status: 'CONFLICT' });
  });

  it('46 recovers the exact response after a simulated lost response', async () => {
    const commandValue = createTenantCommand('lost-response');
    const repository = new InMemoryAuthorityMutationRepository(
      createEmptyAuthorityRepositorySnapshotV1(),
      new FixedClock(),
    );
    const lost = await repository.execute(
      commandValue,
      context(commandValue),
    );
    expect(
      await repository.execute(commandValue, context(commandValue)),
    ).toEqual(lost);
  });

  it('47 replay creates no additional audit event', async () => {
    const commandValue = createTenantCommand('replay-no-audit');
    const repository = new InMemoryAuthorityMutationRepository(
      createEmptyAuthorityRepositorySnapshotV1(),
      new FixedClock(),
    );
    await repository.execute(commandValue, context(commandValue));
    await repository.execute(commandValue, context(commandValue));
    expect(repository.getSnapshotForTesting().auditEvents).toHaveLength(1);
  });

  it('48 replay does not increment authority version', async () => {
    const commandValue = createTenantCommand('replay-no-version');
    const repository = new InMemoryAuthorityMutationRepository(
      createEmptyAuthorityRepositorySnapshotV1(),
      new FixedClock(),
    );
    await repository.execute(commandValue, context(commandValue));
    await repository.execute(commandValue, context(commandValue));
    expect(
      repository.getSnapshotForTesting().tenants[0]?.value.authorityVersion,
    ).toBe(1);
  });

  it('49 returns RETRY_AFTER_READ only for conflicts', async () => {
    const commandValue = createTenantCommand('retry-disposition');
    const repository = new InMemoryAuthorityMutationRepository(
      tenantSnapshot(),
      new FixedClock(),
    );
    expect(
      await repository.execute(commandValue, context(commandValue)),
    ).toMatchObject({
      status: 'CONFLICT',
      retryDisposition: 'RETRY_AFTER_READ',
    });
  });

  it('50 sanitizes unexpected internal failures', async () => {
    const commandValue = createTenantCommand('internal-error');
    const repository = new InMemoryAuthorityMutationRepository(
      createEmptyAuthorityRepositorySnapshotV1(),
      {
        nowIso() {
          throw new Error('sensitive internal detail');
        },
      },
    );
    const result = await repository.execute(
      commandValue,
      context(commandValue),
    );
    expect(result).toEqual({
      schemaVersion: '1',
      operationId: commandValue.operationId,
      correlationId: commandValue.correlationId,
      status: 'INTERNAL_ERROR',
      safeCode: 'AUTHORITY_REPOSITORY_INTERNAL_ERROR',
      completedAt: REQUESTED_AT,
      retryDisposition: 'SAFE_TO_RETRY_WITH_SAME_IDEMPOTENCY_KEY',
    });
  });

  it('51 always returns a frozen result', async () => {
    const commandValue = createTenantCommand('frozen-result');
    const repository = new InMemoryAuthorityMutationRepository(
      createEmptyAuthorityRepositorySnapshotV1(),
      new FixedClock(),
    );
    expect(
      Object.isFrozen(
        await repository.execute(commandValue, context(commandValue)),
      ),
    ).toBe(true);
  });

  it('52 ignores caller mutation after construction', () => {
    const mutable: {
      schemaVersion: string;
      tenants: unknown[];
      memberships: unknown[];
      aliases: unknown[];
      legacyTenantSources: unknown[];
      idempotencyRecords: unknown[];
      operationBindings: unknown[];
      auditEvents: unknown[];
      outboxEvents: unknown[];
      outboxDeliveryRecords: unknown[];
    } = {
      schemaVersion: AUTHORITY_REPOSITORY_SNAPSHOT_VERSION,
      tenants: [],
      memberships: [],
      aliases: [],
      legacyTenantSources: [],
      idempotencyRecords: [],
      operationBindings: [],
      auditEvents: [],
      outboxEvents: [],
      outboxDeliveryRecords: [],
    };
    const repository = new InMemoryAuthorityMutationRepository(
      mutable,
      new FixedClock(),
    );
    mutable.tenants.push({ documentId: 'callerMutation' });
    expect(repository.getSnapshotForTesting().tenants).toHaveLength(0);
  });

  it('53 never exposes mutable repository state', () => {
    const repository = new InMemoryAuthorityMutationRepository(
      tenantSnapshot(),
      new FixedClock(),
    );
    const returned = repository.getSnapshotForTesting();
    expect(Object.isFrozen(returned)).toBe(true);
    expect(Object.isFrozen(returned.tenants)).toBe(true);
    expect(Reflect.set(returned.tenants, '0', undefined)).toBe(false);
    expect(repository.getSnapshotForTesting().tenants).toHaveLength(1);
  });
});
