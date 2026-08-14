"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  evaluateAiUx02D2E3ArchitectureV1,
} = require("../ai-ux-02d2e3-direct-injection-architecture-guard.cjs");

const paths = {
  direct:
    "src/modules/discovery/security/directEphemeralDiscoveryCapabilityInjectionV1.ts",
  browser: "src/pages/DiscoverPage.tsx",
  app: "src/App.tsx",
  handoff:
    "src/modules/discovery/security/ephemeralBrowserCapabilityHandoffV1.ts",
  gateway: "src/modules/intelligence/core/services/AuraLLMGateway.ts",
};

function fixture(overrides = {}) {
  return {
    [paths.direct]: `
      const INJECTION_KEYS = ["bearer", "expiresAt", "version"];
      Object.keys(injection).sort();
      DIRECT_EPHEMERAL_DISCOVERY_CAPABILITY_TTL_MS_V1;
      injection.expiresAt <= now; injection.expiresAt - now;
      class DirectEphemeralDiscoveryCapabilityInjectionBoundaryV1 {
        readonly #handoff; #available = false;
        injectAndExecute() { return { sessionToken }; }
      }
      function createDirectEphemeralDiscoveryCapabilityChannelV1() {
        let consumer = null; return { connect() {}, deliverOnce() {} };
      }
      interface DirectEphemeralDiscoveryCapabilityInjectionV1 {
        bearer: string; expiresAt: number; version: string;
      }
    `,
    [paths.browser]: `
      new EphemeralBrowserCapabilityHandoffV1();
      directEphemeralCapabilitySource.connect((injection) =>
        boundary.injectAndExecute(injection, (request) => processTurn("", request)));
    `,
    [paths.app]: `
      directEphemeralCapabilitySource;
      <DiscoverPage directEphemeralCapabilitySource={directEphemeralCapabilitySource} />;
    `,
    [paths.handoff]: "readonly #slots",
    [paths.gateway]: '"evaluateConversation"',
    ...overrides,
  };
}

test("accepts a private one-shot direct injection boundary", () => {
  assert.deepEqual(evaluateAiUx02D2E3ArchitectureV1(fixture()), []);
});

for (const forbidden of [
  "sessionStorage.setItem('cap', bearer)",
  "localStorage.setItem('cap', bearer)",
  "indexedDB.open('cap')",
  "document.cookie = bearer",
  "window.injectCapability = injectAndExecute",
  "globalThis.capability = bearer",
  "new BroadcastChannel('cap')",
  "new MessageChannel()",
  "postMessage(bearer)",
  "location.hash = bearer",
  "new URLSearchParams({ bearer })",
  "clipboard.writeText(bearer)",
]) {
  test(`rejects forbidden direct transport: ${forbidden.split("(")[0]}`, () => {
    const errors = evaluateAiUx02D2E3ArchitectureV1(fixture({
      [paths.direct]: `${fixture()[paths.direct]} ${forbidden}`,
    }));
    assert.ok(errors.includes("DIRECT_BOUNDARY_FORBIDDEN_TRANSPORT"));
  });
}

test("rejects a globally exposed injection hook", () => {
  const errors = evaluateAiUx02D2E3ArchitectureV1(fixture({
    [paths.browser]: `${fixture()[paths.browser]}
      Object.defineProperty(window, "injectCapability", { value: bearer });`,
  }));
  assert.ok(errors.includes("GLOBAL_INJECTION_EXPOSURE_FORBIDDEN"));
});

test("rejects arbitrary client-supplied capability scope", () => {
  const errors = evaluateAiUx02D2E3ArchitectureV1(fixture({
    [paths.direct]: fixture()[paths.direct].replace(
      "bearer: string;",
      "bearer: string; capabilityScope: string;",
    ),
  }));
  assert.ok(errors.includes("CLIENT_SUPPLIED_AUTHORITY_FORBIDDEN"));
});

test("rejects retention after a direct successful request", () => {
  const errors = evaluateAiUx02D2E3ArchitectureV1(fixture({
    [paths.direct]: `${fixture()[paths.direct]} retainAfterSuccess: () => true`,
  }));
  assert.ok(errors.includes("SINGLE_EVALUATE_CONSUMPTION_MISSING"));
});

test("rejects missing DiscoverPage integration", () => {
  const errors = evaluateAiUx02D2E3ArchitectureV1(fixture({
    [paths.browser]: "new EphemeralBrowserCapabilityHandoffV1();",
  }));
  assert.ok(errors.includes("DISCOVER_PAGE_DIRECT_INTEGRATION_MISSING"));
});
