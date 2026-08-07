import { generateKeyPairSync } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cert, deleteApp, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, Timestamp, type Firestore } from "firebase-admin/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  DISCOVERY_CONTAINMENT_POLICY_SCHEMA_VERSION,
  DISCOVERY_EMERGENCY_QUOTA_OPERATIONS,
  DefaultDiscoveryContainmentEvaluator,
  DiscoveryContainmentError,
  P2DiscoveryEmergencyQuotaConsumer,
  PREVIEW_CONTAINMENT_ACTIVATION_REQUEST_SCHEMA_VERSION,
  PREVIEW_CONTAINMENT_POLICY_PROPOSAL_SCHEMA_VERSION,
  PreviewContainmentActivationControlPlaneV1,
  deriveBlockedCommercialCodeHashV1,
  enforceDiscoveryContainmentV1,
  fingerprintPreviewContainmentPolicyV1,
  type DiscoveryContainmentEnvironment,
  type DiscoveryContainmentPolicyV1,
  type DiscoveryContainmentSurface,
  type DiscoveryEmergencyGlobalQuotaV1,
  type PreviewContainmentActivationRequestV1,
  type PreviewContainmentPolicyProposalV1,
} from "../../../src/discovery/containment";
import { STRUCTURED_ABUSE_CONTAINMENT_EVENT_TYPES_V2 } from
  "../../../src/discovery/telemetry";
import {
  DISCOVERY_ABUSE_TELEMETRY_COLLECTION,
} from "../../../src/infrastructure/firestore/discoveryTelemetry";
import {
  DISCOVERY_CONTAINMENT_ACTIVE_COLLECTION,
  DISCOVERY_CONTAINMENT_AUDIT_COLLECTION,
  DISCOVERY_CONTAINMENT_POLICIES_COLLECTION,
  FirestoreDiscoveryContainmentPolicyProvider,
  FirestoreDiscoveryContainmentRepository,
  FirestorePreviewContainmentActivationStoreV1,
  buildDiscoveryContainmentPolicyDocumentId,
} from "../../../src/infrastructure/firestore/discoveryContainment";
import { FirestoreRateLimitRepository } from
  "../../../src/infrastructure/firestore/rateLimits";

const PROJECT_ID = "demo-aura-discovery-containment";
const BASE_TIME = Date.parse("2034-06-15T12:00:00.000Z");
const SECRET = "containment-emulator-secret-with-at-least-32-bytes";
let app: App;
let db: Firestore;
const PREVIEW_TENANT_ID = `tenant-${"a".repeat(32)}`;
let authorityDecision: "ALLOW" | "DENY" = "ALLOW";

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
    throw new Error("Containment tests require the isolated Firestore Emulator.");
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

function quota(
  overrides: Partial<Record<keyof DiscoveryEmergencyGlobalQuotaV1,
    Partial<DiscoveryEmergencyGlobalQuotaV1[keyof DiscoveryEmergencyGlobalQuotaV1]>>> = {},
): DiscoveryEmergencyGlobalQuotaV1 {
  return Object.freeze(Object.fromEntries(DISCOVERY_EMERGENCY_QUOTA_OPERATIONS.map(
    (operation) => [operation, Object.freeze({
      enabled: false, windowSeconds: 60, maxRequests: 100, burst: 0,
      ...(overrides[operation] ?? {}),
    })],
  ))) as DiscoveryEmergencyGlobalQuotaV1;
}

function policy(
  policyVersion = "p1",
  overrides: Partial<DiscoveryContainmentPolicyV1> = {},
): DiscoveryContainmentPolicyV1 {
  return {
    version: DISCOVERY_CONTAINMENT_POLICY_SCHEMA_VERSION,
    policyVersion,
    environment: "LOCAL_DEMO",
    publicIntakeEnabled: true,
    advisorCodeResolutionEnabled: true,
    tokenIssuanceEnabled: true,
    sessionResolutionEnabled: true,
    sessionCompletionEnabled: true,
    conversationAiEnabled: true,
    externalReportGenerationEnabled: true,
    documentDownloadEnabled: true,
    notificationFanoutEnabled: true,
    blockedAppIds: [],
    blockedCommercialCodeHashes: [],
    emergencyGlobalQuota: quota(),
    reason: "EMULATOR_CERTIFICATION",
    ownerRole: "SECURITY_OPERATOR",
    approvedByRole: "SECURITY_APPROVER",
    createdAt: BASE_TIME - 10_000,
    updatedAt: BASE_TIME - 5_000,
    expiresAt: BASE_TIME + 86_400_000,
    rollbackVersion: null,
    status: "ACTIVE",
    ...overrides,
  };
}

