"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const TARGET = Object.freeze({ project: "aura-intel-preview", environment: "PREVIEW", region: "us-central1" });

function inspectSources(input) {
  assert.match(input.verifier, /CONTAINMENT_ACTIVATION_ACTOR/u);
  assert.match(input.verifier, /CONTAINMENT_ACTIVATION_APPROVER/u);
  assert.match(input.verifier, /containment\.policy\.activate/u);
  assert.match(input.verifier, /containment\.policy\.approve/u);
  assert.match(input.verifier, /aura-intel-preview/u);
  assert.match(input.verifier, /ACTIVE/u);
  assert.match(input.verifier, /PREVIEW/u);
  assert.match(input.verifier, /\.limit\(2\)/u);
  assert.match(input.verifier, /hasExactKeys/u);
  assert.match(input.composition, /PreviewContainmentActivationControlPlaneV1/u);
  assert.match(input.composition, /FirestorePreviewContainmentActivationAuthorityVerifierV1/u);
  assert.match(input.composition, /FirestorePreviewContainmentActivationStoreV1/u);
  assert.match(input.composition, /expectedTenantId/u);
  assert.doesNotMatch(input.composition + input.verifier,
    /firebase-functions|\bon(?:Call|Request)\s*\(|express\s*\(/u);
  assert.doesNotMatch(input.publicEntrypoints,
    /PreviewContainmentActivationCompositionV1|FirestorePreviewContainmentActivationAuthorityVerifierV1/u);
  assert.match(input.readOnlyRunner, /inspectAuthority\(\)/u);
  assert.match(input.readOnlyRunner, /authorityVerifier\.verify/u);
  assert.match(input.readOnlyRunner, /assertZeroWriteInvariant/u);
  assert.doesNotMatch(input.readOnlyRunner,
    /controlPlane\.execute|\bdryRun\b|--apply|firebase\s+deploy/u);
  assert.doesNotMatch(input.verifier + input.composition + input.readOnlyRunner,
    /aura-control-center-debb3|aura-intel-staging/u);
  return Object.freeze({ privateComposition: true, publicHandlers: 0, writes: 0 });
}

function run(repositoryRoot) {
  const read = (relative) => fs.readFileSync(path.resolve(repositoryRoot, relative), "utf8");
  const result = inspectSources({
    verifier: read("functions/src/infrastructure/firestore/discoveryContainment/FirestorePreviewContainmentActivationAuthorityVerifierV1.ts"),
    composition: read("functions/src/composition/previewContainmentActivation/PreviewContainmentActivationCompositionV1.ts"),
    publicEntrypoints: [read("functions/src/index.ts"), read("functions/src/previewDiscoveryIndex.ts")].join("\n"),
    readOnlyRunner: read("scripts/preview-containment-authority-composition-check.cjs"),
  });
  return Object.freeze({ target: TARGET, ...result });
}

if (require.main === module) {
  const result = run(path.resolve(__dirname, ".."));
  process.stdout.write(`${JSON.stringify({ status: "PASS", ...result })}\n`);
}

module.exports = { TARGET, inspectSources, run };
