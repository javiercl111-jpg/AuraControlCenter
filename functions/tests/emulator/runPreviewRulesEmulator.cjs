"use strict";

const assert = require("node:assert/strict");
const { resolve } = require("node:path");
const { spawnSync } = require("node:child_process");

const PROJECT_ID = "demo-aura-preview-rules";
const repositoryRoot = resolve(__dirname, "..", "..", "..");
const emulatorConfig = resolve(repositoryRoot, "firebase.json");
const npxExecutable = process.platform === "win32" ? "npx.cmd" : "npx";

assert.equal(
  process.version,
  "v20.20.2",
  `Preview Rules certification requires Node v20.20.2; received ${process.version}`,
);
assert.equal(
  process.env.GOOGLE_APPLICATION_CREDENTIALS,
  undefined,
  "GOOGLE_APPLICATION_CREDENTIALS is forbidden for Rules certification",
);
assert.equal(
  PROJECT_ID.startsWith("demo-"),
  true,
  "Emulator project ID must start with demo-",
);

const childEnvironment = {
  ...process.env,
  GCLOUD_PROJECT: PROJECT_ID,
  GOOGLE_CLOUD_PROJECT: PROJECT_ID,
  FIREBASE_CONFIG: JSON.stringify({ projectId: PROJECT_ID }),
};
delete childEnvironment.GOOGLE_APPLICATION_CREDENTIALS;

const rawTestCommand =
  "npm exec -- vitest run --config functions/tests/emulator/rulesBaseline/vitest.config.ts";
const testCommand = process.platform === "win32"
  ? `"${rawTestCommand}"`
  : rawTestCommand;
const result = spawnSync(
  npxExecutable,
  [
    "--yes",
    "firebase-tools@15.25.0",
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
  },
);

if (result.error !== undefined) throw result.error;
process.exitCode = result.status ?? 1;
