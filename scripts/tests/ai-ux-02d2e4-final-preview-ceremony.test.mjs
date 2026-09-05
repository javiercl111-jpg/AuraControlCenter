import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { createServer } from "node:http";
import test from "node:test";

import {
  D2E4D_STATES,
  D2E4D_TARGET,
  PlaywrightCoreBrowserRuntimeV1,
  RealAdaptiveCanaryControlPlaneAdapterV1,
  RealSyntheticCapabilityRotationAdapterV1,
  RealVercelPreviewCeremonyAdapterV1,
  createOperationalSingleProcessCeremonyRunnerV1,
} from "../ai-ux-02d2e4-final-preview-ceremony.mjs";
import {
  createDeploymentReadinessReceiptV1,
} from "../ai-ux-02d2e4x-browser-proof-deployment-contract-v1.mjs";

const proofBytes = Buffer.alloc(32, 0x2d);
const proof = proofBytes.toString("base64url");
const proofDigest = createHash("sha256").update(proof, "utf8").digest("hex");
const bearer = "ab".repeat(32);
const bearerDigest = createHash("sha256").update(bearer, "utf8").digest("hex");
const previewUrl = "https://d2e4d-local-harness.vercel.app";
const policyVersion = "AI_UX_02D3_ADAPTIVE_CANARY_20260812_V4";
const binding = Object.freeze({
  environment: "PREVIEW",
  authoritativeTenantId: `tenant-${"ab".repeat(32)}`,
  syntheticFixtureLocator: "SYNTHETIC_FIXTURE_V1_8E5D766A3132FF687116E522304115BE",
  linkId: "synthetic_link_certified_v1",
  sessionId: "dossier_synthetic_certified_v1",
  turnId: "AI_UX_02D3_CANARY_TURN_0001",
});

function certifiedDeployment(now = Date.now()) {
  return createDeploymentReadinessReceiptV1({
    receiptId: "deployment-readiness-runner-0001",
    status: "READY",
    environment: "PREVIEW",
    projectId: D2E4D_TARGET.projectName,
    deploymentId: "dpl_7PqUaT1UvrNhNHupCND3YXTvLtbi",
    deploymentRevision: "revision-runner-certified-0001",
    deploymentArtifactDigest: "cd".repeat(32),
    controlProofDigest: proofDigest,
    previewUrl,
    deploymentType: "Preview",
    readyState: "READY",
    reusedExistingPreview: true,
    deploymentInvocations: 0,
    productionChanged: false,
    stagingChanged: false,
    readBackSource: "VERCEL_INSPECT",
    certifiedAtMs: now - 1,
    expiresAtMs: now + 300_000,
  }, { now });
}

