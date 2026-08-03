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
  DISCOVERY_INTAKE_IDEMPOTENCY_POLICY_V1,
  type DiscoveryIntakeIdempotencyPolicyV1,
} from "../../../src/discovery/idempotency";
import {
  generateDiscoveryCapabilityToken,
  generateIdempotencyHash,
  generateIdempotencyNamespaceHash,
} from "../../../src/discovery/idempotencyHelper";
import {
  FirestoreDiscoveryIntakeIdempotencyCleanup,
  FirestoreDiscoveryIntakeIdempotencyRepository,
  FIRESTORE_DISCOVERY_INTAKE_IDEMPOTENCY_COLLECTION,
  FIRESTORE_DISCOVERY_INTAKE_IDEMPOTENCY_NAMESPACE_COLLECTION,
  FIRESTORE_DISCOVERY_INTAKE_IDEMPOTENCY_NAMESPACE_VERSION,
  deserializeDiscoveryIntakeIdempotencyRecordV1,
} from "../../../src/infrastructure/firestore/discoveryIntakeIdempotency";
import {
  createEmulatorIdempotencyHarness,
  type EmulatorIdempotencyHarness,
} from "./emulatorIdempotencyHarness";
import {
  MutableIdempotencyClock,
  TEST_NOW_MS,
  TEST_SECRET,
  hash,
  policy,
  result,
} from "./idempotencyFixtures";

let harness: EmulatorIdempotencyHarness;

function repository(
  clock = new MutableIdempotencyClock(),
  policyValue: DiscoveryIntakeIdempotencyPolicyV1 = policy(),
) {
  return new FirestoreDiscoveryIntakeIdempotencyRepository(
    harness.firestore,
    policyValue,
    clock,
  );
}

function command(label = "one", namespaceLabel = "identity-one") {
  return Object.freeze({
    recordId: hash(`record:${label}`),
    requestHash: hash(`request:${label}`),
    namespaceHash: hash(`namespace:${namespaceLabel}`),
    processingAttemptId: hash(`attempt:${label}:1`),
  });
}

function effect(documentId = "link-document-000001") {
  return Object.freeze({
    operation: "CREATE" as const,
    collectionPath: "idempotency_test_effects",
    documentId,
    data: Object.freeze({ marker: "one-effect" }),
  });
}

async function storedRecord(recordId: string) {
  const snapshot = await harness.firestore
    .collection(FIRESTORE_DISCOVERY_INTAKE_IDEMPOTENCY_COLLECTION)
    .doc(recordId)
    .get();
  return deserializeDiscoveryIntakeIdempotencyRecordV1(snapshot.data());
}

beforeAll(() => {
  harness = createEmulatorIdempotencyHarness();
});

beforeEach(async () => {
  await harness.clear();
});

afterAll(async () => {
  await harness.close();
});

