import { randomUUID } from "node:crypto";

import {
  D2E4D_STATES,
  D2E4D_TARGET,
  createOperationalSingleProcessCeremonyRunnerV1,
} from "./ai-ux-02d2e4-final-preview-ceremony.mjs";
import {
  D2E4G_PREVIEW_DEPLOYMENT_ID,
  D2E4G_PREVIEW_URL,
  createD2E4GExecutionCeremonyV1,
} from "./ai-ux-02d2e4g-execution-entrypoint-separation.mjs";
import {
  assertBrowserProofResultV1,
  assertExecutionCompositionArtifactV1,
  assertTurnReceiptV1,
  createExecutionResultV1,
  createRuntimeErrorV1,
  executionResultEvidenceFromArtifactV1,
  isRuntimeErrorV1,
} from "./ai-ux-02d2e4x-execution-receipt-contract-v1.mjs";

export const D2E4H_EXECUTION_VERSION =
  "AI_UX_02D2E4X_EXECUTION_RECEIPT_V1";

const IDENTIFIER = /^[^\u0000-\u001f\u007f]{1,256}$/u;
const CONFIGURATION_KEYS = Object.freeze([
  "actor", "approver", "changeId", "operationId", "policyVersion",
  "reasonCode",
]);
const INTENT_CLASSES = Object.freeze(["CLARIFICATION", "DISCOVER_PROBLEM"]);
const EFFECT_OUTCOMES = new Set([
  "NOT_APPLIED", "APPLIED", "REJECTED", "UNKNOWN", "COMPENSATED",
]);
const COMPONENT = "D2E4H_EXECUTION";

export class D2E4HExecutionError extends Error {
  constructor(code) {
    super(code);
    this.name = "D2E4HExecutionError";
    this.code = code;
  }
}

function fail(code) {
  throw new D2E4HExecutionError(code);
}

function exactConfiguration(input) {
  const keys = input && typeof input === "object" ? Object.keys(input).sort() : [];
  const base = [...CONFIGURATION_KEYS].sort();
  const withTrace = [...CONFIGURATION_KEYS, "traceId"].sort();
  const matches = (expected) => keys.length === expected.length &&
    keys.every((key, index) => key === expected[index]);
  if ((!matches(base) && !matches(withTrace)) ||
      input.actor !== "preview-canary-control-plane" ||
      !IDENTIFIER.test(input.approver ?? "") ||
      !IDENTIFIER.test(input.changeId ?? "") ||
      !IDENTIFIER.test(input.operationId ?? "") ||
      !IDENTIFIER.test(input.policyVersion ?? "") ||
      !IDENTIFIER.test(input.reasonCode ?? "") ||
      (input.traceId !== undefined && !IDENTIFIER.test(input.traceId))) {
    fail("D2E4H_CEREMONY_CONFIGURATION_REJECTED");
  }
  return Object.freeze({ ...input });
}

function authoritativeRunnerBinding(artifact) {
  const authority = artifact.authority;
  return Object.freeze({
    environment: authority.environment,
    authoritativeTenantId: authority.authoritativeTenantId,
    authoritativeTenantLocator: authority.authoritativeTenantLocator,
    syntheticFixtureLocator: authority.syntheticFixtureLocator,
    linkId: authority.linkId,
    sessionId: authority.sessionId,
    turnId: authority.turnId,
    intentClass: authority.intentClass,
  });
}

function canaryVerification(configuration, artifact) {
  const authority = artifact.authority;
  const policy = artifact.policy;
  return Object.freeze({
    environment: "PREVIEW",
    projectId: artifact.projectId,
    authoritativeTenantId: authority.authoritativeTenantId,
    actor: configuration.actor,
    approver: configuration.approver,
    reasonCode: configuration.reasonCode,
    changeId: configuration.changeId,
    expectedCurrentPolicyVersion: policy.policyVersion,
    policy: Object.freeze({
      policyVersion: policy.policyVersion,
      environment: policy.environment,
      mode: policy.mode,
      enabled: policy.enabled,
      expiresAt: new Date(policy.expiresAtMs).toISOString(),
      allowedSyntheticFixtureLocators: policy.allowedSyntheticFixtureLocators,
      allowedIntentClasses: policy.allowedIntentClasses,
      killSwitchState: policy.killSwitchState,
    }),
  });
}

function boundedMessage(error, fallback) {
  const source = typeof error?.message === "string" && error.message
    ? error.message
    : fallback;
  return source.slice(0, 1024);
}