function sha(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function localControlPlane(captured) {
  return {
    async dryRun(change) {
      captured.dryRuns += 1;
      return {
        status: "DRY_RUN_VALIDATED",
        fingerprint: sha(JSON.stringify(change)),
        proposedPolicyVersion: change.policy.policyVersion,
        deltas: { policy: 0, pointer: 0, audit: 0, replay: 0 },
      };
    },
    async apply(change) {
      captured.applies += 1;
      captured.policyVersion = change.policy.policyVersion;
      return { status: "APPLIED" };
    },
    async readBack() {
      return {
        status: "ACTIVE",
        pointer: { policyVersion: captured.policyVersion },
      };
    },
  };
}

function canaryChange() {
  return {
    environment: "PREVIEW",
    projectId: "aura-intel-preview",
    authoritativeTenantId: "tenant-authorized-preview",
    actor: "operator-d2e4d",
    approver: "human-approver-d2e4d",
    reasonCode: "AI_UX_02D2E4D_LOCAL_CERTIFICATION",
    changeId: "AI_UX_02D2E4D_LOCAL_20260812_01",
    expectedCurrentPolicyVersion: null,
    policy: {
      policyVersion,
      environment: "PREVIEW",
      mode: "CANARY",
      allowedSyntheticFixtureLocators: ["SYNTHETIC_FIXTURE_V1"],
      allowedIntentClasses: ["CLARIFICATION", "DISCOVER_PROBLEM"],
      killSwitchState: { state: "OFF" },
    },
  };
}

function localRotator(captured, clock) {
  return {
    async issueAndRotate() {
      captured.rotations += 1;
      const handoff = { expiresAt: clock() + 5 * 60 * 1000 };
      Object.defineProperty(handoff, "bearerToken", {
        enumerable: false,
        value: bearer,
      });
      return {
        disposition: "ROTATED",
        actualWriteCount: 1,
        capabilityLocator: "capability-sha256-locator",
        expiresAt: handoff.expiresAt,
        handoff,
      };
    },
  };
}

async function installLocalBrowserBoundary(
  page,
  expectedProofDigest,
  expectedBearerDigest,
  verifiedAtMs,
) {
  await page.evaluate(({ proofHash, bearerHash, proofVerifiedAtMs }) => {
    const hash = async (value) => {
      const bytes = new TextEncoder().encode(value);
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      return Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, "0")).join("");
    };
    let claimAvailable = true;
    let turnAvailable = true;
    Object.defineProperty(globalThis, "__auraAuthorizedJitBootstrapClaimV1", {
      configurable: true,
      enumerable: false,
      value: {
        async claim(input) {
          if (!claimAvailable || await hash(input.controlProof) !== proofHash ||
              input.binding?.environment !== "PREVIEW" ||
              !input.binding?.linkId || !input.binding?.sessionId) {
            throw new Error("CLAIM_REJECTED");
          }
          claimAvailable = false;
          Reflect.deleteProperty(globalThis, "__auraAuthorizedJitBootstrapClaimV1");
          const observedControlProofDigest = await hash(input.controlProof);
          return {
            proofObservation: {
              status: "VERIFIED",
              expectedControlProofDigest: proofHash,
              observedControlProofDigest,
              verifiedAtMs: proofVerifiedAtMs,
            },
            handle: {
              isFrontendReady() {
                return turnAvailable;
              },
              async deliverOnce(injection) {
                if (!turnAvailable || await hash(injection.bearer) !== bearerHash) {
                  throw new Error("CAPABILITY_REJECTED");
                }
                turnAvailable = false;
                globalThis.__sanitizedTurnCount =
                  (globalThis.__sanitizedTurnCount ?? 0) + 1;
                return {
                  version: injection.version,
                  status: "CONSUMED",
                  result: {
                    functionalRequests: 1,
                    replayResult: "CREATED",
                    activationDecision: "USE_INTELLIGENCE",
                    visibleQuestionSource: "INTELLIGENCE",
                  },
                };
              },
              invalidate() {
                turnAvailable = false;
              },
            },
          };
        },
      },
    });
  }, {
    proofHash: expectedProofDigest,
    bearerHash: expectedBearerDigest,
    proofVerifiedAtMs: verifiedAtMs,
  });
}

test("final runner exposes no runtime proof-configuration authority", async () => {
  const calls = [];
  const executor = {
    async execute(executable, args, options) {
      calls.push({ executable, args, options });
      return { stdout: "{}", stderr: "" };
    },
  };
  const adapter = new RealVercelPreviewCeremonyAdapterV1({
    executor,
    releaseRoot: "D:\\certified-release",
    mode: "DRY_RUN",
  });
  assert.equal(adapter.configureDigestOnly, undefined);
  assert.equal(calls.length, 0);
  const source = await readFile(new URL(
    "../ai-ux-02d2e4-final-preview-ceremony.mjs",
    import.meta.url,
  ), "utf8");
  assert.doesNotMatch(source, /configureDigestOnly|CONTROL_PROOF_SHA256/u);
});

test("real Canary adapter enforces dry-run fingerprint before one local apply", async () => {
  const captured = { dryRuns: 0, applies: 0, policyVersion: null };
  const adapter = new RealAdaptiveCanaryControlPlaneAdapterV1({
    controlPlane: localControlPlane(captured),
    mode: "APPLY",
  });
  const result = await adapter.prepare(canaryChange());
  assert.equal(result.status, "ACTIVE");
  assert.equal(captured.dryRuns, 1);
  assert.equal(captured.applies, 1);
  await assert.rejects(() => adapter.prepare(canaryChange()), /D2E4D_SECOND_CANARY_APPLY_REJECTED/u);
});

