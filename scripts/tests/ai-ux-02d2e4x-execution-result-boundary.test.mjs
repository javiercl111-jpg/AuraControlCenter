import assert from "node:assert/strict";
import test from "node:test";

import {
  certifyLauncherExecutionResultV1,
} from "../ai-ux-02d2e4x-final-live-ceremony-launcher.mjs";
import {
  createExactExecutionResultV1,
  TEST_TIME,
} from "./ai-ux-02d2e4x-execution-receipt-contract-v1.test.mjs";

test("Launcher preserves and distinctly presents all four certified terminal statuses", () => {
  for (const status of ["SUCCESS", "BLOCKED", "FAILED", "FAILED_PARTIAL"]) {
    const result = createExactExecutionResultV1(status);
    const certified = certifyLauncherExecutionResultV1(result);
    assert.equal(certified.result, result);
    assert.equal(certified.presentation.executionStatus, status);
    assert.equal(certified.presentation.status,
      `D2E4X_LIVE_PREVIEW_CEREMONY_${status}`);
    assert.equal(certified.presentation.receiptId, result.receiptId);
    assert.equal(certified.presentation.traceId, result.traceId);
    assert.equal(certified.presentation.artifactDigest, result.artifactDigest);
    assert.equal(certified.presentation.terminalLifecycleState,
      result.lifecycle.currentState);
    assert.equal(certified.presentation.sideEffects, result.sideEffects);
    assert.equal(certified.presentation.recovery, result.recovery);
    assert.equal(Object.isFrozen(certified), true);
    assert.equal(Object.isFrozen(certified.presentation), true);
  }
});

test("Launcher retains bounded error identity without reducing non-success results", () => {
  const result = createExactExecutionResultV1("FAILED_PARTIAL");
  const { presentation } = certifyLauncherExecutionResultV1(result);
  assert.deepEqual(presentation.errors, result.errors.map((error) => ({
    errorId: error.errorId,
    code: error.code,
    stage: error.stage,
    producer: error.producer,
    severity: error.severity,
    message: error.message,
    retryable: error.retryable,
    partialSideEffects: error.partialSideEffects,
  })));
  assert.equal(presentation.recovery.safeToRetry, false);
});

test("Launcher rejects malformed or legacy output as RuntimeErrorV1", () => {
  let id = 0;
  assert.throws(
    () => certifyLauncherExecutionResultV1(
      Object.freeze({ CEREMONY_RESULT: "SUCCESS" }),
      {
        clock: () => TEST_TIME + 4_000,
        idFactory: () => `launcher-certified-${++id}`,
      },
    ),
    (error) => error.contractName === "RuntimeErrorV1" &&
      error.contractVersion === "V1" &&
      error.code === "D2E4X_LAUNCHER_EXECUTION_RESULT_REJECTED" &&
      error.stage === "TERMINAL_VALIDATION" &&
      error.details.sourceCode === "EXECUTION_RESULT_SHAPE_REJECTED",
  );
});
