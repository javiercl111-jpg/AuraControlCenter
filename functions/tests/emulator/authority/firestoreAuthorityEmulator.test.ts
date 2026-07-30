import fs from "node:fs";
import path from "node:path";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  FirestoreAuthorityMutationRepository,
} from "../../../src/infrastructure/firestore/authorityPersistence/FirestoreAuthorityMutationRepository";
import {
  FIRESTORE_AUTHORITY_COLLECTIONS,
} from "../../../src/infrastructure/firestore/authorityPersistence/firestoreAuthorityCollections";
import type {
  FirestoreAuthorityTransactionRunner,
} from "../../../src/infrastructure/firestore/authorityPersistence/firestoreAuthorityTransaction";
import {
  InstrumentedFirestoreAuthorityTransactionRunner,
  createEmulatorAuthorityHarness,
  type EmulatorAuthorityHarness,
} from "./emulatorAuthorityHarness";
import {
  FixedEmulatorAuthorityClock,
  LEGACY_DOCUMENT_ID,
  OCCURRED_AT,
  TENANT_ID,
  activationPrerequisite,
  aliasKey,
  atRecordVersion,
  authorityContext,
  createMembershipCommand,
  createTenantCommand,
  legacyCommand,
  legacySource,
  membershipKey,
  reserveAliasCommand,
  tenantRecord,
  tombstoneAliasCommand,
  updateStatusCommand,
} from "./emulatorAuthorityFixtures";
import {
  EMULATOR_AUTHORITY_PROJECT_ID,
  assertAuthorityEmulatorIsolation,
} from "./emulatorAuthorityIsolation";

const AUTHORITY_COLLECTION_ALLOWLIST = Object.freeze(
  Object.values(FIRESTORE_AUTHORITY_COLLECTIONS).sort(),
);

let harness: EmulatorAuthorityHarness;

function repository(
  clock = new FixedEmulatorAuthorityClock(),
  transactionRunner?: FirestoreAuthorityTransactionRunner,
): FirestoreAuthorityMutationRepository {
  return new FirestoreAuthorityMutationRepository(
    harness.firestore,
    clock,
    transactionRunner,
  );
}

async function collectionCounts(): Promise<
  Readonly<Record<string, number>>
> {
  const entries = await Promise.all(
    AUTHORITY_COLLECTION_ALLOWLIST.map(
      async (collectionPath) =>
        [
          collectionPath,
          await harness.count(collectionPath),
        ] as const,
    ),
  );
  return Object.freeze(Object.fromEntries(entries));
}

async function seedTenant(
  value = tenantRecord(),
): Promise<void> {
  await harness.seed(
    FIRESTORE_AUTHORITY_COLLECTIONS.TENANTS,
    value.tenantId,
    value,
  );
}

function listTypeScriptFiles(directory: string): readonly string[] {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return listTypeScriptFiles(entryPath);
      }
      return entry.isFile() && entry.name.endsWith(".ts")
        ? [entryPath]
        : [];
    });
}

function sortedStatuses(
  results: readonly Readonly<{ status: string }>[],
): readonly string[] {
  return results.map((result) => result.status).sort();
}

beforeAll(() => {
  harness = createEmulatorAuthorityHarness();
});

beforeEach(async () => {
  await harness.clear();
});

afterAll(async () => {
  await harness.clear();
  await harness.close();
});