describe("Discovery intake idempotency lifecycle V1", () => {
  it("writes expiresAt when PROCESSING is created", async () => {
    const input = command();
    await repository().acquire(input);
    const stored = await storedRecord(input.recordId) as Record<string, unknown>;
    expect(stored).toMatchObject({
      status: "PROCESSING",
      expiresAt:
        TEST_NOW_MS + DISCOVERY_INTAKE_IDEMPOTENCY_POLICY_V1.processingRetentionMs,
      leaseExpiresAt:
        TEST_NOW_MS + DISCOVERY_INTAKE_IDEMPOTENCY_POLICY_V1.leaseDurationMs,
    });
  });

  it("writes canonical expiresAt and result when COMPLETED", async () => {
    const input = command();
    const repo = repository();
    await repo.acquire(input);
    await repo.complete({ ...input, result: result() }, effect());
    expect(await storedRecord(input.recordId)).toMatchObject({
      status: "COMPLETED",
      expiresAt:
        TEST_NOW_MS + DISCOVERY_INTAKE_IDEMPOTENCY_POLICY_V1.completedRetentionMs,
      completedAt: TEST_NOW_MS,
      resultVersion: "DISCOVERY_INTAKE_RESULT_V1",
    });
  });

  it("writes a bounded FAILED_FINAL record", async () => {
    const input = command();
    const repo = repository();
    await repo.acquire(input);
    await repo.fail({
      ...input,
      failureCode: "IDEMPOTENCY_INTERNAL_FAILURE",
    });
    expect(await storedRecord(input.recordId)).toMatchObject({
      status: "FAILED_FINAL",
      failedAt: TEST_NOW_MS,
      expiresAt:
        TEST_NOW_MS + DISCOVERY_INTAKE_IDEMPOTENCY_POLICY_V1.failedRetentionMs,
      processingAttemptId: null,
      leaseExpiresAt: null,
    });
  });

  it("reuses an active completed result without creating another effect", async () => {
    const input = command();
    const repo = repository();
    await repo.acquire(input);
    await repo.complete({ ...input, result: result() }, effect());
    const cached = await repo.acquire({
      ...input,
      processingAttemptId: hash("unused-replay-attempt"),
    });
    expect(cached).toEqual({ decision: "CACHED", result: result() });
    expect((await harness.firestore.collection("idempotency_test_effects").get()).size)
      .toBe(1);
  });

  it("does not reuse an expired completed result", async () => {
    const clock = new MutableIdempotencyClock();
    const input = command();
    const repo = repository(clock);
    await repo.acquire(input);
    await repo.complete({ ...input, result: result() }, effect());
    clock.nowMs += DISCOVERY_INTAKE_IDEMPOTENCY_POLICY_V1.completedRetentionMs;
    await expect(repo.acquire({
      ...input,
      processingAttemptId: hash("expired-replay"),
    })).rejects.toMatchObject({ code: "IDEMPOTENCY_RECORD_EXPIRED" });
  });

  it("blocks an active processing lease with deterministic retryAfter", async () => {
    const input = command();
    const repo = repository();
    await repo.acquire(input);
    await expect(repo.acquire({
      ...input,
      processingAttemptId: hash("parallel-attempt"),
    })).resolves.toEqual({ decision: "PROCESSING", retryAfterSeconds: 60 });
  });

  it("recovers an expired lease without extending semantic retention", async () => {
    const clock = new MutableIdempotencyClock();
    const input = command();
    const repo = repository(clock);
    await repo.acquire(input);
    const original = await storedRecord(input.recordId) as Record<string, unknown>;
    clock.nowMs += DISCOVERY_INTAKE_IDEMPOTENCY_POLICY_V1.leaseDurationMs;
    const recovered = await repo.acquire({
      ...input,
      processingAttemptId: hash("attempt:one:2"),
    });
    expect(recovered).toMatchObject({
      decision: "ACQUIRED", attemptCount: 2, leaseRecoveryCount: 1,
    });
    expect(await storedRecord(input.recordId)).toMatchObject({
      expiresAt: original.expiresAt,
      attemptCount: 2,
      leaseRecoveryCount: 1,
    });
  });

  it("fails closed after the maximum lease recoveries", async () => {
    const clock = new MutableIdempotencyClock();
    const input = command();
    const repo = repository(clock, policy({
      maxAttempts: 4,
      maxLeaseRecoveries: 2,
    }));
    await repo.acquire(input);
    for (const label of ["recovery-1", "recovery-2"]) {
      clock.nowMs += DISCOVERY_INTAKE_IDEMPOTENCY_POLICY_V1.leaseDurationMs;
      await repo.acquire({ ...input, processingAttemptId: hash(label) });
    }
    clock.nowMs += DISCOVERY_INTAKE_IDEMPOTENCY_POLICY_V1.leaseDurationMs;
    await expect(repo.acquire({
      ...input,
      processingAttemptId: hash("recovery-denied"),
    })).rejects.toMatchObject({
      code: "IDEMPOTENCY_LEASE_RECOVERY_EXCEEDED",
    });
    expect(await storedRecord(input.recordId)).toMatchObject({
      status: "FAILED_FINAL",
      failureCode: "IDEMPOTENCY_LEASE_RECOVERY_EXCEEDED",
    });
  });

  it("fails closed after the maximum attempts", async () => {
    const clock = new MutableIdempotencyClock();
    const input = command();
    const repo = repository(clock, policy({
      maxAttempts: 2,
      maxLeaseRecoveries: 1,
    }));
    await repo.acquire(input);
    clock.nowMs += DISCOVERY_INTAKE_IDEMPOTENCY_POLICY_V1.leaseDurationMs;
    await repo.acquire({ ...input, processingAttemptId: hash("second-attempt") });
    clock.nowMs += DISCOVERY_INTAKE_IDEMPOTENCY_POLICY_V1.leaseDurationMs;
    await expect(repo.acquire({
      ...input,
      processingAttemptId: hash("third-attempt"),
    })).rejects.toMatchObject({ code: "IDEMPOTENCY_ATTEMPTS_EXCEEDED" });
  });

  it("rejects a requestHash mismatch as a stable conflict", async () => {
    const input = command();
    const repo = repository();
    await repo.acquire(input);
    await expect(repo.acquire({
      ...input,
      requestHash: hash("different-request"),
      processingAttemptId: hash("conflicting-attempt"),
    })).rejects.toMatchObject({ code: "IDEMPOTENCY_REQUEST_CONFLICT" });
  });

  it("fails closed for a corrupted record", async () => {
    const input = command();
    const repo = repository();
    await repo.acquire(input);
    await harness.firestore
      .collection(FIRESTORE_DISCOVERY_INTAKE_IDEMPOTENCY_COLLECTION)
      .doc(input.recordId)
      .update({ attemptCount: "corrupted" });
    await expect(repo.acquire({
      ...input,
      processingAttemptId: hash("corrupted-retry"),
    })).rejects.toMatchObject({ code: "IDEMPOTENCY_RECORD_CORRUPTED" });
  });

  it("fails closed for an unknown persisted state", async () => {
    const input = command();
    const repo = repository();
    await repo.acquire(input);
    await harness.firestore
      .collection(FIRESTORE_DISCOVERY_INTAKE_IDEMPOTENCY_COLLECTION)
      .doc(input.recordId)
      .update({ status: "UNKNOWN_STATE" });
    await expect(repo.acquire({
      ...input,
      processingAttemptId: hash("unknown-state-retry"),
    })).rejects.toMatchObject({ code: "IDEMPOTENCY_RECORD_CORRUPTED" });
  });

  it("bounds active keys per derived namespace", async () => {
    const repo = repository();
    for (const label of ["one", "two", "three"]) {
      await expect(repo.acquire(command(label, "shared-identity")))
        .resolves.toMatchObject({ decision: "ACQUIRED" });
    }
    await expect(repo.acquire(command("four", "shared-identity")))
      .rejects.toMatchObject({ code: "IDEMPOTENCY_CARDINALITY_EXCEEDED" });
    const namespace = await harness.firestore
      .collection(FIRESTORE_DISCOVERY_INTAKE_IDEMPOTENCY_NAMESPACE_COLLECTION)
      .doc(hash("namespace:shared-identity"))
      .get();
    expect(namespace.data()?.activeRecordIds).toHaveLength(3);
  });
});

