import { existsSync } from "node:fs";
import { isAbsolute } from "node:path";

import {
  D2E4D_TARGET,
  NodeProcessCommandExecutorV1,
  PlaywrightCoreBrowserRuntimeV1,
  RealAdaptiveCanaryControlPlaneAdapterV1,
  RealSyntheticCapabilityRotationAdapterV1,
  RealVercelPreviewCeremonyAdapterV1,
} from "./ai-ux-02d2e4-final-preview-ceremony.mjs";
import {
  GcloudPreviewRuntimeRevisionReaderV1,
  RealCanaryPolicyRevalidationAdapterV1,
  RealCapabilityRotationAuthorityAdapterV1,
  createOperationalD2E4EFinalCeremonyEntrypointV1,
  SYNTHETIC_DISCOVERY_CAPABILITY_ACTOR_V1,
} from "./ai-ux-02d2e4e-real-capability-readiness.mjs";
import {
  assertD2E4GPreviewTargetV1,
  D2E4GCompositionPreflightV1,
  ExistingPreviewDeploymentReadBackAdapterV1,
  assertD2E4GReadyArtifactV1,
} from "./ai-ux-02d2e4g-execution-entrypoint-separation.mjs";
import {
  BrowserEvaluateConversationBoundaryV1,
  createOperationalD2E4HExecutionCeremonyV1,
} from "./ai-ux-02d2e4h-execution-only-ceremony-entrypoint.mjs";
import {
  LiveAdaptiveCanaryCeremonyAdapterV1,
  LiveRotatedCapabilityCeremonyAdapterV1,
} from "./ai-ux-02d2e4t-final-live-ceremony-bridges.mjs";
import {
  CertifiedPreviewSingleTurnReplayReadinessV1,
} from "./ai-ux-02d2e4x-preview-replay-readiness.mjs";

const {
  SYNTHETIC_DISCOVERY_CAPABILITY_POLICY_V1:
    syntheticCapabilityPolicy,
} = await import(
  "../functions/lib/discovery/capabilities/syntheticDiscoveryCapabilityIssuerV1.js"
);

export const D2E4J_COMPOSITION_VERSION =
  "AI_UX_02D2E4J_REAL_PREVIEW_CEREMONY_COMPOSITION_ROOT_V1";

const REQUIRED_CONFIGURATION = Object.freeze([
  "releaseRoot",
  "approver",
  "authoritativeTenantLocator",
  "changeId",
  "operationId",
  "policyVersion",
  "reasonCode",
]);
const REQUIRED_AUTHORITY_INPUT = Object.freeze([
  "authoritativeTenantId",
  "syntheticFixtureLocator",
  "intentClass",
  "turnId",
  "traceId",
]);
const VALID_READINESS = new Set(["READY", "CONDITIONAL", "BLOCKED"]);

export class D2E4JCompositionError extends Error {
  constructor(code, phase, d2e4hCreated = false) {
    super(code);
    this.name = "D2E4JCompositionError";
    this.code = code;
    this.phase = phase;
    this.d2e4hCreated = d2e4hCreated;
  }
}

function fail(code, phase, d2e4hCreated = false) {
  throw new D2E4JCompositionError(code, phase, d2e4hCreated);
}

function requiredText(input, key, phase = "CONFIGURATION") {
  const value = input?.[key];
  if (typeof value !== "string" || !value.trim()) {
    fail(`D2E4J_REQUIRED_${key.toUpperCase()}_MISSING`, phase);
  }
  return value.trim();
}

function validatePreviewTarget(input) {
  const source =
    input?.previewTarget;

  if (
    !source ||
    typeof source !== "object"
  ) {
    fail(
      "D2E4J_REQUIRED_PREVIEW_TARGET_MISSING",
      "CONFIGURATION",
    );
  }

  const deployment =
    assertD2E4GPreviewTargetV1({
      deploymentId:
        requiredText(
          source,
          "deploymentId",
        ),
      deploymentUrl:
        requiredText(
          source,
          "deploymentUrl",
        ),
      previewUrl:
        requiredText(
          source,
          "previewUrl",
        ),
      projectId:
        requiredText(
          source,
          "projectId",
        ),
    });

  const gitBranch =
    requiredText(
      source,
      "gitBranch",
    );

  if (
    !/^[A-Za-z0-9][A-Za-z0-9._/-]{2,255}$/u.test(
      gitBranch
    )
  ) {
    fail(
      "D2E4J_PREVIEW_GIT_BRANCH_REJECTED",
      "CONFIGURATION",
    );
  }

  return Object.freeze({
    deployment,
    gitBranch,
  });
}

