import { generateKeyPairSync } from "node:crypto";

import { cert, deleteApp, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, Timestamp, type Firestore } from "firebase-admin/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  DISCOVERY_CAPABILITY_POLICY_V1,
  DISCOVERY_CAPABILITY_VERSION,
  createDiscoveryCompletionPublicResultV1,
  createDiscoveryReportIdV1,
  hashDiscoveryCapabilityToken,
  type DiscoveryCapabilityV1,
} from "../../../src/discovery/capabilities";
import {
  DISCOVERY_CAPABILITIES_COLLECTION,
  DISCOVERY_COMPLETIONS_COLLECTION,
  DISCOVERY_COMPLETION_OUTBOX_COLLECTION,
  FirestoreDiscoveryCapabilityRepository,
  serializeDiscoveryCapabilityV1,
} from "../../../src/infrastructure/firestore/discoveryCapabilities";

const PROJECT_ID = "demo-aura-discovery-capabilities";
const EXCHANGE_TOKEN = "a".repeat(64);
const SESSION_TOKEN = "b".repeat(64);
const REPORT_TOKEN = "c".repeat(64);
const BASE_TIME = 2_000_000_000_000;

let app: App;
let db: Firestore;
let now = BASE_TIME;

function emulatorCredential() {
  const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2_048,
    privateKeyEncoding: { format: "pem", type: "pkcs8" },
    publicKeyEncoding: { format: "pem", type: "spki" },
  });
  return cert({
    projectId: PROJECT_ID,
    clientEmail: `emulator-only@${PROJECT_ID}.iam.gserviceaccount.com`,
    privateKey,
  });
}

function repository() {
  return new FirestoreDiscoveryCapabilityRepository(db, () => now);
}