describe("bounded idempotency retention cleanup", () => {
  it("deletes only semantically expired records", async () => {
    const clock = new MutableIdempotencyClock();
    const input = command();
    await repository(clock).acquire(input);
    clock.nowMs += DISCOVERY_INTAKE_IDEMPOTENCY_POLICY_V1.processingRetentionMs;
    const cleanup = new FirestoreDiscoveryIntakeIdempotencyCleanup(
      harness.firestore, policy(), clock,
    );
    await expect(cleanup.cleanup()).resolves.toMatchObject({
      scanned: 1, deleted: 1, wouldDelete: 1, skipped: 0, errors: 0,
      maxExpiredAgeMs: 0,
    });
    expect((await harness.firestore
      .collection(FIRESTORE_DISCOVERY_INTAKE_IDEMPOTENCY_COLLECTION)
      .get()).size).toBe(0);
  });

  it("preserves active records", async () => {
    const clock = new MutableIdempotencyClock();
    const input = command();
    await repository(clock).acquire(input);
    const cleanup = new FirestoreDiscoveryIntakeIdempotencyCleanup(
      harness.firestore, policy(), clock,
    );
    expect(await cleanup.cleanup()).toMatchObject({
      scanned: 0, deleted: 0, skipped: 0, errors: 0,
    });
    expect((await harness.firestore
      .collection(FIRESTORE_DISCOVERY_INTAKE_IDEMPOTENCY_COLLECTION)
      .doc(input.recordId)
      .get()).exists).toBe(true);
  });

  it("is idempotent when the same cleanup is rerun", async () => {
    const clock = new MutableIdempotencyClock();
    const input = command();
    await repository(clock).acquire(input);
    clock.nowMs += DISCOVERY_INTAKE_IDEMPOTENCY_POLICY_V1.processingRetentionMs;
    const cleanup = new FirestoreDiscoveryIntakeIdempotencyCleanup(
      harness.firestore, policy(), clock,
    );
    expect((await cleanup.cleanup()).deleted).toBe(1);
    expect(await cleanup.cleanup()).toMatchObject({
      scanned: 0, deleted: 0, wouldDelete: 0, skipped: 0, errors: 0,
    });
  });

  it("respects the configured batch limit", async () => {
    const clock = new MutableIdempotencyClock();
    const repo = repository(clock);
    for (const label of ["one", "two", "three"]) {
      await repo.acquire(command(label, `identity-${label}`));
    }
    clock.nowMs += DISCOVERY_INTAKE_IDEMPOTENCY_POLICY_V1.processingRetentionMs;
    const cleanup = new FirestoreDiscoveryIntakeIdempotencyCleanup(
      harness.firestore, policy(), clock,
    );
    expect(await cleanup.cleanup({ batchSize: 2 })).toMatchObject({
      scanned: 2, deleted: 2, wouldDelete: 2,
    });
    expect((await harness.firestore
      .collection(FIRESTORE_DISCOVERY_INTAKE_IDEMPOTENCY_COLLECTION)
      .get()).size).toBe(1);
  });

  it("supports a bounded dry-run with age reporting", async () => {
    const clock = new MutableIdempotencyClock();
    const input = command();
    await repository(clock).acquire(input);
    clock.nowMs +=
      DISCOVERY_INTAKE_IDEMPOTENCY_POLICY_V1.processingRetentionMs + 5_000;
    const cleanup = new FirestoreDiscoveryIntakeIdempotencyCleanup(
      harness.firestore, policy(), clock,
    );
    expect(await cleanup.cleanup({ dryRun: true })).toMatchObject({
      scanned: 1, deleted: 0, wouldDelete: 1, errors: 0,
      maxExpiredAgeMs: 5_000,
    });
    expect((await harness.firestore
      .collection(FIRESTORE_DISCOVERY_INTAKE_IDEMPOTENCY_COLLECTION)
      .doc(input.recordId)
      .get()).exists).toBe(true);
  });
});

