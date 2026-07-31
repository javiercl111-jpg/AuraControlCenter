"use strict";

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { resolve } = require("node:path");

const PROJECT_ID = "demo-aura-intelligence-os-authority-e2e";
const EMULATOR_HOST = "127.0.0.1:8089";
const FIREBASE_TOOLS_VERSION = "15.25.0";
const repositoryRoot = resolve(__dirname, "..", "..", "..");
const emulatorConfig = resolve(
  __dirname,
  "firebase.authorityEndToEnd.json"
);
const npxExecutable = process.platform === "win32" ? "npx.cmd" : "npx";

assert.equal(
  process.version.startsWith("v20."),
  true,
  `D.9 requires Node 20; received ${process.version}`
);
assert.equal(
  process.env.GOOGLE_APPLICATION_CREDENTIALS,
  undefined,
  "D.9 forbids GOOGLE_APPLICATION_CREDENTIALS"
);
assert.equal(PROJECT_ID.startsWith("demo-"), true);
assert.equal(EMULATOR_HOST.startsWith("127.0.0.1:"), true);

const childEnvironment = {
  ...process.env,
  FIRESTORE_EMULATOR_HOST: EMULATOR_HOST,
  GCLOUD_PROJECT: PROJECT_ID,
  GOOGLE_CLOUD_PROJECT: PROJECT_ID,
  FIREBASE_CONFIG: JSON.stringify({ projectId: PROJECT_ID }),
};
delete childEnvironment.GOOGLE_APPLICATION_CREDENTIALS;

const rawTestCommand =
  "npm exec -- vitest run --config functions/tests/emulator/authorityEndToEnd/vitest.config.ts";
const testCommand = process.platform === "win32"
  ? `"${rawTestCommand}"`
  : rawTestCommand;
const result = spawnSync(
  npxExecutable,
  [
    "--yes",
    `firebase-tools@${FIREBASE_TOOLS_VERSION}`,
    "emulators:exec",
    "--only",
    "firestore",
    "--project",
    PROJECT_ID,
    "--config",
    emulatorConfig,
    testCommand,
  ],
  {
    cwd: repositoryRoot,
    env: childEnvironment,
    shell: process.platform === "win32",
    stdio: "inherit",
  }
);

if (result.error !== undefined) {
  throw result.error;
}
process.exitCode = result.status ?? 1;
