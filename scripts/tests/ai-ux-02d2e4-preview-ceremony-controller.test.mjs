import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { EventEmitter } from "node:events";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

import {
  BrowserAutomationEphemeralBootstrapAdapterV1,
  D2E4_BOOTSTRAP_VERSION,
  D2E4_CEREMONY_STATES,
  D2E4_CLAIM_PROPERTY,
  D2E4_CONTROL_CONTEXT,
  D2E4_FIREBASE_PROJECT_ID,
  D2E4_PROJECT_NAME,
  D2E4_RELEASE_BRANCH,
  createBrowserProofCustodyV1,
  createOperationalD2E4PreviewCeremonyControllerV1,
} from "../ai-ux-02d2e4-preview-ceremony-controller.mjs";
import {
  createDeploymentReadinessReceiptV1,
} from "../ai-ux-02d2e4x-browser-proof-deployment-contract-v1.mjs";

const NOW = 1_786_500_000_000;
const target = Object.freeze({
  environment: "PREVIEW",
  projectName: D2E4_PROJECT_NAME,
  firebaseProjectId: D2E4_FIREBASE_PROJECT_ID,
  gitBranch: D2E4_RELEASE_BRANCH,
  controlContext: D2E4_CONTROL_CONTEXT,
});
const deterministicBytes = Buffer.alloc(32, 0x5a);
const expectedProof = deterministicBytes.toString("base64url");
const expectedDigest = createHash("sha256").update(expectedProof, "utf8").digest("hex");
const binding = Object.freeze({
  environment: "PREVIEW",
  authoritativeTenantId: `tenant-${"ab".repeat(32)}`,
  syntheticFixtureLocator: "SYNTHETIC_FIXTURE_V1_8E5D766A3132FF687116E522304115BE",
  linkId: "synthetic_link_certified_v1",
  sessionId: "dossier_synthetic_certified_v1",
  turnId: "AI_UX_02D3_CANARY_TURN_0001",
});

function deploymentReceipt(overrides = {}) {
  return createDeploymentReadinessReceiptV1({
    receiptId: "deployment-readiness-controller-0001",
    status: "READY",
    environment: "PREVIEW",
    projectId: D2E4_PROJECT_NAME,
    deploymentId: "dpl_controller_certified_0001",
    deploymentRevision: "revision-controller-certified-0001",
    deploymentArtifactDigest: "ab".repeat(32),
    controlProofDigest: expectedDigest,
    previewUrl: "https://aura-control-d2e4c.vercel.app",
    deploymentType: "Preview",
    readyState: "READY",
    reusedExistingPreview: true,
    deploymentInvocations: 0,
    productionChanged: false,
    stagingChanged: false,
    readBackSource: "VERCEL_INSPECT",
    certifiedAtMs: NOW - 1,
    expiresAtMs: NOW + 300_000,
    ...overrides,
  }, { now: NOW });
}

function controller(overrides = {}) {
  return createOperationalD2E4PreviewCeremonyControllerV1({
    target,
    randomBytes: () => Buffer.from(deterministicBytes),
    clock: () => NOW,
    ...overrides,
  });
}

async function advanceToCertified(instance, receipt = deploymentReceipt()) {
  assert.equal(await instance.deriveDigest(), expectedDigest);
  instance.bindCertifiedDeployment(receipt);
  assert.equal(instance.state, D2E4_CEREMONY_STATES.DEPLOY_READY);
}

