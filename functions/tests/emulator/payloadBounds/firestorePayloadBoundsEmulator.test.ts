import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { generateKeyPairSync } from "node:crypto";

import { cert, deleteApp, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  DISCOVERY_COST_BOUND_POLICY_V1,
  DISCOVERY_PAYLOAD_ERROR_CODES,
  DISCOVERY_PAYLOAD_SCHEMA_VERSIONS,
  DiscoveryPayloadError,
  FirestoreDiscoveryCostBudgetRepository,
  parseCapabilityExchangeRequestV1,
  parseConversationEvaluationV1,
  parseDiscoveryCompletionPayloadV1,
  parseDocumentDownloadRequestV1,
  parsePublicDiscoveryIntakeV1,
  parseReportRequestV1,
  parseSessionResolutionRequestV1,
  payloadBytes,
} from "../../../src/discovery/payloadBounds";
import { toDiscoveryPayloadHttpsError } from
  "../../../src/discovery/discoveryPayloadHandlerSupport";

const PROJECT_ID = "demo-aura-discovery-payload-bounds";
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

async function clear(): Promise<void> {
  const host = process.env.FIRESTORE_EMULATOR_HOST ?? "";
  if (process.env.GCLOUD_PROJECT !== PROJECT_ID || !PROJECT_ID.startsWith("demo-") ||
      !/^127\.0\.0\.1:\d+$/.test(host) ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS !== undefined) {
    throw new Error("Payload-bound tests require the isolated Firestore Emulator.");
  }
  const response = await fetch(
    `http://${host}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
    { method: "DELETE" },
  );
  if (!response.ok) throw new Error(`Emulator cleanup failed: ${response.status}`);
}

const intake = () => ({
  schemaVersion: DISCOVERY_PAYLOAD_SCHEMA_VERSIONS.intake,
  companyName: "Aura Test", contactName: "Test User", email: "test@example.com",
  phone: "", jobTitle: "CEO", state: "Jalisco", city: "Guadalajara",
  employeeRange: "11-50", commercialCode: "adv123", origin: "WEBSITE",
  acquisitionSource: "DIRECT", privacyConsent: true,
  diagnosticDeliveryConsent: true, followUpConsent: false,
  marketingConsent: false, policyVersion: "DISCOVERY_PRIVACY_V1",
  idempotencyKey: "payload-test-key-0001",
});

const dossier = () => ({
  industry: "Servicios", employees: 30, schedulingMethod: "Excel",
  payrollIncidents: true, priority: "Nómina",
});

const conversation = () => ({
  schemaVersion: DISCOVERY_PAYLOAD_SCHEMA_VERSIONS.conversation,
  sessionToken: "a".repeat(64), conversationPhase: "DISCOVERY",
  authoritativeIntent: "DISCOVER_PROBLEM", authoritativeQuestion: "¿Qué ocurre?",
  engineInput: {
    companyName: "Aura Test", industry: "Servicios", currentResponse: "Usamos Excel",
    conversationHistory: [{ role: "user", content: "Usamos Excel" }],
    partialDossier: dossier(), confirmedFacts: ["Usa Excel"],
    pendingHypotheses: ["Proceso manual"], criticalMissingInformation: ["Impacto"],
    discoveryObjective: "Entender el proceso", confidenceLevel: 55,
    askedQuestions: ["¿Cómo gestionan turnos?"],
  },
});

const completion = () => ({
  schemaVersion: DISCOVERY_PAYLOAD_SCHEMA_VERSIONS.completion,
  sessionToken: "b".repeat(64),
  completion: {
    dossier: dossier(),
    conversationHistory: [{ role: "user", content: "Usamos Excel" }],
    conversationStateSnapshot: {
      industry: "Servicios", hypotheses: ["Proceso manual"], confidenceLevel: 75,
      usefulResponsesCount: 4, turnCount: 5, askedIntents: ["DISCOVER_PROBLEM"],
      askedQuestions: ["¿Cómo gestionan turnos?"], conversationPhase: "COMPLETED",
      fallbackConsecutiveCount: 0, llmModeForSession: "SHADOW",
    },
    executiveBriefingDraft: {
      summary: "Resumen", keyObservations: ["Observación"], suggestedNextSteps: ["Siguiente"],
    },
    businessAssessmentDraft: {
      score: 70, painPointsIdentified: ["Manual"], processGaps: ["Conciliación"],
    },
    radiografiaEmpresarialDraft: {
      overallStatus: "Crítico", recommendedModules: ["People Suite"], potentialSavings: "10%",
    },
    salesAdvisorContext: {
      recommendedOpeningLine: "Hola", alertFlags: ["PROCESO_MANUAL"], qualificationStatus: "QUALIFIED",
    },
  },
});

const expectCode = (operation: () => unknown, code: string) => {
  try { operation(); } catch (error) {
    expect(error).toBeInstanceOf(DiscoveryPayloadError);
    expect((error as DiscoveryPayloadError).code).toBe(code);
    return;
  }
  throw new Error(`Expected ${code}`);
};

beforeAll(() => {
  app = initializeApp({ projectId: PROJECT_ID, credential: emulatorCredential() },
    `payload-bounds-emulator-${process.pid}`);
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

describe("Strict Discovery Payload and Cost Bounds V1", () => {
  it("1. accepts and normalizes a valid public intake", () => {
    const parsed = parsePublicDiscoveryIntakeV1({ ...intake(), companyName: " A\u0301ura " });
    expect(parsed.companyName).toBe("Áura");
    expect(parsed.commercialCode).toBe("ADV123");
  });

  it("2. rejects unknown public intake fields", () => {
    expectCode(() => parsePublicDiscoveryIntakeV1({ ...intake(), surprise: true }), "UNKNOWN_FIELD");
  });

  it("3. rejects server-owned public intake fields", () => {
    expectCode(() => parsePublicDiscoveryIntakeV1({ ...intake(), tenantId: "public" }), "SERVER_OWNED_FIELD");
  });

  it("3a. rejects caller-controlled organizationId", () => {
    expectCode(() => parsePublicDiscoveryIntakeV1({ ...intake(), organizationId: "public" }), "SERVER_OWNED_FIELD");
  });

  it("3b. rejects caller-controlled id overwrite", () => {
    expectCode(() => parsePublicDiscoveryIntakeV1({ ...intake(), id: "overwrite" }), "SERVER_OWNED_FIELD");
  });

  it("4. rejects missing required consent", () => {
    expectCode(() => parsePublicDiscoveryIntakeV1({ ...intake(), privacyConsent: false }), "PAYLOAD_INVALID");
  });

  it("5. rejects invalid primitive types", () => {
    expectCode(() => parsePublicDiscoveryIntakeV1({ ...intake(), email: 7 }), "PAYLOAD_INVALID");
  });

  it("5a. maps invalid input to invalid-argument rather than an internal error", () => {
    const mapped = toDiscoveryPayloadHttpsError(new DiscoveryPayloadError("PAYLOAD_INVALID"));
    expect(mapped?.code).toBe("invalid-argument");
    expect(mapped?.message).toBe("PAYLOAD_INVALID");
  });

  it("6. bounds strings by UTF-8 bytes", () => {
    expectCode(() => parsePublicDiscoveryIntakeV1({ ...intake(), jobTitle: "😀".repeat(26) }), "STRING_TOO_LONG");
  });

  it("7. bounds total payload bytes", () => {
    expectCode(() => parsePublicDiscoveryIntakeV1({ ...intake(), companyName: "😀".repeat(1_100) }), "PAYLOAD_TOO_LARGE");
  });

  it("8. rejects control characters", () => {
    expectCode(() => parsePublicDiscoveryIntakeV1({ ...intake(), companyName: "Aura\u0000" }), "PAYLOAD_INVALID");
  });

  it("9. bounds object depth before schema parsing", () => {
    const nested: Record<string, unknown> = {};
    let cursor = nested;
    for (let index = 0; index < 8; index += 1) cursor = cursor.child = {} as Record<string, unknown>;
    expectCode(() => parsePublicDiscoveryIntakeV1({ ...intake(), nested }), "PAYLOAD_TOO_DEEP");
  });

  it("10. bounds total fields before schema parsing", () => {
    const extras = Object.fromEntries(Array.from({ length: 260 }, (_, index) => [`x${index}`, index]));
    expectCode(() => parsePublicDiscoveryIntakeV1({ ...intake(), ...extras }), "TOO_MANY_FIELDS");
  });

  it("11. accepts a strict conversation evaluation", () => {
    expect(parseConversationEvaluationV1(conversation()).engineInput.conversationHistory).toHaveLength(1);
  });

  it("12. rejects conversation history over eight items", () => {
    const value = conversation();
    value.engineInput.conversationHistory = Array.from({ length: 9 }, () => ({ role: "user", content: "x" }));
    expectCode(() => parseConversationEvaluationV1(value), "TOO_MANY_ITEMS");
  });

  it("13. rejects raw message metadata", () => {
    const value = conversation();
    value.engineInput.conversationHistory = [{ role: "user", content: "x", id: "raw" } as never];
    expectCode(() => parseConversationEvaluationV1(value), "SERVER_OWNED_FIELD");
  });

  it("14. rejects arbitrary partial dossier fields", () => {
    const value = conversation();
    value.engineInput.partialDossier = { ...dossier(), notes: "raw" } as never;
    expectCode(() => parseConversationEvaluationV1(value), "UNKNOWN_FIELD");
  });

  it("15. accepts a strict completion projection", () => {
    expect(parseDiscoveryCompletionPayloadV1(completion()).completion).toHaveProperty("dossier");
  });

  it("16. rejects raw completion routing identifiers", () => {
    const value = completion();
    (value.completion as Record<string, unknown>).linkId = "caller-owned";
    expectCode(() => parseDiscoveryCompletionPayloadV1(value), "UNKNOWN_FIELD");
  });

  it("17. rejects completion history over forty items", () => {
    const value = completion();
    value.completion.conversationHistory = Array.from({ length: 41 }, () => ({ role: "user", content: "x" }));
    expectCode(() => parseDiscoveryCompletionPayloadV1(value), "TOO_MANY_ITEMS");
  });

  it("18. accepts strict report and document contracts", () => {
    expect(parseReportRequestV1({
      schemaVersion: DISCOVERY_PAYLOAD_SCHEMA_VERSIONS.report,
      sessionId: "session", prospectId: "prospect", linkId: "link",
      reportCapabilityToken: "c".repeat(64), isInternalOnly: false,
    }).isInternalOnly).toBe(false);
    expect(parseDocumentDownloadRequestV1({
      schemaVersion: DISCOVERY_PAYLOAD_SCHEMA_VERSIONS.download,
      reportId: "report", linkId: "link", reportCapabilityToken: "c".repeat(64),
      forceRegenerate: false,
    }).forceRegenerate).toBe(false);
  });

  it("19. rejects legacy SESSION token in document download", () => {
    expectCode(() => parseDocumentDownloadRequestV1({
      schemaVersion: DISCOVERY_PAYLOAD_SCHEMA_VERSIONS.download,
      reportId: "report", linkId: "link", sessionToken: "c".repeat(64),
    }), "UNKNOWN_FIELD");
  });

  it("20. version-locks token exchange and session resolution", () => {
    expect(parseCapabilityExchangeRequestV1({
      schemaVersion: DISCOVERY_PAYLOAD_SCHEMA_VERSIONS.exchange,
      linkId: "link", oneTimeToken: "d".repeat(64),
    }).linkId).toBe("link");
    expect(parseSessionResolutionRequestV1({
      schemaVersion: DISCOVERY_PAYLOAD_SCHEMA_VERSIONS.resolution,
      linkId: "link", sessionToken: "e".repeat(64),
    }).linkId).toBe("link");
  });

  it("21. exposes exactly the twelve normalized errors", () => {
    expect(DISCOVERY_PAYLOAD_ERROR_CODES).toHaveLength(12);
    expect(new Set(DISCOVERY_PAYLOAD_ERROR_CODES).size).toBe(12);
  });

  it("22. policy contains explicit AI attempt, prompt and output bounds", () => {
    expect(DISCOVERY_COST_BOUND_POLICY_V1).toMatchObject({
      maxConversationTurns: 16, maxGeminiAttemptsPerTurn: 2,
      maxGeminiAttemptsPerSession: 32, maxPromptBytes: 24_000,
      maxModelOutputTokens: 512,
    });
  });

  it("23. conversation budget allows the exact quota", async () => {
    const repository = new FirestoreDiscoveryCostBudgetRepository(db, () => now);
    for (let index = 0; index < 16; index += 1) {
      const lease = await repository.reserveConversation("session-a");
      await repository.releaseConversation("session-a", lease);
    }
    await expect(repository.reserveConversation("session-a"))
      .rejects.toMatchObject({ code: "CONVERSATION_BUDGET_EXCEEDED" });
  });

  it("24. two simultaneous evaluations cannot hold one lease", async () => {
    const repository = new FirestoreDiscoveryCostBudgetRepository(db, () => now);
    const results = await Promise.allSettled([
      repository.reserveConversation("session-b"), repository.reserveConversation("session-b"),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
  });

  it("25. one hundred parallel downloads remain atomically bounded", async () => {
    const repository = new FirestoreDiscoveryCostBudgetRepository(db, () => now);
    const results = await Promise.allSettled(Array.from({ length: 100 }, () =>
      repository.consumeDownload("report-a")));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(3);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(97);
  });

  it("26. download window rolls over deterministically", async () => {
    const repository = new FirestoreDiscoveryCostBudgetRepository(db, () => now);
    await Promise.all([1, 2, 3].map(() => repository.consumeDownload("report-b")));
    await expect(repository.consumeDownload("report-b"))
      .rejects.toMatchObject({ code: "DOWNLOAD_LIMIT_EXCEEDED" });
    now += DISCOVERY_COST_BOUND_POLICY_V1.downloadWindowMs;
    await expect(repository.consumeDownload("report-b")).resolves.toMatchObject({ remaining: 2 });
  });

  it("27. corrupt budget counters fail closed", async () => {
    const repository = new FirestoreDiscoveryCostBudgetRepository(db, () => now);
    await repository.consumeDownload("report-corrupt");
    const snapshot = await db.collection("discovery_download_budgets_v1").get();
    await snapshot.docs[0].ref.update({ count: "corrupt" });
    await expect(repository.consumeDownload("report-corrupt"))
      .rejects.toMatchObject({ code: "COST_BOUND_CONFIGURATION_ERROR" });
  });

  it("28. report generation policy bounds dataset, PDF, attempts and timeout", () => {
    expect(DISCOVERY_COST_BOUND_POLICY_V1).toMatchObject({
      reportDatasetMaxBytes: 128_000, reportPdfMaxBytes: 5_242_880,
      reportGenerationTimeoutMs: 20_000, reportMaxLogicalAttempts: 2,
      reportMaxForcedRegenerations: 1,
    });
  });

  it("29. notification policy bounds payload, fan-out, channels and retries", () => {
    expect(DISCOVERY_COST_BOUND_POLICY_V1.notificationPayloadMaxBytes).toBe(4_096);
    expect(DISCOVERY_COST_BOUND_POLICY_V1.notificationMaxRecipients).toBe(1);
    expect(DISCOVERY_COST_BOUND_POLICY_V1.notificationChannels).toEqual(["INBOX", "PUSH"]);
    expect(DISCOVERY_COST_BOUND_POLICY_V1.notificationMaxAttempts).toBe(3);
  });

  it("30. frontend uses completion-issued REPORT capability and no public generate call", () => {
    const page = readFileSync(resolve("src/pages/DiscoverPage.tsx"), "utf8");
    expect(page).toContain("DISCOVERY_DOCUMENT_DOWNLOAD_V1");
    expect(page).toContain("reportCapabilityToken");
    expect(page).not.toContain('"generateDiscoveryReport"');
  });

  it("31. payload byte accounting is UTF-8 deterministic", () => {
    expect(payloadBytes("😀")).toBe(Buffer.byteLength(JSON.stringify("😀"), "utf8"));
    expect(payloadBytes({ a: "á" })).toBe(payloadBytes({ a: "a\u0301".normalize("NFC") }));
  });
});