function validateConfiguration(input) {
  if (input?.environment !== "PREVIEW") {
    fail("D2E4J_PREVIEW_ONLY", "CONFIGURATION");
  }
  const configuration = Object.fromEntries(
    REQUIRED_CONFIGURATION.map((key) => [key, requiredText(input, key)]),
  );

  const previewTarget =
    validatePreviewTarget(input);
  if (!isAbsolute(configuration.releaseRoot) ||
      !existsSync(configuration.releaseRoot)) {
    fail("D2E4J_RELEASE_ROOT_REJECTED", "CONFIGURATION");
  }
  const authorityInput = Object.fromEntries(
    REQUIRED_AUTHORITY_INPUT.map((key) => [key, requiredText(input, key)]),
  );
  return Object.freeze({
    ...configuration,
    previewTarget,
    authorityInput: Object.freeze(authorityInput),
  });
}

function validateOperationalDependencies(input) {
  if (
    typeof input?.authorityFactory !== "function" ||
    typeof input?.assertCertifiedAuthority !== "function" ||
    typeof input?.rotationRepository?.inspectExpired !== "function" ||
    typeof input?.policyRepository?.resolveActive !== "function" ||

    typeof input?.adaptiveCanaryControlPlane?.dryRun !== "function" ||
    typeof input?.adaptiveCanaryControlPlane?.apply !== "function" ||
    typeof input?.adaptiveCanaryControlPlane?.readBack !== "function" ||
    typeof input?.rotatorClass !== "function" ||
    (input?.commandExecutor !== undefined &&
      typeof input.commandExecutor?.execute !== "function") ||
    (input?.clock !== undefined && typeof input.clock !== "function")
  ) {
    fail("D2E4J_REAL_ADAPTER_MISSING", "ADAPTER_BINDING");
  }
}

function sameBinding(left, right) {
  return left === right &&
    left?.environment === "PREVIEW" &&
    left?.authoritativeTenantId === right?.authoritativeTenantId &&
    left?.syntheticFixtureLocator === right?.syntheticFixtureLocator &&
    left?.linkId === right?.linkId &&
    left?.sessionId === right?.sessionId &&
    left?.turnId === right?.turnId;
}

class D2E4JCapabilityCompositionCoordinatorV1 {
  #entrypoint;
  #input;
  #resolutionPromise;
  #resolution;

  constructor({ entrypoint, input }) {
    if (typeof entrypoint?.preflight !== "function") {
      fail("D2E4J_CAPABILITY_COMPOSITION_REJECTED", "ADAPTER_BINDING");
    }
    this.#entrypoint = entrypoint;
    this.#input = input;
  }

  async resolve() {
    this.#resolutionPromise ??= this.#entrypoint.preflight(this.#input);
    const result = await this.#resolutionPromise;
    if (
      result?.status !== "CEREMONY_READY" ||
      !Object.isFrozen(result?.authoritativeBinding) ||
      !(result?.capabilityAdapter instanceof RealSyntheticCapabilityRotationAdapterV1) ||
      !(result?.adapters?.rotationAuthority instanceof
        RealCapabilityRotationAuthorityAdapterV1) ||
      !(result?.adapters?.canaryRevalidation instanceof
        RealCanaryPolicyRevalidationAdapterV1) ||
      typeof result?.runner?.destroy !== "function"
    ) {
      fail("D2E4J_CAPABILITY_COMPOSITION_NOT_READY", "D2E4G_PREFLIGHT");
    }
    this.#resolution = result;
    return result;
  }

  current() {
    return this.#resolution;
  }
}

export class D2E4JAuthorityReadBridgeV1 {
  #coordinator;

  constructor({ coordinator }) {
    this.#coordinator = coordinator;
  }

