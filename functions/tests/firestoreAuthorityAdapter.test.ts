import fs from "node:fs";
import path from "node:path";
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";
import {
  deleteApp,
  initializeApp,
  type App,
} from "firebase-admin/app";
import {
  getFirestore,
  type Firestore,
} from "firebase-admin/firestore";
import {
  AUTHORITY_COMMAND_VERSION,
  AUTHORITY_LEGACY_TENANT_SOURCE_DESCRIPTOR_VERSION,
  AUTHORITY_LEGACY_TENANT_SOURCE_LOCATOR_VERSION,
  AUTHORITY_MIGRATION_METADATA_VERSION,
  AUTHORITY_REPOSITORY_AUTHORIZATION_DECISION_VERSION,
  AUTHORITY_REPOSITORY_INVOCATION_CONTEXT_VERSION,
  AUTHORITY_TENANT_ROLE_VOCABULARY_VERSION,
  AUTHORITY_WRITE_PRECONDITION_VERSION,
  LEGACY_TENANT_CANONICALIZATION_INPUT_VERSION,
  TENANT_ACTIVATION_PREREQUISITE_VERSION,
  TENANT_ALIAS_RECORD_VERSION,
  TENANT_AUTHORITY_RECORD_VERSION,
  TENANT_MEMBERSHIP_RECORD_VERSION,
  AuthorityPersistenceContractError,
  createAuthorityAdministrativeCommandV1,
  createAuthorityAliasKeyV1,
  createAuthorityAuditEventIdV1,
  createAuthorityMembershipKeyV1,
  createAuthorityRepositoryInvocationContextV1,
  createPersistedTenantAliasRecordV1,
  createPersistedTenantAuthorityRecordV1,
  createPersistedTenantMembershipRecordV1,
  decodeAuthorityLegacyTenantSourceRecordV1,
  type AuthorityAdministrativeCommandV1,
  type AuthorityClockPort,
  type AuthorityLegacyTenantSourceRecordV1,
  type AuthorityMutationRepositoryPort,
  type AuthorityOperationType,
  type AuthorityRepositoryInvocationContextV1,
  type PersistedTenantAliasRecordV1,
  type PersistedTenantAuthorityRecordV1,
  type PersistedTenantMembershipRecordV1,
  type TenantAuthorityStatus,
} from "@aura/intelligence-os/server";

import {
  FirestoreAuthorityMutationRepository,
} from "../src/infrastructure/firestore/authorityPersistence/FirestoreAuthorityMutationRepository";
import {
  FIRESTORE_AUTHORITY_COLLECTIONS,
  type FirestoreAuthorityDocumentLocator,
} from "../src/infrastructure/firestore/authorityPersistence/firestoreAuthorityCollections";
import {
  mapFirestoreAuthorityError,
} from "../src/infrastructure/firestore/authorityPersistence/firestoreAuthorityErrors";
import {
  FirestoreAuthorityExpectedReadError,
  revalidateFirestoreAuthorityExpectedReads,
} from "../src/infrastructure/firestore/authorityPersistence/firestoreAuthorityExpectedReads";
import {
  createFirestoreAuthorityReadSet,
} from "../src/infrastructure/firestore/authorityPersistence/firestoreAuthorityReadSet";
import {
  assembleFirestoreAuthorityReadSnapshot,
  readFirestoreAuthorityDocuments,
} from "../src/infrastructure/firestore/authorityPersistence/firestoreAuthoritySnapshot";
import {
  FirestoreAuthoritySerializationError,
  serializeAuthorityFirestoreDocument,
  type FirestoreAuthorityDocumentData,
} from "../src/infrastructure/firestore/authorityPersistence/firestoreAuthoritySerialization";
import type {
  FirestoreAuthorityReadSnapshot,
  FirestoreAuthorityTransaction,
  FirestoreAuthorityTransactionRunner,
} from "../src/infrastructure/firestore/authorityPersistence/firestoreAuthorityTransaction";

const AUTHENTICATED_AT = "2026-07-30T14:00:00.000Z";
const DECIDED_AT = "2026-07-30T14:01:00.000Z";
const INITIATED_AT = "2026-07-30T14:02:00.000Z";
const REQUESTED_AT = "2026-07-30T14:03:00.000Z";
const OCCURRED_AT = "2026-07-30T14:04:00.000Z";
const PRINCIPAL_ID = "principalFirestore001";
const TENANT_ID = "tenantFirestore001";
const LEGACY_DOCUMENT_ID = "AbCdEfGhIjKlMnOpQrSt";
const ACTOR = Object.freeze({
  actorType: "USER" as const,
  actorId: PRINCIPAL_ID,
});

interface HarnessWrite {
  readonly type: "CREATE" | "UPDATE";
  readonly locator: FirestoreAuthorityDocumentLocator;
  readonly data: FirestoreAuthorityDocumentData;
}

function locatorKey(locator: FirestoreAuthorityDocumentLocator): string {
  return `${locator.collectionPath}/${locator.documentId}`;
}

class HarnessTransaction implements FirestoreAuthorityTransaction {
  readonly #documents: ReadonlyMap<string, FirestoreAuthorityDocumentData>;
  readonly #afterRead: ((readCount: number) => void) | undefined;
  readonly #reads: string[];
  readonly #writes: HarnessWrite[];

  constructor(
    documents: ReadonlyMap<string, FirestoreAuthorityDocumentData>,
    reads: string[],
    writes: HarnessWrite[],
    afterRead?: (readCount: number) => void,
  ) {
    this.#documents = documents;
    this.#reads = reads;
    this.#writes = writes;
    this.#afterRead = afterRead;
  }

  async get(
    locator: FirestoreAuthorityDocumentLocator,
  ): Promise<FirestoreAuthorityReadSnapshot> {
    const key = locatorKey(locator);
    this.#reads.push(key);
    this.#afterRead?.(this.#reads.length);
    const data = this.#documents.get(key);
    return data === undefined
      ? Object.freeze({ exists: false })
      : Object.freeze({ exists: true, data });
  }

  create(
    locator: FirestoreAuthorityDocumentLocator,
    data: FirestoreAuthorityDocumentData,
  ): void {
    this.#writes.push({ type: "CREATE", locator, data });
  }

  update(
    locator: FirestoreAuthorityDocumentLocator,
    data: FirestoreAuthorityDocumentData,
  ): void {
    this.#writes.push({ type: "UPDATE", locator, data });
  }
}

