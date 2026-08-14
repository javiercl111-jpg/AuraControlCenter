import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  assertExecutionCompositionArtifactV1,
  assertExecutionResultV1,
  calculateCompositionArtifactDigestV1,
  createExecutionResultV1,
  createRuntimeErrorV1,
  deepFreezeExecutionContractV1,
} from "../ai-ux-02d2e4x-execution-receipt-contract-v1.mjs";
import {
  D2E4G_PREVIEW_DEPLOYMENT_ID,
  D2E4G_PREVIEW_URL,
} from "../ai-ux-02d2e4g-execution-entrypoint-separation.mjs";

export const TEST_TIME = Date.parse("2030-01-01T00:00:00.000Z");
export const TEST_DIGESTS = Object.freeze({
  authority: "11".repeat(32),
  policy: "22".repeat(32),
  token: "33".repeat(32),
  expectation: "44".repeat(32),
  deployment: "55".repeat(32),
  controlProof: "66".repeat(32),
  observedProof: "66".repeat(32),
  adapter: "77".repeat(32),
});

export function createExactCompositionArtifactV1() {
  const certifiedAtMs = TEST_TIME;
  const expiresAtMs = TEST_TIME + 60_000;
  const artifact = {
    contractName: "CompositionArtifactV1",
    contractVersion: "V1",
    artifactId: "composition-artifact-certified-0001",
    artifactDigest: "00".repeat(32),
    status: "READY",
    environment: "PREVIEW",
    projectId: "aura-control-center",
    authority: {
      contractName: "AuthorityReceiptV1",
      contractVersion: "V1",
      receiptId: "authority-receipt-certified-0001",
      status: "CERTIFIED",
      environment: "PREVIEW",
      projectId: "aura-control-center",
      authoritativeTenantId: "tenant-authoritative-certified-0001",
      authoritativeTenantLocator: "tenant-authoritative-certified-0001",
      syntheticFixtureLocator: "synthetic-fixture-certified-0001",
      linkId: "link-certified-0001",
      sessionId: "session-certified-0001",
      turnId: "turn-certified-0001",
      intentClass: "DISCOVER_PROBLEM",
      evidenceDigest: TEST_DIGESTS.authority,
      certifiedAtMs,
      expiresAtMs,
    },
    policy: {
      contractName: "PolicyReadinessReceiptV1",
      contractVersion: "V1",
      receiptId: "policy-receipt-certified-0001",
      status: "ACTIVE",
      environment: "PREVIEW",
      projectId: "aura-control-center",
      authoritativeTenantId: "tenant-authoritative-certified-0001",
      authoritativeTenantLocator: "tenant-authoritative-certified-0001",
      policyVersion: "policy-certified-version-0001",
      activePointerVersion: "active-pointer-certified-0001",
      policyArtifactDigest: TEST_DIGESTS.policy,
      activationAuditId: "activation-audit-certified-0001",
      mode: "CANARY",
      enabled: true,
      killSwitchState: {
        state: "OFF",
        revision: "kill-switch-revision-0001",
      },
      allowedSyntheticFixtureLocators: ["synthetic-fixture-certified-0001"],
      allowedIntentClasses: ["CLARIFICATION", "DISCOVER_PROBLEM"],
      activatedAtMs: certifiedAtMs - 1_000,
      expiresAtMs,
      certifiedAtMs,
    },
    rotationExpectation: {
      contractName: "RotationExpectationV1",
      contractVersion: "V1",
      expectationId: "rotation-expectation-certified-0001",
      status: "ROTATION_READY",
      environment: "PREVIEW",
      projectId: "aura-control-center",
      authoritativeTenantId: "tenant-authoritative-certified-0001",
      syntheticFixtureLocator: "synthetic-fixture-certified-0001",
      linkId: "link-certified-0001",
      sessionId: "session-certified-0001",
      policyVersion: "policy-certified-version-0001",
      capabilityLocator: "capability-locator-certified-0001",
      expectedGeneration: 4,
      expectedTokenHash: TEST_DIGESTS.token,
      expectedUpdatedAtMs: certifiedAtMs - 2_000,
      expectedExpiresAtMs: certifiedAtMs - 1,
      expectedConsumedAtMs: null,
      nextGeneration: 5,
      expectationDigest: TEST_DIGESTS.expectation,
      certifiedAtMs,
      expiresAtMs,
    },
    deployment: {
      contractName: "DeploymentReadinessReceiptV1",
      contractVersion: "V1",
      receiptId: "deployment-receipt-certified-0001",
      status: "READY",
      environment: "PREVIEW",
      projectId: "aura-control-center",
      deploymentId: D2E4G_PREVIEW_DEPLOYMENT_ID,
      deploymentRevision: "deployment-revision-certified-0001",
      deploymentArtifactDigest: TEST_DIGESTS.deployment,
      controlProofDigest: TEST_DIGESTS.controlProof,
      previewUrl: D2E4G_PREVIEW_URL,
      deploymentType: "Preview",
      readyState: "READY",
      reusedExistingPreview: true,
      deploymentInvocations: 0,
      productionChanged: false,
      stagingChanged: false,
      readBackSource: "VERCEL_INSPECT",
      certifiedAtMs,
      expiresAtMs,
    },
    replayReadiness: {
      readinessBasis: "CERTIFIED_SINGLE_TURN_BINDING",
      replayPersistenceClaimed: false,
      externalReplayArtifactAccepted: false,
      environment: "PREVIEW",
      authoritativeTenantId: "tenant-authoritative-certified-0001",
      syntheticFixtureLocator: "synthetic-fixture-certified-0001",
      linkId: "link-certified-0001",
      sessionId: "session-certified-0001",
      turnId: "turn-certified-0001",
      certifiedAtMs,
    },
    adapterAttestations: [{
      attestationContractVersion: "V1",
      adapterId: "adapter-certified-0001",
      implementationId: "implementation-certified-0001",
      implementationVersion: "implementation-version-certified-0001",
      capabilities: ["BROWSER_TURN", "CAPABILITY_ROTATION"],
      environment: "PREVIEW",
      projectId: "aura-control-center",
      artifactDigest: TEST_DIGESTS.adapter,
      attestedAtMs: certifiedAtMs,
    }],
    allowedMutations: ["CAPABILITY_ROTATION", "BROWSER_TURN"],
    createdAtMs: certifiedAtMs,
    expiresAtMs,
  };
  artifact.artifactDigest = calculateCompositionArtifactDigestV1(artifact);
  return deepFreezeExecutionContractV1(artifact);
}

