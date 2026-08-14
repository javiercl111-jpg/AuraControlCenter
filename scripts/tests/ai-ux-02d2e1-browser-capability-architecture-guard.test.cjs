"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { evaluateAiUx02D2E1ArchitectureV1 } = require("../ai-ux-02d2e1-browser-capability-architecture-guard.cjs");

const paths = {
  browser: "src/pages/DiscoverPage.tsx",
  handoff: "src/modules/discovery/security/ephemeralBrowserCapabilityHandoffV1.ts",
  exchange: "src/modules/discovery/services/discoveryLinkService.ts",
  verifier: "functions/src/infrastructure/firestore/discoveryCapabilities/FirestoreDiscoveryCapabilityRepository.ts",
  evaluate: "functions/src/intelligence/evaluateConversation.ts",
};

function fixture(overrides = {}) {
  return {
    [paths.browser]: 'new EphemeralBrowserCapabilityHandoffV1(); accept("SESSION", result.sessionAccessToken); sessionToken: requestBearer; clearAll(); pendingAccessRef.current = null;',
    [paths.handoff]: 'readonly #slots; inFlight; EPHEMERAL_CAPABILITY_USE_IN_FLIGHT; catch (error: unknown) { slot.bearer = null; }',
    [paths.exchange]: "sessionAccessToken",
    [paths.verifier]: "hashDiscoveryCapabilityToken(input.token)",
    [paths.evaluate]: "hashDiscoveryCapabilityToken(data.sessionToken)",
    ...overrides,
  };
}

test("accepts memory-only browser handoff and hash-only server verification", () => {
  assert.deepEqual(evaluateAiUx02D2E1ArchitectureV1(fixture()), []);
});

for (const forbidden of [
  "sessionStorage.setItem('cap', value)",
  "localStorage.setItem('cap', value)",
  "indexedDB.open('cap')",
  "document.cookie = value",
  "caches.open('cap')",
  "navigator.serviceWorker.controller.postMessage(value)",
]) {
  test(`rejects persistent browser mechanism: ${forbidden.split("(")[0]}`, () => {
    const errors = evaluateAiUx02D2E1ArchitectureV1(fixture({
      [paths.browser]: `${fixture()[paths.browser]} ${forbidden}`,
    }));
    assert.ok(errors.includes("BROWSER_CAPABILITY_PERSISTENCE_FORBIDDEN"));
  });
}

test("rejects capability material in React state", () => {
  const errors = evaluateAiUx02D2E1ArchitectureV1(fixture({
    [paths.browser]: `${fixture()[paths.browser]} useState(reportCapabilityToken)`,
  }));
  assert.ok(errors.includes("REACT_STATE_CAPABILITY_FORBIDDEN"));
});

test("rejects capability material in URLs", () => {
  const errors = evaluateAiUx02D2E1ArchitectureV1(fixture({
    [paths.browser]: `${fixture()[paths.browser]} location.href = requestBearer`,
  }));
  assert.ok(errors.includes("CAPABILITY_IN_URL_FORBIDDEN"));
});

test("rejects capability logging", () => {
  const errors = evaluateAiUx02D2E1ArchitectureV1(fixture({
    [paths.browser]: `${fixture()[paths.browser]} console.info('bearer', requestBearer)`,
  }));
  assert.ok(errors.includes("CAPABILITY_LOGGING_FORBIDDEN"));
});

test("rejects capability material in persistent client stores", () => {
  const errors = evaluateAiUx02D2E1ArchitectureV1(fixture({
    [paths.browser]: `${fixture()[paths.browser]} store.dispatch(persistSession(requestBearer))`,
  }));
  assert.ok(errors.includes("PERSISTENT_CLIENT_STORE_FORBIDDEN"));
});

for (const sink of ["telemetry", "replay", "audit"]) {
  test(`rejects capability material in ${sink}`, () => {
    const errors = evaluateAiUx02D2E1ArchitectureV1(fixture({
      [paths.browser]: `${fixture()[paths.browser]} ${sink}.record(requestBearer)`,
    }));
    assert.ok(errors.includes("OBSERVABILITY_CAPABILITY_COPY_FORBIDDEN"));
  });
}

test("rejects capability material in error messages", () => {
  const errors = evaluateAiUx02D2E1ArchitectureV1(fixture({
    [paths.browser]: `${fixture()[paths.browser]} setError(requestBearer)`,
  }));
  assert.ok(errors.includes("ERROR_MESSAGE_CAPABILITY_COPY_FORBIDDEN"));
});

test("rejects missing duplicate-use exclusion", () => {
  const errors = evaluateAiUx02D2E1ArchitectureV1(fixture({ [paths.handoff]: "readonly #slots; catch (error: unknown) { slot.bearer = null; }" }));
  assert.ok(errors.includes("DUPLICATE_USE_GUARD_MISSING"));
});

test("rejects missing fail-closed uncertain outcome", () => {
  const errors = evaluateAiUx02D2E1ArchitectureV1(fixture({ [paths.handoff]: "readonly #slots; inFlight; EPHEMERAL_CAPABILITY_USE_IN_FLIGHT;" }));
  assert.ok(errors.includes("UNCERTAIN_FAILURE_CLEAR_MISSING"));
});

test("rejects plaintext server lookup", () => {
  const errors = evaluateAiUx02D2E1ArchitectureV1(fixture({ [paths.verifier]: "repository.doc(input.token)" }));
  assert.ok(errors.includes("SERVER_HASH_ONLY_VERIFICATION_MISSING"));
});