describe("Firestore authority emulator isolation", () => {
  it("requires the complete loopback demo environment", () => {
    expect(assertAuthorityEmulatorIsolation()).toEqual({
      projectId: EMULATOR_AUTHORITY_PROJECT_ID,
      emulatorHost: "127.0.0.1:8088",
    });
    expect(() =>
      assertAuthorityEmulatorIsolation({
        FIREBASE_CONFIG: JSON.stringify({
          projectId: EMULATOR_AUTHORITY_PROJECT_ID,
        }),
        GCLOUD_PROJECT: EMULATOR_AUTHORITY_PROJECT_ID,
        GOOGLE_CLOUD_PROJECT: EMULATOR_AUTHORITY_PROJECT_ID,
      }),
    ).toThrow(/FIRESTORE_EMULATOR_HOST/);
    expect(() =>
      assertAuthorityEmulatorIsolation({
        FIREBASE_CONFIG: JSON.stringify({
          projectId: "production-project-forbidden",
        }),
        FIRESTORE_EMULATOR_HOST: "127.0.0.1:8088",
        GCLOUD_PROJECT: "production-project-forbidden",
        GOOGLE_CLOUD_PROJECT: "production-project-forbidden",
      }),
    ).toThrow(/demo project/);
    expect(() =>
      assertAuthorityEmulatorIsolation({
        FIREBASE_CONFIG: JSON.stringify({
          projectId: EMULATOR_AUTHORITY_PROJECT_ID,
        }),
        FIRESTORE_EMULATOR_HOST: "127.0.0.1:8088",
        GCLOUD_PROJECT: EMULATOR_AUTHORITY_PROJECT_ID,
        GOOGLE_APPLICATION_CREDENTIALS:
          "/forbidden/credential.json",
        GOOGLE_CLOUD_PROJECT: EMULATOR_AUTHORITY_PROJECT_ID,
      }),
    ).toThrow(/GOOGLE_APPLICATION_CREDENTIALS/);
  });
});

