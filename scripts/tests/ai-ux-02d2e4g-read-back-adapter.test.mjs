import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  D2E4G_PREVIEW_DEPLOYMENT_ID,
  D2E4G_PREVIEW_PROJECT_ID,
  D2E4G_PREVIEW_URL,
  ExistingPreviewDeploymentReadBackAdapterV1,
} from "../ai-ux-02d2e4g-execution-entrypoint-separation.mjs";
import {
  DEPLOYMENT_CERTIFICATION_SIDECAR_PATH_V1,
  DEPLOYMENT_READINESS_FIELDS_V1,
  DEPLOYMENT_READINESS_TTL_MS_V1,
  createDeploymentArtifactManifestV1,
  createDeploymentCertificationSidecarV1,
} from "../ai-ux-02d2e4x-browser-proof-deployment-contract-v1.mjs";

const NOW = 1_786_500_000_000;
const PROOF_DIGEST = "ab".repeat(32);
const FILE_BYTES = Buffer.from("certified immutable browser build", "utf8");
const FILE_DIGEST = createHash("sha256").update(FILE_BYTES).digest("hex");

function certificationSidecar(overrides = {}) {
  const manifest = createDeploymentArtifactManifestV1({
    projectId: D2E4G_PREVIEW_PROJECT_ID,
    controlProofDigest: PROOF_DIGEST,
    files: [Object.freeze({
      path: "assets/application.js",
      byteLength: FILE_BYTES.byteLength,
      sha256: FILE_DIGEST,
    })],
  });
  return Object.freeze({
    ...createDeploymentCertificationSidecarV1(manifest),
    ...overrides,
  });
}

function boundary({ provider = {}, sidecar = certificationSidecar(), bytes = FILE_BYTES } = {}) {
  const commands = [];
  const reads = [];
  let id = 0;
  const adapter = new ExistingPreviewDeploymentReadBackAdapterV1({
    releaseRoot: "D:/release",
    clock: () => NOW,
    idFactory: () => `certified-${++id}`,
    executor: {
      async execute(executable, args, options) {
        commands.push({ executable, args, options });
        return {
          stdout: JSON.stringify({
            id: D2E4G_PREVIEW_DEPLOYMENT_ID,
            readyState: "READY",
            target: "preview",
            project: { id: D2E4G_PREVIEW_PROJECT_ID },
            url: D2E4G_PREVIEW_URL,
            deploymentRevision: "revision-certified-v1-0001",
            deploymentArtifactDigest: sidecar.deploymentArtifactDigest,
            controlProofDigest: sidecar.controlProofDigest,
            ...provider,
          }),
        };
      },
    },
    httpReader: {
      async readJson(url) {
        reads.push({ type: "json", url });
        return sidecar;
      },
      async readBytes(url) {
        reads.push({ type: "bytes", url });
        return new Uint8Array(bytes);
      },
    },
  });
  return { adapter, commands, reads };
}

test("read-back emits exact immutable DeploymentReadinessReceiptV1 without deployment", async () => {
  const { adapter, commands, reads } = boundary();
  const receipt = await adapter.readBack({ traceId: "trace-readback-certified-0001" });
  assert.deepEqual(Object.keys(receipt), DEPLOYMENT_READINESS_FIELDS_V1);
  assert.equal(receipt.contractName, "DeploymentReadinessReceiptV1");
  assert.equal(receipt.contractVersion, "V1");
  assert.equal(receipt.projectId, D2E4G_PREVIEW_PROJECT_ID);
  assert.equal(receipt.deploymentRevision, "revision-certified-v1-0001");
  assert.equal(receipt.controlProofDigest, PROOF_DIGEST);
  assert.equal(receipt.certifiedAtMs, NOW);
  assert.equal(receipt.expiresAtMs, NOW + DEPLOYMENT_READINESS_TTL_MS_V1);
  assert.equal(receipt.deploymentInvocations, 0);
  assert.equal(receipt.productionChanged, false);
  assert.equal(receipt.stagingChanged, false);
  assert.equal(Object.isFrozen(receipt), true);
  assert.equal(commands.length, 1);
  assert.deepEqual(commands[0].args, [
    "inspect", D2E4G_PREVIEW_DEPLOYMENT_ID, "--json",
  ]);
  assert.equal(commands[0].args.includes("deploy"), false);
  assert.equal(reads[0].url,
    `${D2E4G_PREVIEW_URL}/${DEPLOYMENT_CERTIFICATION_SIDECAR_PATH_V1}`);
  assert.equal(reads[1].url, `${D2E4G_PREVIEW_URL}/assets/application.js`);
});

test("read-back fails closed with RuntimeErrorV1 for Production provider state", async () => {
  const { adapter } = boundary({ provider: { target: "production" } });
  await assert.rejects(
    () => adapter.readBack({ traceId: "trace-readback-rejected-0001" }),
    (error) => {
      assert.equal(error.contractName, "RuntimeErrorV1");
      assert.equal(error.contractVersion, "V1");
      assert.equal(error.code, "D2E4G_EXISTING_PREVIEW_REJECTED");
      assert.equal(error.stage, "DEPLOYMENT");
      assert.equal(error.producer, "DeploymentReadBack");
      assert.equal(error.traceId, "trace-readback-rejected-0001");
      return true;
    },
  );
});

test("read-back rejects artifact bytes that do not match certified deployment evidence", async () => {
  const { adapter } = boundary({ bytes: Buffer.from("tampered", "utf8") });
  await assert.rejects(
    () => adapter.readBack({ traceId: "trace-readback-tamper-0001" }),
    (error) => error.contractName === "RuntimeErrorV1" &&
      error.code === "D2E4G_DEPLOYMENT_FILE_DIGEST_REJECTED",
  );
});

test("read-back rejects provider digest substitution", async () => {
  const { adapter } = boundary({
    provider: { controlProofDigest: "cd".repeat(32) },
  });
  await assert.rejects(
    () => adapter.readBack({ traceId: "trace-readback-proof-mismatch-0001" }),
    (error) => error.contractName === "RuntimeErrorV1" &&
      error.code === "D2E4G_DEPLOYMENT_CERTIFICATION_MISMATCH",
  );
});

test("read-back is one-shot and preserves the second-read failure contract", async () => {
  const { adapter } = boundary();
  await adapter.readBack({ traceId: "trace-readback-first-0001" });
  await assert.rejects(
    () => adapter.readBack({ traceId: "trace-readback-second-0001" }),
    (error) => error.contractName === "RuntimeErrorV1" &&
      error.code === "D2E4G_SECOND_DEPLOYMENT_READBACK_REJECTED",
  );
});