describe("concurrency and capability convergence", () => {
  it("makes concurrent completed replays converge on one result", async () => {
    const input = command();
    const repo = repository();
    await repo.acquire(input);
    await repo.complete({ ...input, result: result() }, effect());
    const decisions = await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        repository().acquire({
          ...input,
          processingAttemptId: hash(`replay-${index}`),
        }),
      ),
    );
    expect(decisions.every(
      (decision) =>
        decision.decision === "CACHED" &&
        decision.result.linkId === result().linkId,
    )).toBe(true);
    expect((await harness.firestore.collection("idempotency_test_effects").get()).size)
      .toBe(1);
  });

  it("does not rotate capability state during concurrent replays", async () => {
    const input = command();
    const token = generateDiscoveryCapabilityToken(
      input.recordId, input.processingAttemptId, TEST_SECRET,
    );
    const repo = repository();
    await repo.acquire(input);
    await repo.complete(
      {
        ...input,
        result: result({
          linkId: "capability-link-0001",
          capabilityGenerationId: input.processingAttemptId,
        }),
      },
      {
        operation: "CREATE",
        collectionPath: "idempotency_test_effects",
        documentId: "capability-link-0001",
        data: { tokenHash: hash(token) },
      },
    );
    const before = (await harness.firestore
      .collection("idempotency_test_effects")
      .doc("capability-link-0001")
      .get()).data();
    const replays = await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        repository().acquire({
          ...input,
          processingAttemptId: hash(`capability-replay-${index}`),
        }),
      ),
    );
    const derived = replays.map((decision) =>
      decision.decision === "CACHED"
        ? generateDiscoveryCapabilityToken(
            input.recordId,
            decision.result.capabilityGenerationId,
            TEST_SECRET,
          )
        : "not-cached",
    );
    expect(new Set(derived)).toEqual(new Set([token]));
    expect((await harness.firestore
      .collection("idempotency_test_effects")
      .doc("capability-link-0001")
      .get()).data()).toEqual(before);
  });

  it("retries a real Firestore conflict without duplicating the atomic effect", async () => {
    const clock = new MutableIdempotencyClock();
    const input = command();
    await repository(clock).acquire(input);
    let completeAttempts = 0;
    const conflictedRepository = new FirestoreDiscoveryIntakeIdempotencyRepository(
      harness.firestore,
      policy(),
      clock,
      {
        async onTransactionAttempt(transactionAttempt) {
          if (transactionAttempt.operation !== "COMPLETE") return;
          completeAttempts += 1;
          if (completeAttempts === 1) {
            throw Object.assign(
              new Error("Controlled Firestore transaction conflict."),
              { code: 10 },
            );
          }
        },
      },
    );
    await conflictedRepository.complete(
      { ...input, result: result({ linkId: "conflict-link-00001" }) },
      effect("conflict-link-00001"),
    );
    expect(completeAttempts).toBeGreaterThan(1);
    expect((await harness.firestore.collection("idempotency_test_effects").get()).size)
      .toBe(1);
    expect(await storedRecord(input.recordId)).toMatchObject({
      status: "COMPLETED",
      result: { linkId: "conflict-link-00001" },
    });
  });
});

