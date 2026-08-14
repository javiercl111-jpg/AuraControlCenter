import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  BROWSER_PROOF_RESULT_FIELDS_V1,
  DEPLOYMENT_READINESS_FIELDS_V1,
  assertDeploymentReadinessReceiptV1,
  calculateDeploymentArtifactDigestV1,
  createBrowserProofResultV1,
  createDeploymentArtifactManifestV1,
  createDeploymentCertificationSidecarV1,
  createDeploymentReadinessReceiptV1,
  hashBrowserControlProofV1,
} from "../ai-ux-02d2e4x-browser-proof-deployment-contract-v1.mjs";

const NOW = 1_786_500_000_000;
const PROOF = Buffer.alloc(32, 0x2d).toString("base64url");
const PROOF_DIGEST = hashBrowserControlProofV1(PROOF);
const ARTIFACT_DIGEST = "cd".repeat(32);

function receipt(overrides = {}) {
  return createDeploymentReadinessReceiptV1({
    receiptId: "deployment-readiness-certified-0001",
    status: "READY",
    environment: "PREVIEW",
    projectId: "aura-control-center",
    deploymentId: "dpl_7PqUaT1UvrNhNHupCND3YXTvLtbi",
    deploymentRevision: "revision-certified-v1-0001",
    deploymentArtifactDigest: ARTIFACT_DIGEST,
    controlProofDigest: PROOF_DIGEST,
    previewUrl: "https://aura-control-certified.vercel.app",
    deploymentType: "Preview",
    readyState: "READY",
    reusedExistingPreview: true,
    deploymentInvocations: 0,
    productionChanged: false,
    stagingChanged: false,
    readBackSource: "VERCEL_INSPECT",
    certifiedAtMs: NOW,
    expiresAtMs: NOW + 300_000,
    ...overrides,
  }, { now: NOW });
}

test("DeploymentReadinessReceiptV1 has the exact frozen 20-field surface", () => {
  const value = receipt();
  assert.deepEqual(Object.keys(value), DEPLOYMENT_READINESS_FIELDS_V1);
  assert.equal(Object.isFrozen(value), true);
  assert.equal(value.contractName, "DeploymentReadinessReceiptV1");
  assert.equal(value.contractVersion, "V1");
  assert.equal(value.deploymentInvocations, 0);
});

test("legacy, extra, or expired deployment evidence fails closed", () => {
  assert.throws(() => assertDeploymentReadinessReceiptV1(Object.freeze({
    ...receipt(),
    projectName: "aura-control-center",
  })), /DEPLOYMENT_READINESS_SHAPE_REJECTED/u);
  assert.throws(() => assertDeploymentReadinessReceiptV1(receipt(), {
    now: NOW + 300_000,
  }), /DEPLOYMENT_READINESS_EXPIRED/u);
});

test("BrowserProofResultV1 is exact and bound to deployment certification", () => {
  const deployment = receipt();
  const result = createBrowserProofResultV1({
    status: "VERIFIED",
    deploymentId: deployment.deploymentId,
    deploymentArtifactDigest: deployment.deploymentArtifactDigest,
    expectedControlProofDigest: deployment.controlProofDigest,
    observedControlProofDigest: PROOF_DIGEST,
    verifiedAtMs: NOW + 1,
  }, deployment, NOW + 1);
  assert.deepEqual(Object.keys(result), BROWSER_PROOF_RESULT_FIELDS_V1);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(result.status, "VERIFIED");
  assert.equal(result.deploymentId, deployment.deploymentId);
});

test("BrowserProofResultV1 retains a certified mismatch as REJECTED", () => {
  const deployment = receipt();
  const result = createBrowserProofResultV1({
    status: "REJECTED",
    deploymentId: deployment.deploymentId,
    deploymentArtifactDigest: deployment.deploymentArtifactDigest,
    expectedControlProofDigest: deployment.controlProofDigest,
    observedControlProofDigest: "ef".repeat(32),
    verifiedAtMs: NOW + 1,
  }, deployment, NOW + 1);
  assert.equal(result.status, "REJECTED");
  assert.notEqual(result.expectedControlProofDigest, result.observedControlProofDigest);
});

test("BrowserProofResultV1 rejects status/digest inconsistency and deployment substitution", () => {
  const deployment = receipt();
  assert.throws(() => createBrowserProofResultV1({
    status: "VERIFIED",
    deploymentId: deployment.deploymentId,
    deploymentArtifactDigest: deployment.deploymentArtifactDigest,
    expectedControlProofDigest: deployment.controlProofDigest,
    observedControlProofDigest: "ef".repeat(32),
    verifiedAtMs: NOW + 1,
  }, deployment, NOW + 1), /BROWSER_PROOF_RESULT_STATUS_REJECTED/u);
  assert.throws(() => createBrowserProofResultV1({
    status: "REJECTED",
    deploymentId: "different-deployment",
    deploymentArtifactDigest: deployment.deploymentArtifactDigest,
    expectedControlProofDigest: deployment.controlProofDigest,
    observedControlProofDigest: "ef".repeat(32),
    verifiedAtMs: NOW + 1,
  }, deployment, NOW + 1), /EXECUTION_RESULT_BROWSER_PROOF_REJECTED/u);
});

test("deployment artifact digest is canonical and binds exact file bytes", () => {
  const bytes = Buffer.from("immutable browser application", "utf8");
  const manifest = createDeploymentArtifactManifestV1({
    projectId: "aura-control-center",
    controlProofDigest: PROOF_DIGEST,
    files: [Object.freeze({
      path: "assets/application.js",
      byteLength: bytes.byteLength,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    })],
  });
  const digest = calculateDeploymentArtifactDigestV1(manifest);
  const sidecar = createDeploymentCertificationSidecarV1(manifest);
  assert.equal(sidecar.deploymentArtifactDigest, digest);
  assert.match(digest, /^[0-9a-f]{64}$/u);
  assert.equal(JSON.stringify(sidecar).includes(PROOF), false);
});

test("the frozen contract defines BrowserProofResultV1 and no BrowserProofReceiptV1", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(
    new URL("../../AI_UX_02D2E4X_RUNTIME_CONTRACT_V1.md", import.meta.url),
    "utf8",
  );
  assert.match(source, /`BrowserProofResultV1` is exactly:/u);
  assert.doesNotMatch(source, /`BrowserProofReceiptV1` is exactly:/u);
});
