import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  EXPECTED_PREVIEW_RUNTIME_REVISION,
} from "../ai-ux-02d2e4e-real-capability-readiness.mjs";
import {
  D2E4G_PREVIEW_DEPLOYMENT_ID,
  D2E4G_PREVIEW_URL,
  D2E4G_SHARED_ARTIFACT_VERSION,
} from "../ai-ux-02d2e4g-execution-entrypoint-separation.mjs";
import {
  D2E4JCompositionError,
  D2E4JOperationalCeremonyHandleV1,
  createOperationalD2E4JPreviewCeremonyCompositionV1,
} from "../ai-ux-02d2e4j-preview-ceremony-composition.mjs";
import {
  createExactCompositionArtifactV1,
  createExactExecutionResultV1,
} from "./ai-ux-02d2e4x-execution-receipt-contract-v1.test.mjs";

const {
  SYNTHETIC_DISCOVERY_CAPABILITY_POLICY_V1:
    syntheticCapabilityPolicy,
} = await import(
  "../../functions/lib/discovery/capabilities/syntheticDiscoveryCapabilityIssuerV1.js"
);

const NOW = Date.parse("2026-08-12T22:00:00.000Z");
const TENANT = syntheticCapabilityPolicy.tenantId;
const FIXTURE = syntheticCapabilityPolicy.fixtureLocator;
const POLICY = "AI_UX_02D2E4J_POLICY_0001";

const PREVIEW_TARGET = Object.freeze({
  deploymentId:
    D2E4G_PREVIEW_DEPLOYMENT_ID,
  deploymentUrl:
    D2E4G_PREVIEW_URL,
  previewUrl:
    D2E4G_PREVIEW_URL,
  projectId:
    "aura-control-center",
  gitBranch:
    "release/ai-ux-02d2e4-preview-control",
});
const authority = Object.freeze({
  environment: "PREVIEW",
  targetProjectId: "aura-intel-preview",
  actorId: "preview-canary-control-plane",
  actorAuthorized: true,
  authoritativeTenantId: TENANT,
  syntheticFixtureLocator: FIXTURE,
  intentClass: "DISCOVER_PROBLEM",
  linkId: syntheticCapabilityPolicy.linkId,
  sessionId: syntheticCapabilityPolicy.sessionId,
  capabilityScope: "DISCOVERY_SESSION",
});

class CertifiedCommandExecutor {
  constructor() {
    this.calls = [];
  }

  async execute(executable, args, options = {}) {
    this.calls.push({ executable, args, options });
    if (args[0] === "run" && args[1] === "services") {
      return {
        stdout: JSON.stringify({
          status: { latestReadyRevisionName: EXPECTED_PREVIEW_RUNTIME_REVISION },
        }),
        stderr: "",
      };
    }
    if (args[0] === "inspect") {
      return {
        stdout: JSON.stringify({
          id: D2E4G_PREVIEW_DEPLOYMENT_ID,
          readyState: "READY",
          target: "preview",
          project: { name: "aura-control-center" },
          url: D2E4G_PREVIEW_URL,
        }),
        stderr: "",
      };
    }
    throw new Error("UNEXPECTED_COMMAND");
  }
}

class CertifiedRotationRepository {
  constructor() {
    this.inspectCalls = 0;
  }

  async inspectExpired(received, now) {
    this.inspectCalls += 1;
    assert.equal(received, authority);
    assert.equal(now, NOW);
    return Object.freeze({
      capabilityLocator: "capability_locator_certified_v1",
      expectedTokenHash: "cd".repeat(32),
      expectedCapabilityVersion: "DISCOVERY_CAPABILITY_V1",
      expectedUpdatedAt: NOW - 10_000,
      expectedExpiresAt: NOW - 1,
      expectedRotationVersion: 0,
    });
  }
}

class CertifiedPolicyRepository {
  async resolveActive(input) {
    assert.equal(input.environment, "PREVIEW");
    assert.equal(input.authoritativeTenantId, TENANT);
    return Object.freeze({
      activePointerVersion: "DISCOVERY_ADAPTIVE_CANARY_ACTIVE_POINTER_V1",
      policy: Object.freeze({
        environment: "PREVIEW",
        mode: "CANARY",
        enabled: true,
        policyVersion: POLICY,
        expiresAt: new Date(NOW + 30 * 60 * 1_000).toISOString(),
        killSwitchState: Object.freeze({ state: "OFF" }),
        allowedSyntheticFixtureLocators: Object.freeze([FIXTURE]),
        allowedIntentClasses: Object.freeze([
          "CLARIFICATION",
          "DISCOVER_PROBLEM",
        ]),
      }),
    });
  }
}

class CertifiedReplayRepository {
  constructor(status = "READY") {
    this.status = status;
    this.calls = 0;
  }

