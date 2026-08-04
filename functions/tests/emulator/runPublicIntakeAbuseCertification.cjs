"use strict";

const assert = require("node:assert/strict");
const { existsSync, rmSync } = require("node:fs");
const net = require("node:net");
const { resolve } = require("node:path");
const { spawnSync } = require("node:child_process");

const repositoryRoot = resolve(__dirname, "..", "..", "..");
const npmExecutable = process.platform === "win32" ? "npm.cmd" : "npm";
const LOOPBACK_PATTERN = /^(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?$/;
const generatedArtifacts = Object.freeze([
  resolve(repositoryRoot, "firestore-debug.log"),
  resolve(repositoryRoot, "functions", ".generated"),
]);
const preexistingArtifacts = new Set(
  generatedArtifacts.filter((artifact) => existsSync(artifact)),
);

const domains = Object.freeze([
  { name: "P8 matrix, App Check seam, access integrity", script: "test:public-intake-abuse-matrix", ports: [] },
  { name: "P2 atomic rate limits", script: "test:firestore-rate-limit-emulator", ports: [8090] },
  { name: "P3 idempotency retention", script: "test:firestore-idempotency-emulator", ports: [8092] },
  { name: "P4 capabilities and exactly-once", script: "test:firestore-capability-emulator", ports: [8093] },
  { name: "P5 payload and cost bounds", script: "test:discovery-payload-bounds-emulator", ports: [8094] },
  { name: "P6 structured abuse telemetry", script: "test:discovery-abuse-telemetry-emulator", ports: [8095] },
  { name: "P7 containment and emergency quotas", script: "test:discovery-containment-emulator", ports: [8096] },
  { name: "Authority D.9", script: "test:firestore-authority-end-to-end-emulator", ports: [8089] },
  { name: "Dark Handler D.8", script: "test:authority-dark-handler-composition", ports: [] },
]);

assert.equal(process.version, "v20.20.2", `P8 requires Node v20.20.2; received ${process.version}`);
assert.equal(process.env.GOOGLE_APPLICATION_CREDENTIALS, undefined, "P8 forbids GOOGLE_APPLICATION_CREDENTIALS");
for (const variable of [
  "FIRESTORE_EMULATOR_HOST", "FIREBASE_AUTH_EMULATOR_HOST",
  "FIREBASE_STORAGE_EMULATOR_HOST", "FUNCTIONS_EMULATOR_HOST",
]) {
  const value = process.env[variable];
  assert.equal(value === undefined || LOOPBACK_PATTERN.test(value), true, `${variable} must be loopback when set`);
}

function wait(milliseconds) {
  return new Promise((resolveWait) => setTimeout(resolveWait, milliseconds));
}

async function assertPortReleased(port) {
  let lastError;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      await new Promise((resolveListen, rejectListen) => {
        const server = net.createServer();
        server.once("error", rejectListen);
        server.listen(port, "127.0.0.1", () => server.close(resolveListen));
      });
      return;
    } catch (error) {
      lastError = error;
      await wait(100);
    }
  }
  throw new Error(`Certification port ${port} was not released`, { cause: lastError });
}

async function main() {
  const results = [];
  try {
    for (const domain of domains) {
      process.stdout.write(`\n=== ${domain.name} ===\n`);
      const result = spawnSync(npmExecutable, ["run", domain.script], {
        cwd: repositoryRoot,
        env: { ...process.env },
        shell: process.platform === "win32",
        stdio: "inherit",
      });
      let passed = result.error === undefined && result.status === 0;
      let detail = passed ? "PASS" : `FAIL (${result.status ?? "spawn error"})`;
      if (passed) {
        try {
          for (const port of domain.ports) await assertPortReleased(port);
        } catch (error) {
          passed = false;
          detail = `FAIL (${error instanceof Error ? error.message : "port check"})`;
        }
      }
      results.push({ name: domain.name, passed, detail });
    }

    process.stdout.write("\n=== PUBLIC INTAKE ABUSE CERTIFICATION SUMMARY ===\n");
    for (const result of results) {
      process.stdout.write(`${result.passed ? "PASS" : "FAIL"} ${result.name}\n`);
    }
    const failures = results.filter(({ passed }) => !passed);
    if (failures.length > 0) {
      throw new Error(`Certification failed in ${failures.map(({ name }) => name).join(", ")}`);
    }
  } finally {
    for (const artifact of generatedArtifacts) {
      if (!preexistingArtifacts.has(artifact) && existsSync(artifact)) {
        rmSync(artifact, { recursive: true, force: true });
      }
    }
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Certification failed");
  process.exitCode = 1;
});
