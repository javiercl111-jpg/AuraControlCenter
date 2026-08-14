import assert from "node:assert/strict";
import test from "node:test";

import {
  D2E4G_PREVIEW_DEPLOYMENT_ID,
  D2E4G_PREVIEW_URL,
  createD2E4GCompositionPreflightV1,
} from "../ai-ux-02d2e4g-execution-entrypoint-separation.mjs";
import {
  createDeploymentReadinessReceiptV1,
} from "../ai-ux-02d2e4x-browser-proof-deployment-contract-v1.mjs";

const binding = Object.freeze({
  environment: "PREVIEW",
  authoritativeTenantId: `tenant-${"ab".repeat(32)}`,
  syntheticFixtureLocator: "SYNTHETIC_FIXTURE_V1_8E5D766A3132FF687116E522304115BE",
  linkId: "synthetic_link_certified_v1",
  sessionId: "synthetic_session_certified_v1",
  turnId: "AI_UX_02D2E4H_TURN_0001",
});

function deploymentReceipt(overrides = {}) {
  const now = Date.now();
  return createDeploymentReadinessReceiptV1({
    receiptId: "deployment-readiness-composition-0001",
    status: "READY",
    environment: "PREVIEW",
    projectId: "aura-control-center",
    deploymentId: D2E4G_PREVIEW_DEPLOYMENT_ID,
    deploymentRevision: "revision-composition-certified-0001",
    deploymentArtifactDigest: "ab".repeat(32),
    controlProofDigest: "cd".repeat(32),
    previewUrl: D2E4G_PREVIEW_URL,
    deploymentType: "Preview",
    readyState: "READY",
    reusedExistingPreview: true,
    deploymentInvocations: 0,
    productionChanged: false,
    stagingChanged: false,
    readBackSource: "VERCEL_INSPECT",
    certifiedAtMs: now - 1,
    expiresAtMs: now + 300_000,
    ...overrides,
  }, { now });
}

function dependencies(events, overrides = {}) {
  const writes = { count: 0 };
  return {
    writes,
    value: {
      authorityReader: {
        async readAuthority() {
          events.push("authority.read");
          return overrides.authority ?? { status: "READY", binding };
        },
      },
      rotationReadiness: {
        async readReadiness() {
          events.push("rotation.read");
          return overrides.rotation ?? { status: "READY" };
        },
      },
      canaryControlPlane: {
        async readReadiness() {
          events.push("canary.read");
          return overrides.canary ?? { status: "READY" };
        },
      },
      replayRepositories: {
        async readReadiness() {
          events.push("replay.read");
          return overrides.replay ?? { status: "READY" };
        },
      },
      deploymentReadBack: {
        async readBack() {
          events.push("deployment.read");
          return overrides.deployment ?? deploymentReceipt();
        },
      },
    },
  };
}

const input = Object.freeze({
  environment: "PREVIEW",
  deploymentId: D2E4G_PREVIEW_DEPLOYMENT_ID,
});

test("composition reads dependencies in order and emits an immutable READY artifact", async () => {
  const events = [];
  const setup = dependencies(events);
  const result = await createD2E4GCompositionPreflightV1(setup.value).preflight(input);
  assert.equal(result.COMPOSITION_STATUS, "READY");
  assert.deepEqual(events, [
    "authority.read",
    "rotation.read",
    "canary.read",
    "replay.read",
    "deployment.read",
  ]);
  assert.equal(setup.writes.count, 0);
  assert.equal(result.artifact.deployment.reusedExistingPreview, true);
  assert.equal(Object.isFrozen(result.artifact), true);
  assert.equal(Object.isFrozen(result.artifact.authoritativeBinding), true);
});

test("composition propagates CONDITIONAL and never reaches later dependencies", async () => {
  const events = [];
  const setup = dependencies(events, { canary: { status: "CONDITIONAL" } });
  const result = await createD2E4GCompositionPreflightV1(setup.value).preflight(input);
  assert.deepEqual(result, { COMPOSITION_STATUS: "CONDITIONAL" });
  assert.deepEqual(events, ["authority.read", "rotation.read", "canary.read"]);
});

test("composition blocks a divergent existing Preview without execution", async () => {
  const events = [];
  const setup = dependencies(events, {
    deployment: deploymentReceipt({
      deploymentId: "dpl_8PqUaT1UvrNhNHupCND3YXTvLtbi",
    }),
  });
  const result = await createD2E4GCompositionPreflightV1(setup.value).preflight(input);
  assert.deepEqual(result, { COMPOSITION_STATUS: "BLOCKED" });
});