describe("FirestoreAuthorityMutationRepository real transactions", () => {
  it("atomically creates tenant, ledgers, audit, outbox and delivery", async () => {
    const command = createTenantCommand();
    const result = await repository().execute(
      command,
      authorityContext(command),
    );

    expect(result).toMatchObject({
      status: "APPLIED",
      safeCode: "TENANT_CREATED",
      completedAt: OCCURRED_AT,
    });
    expect(await collectionCounts()).toEqual({
      [FIRESTORE_AUTHORITY_COLLECTIONS.ALIASES]: 0,
      [FIRESTORE_AUTHORITY_COLLECTIONS.AUDIT]: 1,
      [FIRESTORE_AUTHORITY_COLLECTIONS.IDEMPOTENCY]: 1,
      [FIRESTORE_AUTHORITY_COLLECTIONS.MEMBERSHIPS]: 0,
      [FIRESTORE_AUTHORITY_COLLECTIONS.OPERATION_BINDINGS]: 1,
      [FIRESTORE_AUTHORITY_COLLECTIONS.OUTBOX]: 1,
      [FIRESTORE_AUTHORITY_COLLECTIONS.OUTBOX_DELIVERY]: 1,
      [FIRESTORE_AUTHORITY_COLLECTIONS.TENANTS]: 1,
    });
    expect(
      await harness.read(
        FIRESTORE_AUTHORITY_COLLECTIONS.TENANTS,
        TENANT_ID,
      ),
    ).toMatchObject({
      tenantId: TENANT_ID,
      createdAt: OCCURRED_AT,
      updatedAt: OCCURRED_AT,
    });
  });

  it("replays exactly without creating another document", async () => {
    const command = createTenantCommand("exact-replay");
    const adapter = repository();
    const applied = await adapter.execute(
      command,
      authorityContext(command),
    );
    const before = await collectionCounts();
    const ledgerBefore = (
      await harness.firestore
        .collection(FIRESTORE_AUTHORITY_COLLECTIONS.IDEMPOTENCY)
        .get()
    ).docs.map((document) => document.data());
    const replay = await adapter.execute(
      command,
      authorityContext(command),
    );

    expect(replay).toEqual(applied);
    expect(await collectionCounts()).toEqual(before);
    expect(
      (
        await harness.firestore
          .collection(
            FIRESTORE_AUTHORITY_COLLECTIONS.IDEMPOTENCY,
          )
          .get()
      ).docs.map((document) => document.data()),
    ).toEqual(ledgerBefore);
  });

  it("rejects fingerprint and operation binding mismatches without resource changes", async () => {
    const original = createTenantCommand("ledger-original");
    const adapter = repository();
    await adapter.execute(original, authorityContext(original));
    const originalTenant = await harness.read(
      FIRESTORE_AUTHORITY_COLLECTIONS.TENANTS,
      TENANT_ID,
    );
    const originalCounts = await collectionCounts();
    const fingerprintMismatch = createTenantCommand(
      "ledger-original",
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
      "ledger-original",
      TENANT_ID,
      {
        idempotencyKey: "idempotency:emulator:different",
      },
    );

    const fingerprint = await adapter.execute(
      fingerprintMismatch,
      authorityContext(fingerprintMismatch),
    );
    const binding = await adapter.execute(
      bindingMismatch,
      authorityContext(bindingMismatch),
    );

    expect(fingerprint.safeCode).toBe(
      "IDEMPOTENCY_KEY_CONFLICT",
    );
    expect(binding.safeCode).toBe("OPERATION_ID_CONFLICT");
    expect(
      await harness.read(
        FIRESTORE_AUTHORITY_COLLECTIONS.TENANTS,
        TENANT_ID,
      ),
    ).toEqual(originalTenant);
    expect(await collectionCounts()).toEqual(originalCounts);
  });

  it("rejects duplicate create and stale version with no audit or outbox additions", async () => {
    await seedTenant(tenantRecord("ACTIVE"));
    const duplicate = createTenantCommand("duplicate");
    const duplicateResult = await repository().execute(
      duplicate,
      authorityContext(duplicate),
    );
    const stale = updateStatusCommand(
      "ACTIVE",
      "SUSPENDED",
      "stale-version",
      undefined,
      atRecordVersion(2),
    );
    const staleResult = await repository().execute(
      stale,
      authorityContext(stale),
    );

    expect(duplicateResult.safeCode).toBe(
      "TENANT_ALREADY_EXISTS",
    );
    expect(staleResult.safeCode).toBe("STALE_TENANT_VERSION");
    expect(
      await harness.count(FIRESTORE_AUTHORITY_COLLECTIONS.AUDIT),
    ).toBe(0);
    expect(
      await harness.count(FIRESTORE_AUTHORITY_COLLECTIONS.OUTBOX),
    ).toBe(0);
  });

  it("creates one membership with the planner authority version and blocks duplicates", async () => {
    await seedTenant(tenantRecord("ACTIVE"));
    const command = createMembershipCommand();
    const created = await repository().execute(
      command,
      authorityContext(command),
    );
    const duplicate = createMembershipCommand(
      "duplicate-membership",
    );
    const duplicateResult = await repository().execute(
      duplicate,
      authorityContext(duplicate),
    );

    expect(created.safeCode).toBe("MEMBERSHIP_CREATED");
    expect(
      await harness.read(
        FIRESTORE_AUTHORITY_COLLECTIONS.MEMBERSHIPS,
        membershipKey(),
      ),
    ).toMatchObject({
      membershipVersion: 1,
      authorityVersion: 1,
    });
    expect(duplicateResult.safeCode).toBe(
      "MEMBERSHIP_ALREADY_EXISTS",
    );
    expect(
      await harness.count(
        FIRESTORE_AUTHORITY_COLLECTIONS.MEMBERSHIPS,
      ),
    ).toBe(1);
  });

  it("rejects activation without its membership and writes only terminal ledgers", async () => {
    await seedTenant();
    const command = updateStatusCommand(
      "PENDING",
      "ACTIVE",
      "activation-prerequisite",
      activationPrerequisite(),
    );
    const result = await repository().execute(
      command,
      authorityContext(command),
    );

    expect(result.safeCode).toBe(
      "TENANT_ACTIVATION_PREREQUISITE_NOT_MET",
    );
    expect(
      await harness.read(
        FIRESTORE_AUTHORITY_COLLECTIONS.TENANTS,
        TENANT_ID,
      ),
    ).toMatchObject({ status: "PENDING", recordVersion: 1 });
    expect(await collectionCounts()).toMatchObject({
      [FIRESTORE_AUTHORITY_COLLECTIONS.AUDIT]: 0,
      [FIRESTORE_AUTHORITY_COLLECTIONS.IDEMPOTENCY]: 1,
      [FIRESTORE_AUTHORITY_COLLECTIONS.OPERATION_BINDINGS]: 1,
      [FIRESTORE_AUTHORITY_COLLECTIONS.OUTBOX]: 0,
      [FIRESTORE_AUTHORITY_COLLECTIONS.OUTBOX_DELIVERY]: 0,
    });
  });

  it("reserves aliases without overwrite and tombstones using an update", async () => {
    await seedTenant(tenantRecord("ACTIVE"));
    const reserve = reserveAliasCommand();
    const reserved = await repository().execute(
      reserve,
      authorityContext(reserve),
    );
    const collision = reserveAliasCommand("alias-collision");
    const collisionResult = await repository().execute(
      collision,
      authorityContext(collision),
    );
    const tombstone = tombstoneAliasCommand();
    const tombstoned = await repository().execute(
      tombstone,
      authorityContext(tombstone),
    );

    expect(reserved.safeCode).toBe("ALIAS_RESERVED");
    expect(collisionResult.safeCode).toBe("ALIAS_COLLISION");
    expect(tombstoned.safeCode).toBe("ALIAS_TOMBSTONED");
    expect(
      await harness.read(
        FIRESTORE_AUTHORITY_COLLECTIONS.ALIASES,
        aliasKey(),
      ),
    ).toMatchObject({
      status: "TOMBSTONED",
      aliasVersion: 2,
    });
    expect(
      await harness.count(FIRESTORE_AUTHORITY_COLLECTIONS.ALIASES),
    ).toBe(1);
  });

  it("canonicalizes an exact PRESENT legacy source and preserves its fingerprint", async () => {
    const source = legacySource();
    await harness.seed(
      FIRESTORE_AUTHORITY_COLLECTIONS.TENANTS,
      LEGACY_DOCUMENT_ID,
      source.normalizedRawRecord,
    );
    const command = legacyCommand(source, "legacy-present");
    const result = await repository().execute(
      command,
      authorityContext(command),
    );

    expect(result).toMatchObject({
      status: "APPLIED",
      safeCode: "LEGACY_TENANT_CANONICALIZED",
    });
    expect(
      await harness.read(
        FIRESTORE_AUTHORITY_COLLECTIONS.TENANTS,
        TENANT_ID,
      ),
    ).toMatchObject({
      migrationState: {
        sourceRecordFingerprint:
          source.sourceRecordFingerprint,
      },
    });
  });

  it("certifies ABSENT legacy registry behavior without inferred writes", async () => {
    const command = legacyCommand(
      legacySource(),
      "legacy-absent",
    );
    const result = await repository().execute(
      command,
      authorityContext(command),
    );

    expect(result).toMatchObject({
      status: "NOT_FOUND",
      safeCode: "LEGACY_SOURCE_NOT_FOUND",
    });
    expect(await harness.collectionIds()).toEqual([]);
  });

  it("revalidates a legacy source changed between real transaction attempts", async () => {
    const expected = legacySource();
    const changed = legacySource({ status: "ACTIVE" });
    await harness.seed(
      FIRESTORE_AUTHORITY_COLLECTIONS.TENANTS,
      LEGACY_DOCUMENT_ID,
      expected.normalizedRawRecord,
    );
    const runner =
      new InstrumentedFirestoreAuthorityTransactionRunner(
        harness.firestore,
        {},
        {
          abortFirstCallback: true,
          async betweenFirstCallbackAndRetry() {
            await harness.firestore
              .collection(
                FIRESTORE_AUTHORITY_COLLECTIONS.TENANTS,
              )
              .doc(LEGACY_DOCUMENT_ID)
              .update({ ...changed.normalizedRawRecord });
          },
        },
      );
    const command = legacyCommand(
      expected,
      "legacy-source-mismatch",
    );
    const result = await repository(
      new FixedEmulatorAuthorityClock(),
      runner,
    ).execute(
      command,
      authorityContext(command),
    );

    expect(runner.callbackCount).toBeGreaterThan(1);
    expect(result.safeCode).toBe("LEGACY_SOURCE_MISMATCH");
    expect(await harness.collectionIds()).toEqual([
      FIRESTORE_AUTHORITY_COLLECTIONS.TENANTS,
    ]);
    expect(
      await harness.count(FIRESTORE_AUTHORITY_COLLECTIONS.TENANTS),
    ).toBe(1);
  });

  it("converges concurrent identical commands to one APPLY and one exact REPLAY", async () => {
    const createRunner = () =>
      new InstrumentedFirestoreAuthorityTransactionRunner(
        harness.firestore,
      );
    const firstRunner = createRunner();
    const secondRunner = createRunner();
    const firstClock = new FixedEmulatorAuthorityClock();
    const secondClock = new FixedEmulatorAuthorityClock();
    const command = createTenantCommand("concurrent-identical");
    const [first, second] = await Promise.all([
      repository(firstClock, firstRunner).execute(
        command,
        authorityContext(command),
      ),
      repository(secondClock, secondRunner).execute(
        command,
        authorityContext(command),
      ),
    ]);

    expect(sortedStatuses([first, second])).toEqual([
      "APPLIED",
      "APPLIED",
    ]);
    expect(first).toEqual(second);
    expect(firstClock.calls).toBe(1);
    expect(secondClock.calls).toBe(1);
    expect(await collectionCounts()).toMatchObject({
      [FIRESTORE_AUTHORITY_COLLECTIONS.AUDIT]: 1,
      [FIRESTORE_AUTHORITY_COLLECTIONS.IDEMPOTENCY]: 1,
      [FIRESTORE_AUTHORITY_COLLECTIONS.OPERATION_BINDINGS]: 1,
      [FIRESTORE_AUTHORITY_COLLECTIONS.OUTBOX]: 1,
      [FIRESTORE_AUTHORITY_COLLECTIONS.OUTBOX_DELIVERY]: 1,
      [FIRESTORE_AUTHORITY_COLLECTIONS.TENANTS]: 1,
    });
    expect(
      await harness.read(
        FIRESTORE_AUTHORITY_COLLECTIONS.TENANTS,
        TENANT_ID,
      ),
    ).toMatchObject({
      createdAt: OCCURRED_AT,
      updatedAt: OCCURRED_AT,
    });
  });

  it("converges concurrent conflicting commands without corruption", async () => {
    const createRunner = () =>
      new InstrumentedFirestoreAuthorityTransactionRunner(
        harness.firestore,
      );
    const sharedIdempotencyKey =
      "idempotency:emulator:concurrent-conflict";
    const first = createTenantCommand(
      "concurrent-conflict-a",
      TENANT_ID,
      { idempotencyKey: sharedIdempotencyKey },
    );
    const second = createTenantCommand(
      "concurrent-conflict-b",
      TENANT_ID,
      { idempotencyKey: sharedIdempotencyKey },
    );
    const results = await Promise.all([
      repository(
        new FixedEmulatorAuthorityClock(),
        createRunner(),
      ).execute(first, authorityContext(first)),
      repository(
        new FixedEmulatorAuthorityClock(),
        createRunner(),
      ).execute(second, authorityContext(second)),
    ]);

    expect(sortedStatuses(results)).toEqual([
      "APPLIED",
      "CONFLICT",
    ]);
    expect(
      await harness.count(FIRESTORE_AUTHORITY_COLLECTIONS.TENANTS),
    ).toBe(1);
    expect(
      await harness.count(FIRESTORE_AUTHORITY_COLLECTIONS.AUDIT),
    ).toBe(1);
    expect(
      await harness.count(FIRESTORE_AUTHORITY_COLLECTIONS.OUTBOX),
    ).toBe(1);
  });

  it("uses Firestore automatic retry while keeping clock, IDs and timestamps stable", async () => {
    const clock = new FixedEmulatorAuthorityClock();
    const writeIdsByAttempt = new Map<number, string[]>();
    const runner =
      new InstrumentedFirestoreAuthorityTransactionRunner(
        harness.firestore,
        {
          beforeWrite(locator, _writeNumber, callbackAttempt) {
            const writeIds =
              writeIdsByAttempt.get(callbackAttempt) ?? [];
            writeIds.push(
              `${locator.collectionPath}/${locator.documentId}`,
            );
            writeIdsByAttempt.set(callbackAttempt, writeIds);
          },
        },
        { abortFirstCallback: true },
      );
    const command = createTenantCommand("automatic-retry");
    const result = await repository(clock, runner).execute(
      command,
      authorityContext(command),
    );

    expect(result).toMatchObject({
      status: "APPLIED",
      safeCode: "TENANT_CREATED",
      completedAt: OCCURRED_AT,
    });
    expect(runner.callbackCount).toBeGreaterThan(1);
    expect(clock.calls).toBe(1);
    expect(writeIdsByAttempt.get(2)).toEqual(
      writeIdsByAttempt.get(1),
    );
    expect(await collectionCounts()).toMatchObject({
      [FIRESTORE_AUTHORITY_COLLECTIONS.AUDIT]: 1,
      [FIRESTORE_AUTHORITY_COLLECTIONS.IDEMPOTENCY]: 1,
      [FIRESTORE_AUTHORITY_COLLECTIONS.OPERATION_BINDINGS]: 1,
      [FIRESTORE_AUTHORITY_COLLECTIONS.OUTBOX]: 1,
      [FIRESTORE_AUTHORITY_COLLECTIONS.OUTBOX_DELIVERY]: 1,
      [FIRESTORE_AUTHORITY_COLLECTIONS.TENANTS]: 1,
    });
    expect(
      await harness.read(
        FIRESTORE_AUTHORITY_COLLECTIONS.TENANTS,
        TENANT_ID,
      ),
    ).toMatchObject({
      createdAt: OCCURRED_AT,
      updatedAt: OCCURRED_AT,
    });
  });

  it("rolls back all real transaction writes when an injected write fails", async () => {
    const runner =
      new InstrumentedFirestoreAuthorityTransactionRunner(
        harness.firestore,
        {
          beforeWrite(locator) {
            if (
              locator.collectionPath ===
              FIRESTORE_AUTHORITY_COLLECTIONS.OUTBOX_DELIVERY
            ) {
              throw new Error("controlled emulator write failure");
            }
          },
        },
      );
    const command = createTenantCommand("atomic-rollback");
    const result = await repository(
      new FixedEmulatorAuthorityClock(),
      runner,
    ).execute(command, authorityContext(command));

    expect(result.status).toBe("INTERNAL_ERROR");
    expect(await harness.collectionIds()).toEqual([]);
  });

  it("observes cancellation before the transaction and immediately before writes", async () => {
    const beforeTransactionController = new AbortController();
    beforeTransactionController.abort();
    const beforeTransaction = createTenantCommand(
      "cancel-before-transaction",
    );
    const beforeTransactionResult = await repository().execute(
      beforeTransaction,
      authorityContext(
        beforeTransaction,
        beforeTransactionController.signal,
      ),
    );
    const beforeWritesController = new AbortController();
    const runner =
      new InstrumentedFirestoreAuthorityTransactionRunner(
        harness.firestore,
        {
          async afterRead(locator) {
            if (
              locator.collectionPath ===
                FIRESTORE_AUTHORITY_COLLECTIONS.TENANTS &&
              locator.documentId === TENANT_ID
            ) {
              beforeWritesController.abort();
            }
          },
        },
      );
    const beforeWrites = createTenantCommand(
      "cancel-before-writes",
    );
    const beforeWritesResult = await repository(
      new FixedEmulatorAuthorityClock(),
      runner,
    ).execute(
      beforeWrites,
      authorityContext(
        beforeWrites,
        beforeWritesController.signal,
      ),
    );

    expect(beforeTransactionResult.safeCode).toBe(
      "OPERATION_CANCELLED",
    );
    expect(beforeWritesResult.safeCode).toBe(
      "OPERATION_CANCELLED",
    );
    expect(await harness.collectionIds()).toEqual([]);
  });
});