  async readAuthority() {
    const result = await this.#coordinator.resolve();
    return Object.freeze({
      status: "READY",
      binding: result.authoritativeBinding,
    });
  }
}

export class D2E4JRotationReadinessBridgeV1 {
  #coordinator;

  constructor({ coordinator }) {
    this.#coordinator = coordinator;
  }

  async readReadiness(input) {
    const result = await this.#coordinator.resolve();
    if (!sameBinding(input?.binding, result.authoritativeBinding) ||
        !(result.adapters.rotationAuthority instanceof
          RealCapabilityRotationAuthorityAdapterV1)) {
      return Object.freeze({ status: "BLOCKED" });
    }
    return Object.freeze({ status: "READY" });
  }
}

export class D2E4JCanaryReadinessBridgeV1 {
  #coordinator;

  constructor({ coordinator }) {
    this.#coordinator = coordinator;
  }

  async readReadiness(input) {
    const result = await this.#coordinator.resolve();
    if (!sameBinding(input?.binding, result.authoritativeBinding) ||
        !(result.adapters.canaryRevalidation instanceof
          RealCanaryPolicyRevalidationAdapterV1)) {
      return Object.freeze({ status: "BLOCKED" });
    }
    return Object.freeze({ status: "READY" });
  }
}

export class D2E4JReplayRepositoryReadinessBridgeV1 {
  #coordinator;
  #repository;

  constructor({ coordinator, repository }) {
    if (typeof repository?.readReadiness !== "function") {
      fail("D2E4J_REPLAY_REPOSITORY_REJECTED", "ADAPTER_BINDING");
    }
    this.#coordinator = coordinator;
    this.#repository = repository;
  }

  async readReadiness(input) {
    const result = await this.#coordinator.resolve();
    if (!sameBinding(input?.binding, result.authoritativeBinding)) {
      return Object.freeze({ status: "BLOCKED" });
    }
    const readiness = await this.#repository.readReadiness(Object.freeze({
      environment: "PREVIEW",
      binding: result.authoritativeBinding,
    }));
    if (!VALID_READINESS.has(readiness?.status)) {
      fail("D2E4J_REPLAY_READINESS_INVALID", "D2E4G_PREFLIGHT");
    }
    return Object.freeze({ status: readiness.status });
  }
}

export class D2E4JOperationalCeremonyHandleV1 {
  #compositionResult;
  #execution;
  #runner;
  #browserRuntime;
  #destroyed = false;

  constructor({
    compositionResult,
    execution,
    runner,
    browserRuntime,
    bindings,
  }) {
    this.#compositionResult = compositionResult;
    this.#execution = execution;
    this.#runner = runner;
    this.#browserRuntime = browserRuntime;
    this.version = D2E4J_COMPOSITION_VERSION;
    this.environment = "PREVIEW";
    this.previewDeploymentId = compositionResult.artifact.deployment.deploymentId;
    this.compositionResult = compositionResult;
    this.artifact = compositionResult.artifact;
    this.bindings = bindings;
    this.phases = Object.freeze([
      "CONFIG_VALIDATED",
      "REAL_ADAPTERS_INSTANTIATED",
      "D2E4G_READY",
      "D2E4H_BOUND",
    ]);
    Object.freeze(this);
  }

  async executeOnce(...args) {
    if (args.length !== 0) {
      fail("D2E4J_FABRICATED_ARTIFACT_REJECTED", "EXECUTION", true);
    }
    if (this.#destroyed) {
      fail("D2E4J_HANDLE_DESTROYED", "EXECUTION", true);
    }
    return this.#execution.execute(this.#compositionResult);
  }