export function createBrowserProofResultV1(artifact = createExactCompositionArtifactV1()) {
  return deepFreezeExecutionContractV1({
    status: "VERIFIED",
    deploymentId: artifact.deployment.deploymentId,
    deploymentArtifactDigest: artifact.deployment.deploymentArtifactDigest,
    expectedControlProofDigest: artifact.deployment.controlProofDigest,
    observedControlProofDigest: TEST_DIGESTS.observedProof,
    verifiedAtMs: TEST_TIME + 1_010,
  });
}

export function createTurnReceiptV1() {
  return deepFreezeExecutionContractV1({
    status: "CONSUMED",
    functionalRequests: 1,
    canaryEligible: true,
    replayResult: "CREATED",
    activationDecision: "USE_INTELLIGENCE",
    baselineQuestionLocator: "baseline-question-locator-0001",
    intelligenceProposedQuestionLocator: "intelligence-question-locator-0001",
    authoritativeQuestionLocator: "intelligence-question-locator-0001",
    visibleQuestionSource: "INTELLIGENCE",
    visibleQuestionCount: 1,
    completedAtMs: TEST_TIME + 1_020,
  });
}

export function createExactExecutionResultV1(
  status = "SUCCESS",
  artifact = createExactCompositionArtifactV1(),
) {
  const nonSuccess = status !== "SUCCESS";
  const partial = status === "FAILED_PARTIAL";
  const terminalState = `TERMINATED_${status}`;
  const errors = nonSuccess ? [createRuntimeErrorV1({
    errorId: `runtime-error-${status.toLowerCase()}-0001`,
    code: `D2E4H_${status}_CERTIFIED`,
    stage: partial ? "TURN" : (status === "BLOCKED" ? "COMPOSITION" : "ROTATION"),
    producer: "D2E4H_EXECUTION",
    severity: partial ? "PARTIAL_FAILURE" :
      (status === "BLOCKED" ? "BLOCKING" : "FAILURE"),
    message: `Certified ${status} terminal evidence`,
    cause: null,
    retryable: false,
    partialSideEffects: partial,
    details: {},
    traceId: "trace-certified-0001",
    occurredAtMs: TEST_TIME + 1_030,
  })] : [];
  const sideEffects = status === "BLOCKED" ? [] : [{
    type: "CAPABILITY_ROTATION",
    owner: "D2E4M_CAPABILITY_ROTATION",
    targetLocator: artifact.rotationExpectation.capabilityLocator,
    attemptedAtMs: TEST_TIME + 1_005,
    outcome: partial || status === "SUCCESS" ? "APPLIED" : "REJECTED",
    receiptLocator: partial || status === "SUCCESS"
      ? "capability-receipt-certified-0001"
      : null,
    reversible: false,
  }];
  if (status === "SUCCESS") {
    sideEffects.push({
      type: "BROWSER_TURN",
      owner: "D2E4H_BROWSER_TURN",
      targetLocator: artifact.authority.turnId,
      attemptedAtMs: TEST_TIME + 1_015,
      outcome: "APPLIED",
      receiptLocator: artifact.authority.turnId,
      reversible: false,
    });
  }

  return createExecutionResultV1({
    receiptId: `execution-receipt-${status.toLowerCase()}-0001`,
    operationId: "operation-certified-0001",
    changeId: "change-certified-0001",
    traceId: "trace-certified-0001",
    artifactId: artifact.artifactId,
    artifactDigest: artifact.artifactDigest,
    environment: "PREVIEW",
    authoritativeBinding: {
      authoritativeTenantId: artifact.authority.authoritativeTenantId,
      authoritativeTenantLocator: artifact.authority.authoritativeTenantLocator,
      syntheticFixtureLocator: artifact.authority.syntheticFixtureLocator,
      linkId: artifact.authority.linkId,
      sessionId: artifact.authority.sessionId,
      turnId: artifact.authority.turnId,
      intentClass: artifact.authority.intentClass,
    },
    policyCertification: {
      policyVersion: artifact.policy.policyVersion,
      activePointerVersion: artifact.policy.activePointerVersion,
      policyArtifactDigest: artifact.policy.policyArtifactDigest,
      activationAuditId: artifact.policy.activationAuditId,
    },
    deploymentCertification: {
      deploymentId: artifact.deployment.deploymentId,
      deploymentRevision: artifact.deployment.deploymentRevision,
      deploymentArtifactDigest: artifact.deployment.deploymentArtifactDigest,
      controlProofDigest: artifact.deployment.controlProofDigest,
      previewUrl: artifact.deployment.previewUrl,
    },
    status,
    lifecycle: {
      currentState: terminalState,
      transitions: [
        { sequence: 0, state: "CREATED", component: "D2E4H_EXECUTION",
          occurredAtMs: TEST_TIME + 1_000 },
        { sequence: 1, state: "ARTIFACT_VALIDATED", component: "D2E4H_EXECUTION",
          occurredAtMs: TEST_TIME + 1_001 },
        { sequence: 2, state: terminalState, component: "D2E4H_EXECUTION",
          occurredAtMs: TEST_TIME + 1_040 },
      ],
    },
    errors,
    sideEffects,
    recovery: partial ? {
      required: true,
      state: "PENDING",
      owner: "D2E4H_RECOVERY_OPERATOR",
      actions: ["Reconcile applied execution effects"],
      safeToRetry: false,
      retryPreconditions: ["Obtain fresh certified composition evidence"],
    } : {
      required: false,
      state: "NONE",
      owner: null,
      actions: [],
      safeToRetry: false,
      retryPreconditions: [],
    },
    browserProof: status === "SUCCESS" ? createBrowserProofResultV1(artifact) : null,
    turnReceipt: status === "SUCCESS" ? createTurnReceiptV1() : null,
    startedAtMs: TEST_TIME + 1_000,
    completedAtMs: TEST_TIME + 1_050,
  }, { artifact });
}