function serializeRawPolicy(value: DiscoveryContainmentPolicyV1) {
  return {
    ...value,
    blockedAppIds: [...value.blockedAppIds],
    blockedCommercialCodeHashes: [...value.blockedCommercialCodeHashes],
    emergencyGlobalQuota: Object.fromEntries(Object.entries(value.emergencyGlobalQuota)
      .map(([key, rule]) => [key, { ...rule }])),
    createdAt: Timestamp.fromMillis(value.createdAt),
    updatedAt: Timestamp.fromMillis(value.updatedAt),
    expiresAt: Timestamp.fromMillis(value.expiresAt),
  };
}

async function writeRawPolicy(value: DiscoveryContainmentPolicyV1): Promise<void> {
  await db.collection(DISCOVERY_CONTAINMENT_POLICIES_COLLECTION)
    .doc(buildDiscoveryContainmentPolicyDocumentId(value.environment, value.policyVersion))
    .set(serializeRawPolicy(value));
}

async function activate(value: DiscoveryContainmentPolicyV1) {
  return new FirestoreDiscoveryContainmentRepository(db).activatePolicy({
    policy: value,
    actorRole: value.ownerRole,
    approverRole: value.approvedByRole,
    reasonCode: "EMULATOR_POLICY_CHANGE",
  });
}

function evaluator(environment: DiscoveryContainmentEnvironment = "LOCAL_DEMO") {
  const clock = { nowEpochMilliseconds: () => BASE_TIME };
  const core = new DefaultDiscoveryContainmentEvaluator(
    new FirestoreDiscoveryContainmentPolicyProvider(db),
    new P2DiscoveryEmergencyQuotaConsumer(new FirestoreRateLimitRepository(db), clock),
    clock,
  );
  return (surface: DiscoveryContainmentSurface, input: Readonly<{
    appId?: string; commercialCodeHash?: string;
  }> = {}) => core.evaluate({ surface, environment, ...input });
}

function activationRequest(
  overrides: Partial<PreviewContainmentActivationRequestV1> = {},
): PreviewContainmentActivationRequestV1 {
  return {
    schemaVersion: PREVIEW_CONTAINMENT_ACTIVATION_REQUEST_SCHEMA_VERSION,
    requestId: "request-0001",
    correlationId: "correlation-0001",
    actor: "SECURITY_OPERATOR",
    approver: "SECURITY_APPROVER",
    reason: "PREVIEW_CONTAINMENT_ACTIVATION",
    environment: "PREVIEW",
    projectId: "aura-intel-preview",
    region: "us-central1",
    tenantId: PREVIEW_TENANT_ID,
    expectedCurrentVersion: null,
    proposedVersion: "preview-policy-v1",
    idempotencyKey: "idempotency-0001",
    dryRun: false,
    apply: true,
    ...overrides,
  };
}

function activationProposal(
  overrides: Partial<PreviewContainmentPolicyProposalV1> = {},
): PreviewContainmentPolicyProposalV1 {
  return {
    schemaVersion: PREVIEW_CONTAINMENT_POLICY_PROPOSAL_SCHEMA_VERSION,
    policyVersion: "preview-policy-v1",
    tenantId: PREVIEW_TENANT_ID,
    publicIntakeEnabled: true,
    advisorCodeResolutionEnabled: true,
    tokenIssuanceEnabled: true,
    sessionResolutionEnabled: true,
    sessionCompletionEnabled: true,
    conversationAiEnabled: true,
    externalReportGenerationEnabled: false,
    documentDownloadEnabled: false,
    notificationFanoutEnabled: false,
    blockedAppIds: [],
    blockedCommercialCodeHashes: [],
    emergencyGlobalQuota: quota(),
    reason: "PREVIEW_CONTAINMENT_ACTIVATION",
    ownerRole: "SECURITY_OPERATOR",
    approvedByRole: "SECURITY_APPROVER",
    ttlSeconds: 86_400,
    rollbackVersion: null,
    status: "ACTIVE",
    ...overrides,
  };
}

function activationControlPlane(now = BASE_TIME) {
  return new PreviewContainmentActivationControlPlaneV1(
    PREVIEW_TENANT_ID,
    { verify: async () => authorityDecision },
    new FirestorePreviewContainmentActivationStoreV1(db),
    { nowEpochMilliseconds: () => now },
  );
}

beforeAll(() => {
  app = initializeApp({ projectId: PROJECT_ID, credential: emulatorCredential() },
    `containment-emulator-${process.pid}`);
  db = getFirestore(app);
});

beforeEach(async () => {
  authorityDecision = "ALLOW";
  await clear();
});

afterAll(async () => {
  await db.terminate();
  await deleteApp(app);
});