function safeCode(value, fallback) {
  return typeof value === "string" && value === value.trim() && IDENTIFIER.test(value)
    ? value
    : fallback;
}

function terminalStatus(errors, effects, lifecycle) {
  if (errors.length === 0) return "SUCCESS";
  if (effects.some(({ outcome }) => outcome === "APPLIED" || outcome === "UNKNOWN")) {
    return "FAILED_PARTIAL";
  }
  const progressed = lifecycle.some(({ state }) => new Set([
    "PREVIEW_READY_REUSED", "ACTIVE_POLICY_VERIFIED", "CAPABILITY_ROTATED",
    "BROWSER_READY", "BROWSER_PROOF_VERIFIED", "TURN_EXECUTED",
  ]).has(state));
  return progressed || effects.length > 0 ? "FAILED" : "BLOCKED";
}

function recoveryFor(status) {
  if (status === "FAILED_PARTIAL") {
    return {
      required: true,
      state: "PENDING",
      owner: "D2E4H_RECOVERY_OPERATOR",
      actions: [
        "Reconcile every applied or unknown execution side effect",
        "Retain recovery evidence linked to the terminal receipt",
      ],
      safeToRetry: false,
      retryPreconditions: [
        "Reconcile capability rotation and browser turn outcomes",
        "Obtain fresh authority policy rotation deployment and composition evidence",
      ],
    };
  }
  return {
    required: false,
    state: "NONE",
    owner: null,
    actions: [],
    safeToRetry: false,
    retryPreconditions: [],
  };
}

export class BrowserEvaluateConversationBoundaryV1 {
  async executeOnce(runner) {
    if (typeof runner?.executeTurn !== "function") {
      fail("D2E4H_EVALUATE_CONVERSATION_BOUNDARY_REJECTED");
    }
    return assertTurnReceiptV1(await runner.executeTurn());
  }
}

export class OperationalExistingPreviewCeremonyExecutorV1 {
  #adaptiveCanaryControlPlaneAdapter;
  #capabilityIssuerAdapter;
  #browserRuntime;
  #evaluateConversationBoundary;
  #ceremonyConfiguration;
  #runnerFactory;
  #clock;
  #idFactory;
  #browserProofCustody;
  #used = false;

  constructor({
    adaptiveCanaryControlPlaneAdapter,
    capabilityIssuerAdapter,
    browserRuntime,
    browserProofCustody,
    evaluateConversationBoundary = new BrowserEvaluateConversationBoundaryV1(),
    ceremonyConfiguration,
    runnerFactory = createOperationalSingleProcessCeremonyRunnerV1,
    clock = Date.now,
    idFactory = randomUUID,
  }) {
    if (typeof adaptiveCanaryControlPlaneAdapter?.prepare !== "function" ||
        typeof capabilityIssuerAdapter?.issueOnce !== "function" ||
        typeof browserRuntime?.open !== "function" ||
        typeof browserRuntime?.createBootstrapAdapter !== "function" ||
        typeof browserRuntime?.close !== "function" ||
        typeof evaluateConversationBoundary?.executeOnce !== "function" ||
        typeof runnerFactory !== "function" || typeof clock !== "function" ||
        typeof idFactory !== "function") {
      fail("D2E4H_OPERATIONAL_DEPENDENCY_REJECTED");
    }
    this.#adaptiveCanaryControlPlaneAdapter = adaptiveCanaryControlPlaneAdapter;
    this.#capabilityIssuerAdapter = capabilityIssuerAdapter;
    this.#browserRuntime = browserRuntime;
    this.#evaluateConversationBoundary = evaluateConversationBoundary;
    this.#ceremonyConfiguration = exactConfiguration(ceremonyConfiguration);
    this.#runnerFactory = runnerFactory;
    this.#clock = clock;
    this.#idFactory = idFactory;
    this.#browserProofCustody = browserProofCustody;
  }

  #nextId(prefix) {
    const suffix = String(this.#idFactory());
    const value = `${prefix}-${suffix}`;
    if (!IDENTIFIER.test(value)) fail("D2E4H_IDENTIFIER_FACTORY_REJECTED");
    return value;
  }