class AtomicTransactionHarness
  implements FirestoreAuthorityTransactionRunner
{
  readonly documents = new Map<string, FirestoreAuthorityDocumentData>();
  readonly attempts: {
    readonly reads: readonly string[];
    readonly writes: readonly HarnessWrite[];
  }[] = [];
  retries = 0;
  commitFirstAttemptAsConcurrent = false;
  beforeAttempt: ((attempt: number) => void) | undefined;
  afterRead: ((readCount: number) => void) | undefined;
  failure: unknown;

  seed(
    collectionPath: FirestoreAuthorityDocumentLocator["collectionPath"],
    documentId: string,
    value: unknown,
  ): void {
    this.documents.set(
      `${collectionPath}/${documentId}`,
      serializeAuthorityFirestoreDocument(value),
    );
  }

  read(
    collectionPath: FirestoreAuthorityDocumentLocator["collectionPath"],
    documentId: string,
  ): FirestoreAuthorityDocumentData | undefined {
    return this.documents.get(`${collectionPath}/${documentId}`);
  }

  private assertCommittable(writes: readonly HarnessWrite[]): void {
    const staged = new Set(this.documents.keys());
    writes.forEach((write) => {
      const key = locatorKey(write.locator);
      if (write.type === "CREATE") {
        if (staged.has(key)) {
          throw Object.freeze({
            code: "already-exists",
            message: "confidential Firestore detail",
          });
        }
        staged.add(key);
      } else if (!staged.has(key)) {
        throw Object.freeze({
          code: "not-found",
          message: "confidential Firestore detail",
        });
      }
    });
  }

  private commit(writes: readonly HarnessWrite[]): void {
    this.assertCommittable(writes);
    writes.forEach((write) => {
      this.documents.set(locatorKey(write.locator), write.data);
    });
  }

  async runTransaction<T>(
    callback: (transaction: FirestoreAuthorityTransaction) => Promise<T>,
  ): Promise<T> {
    if (this.failure !== undefined) {
      throw this.failure;
    }
    for (let attempt = 1; attempt <= this.retries + 1; attempt += 1) {
      this.beforeAttempt?.(attempt);
      const reads: string[] = [];
      const writes: HarnessWrite[] = [];
      const result = await callback(
        new HarnessTransaction(
          this.documents,
          reads,
          writes,
          this.afterRead,
        ),
      );
      this.attempts.push({
        reads: Object.freeze([...reads]),
        writes: Object.freeze([...writes]),
      });
      if (attempt <= this.retries) {
        if (
          attempt === 1 &&
          this.commitFirstAttemptAsConcurrent
        ) {
          this.commit(writes);
        }
        continue;
      }
      this.commit(writes);
      return result;
    }
    throw new Error("Unreachable transaction harness state.");
  }
}

class FixedClock implements AuthorityClockPort {
  calls = 0;
  readonly #onCall: (() => void) | undefined;

  constructor(onCall?: () => void) {
    this.#onCall = onCall;
  }

  nowIso(): string {
    this.calls += 1;
    this.#onCall?.();
    return OCCURRED_AT;
  }
}

let firebaseApp: App;
let firestore: Firestore;

beforeAll(() => {
  firebaseApp = initializeApp(
    { projectId: "authority-adapter-unit-test" },
    "authority-adapter-unit-test",
  );
  firestore = getFirestore(firebaseApp);
});

afterAll(async () => {
  await deleteApp(firebaseApp);
});

function createOnly() {
  return {
    schemaVersion: AUTHORITY_WRITE_PRECONDITION_VERSION,
    type: "MUST_NOT_EXIST",
  };
}

function atRecordVersion(recordVersion: number) {
  return {
    schemaVersion: AUTHORITY_WRITE_PRECONDITION_VERSION,
    type: "MUST_EXIST_AT_VERSION",
    recordVersion,
  };
}

function atAuthorityVersion(authorityVersion: number) {
  return {
    schemaVersion: AUTHORITY_WRITE_PRECONDITION_VERSION,
    type: "MUST_MATCH_AUTHORITY_VERSION",
    authorityVersion,
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
    operationId: `operation:firestore:${suffix}`,
    idempotencyKey: `idempotency:firestore:${suffix}`,
    actor: ACTOR,
    requestedAt: REQUESTED_AT,
    precondition,
    reasonCode: "ADMINISTRATIVE_CHANGE",
    requestId: `request:firestore:${suffix}`,
    correlationId: `correlation:firestore:${suffix}`,
    payload,
    ...overrides,
  });
}

function createTenantCommand(
  suffix = "create-tenant",
  tenantId = TENANT_ID,
  overrides: Readonly<Record<string, unknown>> = {},
): AuthorityAdministrativeCommandV1 {
  return command(
    "CREATE_TENANT_AUTHORITY",
    {
      tenantId,
      initialStatus: "PENDING",
      tenantSlug: `tenant-${suffix}`,
    },
    createOnly(),
    suffix,
    overrides,
  );
}

function context(
  commandValue: AuthorityAdministrativeCommandV1,
  cancellationSignal?: AbortSignal,
): AuthorityRepositoryInvocationContextV1 {
  return createAuthorityRepositoryInvocationContextV1(
    {
      schemaVersion:
        AUTHORITY_REPOSITORY_INVOCATION_CONTEXT_VERSION,
      principal: {
        schemaVersion: "1",
        principalId: PRINCIPAL_ID,
        principalType: "USER",
        authenticationMethod: "FIREBASE_ID_TOKEN",
        provider: "FIREBASE_AUTH",
        authenticatedAt: AUTHENTICATED_AT,
      },
      actor: ACTOR,
      authorizationDecision: {
        schemaVersion:
          AUTHORITY_REPOSITORY_AUTHORIZATION_DECISION_VERSION,
        decisionVersion:
          AUTHORITY_REPOSITORY_AUTHORIZATION_DECISION_VERSION,
        decision: "ALLOWED",
        authorizationVersion: "authority-policy-v1",
        operationTypes: [commandValue.operationType],
        principalType: "USER",
        principalId: PRINCIPAL_ID,
        actorType: "USER",
        actorId: PRINCIPAL_ID,
        decidedAt: DECIDED_AT,
        safeReasonCode: "AUTHORITY_OPERATION_ALLOWED",
      },
      authorizedOperationTypes: [commandValue.operationType],
      consumerId: "AUTHORITY_FIRESTORE_ADAPTER_TEST",
      source: "TRUSTED_FIRESTORE_ADAPTER_TEST",
      requestId: commandValue.requestId,
      correlationId: commandValue.correlationId,
      initiatedAt: INITIATED_AT,
      authorizationVersion: "authority-policy-v1",
      ...(cancellationSignal === undefined
        ? {}
        : { cancellationSignal }),
    },
    commandValue,
  );
}

