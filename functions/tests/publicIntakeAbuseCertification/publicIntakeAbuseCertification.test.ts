import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  PUBLIC_INTAKE_ABUSE_CERTIFICATION_MATRIX_V1,
} from "./publicIntakeAbuseCertificationMatrix";
import {
  PUBLIC_INTAKE_FAKE_APP_IDS,
  PublicIntakeAbuseHarness,
} from "./publicIntakeAbuseHarness";

const repositoryRoot = resolve(__dirname, "..", "..", "..");
const emulatorConfigs = [
  "firebase.rateLimits.json",
  "firebase.idempotency.json",
  "firebase.capabilities.json",
  "firebase.payloadBounds.json",
  "firebase.abuseTelemetry.json",
  "firebase.containment.json",
  "firebase.authorityEndToEnd.json",
] as const;

function readRepositoryFile(path: string): string {
  return readFileSync(resolve(repositoryRoot, path), "utf8");
}

describe("Public Intake Emulator Abuse Certification V1 matrix", () => {
  it("publishes exactly one ordered blocking case for CT-01 through CT-22", () => {
    expect(PUBLIC_INTAKE_ABUSE_CERTIFICATION_MATRIX_V1).toHaveLength(22);
    expect(PUBLIC_INTAKE_ABUSE_CERTIFICATION_MATRIX_V1.map(({ id }) => id))
      .toEqual(Array.from({ length: 22 }, (_, index) =>
        `CT-${String(index + 1).padStart(2, "0")}`));
    expect(PUBLIC_INTAKE_ABUSE_CERTIFICATION_MATRIX_V1.every(
      ({ blocking }) => blocking,
    )).toBe(true);
  });

  it.each(PUBLIC_INTAKE_ABUSE_CERTIFICATION_MATRIX_V1)(
    "$id has tracked executable evidence: $threat",
    ({ evidence, expected, runner, surfaces, controls }) => {
      expect(expected.length).toBeGreaterThan(10);
      expect(runner.startsWith("test:")).toBe(true);
      expect(surfaces.length).toBeGreaterThan(0);
      expect(controls.length).toBeGreaterThan(0);
      for (const item of evidence) {
        const absolutePath = resolve(repositoryRoot, item.file);
        expect(existsSync(absolutePath), item.file).toBe(true);
        const source = readFileSync(absolutePath, "utf8");
        for (const token of item.contains) {
          expect(source, `${item.file} missing evidence ${token}`).toContain(token);
        }
      }
    },
  );
});

describe("test-only App Check and closed-composition seam", () => {
  it("denies a missing attestation before containment, quota, state, or cost", () => {
    const harness = new PublicIntakeAbuseHarness();
    expect(harness.execute({ appCheckState: "MISSING" })).toEqual({
      decision: "DENY", reason: "APP_CHECK_REQUIRED",
    });
    expect(harness.ledger).toEqual({
      appCheck: 1, containment: 0, quota: 0, stateWrites: 0,
      gemini: 0, pdf: 0, signedUrl: 0, notifications: 0,
    });
  });

  it("denies an invalid attestation before containment and downstream", () => {
    const harness = new PublicIntakeAbuseHarness();
    expect(harness.execute({
      appCheckState: "INVALID", appId: PUBLIC_INTAKE_FAKE_APP_IDS.allowed,
      attestationId: "demo-attestation-invalid",
    })).toEqual({ decision: "DENY", reason: "APP_CHECK_INVALID" });
    expect(harness.ledger.containment).toBe(0);
    expect(harness.ledger.stateWrites).toBe(0);
  });

  it("denies replayed attestation before a second quota or state effect", () => {
    const harness = new PublicIntakeAbuseHarness(2);
    const request = {
      appCheckState: "VALID" as const,
      appId: PUBLIC_INTAKE_FAKE_APP_IDS.allowed,
      attestationId: "demo-attestation-single-use",
    };
    expect(harness.execute(request)).toEqual({ decision: "ALLOW" });
    expect(harness.execute(request)).toEqual({
      decision: "DENY", reason: "APP_CHECK_REPLAYED",
    });
    expect(harness.ledger.quota).toBe(1);
    expect(harness.ledger.stateWrites).toBe(1);
  });

  it("blocks a configured App ID before quota, state, and expensive fakes", () => {
    const harness = new PublicIntakeAbuseHarness();
    expect(harness.execute({
      appCheckState: "VALID", appId: PUBLIC_INTAKE_FAKE_APP_IDS.blocked,
      attestationId: "demo-attestation-blocked-app",
    })).toEqual({ decision: "DENY", reason: "APP_ID_BLOCKED" });
    expect(harness.ledger.containment).toBe(1);
    expect(harness.ledger.quota).toBe(0);
    expect(harness.ledger.stateWrites).toBe(0);
  });

  it("allows a synthetic valid App ID subject to the exact quota", () => {
    const harness = new PublicIntakeAbuseHarness(1);
    expect(harness.execute({
      appCheckState: "VALID", appId: PUBLIC_INTAKE_FAKE_APP_IDS.allowed,
      attestationId: "demo-attestation-allowed-1",
    })).toEqual({ decision: "ALLOW" });
    expect(harness.execute({
      appCheckState: "VALID", appId: PUBLIC_INTAKE_FAKE_APP_IDS.allowed,
      attestationId: "demo-attestation-allowed-2",
    })).toEqual({ decision: "DENY", reason: "QUOTA_EXCEEDED" });
    expect(harness.ledger.quota).toBe(2);
    expect(harness.ledger.stateWrites).toBe(1);
  });
});

