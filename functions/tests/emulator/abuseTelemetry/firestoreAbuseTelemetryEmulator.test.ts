import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { generateKeyPairSync } from "node:crypto";

import { cert, deleteApp, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  STRUCTURED_ABUSE_EVENT_TYPES,
  STRUCTURED_ABUSE_TELEMETRY_VERSION,
  StructuredAbuseTelemetryError,
  StructuredAbuseTelemetryRecorder,
  deriveTelemetryDerivedSubjectV1,
  deriveTelemetryIdentifierV1,
  deriveTelemetrySubjectHashV1,
  normalizeTelemetryReasonCodeV1,
  serializeStructuredAbuseTelemetryEventV1,
  validateStructuredAbuseTelemetryEventV1,
  type StructuredAbuseTelemetryCommandV1,
  type StructuredAbuseTelemetryEventV1,
  type StructuredAbuseTelemetryRepository,
} from "../../../src/discovery/telemetry";
import {
  DISCOVERY_ABUSE_METRICS_COLLECTION,
  DISCOVERY_ABUSE_TELEMETRY_COLLECTION,
  FirestoreStructuredAbuseTelemetryRepository,
} from "../../../src/infrastructure/firestore/discoveryTelemetry";

const PROJECT_ID = "demo-aura-discovery-abuse-telemetry";
const BASE_TIME = Date.parse("2033-05-18T12:00:00.000Z");
const DATE = "2033-05-18";
let app: App;
let db: Firestore;

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

