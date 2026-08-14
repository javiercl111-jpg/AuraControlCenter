import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { D2E4D_STATES } from "../ai-ux-02d2e4-final-preview-ceremony.mjs";
import {
  createD2E4GExecutionCeremonyV1,
} from "../ai-ux-02d2e4g-execution-entrypoint-separation.mjs";
import {
  OperationalExistingPreviewCeremonyExecutorV1,
} from "../ai-ux-02d2e4h-execution-only-ceremony-entrypoint.mjs";
import {
  createBrowserProofResultV1,
  createExactCompositionArtifactV1,
  createTurnReceiptV1,
  TEST_TIME,
} from "./ai-ux-02d2e4x-execution-receipt-contract-v1.test.mjs";

const REQUIRED_FIELDS = Object.freeze([
  "contractName", "contractVersion", "receiptId", "operationId", "changeId",
  "traceId", "artifactId", "artifactDigest", "environment",
  "authoritativeBinding", "policyCertification", "deploymentCertification",
  "status", "lifecycle", "errors", "sideEffects", "recovery",
  "browserProof", "turnReceipt", "startedAtMs", "completedAtMs",
].sort());

function setupRealBoundary({ failTurn = false } = {}) {
  const artifact = createExactCompositionArtifactV1();
  let time = TEST_TIME + 3_000;
  let id = 0;
  const runner = {
    state: D2E4D_STATES.CREATED,
    async reuseExistingPreview() { this.state = D2E4D_STATES.PREVIEW_READY_REUSED; },
    async prepareCanary() {
      this.state = D2E4D_STATES.CANARY_READY;
      return { status: "ACTIVE", policyVersion: artifact.policy.policyVersion };
    },
    async issueCapability() {
      this.state = D2E4D_STATES.CAPABILITY_READY;
      return {
        status: "ACTIVE",
        disposition: "ROTATED",
        actualWriteCount: 1,
        capabilityLocator: "capability-receipt-certified-0001",
      };
    },
    async bootstrapBrowser() {
      this.state = D2E4D_STATES.BROWSER_READY;
      return createBrowserProofResultV1(artifact);
    },
    async executeTurn() {
      if (failTurn) {
        throw Object.assign(new Error("turn rejected after attempt"), {
          code: "D2E4H_EVALUATE_CONVERSATION_RESULT_REJECTED",
        });
      }
      this.state = D2E4D_STATES.TURN_EXECUTED;
      return createTurnReceiptV1();
    },
    destroy() { this.state = D2E4D_STATES.DESTROYED; },
  };
  const producer = new OperationalExistingPreviewCeremonyExecutorV1({
    previewConfigurationAdapter: { async configureDigestOnly() {} },
    adaptiveCanaryControlPlaneAdapter: { async prepare() {} },
    capabilityIssuerAdapter: { async issueOnce() {} },
    browserRuntime: {
      async open() {},
      createBootstrapAdapter() { return {}; },
      async close() {},
    },
    ceremonyConfiguration: Object.freeze({
      actor: "preview-canary-control-plane",
      approver: "human-approver-certified-0001",
      changeId: "change-certified-0001",
      operationId: "operation-certified-0001",
      policyVersion: artifact.policy.policyVersion,
      reasonCode: "execution-receipt-contract-boundary",
      traceId: "trace-certified-0001",
    }),
    runnerFactory: () => runner,
    clock: () => ++time,
    idFactory: () => `boundary-certified-${++id}`,
  });
  const trace = { producerReceipt: null };
  const consumer = createD2E4GExecutionCeremonyV1({
    ceremonyExecutor: {
      async executeOnce(receivedArtifact) {
        trace.producerReceipt = await producer.executeOnce(receivedArtifact);
        return trace.producerReceipt;
      },
    },
    clock: () => ++time,
    idFactory: () => `gate-boundary-certified-${++id}`,
  });
  return { artifact, consumer, trace };
}