  async destroy() {
    if (this.#destroyed) return;
    this.#destroyed = true;
    this.#runner.destroy();
    await this.#browserRuntime.close();
  }
}

export async function createOperationalD2E4JPreviewCeremonyCompositionV1(input) {
  const configuration = validateConfiguration(input);
  validateOperationalDependencies(input);

  const clock = input.clock ?? Date.now;
  const commandExecutor = input.commandExecutor ??
    new NodeProcessCommandExecutorV1();

  const deploymentTarget =
    configuration.previewTarget.deployment;

  const controlTarget =
    Object.freeze({
      environment: "PREVIEW",
      projectName:
        deploymentTarget.projectId,
      firebaseProjectId:
        D2E4D_TARGET.firebaseProjectId,
      gitBranch:
        configuration.previewTarget.gitBranch,
      controlContext:
        D2E4D_TARGET.controlContext,
    });
  const browserRuntime = new PlaywrightCoreBrowserRuntimeV1({
    executablePath: input.browserExecutablePath,
  });
  const runtimeRevisionReader = new GcloudPreviewRuntimeRevisionReaderV1({
    executor: commandExecutor,
  });
  const capabilityEntrypoint =
    createOperationalD2E4EFinalCeremonyEntrypointV1({
      rotationRepository: input.rotationRepository,
      authorityFactory: input.authorityFactory,
      policyRepository: input.policyRepository,
      assertCertifiedAuthority: input.assertCertifiedAuthority,
      browserRuntime,
      runtimeRevisionReader,
      rotatorClass: input.rotatorClass,
      target: controlTarget,
      clock,
    });
  const coordinator = new D2E4JCapabilityCompositionCoordinatorV1({
    entrypoint: capabilityEntrypoint,
    input: Object.freeze({
      ...configuration.authorityInput,
      operationId: configuration.operationId,
      changeId: configuration.changeId,
      policyVersion: configuration.policyVersion,
    }),
  });
  const authorityReader = new D2E4JAuthorityReadBridgeV1({ coordinator });
  const rotationReadiness = new D2E4JRotationReadinessBridgeV1({ coordinator });
  const canaryControlPlane = new D2E4JCanaryReadinessBridgeV1({ coordinator });

  if (
    syntheticCapabilityPolicy?.environment !== "PREVIEW" ||
    syntheticCapabilityPolicy?.tenantId !==
      configuration.authorityInput.authoritativeTenantId ||
    syntheticCapabilityPolicy?.fixtureLocator !==
      configuration.authorityInput.syntheticFixtureLocator ||
    typeof syntheticCapabilityPolicy?.linkId !== "string" ||
    !syntheticCapabilityPolicy.linkId ||
    typeof syntheticCapabilityPolicy?.sessionId !== "string" ||
    !syntheticCapabilityPolicy.sessionId
  ) {
    fail(
      "D2E4J_SYNTHETIC_POLICY_BINDING_REJECTED",
      "ADAPTER_BINDING",
    );
  }

  const replayRepository =
    new CertifiedPreviewSingleTurnReplayReadinessV1({
      expectedBinding: Object.freeze({
        environment: "PREVIEW",

        authoritativeTenantId:
          configuration.authorityInput.authoritativeTenantId,

        syntheticFixtureLocator:
          configuration.authorityInput.syntheticFixtureLocator,

        linkId:
          syntheticCapabilityPolicy.linkId,

        sessionId:
          syntheticCapabilityPolicy.sessionId,

        turnId:
          configuration.authorityInput.turnId,
      }),
    });

  const replayRepositories = new D2E4JReplayRepositoryReadinessBridgeV1({
    coordinator,
    repository: replayRepository,
  });
  const deploymentReadBack = new ExistingPreviewDeploymentReadBackAdapterV1({
    executor: commandExecutor,
    releaseRoot: configuration.releaseRoot,
    previewTarget:
      deploymentTarget,
  });
  const previewConfigurationAdapter = new RealVercelPreviewCeremonyAdapterV1({
    executor: commandExecutor,
    releaseRoot: configuration.releaseRoot,
    target: controlTarget,
    mode: "APPLY",
  });
  const adaptiveCanaryControlPlaneAdapter =
    new LiveAdaptiveCanaryCeremonyAdapterV1({
      controlPlane: input.adaptiveCanaryControlPlane,
      authoritativeTenantLocator:
        configuration.authoritativeTenantLocator,
      actorLocator:
        SYNTHETIC_DISCOVERY_CAPABILITY_ACTOR_V1,
      clock,
    });


  const evaluateConversationBoundary =
    new BrowserEvaluateConversationBoundaryV1();

  const compositionPreflight = new D2E4GCompositionPreflightV1({
    authorityReader,
    rotationReadiness,
    canaryControlPlane,
    replayRepositories,
    deploymentReadBack,
  });
  const compositionResult = await compositionPreflight.preflight(Object.freeze({
    environment: "PREVIEW",
    deploymentId:
      deploymentTarget.deploymentId,
    previewTarget:
      deploymentTarget,
  }));
  if (compositionResult?.COMPOSITION_STATUS !== "READY") {
    coordinator.current()?.runner?.destroy?.();
    await browserRuntime.close();

    const error =
      new D2E4JCompositionError(
        "D2E4J_D2E4G_NOT_READY",
        "D2E4G_PREFLIGHT",
        false,
      );

    error.causeCode =
      compositionResult?.errorCode;

    error.causeMessage =
      compositionResult?.errorMessage;

    throw error;
  }

  const artifact = assertD2E4GReadyArtifactV1(compositionResult, deploymentTarget);
  const capabilityComposition = coordinator.current();
  if (!capabilityComposition ||
      !sameBinding(
        artifact.authoritativeBinding,
        capabilityComposition.authoritativeBinding,
      )) {
    capabilityComposition?.runner?.destroy?.();
    await browserRuntime.close();
    fail("D2E4J_READY_ARTIFACT_PROVENANCE_REJECTED", "D2E4G_PREFLIGHT");
  }

  const rotatedCapabilityCeremonyAdapter =
    new LiveRotatedCapabilityCeremonyAdapterV1({
      rotator: capabilityComposition.rotator,
    });

  let runnerAvailable = true;
  const runnerFactory = () => {
    if (!runnerAvailable) {
      fail("D2E4J_RUNNER_ALREADY_CLAIMED", "EXECUTION", true);
    }
    runnerAvailable = false;
    return capabilityComposition.runner;
  };
  let execution;
  try {
    execution = createOperationalD2E4HExecutionCeremonyV1({
      browserProofCustody: input?.browserProofCustody,
      previewConfigurationAdapter,
      adaptiveCanaryControlPlaneAdapter,
      capabilityIssuerAdapter:
        rotatedCapabilityCeremonyAdapter,
      browserRuntime,
      evaluateConversationBoundary,
      previewTarget:
        deploymentTarget,
      target:
        controlTarget,
      ceremonyConfiguration: Object.freeze({
        actor: SYNTHETIC_DISCOVERY_CAPABILITY_ACTOR_V1,
        approver: configuration.approver,
        changeId: configuration.changeId,
        operationId: configuration.operationId,
        policyVersion: configuration.policyVersion,
        reasonCode: configuration.reasonCode,
      }),
      runnerFactory,
      clock,
    });
  } catch (error) {
    capabilityComposition.runner.destroy();
    await browserRuntime.close();
    throw error;
  }

  const bindings = Object.freeze({
    capabilityComposition: capabilityEntrypoint.constructor.name,
    authorityBridge: authorityReader.constructor.name,
    rotationBridge: rotationReadiness.constructor.name,
    rotationAuthority:
      capabilityComposition.adapters.rotationAuthority.constructor.name,
    canaryBridge: canaryControlPlane.constructor.name,
    canaryAuthority:
      capabilityComposition.adapters.canaryRevalidation.constructor.name,
    replayRepository: replayRepository.constructor.name,
    replayBridge: replayRepositories.constructor.name,
    deploymentReadBack: deploymentReadBack.constructor.name,
    previewConfiguration: previewConfigurationAdapter.constructor.name,
    adaptiveCanary: adaptiveCanaryControlPlaneAdapter.constructor.name,
    capabilityIssuer: rotatedCapabilityCeremonyAdapter.constructor.name,
    browser: browserRuntime.constructor.name,
    evaluateConversation: evaluateConversationBoundary.constructor.name,
    d2e4gPreflight: compositionPreflight.constructor.name,
    d2e4hExecution: execution.constructor.name,
  });

  return new D2E4JOperationalCeremonyHandleV1({
    compositionResult,
    execution,
    runner: capabilityComposition.runner,
    browserRuntime,
    bindings,
  });
}