async function clear(): Promise<void> {
  const host = process.env.FIRESTORE_EMULATOR_HOST ?? "";
  if (process.env.GCLOUD_PROJECT !== PROJECT_ID || !PROJECT_ID.startsWith("demo-") ||
      !/^127\.0\.0\.1:\d+$/.test(host) ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS !== undefined) {
    throw new Error("Telemetry tests require the isolated Firestore Emulator.");
  }
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const response = await fetch(
      `http://${host}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
      { method: "DELETE" },
    );
    if (response.ok) return;
    if (response.status !== 409) throw new Error(`Cleanup failed: ${response.status}`);
    await new Promise((done) => setTimeout(done, 100));
  }
  throw new Error("Emulator cleanup remained busy.");
}

function command(
  index = 1,
  overrides: Partial<StructuredAbuseTelemetryCommandV1> = {},
): StructuredAbuseTelemetryCommandV1 {
  return {
    eventType: "intake.accepted",
    source: "telemetryTest",
    component: "discovery.intake",
    outcome: "ACCEPTED",
    reasonCode: "INTAKE_ACCEPTED",
    durationMs: 25,
    environment: "TEST",
    correlationKey: "correlation-one",
    requestKey: `request-${index}`,
    subject: deriveTelemetrySubjectHashV1(`user-${index}@example.test`, "test-secret"),
    measurements: { requests: 1 },
    timestamp: BASE_TIME,
    ...overrides,
  };
}

function repository() {
  return new FirestoreStructuredAbuseTelemetryRepository(db);
}

function recorder(now = BASE_TIME) {
  return new StructuredAbuseTelemetryRecorder(repository(), () => now);
}

beforeAll(() => {
  app = initializeApp({ projectId: PROJECT_ID, credential: emulatorCredential() },
    `abuse-telemetry-emulator-${process.pid}`);
  db = getFirestore(app);
});

beforeEach(clear);

afterAll(async () => {
  await db.terminate();
  await deleteApp(app);
});

describe("Structured Abuse Telemetry V1", () => {
  it("1. publishes the complete minimum event inventory", () => {
    expect(STRUCTURED_ABUSE_EVENT_TYPES).toEqual([
      "intake.accepted", "intake.rejected", "payload.invalid",
      "rateLimit.allowed", "rateLimit.denied",
      "idempotency.replay", "idempotency.expired",
      "capability.accepted", "capability.rejected",
      "completion.started", "completion.completed", "completion.replayed",
      "report.generated", "report.denied",
      "notification.emitted", "notification.skipped",
      "download.authorized", "download.denied",
    ]);
  });

  it("2. emits all eighteen event types through the provider-neutral port", async () => {
    for (const [index, eventType] of STRUCTURED_ABUSE_EVENT_TYPES.entries()) {
      await recorder().record(command(index, {
        eventType,
        outcome: eventType.endsWith("denied") || eventType.endsWith("rejected")
          ? "DENIED" : eventType.endsWith("replay") || eventType.endsWith("replayed")
            ? "REPLAYED" : "ACCEPTED",
        reasonCode: eventType.replace(/[.]/g, "_").toUpperCase(),
      }));
    }
    expect((await db.collection(DISCOVERY_ABUSE_TELEMETRY_COLLECTION).get()).size).toBe(18);
    expect((await repository().readDailyAggregate({ date: DATE, scope: "global" }))?.eventCount)
      .toBe(18);
  });

  it("3. creates a deterministic event ID independent of timestamp", async () => {
    const first = await recorder(BASE_TIME).record(command(1, { timestamp: BASE_TIME }));
    const second = await recorder(BASE_TIME + 5_000).record(command(1, { timestamp: BASE_TIME + 5_000 }));
    expect(second.event.eventId).toBe(first.event.eventId);
    expect(second.decision).toBe("REPLAY");
  });

  it("4. deterministic replay does not double-count metrics", async () => {
    await recorder().record(command());
    await recorder().record(command());
    const aggregate = await repository().readDailyAggregate({ date: DATE, scope: "global" });
    expect(aggregate?.eventCount).toBe(1);
    expect(aggregate?.measurements.requests).toBe(1);
  });

  it("5. correlation IDs converge while request IDs remain distinct", async () => {
    const first = await recorder().record(command(1));
    const second = await recorder().record(command(2));
    expect(first.event.correlationId).toBe(second.event.correlationId);
    expect(first.event.requestId).not.toBe(second.event.requestId);
  });

  it("6. HMAC subject hashes are deterministic and secret-scoped", () => {
    const first = deriveTelemetrySubjectHashV1("person@example.test", "secret-a");
    const again = deriveTelemetrySubjectHashV1("person@example.test", "secret-a");
    const other = deriveTelemetrySubjectHashV1("person@example.test", "secret-b");
    expect(first).toEqual(again);
    expect(first.hash).not.toBe(other.hash);
    expect(first.hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("7. derived identifiers never retain source identifiers", () => {
    const subject = deriveTelemetryDerivedSubjectV1("dossier-sensitive-looking-id");
    expect(subject.hash).not.toContain("dossier");
    expect(subject.hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("8. serialized events contain no arbitrary fields", async () => {
    const unsafe = { ...command(), email: "person@example.test", token: "secret-token" };
    const result = await recorder().record(unsafe as StructuredAbuseTelemetryCommandV1);
    const serialized = JSON.stringify(serializeStructuredAbuseTelemetryEventV1(result.event));
    expect(serialized).not.toContain("person@example.test");
    expect(serialized).not.toContain("secret-token");
    expect(serialized).not.toContain('"email"');
    expect(serialized).not.toContain('"token"');
  });

  it("9. validator rejects forbidden PII keys even under runtime casts", async () => {
    const event = (await recorder().record(command())).event;
    expect(() => validateStructuredAbuseTelemetryEventV1({
      ...event, email: "person@example.test",
    } as StructuredAbuseTelemetryEventV1)).toThrowError(
      expect.objectContaining({ code: "TELEMETRY_REDACTION_FAILED" }),
    );
  });

  it("10. Firestore documents contain no PII, token, signed URL, prompt, or model response", async () => {
    await recorder().record(command());
    const document = (await db.collection(DISCOVERY_ABUSE_TELEMETRY_COLLECTION).get()).docs[0].data();
    const serialized = JSON.stringify(document);
    for (const forbidden of [
      "user-1@example.test", "phone", "token", "capability", "signedUrl",
      "downloadUrl", "geminiPrompt", "geminiResponse",
    ]) expect(serialized).not.toContain(forbidden);
  });

  it("11. malformed reason codes fail closed", async () => {
    await expect(recorder().record(command(1, { reasonCode: "bad reason" })))
      .rejects.toBeInstanceOf(StructuredAbuseTelemetryError);
  });

  it("12. malformed subject hashes fail closed", async () => {
    await expect(recorder().record(command(1, {
      subject: { scheme: "HMAC_SHA256_V1", hash: "plaintext@example.test" },
    }))).rejects.toBeInstanceOf(StructuredAbuseTelemetryError);
  });

  it("13. negative, fractional, or excessive metrics fail closed", async () => {
    await expect(recorder().record(command(1, { measurements: { requests: -1 } })))
      .rejects.toBeInstanceOf(StructuredAbuseTelemetryError);
    await expect(recorder().record(command(2, { measurements: { pdfBytes: 1.5 } })))
      .rejects.toBeInstanceOf(StructuredAbuseTelemetryError);
  });

  it("14. daily aggregates sum requests, rejects, retries, replays, and AI cost", async () => {
    await recorder().record(command(1, {
      measurements: { requests: 1, retries: 2, aiAttempts: 2, aiInputBytes: 1_000 },
    }));
    await recorder().record(command(2, {
      eventType: "intake.rejected", outcome: "REJECTED", reasonCode: "PAYLOAD_INVALID",
      measurements: { requests: 1, rejections: 1, replays: 1 },
    }));
    const aggregate = await repository().readDailyAggregate({ date: DATE, scope: "global" });
    expect(aggregate).toMatchObject({ eventCount: 2, rejectionCount: 1, retryCount: 2 });
    expect(aggregate?.measurements).toMatchObject({
      requests: 2, rejections: 1, replays: 1, aiAttempts: 2, aiInputBytes: 1_000,
    });
  });

  it("15. PDF, download, and notification costs aggregate independently", async () => {
    await recorder().record(command(1, {
      eventType: "report.generated", outcome: "COMPLETED", reasonCode: "REPORT_GENERATED",
      measurements: { pdfs: 1, pdfBytes: 42_000 },
    }));
    await recorder().record(command(2, {
      eventType: "download.authorized", outcome: "ALLOWED", reasonCode: "DOWNLOAD_ALLOWED",
      measurements: { downloads: 1 },
    }));
    await recorder().record(command(3, {
      eventType: "notification.emitted", outcome: "EMITTED", reasonCode: "NOTIFICATION_EMITTED",
      measurements: { notifications: 1 },
    }));
    expect((await repository().readDailyAggregate({ date: DATE, scope: "global" }))?.measurements)
      .toMatchObject({ pdfs: 1, pdfBytes: 42_000, downloads: 1, notifications: 1 });
  });

  it("16. latency exposes count, total, and max without raw traces", async () => {
    await recorder().record(command(1, { durationMs: 25 }));
    await recorder().record(command(2, { durationMs: 80 }));
    expect(await repository().readDailyAggregate({ date: DATE, scope: "global" }))
      .toMatchObject({ durationCount: 2, durationTotalMs: 105, durationMaxMs: 80 });
  });

  it("17. bounded cardinality buckets record subjects without their values", async () => {
    await recorder().record(command(1));
    await recorder().record(command(2));
    const aggregate = await repository().readDailyAggregate({ date: DATE, scope: "global" });
    expect(aggregate?.cardinalityBuckets).toHaveLength(64);
    expect(aggregate?.cardinalityBuckets.filter(Boolean).length).toBeGreaterThan(0);
    expect(JSON.stringify(aggregate)).not.toContain("user-1@example.test");
  });

  it("18. event and component scopes support provider-neutral dashboards", async () => {
    await recorder().record(command());
    expect((await repository().readDailyAggregate({
      date: DATE, scope: "event:intake.accepted",
    }))?.eventCount).toBe(1);
    expect((await repository().readDailyAggregate({
      date: DATE, scope: "component:discovery.intake",
    }))?.eventCount).toBe(1);
  });

  it("19. concurrent unique events preserve exact aggregate counts", async () => {
    const results = await Promise.all(Array.from({ length: 20 }, (_, index) =>
      recorder().record(command(index + 1))));
    expect(results.every((result) => result.decision === "CREATED")).toBe(true);
    expect((await repository().readDailyAggregate({ date: DATE, scope: "global" }))?.eventCount)
      .toBe(20);
  });

  it("20. concurrent duplicate events increment aggregates once", async () => {
    const results = await Promise.all(Array.from({ length: 20 }, () =>
      recorder().record(command(1))));
    expect(results.filter((result) => result.decision === "CREATED")).toHaveLength(1);
    expect((await repository().readDailyAggregate({ date: DATE, scope: "global" }))?.eventCount)
      .toBe(1);
  });

  it("21. corrupt aggregates fail closed instead of resetting counters", async () => {
    const id = deriveTelemetryIdentifierV1("metric", `${DATE}|global`);
    await db.collection(DISCOVERY_ABUSE_METRICS_COLLECTION).doc(id).set({
      version: STRUCTURED_ABUSE_TELEMETRY_VERSION,
      eventCount: "corrupt",
      cardinalityBuckets: Array.from({ length: 64 }, () => false),
      measurements: {},
    });
    await expect(recorder().record(command())).rejects.toBeInstanceOf(
      StructuredAbuseTelemetryError,
    );
    expect((await db.collection(DISCOVERY_ABUSE_TELEMETRY_COLLECTION).get()).size).toBe(0);
  });

  it("22. event retention is versioned and bounded to thirty days", async () => {
    const event = (await recorder().record(command())).event;
    expect(event.expiresAt - event.timestamp).toBe(30 * 24 * 60 * 60 * 1_000);
    expect(event.version).toBe(STRUCTURED_ABUSE_TELEMETRY_VERSION);
  });

  it("23. recorder works with a non-Firestore repository port", async () => {
    const events: StructuredAbuseTelemetryEventV1[] = [];
    const memory: StructuredAbuseTelemetryRepository = {
      record: async (event) => {
        events.push(event);
        return { decision: "CREATED" };
      },
    };
    await new StructuredAbuseTelemetryRecorder(memory, () => BASE_TIME).record(command());
    expect(events).toHaveLength(1);
  });

  it("24. instrumented notification logs no longer print raw payloads or exceptions", () => {
    const source = readFileSync(resolve(
      "functions/src/notifications/emitDiscoveryCompletedNotification.ts",
    ), "utf8");
    expect(source).not.toContain('console.error("Invalid payload structure", payload)');
    expect(source).not.toContain('console.error("Error emitting discovery completed notification", error)');
    expect(source).not.toContain("{ responseData }");
  });

  it("25. arbitrary exception messages cannot become reason codes", () => {
    const reason = normalizeTelemetryReasonCodeV1(
      new Error("Failure for person@example.test with token secret-token"),
    );
    expect(reason).toBe("INTERNAL_FAILURE");
    expect(reason).not.toContain("PERSON");
  });
});
