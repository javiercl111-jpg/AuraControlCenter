"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { inspectSources, run } = require("../preview-containment-authority-composition-guard.cjs");
const check = require("../preview-containment-authority-composition-check.cjs");

const valid = {
  verifier: "CONTAINMENT_ACTIVATION_ACTOR CONTAINMENT_ACTIVATION_APPROVER containment.policy.activate containment.policy.approve aura-intel-preview ACTIVE PREVIEW .limit(2) hasExactKeys",
  composition: "PreviewContainmentActivationControlPlaneV1 FirestorePreviewContainmentActivationAuthorityVerifierV1 FirestorePreviewContainmentActivationStoreV1 expectedTenantId",
  publicEntrypoints: "export const createDiscoveryLead = safe;",
  readOnlyRunner: "inspectAuthority(); authorityVerifier.verify(); assertZeroWriteInvariant();",
};

test("1. exact target passes", () => assert.deepEqual(check.assertTarget(check.TARGET), check.TARGET));
test("2. wrong project fails", () => assert.throws(() => check.assertTarget({ ...check.TARGET, project: "other" })));
test("3. Production fails", () => assert.throws(() => check.assertTarget({ ...check.TARGET, environment: "PRODUCTION" })));
test("4. Staging fails", () => assert.throws(() => check.assertTarget({ ...check.TARGET, environment: "STAGING" })));
test("5. wrong region fails", () => assert.throws(() => check.assertTarget({ ...check.TARGET, region: "europe-west1" })));
test("6. missing arguments fail", () => assert.throws(() => check.assertTarget(check.parseArguments(["--project=aura-intel-preview"]))));
test("7. duplicate arguments fail", () => assert.throws(() => check.parseArguments(["--project=aura-intel-preview", "--project=other"])));
test("8. exact unchanged zero baseline passes", () => check.assertZeroWriteInvariant({ a: 0 }, { a: 0 }));
test("9. changed count fails", () => assert.throws(() => check.assertZeroWriteInvariant({ a: 0 }, { a: 1 })));
test("10. nonzero baseline fails", () => assert.throws(() => check.assertZeroWriteInvariant({ a: 1 }, { a: 1 })));
test("11. callable surface fails", () => assert.throws(() => inspectSources({ ...valid, composition: `${valid.composition} onCall(() => {})` })));
test("12. HTTP surface fails", () => assert.throws(() => inspectSources({ ...valid, verifier: `${valid.verifier} express()` })));
test("13. public export fails", () => assert.throws(() => inspectSources({ ...valid, publicEntrypoints: "export { PreviewContainmentActivationCompositionV1 }" })));
test("14. activation execute fails", () => assert.throws(() => inspectSources({ ...valid, readOnlyRunner: `${valid.readOnlyRunner} controlPlane.execute()` })));
test("15. apply flag fails", () => assert.throws(() => inspectSources({ ...valid, readOnlyRunner: `${valid.readOnlyRunner} --apply` })));
test("16. Production identity fails", () => assert.throws(() => inspectSources({ ...valid, verifier: `${valid.verifier} aura-control-center-debb3` })));
test("17. missing exact capability fails", () => assert.throws(() => inspectSources({ ...valid, verifier: valid.verifier.replace("containment.policy.activate", "") })));
test("18. actual source tree passes", () => assert.deepEqual(run(path.resolve(__dirname, "..", "..")), {
  target: { project: "aura-intel-preview", environment: "PREVIEW", region: "us-central1" },
  privateComposition: true,
  publicHandlers: 0,
  writes: 0,
}));
