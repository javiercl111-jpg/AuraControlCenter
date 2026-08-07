"use strict";

const assert = require("node:assert/strict");
const { createRequire } = require("node:module");
const path = require("node:path");

const TARGET = Object.freeze({
  project: "aura-intel-preview",
  environment: "PREVIEW",
  region: "us-central1",
});
const TENANT_LABEL = "AI02H2-PREVIEW-SYNTHETIC-TENANT-01";
const ZERO_WRITE_COLLECTIONS = Object.freeze([
  "discovery_containment_policies_v1",
  "discovery_containment_active_v1",
  "discovery_containment_audit_v1",
  "market_discovery_links",
  "discovery_sessions",
  "discovery_completions_v1",
]);

function parseArguments(argv) {
  const result = {};
  for (const argument of argv) {
    const match = /^--(project|environment|region)=(.+)$/u.exec(argument);
    assert.ok(match, "AUTHORITY_COMPOSITION_ARGUMENT_REJECTED");
    assert.equal(result[match[1]], undefined, "AUTHORITY_COMPOSITION_ARGUMENT_REJECTED");
    result[match[1]] = match[2];
  }
  return result;
}

function assertTarget(input) {
  assert.deepEqual(Object.keys(input).sort(), ["environment", "project", "region"]);
  assert.deepEqual(input, TARGET, "AUTHORITY_COMPOSITION_TARGET_REJECTED");
  return TARGET;
}

async function countCollections(firestore) {
  const counts = await Promise.all(ZERO_WRITE_COLLECTIONS.map(async (name) => {
    const snapshot = await firestore.collection(name).count().get();
    return [name, snapshot.data().count];
  }));
  return Object.freeze(Object.fromEntries(counts));
}

function assertZeroWriteInvariant(before, after) {
  assert.deepEqual(after, before, "AUTHORITY_COMPOSITION_WRITE_DETECTED");
  assert.ok(Object.values(after).every((count) => count === 0),
    "AUTHORITY_COMPOSITION_BASELINE_NOT_EMPTY");
}

async function resolveTenantId(firestore) {
  const snapshot = await firestore.collection("platform_tenants")
    .where("testMetadata.label", "==", TENANT_LABEL).limit(2).get();
  assert.equal(snapshot.size, 1, "AUTHORITY_COMPOSITION_TENANT_NOT_UNIQUE");
  return snapshot.docs[0].id;
}

async function run(argv = process.argv.slice(2)) {
  const target = assertTarget(parseArguments(argv));
  const functionsRequire = createRequire(path.resolve(__dirname, "..", "functions", "package.json"));
  const { applicationDefault, getApps, initializeApp } = functionsRequire("firebase-admin/app");
  const { getFirestore } = functionsRequire("firebase-admin/firestore");
  const app = getApps().find((candidate) => candidate.name === "ai02h2e-r1c-r2-readonly") ||
    initializeApp({ credential: applicationDefault(), projectId: target.project },
      "ai02h2e-r1c-r2-readonly");
  const firestore = getFirestore(app);
  const tenantId = await resolveTenantId(firestore);
  const before = await countCollections(firestore);
  const compositionModule = require(path.resolve(
    __dirname, "..", "functions", "lib", "composition",
    "previewContainmentActivation", "PreviewContainmentActivationCompositionV1.js",
  ));
  const composition = compositionModule
    .createPrivatePreviewContainmentActivationCompositionV1(tenantId, firestore);
  const inspection = await composition.inspectAuthority();
  const decision = await composition.authorityVerifier.verify(Object.freeze({
    actor: "CONTAINMENT_ACTIVATION_ACTOR",
    approver: "CONTAINMENT_ACTIVATION_APPROVER",
    reason: "AUTHORITY_COMPOSITION_CERTIFICATION",
    tenantId,
    projectId: "aura-intel-preview",
  }));
  assert.equal(decision, "ALLOW", "AUTHORITY_COMPOSITION_DENIED");
  assert.equal(inspection.eligibleActor, 1);
  assert.equal(inspection.eligibleApprover, 1);
  assert.equal(inspection.validSeparatedPair, 1);
  const after = await countCollections(firestore);
  assertZeroWriteInvariant(before, after);
  return Object.freeze({
    schemaVersion: "PREVIEW_CONTAINMENT_AUTHORITY_COMPOSITION_CHECK_V1",
    mode: "READ_ONLY",
    target,
    authority: inspection,
    decision,
    zeroWriteCollections: ZERO_WRITE_COLLECTIONS.length,
    writes: 0,
  });
}

if (require.main === module) {
  run().then((result) => {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  }).catch((error) => {
    const safeErrorCode = error instanceof Error && /^[A-Z0-9_]+$/u.test(error.message)
      ? error.message
      : "AUTHORITY_COMPOSITION_CHECK_FAILED";
    process.stderr.write(`${JSON.stringify({ status: "FAILED", safeErrorCode })}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  TARGET,
  ZERO_WRITE_COLLECTIONS,
  assertTarget,
  assertZeroWriteInvariant,
  parseArguments,
  run,
};