test("real capability adapter exposes bearer only through a single-use envelope", async () => {
  const now = Date.now();
  const captured = { rotations: 0 };
  const adapter = new RealSyntheticCapabilityRotationAdapterV1({
    rotator: localRotator(captured, () => now),
  });
  const result = await adapter.issueOnce({ policyVersion });
  assert.equal(result.status, "ACTIVE");
  assert.equal(captured.rotations, 1);
  assert.doesNotMatch(JSON.stringify(result), new RegExp(bearer, "u"));
  assert.equal(result.envelope.take(now).bearer, bearer);
  assert.throws(() => result.envelope.take(now), /D2E4D_CAPABILITY_UNAVAILABLE/u);
  await assert.rejects(() => adapter.issueOnce({ policyVersion }), /D2E4D_SECOND_CAPABILITY_REJECTED/u);
});

test("certified existing Preview transitions directly to Canary without deploy", async () => {
  const now = Date.now();
  const runner = createOperationalSingleProcessCeremonyRunnerV1({
    authoritativeBinding: binding,
    randomBytes: () => Buffer.from(proofBytes),
    clock: () => now,
  });
  let canaryPreparations = 0;
  const existingPreview = certifiedDeployment(now);
  await runner.reuseExistingPreview(existingPreview);
  assert.equal(runner.state, D2E4D_STATES.PREVIEW_READY_REUSED);
  await runner.prepareCanary({
    async prepare() {
      canaryPreparations += 1;
      return { status: "ACTIVE", policyVersion };
    },
  }, canaryChange());
  assert.equal(runner.state, D2E4D_STATES.CANARY_READY);
  assert.equal(canaryPreparations, 1);
  assert.equal(existingPreview.deploymentInvocations, 0);
  runner.destroy();
});

