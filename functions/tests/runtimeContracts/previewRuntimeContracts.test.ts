import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  PREVIEW_MVP_FEATURE_GATES_V1,
  PREVIEW_RUNTIME_SECRET_MANIFEST_V1,
  assertStructuredResultOnlyContractV1,
  resolveDiscoveryRuntimeContractV1,
  resolveRuntimeEnvironmentV1,
  runDiscoveryCompletionOptionalEffectsV1,
} from "../../src/discovery/runtimeContracts";
import {
  createDiscoveryStructuredCompletionPublicResultV1,
  type DiscoveryCompletionRecordV1,
} from "../../src/discovery/capabilities";

const repositoryRoot = resolve(__dirname, "..", "..", "..");
const source = (path: string): string =>
  readFileSync(resolve(repositoryRoot, path), "utf8");

describe("RuntimeEnvironmentV1", () => {
  it("maps Preview explicitly and never derives it from NODE_ENV", () => {
    expect(resolveRuntimeEnvironmentV1({
      AURA_RUNTIME_ENVIRONMENT: "PREVIEW",
      GCLOUD_PROJECT: "aura-intel-preview",
      GOOGLE_CLOUD_PROJECT: "aura-intel-preview",
    })).toBe("PREVIEW");
    expect(() => resolveRuntimeEnvironmentV1({
      GCLOUD_PROJECT: "aura-intel-preview",
      GOOGLE_CLOUD_PROJECT: "aura-intel-preview",
    })).toThrowError("RUNTIME_ENVIRONMENT_MISSING");
  });

  it.each([
    ["STAGING", "aura-intel-staging"],
    ["PRODUCTION", "aura-control-center-debb3"],
  ] as const)("maps %s only to its exact project", (environment, project) => {
    expect(resolveRuntimeEnvironmentV1({
      AURA_RUNTIME_ENVIRONMENT: environment,
      GCLOUD_PROJECT: project,
    })).toBe(environment);
  });

  it("fails closed for project/environment mismatch", () => {
    expect(() => resolveRuntimeEnvironmentV1({
      AURA_RUNTIME_ENVIRONMENT: "PREVIEW",
      GCLOUD_PROJECT: "aura-intel-staging",
    })).toThrowError("RUNTIME_ENVIRONMENT_PROJECT_MISMATCH");
  });

  it("requires explicit LOCAL_DEMO plus emulator and demo project", () => {
    expect(resolveRuntimeEnvironmentV1({
      AURA_RUNTIME_ENVIRONMENT: "LOCAL_DEMO",
      GCLOUD_PROJECT: "demo-runtime-contracts",
      FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
    })).toBe("LOCAL_DEMO");
    expect(() => resolveRuntimeEnvironmentV1({
      AURA_RUNTIME_ENVIRONMENT: "LOCAL_DEMO",
      GCLOUD_PROJECT: "aura-intel-preview",
    })).toThrowError("RUNTIME_ENVIRONMENT_PROJECT_MISMATCH");
  });
});

describe("Preview MVP feature gates and core completion", () => {
  it("enables only the structured result", () => {
    expect(PREVIEW_MVP_FEATURE_GATES_V1).toEqual({
      structuredResultEnabled: true,
      pdfGenerationEnabled: false,
      storageEnabled: false,
      signedUrlsEnabled: false,
      notificationsEnabled: false,
      cloudTasksEnabled: false,
    });
    expect(() => assertStructuredResultOnlyContractV1(
      resolveDiscoveryRuntimeContractV1({
        AURA_RUNTIME_ENVIRONMENT: "PREVIEW",
        GCLOUD_PROJECT: "aura-intel-preview",
      }),
    )).not.toThrow();
  });

  it("does not invoke PDF, Storage, signer, notification, or Tasks ports", async () => {
    const ports = {
      generatePdf: vi.fn(async () => undefined),
      writeStorage: vi.fn(async () => undefined),
      signUrl: vi.fn(async () => undefined),
      emitNotification: vi.fn(async () => undefined),
      enqueueCloudTask: vi.fn(async () => undefined),
    };
    await runDiscoveryCompletionOptionalEffectsV1(
      PREVIEW_MVP_FEATURE_GATES_V1,
      ports,
    );
    expect(Object.values(ports).every((port) => port.mock.calls.length === 0))
      .toBe(true);
  });

  it("returns a structured result without document or URL capability", () => {
    const result = createDiscoveryStructuredCompletionPublicResultV1({
      dossierId: "dossier-hash", trustDecision: "ALLOW_FULL",
    } as DiscoveryCompletionRecordV1);
    expect(result).toEqual({
      dossierId: "dossier-hash",
      trustDecision: "ALLOW_FULL",
      structuredResultAvailable: true,
    });
    expect(JSON.stringify(result)).not.toMatch(/report|pdf|url|notification/i);
  });

  it("keeps completion source free of optional service invocations", () => {
    const completion = source("functions/src/discovery/completeDiscoverySession.ts");
    expect(completion).toContain("assertStructuredResultOnlyContractV1");
    expect(completion).toContain("notificationOutboxEnabled");
    expect(completion).not.toContain("DiscoveryReportGenerationService");
    expect(completion).not.toContain("dispatchDiscoveryCompletionOutbox");
    expect(completion).not.toMatch(/admin\.storage|getSignedUrl|taskQueue/);
  });

  it("retains executable exactly-once and replay coverage", () => {
    const capabilityTests = source(
      "functions/tests/emulator/capabilities/firestoreCapabilityEmulator.test.ts",
    );
    expect(capabilityTests).toContain("valid completion creates one deterministic dossier");
    expect(capabilityTests).toContain("identical replay returns the equivalent result");
    expect(capabilityTests).toContain("one hundred simultaneous completions converge");
  });
});