  async executeOnce(artifact) {
    const startedAtMs = this.#clock();
    const certifiedArtifact = assertExecutionCompositionArtifactV1(artifact, {
      now: startedAtMs,
    });
    const traceId = this.#ceremonyConfiguration.traceId ?? this.#nextId("trace");
    const transitions = [];
    const effects = [];
    const errors = [];
    let browserProof = null;
    let turnReceipt = null;
    let runner;

    const transition = (state) => {
      transitions.push({
        sequence: transitions.length,
        state,
        component: COMPONENT,
        occurredAtMs: this.#clock(),
      });
    };
    const runtimeError = (error, stage, partial, fallbackCode) => {
      if (isRuntimeErrorV1(error) && error.traceId === traceId) return error;
      return createRuntimeErrorV1({
        errorId: this.#nextId("error"),
        code: safeCode(error?.code, fallbackCode),
        stage,
        producer: COMPONENT,
        severity: partial ? "PARTIAL_FAILURE" :
          (stage === "COMPOSITION" || stage === "DEPLOYMENT" ? "BLOCKING" : "FAILURE"),
        message: boundedMessage(error, fallbackCode),
        cause: null,
        retryable: false,
        partialSideEffects: partial,
        details: {
          sourceErrorName: safeCode(error?.name, "UnknownError"),
        },
        traceId,
        occurredAtMs: this.#clock(),
      });
    };
    const buildResult = (status) => {
      transition(`TERMINATED_${status}`);
      const completedAtMs = this.#clock();
      return createExecutionResultV1({
        receiptId: this.#nextId("execution-receipt"),
        operationId: this.#ceremonyConfiguration.operationId,
        changeId: this.#ceremonyConfiguration.changeId,
        traceId,
        artifactId: certifiedArtifact.artifactId,
        artifactDigest: certifiedArtifact.artifactDigest,
        environment: "PREVIEW",
        ...executionResultEvidenceFromArtifactV1(certifiedArtifact),
        status,
        lifecycle: {
          currentState: `TERMINATED_${status}`,
          transitions,
        },
        errors,
        sideEffects: effects,
        recovery: recoveryFor(status),
        browserProof,
        turnReceipt,
        startedAtMs,
        completedAtMs,
      }, { artifact: certifiedArtifact });
    };
    const terminalResult = (status) => {
      try {
        return buildResult(status);
      } catch (error) {
        if (isRuntimeErrorV1(error)) throw error;
        const partial = effects.some(({ outcome }) =>
          outcome === "APPLIED" || outcome === "UNKNOWN");
        throw runtimeError(
          error,
          "TERMINAL_VALIDATION",
          partial,
          "D2E4H_TERMINAL_CONSTRUCTION_REJECTED",
        );
      }
    };

    transition("CREATED");
    transition("ARTIFACT_VALIDATED");

    if (this.#used) {
      errors.push(runtimeError(
        new D2E4HExecutionError("D2E4H_SECOND_EXECUTION_REJECTED"),
        "COMPOSITION",
        false,
        "D2E4H_SECOND_EXECUTION_REJECTED",
      ));
      return terminalResult("BLOCKED");
    }
    this.#used = true;

    let stage = "CONFIGURATION";
    try {
      if (this.#ceremonyConfiguration.policyVersion !== certifiedArtifact.policy.policyVersion) {
        fail("D2E4H_POLICY_VERSION_REJECTED");
      }
      if (certifiedArtifact.deployment.deploymentId !== D2E4G_PREVIEW_DEPLOYMENT_ID ||
          certifiedArtifact.deployment.previewUrl !== D2E4G_PREVIEW_URL ||
          certifiedArtifact.projectId !== D2E4D_TARGET.projectName) {
        fail("D2E4H_EXISTING_PREVIEW_REJECTED");
      }

      runner = this.#runnerFactory({
        target: D2E4D_TARGET,
        authoritativeBinding: authoritativeRunnerBinding(certifiedArtifact),
        proofCustody: this.#browserProofCustody,
        clock: this.#clock,
      });
      if (runner?.state !== D2E4D_STATES.CREATED) fail("D2E4H_CEREMONY_NOT_CREATED");

      stage = "DEPLOYMENT";
      await runner.reuseExistingPreview(certifiedArtifact.deployment);
      if (runner.state !== D2E4D_STATES.PREVIEW_READY_REUSED)
        fail("D2E4H_EXISTING_PREVIEW_TRANSITION_REJECTED");
      transition("PREVIEW_READY_REUSED");

