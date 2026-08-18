import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";

import {
  certifyDeploymentOutputV1,
} from "./ai-ux-02d2e4x-browser-proof-build-certification.mjs";

const execFileAsync = promisify(execFile);

const PROJECT_ID =
  "prj_oFCa4FIUHNGyIn5JH7QMDWoDGhp0";

const DIGEST =
  /^[a-f0-9]{64}$/u;

const digest =
  process.env.VITE_AI_UX_02D2E4_CONTROL_PROOF_DIGEST_V1;

if (process.env.VITE_AURA_RUNTIME_ENVIRONMENT !== "PREVIEW") {
  throw new Error("PREVIEW_CERTIFICATION_RUNTIME_REJECTED");
}

if (!DIGEST.test(digest ?? "")) {
  throw new Error("PREVIEW_CERTIFICATION_DIGEST_REJECTED");
}

const cwd = process.cwd();

async function run(executable, args) {
  const result = await execFileAsync(
    executable,
    args,
    {
      cwd,
      env: process.env,
      encoding: "utf8",
      windowsHide: true,
      maxBuffer: 16 * 1024 * 1024,
      shell: process.platform === "win32",
    },
  );

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }

  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
}

await run(
  "npm",
  [
    "run",
    "build",
    "--prefix",
    "packages/aura-executive-documents",
  ],
);

await run(
  "npx",
  [
    "tsc",
    "-b",
    "--pretty",
    "false",
  ],
);

await run(
  "npx",
  [
    "vite",
    "build",
    "--mode",
    "preview-certification",
  ],
);

const sidecar =
  await certifyDeploymentOutputV1({
    outputRoot: resolve(cwd, "dist"),
    projectId: PROJECT_ID,
    controlProofDigest: digest,
    writeSidecar: true,
  });

process.stdout.write(
  `${JSON.stringify({
    status: "PASS",
    projectId: sidecar.projectId,
    deploymentArtifactDigest:
      sidecar.deploymentArtifactDigest,
  })}\n`,
);