  async readReadiness(input) {
    this.calls += 1;
    assert.equal(input.environment, "PREVIEW");
    assert.equal(input.binding.authoritativeTenantId, TENANT);
    return Object.freeze({ status: this.status });
  }
}

class CertifiedAdaptiveCanaryControlPlane {
  constructor() {
    this.calls = { dryRun: 0, apply: 0, readBack: 0 };
  }

  async dryRun() {
    this.calls.dryRun += 1;
    throw new Error("REMOTE_CANARY_FORBIDDEN_IN_D2E4J_TEST");
  }

  async apply() {
    this.calls.apply += 1;
    throw new Error("REMOTE_CANARY_FORBIDDEN_IN_D2E4J_TEST");
  }

  async readBack() {
    this.calls.readBack += 1;
    throw new Error("REMOTE_CANARY_FORBIDDEN_IN_D2E4J_TEST");
  }
}

class CertifiedRotator {
  async issueAndRotate() {
    throw new Error("REMOTE_CAPABILITY_FORBIDDEN_IN_D2E4J_TEST");
  }
}

function setup(overrides = {}) {
  const commandExecutor = overrides.commandExecutor ??
    new CertifiedCommandExecutor();
  const adaptiveCanaryControlPlane = overrides.adaptiveCanaryControlPlane ??
    new CertifiedAdaptiveCanaryControlPlane();
  const input = {
    environment: "PREVIEW",
    previewTarget:
      PREVIEW_TARGET,
    releaseRoot: process.cwd(),
    approver: "approved-human-operator",
    authoritativeTenantLocator:
      "certified-preview-canary-tenant-locator",
    changeId: "AI_UX_02D2E4J_CHANGE_0001",
    operationId: "AI_UX_02D2E4J_OPERATION_0001",
    policyVersion: POLICY,
    reasonCode: "AI_UX_02D2E4J_EXISTING_PREVIEW",
    authoritativeTenantId: TENANT,
    syntheticFixtureLocator: FIXTURE,
    intentClass: "DISCOVER_PROBLEM",
    turnId: "AI_UX_02D2E4J_TURN_0001",
    traceId: "AI_UX_02D2E4J_TRACE_0001",
    authorityFactory(value) {
      assert.deepEqual(value, {
        authoritativeTenantId: TENANT,
        syntheticFixtureLocator: FIXTURE,
        intentClass: "DISCOVER_PROBLEM",
        turnId: "AI_UX_02D2E4J_TURN_0001",
        traceId: "AI_UX_02D2E4J_TRACE_0001",
      });
      return authority;
    },
    assertCertifiedAuthority(value) {
      assert.equal(value, authority);
    },
    rotationRepository: new CertifiedRotationRepository(),
    policyRepository: new CertifiedPolicyRepository(),
    replayRepository: new CertifiedReplayRepository(),
    adaptiveCanaryControlPlane,
    rotatorClass: CertifiedRotator,
    commandExecutor,
    browserExecutablePath: process.execPath,
    clock: () => NOW,
    ...overrides,
  };
  return { input, commandExecutor, adaptiveCanaryControlPlane };
}

test("legacy Preview composition stays fail-closed before D2E4H receipt execution", async () => {
  const { input, commandExecutor, adaptiveCanaryControlPlane } = setup();
  await assert.rejects(
    () => createOperationalD2E4JPreviewCeremonyCompositionV1(input),
    (error) => error instanceof D2E4JCompositionError &&
      error.code === "D2E4J_D2E4G_NOT_READY" &&
      error.phase === "D2E4G_PREFLIGHT",
  );
  assert.equal(commandExecutor.calls.some(({ args }) => args.includes("deploy")), false);
  assert.deepEqual(adaptiveCanaryControlPlane.calls, {
    dryRun: 0,
    apply: 0,
    readBack: 0,
  });
});

test("explicit Preview target is required before any adapter construction", async () => {
  const {
    input,
    commandExecutor,
  } = setup({
    previewTarget: undefined,
  });

  await assert.rejects(
    () =>
      createOperationalD2E4JPreviewCeremonyCompositionV1(
        input
      ),
    (error) =>
      error instanceof D2E4JCompositionError &&
      error.code ===
        "D2E4J_REQUIRED_PREVIEW_TARGET_MISSING" &&
      error.phase === "CONFIGURATION",
  );

  assert.equal(
    commandExecutor.calls.length,
    0,
  );
});

test("all seven operational configuration fields are required before preflight", async (t) => {
  for (const key of [
    "releaseRoot",
    "approver",
    "authoritativeTenantLocator",
    "changeId",
    "operationId",
    "policyVersion",
    "reasonCode",
  ]) {
    await t.test(key, async () => {
      const { input, commandExecutor } = setup({ [key]: undefined });
      await assert.rejects(
        () => createOperationalD2E4JPreviewCeremonyCompositionV1(input),
        (error) => error instanceof D2E4JCompositionError &&
          error.phase === "CONFIGURATION",
      );
      assert.equal(commandExecutor.calls.length, 0);
    });
  }
});