const isDirectTest = process.argv[1] &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isDirectTest) {
  test("exact CompositionArtifactV1 and all terminal ExecutionResultV1 statuses validate", () => {
    const artifact = createExactCompositionArtifactV1();
    assert.equal(assertExecutionCompositionArtifactV1(artifact), artifact);
    for (const status of ["SUCCESS", "BLOCKED", "FAILED", "FAILED_PARTIAL"]) {
      const result = createExactExecutionResultV1(status, artifact);
      assert.equal(assertExecutionResultV1(result, { artifact }), result);
      assert.equal(Object.isFrozen(result), true);
      assert.equal(Object.isFrozen(result.lifecycle.transitions), true);
    }
  });

  test("legacy reductions, aliases, mutable results, and unknown fields fail closed", () => {
    assert.throws(() => assertExecutionResultV1({ CEREMONY_RESULT: "SUCCESS" }),
      /EXECUTION_RESULT_SHAPE_REJECTED/u);
    const exact = createExactExecutionResultV1();
    assert.throws(() => assertExecutionResultV1({ ...exact }),
      /EXECUTION_RESULT_MUTABLE_REJECTED/u);
    assert.throws(() => assertExecutionResultV1(
      deepFreezeExecutionContractV1({ ...exact, stateMachine: [] }),
    ), /EXECUTION_RESULT_SHAPE_REJECTED/u);
  });

  test("FAILED_PARTIAL requires unresolved effects and mandatory recovery", () => {
    const exact = createExactExecutionResultV1("FAILED_PARTIAL");
    const invalid = deepFreezeExecutionContractV1({
      ...exact,
      sideEffects: exact.sideEffects.map((effect) => ({
        ...effect,
        outcome: "COMPENSATED",
      })),
    });
    assert.throws(() => assertExecutionResultV1(invalid),
      /EXECUTION_RESULT_PARTIAL_INVARIANT_REJECTED/u);
  });
}