async function clear(): Promise<void> {
  const host = process.env.FIRESTORE_EMULATOR_HOST ?? "";
  if (
    process.env.GCLOUD_PROJECT !== PROJECT_ID || !PROJECT_ID.startsWith("demo-") ||
    !/^127\.0\.0\.1:\d+$/.test(host) ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS !== undefined
  ) throw new Error("Capability tests require the isolated Firestore Emulator.");
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const response = await fetch(
      `http://${host}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
      { method: "DELETE" },
    );
    if (response.ok) return;
    if (response.status !== 409) {
      throw new Error(`Emulator cleanup failed: ${response.status}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Emulator cleanup remained busy.");
}

async function seedPendingLink(
  linkId = "link-a",
  token = EXCHANGE_TOKEN,
  expiresAt = now + 60_000,
): Promise<void> {
  await db.collection("market_discovery_links").doc(linkId).set({
    status: "pending",
    usageCount: 0,
    tokenHash: hashDiscoveryCapabilityToken(token),
    expiresAt: Timestamp.fromMillis(expiresAt),
    companyName: "Aura Test",
    contactName: "Test User",
    advisorUid: null,
    advisorId: null,
  });
}

async function issueSession(
  linkId = "link-a",
  exchangeToken = EXCHANGE_TOKEN,
  sessionToken = SESSION_TOKEN,
  expiresAt = now + 60_000,
) {
  await seedPendingLink(linkId, exchangeToken, expiresAt);
  const result = await repository().exchangeLegacyLink({
    linkId,
    exchangeToken,
    sessionTokenHash: hashDiscoveryCapabilityToken(sessionToken),
  });
  return { ...result, linkId, sessionToken };
}

function completionCommand(
  linkId = "link-a",
  sessionToken = SESSION_TOKEN,
  requestHash = hashDiscoveryCapabilityToken("request-one"),
) {
  return {
    linkId,
    sessionToken,
    requestHash,
    reportCapabilityHash: hashDiscoveryCapabilityToken(REPORT_TOKEN),
    effect: async (context: { dossierId: string }) => ({
      dossierData: {
        id: context.dossierId,
        linkId,
        companyName: "Aura Test",
        contactName: "Test User",
      },
      prospectId: null,
      resolutionStatus: null,
      trustDecision: "ALLOW_FULL",
      companyName: "Aura Test",
      prospectName: "Test User",
      advisorUid: null,
      advisorId: null,
      shadowEvaluationContext: null,
    }),
  };
}

async function issueCompleted(linkId = "link-a") {
  const issued = await issueSession(linkId);
  const result = await repository().completeWithEffect(completionCommand(linkId));
  return { issued, result };
}

beforeAll(() => {
  app = initializeApp({ projectId: PROJECT_ID, credential: emulatorCredential() },
    `capability-emulator-${process.pid}`);
  db = getFirestore(app);
});

beforeEach(async () => {
  now = BASE_TIME;
  await clear();
});

afterAll(async () => {
  await db.terminate();
  await deleteApp(app);
});

describe("Discovery Capability Lifecycle V1", () => {
  it("1. valid exchange creates a SESSION capability", async () => {
    const issued = await issueSession();
    const cap = await db.collection(DISCOVERY_CAPABILITIES_COLLECTION)
      .doc(hashDiscoveryCapabilityToken(SESSION_TOKEN)).get();
    expect(cap.data()).toMatchObject({
      version: DISCOVERY_CAPABILITY_VERSION,
      type: "SESSION",
      linkId: "link-a",
      sessionId: issued.sessionId,
      tokenHash: hashDiscoveryCapabilityToken(SESSION_TOKEN),
    });
    expect(JSON.stringify(cap.data())).not.toContain(SESSION_TOKEN);
  });

  it("2. consumed exchange fails on reuse", async () => {
    await issueSession();
    await expect(repository().exchangeLegacyLink({
      linkId: "link-a", exchangeToken: EXCHANGE_TOKEN,
      sessionTokenHash: hashDiscoveryCapabilityToken("d".repeat(64)),
    })).rejects.toMatchObject({ code: "CAPABILITY_ALREADY_CONSUMED" });
  });

  it("3. expired exchange fails", async () => {
    await seedPendingLink("link-a", EXCHANGE_TOKEN, now - 1);
    await expect(repository().exchangeLegacyLink({
      linkId: "link-a", exchangeToken: EXCHANGE_TOKEN,
      sessionTokenHash: hashDiscoveryCapabilityToken(SESSION_TOKEN),
    })).rejects.toMatchObject({ code: "CAPABILITY_EXPIRED" });
  });

  it("4. expired SESSION fails before completion", async () => {
    await issueSession();
    now += 60_001;
    await expect(repository().completeWithEffect(completionCommand()))
      .rejects.toMatchObject({ code: "CAPABILITY_EXPIRED" });
    expect((await db.collection("discovery_sessions").get()).size).toBe(0);
  });

  it("5. revoked SESSION fails", async () => {
    await issueSession();
    await repository().revoke(hashDiscoveryCapabilityToken(SESSION_TOKEN), "TEST");
    await expect(repository().completeWithEffect(completionCommand()))
      .rejects.toMatchObject({ code: "CAPABILITY_REVOKED" });
  });

  it("6. SESSION A cannot authorize link/session B", async () => {
    await issueSession("link-a", EXCHANGE_TOKEN, SESSION_TOKEN);
    await issueSession("link-b", "d".repeat(64), "e".repeat(64));
    await expect(repository().authorizeSession({ token: SESSION_TOKEN, linkId: "link-b" }))
      .rejects.toMatchObject({ code: "CAPABILITY_BINDING_MISMATCH" });
  });

  it("7. incorrect capability type fails", async () => {
    await issueSession();
    await expect(repository().authorizeSession({ token: EXCHANGE_TOKEN, linkId: "link-a" }))
      .rejects.toMatchObject({ code: "CAPABILITY_TYPE_MISMATCH" });
  });

  it("8. incorrect generation fails", async () => {
    await issueSession();
    await db.collection("market_discovery_links").doc("link-a")
      .update({ sessionCapabilityGeneration: 2 });
    await expect(repository().authorizeSession({ token: SESSION_TOKEN, linkId: "link-a" }))
      .rejects.toMatchObject({ code: "CAPABILITY_GENERATION_MISMATCH" });
  });

  it("9. valid completion creates one deterministic dossier", async () => {
    const { result } = await issueCompleted();
    expect(result.kind).toBe("NEW");
    expect((await db.collection("discovery_sessions").get()).size).toBe(1);
    expect((await db.collection("discovery_sessions").doc(result.completion.dossierId).get()).exists)
      .toBe(true);
  });

  it("10. identical replay returns the equivalent result", async () => {
    await issueSession();
    const first = await repository().completeWithEffect(completionCommand());
    const replay = await repository().completeWithEffect(completionCommand());
    expect(replay.kind).toBe("REPLAY");
    expect(replay.completion).toEqual(first.completion);
  });

  it("11. conflicting replay fails closed", async () => {
    await issueCompleted();
    await expect(repository().completeWithEffect(completionCommand(
      "link-a", SESSION_TOKEN, hashDiscoveryCapabilityToken("request-two"),
    ))).rejects.toMatchObject({ code: "COMPLETION_REQUEST_CONFLICT" });
  });

  it("12. two simultaneous completions converge", async () => {
    await issueSession();
    const results = await Promise.all([
      repository().completeWithEffect(completionCommand()),
      repository().completeWithEffect(completionCommand()),
    ]);
    expect(results.map((result) => result.completion.completionId).every(
      (id) => id === results[0].completion.completionId,
    )).toBe(true);
    expect((await db.collection("discovery_sessions").get()).size).toBe(1);
  });

  it("13. one hundred simultaneous completions converge", async () => {
    await issueSession();
    const results = await Promise.all(Array.from({ length: 100 }, () =>
      repository().completeWithEffect(completionCommand())));
    expect(new Set(results.map((result) => result.completion.completionId)).size).toBe(1);
    expect((await db.collection("discovery_sessions").get()).size).toBe(1);
  });

  it("14. completion persists one logical event ID", async () => {
    const { result } = await issueCompleted();
    expect(result.completion.eventId).toMatch(/^discovery_completed_/);
    expect((await db.collection(DISCOVERY_COMPLETIONS_COLLECTION).get()).size).toBe(1);
    const events = await db.collection("platform_events").get();
    expect(events.size).toBe(1);
    expect(events.docs[0].id).toBe(result.completion.eventId);
  });

  it("15. completion persists one stable notification key", async () => {
    const { result } = await issueCompleted();
    expect(result.completion.notificationKey)
      .toBe(`discovery.completed:${result.completion.sessionId}`);
    expect((await db.collection(DISCOVERY_COMPLETION_OUTBOX_COLLECTION).get()).size).toBe(1);
  });

  it("16. completion emits one REPORT capability", async () => {
    await issueCompleted();
    const capabilities = await db.collection(DISCOVERY_CAPABILITIES_COLLECTION)
      .where("type", "==", "REPORT").get();
    expect(capabilities.size).toBe(1);
  });

  it("17. SESSION capability cannot authorize report access", async () => {
    const { result } = await issueCompleted();
    await expect(repository().authorizeReport({
      token: SESSION_TOKEN, reportId: result.completion.reportId, linkId: "link-a",
    })).rejects.toMatchObject({ code: "REPORT_CAPABILITY_REQUIRED" });
  });

  it("18. REPORT capability cannot authorize completion", async () => {
    await issueCompleted();
    await expect(repository().completeWithEffect(completionCommand("link-a", REPORT_TOKEN)))
      .rejects.toMatchObject({ code: "CAPABILITY_TYPE_MISMATCH" });
  });

  it("19. expired REPORT capability fails", async () => {
    const { result } = await issueCompleted();
    now += DISCOVERY_CAPABILITY_POLICY_V1.reportTtlMs;
    await expect(repository().authorizeReport({
      token: REPORT_TOKEN, reportId: result.completion.reportId, linkId: "link-a",
    })).rejects.toMatchObject({ code: "CAPABILITY_EXPIRED" });
  });

  it("20. revoked REPORT capability fails", async () => {
    const { result } = await issueCompleted();
    await repository().revoke(hashDiscoveryCapabilityToken(REPORT_TOKEN), "TEST");
    await expect(repository().authorizeReport({
      token: REPORT_TOKEN, reportId: result.completion.reportId, linkId: "link-a",
    })).rejects.toMatchObject({ code: "CAPABILITY_REVOKED" });
  });

  it("21. REPORT capability cannot cross dossier/session", async () => {
    await issueCompleted();
    await expect(repository().authorizeReport({
      token: REPORT_TOKEN,
      reportId: createDiscoveryReportIdV1("dossier_other_g1"),
      linkId: "link-a",
    })).rejects.toMatchObject({ code: "CAPABILITY_BINDING_MISMATCH" });
  });

  it("22-23. public response omits CRM match fields", async () => {
    const { result } = await issueCompleted();
    const response = createDiscoveryCompletionPublicResultV1(result.completion, REPORT_TOKEN);
    expect(response).toEqual({
      dossierId: result.completion.dossierId,
      reportId: result.completion.reportId,
      reportCapabilityToken: REPORT_TOKEN,
      trustDecision: "ALLOW_FULL",
    });
    expect(response).not.toHaveProperty("prospectId");
    expect(response).not.toHaveProperty("resolutionStatus");
  });

  it("24. transaction conflict retries do not duplicate durable effects", async () => {
    await issueSession();
    await Promise.all(Array.from({ length: 12 }, () =>
      repository().completeWithEffect(completionCommand())));
    expect((await db.collection(DISCOVERY_COMPLETIONS_COLLECTION).get()).size).toBe(1);
    expect((await db.collection(DISCOVERY_COMPLETION_OUTBOX_COLLECTION).get()).size).toBe(1);
  });

  it("25. timeout/caller retry preserves all deterministic IDs", async () => {
    await issueSession();
    const first = await repository().completeWithEffect(completionCommand());
    const retry = await repository().completeWithEffect(completionCommand());
    expect(retry.completion).toMatchObject({
      completionId: first.completion.completionId,
      dossierId: first.completion.dossierId,
      reportId: first.completion.reportId,
      eventId: first.completion.eventId,
      notificationKey: first.completion.notificationKey,
      reportCapabilityHash: first.completion.reportCapabilityHash,
    });
  });

  it("26. corrupt capability fails closed", async () => {
    const token = "f".repeat(64);
    await seedPendingLink();
    await db.collection(DISCOVERY_CAPABILITIES_COLLECTION)
      .doc(hashDiscoveryCapabilityToken(token)).set({ version: "UNKNOWN" });
    await expect(repository().authorizeSession({ token, linkId: "link-a" }))
      .rejects.toMatchObject({ code: "COMPLETION_INTERNAL_FAILURE" });
  });

  it("27. legacy session record without V1 capability fails closed", async () => {
    await db.collection("market_discovery_links").doc("legacy-link").set({
      status: "pending",
      sessionTokenHash: hashDiscoveryCapabilityToken(SESSION_TOKEN),
      sessionTokenExpiresAt: Timestamp.fromMillis(now + 60_000),
    });
    await expect(repository().authorizeSession({
      token: SESSION_TOKEN, linkId: "legacy-link",
    })).rejects.toMatchObject({ code: "CAPABILITY_NOT_FOUND" });
  });

  it("revocation is idempotent and preserves the first reason", async () => {
    await issueSession();
    const hash = hashDiscoveryCapabilityToken(SESSION_TOKEN);
    await repository().revoke(hash, "FIRST");
    now += 1;
    await repository().revoke(hash, "SECOND");
    const cap = (await db.collection(DISCOVERY_CAPABILITIES_COLLECTION).doc(hash).get()).data();
    expect(cap).toMatchObject({ revocationReason: "FIRST" });
  });

  it("REPORT rotation atomically advances generation and revokes the old hash", async () => {
    await issueCompleted();
    const nextToken = "9".repeat(64);
    const next = await repository().rotateReportCapability({
      currentTokenHash: hashDiscoveryCapabilityToken(REPORT_TOKEN),
      nextTokenHash: hashDiscoveryCapabilityToken(nextToken),
      reason: "ROTATED_FOR_TEST",
    });
    expect(next.generation).toBe(2);
    await expect(repository().authorizeReport({
      token: REPORT_TOKEN, reportId: next.subjectId, linkId: next.linkId,
    })).rejects.toMatchObject({ code: "CAPABILITY_REVOKED" });
    await expect(repository().authorizeReport({
      token: nextToken, reportId: next.subjectId, linkId: next.linkId,
    })).resolves.toMatchObject({ capability: { generation: 2 } });
  });

  it("serialization rejects plaintext and retains all V1 lifecycle fields", () => {
    const capability: DiscoveryCapabilityV1 = {
      version: DISCOVERY_CAPABILITY_VERSION,
      type: "REPORT", subjectId: "report", linkId: "link",
      sessionId: "session", audience: "PUBLIC_DISCOVERY",
      purpose: "DISCOVERY_REPORT", generation: 1,
      tokenHash: hashDiscoveryCapabilityToken(REPORT_TOKEN),
      issuedAt: now, expiresAt: now + 1_000,
      consumedAt: null, completedAt: now, revokedAt: null,
      revocationReason: null, createdAt: now, updatedAt: now,
    };
    const serialized = serializeDiscoveryCapabilityV1(capability);
    expect(serialized).not.toHaveProperty("token");
    expect(serialized).not.toHaveProperty("plaintext");
    expect(serialized).toHaveProperty("tokenHash", capability.tokenHash);
  });
});