describe("certification isolation and architecture guards", () => {
  it("uses only loopback Firestore configs and test rules", () => {
    for (const configName of emulatorConfigs) {
      const config = JSON.parse(readRepositoryFile(
        `functions/tests/emulator/${configName}`,
      )) as { firestore: { rules: string }; emulators: { firestore: { host: string; port: number }; ui: { enabled: boolean } } };
      expect(config.firestore.rules).toBe("firestore.emulator.rules");
      expect(config.emulators.firestore.host).toBe("127.0.0.1");
      expect(config.emulators.firestore.port).toBeGreaterThan(1024);
      expect(config.emulators.ui.enabled).toBe(false);
    }
  });

  it("keeps the certification absent from the production Functions entrypoint", () => {
    const source = readRepositoryFile("functions/src/index.ts");
    expect(source).not.toContain("publicIntakeAbuseCertification");
    expect(source).not.toContain("PublicIntakeAbuseHarness");
  });

  it("contains no credential, remote endpoint, real project, or absolute path", () => {
    const files = [
      "functions/tests/publicIntakeAbuseCertification/publicIntakeAbuseCertificationMatrix.ts",
      "functions/tests/publicIntakeAbuseCertification/publicIntakeAbuseHarness.ts",
      "functions/tests/publicIntakeAbuseCertification/publicIntakeAbuseCertification.test.ts",
      "functions/tests/publicIntakeAbuseCertification/vitest.config.ts",
      "functions/tests/emulator/runPublicIntakeAbuseCertification.cjs",
    ];
    const combined = files.map(readRepositoryFile).join("\n");
    expect(combined).not.toMatch(/https?:\/\//i);
    expect(combined).not.toMatch(/[A-Z]:[\\/]/);
    expect(combined).not.toMatch(/-----BEGIN [A-Z ]*PRIVATE KEY-----/);
    expect(combined).not.toMatch(/(?:prod|production)-[a-z0-9-]+/i);
  });

  it("keeps productive guards byte-stable during this test run", () => {
    const protectedFiles = [
      "functions/src/index.ts", "firestore.rules", "storage.rules",
    ];
    const first = protectedFiles.map((file) =>
      createHash("sha256").update(readRepositoryFile(file)).digest("hex"));
    const second = protectedFiles.map((file) =>
      createHash("sha256").update(readRepositoryFile(file)).digest("hex"));
    expect(second).toEqual(first);
  });

  it("tracks the strict access-integrity predeploy guard and report-scope evidence", () => {
    const accessSource = readRepositoryFile(
      "functions/src/discovery/tests/runDiscoveryAccessIntegrityTests.ts",
    );
    expect(accessSource).toContain(
      'npm --prefix "$PROJECT_DIR" run stage:intelligence-os:functions',
    );
    expect(accessSource).toContain(
      'npm --prefix "$RESOURCE_DIR" run build',
    );
    expect(accessSource).toContain("DISCOVERY_SESSION_MISMATCH");
    expect(accessSource).toContain("DISCOVERY_TENANT_MISMATCH");
    expect(accessSource).toContain("DISCOVERY_ORGANIZATION_MISMATCH");
  });
});