describe("Firestore authority emulator architecture", () => {
  it("keeps production free of emulator helpers, queries, handlers and composition", () => {
    const repositoryRoot = path.resolve(
      __dirname,
      "..",
      "..",
      "..",
      "..",
    );
    const adapterDirectory = path.join(
      repositoryRoot,
      "functions",
      "src",
      "infrastructure",
      "firestore",
      "authorityPersistence",
    );
    const adapterSources = fs
      .readdirSync(adapterDirectory)
      .filter((file) => file.endsWith(".ts"))
      .map((file) =>
        fs.readFileSync(
          path.join(adapterDirectory, file),
          "utf8",
        ),
      )
      .join("\n");
    const functionsSource = listTypeScriptFiles(
      path.join(repositoryRoot, "functions", "src"),
    )
      .map((file) => fs.readFileSync(file, "utf8"))
      .join("\n");
    const functionsIndex = fs.readFileSync(
      path.join(repositoryRoot, "functions", "src", "index.ts"),
      "utf8",
    );

    expect(adapterSources).not.toMatch(
      /\.where\s*\(|collectionGroup\s*\(|getAll\s*\(/,
    );
    expect(functionsSource).not.toContain(
      "tests/emulator/authority",
    );
    expect(adapterSources).not.toContain(
      "FIRESTORE_EMULATOR_HOST",
    );
    expect(functionsIndex).not.toContain(
      "FirestoreAuthorityMutationRepository",
    );
    expect(functionsIndex).not.toContain(
      "createEmulatorAuthorityHarness",
    );
  });

  it("writes documents only inside the closed collection allowlist", async () => {
    const command = createTenantCommand("collection-allowlist");
    await repository().execute(
      command,
      authorityContext(command),
    );

    const actualCollectionIds = await harness.collectionIds();
    const allowedCollections = new Set<string>(
      AUTHORITY_COLLECTION_ALLOWLIST,
    );
    expect(
      actualCollectionIds.every((collectionId) =>
        allowedCollections.has(collectionId),
      ),
    ).toBe(true);
  });

  it("keeps emulator config test-only with no indexes, deploy or production rules", () => {
    const emulatorRoot = path.resolve(__dirname, "..");
    const config = fs.readFileSync(
      path.join(emulatorRoot, "firebase.emulator.json"),
      "utf8",
    );
    const runner = fs.readFileSync(
      path.join(
        emulatorRoot,
        "runFirestoreAuthorityEmulator.cjs",
      ),
      "utf8",
    );

    expect(config).toContain("firestore.emulator.rules");
    expect(config).not.toContain("firestore.rules");
    expect(config).not.toContain("firestore.indexes.json");
    expect(runner).not.toMatch(/\bdeploy\b|firebase\s+use/);
    expect(runner).not.toMatch(
      /aura-control-center-[a-z0-9]+/,
    );
  });
});
