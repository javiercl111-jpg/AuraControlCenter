import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { certifyDeploymentOutputV1 } from
  "../ai-ux-02d2e4x-browser-proof-build-certification.mjs";
import {
  DEPLOYMENT_CERTIFICATION_SIDECAR_PATH_V1,
  assertDeploymentCertificationSidecarV1,
} from "../ai-ux-02d2e4x-browser-proof-deployment-contract-v1.mjs";

const PROOF_DIGEST = "ab".repeat(32);

test("local build certification emits a deterministic non-secret sidecar", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "d2e4x-browser-proof-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, "assets"));
  await writeFile(join(root, "index.html"), "<main>certified</main>", "utf8");
  await writeFile(join(root, "assets", "app.js"), "export const ready=true;", "utf8");

  const sidecar = await certifyDeploymentOutputV1({
    outputRoot: root,
    projectId: "aura-control-center",
    controlProofDigest: PROOF_DIGEST,
  });
  assert.equal(sidecar.files.length, 2);
  assert.deepEqual(sidecar.files.map(({ path }) => path), [
    "assets/app.js", "index.html",
  ]);
  assert.equal(Object.isFrozen(sidecar), true);

  const stored = JSON.parse(await readFile(
    join(root, ...DEPLOYMENT_CERTIFICATION_SIDECAR_PATH_V1.split("/")),
    "utf8",
  ));
  assertDeploymentCertificationSidecarV1(stored);
  assert.equal(JSON.stringify(stored).includes("controlProof\":"), false);
});

test("certification refuses to overwrite an existing sidecar", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "d2e4x-browser-proof-existing-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, "index.html"), "certified", "utf8");
  await certifyDeploymentOutputV1({
    outputRoot: root,
    projectId: "aura-control-center",
    controlProofDigest: PROOF_DIGEST,
  });
  await assert.rejects(() => certifyDeploymentOutputV1({
    outputRoot: root,
    projectId: "aura-control-center",
    controlProofDigest: PROOF_DIGEST,
  }), /EEXIST/u);
});
