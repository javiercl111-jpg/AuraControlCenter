import assert from "node:assert/strict";
import test from "node:test";

import { D2E4D_STATES } from "../ai-ux-02d2e4-final-preview-ceremony.mjs";
import {
  OperationalExistingPreviewCeremonyExecutorV1,
  createOperationalD2E4HExecutionCeremonyV1,
} from "../ai-ux-02d2e4h-execution-only-ceremony-entrypoint.mjs";
import {
  createBrowserProofResultV1,
  createExactCompositionArtifactV1,
  createTurnReceiptV1,
  TEST_TIME,
} from "./ai-ux-02d2e4x-execution-receipt-contract-v1.test.mjs";

function setup({ capabilityFailure, proofMalformed = false, turnFailure, cleanupFailure } = {}) {
  const artifact = createExactCompositionArtifactV1();
  const calls = {
    previewReuse: 0,
    policyVerification: 0,
    capabilityRotation: 0,
    browserOpen: 0,
    browserProof: 0,
    browserTurn: 0,
    runnerDestroy: 0,
    browserClose: 0,
  };
  let time = TEST_TIME + 2_000;
  let id = 0;
  const runner = {
    state: D2E4D_STATES.CREATED,
    async reuseExistingPreview(deployment) {
      calls.previewReuse += 1;
      assert.equal(deployment.deploymentId, artifact.deployment.deploymentId);
      assert.equal(deployment.readyState, "READY");
      assert.equal(deployment, artifact.deployment);
      this.state = D2E4D_STATES.PREVIEW_READY_REUSED;
    },
    async prepareCanary(_adapter, change) {
      calls.policyVerification += 1;
      assert.equal(change.policy.policyVersion, artifact.policy.policyVersion);
      this.state = D2E4D_STATES.CANARY_READY;
      return { status: "ACTIVE", policyVersion: artifact.policy.policyVersion };
    },
    async issueCapability() {
      calls.capabilityRotation += 1;
      if (capabilityFailure) throw capabilityFailure;
      this.state = D2E4D_STATES.CAPABILITY_READY;
      return {
        status: "ACTIVE",
        disposition: "ROTATED",
        actualWriteCount: 1,
        capabilityLocator: "capability-receipt-certified-0001",
      };
    },
    async bootstrapBrowser() {
      calls.browserProof += 1;
      this.state = D2E4D_STATES.BROWSER_READY;
      return proofMalformed
        ? Object.freeze({ status: "REJECTED" })
        : createBrowserProofResultV1(artifact);
    },
    async executeTurn() {
      calls.browserTurn += 1;
      if (turnFailure) throw turnFailure;
      this.state = D2E4D_STATES.TURN_EXECUTED;
      return createTurnReceiptV1();
    },
    async destroy() {
      calls.runnerDestroy += 1;
      this.state = D2E4D_STATES.DESTROYED;
      if (cleanupFailure) throw cleanupFailure;
    },
  };
  const dependencies = {
    adaptiveCanaryControlPlaneAdapter: { async prepare() {} },
    capabilityIssuerAdapter: { async issueOnce() {} },
    browserRuntime: {
      async open(url) {
        calls.browserOpen += 1;
        assert.equal(url, artifact.deployment.previewUrl);
      },
      createBootstrapAdapter() { return Object.freeze({}); },
      async close() { calls.browserClose += 1; },
    },
    ceremonyConfiguration: Object.freeze({
      actor: "preview-canary-control-plane",
      approver: "human-approver-certified-0001",
      changeId: "change-certified-0001",
      operationId: "operation-certified-0001",
      policyVersion: artifact.policy.policyVersion,
      reasonCode: "execution-receipt-certified-implementation",
      traceId: "trace-certified-0001",
    }),
    runnerFactory() { return runner; },
    clock() { time += 1; return time; },
    idFactory() { id += 1; return `certified-${String(id).padStart(4, "0")}`; },
  };
  return { artifact, calls, dependencies };
}

test("D2E4H emits an exact immutable success receipt with lifecycle and effect evidence", async () => {
  const { artifact, calls, dependencies } = setup();
  const executor = new OperationalExistingPreviewCeremonyExecutorV1(dependencies);
  const receipt = await executor.executeOnce(artifact);

  assert.equal(receipt.contractName, "ExecutionResultV1");
  assert.equal(receipt.contractVersion, "V1");
  assert.equal(receipt.status, "SUCCESS");
  assert.equal(receipt.artifactId, artifact.artifactId);
  assert.equal(receipt.artifactDigest, artifact.artifactDigest);
  assert.equal(receipt.errors.length, 0);
  assert.deepEqual(receipt.sideEffects.map(({ type, outcome }) => ({ type, outcome })), [
    { type: "CAPABILITY_ROTATION", outcome: "APPLIED" },
    { type: "BROWSER_TURN", outcome: "APPLIED" },
  ]);
  assert.equal(receipt.recovery.required, false);
  assert.equal(receipt.browserProof.status, "VERIFIED");
  assert.equal(receipt.turnReceipt.status, "CONSUMED");
  assert.equal(receipt.lifecycle.currentState, "TERMINATED_SUCCESS");
  assert.deepEqual(receipt.lifecycle.transitions.map(({ state }) => state), [
    "CREATED",
    "ARTIFACT_VALIDATED",
    "PREVIEW_READY_REUSED",
    "ACTIVE_POLICY_VERIFIED",
    "CAPABILITY_ROTATED",
    "BROWSER_READY",
    "BROWSER_PROOF_VERIFIED",
    "TURN_EXECUTED",
    "CLEANUP_STARTED",
    "CLEANUP_COMPLETED",
    "TERMINATED_SUCCESS",
  ]);
  assert.equal(Object.isFrozen(receipt), true);
  assert.equal(Object.isFrozen(receipt.errors), true);
  assert.deepEqual(calls, {
    previewReuse: 1,
    policyVerification: 1,
    capabilityRotation: 1,
    browserOpen: 1,
    browserProof: 1,
    browserTurn: 1,
    runnerDestroy: 1,
    browserClose: 1,
  });
});