function repository(
  harness: AtomicTransactionHarness,
  clock = new FixedClock(),
): FirestoreAuthorityMutationRepository {
  return new FirestoreAuthorityMutationRepository(
    firestore,
    clock,
    harness,
  );
}

function tenantRecord(
  status: TenantAuthorityStatus = "PENDING",
  recordVersion = 1,
  authorityVersion = recordVersion,
): PersistedTenantAuthorityRecordV1 {
  return createPersistedTenantAuthorityRecordV1(
    {
      schemaVersion: TENANT_AUTHORITY_RECORD_VERSION,
      tenantId: TENANT_ID,
      status,
      authorityVersion,
      recordVersion,
      createdAt: AUTHENTICATED_AT,
      updatedAt: INITIATED_AT,
      createdBy: ACTOR,
      updatedBy: ACTOR,
      statusChangedAt: INITIATED_AT,
      statusReasonCode: "TEST_SETUP",
    },
    TENANT_ID,
  );
}

function membershipKey(): string {
  return createAuthorityMembershipKeyV1({
    principalType: "USER",
    principalId: PRINCIPAL_ID,
    tenantId: TENANT_ID,
  });
}

function membershipRecord(
  roles: readonly string[] = ["TENANT_ADMIN"],
  membershipVersion = 1,
  authorityVersion = membershipVersion,
): PersistedTenantMembershipRecordV1 {
  const key = membershipKey();
  return createPersistedTenantMembershipRecordV1(
    {
      schemaVersion: TENANT_MEMBERSHIP_RECORD_VERSION,
      membershipId: key,
      membershipKey: key,
      principalType: "USER",
      principalId: PRINCIPAL_ID,
      tenantId: TENANT_ID,
      roles,
      roleVocabularyVersion:
        AUTHORITY_TENANT_ROLE_VOCABULARY_VERSION,
      status: "ACTIVE",
      membershipVersion,
      authorityVersion,
      createdAt: AUTHENTICATED_AT,
      updatedAt: INITIATED_AT,
      createdBy: ACTOR,
      updatedBy: ACTOR,
    },
    key,
  );
}

function aliasKey(): string {
  return createAuthorityAliasKeyV1({
    aliasType: "TENANT_SLUG",
    normalizedAlias: "tenant-firestore",
  });
}

function aliasRecord(
  status: "ACTIVE" | "TOMBSTONED" = "ACTIVE",
  aliasVersion = 1,
): PersistedTenantAliasRecordV1 {
  const key = aliasKey();
  return createPersistedTenantAliasRecordV1(
    {
      schemaVersion: TENANT_ALIAS_RECORD_VERSION,
      aliasKey: key,
      aliasType: "TENANT_SLUG",
      normalizedAlias: "tenant-firestore",
      tenantId: TENANT_ID,
      status,
      aliasVersion,
      authorityVersion: aliasVersion,
      createdAt: AUTHENTICATED_AT,
      updatedAt: INITIATED_AT,
      createdBy: ACTOR,
      updatedBy: ACTOR,
      ...(status === "TOMBSTONED"
        ? {
            tombstonedAt: INITIATED_AT,
            tombstonedBy: ACTOR,
            tombstoneReasonCode: "TEST_TOMBSTONE",
          }
        : {}),
    },
    key,
  );
}

function seedTenant(
  harness: AtomicTransactionHarness,
  tenant = tenantRecord(),
): void {
  harness.seed(
    FIRESTORE_AUTHORITY_COLLECTIONS.TENANTS,
    tenant.tenantId,
    tenant,
  );
}

function seedMembership(
  harness: AtomicTransactionHarness,
  membership = membershipRecord(),
): void {
  harness.seed(
    FIRESTORE_AUTHORITY_COLLECTIONS.MEMBERSHIPS,
    membership.membershipKey,
    membership,
  );
}

function legacySource(
  rawOverrides: Readonly<Record<string, unknown>> = {},
): AuthorityLegacyTenantSourceRecordV1 {
  return decodeAuthorityLegacyTenantSourceRecordV1(
    {
      schemaVersion:
        AUTHORITY_LEGACY_TENANT_SOURCE_DESCRIPTOR_VERSION,
      sourceCollection: "PLATFORM_TENANTS",
      sourceDocumentId: LEGACY_DOCUMENT_ID,
      sourceLocatorVersion:
        AUTHORITY_LEGACY_TENANT_SOURCE_LOCATOR_VERSION,
      authorityUse: "PROHIBITED",
    },
    {
      tenantSlug: "tenant-legacy-firestore",
      status: "PENDING",
      clientId: "client_firestore_001",
      organizationId: "organization_firestore_001",
      recordVersion: 1,
      ...rawOverrides,
    },
    DECIDED_AT,
  );
}

function legacyCommand(
  source = legacySource(),
  suffix = "canonicalize",
): AuthorityAdministrativeCommandV1 {
  const selectedAliasCandidates = source.aliasCandidates.filter(
    (candidate) =>
      candidate.disposition === "RESERVE" &&
      candidate.confidence !== "AMBIGUOUS",
  );
  return command(
    "CANONICALIZE_LEGACY_TENANT",
    {
      canonicalizationInput: {
        schemaVersion:
          LEGACY_TENANT_CANONICALIZATION_INPUT_VERSION,
        canonicalDocumentId: TENANT_ID,
        sourceRecord: source,
        canonicalTarget: {
          tenantId: TENANT_ID,
          status: source.normalizedStatus ?? "PENDING",
          tenantSlug: "tenant-legacy-firestore",
        },
        selectedAliasCandidates,
        migrationMetadata: {
          schemaVersion: AUTHORITY_MIGRATION_METADATA_VERSION,
          authorityUse: "PROHIBITED",
          migrationVersion: "firestore-adapter-v1",
          sourceSystem: "legacy_platform",
          sourceLocatorKey: source.sourceLocator.locatorKey,
          sourceRecordVersion: source.sourceRecordVersion,
          sourceRecordFingerprint: source.sourceRecordFingerprint,
          classifiedVariant: source.classifiedVariant,
          migrationStatus: "VALIDATED",
          validatedAt: DECIDED_AT,
        },
        conflictDisposition: "NONE",
      },
    },
    createOnly(),
    suffix,
  );
}

