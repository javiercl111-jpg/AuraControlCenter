"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  evaluateAiUx02D2E4ArchitectureV1,
} = require("../ai-ux-02d2e4-authorized-jit-bootstrap-architecture-guard.cjs");

const paths = {
  bootstrap: "src/modules/discovery/security/authorizedJitBootstrapV1.ts",
  direct: "src/modules/discovery/security/directEphemeralDiscoveryCapabilityInjectionV1.ts",
  main: "src/main.tsx",
  vite: "vite.config.ts",
  app: "src/App.tsx",
  discover: "src/pages/DiscoverPage.tsx",
  harness: "tests/ai-ux-02d2e4/browser-harness.tsx",
};

function fixture(overrides = {}) {
  return {
    [paths.bootstrap]: `
      const CLAIM_KEYS = ["binding", "controlProof", "version"];
      Object.keys(input).sort();
      interface AuthorizedJitBootstrapClaimV1 { controlProof: string; version: string; binding: AuthorizedJitBootstrapBindingV1 }
      interface AuthorizedJitBootstrapBindingV1 { linkId: string; sessionId: string }
      exactBinding(input.binding);
      createDirectEphemeralDiscoveryCapabilityChannelV1({
        linkId: claim.binding.linkId, sessionId: claim.binding.sessionId
      });
      if (environment !== "PREVIEW" || projectId !== PREVIEW_PROJECT_ID) return { status: "UNAVAILABLE" };
      controlProofDigest; crypto.subtle.digest("SHA-256", bytes); constantTimeEqual();
      proofObservation = { expectedControlProofDigest, observedControlProofDigest, verifiedAtMs };
      Object.defineProperty(target, property, { configurable: true, enumerable: false });
      Reflect.deleteProperty(target, property);
      JIT_BOOTSTRAP_HANDLE_STALE; AUTHORIZED_JIT_BOOTSTRAP_HANDLE_TTL_MS_V1;
      handleAvailable = false; return channel.issuerPort.deliverOnce(injection);
    `,
    [paths.direct]: `interface Port { isReady(): boolean }
      function isReady() { return !delivered && consumer !== null; }`,
    [paths.main]: `installAuthorizedJitBootstrapV1({
      controlProofDigest: import.meta.env.VITE_AI_UX_02D2E4_CONTROL_PROOF_DIGEST_V1,
      mountFrontend: mountApplication,
    });`,
    [paths.vite]: `loadEnv(mode, process.cwd(), "");
      mode === "preview-certification";
      BROWSER_PROOF_CERTIFIED_DIGEST_REQUIRED;
      BROWSER_PROOF_LEGACY_BUILD_INPUT_REJECTED;`,
    [paths.app]: "directEphemeralCapabilitySource",
    [paths.discover]: "directEphemeralCapabilitySource.connect(() => {})",
    [paths.harness]: `createRoot(root); MountedFrontendProbe;
      "MOCK_EVALUATE_CONVERSATION_CONSUMED";`,
    ...overrides,
  };
}

test("accepts the authorized Preview-only JIT bootstrap", () => {
  assert.deepEqual(evaluateAiUx02D2E4ArchitectureV1(fixture()), []);
});

for (const forbidden of [
  "onCall(handler)",
  "onRequest(handler)",
  "sessionStorage.setItem('cap', bearer)",
  "localStorage.setItem('cap', bearer)",
  "indexedDB.open('cap')",
  "document.cookie = bearer",
  "new BroadcastChannel('cap')",
  "postMessage(bearer)",
  "location.hash = bearer",
]) {
  test(`rejects forbidden bootstrap mechanism: ${forbidden}`, () => {
    const current = fixture();
    const errors = evaluateAiUx02D2E4ArchitectureV1(fixture({
      [paths.bootstrap]: `${current[paths.bootstrap]} ${forbidden}`,
    }));
    assert.ok(errors.length > 0);
  });
}

test("rejects a globally assigned bearer", () => {
  const current = fixture();
  const errors = evaluateAiUx02D2E4ArchitectureV1(fixture({
    [paths.main]: `${current[paths.main]} window.discoveryBearer = bearer;`,
  }));
  assert.ok(errors.includes("GLOBAL_BEARER_EXPOSURE_FORBIDDEN"));
});

test("rejects the legacy runtime proof-substitution key", () => {
  const current = fixture();
  const errors = evaluateAiUx02D2E4ArchitectureV1(fixture({
    [paths.main]: `${current[paths.main]} VITE_AI_UX_02D2E4_CONTROL_PROOF_SHA256;`,
  }));
  assert.ok(errors.includes("RUNTIME_PROOF_SUBSTITUTION_FORBIDDEN"));
});

test("rejects an enumerable or permanent claim", () => {
  const current = fixture();
  const errors = evaluateAiUx02D2E4ArchitectureV1(fixture({
    [paths.bootstrap]: current[paths.bootstrap]
      .replace("configurable: true, enumerable: false", "enumerable: true")
      .replace("Reflect.deleteProperty(target, property);", ""),
  }));
  assert.ok(errors.includes("TEMPORARY_NON_ENUMERABLE_CLAIM_MISSING"));
});

test("rejects client-supplied scope", () => {
  const current = fixture();
  const errors = evaluateAiUx02D2E4ArchitectureV1(fixture({
    [paths.bootstrap]: current[paths.bootstrap].replace(
      "controlProof: string;",
      "controlProof: string; capabilityScope: string;",
    ),
  }));
  assert.ok(errors.includes("CLIENT_SUPPLIED_SCOPE_FORBIDDEN"));
});

test("rejects a harness that imports Firebase", () => {
  const current = fixture();
  const errors = evaluateAiUx02D2E4ArchitectureV1(fixture({
    [paths.harness]: `${current[paths.harness]} import firebase from "firebase";`,
  }));
  assert.ok(errors.includes("LOCAL_BROWSER_HARNESS_INVALID"));
});
