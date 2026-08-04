"use strict";

const assert = require("node:assert/strict");
const { resolve } = require("node:path");
const { spawnSync } = require("node:child_process");

const PROJECT_ID = "demo-aura-discovery-abuse-telemetry";
const repositoryRoot = resolve(__dirname, "..", "..", "..");
const emulatorConfig = resolve(__dirname, "firebase.abuseTelemetry.json");
const npxExecutable = process.platform === "win32" ? "npx.cmd" : "npx";

assert.equal(process.version, "v20.20.2");
assert.equal(process.env.GOOGLE_APPLICATION_CREDENTIALS, undefined);
assert.equal(PROJECT_ID.startsWith("demo-"), true);

const childEnvironment = {
  ...process.env,
  GCLOUD_PROJECT: PROJECT_ID,
  GOOGLE_CLOUD_PROJECT: PROJECT_ID,
  FIREBASE_CONFIG: JSON.stringify({ projectId: PROJECT_ID }),
};
delete childEnvironment.GOOGLE_APPLICATION_CREDENTIALS;

const rawTestCommand =
  "npm exec -- vitest run --config functions/tests/emulator/abuseTelemetry/vitest.config.ts";
const testCommand = process.platform === "win32" ? `"${rawTestCommand}"` : rawTestCommand;
const result = spawnSync(npxExecutable, [
  "--yes", "--package=firebase-tools@15.25.0", "firebase", "emulators:exec",
  "--only", "firestore", "--project", PROJECT_ID, "--config", emulatorConfig,
  testCommand,
], {
  cwd: repositoryRoot,
  env: childEnvironment,
  shell: process.platform === "win32",
  stdio: "inherit",
});

if (result.error !== undefined) throw result.error;
process.exitCode = result.status ?? 1;