describe("privacy and architectural boundaries", () => {
  it("derives deterministic HMAC identifiers without persisting raw identity", async () => {
    const rawKey = "synthetic-idempotency-key-0001";
    const rawEmail = "person@example.invalid";
    const recordId = generateIdempotencyHash(rawKey, TEST_SECRET);
    const namespaceHash = generateIdempotencyNamespaceHash(rawEmail, TEST_SECRET);
    expect(generateIdempotencyHash(rawKey, TEST_SECRET)).toBe(recordId);
    expect(generateIdempotencyNamespaceHash(rawEmail, TEST_SECRET))
      .toBe(namespaceHash);
    expect(recordId).toHaveLength(64);
    expect(namespaceHash).toHaveLength(64);
    expect(recordId).not.toContain(rawKey);
    expect(namespaceHash).not.toContain(rawEmail);

    const repo = repository();
    await repo.acquire({
      recordId,
      requestHash: hash("private-request"),
      namespaceHash,
      processingAttemptId: hash("private-attempt"),
    });
    const persisted = JSON.stringify({
      record: (await harness.firestore
        .collection(FIRESTORE_DISCOVERY_INTAKE_IDEMPOTENCY_COLLECTION)
        .doc(recordId)
        .get()).data(),
      namespace: (await harness.firestore
        .collection(FIRESTORE_DISCOVERY_INTAKE_IDEMPOTENCY_NAMESPACE_COLLECTION)
        .doc(namespaceHash)
        .get()).data(),
    });
    expect(persisted).not.toContain(rawKey);
    expect(persisted).not.toContain(rawEmail);
    expect(persisted).not.toContain("advisorId");
    expect(persisted).not.toContain("tenantId");
  });

  it("keeps TTL evidence versioned and the core Firebase-free", () => {
    const repositoryRoot = path.resolve(__dirname, "..", "..", "..", "..");
    const manifestPath = path.join(
      repositoryRoot,
      "docs/security/discovery/manifests/" +
        "DISCOVERY_INTAKE_IDEMPOTENCY_TTL_V1.json",
    );
    const retentionPath = path.join(
      repositoryRoot,
      "docs/security/discovery/IDEMPOTENCY_RETENTION_V1.md",
    );
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    expect(manifest).toMatchObject({
      status: "TARGET_NOT_APPLIED",
      collectionGroup: "discovery_intake_idempotency",
      field: "expiresAt",
      remoteVerification: "P9_REQUIRED",
    });
    expect(fs.readFileSync(retentionPath, "utf8"))
      .toContain("eventual physical deletion only");

    const coreDirectory = path.join(
      repositoryRoot, "functions/src/discovery/idempotency",
    );
    const coreSources = fs.readdirSync(coreDirectory)
      .filter((file) => file.endsWith(".ts"))
      .map((file) => fs.readFileSync(path.join(coreDirectory, file), "utf8"))
      .join("\n");
    expect(coreSources).not.toMatch(/firebase-admin|\.collection\s*\(/);

    const functionsIndex = fs.readFileSync(
      path.join(repositoryRoot, "functions/src/index.ts"), "utf8",
    );
    expect(functionsIndex).not.toContain(
      "FirestoreDiscoveryIntakeIdempotencyCleanup",
    );
    const outOfScopeHandlers = [
      "functions/src/intelligence/evaluateConversation.ts",
      "functions/src/discovery/completeDiscoverySession.ts",
      "functions/src/discovery/reports/requestExecutiveDocument.ts",
    ];
    for (const relativePath of outOfScopeHandlers) {
      expect(fs.readFileSync(path.join(repositoryRoot, relativePath), "utf8"))
        .not.toContain("discoveryIntakeIdempotency");
    }
  });

  it("uses bounded Emulator-only cleanup and no production runner", () => {
    const repositoryRoot = path.resolve(__dirname, "..", "..", "..", "..");
    const cleanupSource = fs.readFileSync(
      path.join(
        repositoryRoot,
        "functions/src/infrastructure/firestore/discoveryIntakeIdempotency/" +
          "FirestoreDiscoveryIntakeIdempotencyCleanup.ts",
      ),
      "utf8",
    );
    const runner = fs.readFileSync(
      path.join(
        repositoryRoot,
        "functions/tests/emulator/runFirestoreIdempotencyEmulator.cjs",
      ),
      "utf8",
    );
    expect(cleanupSource).toContain(".limit(batchSize)");
    expect(runner).toContain("demo-aura-discovery-idempotency");
    expect(runner).not.toMatch(/\bdeploy\b|firebase\s+use/);
    expect(runner).not.toContain("aura-control-center-debb3");
    expect(FIRESTORE_DISCOVERY_INTAKE_IDEMPOTENCY_NAMESPACE_VERSION)
      .toBe("DISCOVERY_INTAKE_IDEMPOTENCY_NAMESPACE_V1");
  });
});