test("D2E4G-bound operational factory preserves the complete D2E4H object", async () => {
  const { artifact, dependencies } = setup();
  const execution = createOperationalD2E4HExecutionCeremonyV1(dependencies);
  const result = await execution.execute(Object.freeze({
    COMPOSITION_STATUS: "READY",
    artifact,
  }));
  assert.equal(result.contractName, "ExecutionResultV1");
  assert.equal(result.status, "SUCCESS");
  assert.equal(result.sideEffects.length, 2);
  assert.equal(result.lifecycle.currentState, "TERMINATED_SUCCESS");
});

test("a second D2E4H attempt returns an exact BLOCKED receipt without new effects", async () => {
  const { artifact, calls, dependencies } = setup();
  const executor = new OperationalExistingPreviewCeremonyExecutorV1(dependencies);
  await executor.executeOnce(artifact);
  const blocked = await executor.executeOnce(artifact);
  assert.equal(blocked.status, "BLOCKED");
  assert.equal(blocked.lifecycle.currentState, "TERMINATED_BLOCKED");
  assert.deepEqual(blocked.sideEffects, []);
  assert.equal(blocked.errors[0].code, "D2E4H_SECOND_EXECUTION_REJECTED");
  assert.equal(calls.capabilityRotation, 1);
  assert.equal(calls.browserTurn, 1);
});

test("an uncertain browser turn failure is FAILED_PARTIAL with preserved causality", async () => {
  const failure = Object.assign(new Error("turn result rejected"), {
    code: "D2E4H_EVALUATE_CONVERSATION_RESULT_REJECTED",
  });
  const { artifact, dependencies } = setup({ turnFailure: failure });
  const receipt = await new OperationalExistingPreviewCeremonyExecutorV1(dependencies)
    .executeOnce(artifact);
  assert.equal(receipt.status, "FAILED_PARTIAL");
  assert.equal(receipt.errors[0].code,
    "D2E4H_EVALUATE_CONVERSATION_RESULT_REJECTED");
  assert.equal(receipt.errors[0].partialSideEffects, true);
  assert.deepEqual(receipt.sideEffects.map(({ outcome }) => outcome), [
    "APPLIED", "UNKNOWN",
  ]);
  assert.equal(receipt.recovery.required, true);
  assert.equal(receipt.recovery.safeToRetry, false);
});

test("a proven rejected capability rotation is FAILED rather than FAILED_PARTIAL", async () => {
  const failure = Object.assign(new Error("rotation rejected before commit"), {
    code: "D2E4H_CAPABILITY_ROTATION_REJECTED",
    sideEffectOutcome: "REJECTED",
  });
  const { artifact, dependencies } = setup({ capabilityFailure: failure });
  const receipt = await new OperationalExistingPreviewCeremonyExecutorV1(dependencies)
    .executeOnce(artifact);
  assert.equal(receipt.status, "FAILED");
  assert.equal(receipt.sideEffects[0].outcome, "REJECTED");
  assert.equal(receipt.errors[0].code, "D2E4H_CAPABILITY_ROTATION_REJECTED");
  assert.equal(receipt.recovery.required, false);
});

test("malformed attempted browser proof fails partial without emitting malformed evidence", async () => {
  const { artifact, dependencies } = setup({ proofMalformed: true });
  const receipt = await new OperationalExistingPreviewCeremonyExecutorV1(dependencies)
    .executeOnce(artifact);
  assert.equal(receipt.status, "FAILED_PARTIAL");
  assert.equal(receipt.errors[0].code, "EXECUTION_RESULT_BROWSER_PROOF_REJECTED");
  assert.equal(receipt.browserProof, null);
  assert.deepEqual(receipt.sideEffects.map(({ outcome }) => outcome), ["APPLIED"]);
});

test("cleanup failure is additive and produces FAILED_PARTIAL after applied effects", async () => {
  const cleanupFailure = Object.assign(new Error("runner cleanup failed"), {
    code: "D2E4H_RUNNER_CLEANUP_FAILED",
  });
  const { artifact, calls, dependencies } = setup({ cleanupFailure });
  const receipt = await new OperationalExistingPreviewCeremonyExecutorV1(dependencies)
    .executeOnce(artifact);
  assert.equal(receipt.status, "FAILED_PARTIAL");
  assert.equal(receipt.errors.at(-1).stage, "CLEANUP");
  assert.equal(receipt.errors.at(-1).code, "D2E4H_RUNNER_CLEANUP_FAILED");
  assert.equal(calls.browserClose, 1);
});

test("legacy composition artifacts and client-selected configuration fields fail closed", () => {
  const { dependencies } = setup();
  assert.throws(() => new OperationalExistingPreviewCeremonyExecutorV1({
    ...dependencies,
    ceremonyConfiguration: {
      ...dependencies.ceremonyConfiguration,
      sessionId: "client-selected-session",
    },
  }), /D2E4H_CEREMONY_CONFIGURATION_REJECTED/u);
});
