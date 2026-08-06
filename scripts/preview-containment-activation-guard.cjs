"use strict";

const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");

const EXACT_TARGET = Object.freeze({
  project: "aura-intel-preview",
  environment: "PREVIEW",
  region: "us-central1",
});
const CONTROL_PLANE_MARKERS = Object.freeze([
  "PreviewContainmentActivationControlPlaneV1",
  "FirestorePreviewContainmentActivationStoreV1",
]);
const ALLOWED_COLLECTION_CONSTANTS = Object.freeze([
  "DISCOVERY_CONTAINMENT_POLICIES_COLLECTION",
  "DISCOVERY_CONTAINMENT_ACTIVE_COLLECTION",
  "DISCOVERY_CONTAINMENT_AUDIT_COLLECTION",
]);

function validateTarget(input) {
  assert.deepEqual(Object.keys(input).sort(), ["environment", "project", "region"]);
  assert.equal(input.project, EXACT_TARGET.project, "PREVIEW_GUARD_PROJECT_REJECTED");
  assert.equal(input.environment, EXACT_TARGET.environment,
    "PREVIEW_GUARD_ENVIRONMENT_REJECTED");
  assert.equal(input.region, EXACT_TARGET.region, "PREVIEW_GUARD_REGION_REJECTED");
  return EXACT_TARGET;
}

function inspectSources(input) {
  assert.equal(typeof input.controlPlaneSource, "string");
  assert.equal(typeof input.storeSource, "string");
  assert.ok(Array.isArray(input.publicEntrypointSources));
  assert.ok(!/\bon(?:Call|Request)\s*\(/.test(input.controlPlaneSource),
    "PREVIEW_GUARD_PUBLIC_HANDLER_REJECTED");
  assert.ok(!/firebase-functions\/v\d+\/https/.test(input.controlPlaneSource),
    "PREVIEW_GUARD_HTTP_IMPORT_REJECTED");
  assert.ok(!/from\s+["'][^"']*(?:storage|tasks|reports|notifications)[^"']*["']/i
    .test(input.controlPlaneSource + input.storeSource),
  "PREVIEW_GUARD_FORBIDDEN_SURFACE_REJECTED");
  for (const source of input.publicEntrypointSources) {
    for (const marker of CONTROL_PLANE_MARKERS) {
      assert.ok(!source.includes(marker), "PREVIEW_GUARD_PUBLIC_EXPORT_REJECTED");
    }
  }
  const directCollections = [...input.storeSource.matchAll(/\.collection\(["']([^"']+)["']\)/g)]
    .map((match) => match[1]);
  assert.deepEqual(directCollections, [], "PREVIEW_GUARD_UNEXPECTED_COLLECTION_REJECTED");
  const usedCollectionConstants = [...input.storeSource.matchAll(
    /\.collection\((DISCOVERY_[A-Z_]+_COLLECTION)\)/g,
  )].map((match) => match[1]);
  assert.ok(usedCollectionConstants.length >= 3, "PREVIEW_GUARD_COLLECTIONS_MISSING");
  assert.ok(usedCollectionConstants.every((name) =>
    ALLOWED_COLLECTION_CONSTANTS.includes(name)),
  "PREVIEW_GUARD_UNEXPECTED_COLLECTION_REJECTED");
  assert.ok(input.controlPlaneSource.includes("expectedTenantId"),
    "PREVIEW_GUARD_TENANT_BINDING_MISSING");
  assert.ok(input.controlPlaneSource.includes("ACTIVATION_AUTHORITY_REJECTED"),
    "PREVIEW_GUARD_AUTHORITY_FAIL_CLOSED_MISSING");
  return Object.freeze({
    target: EXACT_TARGET,
    publicHandlers: 0,
    allowedCollections: [...ALLOWED_COLLECTION_CONSTANTS],
  });
}

function parseArgs(argv) {
  const parsed = {};
  for (const argument of argv) {
    const match = /^--(project|environment|region)=(.+)$/.exec(argument);
    assert.ok(match, `PREVIEW_GUARD_ARGUMENT_REJECTED:${argument}`);
    assert.equal(parsed[match[1]], undefined, "PREVIEW_GUARD_DUPLICATE_ARGUMENT_REJECTED");
    parsed[match[1]] = match[2];
  }
  return parsed;
}

function run(repositoryRoot, argv) {
  const target = validateTarget(parseArgs(argv));
  const controlPlaneRoot = resolve(repositoryRoot,
    "functions/src/discovery/containment/controlPlane");
  const controlPlaneSource = [
    "previewContainmentActivationTypesV1.ts",
    "previewContainmentActivationValidationV1.ts",
    "previewContainmentFingerprintV1.ts",
    "PreviewContainmentActivationControlPlaneV1.ts",
    "index.ts",
  ].map((file) => readFileSync(resolve(controlPlaneRoot, file), "utf8")).join("\n");
  const storeSource = readFileSync(resolve(repositoryRoot,
    "functions/src/infrastructure/firestore/discoveryContainment/" +
      "FirestorePreviewContainmentActivationStoreV1.ts"), "utf8");
  const publicEntrypointSources = ["index.ts", "previewDiscoveryIndex.ts"]
    .map((file) => readFileSync(resolve(repositoryRoot, "functions/src", file), "utf8"));
  return Object.freeze({ target, ...inspectSources({
    controlPlaneSource, storeSource, publicEntrypointSources,
  }) });
}

if (require.main === module) {
  const result = run(resolve(__dirname, ".."), process.argv.slice(2));
  process.stdout.write(JSON.stringify({
    status: "PASS",
    project: result.target.project,
    environment: result.target.environment,
    region: result.target.region,
    publicHandlers: result.publicHandlers,
    collectionCount: result.allowedCollections.length,
  }) + "\n");
}

module.exports = { EXACT_TARGET, inspectSources, parseArgs, run, validateTarget };
