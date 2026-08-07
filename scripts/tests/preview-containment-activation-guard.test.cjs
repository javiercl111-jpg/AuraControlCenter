"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { resolve } = require("node:path");
const {
  inspectSources, parseArgs, run, validateTarget,
} = require("../preview-containment-activation-guard.cjs");

const validTarget = {
  project: "aura-intel-preview", environment: "PREVIEW", region: "us-central1",
};
const validSources = {
  controlPlaneSource:
    "expectedTenantId ACTIVATION_AUTHORITY_REJECTED class InternalControlPlane {}",
  storeSource: [
    ".collection(DISCOVERY_CONTAINMENT_POLICIES_COLLECTION)",
    ".collection(DISCOVERY_CONTAINMENT_ACTIVE_COLLECTION)",
    ".collection(DISCOVERY_CONTAINMENT_AUDIT_COLLECTION)",
  ].join("\n"),
  publicEntrypointSources: ["export const createDiscoveryLead = value;", "safe"],
};

test("1. exact Preview target passes", () => {
  assert.deepEqual(validateTarget(validTarget), validTarget);
});

for (const [name, override] of [
  ["2. Production fails", { environment: "PRODUCTION" }],
  ["3. Staging fails", { environment: "STAGING" }],
  ["4. wildcard fails", { environment: "*" }],
  ["5. unknown fails", { environment: "UNKNOWN" }],
  ["6. wrong project fails", { project: "other-project" }],
  ["7. wrong region fails", { region: "europe-west1" }],
]) {
  test(name, () => assert.throws(() => validateTarget({ ...validTarget, ...override })));
}

test("8. missing and duplicate arguments fail", () => {
  assert.throws(() => validateTarget(parseArgs(["--project=aura-intel-preview"])));
  assert.throws(() => parseArgs(["--project=aura-intel-preview", "--project=x"]));
});

test("9. callable and HTTP surfaces fail", () => {
  assert.throws(() => inspectSources({
    ...validSources, controlPlaneSource:
      validSources.controlPlaneSource + "\nonCall(() => undefined)",
  }));
  assert.throws(() => inspectSources({
    ...validSources, controlPlaneSource:
      validSources.controlPlaneSource + '\nfrom "firebase-functions/v2/https"',
  }));
});

test("10. public deployment export fails", () => {
  assert.throws(() => inspectSources({
    ...validSources,
    publicEntrypointSources: ["export { PreviewContainmentActivationControlPlaneV1 }"]
  }));
});

test("11. Storage, Tasks, reports and notifications imports fail", () => {
  for (const surface of ["storage", "tasks", "reports", "notifications"]) {
    assert.throws(() => inspectSources({
      ...validSources,
      controlPlaneSource: validSources.controlPlaneSource + `\nfrom "../../${surface}"`,
    }));
  }
});

test("12. direct or unexpected collection fails", () => {
  assert.throws(() => inspectSources({
    ...validSources,
    storeSource: validSources.storeSource + '\n.collection("unexpected_collection")',
  }));
  assert.throws(() => inspectSources({
    ...validSources,
    storeSource: validSources.storeSource +
      "\n.collection(DISCOVERY_OTHER_COLLECTION)",
  }));
});

test("13. tenant binding and authority fail-closed markers are mandatory", () => {
  assert.throws(() => inspectSources({
    ...validSources,
    controlPlaneSource: validSources.controlPlaneSource.replace("expectedTenantId", ""),
  }));
  assert.throws(() => inspectSources({
    ...validSources,
    controlPlaneSource: validSources.controlPlaneSource
      .replace("ACTIVATION_AUTHORITY_REJECTED", ""),
  }));
});

test("14. actual source tree passes", () => {
  const result = run(resolve(__dirname, "..", ".."), [
    "--project=aura-intel-preview", "--environment=PREVIEW", "--region=us-central1",
  ]);
  assert.equal(result.publicHandlers, 0);
  assert.equal(result.allowedCollections.length, 3);
});