test("single process local browser ceremony consumes both secrets once and destroys custody", async (t) => {
  const rootFilesBefore = await readdir(".");
  const argsBefore = [...process.argv];
  const environmentBefore = JSON.stringify(process.env);
  const captured = {
    config: [], deploys: 0, dryRuns: 0, applies: 0,
    policyVersion: null, rotations: 0,
  };
  const now = Date.now();
  const server = createServer((request, response) => {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end("<main id='app'></main>");
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const address = server.address();
  const harnessUrl = `http://127.0.0.1:${address.port}`;
  const runtime = new PlaywrightCoreBrowserRuntimeV1({ allowLocalHarness: true });
  t.after(async () => runtime.close());
  const page = await runtime.open(harnessUrl);
  await installLocalBrowserBoundary(page, proofDigest, bearerDigest, now);

  const runner = createOperationalSingleProcessCeremonyRunnerV1({
    authoritativeBinding: binding,
    randomBytes: () => Buffer.from(proofBytes),
    clock: () => now,
  });
  assert.equal(runner.state, D2E4D_STATES.CREATED);
  await runner.reuseExistingPreview(certifiedDeployment(now));
  assert.equal(runner.state, D2E4D_STATES.PREVIEW_READY_REUSED);
  const canary = new RealAdaptiveCanaryControlPlaneAdapterV1({
    controlPlane: localControlPlane(captured),
    mode: "APPLY",
  });
  await runner.prepareCanary(canary, canaryChange());
  assert.equal(runner.state, D2E4D_STATES.CANARY_READY);
  const capability = new RealSyntheticCapabilityRotationAdapterV1({
    rotator: localRotator(captured, () => now),
  });
  await runner.issueCapability(capability, { policyVersion });
  assert.equal(runner.state, D2E4D_STATES.CAPABILITY_READY);
  const browserProof = await runner.bootstrapBrowser(runtime.createBootstrapAdapter());
  assert.equal(runner.state, D2E4D_STATES.BROWSER_READY);
  assert.equal(browserProof.status, "VERIFIED");
  assert.equal(browserProof.expectedControlProofDigest, proofDigest);
  const receipt = await runner.executeTurn();
  assert.equal(runner.state, D2E4D_STATES.TURN_EXECUTED);
  assert.equal(receipt.result.functionalRequests, 1);
  assert.equal(await page.evaluate(() => globalThis.__sanitizedTurnCount), 1);
  assert.equal(captured.deploys, 0);
  assert.equal(captured.applies, 1);
  assert.equal(captured.rotations, 1);
  assert.deepEqual(captured.config, []);
  assert.doesNotMatch(JSON.stringify(runner), new RegExp(`${proof}|${bearer}`, "u"));
  assert.equal(await page.evaluate(() => {
    try { return localStorage.length; } catch { return 0; }
  }), 0);
  assert.equal(await page.evaluate(() => {
    try { return sessionStorage.length; } catch { return 0; }
  }), 0);
  assert.equal((await page.context().cookies()).length, 0);
  assert.equal(page.url(), `${harnessUrl}/`);
  runner.destroy();
  assert.equal(runner.state, D2E4D_STATES.DESTROYED);
  assert.deepEqual(process.argv, argsBefore);
  assert.equal(JSON.stringify(process.env), environmentBefore);
  assert.deepEqual(await readdir("."), rootFilesBefore);
});

test("invalid state transition fails closed and destroys secrets", async () => {
  const runner = createOperationalSingleProcessCeremonyRunnerV1({
    authoritativeBinding: binding,
    randomBytes: () => Buffer.from(proofBytes),
  });
  await assert.rejects(() => runner.executeTurn(), /D2E4D_INVALID_STATE_TRANSITION/u);
  runner.destroy();
  assert.equal(runner.state, D2E4D_STATES.DESTROYED);
});

test("runner source contains no plaintext persistence or logging carrier", async () => {
  const source = await readFile(
    new URL("../ai-ux-02d2e4-final-preview-ceremony.mjs", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /console\.|process\.(?:stdout|stderr)|writeFile|clipboard|localStorage|sessionStorage|document\.cookie/iu);
  assert.doesNotMatch(source, new RegExp(`${proof}|${bearer}`, "u"));
});
test("RealVercelPreviewCeremonyAdapterV1 transports only control-proof digest as transient build env", async () => {
  const calls = [];
  const digest = "a".repeat(64);

  const executor = {
    async execute(executable, args, options) {
      calls.push({ executable, args, options });

      if (args[0] === "deploy") {
        return {
          stdout: JSON.stringify({
            id: "dpl_unit_live_custody",
            url: "unit-live-custody.vercel.app",
          }),
          stderr: "",
        };
      }

      return {
        stdout: JSON.stringify({
          id: "dpl_unit_live_custody",
          readyState: "READY",
          target: "preview",
        }),
        stderr: "",
      };
    },
  };

  const adapter =
    new RealVercelPreviewCeremonyAdapterV1({
      executor,
      releaseRoot: process.cwd(),
      mode: "APPLY",
      controlProofDigest: digest,
    });

  const deployment =
    await adapter.deployOnce();

  assert.equal(deployment.status, "READY");
  assert.equal(calls.length, 2);

  assert.deepEqual(
    calls[0].args,
    [
      "deploy",
      "--yes",
      "--json",
      "--build-env",
      `VITE_AI_UX_02D2E4_CONTROL_PROOF_DIGEST_V1=${digest}`,
    ],
  );
});

test("RealVercelPreviewCeremonyAdapterV1 APPLY fails closed without digest", async () => {
  const executor = {
    async execute() {
      throw new Error("EXECUTOR_MUST_NOT_RUN");
    },
  };

  const adapter =
    new RealVercelPreviewCeremonyAdapterV1({
      executor,
      releaseRoot: process.cwd(),
      mode: "APPLY",
    });

  await assert.rejects(
    () => adapter.deployOnce(),
    /D2E4D_CONTROL_PROOF_DIGEST_REQUIRED/u,
  );
});

test("RealVercelPreviewCeremonyAdapterV1 rejects invalid digest", () => {
  const executor = {
    async execute() {
      return { stdout: "", stderr: "" };
    },
  };

  assert.throws(
    () =>
      new RealVercelPreviewCeremonyAdapterV1({
        executor,
        releaseRoot: process.cwd(),
        mode: "APPLY",
        controlProofDigest: "A".repeat(64),
      }),
    /D2E4D_VERCEL_ADAPTER_REJECTED/u,
  );
});
