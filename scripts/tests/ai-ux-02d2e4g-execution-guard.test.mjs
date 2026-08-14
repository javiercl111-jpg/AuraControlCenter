import assert from "node:assert/strict";
import test from "node:test";

import {
  createD2E4GExecutionCeremonyV1,
} from "../ai-ux-02d2e4g-execution-entrypoint-separation.mjs";
import {
  createRuntimeErrorV1,
} from "../ai-ux-02d2e4x-execution-receipt-contract-v1.mjs";
import {
  createExactCompositionArtifactV1,
  createExactExecutionResultV1,
  TEST_TIME,
} from "./ai-ux-02d2e4x-execution-receipt-contract-v1.test.mjs";

function gateFor(executeOnce) {
  let id = 0;
  return createD2E4GExecutionCeremonyV1({
    ceremonyExecutor: { executeOnce },
    clock: () => TEST_TIME + 2_000,
    idFactory() { id += 1; return `gate-certified-${id}`; },
  });
}

function readyComposition(artifact = createExactCompositionArtifactV1()) {
  return Object.freeze({ COMPOSITION_STATUS: "READY", artifact });
}

test("D2E4G returns the same complete immutable receipt for every terminal status", async () => {
  for (const status of ["SUCCESS", "BLOCKED", "FAILED", "FAILED_PARTIAL"]) {
    const artifact = createExactCompositionArtifactV1();
    const receipt = createExactExecutionResultV1(status, artifact);
    const gate = gateFor(async (receivedArtifact) => {
      assert.equal(receivedArtifact, artifact);
      return receipt;
    });
    const result = await gate.execute(readyComposition(artifact));
    assert.equal(result, receipt);
    assert.equal(result.status, status);
    assert.equal(result.errors, receipt.errors);
    assert.equal(result.sideEffects, receipt.sideEffects);
    assert.equal(result.recovery, receipt.recovery);
  }
});

test("D2E4G admits one artifact once and preserves the one-shot failure contract", async () => {
  const artifact = createExactCompositionArtifactV1();
  const receipt = createExactExecutionResultV1("SUCCESS", artifact);
  let calls = 0;
  const gate = gateFor(async () => { calls += 1; return receipt; });
  assert.equal(await gate.execute(readyComposition(artifact)), receipt);
  await assert.rejects(
    () => gate.execute(readyComposition(artifact)),
    (error) => error.contractName === "RuntimeErrorV1" &&
      error.code === "D2E4G_SECOND_EXECUTION_REJECTED" &&
      error.stage === "COMPOSITION",
  );
  assert.equal(calls, 1);
});

test("CONDITIONAL, BLOCKED, and legacy composition artifacts fail before execution", async () => {
  let calls = 0;
  for (const composition of [
    { COMPOSITION_STATUS: "CONDITIONAL" },
    { COMPOSITION_STATUS: "BLOCKED" },
    {
      COMPOSITION_STATUS: "READY",
      artifact: Object.freeze({
        version: "AI_UX_02D2E4G_READ_ONLY_COMPOSITION_ARTIFACT_V1",
      }),
    },
  ]) {
    const gate = gateFor(async () => { calls += 1; });
    await assert.rejects(
      () => gate.execute(composition),
      (error) => error.contractName === "RuntimeErrorV1" &&
        error.stage === "COMPOSITION" && error.severity === "BLOCKING",
    );
  }
  assert.equal(calls, 0);
});

test("mutable, reduced, and artifact-mismatched terminal values fail validation", async (t) => {
  const artifact = createExactCompositionArtifactV1();
  for (const [name, value] of [
    ["reduced", Object.freeze({ CEREMONY_RESULT: "SUCCESS" })],
    ["mutable", { ...createExactExecutionResultV1("SUCCESS", artifact) }],
    ["mismatched", Object.freeze({
      ...createExactExecutionResultV1("SUCCESS", artifact),
      artifactDigest: "99".repeat(32),
    })],
  ]) {
    await t.test(name, async () => {
      const gate = gateFor(async () => value);
      await assert.rejects(
        () => gate.execute(readyComposition(artifact)),
        (error) => error.contractName === "RuntimeErrorV1" &&
          error.code === "D2E4G_EXECUTION_RESULT_REJECTED" &&
          error.stage === "TERMINAL_VALIDATION" &&
          typeof error.details.sourceCode === "string",
      );
    });
  }
});

test("an exact RuntimeErrorV1 thrown by D2E4H is preserved without replacement", async () => {
  const artifact = createExactCompositionArtifactV1();
  const root = createRuntimeErrorV1({
    errorId: "d2e4h-terminal-error-certified-0001",
    code: "D2E4H_TERMINAL_CONSTRUCTION_REJECTED",
    stage: "TERMINAL_VALIDATION",
    producer: "D2E4H_EXECUTION",
    severity: "FAILURE",
    message: "D2E4H could not construct its terminal receipt",
    cause: null,
    retryable: false,
    partialSideEffects: false,
    details: {},
    traceId: "trace-certified-0001",
    occurredAtMs: TEST_TIME + 2_000,
  });
  const gate = gateFor(async () => { throw root; });
  await assert.rejects(
    () => gate.execute(readyComposition(artifact)),
    (error) => error === root,
  );
});

test("a native producer construction failure is retained in terminal-validation details", async () => {
  const artifact = createExactCompositionArtifactV1();
  const native = Object.assign(new Error("native construction failed"), {
    code: "D2E4H_NATIVE_CONSTRUCTION_FAILED",
  });
  const gate = gateFor(async () => { throw native; });
  await assert.rejects(
    () => gate.execute(readyComposition(artifact)),
    (error) => error.contractName === "RuntimeErrorV1" &&
      error.code === "D2E4G_TERMINAL_CONSTRUCTION_FAILED" &&
      error.details.sourceCode === "D2E4H_NATIVE_CONSTRUCTION_FAILED",
  );
});