function updateStatusCommand(
  currentStatus: TenantAuthorityStatus,
  targetStatus: TenantAuthorityStatus,
  suffix: string,
  activationPrerequisite?: unknown,
  precondition: unknown = atRecordVersion(1),
): AuthorityAdministrativeCommandV1 {
  return command(
    "UPDATE_TENANT_STATUS",
    {
      tenantId: TENANT_ID,
      currentStatus,
      targetStatus,
      ...(activationPrerequisite === undefined
        ? {}
        : { activationPrerequisite }),
    },
    precondition,
    suffix,
  );
}

function activationPrerequisite() {
  return {
    schemaVersion: TENANT_ACTIVATION_PREREQUISITE_VERSION,
    tenantId: TENANT_ID,
    tenantCurrentStatus: "PENDING",
    tenantExpectedRecordVersion: 1,
    membershipKey: membershipKey(),
    membershipPrincipalType: "USER",
    membershipPrincipalId: PRINCIPAL_ID,
    membershipTenantId: TENANT_ID,
    membershipStatus: "ACTIVE",
    membershipRoles: ["TENANT_ADMIN"],
    membershipExpectedVersion: 1,
  };
}

function createMembershipCommand(
  suffix = "create-membership",
): AuthorityAdministrativeCommandV1 {
  return command(
    "CREATE_TENANT_MEMBERSHIP",
    {
      principalType: "USER",
      principalId: PRINCIPAL_ID,
      tenantId: TENANT_ID,
      roles: ["TENANT_ADMIN"],
      initialStatus: "ACTIVE",
    },
    createOnly(),
    suffix,
  );
}

function rolesCommand(
  roles: readonly string[],
  suffix = "roles",
  precondition: unknown = atRecordVersion(1),
): AuthorityAdministrativeCommandV1 {
  return command(
    "UPDATE_TENANT_MEMBERSHIP_ROLES",
    {
      membershipKey: membershipKey(),
      principalType: "USER",
      principalId: PRINCIPAL_ID,
      tenantId: TENANT_ID,
      roles,
    },
    precondition,
    suffix,
  );
}

function changeMembershipStatusCommand(
  suffix = "membership-status",
  precondition: unknown = atAuthorityVersion(1),
): AuthorityAdministrativeCommandV1 {
  return command(
    "CHANGE_TENANT_MEMBERSHIP_STATUS",
    {
      membershipKey: membershipKey(),
      principalType: "USER",
      principalId: PRINCIPAL_ID,
      tenantId: TENANT_ID,
      currentStatus: "ACTIVE",
      targetStatus: "SUSPENDED",
    },
    precondition,
    suffix,
  );
}

function reserveAliasCommand(
  suffix = "reserve-alias",
): AuthorityAdministrativeCommandV1 {
  return command(
    "RESERVE_TENANT_ALIAS",
    {
      aliasKey: aliasKey(),
      aliasType: "TENANT_SLUG",
      normalizedAlias: "tenant-firestore",
      tenantId: TENANT_ID,
    },
    createOnly(),
    suffix,
  );
}

function tombstoneAliasCommand(
  suffix = "tombstone-alias",
): AuthorityAdministrativeCommandV1 {
  return command(
    "TOMBSTONE_TENANT_ALIAS",
    {
      aliasKey: aliasKey(),
      aliasType: "TENANT_SLUG",
      normalizedAlias: "tenant-firestore",
      tenantId: TENANT_ID,
    },
    atRecordVersion(1),
    suffix,
  );
}