describe("Discovery Containment Policy V1", () => {
  it("1. active policy allows public intake", async () => {
    await activate(policy());
    expect((await evaluator()("PUBLIC_INTAKE")).decision).toBe("ALLOW");
  });

  it("2. intake OFF denies before the handler idempotency write", async () => {
    await activate(policy("intake-off", { publicIntakeEnabled: false }));
    expect((await evaluator()("PUBLIC_INTAKE")).code).toBe("CONTAINMENT_DISABLED");
    const source = readFileSync(resolve("functions/src/discovery/createDiscoveryLead.ts"), "utf8");
    expect(source.indexOf('surface: "PUBLIC_INTAKE"')).toBeLessThan(
      source.indexOf("idempotencyRepository.acquire"),
    );
  });

  it("3. advisor resolution OFF denies independently", async () => {
    await activate(policy("advisor-off", { advisorCodeResolutionEnabled: false }));
    expect((await evaluator()("ADVISOR_CODE_RESOLUTION")).code)
      .toBe("CONTAINMENT_DISABLED");
  });

  it("4. token issuance OFF denies independently", async () => {
    await activate(policy("token-off", { tokenIssuanceEnabled: false }));
    expect((await evaluator()("TOKEN_ISSUANCE")).decision).toBe("DENY");
  });

  it("5. session resolution OFF denies independently", async () => {
    await activate(policy("session-off", { sessionResolutionEnabled: false }));
    expect((await evaluator()("SESSION_RESOLUTION")).decision).toBe("DENY");
  });

  it("6. completion OFF is enforced before exactly-once reservation", async () => {
    await activate(policy("completion-off", { sessionCompletionEnabled: false }));
    expect((await evaluator()("SESSION_COMPLETION")).decision).toBe("DENY");
    const source = readFileSync(resolve("functions/src/discovery/completeDiscoverySession.ts"), "utf8");
    expect(source.indexOf('surface: "SESSION_COMPLETION"')).toBeLessThan(
      source.indexOf("repository.completeWithEffect"),
    );
  });

  it("7. AI OFF is enforced before Gemini and the cost lease", async () => {
    await activate(policy("ai-off", { conversationAiEnabled: false }));
    expect((await evaluator()("CONVERSATION_AI")).decision).toBe("DENY");
    const source = readFileSync(resolve("functions/src/intelligence/evaluateConversation.ts"), "utf8");
    const enforcement = source.indexOf('surface: "CONVERSATION_AI"');
    expect(enforcement).toBeLessThan(source.indexOf("reserveConversation"));
    expect(enforcement).toBeLessThan(source.indexOf("new GoogleGenAI"));
  });

  it("8. report generation OFF is enforced before GENERATING metadata", async () => {
    await activate(policy("report-off", { externalReportGenerationEnabled: false }));
    expect((await evaluator()("EXTERNAL_REPORT_GENERATION")).decision).toBe("DENY");
    const source = readFileSync(resolve(
      "functions/src/discovery/reports/DiscoveryReportGenerationService.ts",
    ), "utf8");
    expect(source.indexOf('surface: "EXTERNAL_REPORT_GENERATION"')).toBeLessThan(
      source.indexOf("db.runTransaction"),
    );
  });

  it("9. download OFF is enforced before signed URL creation", async () => {
    await activate(policy("download-off", { documentDownloadEnabled: false }));
    expect((await evaluator()("DOCUMENT_DOWNLOAD")).decision).toBe("DENY");
    const source = readFileSync(resolve(
      "functions/src/discovery/reports/requestExecutiveDocument.ts",
    ), "utf8");
    expect(source.indexOf('surface: "DOCUMENT_DOWNLOAD"')).toBeLessThan(
      source.indexOf("getSignedUrl"),
    );
  });

  it("10. notification OFF is enforced before gateway fan-out", async () => {
    await activate(policy("notification-off", { notificationFanoutEnabled: false }));
    expect((await evaluator()("NOTIFICATION_FANOUT")).decision).toBe("DENY");
    const source = readFileSync(resolve(
      "functions/src/notifications/emitDiscoveryCompletedNotification.ts",
    ), "utf8");
    expect(source.indexOf('surface: "NOTIFICATION_FANOUT"')).toBeLessThan(
      source.indexOf("getIdTokenClient"),
    );
  });

  it("11. blocked trusted App ID is denied", async () => {
    await activate(policy("blocked-app", { blockedAppIds: ["app.blocked.test"] }));
    expect((await evaluator()("PUBLIC_INTAKE", { appId: "app.blocked.test" })).code)
      .toBe("CONTAINMENT_SUBJECT_BLOCKED");
  });

  it("12. a different App ID is allowed", async () => {
    await activate(policy("allowed-app", { blockedAppIds: ["app.blocked.test"] }));
    expect((await evaluator()("PUBLIC_INTAKE", { appId: "app.allowed.test" })).decision)
      .toBe("ALLOW");
  });

  it("13. blocked commercial code HMAC is denied without plaintext", async () => {
    const hash = deriveBlockedCommercialCodeHashV1("Advisor-42", SECRET);
    await activate(policy("blocked-code", { blockedCommercialCodeHashes: [hash] }));
    expect((await evaluator()("ADVISOR_CODE_RESOLUTION", {
      commercialCodeHash: deriveBlockedCommercialCodeHashV1("advisor-42", SECRET),
    })).code).toBe("CONTAINMENT_SUBJECT_BLOCKED");
    const stored = JSON.stringify((await db.collection(
      DISCOVERY_CONTAINMENT_POLICIES_COLLECTION,
    ).get()).docs[0].data());
    expect(stored).not.toContain("Advisor-42");
  });

  it("14. a different commercial code remains allowed", async () => {
    await activate(policy("other-code", {
      blockedCommercialCodeHashes: [deriveBlockedCommercialCodeHashV1("blocked", SECRET)],
    }));
    expect((await evaluator()("ADVISOR_CODE_RESOLUTION", {
      commercialCodeHash: deriveBlockedCommercialCodeHashV1("allowed", SECRET),
    })).decision).toBe("ALLOW");
  });

  it("15. missing policy fails closed", async () => {
    expect((await evaluator()("CONVERSATION_AI")).code)
      .toBe("CONTAINMENT_POLICY_NOT_FOUND");
  });

  it("16. corrupted policy fails closed", async () => {
    await db.collection(DISCOVERY_CONTAINMENT_ACTIVE_COLLECTION).doc("LOCAL_DEMO").set({
      version: "DISCOVERY_CONTAINMENT_ACTIVE_V1", environment: "LOCAL_DEMO",
      policyVersion: "corrupt",
    });
    await db.collection(DISCOVERY_CONTAINMENT_POLICIES_COLLECTION)
      .doc(buildDiscoveryContainmentPolicyDocumentId("LOCAL_DEMO", "corrupt"))
      .set({ version: "CORRUPT" });
    expect((await evaluator()("CONVERSATION_AI")).code)
      .toBe("CONTAINMENT_POLICY_CORRUPTED");
  });

  it("17. expired policy fails closed", async () => {
    await activate(policy("expired", { expiresAt: BASE_TIME - 1 }));
    expect((await evaluator()("CONVERSATION_AI")).code)
      .toBe("CONTAINMENT_POLICY_EXPIRED");
  });

  it("18. emergency quota permits the exact configured limit", async () => {
    await activate(policy("quota-exact", {
      emergencyGlobalQuota: quota({ INTAKE: { enabled: true, maxRequests: 3 } }),
    }));
    const results = await Promise.all(Array.from({ length: 3 }, () =>
      evaluator()("PUBLIC_INTAKE")));
    expect(results.every((result) => result.decision === "ALLOW")).toBe(true);
  });

  it("19. request over quota is denied with retryAfter", async () => {
    await activate(policy("quota-retry", {
      emergencyGlobalQuota: quota({ INTAKE: { enabled: true, maxRequests: 1 } }),
    }));
    await evaluator()("PUBLIC_INTAKE");
    const denied = await evaluator()("PUBLIC_INTAKE");
    expect(denied.code).toBe("EMERGENCY_QUOTA_EXCEEDED");
    expect(denied.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("20. 100 parallel requests never exceed the emergency quota", async () => {
    await activate(policy("quota-parallel", {
      emergencyGlobalQuota: quota({ AI_EVALUATION: {
        enabled: true, maxRequests: 10, windowSeconds: 60,
      } }),
    }));
    const evaluate = evaluator();
    const results = await Promise.all(Array.from({ length: 100 }, () =>
      evaluate("CONVERSATION_AI")));
    expect(results.filter((result) => result.decision === "ALLOW")).toHaveLength(10);
    expect(results.filter((result) => result.code === "EMERGENCY_QUOTA_EXCEEDED"))
      .toHaveLength(90);
  });

  it("21. policyVersion separates emergency counters", async () => {
    const p1 = policy("quota-v1", {
      emergencyGlobalQuota: quota({ DOWNLOAD: { enabled: true, maxRequests: 1 } }),
    });
    await activate(p1);
    expect((await evaluator()("DOCUMENT_DOWNLOAD")).decision).toBe("ALLOW");
    expect((await evaluator()("DOCUMENT_DOWNLOAD")).decision).toBe("DENY");
    await activate(policy("quota-v2", {
      rollbackVersion: p1.policyVersion,
      createdAt: BASE_TIME - 4_000,
      updatedAt: BASE_TIME - 3_000,
      emergencyGlobalQuota: quota({ DOWNLOAD: { enabled: true, maxRequests: 1 } }),
    }));
    expect((await evaluator()("DOCUMENT_DOWNLOAD")).decision).toBe("ALLOW");
  });

  it("22. environment separates active policies", async () => {
    await activate(policy("test-off", { publicIntakeEnabled: false }));
    const staging = policy("staging-on", { environment: "STAGING" });
    await activate(staging);
    expect((await evaluator("LOCAL_DEMO")("PUBLIC_INTAKE")).decision).toBe("DENY");
    expect((await evaluator("STAGING")("PUBLIC_INTAKE")).decision).toBe("ALLOW");
  });

  it("23. valid rollback atomically activates the previous version", async () => {
    const p1 = policy("rollback-v1");
    await activate(p1);
    await activate(policy("rollback-v2", {
      publicIntakeEnabled: false,
      rollbackVersion: p1.policyVersion,
      createdAt: BASE_TIME - 4_000,
      updatedAt: BASE_TIME - 3_000,
    }));
    const result = await new FirestoreDiscoveryContainmentRepository(db).rollback({
      environment: "LOCAL_DEMO", actorRole: "SECURITY_OPERATOR",
      approverRole: "SECURITY_APPROVER", reasonCode: "EMERGENCY_ROLLBACK",
      timestamp: BASE_TIME,
    });
    expect(result.policy.policyVersion).toBe("rollback-v1");
    expect((await evaluator()("PUBLIC_INTAKE")).decision).toBe("ALLOW");
  });

  it("24. missing rollback target fails closed", async () => {
    const invalid = policy("rollback-missing", { rollbackVersion: "missing-v1" });
    await writeRawPolicy(invalid);
    await db.collection(DISCOVERY_CONTAINMENT_ACTIVE_COLLECTION).doc("LOCAL_DEMO").set({
      version: "DISCOVERY_CONTAINMENT_ACTIVE_V1", environment: "LOCAL_DEMO",
      policyVersion: invalid.policyVersion,
    });
    await expect(new FirestoreDiscoveryContainmentRepository(db).rollback({
      environment: "LOCAL_DEMO", actorRole: invalid.ownerRole,
      approverRole: invalid.approvedByRole, reasonCode: "EMERGENCY_ROLLBACK",
      timestamp: BASE_TIME,
    })).rejects.toMatchObject({ code: "CONTAINMENT_ROLLBACK_INVALID" });
  });

  it("25. cyclic rollback chain fails closed", async () => {
    const a = policy("cycle-a", { rollbackVersion: "cycle-b" });
    const b = policy("cycle-b", { rollbackVersion: "cycle-a" });
    await writeRawPolicy(a);
    await writeRawPolicy(b);
    await db.collection(DISCOVERY_CONTAINMENT_ACTIVE_COLLECTION).doc("LOCAL_DEMO").set({
      version: "DISCOVERY_CONTAINMENT_ACTIVE_V1", environment: "LOCAL_DEMO",
      policyVersion: b.policyVersion,
    });
    await expect(new FirestoreDiscoveryContainmentRepository(db).rollback({
      environment: "LOCAL_DEMO", actorRole: b.ownerRole,
      approverRole: b.approvedByRole, reasonCode: "EMERGENCY_ROLLBACK",
      timestamp: BASE_TIME,
    })).rejects.toMatchObject({ code: "CONTAINMENT_ROLLBACK_INVALID" });
  });

  it("26. repeated activation creates one audit record", async () => {
    const value = policy("audit-once");
    expect((await activate(value)).decision).toBe("APPLIED");
    expect((await activate(value)).decision).toBe("REPLAY");
    expect((await db.collection(DISCOVERY_CONTAINMENT_AUDIT_COLLECTION).get()).size).toBe(1);
  });

  it("27. denied runtime enforcement emits structured containment telemetry", async () => {
    await activate(policy("runtime-denied", { publicIntakeEnabled: false }));
    await expect(enforceDiscoveryContainmentV1(db, {
      surface: "PUBLIC_INTAKE", source: "containmentTest",
      component: "discovery.intake", correlationKey: "runtime-denied",
      requestKey: "runtime-denied", startedAt: BASE_TIME,
    })).rejects.toMatchObject({ message: "DISCOVERY_TEMPORARILY_UNAVAILABLE" });
    const events = await db.collection(DISCOVERY_ABUSE_TELEMETRY_COLLECTION).get();
    expect(events.docs.map((doc) => doc.data().eventType)).toContain("containment.denied");
  });

  it("28. selective-block telemetry contains neither code nor policy payload", async () => {
    const rawCode = "private-commercial-code";
    const hash = deriveBlockedCommercialCodeHashV1(rawCode, SECRET);
    await activate(policy("telemetry-redaction", { blockedCommercialCodeHashes: [hash] }));
    await expect(enforceDiscoveryContainmentV1(db, {
      surface: "ADVISOR_CODE_RESOLUTION", source: "containmentTest",
      component: "discovery.advisorResolution", correlationKey: "redaction-test",
      requestKey: "redaction-test", startedAt: BASE_TIME, commercialCodeHash: hash,
    })).rejects.toBeDefined();
    const serialized = JSON.stringify((await db.collection(
      DISCOVERY_ABUSE_TELEMETRY_COLLECTION,
    ).get()).docs.map((doc) => doc.data()));
    expect(serialized).not.toContain(rawCode);
    expect(serialized).not.toContain("blockedCommercialCodeHashes");
  });

  it("29. blocked decisions do not invoke downstream side effects", async () => {
    await activate(policy("no-side-effect", { sessionCompletionEnabled: false }));
    let sideEffects = 0;
    const result = await evaluator()("SESSION_COMPLETION");
    if (result.decision === "ALLOW") sideEffects += 1;
    expect(sideEffects).toBe(0);
  });

  it("30. policyVersion is immutable", async () => {
    const value = policy("immutable-v1");
    await activate(value);
    await expect(activate({ ...value, publicIntakeEnabled: false }))
      .rejects.toBeInstanceOf(DiscoveryContainmentError);
  });

  it("31. activation rejects a rollback pointer without a previous valid policy", async () => {
    await expect(activate(policy("bad-pointer", { rollbackVersion: "unknown-v1" })))
      .rejects.toMatchObject({ code: "CONTAINMENT_CONFIGURATION_ERROR" });
  });

  it("32. containment telemetry catalog V2 publishes all eight required events", () => {
    expect(STRUCTURED_ABUSE_CONTAINMENT_EVENT_TYPES_V2).toEqual([
      "containment.allowed", "containment.denied", "containment.policy_missing",
      "containment.policy_corrupted", "containment.policy_expired",
      "containment.selective_block", "containment.emergency_quota_exceeded",
      "containment.rollback_applied",
    ]);
  });

  it("33. App ID validation rejects caller-shaped malformed identifiers", async () => {
    await activate(policy("app-validation"));
    await expect(evaluator()("PUBLIC_INTAKE", { appId: "bad app/id" }))
      .rejects.toMatchObject({ code: "CONTAINMENT_CONFIGURATION_ERROR" });
  });

  it("34. core works through provider-neutral ports", async () => {
    const value = policy("memory-port");
    const core = new DefaultDiscoveryContainmentEvaluator({
      getActivePolicy: async () => value,
      getPolicyVersion: async () => value,
    }, {
      consume: async () => ({ allowed: true, remaining: 1, retryAfterSeconds: 0 }),
    }, { nowEpochMilliseconds: () => BASE_TIME });
    expect((await core.evaluate({
      surface: "PUBLIC_INTAKE", environment: "LOCAL_DEMO",
    })).decision).toBe("ALLOW");
  });

  it("35. no public administrative endpoint is exported", () => {
    const source = readFileSync(resolve("functions/src/index.ts"), "utf8");
    expect(source).not.toContain("activateDiscoveryContainmentPolicy");
    expect(source).not.toContain("rollbackDiscoveryContainmentPolicy");
  });

  it("36. expiration and revocation transitions are versioned and audited", async () => {
    const active = policy("terminal-active");
    await activate(active);
    const repository = new FirestoreDiscoveryContainmentRepository(db);
    const expired = policy("terminal-expired", {
      status: "EXPIRED",
      rollbackVersion: active.policyVersion,
      createdAt: BASE_TIME - 4_000,
      updatedAt: BASE_TIME - 3_000,
      expiresAt: BASE_TIME + 1,
    });
    expect((await repository.transitionActivePolicy({
      policy: expired, action: "EXPIRE", actorRole: expired.ownerRole,
      approverRole: expired.approvedByRole, reasonCode: "INCIDENT_EXPIRED",
    })).decision).toBe("APPLIED");
    expect((await evaluator()("PUBLIC_INTAKE")).code)
      .toBe("CONTAINMENT_POLICY_EXPIRED");
    const audit = await db.collection(DISCOVERY_CONTAINMENT_AUDIT_COLLECTION).get();
    expect(audit.docs.map((doc) => doc.data().action)).toContain("EXPIRE");
    const stagingActive = policy("revoke-active", { environment: "STAGING" });
    await activate(stagingActive);
    const revoked = policy("revoke-terminal", {
      environment: "STAGING", status: "REVOKED",
      rollbackVersion: stagingActive.policyVersion,
      createdAt: BASE_TIME - 4_000,
      updatedAt: BASE_TIME - 3_000,
    });
    expect((await repository.transitionActivePolicy({
      policy: revoked, action: "REVOKE", actorRole: revoked.ownerRole,
      approverRole: revoked.approvedByRole, reasonCode: "INCIDENT_REVOKED",
    })).decision).toBe("APPLIED");
    expect((await evaluator("STAGING")("PUBLIC_INTAKE")).code)
      .toBe("CONTAINMENT_DISABLED");
    expect((await db.collection(DISCOVERY_CONTAINMENT_AUDIT_COLLECTION).get())
      .docs.map((doc) => doc.data().action)).toContain("REVOKE");
  });
});

describe("Preview Containment Activation Control Plane V1", () => {
  it("37. semantic fingerprint is deterministic across key and list ordering", () => {
    const first = activationProposal({ blockedAppIds: ["app.z.test", "app.a.test"] });
    const second = {
      ...activationProposal(),
      blockedAppIds: ["app.a.test", "app.z.test"],
    } as PreviewContainmentPolicyProposalV1;
    expect(fingerprintPreviewContainmentPolicyV1(first))
      .toBe(fingerprintPreviewContainmentPolicyV1(second));
  });

  it("38. every semantic policy change produces a different fingerprint", () => {
    expect(fingerprintPreviewContainmentPolicyV1(activationProposal()))
      .not.toBe(fingerprintPreviewContainmentPolicyV1(
        activationProposal({ conversationAiEnabled: false }),
      ));
  });

  it("39. request, correlation, idempotency and clock do not enter the fingerprint", () => {
    const proposalValue = activationProposal();
    const first = fingerprintPreviewContainmentPolicyV1(proposalValue);
    activationRequest({
      requestId: "request-9999", correlationId: "correlation-9999",
      idempotencyKey: "idempotency-9999",
    });
    expect(fingerprintPreviewContainmentPolicyV1(proposalValue)).toBe(first);
  });

  it("40. dry-run validates fully and writes no policy, pointer, or audit", async () => {
    const result = await activationControlPlane().execute(
      activationRequest({ dryRun: true, apply: false }), activationProposal(),
    );
    expect(result.decision).toBe("DRY_RUN_VALIDATED");
    expect(result.auditId).toBeNull();
    expect((await db.collection(DISCOVERY_CONTAINMENT_POLICIES_COLLECTION).get()).size)
      .toBe(0);
    expect((await db.collection(DISCOVERY_CONTAINMENT_ACTIVE_COLLECTION).get()).size)
      .toBe(0);
    expect((await db.collection(DISCOVERY_CONTAINMENT_AUDIT_COLLECTION).get()).size)
      .toBe(0);
  });

  it("41. apply atomically creates immutable policy, pointer and complete audit", async () => {
    const result = await activationControlPlane().execute(
      activationRequest(), activationProposal(),
    );
    expect(result.decision).toBe("APPLIED");
    const policies = await db.collection(DISCOVERY_CONTAINMENT_POLICIES_COLLECTION).get();
    const pointer = await db.collection(DISCOVERY_CONTAINMENT_ACTIVE_COLLECTION)
      .doc("PREVIEW").get();
    const audit = await db.collection(DISCOVERY_CONTAINMENT_AUDIT_COLLECTION).get();
    expect(policies.size).toBe(1);
    expect(pointer.data()).toMatchObject({
      environment: "PREVIEW", projectId: "aura-intel-preview", region: "us-central1",
      tenantId: PREVIEW_TENANT_ID, policyVersion: "preview-policy-v1",
      fingerprint: result.fingerprint,
    });
    expect(audit.size).toBe(1);
    expect(audit.docs[0].data()).toMatchObject({
      requestId: "request-0001", correlationId: "correlation-0001",
      actor: "SECURITY_OPERATOR", approver: "SECURITY_APPROVER",
      reason: "PREVIEW_CONTAINMENT_ACTIVATION", previousVersion: null,
      proposedVersion: "preview-policy-v1", fingerprint: result.fingerprint,
      result: "APPLIED",
    });
    expect(audit.docs[0].data().serverTimestamp.toMillis()).toBe(BASE_TIME);
    expect(policies.docs[0].data().createdAt.toMillis()).toBe(BASE_TIME);
  });

  it("42. exact retry is idempotent and creates no second audit", async () => {
    const control = activationControlPlane();
    expect((await control.execute(activationRequest(), activationProposal())).decision)
      .toBe("APPLIED");
    expect((await control.execute(activationRequest(), activationProposal())).decision)
      .toBe("REPLAY");
    expect((await db.collection(DISCOVERY_CONTAINMENT_AUDIT_COLLECTION).get()).size)
      .toBe(1);
  });

  it("43. reused idempotency key with changed request fails closed", async () => {
    const control = activationControlPlane();
    await control.execute(activationRequest(), activationProposal());
    await expect(control.execute(
      activationRequest({ requestId: "request-0002" }), activationProposal(),
    )).rejects.toMatchObject({ code: "ACTIVATION_IDEMPOTENCY_CONFLICT" });
  });

  it("44. Production, Staging, unknown and wildcard environments are rejected", async () => {
    for (const environment of ["PRODUCTION", "STAGING", "UNKNOWN", "*"]) {
      await expect(activationControlPlane().execute(
        { ...activationRequest(), environment }, activationProposal(),
      )).rejects.toMatchObject({ code: "ACTIVATION_TARGET_REJECTED" });
    }
  });

  it("45. wrong project and wrong region are rejected", async () => {
    await expect(activationControlPlane().execute(
      { ...activationRequest(), projectId: "wrong-preview" }, activationProposal(),
    )).rejects.toMatchObject({ code: "ACTIVATION_TARGET_REJECTED" });
    await expect(activationControlPlane().execute(
      { ...activationRequest(), region: "europe-west1" }, activationProposal(),
    )).rejects.toMatchObject({ code: "ACTIVATION_TARGET_REJECTED" });
  });

  it("46. tenant mismatch is rejected before authority or Firestore", async () => {
    await expect(activationControlPlane().execute(
      { ...activationRequest(), tenantId: `tenant-${"b".repeat(32)}` },
      activationProposal(),
    )).rejects.toMatchObject({ code: "ACTIVATION_TENANT_REJECTED" });
  });

  it("47. denied authority and absent actor/approver separation fail closed", async () => {
    authorityDecision = "DENY";
    await expect(activationControlPlane().execute(
      activationRequest(), activationProposal(),
    )).rejects.toMatchObject({ code: "ACTIVATION_AUTHORITY_REJECTED" });
    authorityDecision = "ALLOW";
    await expect(activationControlPlane().execute(
      { ...activationRequest(), approver: "SECURITY_OPERATOR" }, activationProposal(),
    )).rejects.toMatchObject({ code: "ACTIVATION_REQUEST_INVALID" });
  });

  it("48. unknown fields, request timestamps and unsafe mode combinations are rejected", async () => {
    await expect(activationControlPlane().execute(
      { ...activationRequest(), clientTimestamp: BASE_TIME }, activationProposal(),
    )).rejects.toMatchObject({ code: "ACTIVATION_REQUEST_INVALID" });
    await expect(activationControlPlane().execute(
      { ...activationRequest(), dryRun: false, apply: false }, activationProposal(),
    )).rejects.toMatchObject({ code: "ACTIVATION_REQUEST_INVALID" });
  });

  it("49. compare-and-set rejects a stale expected current version", async () => {
    const control = activationControlPlane();
    await control.execute(activationRequest(), activationProposal());
    await expect(control.execute(
      activationRequest({
        requestId: "request-0002", correlationId: "correlation-0002",
        idempotencyKey: "idempotency-0002", proposedVersion: "preview-policy-v2",
        expectedCurrentVersion: null,
      }),
      activationProposal({
        policyVersion: "preview-policy-v2", rollbackVersion: null,
      }),
    )).rejects.toMatchObject({ code: "ACTIVATION_CAS_MISMATCH" });
  });

  it("50. update requires exact rollback and advances the pointer atomically", async () => {
    const control = activationControlPlane();
    await control.execute(activationRequest(), activationProposal());
    const result = await control.execute(
      activationRequest({
        requestId: "request-0002", correlationId: "correlation-0002",
        idempotencyKey: "idempotency-0002", proposedVersion: "preview-policy-v2",
        expectedCurrentVersion: "preview-policy-v1",
      }),
      activationProposal({
        policyVersion: "preview-policy-v2", rollbackVersion: "preview-policy-v1",
        publicIntakeEnabled: false,
      }),
    );
    expect(result).toMatchObject({
      decision: "APPLIED", previousVersion: "preview-policy-v1",
      proposedVersion: "preview-policy-v2",
    });
    expect((await db.collection(DISCOVERY_CONTAINMENT_ACTIVE_COLLECTION)
      .doc("PREVIEW").get()).data()?.policyVersion).toBe("preview-policy-v2");
  });

  it("51. orphan pointer and pre-existing proposed version fail closed", async () => {
    await db.collection(DISCOVERY_CONTAINMENT_ACTIVE_COLLECTION).doc("PREVIEW").set({
      version: "DISCOVERY_CONTAINMENT_ACTIVE_V1", environment: "PREVIEW",
      policyVersion: "missing-policy",
    });
    await expect(activationControlPlane().execute(
      activationRequest({
        expectedCurrentVersion: "missing-policy", proposedVersion: "preview-policy-v2",
      }),
      activationProposal({
        policyVersion: "preview-policy-v2", rollbackVersion: "missing-policy",
      }),
    )).rejects.toMatchObject({ code: "ACTIVATION_ORPHAN_POINTER" });

    await clear();
    await writeRawPolicy(policy("preview-policy-v1", {
      environment: "PREVIEW", reason: "PREVIEW_CONTAINMENT_ACTIVATION",
      createdAt: BASE_TIME, updatedAt: BASE_TIME, expiresAt: BASE_TIME + 86_400_000,
    }));
    await expect(activationControlPlane().execute(
      activationRequest(), activationProposal(),
    )).rejects.toMatchObject({ code: "ACTIVATION_VERSION_IMMUTABLE" });
  });

  it("52. concurrent initial activations produce exactly one winner", async () => {
    const control = activationControlPlane();
    const first = control.execute(activationRequest(), activationProposal());
    const second = control.execute(
      activationRequest({
        requestId: "request-0002", correlationId: "correlation-0002",
        idempotencyKey: "idempotency-0002", proposedVersion: "preview-policy-v2",
      }),
      activationProposal({ policyVersion: "preview-policy-v2" }),
    );
    const results = await Promise.allSettled([first, second]);
    expect(results.filter((entry) => entry.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((entry) => entry.status === "rejected")).toHaveLength(1);
    expect((await db.collection(DISCOVERY_CONTAINMENT_POLICIES_COLLECTION).get()).size)
      .toBe(1);
    expect((await db.collection(DISCOVERY_CONTAINMENT_AUDIT_COLLECTION).get()).size)
      .toBe(1);
  });
});