function installClaimBoundary({
  embeddedDigest = expectedDigest,
  observedDigest,
} = {}) {
  let consumed = false;
  const browserHandle = {
    ready: true,
    delivered: false,
    isFrontendReady() { return this.ready && !this.delivered; },
    async deliverOnce(injection) {
      if (this.delivered) throw new Error("SECOND_DELIVERY");
      this.delivered = true;
      this.ready = false;
      return { accepted: true, turnId: injection.turnId };
    },
    invalidate() { this.ready = false; },
  };
  Object.defineProperty(globalThis, D2E4_CLAIM_PROPERTY, {
    configurable: true,
    enumerable: false,
    value: {
      version: D2E4_BOOTSTRAP_VERSION,
      async claim(input) {
        if (consumed || input.version !== D2E4_BOOTSTRAP_VERSION ||
            JSON.stringify(input.binding) !== JSON.stringify(binding)) {
          throw new Error("CLAIM_REJECTED");
        }
        consumed = true;
        Reflect.deleteProperty(globalThis, D2E4_CLAIM_PROPERTY);
        const observed = observedDigest ?? createHash("sha256")
          .update(input.controlProof, "utf8")
          .digest("hex");
        const status = observed === embeddedDigest ? "VERIFIED" : "REJECTED";
        return Object.freeze({
          proofObservation: Object.freeze({
            status,
            expectedControlProofDigest: embeddedDigest,
            observedControlProofDigest: observed,
            verifiedAtMs: NOW,
          }),
          handle: status === "VERIFIED" ? browserHandle : null,
        });
      },
    },
  });
  return browserHandle;
}

function fakePage() {
  return {
    url: "https://aura-control-d2e4c.vercel.app/",
    storage: new Map(),
    cookies: [],
    telemetry: [],
    async evaluateHandle(operation, payload) { return operation(payload); },
    async evaluate(operation, payload) { return operation(payload); },
  };
}

function browserAdapter(page = fakePage()) {
  return new BrowserAutomationEphemeralBootstrapAdapterV1({
    page,
    telemetryDisabled: true,
  });
}

test("proof custody generates at least 256 bits and derives canonical SHA-256", () => {
  let requested = 0;
  const custody = createBrowserProofCustodyV1({
    randomBytes(size) { requested = size; return randomBytes(size); },
  });
  assert.equal(requested, 32);
  assert.match(custody.deriveDigest(), /^[a-f0-9]{64}$/u);
  custody.destroy();
});

test("deterministic custody produces the build-certified digest", async () => {
  const instance = controller();
  assert.equal(await instance.deriveDigest(), expectedDigest);
  instance.destroy();
});

test("exact receipt binds proof custody without runtime configuration", async () => {
  const instance = controller();
  await advanceToCertified(instance);
  assert.equal(instance.state, D2E4_CEREMONY_STATES.DEPLOY_READY);
  assert.doesNotMatch(JSON.stringify(instance), new RegExp(expectedProof, "u"));
  instance.destroy();
});

test("mismatched or expired certified digest fails closed before browser proof", async () => {
  const mismatch = controller();
  await mismatch.deriveDigest();
  assert.throws(() => mismatch.bindCertifiedDeployment(deploymentReceipt({
    controlProofDigest: "cd".repeat(32),
  })), /D2E4_CERTIFIED_DEPLOYMENT_BINDING_REJECTED/u);
  mismatch.destroy();

  const expired = controller({ clock: () => NOW + 300_000 });
  await expired.deriveDigest();
  assert.throws(() => expired.bindCertifiedDeployment(deploymentReceipt()),
    /DEPLOYMENT_READINESS_EXPIRED/u);
  expired.destroy();
});

test("browser proof returns exact VERIFIED deployment-bound evidence", async () => {
  const instance = controller();
  await advanceToCertified(instance);
  installClaimBoundary();
  const proof = await instance.bootstrapBrowser(browserAdapter(), binding);
  assert.deepEqual(Object.keys(proof), [
    "status", "deploymentId", "deploymentArtifactDigest",
    "expectedControlProofDigest", "observedControlProofDigest", "verifiedAtMs",
  ]);
  assert.equal(proof.status, "VERIFIED");
  assert.equal(proof.expectedControlProofDigest, expectedDigest);
  assert.equal(proof.observedControlProofDigest, expectedDigest);
  assert.equal(Object.isFrozen(proof), true);
  assert.equal(instance.state, D2E4_CEREMONY_STATES.BROWSER_READY);
  instance.destroy();
});