describe("Preview secret and runtime compositions", () => {
  it("maps only the three demonstrated secret consumers", () => {
    expect(PREVIEW_RUNTIME_SECRET_MANIFEST_V1.mappings).toEqual([
      expect.objectContaining({
        handler: "createDiscoveryLead",
        runtimeIdentity: "preview-public-intake-runtime",
        secretResource: "discovery-idempotency-secret-preview",
        secretParamName: "discovery-idempotency-secret-preview",
      }),
      expect.objectContaining({
        handler: "completeDiscoverySession",
        runtimeIdentity: "preview-discovery-complete-rt",
        secretResource: "discovery-hmac-secret-preview",
        secretParamName: "discovery-hmac-secret-preview",
      }),
      expect.objectContaining({
        handler: "evaluateConversation",
        runtimeIdentity: "preview-conversation-runtime",
        secretResource: "discovery-gemini-api-key-preview",
        secretParamName: "discovery-gemini-api-key-preview",
      }),
    ]);
    expect(PREVIEW_RUNTIME_SECRET_MANIFEST_V1.secretlessHandlers)
      .toEqual(["exchangeDiscoveryToken", "resolveDiscoverySession"]);
  });

  it("defers IP salt with no speculative MVP consumer", () => {
    expect(PREVIEW_RUNTIME_SECRET_MANIFEST_V1.deferred).toEqual([{
      secretResource: "discovery-ip-hash-salt-preview",
      reason: "NO_CONSUMER_IN_PREVIEW_DISCOVERY_MVP",
      consumers: [],
    }]);
  });

  it.each([
    ["publicIntakeRuntimeComposition.ts", ["createDiscoveryLead"]],
    ["sessionRuntimeComposition.ts", ["exchangeDiscoveryToken", "resolveDiscoverySession"]],
    ["conversationRuntimeComposition.ts", ["evaluateConversation"]],
    ["completionRuntimeComposition.ts", ["completeDiscoverySession"]],
  ] as const)("keeps %s on its exact handler boundary", (file, allowed) => {
    const composition = source(
      `functions/src/discovery/runtimeCompositions/${file}`,
    );
    const allHandlers = [
      "createDiscoveryLead", "exchangeDiscoveryToken", "resolveDiscoverySession",
      "evaluateConversation", "completeDiscoverySession", "requestExecutiveDocument",
      "generateDiscoveryReport", "emitDiscoveryCompletedNotification",
    ];
    for (const handler of allHandlers) {
      expect(composition.includes(handler)).toBe(
        (allowed as readonly string[]).includes(handler),
      );
    }
  });
});

describe("Authority and PII guard", () => {
  it("uses UID-only Discovery authority and removes the email fallback", () => {
    const intake = source("functions/src/discovery/createDiscoveryLead.ts");
    const resolver = source(
      "functions/src/discovery/runtimeContracts/resolveDiscoveryPrincipalV1.ts",
    );
    expect(intake).toContain("resolveDiscoveryPrincipalV1");
    expect(intake).not.toContain("resolvePlatformPrincipal");
    expect(resolver).toContain('doc(uid)');
    expect(resolver).not.toMatch(/token\?\.email|where\(["']email|normalizedEmail/);
  });

  it("does not place raw PII or capability tokens in MVP log calls", () => {
    const mvp = [
      "functions/src/discovery/createDiscoveryLead.ts",
      "functions/src/discovery/exchangeDiscoveryToken.ts",
      "functions/src/discovery/resolveDiscoverySession.ts",
      "functions/src/intelligence/evaluateConversation.ts",
      "functions/src/discovery/completeDiscoverySession.ts",
      "functions/src/discovery/runtimeContracts/resolveDiscoveryPrincipalV1.ts",
    ].map(source).join("\n");
    const logCalls = mvp.match(
      /(?:logger|console)\.(?:log|warn|error|debug)\([\s\S]{0,500}?\);/g,
    ) ?? [];
    expect(logCalls.join("\n")).not.toMatch(
      /\b(email|phone|uid|sessionToken|oneTimeToken|capabilityToken|prompt)\b/,
    );
  });
});