test("external replay repository cannot override certified internal replay readiness", async () => {
  const maliciousReplayRepository =
    new CertifiedReplayRepository("CONDITIONAL");

  const {
    input,
    commandExecutor,
    adaptiveCanaryControlPlane,
  } = setup({
    replayRepository:
      maliciousReplayRepository,
  });

  await assert.rejects(
    () => createOperationalD2E4JPreviewCeremonyCompositionV1(input),
    /D2E4J_D2E4G_NOT_READY/u,
  );

  assert.equal(
    maliciousReplayRepository.calls,
    0,
  );

  assert.deepEqual(
    adaptiveCanaryControlPlane.calls,
    {
      dryRun: 0,
      apply: 0,
      readBack: 0,
    },
  );

  assert.equal(
    commandExecutor.calls.some(
      ({ args }) => args.includes("deploy"),
    ),
    false,
  );
});
test("missing real adapter fails closed before any read-back", async () => {
  const { input, commandExecutor } = setup();
  input.rotationRepository = undefined;
  await assert.rejects(
    () => createOperationalD2E4JPreviewCeremonyCompositionV1(input),
    /D2E4J_REAL_ADAPTER_MISSING/u,
  );
  assert.equal(commandExecutor.calls.length, 0);
});

test("fabricated artifacts cannot be supplied to the operational handle", async () => {
  const artifact = createExactCompositionArtifactV1();
  const compositionResult = Object.freeze({ COMPOSITION_STATUS: "READY", artifact });
  const handle = new D2E4JOperationalCeremonyHandleV1({
    compositionResult,
    execution: {
      async execute() { return createExactExecutionResultV1("SUCCESS", artifact); },
    },
    runner: { destroy() {} },
    browserRuntime: { async close() {} },
    bindings: Object.freeze({ executionReceipt: "ExecutionResultV1" }),
  });
  await assert.rejects(
    () => handle.executeOnce(Object.freeze({ fabricated: true })),
    /D2E4J_FABRICATED_ARTIFACT_REJECTED/u,
  );
  await handle.destroy();
});

test("Production and Staging fail closed before adapter construction", async (t) => {
  for (const environment of ["PRODUCTION", "STAGING"]) {
    await t.test(environment, async () => {
      const { input, commandExecutor } = setup({ environment });
      await assert.rejects(
        () => createOperationalD2E4JPreviewCeremonyCompositionV1(input),
        /D2E4J_PREVIEW_ONLY/u,
      );
      assert.equal(commandExecutor.calls.length, 0);
    });
  }
});

test("traceId is required and reaches D2E4E authority resolution", async () => {
  const traceId = "AI_UX_02D2E4J_TRACE_0001";
  let observedTraceId = null;
  const { input } = setup({
    traceId,
    authorityFactory(value) {
      observedTraceId = value.traceId;
      return authority;
    },
  });
  await assert.rejects(
    () => createOperationalD2E4JPreviewCeremonyCompositionV1(input),
    /D2E4J_D2E4G_NOT_READY/u,
  );
  assert.equal(observedTraceId, traceId);
});

test("operational root contains no test doubles or manual READY artifact", async () => {
  const source = await readFile(
    new URL("../ai-ux-02d2e4j-preview-ceremony-composition.mjs", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /\bmock\w*\b/iu);
  assert.doesNotMatch(source, /\b(?:function|const)\s+readyArtifact\b/iu);
  assert.doesNotMatch(source, /D2E4G_SHARED_ARTIFACT_VERSION/u);
  assert.match(source, /await compositionPreflight\.preflight/u);
  assert.match(source, /createOperationalD2E4HExecutionCeremonyV1/u);
});

test("D2E4J operational handle returns the exact execution receipt unchanged", async () => {
  const artifact = createExactCompositionArtifactV1();
  const compositionResult = Object.freeze({ COMPOSITION_STATUS: "READY", artifact });
  const receipt = createExactExecutionResultV1("FAILED_PARTIAL", artifact);
  const execution = {
    async execute(receivedComposition) {
      assert.equal(receivedComposition, compositionResult);
      return receipt;
    },
  };
  const handle = new D2E4JOperationalCeremonyHandleV1({
    compositionResult,
    execution,
    runner: { destroy() {} },
    browserRuntime: { async close() {} },
    bindings: Object.freeze({ executionReceipt: "ExecutionResultV1" }),
  });
  assert.equal(await handle.executeOnce(), receipt);
  await handle.destroy();
});