describe("FirestoreAuthorityMutationRepository execution", () => {
  it("implements the repository port and calls the clock exactly once", async () => {
    const harness = new AtomicTransactionHarness();
    const clock = new FixedClock();
    const adapter: AuthorityMutationRepositoryPort = repository(
      harness,
      clock,
    );
    const value = createTenantCommand();

    const result = await adapter.execute(value, context(value));

    expect(result.status).toBe("APPLIED");
    expect(clock.calls).toBe(1);
  });

  it("returns cancellation before clock without opening a transaction", async () => {
    const harness = new AtomicTransactionHarness();
    const clock = new FixedClock();
    const controller = new AbortController();
    controller.abort();
    const value = createTenantCommand("cancel-before-clock");

    const result = await repository(harness, clock).execute(
      value,
      context(value, controller.signal),
    );

    expect(result.safeCode).toBe("OPERATION_CANCELLED");
    expect(clock.calls).toBe(0);
    expect(harness.attempts).toHaveLength(0);
  });

  it("returns cancellation after clock and before transaction", async () => {
    const harness = new AtomicTransactionHarness();
    const controller = new AbortController();
    const clock = new FixedClock(() => controller.abort());
    const value = createTenantCommand("cancel-before-transaction");

    const result = await repository(harness, clock).execute(
      value,
      context(value, controller.signal),
    );

    expect(result.safeCode).toBe("OPERATION_CANCELLED");
    expect(clock.calls).toBe(1);
    expect(harness.attempts).toHaveLength(0);
  });

  it("cancels at the start of a retry and commits no writes", async () => {
    const harness = new AtomicTransactionHarness();
    const controller = new AbortController();
    harness.retries = 1;
    harness.beforeAttempt = (attempt) => {
      if (attempt === 2) controller.abort();
    };
    const value = createTenantCommand("cancel-retry");

    const result = await repository(harness).execute(
      value,
      context(value, controller.signal),
    );

    expect(result.safeCode).toBe("OPERATION_CANCELLED");
    expect(harness.documents.size).toBe(0);
  });

  it("observes cancellation after exact reads and before write scheduling", async () => {
    const harness = new AtomicTransactionHarness();
    const controller = new AbortController();
    harness.afterRead = (readCount) => {
      if (readCount === 3) controller.abort();
    };
    const value = createTenantCommand("cancel-after-reads");

    const result = await repository(harness).execute(
      value,
      context(value, controller.signal),
    );

    expect(result.safeCode).toBe("OPERATION_CANCELLED");
    expect(harness.documents.size).toBe(0);
    expect(harness.attempts).toHaveLength(0);
  });

  it("reads only ledger and tenant documents, then atomically creates all plan records", async () => {
    const harness = new AtomicTransactionHarness();
    const value = createTenantCommand("exact-create");

    const result = await repository(harness).execute(
      value,
      context(value),
    );

    expect(result.status).toBe("APPLIED");
    expect(harness.attempts[0]?.reads).toEqual([
      expect.stringMatching(/^authority_idempotency\//),
      expect.stringMatching(/^authority_operation_bindings\//),
      `${FIRESTORE_AUTHORITY_COLLECTIONS.TENANTS}/${TENANT_ID}`,
    ]);
    expect(
      harness.attempts[0]?.writes.filter(
        (write) => write.type === "UPDATE",
      ),
    ).toHaveLength(0);
    expect(
      harness.attempts[0]?.writes.map((write) => write.locator.collectionPath),
    ).toEqual(
      expect.arrayContaining([
        FIRESTORE_AUTHORITY_COLLECTIONS.TENANTS,
        FIRESTORE_AUTHORITY_COLLECTIONS.IDEMPOTENCY,
        FIRESTORE_AUTHORITY_COLLECTIONS.OPERATION_BINDINGS,
        FIRESTORE_AUTHORITY_COLLECTIONS.AUDIT,
        FIRESTORE_AUTHORITY_COLLECTIONS.OUTBOX,
        FIRESTORE_AUTHORITY_COLLECTIONS.OUTBOX_DELIVERY,
      ]),
    );
  });

  it("maps an existing tenant to planner conflict with zero writes", async () => {
    const harness = new AtomicTransactionHarness();
    seedTenant(harness);
    const value = createTenantCommand("duplicate-tenant");

    const result = await repository(harness).execute(
      value,
      context(value),
    );

    expect(result.safeCode).toBe("TENANT_ALREADY_EXISTS");
    expect(result.status).toBe("CONFLICT");
    expect(harness.attempts[0]?.writes).toHaveLength(0);
  });

  it("replays the exact result with zero duplicate writes", async () => {
    const harness = new AtomicTransactionHarness();
    const value = createTenantCommand("replay");
    const adapter = repository(harness);
    const first = await adapter.execute(value, context(value));
    const writeCount = harness.documents.size;

    const replay = await adapter.execute(value, context(value));

    expect(replay).toEqual(first);
    expect(harness.attempts[1]?.writes).toHaveLength(0);
    expect(harness.documents.size).toBe(writeCount);
  });

  it("converges an identical concurrent retry to exact replay", async () => {
    const harness = new AtomicTransactionHarness();
    harness.retries = 1;
    harness.commitFirstAttemptAsConcurrent = true;
    const clock = new FixedClock();
    const value = createTenantCommand("concurrent-retry");

    const result = await repository(harness, clock).execute(
      value,
      context(value),
    );

    expect(result.status).toBe("APPLIED");
    expect(clock.calls).toBe(1);
    expect(harness.attempts).toHaveLength(2);
    expect(harness.attempts[1]?.writes).toHaveLength(0);
    expect(
      harness.attempts[0]?.writes.map((write) =>
        locatorKey(write.locator),
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^platform_tenants\//),
        expect.stringMatching(/^authority_audit_events\//),
        expect.stringMatching(/^authority_outbox_events\//),
      ]),
    );
  });

  it("reuses the same timestamp and deterministic write IDs across a callback retry", async () => {
    const harness = new AtomicTransactionHarness();
    harness.retries = 1;
    const clock = new FixedClock();
    const value = createTenantCommand("deterministic-retry");

    const result = await repository(harness, clock).execute(
      value,
      context(value),
    );

    expect(result.status).toBe("APPLIED");
    expect(clock.calls).toBe(1);
    expect(harness.attempts).toHaveLength(2);
    expect(harness.attempts[0]?.writes).toEqual(
      harness.attempts[1]?.writes,
    );
    expect(
      harness.attempts[0]?.writes.every(
        (write) =>
          write.data.createdAt === OCCURRED_AT ||
          write.data.updatedAt === OCCURRED_AT ||
          write.data.occurredAt === OCCURRED_AT ||
          write.data.availableAt === OCCURRED_AT ||
          write.data.startedAt === OCCURRED_AT,
      ),
    ).toBe(true);
  });

  it("returns idempotency and operation-binding conflicts without writes", async () => {
    const harness = new AtomicTransactionHarness();
    const original = createTenantCommand("binding-original");
    const adapter = repository(harness);
    await adapter.execute(original, context(original));
    const fingerprintMismatch = createTenantCommand(
      "binding-original",
      TENANT_ID,
      {
        payload: {
          tenantId: TENANT_ID,
          initialStatus: "PENDING",
          tenantSlug: "different-slug",
        },
      },
    );
    const bindingMismatch = createTenantCommand(
      "binding-original",
      TENANT_ID,
      {
        idempotencyKey: "idempotency:firestore:different-key",
      },
    );

    const keyConflict = await adapter.execute(
      fingerprintMismatch,
      context(fingerprintMismatch),
    );
    const operationConflict = await adapter.execute(
      bindingMismatch,
      context(bindingMismatch),
    );

    expect(keyConflict.safeCode).toBe("IDEMPOTENCY_KEY_CONFLICT");
    expect(operationConflict.safeCode).toBe("OPERATION_ID_CONFLICT");
    expect(harness.attempts.slice(-2).every(
      (attempt) => attempt.writes.length === 0,
    )).toBe(true);
  });

  it("returns stale tenant conflict and reads activation membership exactly when activating", async () => {
    const staleHarness = new AtomicTransactionHarness();
    seedTenant(staleHarness, tenantRecord("ACTIVE", 2, 2));
    const stale = updateStatusCommand(
      "ACTIVE",
      "SUSPENDED",
      "stale",
    );
    const staleResult = await repository(staleHarness).execute(
      stale,
      context(stale),
    );

    const activationHarness = new AtomicTransactionHarness();
    seedTenant(activationHarness);
    seedMembership(activationHarness);
    const activation = updateStatusCommand(
      "PENDING",
      "ACTIVE",
      "activate",
      activationPrerequisite(),
    );
    const activationResult = await repository(
      activationHarness,
    ).execute(activation, context(activation));

    expect(staleResult.safeCode).toBe("STALE_TENANT_VERSION");
    expect(staleHarness.attempts[0]?.writes).toHaveLength(0);
    expect(activationResult.status).toBe("APPLIED");
    expect(activationHarness.attempts[0]?.reads).toContain(
      `${FIRESTORE_AUTHORITY_COLLECTIONS.MEMBERSHIPS}/${membershipKey()}`,
    );
  });

  it("persists only terminal ledger records when activation prerequisite is rejected", async () => {
    const harness = new AtomicTransactionHarness();
    seedTenant(harness);
    const value = updateStatusCommand(
      "PENDING",
      "ACTIVE",
      "activation-rejected",
      activationPrerequisite(),
    );

    const result = await repository(harness).execute(
      value,
      context(value),
    );

    expect(result.safeCode).toBe(
      "TENANT_ACTIVATION_PREREQUISITE_NOT_MET",
    );
    expect(
      harness.attempts[0]?.writes.map(
        (write) => write.locator.collectionPath,
      ),
    ).toEqual([
      FIRESTORE_AUTHORITY_COLLECTIONS.IDEMPOTENCY,
      FIRESTORE_AUTHORITY_COLLECTIONS.OPERATION_BINDINGS,
    ]);
  });

  it("creates a membership and maps a duplicate membership to conflict", async () => {
    const harness = new AtomicTransactionHarness();
    seedTenant(harness, tenantRecord("ACTIVE"));
    const value = createMembershipCommand();
    const adapter = repository(harness);

    const created = await adapter.execute(value, context(value));
    const duplicate = createMembershipCommand("duplicate-membership");
    const duplicateResult = await adapter.execute(
      duplicate,
      context(duplicate),
    );

    expect(created.safeCode).toBe("MEMBERSHIP_CREATED");
    expect(
      harness.read(
        FIRESTORE_AUTHORITY_COLLECTIONS.MEMBERSHIPS,
        membershipKey(),
      ),
    ).toBeDefined();
    expect(duplicateResult.safeCode).toBe(
      "MEMBERSHIP_ALREADY_EXISTS",
    );
    expect(harness.attempts.at(-1)?.writes).toHaveLength(0);
  });

  it("writes only ledger records for a role NO_OP", async () => {
    const harness = new AtomicTransactionHarness();
    seedTenant(harness, tenantRecord("ACTIVE"));
    seedMembership(harness);
    const value = rolesCommand(["TENANT_ADMIN"], "roles-no-op");

    const result = await repository(harness).execute(
      value,
      context(value),
    );

    expect(result.status).toBe("NO_OP");
    expect(
      harness.attempts[0]?.writes.map(
        (write) => write.locator.collectionPath,
      ),
    ).toEqual([
      FIRESTORE_AUTHORITY_COLLECTIONS.IDEMPOTENCY,
      FIRESTORE_AUTHORITY_COLLECTIONS.OPERATION_BINDINGS,
    ]);
  });

  it("reads tenant and membership and applies an authority-version guarded membership status update", async () => {
    const harness = new AtomicTransactionHarness();
    seedTenant(harness, tenantRecord("ACTIVE"));
    seedMembership(harness);
    const value = changeMembershipStatusCommand();

    const result = await repository(harness).execute(
      value,
      context(value),
    );

    expect(result.safeCode).toBe("MEMBERSHIP_STATUS_UPDATED");
    expect(harness.attempts[0]?.reads).toEqual([
      expect.stringMatching(/^authority_idempotency\//),
      expect.stringMatching(/^authority_operation_bindings\//),
      `${FIRESTORE_AUTHORITY_COLLECTIONS.TENANTS}/${TENANT_ID}`,
      `${FIRESTORE_AUTHORITY_COLLECTIONS.MEMBERSHIPS}/${membershipKey()}`,
    ]);
    expect(
      harness.attempts[0]?.writes.find(
        (write) =>
          write.locator.collectionPath ===
          FIRESTORE_AUTHORITY_COLLECTIONS.MEMBERSHIPS,
      )?.type,
    ).toBe("UPDATE");
  });

  it("maps alias collision to conflict and tombstones with transaction.update", async () => {
    const collisionHarness = new AtomicTransactionHarness();
    seedTenant(collisionHarness, tenantRecord("ACTIVE"));
    collisionHarness.seed(
      FIRESTORE_AUTHORITY_COLLECTIONS.ALIASES,
      aliasKey(),
      aliasRecord(),
    );
    const reserve = reserveAliasCommand();
    const collision = await repository(collisionHarness).execute(
      reserve,
      context(reserve),
    );

    const tombstoneHarness = new AtomicTransactionHarness();
    tombstoneHarness.seed(
      FIRESTORE_AUTHORITY_COLLECTIONS.ALIASES,
      aliasKey(),
      aliasRecord(),
    );
    const tombstone = tombstoneAliasCommand();
    const tombstoned = await repository(tombstoneHarness).execute(
      tombstone,
      context(tombstone),
    );

    expect(collision.safeCode).toBe("ALIAS_COLLISION");
    expect(collisionHarness.attempts[0]?.writes).toHaveLength(0);
    expect(tombstoned.safeCode).toBe("ALIAS_TOMBSTONED");
    expect(
      tombstoneHarness.attempts[0]?.writes.find(
        (write) =>
          write.locator.collectionPath ===
          FIRESTORE_AUTHORITY_COLLECTIONS.ALIASES,
      )?.type,
    ).toBe("UPDATE");
    expect(tombstoneHarness.attempts[0]?.reads).not.toContain(
      `${FIRESTORE_AUTHORITY_COLLECTIONS.TENANTS}/${TENANT_ID}`,
    );
  });
});

describe("legacy source, snapshot and expected reads", () => {
  it("uses only the closed PLATFORM_TENANTS physical locator", () => {
    const value = legacyCommand();
    const readSet = createFirestoreAuthorityReadSet(value);
    const legacy = readSet.find(
      (target) =>
        target.repositoryCollection === "LEGACY_TENANT_SOURCES",
    );

    expect(legacy?.locator).toEqual({
      collectionPath: "platform_tenants",
      documentId: LEGACY_DOCUMENT_ID,
    });
    expect(() =>
      legacyCommand(
        legacySource(),
        "invalid-path",
      ),
    ).not.toThrow();
    expect(() =>
      createAuthorityAdministrativeCommandV1({
        ...value,
        payload: {
          canonicalizationInput: {
            ...value.payload.canonicalizationInput,
            sourceRecord: {
              ...value.payload.canonicalizationInput.sourceRecord,
              sourceDescriptor: {
                ...value.payload.canonicalizationInput.sourceRecord
                  .sourceDescriptor,
                sourceDocumentId: "arbitrary/path",
              },
            },
          },
        },
      }),
    ).toThrow(AuthorityPersistenceContractError);
  });

  it("assembles PRESENT and ABSENT legacy registry entries only for reads performed", async () => {
    const presentHarness = new AtomicTransactionHarness();
    const source = legacySource();
    presentHarness.seed(
      FIRESTORE_AUTHORITY_COLLECTIONS.TENANTS,
      LEGACY_DOCUMENT_ID,
      source.normalizedRawRecord,
    );
    const value = legacyCommand(source, "legacy-present");
    const targets = createFirestoreAuthorityReadSet(value);
    let presentAssembly:
      | ReturnType<typeof assembleFirestoreAuthorityReadSnapshot>
      | undefined;
    await presentHarness.runTransaction(async (transaction) => {
      const observations = await readFirestoreAuthorityDocuments(
        transaction,
        targets,
      );
      presentAssembly =
        assembleFirestoreAuthorityReadSnapshot(observations);
      return undefined;
    });

    const absentHarness = new AtomicTransactionHarness();
    let absentAssembly:
      | ReturnType<typeof assembleFirestoreAuthorityReadSnapshot>
      | undefined;
    await absentHarness.runTransaction(async (transaction) => {
      const observations = await readFirestoreAuthorityDocuments(
        transaction,
        targets,
      );
      absentAssembly =
        assembleFirestoreAuthorityReadSnapshot(observations);
      return undefined;
    });

    expect(presentAssembly?.readRegistry).toMatchObject([
      {
        readStatus: "PRESENT",
        locatorKey: source.sourceLocator.locatorKey,
        recordFingerprint: source.sourceRecordFingerprint,
      },
    ]);
    expect(absentAssembly?.readRegistry).toMatchObject([
      {
        readStatus: "ABSENT",
        locatorKey: source.sourceLocator.locatorKey,
      },
    ]);
  });

  it("canonicalizes a matching source atomically and returns NOT_FOUND for an absent source", async () => {
    const source = legacySource();
    const presentHarness = new AtomicTransactionHarness();
    presentHarness.seed(
      FIRESTORE_AUTHORITY_COLLECTIONS.TENANTS,
      LEGACY_DOCUMENT_ID,
      source.normalizedRawRecord,
    );
    const value = legacyCommand(source, "canonical-apply");
    const applied = await repository(presentHarness).execute(
      value,
      context(value),
    );

    const absentHarness = new AtomicTransactionHarness();
    const absentValue = legacyCommand(source, "canonical-absent");
    const absent = await repository(absentHarness).execute(
      absentValue,
      context(absentValue),
    );

    expect(applied.safeCode).toBe("LEGACY_TENANT_CANONICALIZED");
    expect(
      presentHarness.attempts[0]?.writes.map(
        (write) => write.locator.collectionPath,
      ),
    ).toEqual(
      expect.arrayContaining([
        FIRESTORE_AUTHORITY_COLLECTIONS.TENANTS,
        FIRESTORE_AUTHORITY_COLLECTIONS.ALIASES,
        FIRESTORE_AUTHORITY_COLLECTIONS.AUDIT,
        FIRESTORE_AUTHORITY_COLLECTIONS.OUTBOX,
        FIRESTORE_AUTHORITY_COLLECTIONS.OUTBOX_DELIVERY,
      ]),
    );
    expect(absent.status).toBe("NOT_FOUND");
    expect(absent.safeCode).toBe("LEGACY_SOURCE_NOT_FOUND");
    expect(absentHarness.attempts[0]?.writes).toHaveLength(0);
  });

  it("returns planner source mismatch with zero writes when fingerprint changes", async () => {
    const expected = legacySource();
    const actual = legacySource({ status: "ACTIVE" });
    const harness = new AtomicTransactionHarness();
    harness.seed(
      FIRESTORE_AUTHORITY_COLLECTIONS.TENANTS,
      LEGACY_DOCUMENT_ID,
      actual.normalizedRawRecord,
    );
    const value = legacyCommand(expected, "source-mismatch");

    const result = await repository(harness).execute(
      value,
      context(value),
    );

    expect(result.safeCode).toBe("LEGACY_SOURCE_MISMATCH");
    expect(harness.attempts[0]?.writes).toHaveLength(0);
  });

  it("rejects missing expected-read coverage and validates version and authority version", () => {
    const value = updateStatusCommand(
      "ACTIVE",
      "SUSPENDED",
      "expected-reads",
      undefined,
      atAuthorityVersion(1),
    );
    const tenantTarget = createFirestoreAuthorityReadSet(value).find(
      (target) => target.repositoryCollection === "TENANTS",
    );
    if (tenantTarget === undefined) {
      throw new Error("Missing tenant test target.");
    }
    const observation = Object.freeze({
      target: tenantTarget,
      exists: true as const,
      value: tenantRecord("ACTIVE"),
    });

    expect(() =>
      revalidateFirestoreAuthorityExpectedReads(
        [
          {
            collection: "TENANTS",
            documentId: TENANT_ID,
            expectation: "MUST_EXIST_AT_VERSION",
            expectedVersion: 1,
          },
          {
            collection: "TENANTS",
            documentId: TENANT_ID,
            expectation: "MUST_MATCH_AUTHORITY_VERSION",
            expectedVersion: 1,
          },
        ],
        [observation],
        [],
      ),
    ).not.toThrow();
    expect(() =>
      revalidateFirestoreAuthorityExpectedReads(
        [
          {
            collection: "ALIASES",
            documentId: aliasKey(),
            expectation: "MUST_NOT_EXIST",
          },
        ],
        [observation],
        [],
      ),
    ).toThrow(FirestoreAuthorityExpectedReadError);
    expect(() =>
      revalidateFirestoreAuthorityExpectedReads(
        [
          {
            collection: "ALIASES",
            documentId: aliasKey(),
            expectation: "MUST_NOT_EXIST",
          },
        ],
        [
          {
            target: createFirestoreAuthorityReadSet(
              reserveAliasCommand("expected-absent"),
            ).find(
              (target) =>
                target.repositoryCollection === "ALIASES",
            ) ?? tenantTarget,
            exists: false,
          },
        ],
        [],
      ),
    ).not.toThrow();
    expect(() =>
      revalidateFirestoreAuthorityExpectedReads(
        [
          {
            collection: "TENANTS",
            documentId: TENANT_ID,
            expectation: "MUST_EXIST_AT_VERSION",
            expectedVersion: 2,
          },
        ],
        [observation],
        [],
      ),
    ).toThrow(FirestoreAuthorityExpectedReadError);
  });

  it("rejects a MUST_MATCH_SOURCE expectation when its physical source was not read", () => {
    const source = legacySource();
    expect(() =>
      revalidateFirestoreAuthorityExpectedReads(
        [
          {
            collection: "LEGACY_TENANT_SOURCES",
            documentId: source.sourceLocator.locatorKey,
            expectation: "MUST_MATCH_SOURCE",
            sourceCollection:
              source.sourceDescriptor.sourceCollection,
            sourceDocumentId: source.sourceDocumentId,
            locatorKey: source.sourceLocator.locatorKey,
            expectedSourceRecordVersion:
              source.sourceRecordVersion,
            expectedSourceRecordFingerprint:
              source.sourceRecordFingerprint,
          },
        ],
        [],
        [],
      ),
    ).toThrow(FirestoreAuthorityExpectedReadError);
  });
});

describe("serialization, transaction failures and architecture", () => {
  it("removes undefined object fields while preserving canonical array order", () => {
    expect(
      serializeAuthorityFirestoreDocument({
        kept: "value",
        omitted: undefined,
        roles: ["TENANT_ADMIN", "TENANT_OPERATOR"],
      }),
    ).toEqual({
      kept: "value",
      roles: ["TENANT_ADMIN", "TENANT_OPERATOR"],
    });
  });

  it("rejects class instances, AbortSignal and non-serializable values", () => {
    class CustomRecord {
      readonly value = "unsafe";
    }
    const controller = new AbortController();

    expect(() =>
      serializeAuthorityFirestoreDocument({
        nested: new CustomRecord(),
      }),
    ).toThrow(FirestoreAuthoritySerializationError);
    expect(() =>
      serializeAuthorityFirestoreDocument({
        cancellationSignal: controller.signal,
      }),
    ).toThrow(FirestoreAuthoritySerializationError);
    expect(() =>
      serializeAuthorityFirestoreDocument({
        callback: () => undefined,
      }),
    ).toThrow(FirestoreAuthoritySerializationError);
  });

  it.each([
    [
      "already-exists",
      "CONFLICT",
      "AUTHORITY_FIRESTORE_ALREADY_EXISTS",
      "RETRY_AFTER_READ",
    ],
    [
      "aborted",
      "CONFLICT",
      "AUTHORITY_FIRESTORE_TRANSACTION_CONFLICT",
      "RETRY_AFTER_READ",
    ],
    [
      "unavailable",
      "INTERNAL_ERROR",
      "AUTHORITY_FIRESTORE_TEMPORARILY_UNAVAILABLE",
      "SAFE_TO_RETRY_WITH_SAME_IDEMPOTENCY_KEY",
    ],
  ])(
    "maps %s without leaking Firestore messages",
    (code, status, safeCode, retryDisposition) => {
      const value = createTenantCommand(`error-${code}`);
      const result = mapFirestoreAuthorityError(
        {
          code,
          message: "secret project and IAM detail",
        },
        value,
        OCCURRED_AT,
      );

      expect(result).toMatchObject({
        status,
        safeCode,
        retryDisposition,
      });
      expect(JSON.stringify(result)).not.toContain("secret");
      expect(JSON.stringify(result)).not.toContain("IAM");
    },
  );

  it("keeps writes atomic when a later create precondition fails", async () => {
    const harness = new AtomicTransactionHarness();
    const value = createTenantCommand("atomic-failure");
    const auditEventId = createAuthorityAuditEventIdV1({
      operationId: value.operationId,
      eventType: "TENANT_CREATED",
      resourceType: "TENANT",
      resourceId: `platform_tenants/${TENANT_ID}`,
    });
    harness.seed(
      FIRESTORE_AUTHORITY_COLLECTIONS.AUDIT,
      auditEventId,
      {
        occupied: true,
      },
    );

    const result = await repository(harness).execute(
      value,
      context(value),
    );

    expect(result.status).toBe("CONFLICT");
    expect(
      harness.read(
        FIRESTORE_AUTHORITY_COLLECTIONS.TENANTS,
        TENANT_ID,
      ),
    ).toBeUndefined();
    expect(
      [...harness.documents.keys()].filter(
        (key) => key !== `authority_audit_events/${auditEventId}`,
      ),
    ).toHaveLength(0);
  });

  it("keeps Firebase imports and adapter exports inside Functions infrastructure only", () => {
    const root = path.resolve(__dirname, "..", "..");
    const infrastructure = path.join(
      root,
      "functions",
      "src",
      "infrastructure",
      "firestore",
      "authorityPersistence",
    );
    const sources = fs
      .readdirSync(infrastructure)
      .filter((file) => file.endsWith(".ts"))
      .map((file) =>
        fs.readFileSync(path.join(infrastructure, file), "utf8"),
      )
      .join("\n");
    const packageSources = fs
      .readdirSync(
        path.join(
          root,
          "src",
          "modules",
          "intelligence",
          "serverAuthorityPersistence",
        ),
      )
      .filter((file) => file.endsWith(".ts"))
      .map((file) =>
        fs.readFileSync(
          path.join(
            root,
            "src",
            "modules",
            "intelligence",
            "serverAuthorityPersistence",
            file,
          ),
          "utf8",
        ),
      )
      .join("\n");
    const functionsIndex = fs.readFileSync(
      path.join(root, "functions", "src", "index.ts"),
      "utf8",
    );

    expect(sources).toContain("@aura/intelligence-os/server");
    expect(sources).toContain("firebase-admin/firestore");
    expect(sources).not.toMatch(/serverTimestamp|\.set\s*\(/);
    expect(sources).not.toMatch(
      /process\.env|\bonCall\b|\bonRequest\b/,
    );
    expect(packageSources).not.toContain("firebase-admin");
    expect(functionsIndex).not.toContain(
      "FirestoreAuthorityMutationRepository",
    );
  });
});