test("real D2E4H producer and D2E4G consumer are compatible under ExecutionResultV1", async () => {
  const { artifact, consumer, trace } = setupRealBoundary();
  const result = await consumer.execute(Object.freeze({
    COMPOSITION_STATUS: "READY",
    artifact,
  }));
  assert.equal(result, trace.producerReceipt);
  assert.deepEqual(Object.keys(result).sort(), REQUIRED_FIELDS);
  assert.equal(result.contractName, "ExecutionResultV1");
  assert.equal(result.contractVersion, "V1");
  assert.equal(result.status, "SUCCESS");
  assert.equal(result.lifecycle.currentState, "TERMINATED_SUCCESS");
  assert.equal(result.sideEffects.length, 2);
  assert.equal(result.recovery.required, false);
  assert.equal(result.browserProof.status, "VERIFIED");
  assert.equal(result.turnReceipt.status, "CONSUMED");
  assert.equal(Object.isFrozen(result), true);
});

test("D2E4H RuntimeErrorV1, lifecycle, effects, and recovery survive D2E4G", async () => {
  const { artifact, consumer, trace } = setupRealBoundary({ failTurn: true });
  const result = await consumer.execute(Object.freeze({
    COMPOSITION_STATUS: "READY",
    artifact,
  }));
  assert.equal(result, trace.producerReceipt);
  assert.equal(result.status, "FAILED_PARTIAL");
  assert.equal(result.lifecycle.currentState, "TERMINATED_FAILED_PARTIAL");
  assert.equal(result.errors[0].contractName, "RuntimeErrorV1");
  assert.equal(result.errors[0].code,
    "D2E4H_EVALUATE_CONVERSATION_RESULT_REJECTED");
  assert.equal(result.errors[0].partialSideEffects, true);
  assert.deepEqual(result.sideEffects.map(({ outcome }) => outcome), [
    "APPLIED", "UNKNOWN",
  ]);
  assert.equal(result.recovery.required, true);
  assert.equal(result.recovery.safeToRetry, false);
});

test("D2E4G rejects the certified legacy producer and CEREMONY_RESULT shapes", async (t) => {
  const artifact = createExactCompositionArtifactV1();
  for (const [name, legacy] of [
    ["D2E4H legacy receipt", Object.freeze({
      version: "AI_UX_02D2E4H_EXECUTION_ONLY_EXISTING_PREVIEW_CEREMONY_V1",
      status: "SUCCESS",
      previewDeploymentId: artifact.deployment.deploymentId,
      deploymentInvocations: 0,
      compositionValidationCalls: 0,
      productionChanged: false,
      stagingChanged: false,
      turnReceipt: null,
      stateMachine: Object.freeze(["CREATED", "DESTROYED"]),
    })],
    ["D2E4G reduction", Object.freeze({ CEREMONY_RESULT: "SUCCESS" })],
  ]) {
    await t.test(name, async () => {
      const gate = createD2E4GExecutionCeremonyV1({
        ceremonyExecutor: { async executeOnce() { return legacy; } },
        clock: () => TEST_TIME + 3_000,
        idFactory: () => "legacy-rejection-certified-0001",
      });
      await assert.rejects(
        () => gate.execute(Object.freeze({ COMPOSITION_STATUS: "READY", artifact })),
        (error) => error.contractName === "RuntimeErrorV1" &&
          error.code === "D2E4G_EXECUTION_RESULT_REJECTED" &&
          error.stage === "TERMINAL_VALIDATION",
      );
    });
  }
});

test("D2E4J remains transparent and Launcher now certifies the rich V1 boundary", () => {
  const compositionSource = readFileSync(
    new URL("../ai-ux-02d2e4j-preview-ceremony-composition.mjs", import.meta.url),
    "utf8",
  );
  const gateSource = readFileSync(
    new URL("../ai-ux-02d2e4g-execution-entrypoint-separation.mjs", import.meta.url),
    "utf8",
  );
  const launcherSource = readFileSync(
    new URL("../ai-ux-02d2e4x-final-live-ceremony-launcher.mjs", import.meta.url),
    "utf8",
  );
  assert.match(compositionSource,
    /return this\.#execution\.execute\(this\.#compositionResult\);/u);
  assert.doesNotMatch(gateSource, /CEREMONY_RESULT:\s*"(?:SUCCESS|BLOCKED)"/u);
  assert.match(launcherSource, /certifyLauncherExecutionResultV1\(result\)/u);
  assert.doesNotMatch(launcherSource, /result\?\.status !== "SUCCESS"/u);
  assert.doesNotMatch(launcherSource, /previewDeploymentId:\s*result/u);
  assert.doesNotMatch(launcherSource, /stateMachine:\s*result/u);
});