      stage = "POLICY";
      const policyResult = await runner.prepareCanary(
        this.#adaptiveCanaryControlPlaneAdapter,
        canaryVerification(this.#ceremonyConfiguration, certifiedArtifact),
      );
      if (policyResult?.policyVersion !== certifiedArtifact.policy.policyVersion)
        fail("D2E4H_ACTIVE_POLICY_VERIFICATION_REJECTED");
      transition("ACTIVE_POLICY_VERIFIED");

      stage = "ROTATION";
      const capabilityEffect = {
        type: "CAPABILITY_ROTATION",
        owner: "D2E4M_CAPABILITY_ROTATION",
        targetLocator: certifiedArtifact.rotationExpectation.capabilityLocator,
        attemptedAtMs: this.#clock(),
        outcome: "UNKNOWN",
        receiptLocator: null,
        reversible: false,
      };
      effects.push(capabilityEffect);
      try {
        const capability = await runner.issueCapability(
          this.#capabilityIssuerAdapter,
          Object.freeze({
            policyVersion: certifiedArtifact.policy.policyVersion,
            operationId: this.#ceremonyConfiguration.operationId,
            changeId: this.#ceremonyConfiguration.changeId,
          }),
        );
        if (capability?.status !== "ACTIVE" || capability?.disposition !== "ROTATED" ||
            capability?.actualWriteCount !== 1 ||
            !IDENTIFIER.test(capability?.capabilityLocator ?? "")) {
          fail("D2E4H_CAPABILITY_ROTATION_RESULT_REJECTED");
        }
        capabilityEffect.outcome = "APPLIED";
        capabilityEffect.receiptLocator = capability.capabilityLocator;
      } catch (error) {
        if (EFFECT_OUTCOMES.has(error?.sideEffectOutcome))
          capabilityEffect.outcome = error.sideEffectOutcome;
        throw error;
      }
      transition("CAPABILITY_ROTATED");

      stage = "BROWSER_PROOF";
      await this.#browserRuntime.open(certifiedArtifact.deployment.previewUrl);
      transition("BROWSER_READY");
      const proofCandidate = await runner.bootstrapBrowser(
        this.#browserRuntime.createBootstrapAdapter(),
      );
      assertBrowserProofResultV1(
        proofCandidate,
        executionResultEvidenceFromArtifactV1(certifiedArtifact).deploymentCertification,
        Number.MAX_SAFE_INTEGER,
      );
      browserProof = proofCandidate;
      if (browserProof.status !== "VERIFIED") fail("D2E4H_BROWSER_PROOF_REJECTED");
      transition("BROWSER_PROOF_VERIFIED");

      stage = "TURN";
      const turnEffect = {
        type: "BROWSER_TURN",
        owner: "D2E4H_BROWSER_TURN",
        targetLocator: certifiedArtifact.authority.turnId,
        attemptedAtMs: this.#clock(),
        outcome: "UNKNOWN",
        receiptLocator: null,
        reversible: false,
      };
      effects.push(turnEffect);
      try {
        const turnCandidate = await this.#evaluateConversationBoundary.executeOnce(runner);
        assertTurnReceiptV1(turnCandidate);
        turnReceipt = turnCandidate;
        if (runner.state !== D2E4D_STATES.TURN_EXECUTED)
          fail("D2E4H_TURN_STATE_REJECTED");
        turnEffect.outcome = "APPLIED";
        turnEffect.receiptLocator = certifiedArtifact.authority.turnId;
      } catch (error) {
        if (EFFECT_OUTCOMES.has(error?.sideEffectOutcome))
          turnEffect.outcome = error.sideEffectOutcome;
        throw error;
      }
      transition("TURN_EXECUTED");
    } catch (error) {
      const partial = effects.some(({ outcome }) =>
        outcome === "APPLIED" || outcome === "UNKNOWN");
      errors.push(runtimeError(error, stage, partial, "D2E4H_EXECUTION_FAILED"));
    } finally {
      transition("CLEANUP_STARTED");
      try {
        await runner?.destroy?.();
      } catch (error) {
        const partial = effects.some(({ outcome }) =>
          outcome === "APPLIED" || outcome === "UNKNOWN");
        errors.push(runtimeError(error, "CLEANUP", partial, "D2E4H_RUNNER_CLEANUP_FAILED"));
      }
      try {
        await this.#browserRuntime.close();
      } catch (error) {
        const partial = effects.some(({ outcome }) =>
          outcome === "APPLIED" || outcome === "UNKNOWN");
        errors.push(runtimeError(error, "CLEANUP", partial, "D2E4H_BROWSER_CLEANUP_FAILED"));
      }
      transition("CLEANUP_COMPLETED");
    }

    return terminalResult(terminalStatus(errors, effects, transitions));
  }
}

export function createOperationalD2E4HExecutionCeremonyV1(input) {
  return createD2E4GExecutionCeremonyV1({
    ceremonyExecutor: new OperationalExistingPreviewCeremonyExecutorV1(input),
    clock: input.clock,
    idFactory: input.idFactory,
  });
}