test("browser proof retains a certified observed mismatch as REJECTED", async () => {
  const instance = controller();
  await advanceToCertified(instance);
  installClaimBoundary({ observedDigest: "cd".repeat(32) });
  const proof = await instance.bootstrapBrowser(browserAdapter(), binding);
  assert.equal(proof.status, "REJECTED");
  assert.equal(proof.expectedControlProofDigest, expectedDigest);
  assert.equal(proof.observedControlProofDigest, "cd".repeat(32));
  assert.equal(instance.state, D2E4_CEREMONY_STATES.PROOF_REJECTED);
  instance.destroy();
});

test("one verified proof permits exactly one capability delivery", async () => {
  const instance = controller();
  await advanceToCertified(instance);
  installClaimBoundary();
  await instance.bootstrapBrowser(browserAdapter(), binding);
  const receipt = await instance.consumeOnce({
    version: "DIRECT_EPHEMERAL_DISCOVERY_CAPABILITY_V1",
    bearer: "synthetic-test-bearer-not-operational",
    turnId: binding.turnId,
  });
  assert.deepEqual(receipt, { accepted: true, turnId: binding.turnId });
  await assert.rejects(() => instance.consumeOnce({ bearer: "second" }),
    /D2E4_INVALID_STATE_TRANSITION/u);
  instance.destroy();
});

test("proof custody cannot be reused after a browser attempt", async () => {
  const instance = controller();
  await advanceToCertified(instance);
  installClaimBoundary();
  await instance.bootstrapBrowser(browserAdapter(), binding);
  await assert.rejects(() => instance.bootstrapBrowser(browserAdapter(), binding),
    /D2E4_INVALID_STATE_TRANSITION/u);
  instance.destroy();
});

test("browser adapter uses no URL, storage, cookie, or telemetry proof carrier", async () => {
  const instance = controller();
  await advanceToCertified(instance);
  installClaimBoundary();
  const page = fakePage();
  const beforeUrl = page.url;
  await instance.bootstrapBrowser(browserAdapter(page), binding);
  assert.equal(page.url, beforeUrl);
  assert.equal(page.storage.size, 0);
  assert.equal(page.cookies.length, 0);
  assert.equal(page.telemetry.length, 0);
  instance.destroy();
});

test("proof remains out of files environment arguments and serialization", async () => {
  const beforeFiles = await readdir(".");
  const beforeEnvironment = JSON.stringify(process.env);
  const beforeArguments = [...process.argv];
  const instance = controller();
  await advanceToCertified(instance);
  assert.deepEqual(await readdir("."), beforeFiles);
  assert.equal(JSON.stringify(process.env), beforeEnvironment);
  assert.deepEqual(process.argv, beforeArguments);
  assert.doesNotMatch(JSON.stringify(instance), new RegExp(expectedProof, "u"));
  instance.destroy();
});

test("lifecycle exit destroys custody and blocks continuation", async () => {
  const lifecycle = new EventEmitter();
  const instance = controller({ lifecycle });
  await instance.deriveDigest();
  lifecycle.emit("exit");
  assert.equal(instance.state, D2E4_CEREMONY_STATES.DESTROYED);
  assert.throws(() => instance.bindCertifiedDeployment(deploymentReceipt()),
    /D2E4_INVALID_STATE_TRANSITION/u);
});

test("controller source contains no plaintext logging or persistence carrier", async () => {
  const source = await readFile(
    new URL("../ai-ux-02d2e4-preview-ceremony-controller.mjs", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source,
    /console\.|process\.(?:stdout|stderr)|writeFile|clipboard|localStorage|sessionStorage|document\.cookie/u);
  assert.doesNotMatch(source, new RegExp(expectedProof, "u"));
});
