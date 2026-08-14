import { randomUUID } from "node:crypto";

import {
  BrowserAutomationEphemeralBootstrapAdapterV1,
  D2E4_CONTROL_CONTEXT,
} from "./ai-ux-02d2e4-preview-ceremony-controller.mjs";
import {
  D2E4D_TARGET,
  NodeProcessCommandExecutorV1,
  RealSyntheticCapabilityRotationAdapterV1,
  createOperationalSingleProcessCeremonyRunnerV1,
} from "./ai-ux-02d2e4-final-preview-ceremony.mjs";
import {
  AuthoritativeJitFixtureSessionBindingResolverV1,
} from "./ai-ux-02d2e4f-authoritative-jit-binding.mjs";
import {
  assertAuthorityReceiptV1,
  assertPolicyReadinessReceiptV1,
  createRuntimeErrorFieldsV1,
  isRuntimeErrorV1,
  sha256CanonicalV1,
} from "./ai-ux-02d2e4x-policy-readiness-contract-v1.mjs";

export const D2E4E_COMPOSITION_VERSION =
  "AI_UX_02D2E4E_REAL_CAPABILITY_AUTHORITY_READINESS_V1";
export const SYNTHETIC_DISCOVERY_CONSUMER_BOUNDARY_VERSION_V1 =
  "SYNTHETIC_DISCOVERY_CONSUMER_BOUNDARY_V1";
export const SYNTHETIC_DISCOVERY_CAPABILITY_ACTOR_V1 =
  "preview-canary-control-plane";
export const SYNTHETIC_DISCOVERY_CAPABILITY_SCOPE_V1 = "DISCOVERY_SESSION";
export const EXPECTED_PREVIEW_RUNTIME_REVISION =
  "evaluateconversation-00003-foz";

const ACTIVE_POINTER_VERSION =
  "DISCOVERY_ADAPTIVE_CANARY_ACTIVE_POINTER_V1";
const SAFE_ID = /^[A-Z0-9][A-Z0-9._:-]{7,127}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const TRACE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/u;

export class D2E4ECompositionError extends Error {
  constructor(input) {
    const fields = typeof input === "string" ? null : input;
    const code = fields?.code ?? input;
    super(fields?.message ?? code);
    Object.defineProperty(this, "name", {
      configurable: true,
      enumerable: false,
      writable: true,
      value: "D2E4ECompositionError",
    });
    if (fields) {
      for (const [field, value] of Object.entries(fields)) {
        Object.defineProperty(this, field, {
          configurable: false,
          enumerable: true,
          writable: false,
          value,
        });
      }
      Object.freeze(this);
    } else {
      this.code = code;
    }
  }
}

function fail(code) {
  throw new D2E4ECompositionError(code);
}

function failAuthority(code, { traceId, occurredAtMs, cause } = {}) {
  if (TRACE_ID.test(traceId ?? "") && Number.isSafeInteger(occurredAtMs)) {
    const fields = createRuntimeErrorFieldsV1({
      errorId: `readiness-error-${randomUUID()}`,
      code,
      stage: "AUTHORITY",
      producer: "D2E4E_READINESS",
      severity: "BLOCKING",
      message: code,
      cause: isRuntimeErrorV1(cause) ? cause : null,
      retryable: false,
      partialSideEffects: false,
      details: { observedName: cause?.name ?? "AuthorityReceiptV1" },
      traceId,
      occurredAtMs,
    });
    throw new D2E4ECompositionError(fields);
  }
  fail(code);
}

function assertTarget(target) {
  if (
    target?.environment !== "PREVIEW" ||
    target?.projectName !== D2E4D_TARGET.projectName ||
    target?.firebaseProjectId !== D2E4D_TARGET.firebaseProjectId ||
    target?.gitBranch !== D2E4D_TARGET.gitBranch ||
    target?.controlContext !== D2E4_CONTROL_CONTEXT
  ) {
    fail("D2E4E_PREVIEW_TARGET_REJECTED");
  }
}

function assertAuthorityShape(authority, { atMs, traceId } = {}) {
  try {
    assertAuthorityReceiptV1(authority, { atMs });
    if (authority.projectId !== D2E4D_TARGET.firebaseProjectId) {
      throw new TypeError("D2E4E_AUTHORITY_PROJECT_REJECTED");
    }
  } catch (cause) {
    failAuthority("D2E4E_CAPABILITY_AUTHORITY_REJECTED", {
      traceId,
      occurredAtMs: atMs,
      cause,
    });
  }
}

function assertRotationExpectation(expectation, now) {
  if (
    typeof expectation?.capabilityLocator !== "string" ||
    !expectation.capabilityLocator.trim() ||
    !SHA256.test(expectation?.expectedTokenHash ?? "") ||
    expectation?.expectedCapabilityVersion !== "DISCOVERY_CAPABILITY_V1" ||
    !Number.isSafeInteger(expectation?.expectedUpdatedAt) ||
    !Number.isSafeInteger(expectation?.expectedExpiresAt) ||
    expectation.expectedExpiresAt > now ||
    !Number.isSafeInteger(expectation?.expectedRotationVersion) ||
    expectation.expectedRotationVersion < 0
  ) {
    fail("D2E4E_CAPABILITY_STATE_REJECTED");
  }
}

function boundaryDigest(authority, expectation) {
  return sha256CanonicalV1({
    contractName: "D2E4E_AUTHORITY_BOUNDARY_DIGEST_V1",
    receiptId: authority.receiptId,
    evidenceDigest: authority.evidenceDigest,
    environment: authority.environment,
    projectId: authority.projectId,
    authoritativeTenantId: authority.authoritativeTenantId,
    authoritativeTenantLocator: authority.authoritativeTenantLocator,
    syntheticFixtureLocator: authority.syntheticFixtureLocator,
    intentClass: authority.intentClass,
    linkId: authority.linkId,
    sessionId: authority.sessionId,
    turnId: authority.turnId,
    capabilityLocator: expectation.capabilityLocator,
    expectedRotationVersion: expectation.expectedRotationVersion,
  });
}

export class RealConsumerBoundaryReadinessAdapterV1 {
  #rotationRepository;
  #browserRuntime;
  #bootstrapAdapterClass;
  #target;

  constructor({
    rotationRepository,
    browserRuntime,
    bootstrapAdapterClass = BrowserAutomationEphemeralBootstrapAdapterV1,
    target = D2E4D_TARGET,
  }) {
    assertTarget(target);
    if (typeof rotationRepository?.inspectExpired !== "function" ||
        typeof browserRuntime?.inspectReadiness !== "function" ||
        typeof bootstrapAdapterClass?.prototype?.claimEphemeral !== "function") {
      fail("D2E4E_CONSUMER_ADAPTER_REJECTED");
    }
    this.#rotationRepository = rotationRepository;
    this.#browserRuntime = browserRuntime;
    this.#bootstrapAdapterClass = bootstrapAdapterClass;
    this.#target = Object.freeze({ ...target });
  }

  async assertReady(authority, now, { traceId } = {}) {
    assertTarget(this.#target);
    assertAuthorityShape(authority, { atMs: now, traceId });
    if (!Number.isSafeInteger(now)) fail("D2E4E_TIME_REJECTED");
    const [expectation, runtime] = await Promise.all([
      this.#rotationRepository.inspectExpired(authority, now, { traceId }),
      this.#browserRuntime.inspectReadiness(),
    ]);
    assertRotationExpectation(expectation, now);
    if (
      runtime?.status !== "READY" ||
      runtime?.environment !== "PREVIEW" ||
      runtime?.automation !== "PLAYWRIGHT_CORE" ||
      runtime?.executableAvailable !== true ||
      runtime?.consumerAvailable !== true ||
      runtime?.persistentStorageUsed !== false ||
      typeof this.#bootstrapAdapterClass.prototype.claimEphemeral !== "function"
    ) {
      fail("D2E4E_BROWSER_CONSUMER_NOT_READY");
    }
    return Object.freeze({
      version: SYNTHETIC_DISCOVERY_CONSUMER_BOUNDARY_VERSION_V1,
      environment: "PREVIEW",
      consumer: "BROWSER_REQUEST",
      status: "READY",
      boundaryLocator: boundaryDigest(authority, expectation),
      readyAt: now,
      expiresAt: now + 5 * 60 * 1_000,
      persistentStorageUsed: false,
    });
  }
}

export class RealCapabilityRotationAuthorityAdapterV1 {
  #rotationRepository;
  #assertCertifiedAuthority;
  #target;

  constructor({
    rotationRepository,
    assertCertifiedAuthority,
    target = D2E4D_TARGET,
  }) {
    assertTarget(target);
    if (typeof rotationRepository?.inspectExpired !== "function" ||
        typeof assertCertifiedAuthority !== "function") {
      fail("D2E4E_ROTATION_AUTHORITY_ADAPTER_REJECTED");
    }
    this.#rotationRepository = rotationRepository;
    this.#assertCertifiedAuthority = assertCertifiedAuthority;
    this.#target = Object.freeze({ ...target });
  }

  async revalidate(input) {
    assertTarget(this.#target);
    assertAuthorityShape(input?.authority, {
      atMs: input?.now,
      traceId: input?.traceId,
    });
    if (!SAFE_ID.test(input?.operationId ?? "") ||
        !SAFE_ID.test(input?.changeId ?? "") ||
        !Number.isSafeInteger(input?.now)) {
      fail("D2E4E_ROTATION_OPERATION_REJECTED");
    }
    try {
      this.#assertCertifiedAuthority(input.authority, {
        atMs: input.now,
        traceId: input.traceId,
      });
    } catch (cause) {
      if (isRuntimeErrorV1(cause)) throw cause;
      failAuthority("D2E4E_CERTIFIED_AUTHORITY_REJECTED", {
        traceId: input.traceId,
        occurredAtMs: input.now,
        cause,
      });
    }
    const expectation = await this.#rotationRepository.inspectExpired(
      input.authority,
      input.now,
      { traceId: input.traceId },
    );
    assertRotationExpectation(expectation, input.now);
    return Object.freeze({
      environment: "PREVIEW",
      actorId: SYNTHETIC_DISCOVERY_CAPABILITY_ACTOR_V1,
      status: "AUTHORIZED",
      operationId: input.operationId,
      changeId: input.changeId,
    });
  }
}

export class GcloudPreviewRuntimeRevisionReaderV1 {
  #executor;

  constructor({ executor = new NodeProcessCommandExecutorV1() } = {}) {
    if (typeof executor?.execute !== "function") {
      fail("D2E4E_RUNTIME_READER_REJECTED");
    }
    this.#executor = executor;
  }

  async readCurrentRevision() {
    const executable = process.platform === "win32" ? "gcloud.cmd" : "gcloud";
    const result = await this.#executor.execute(executable, [
      "run", "services", "describe", "evaluateconversation",
      "--project", D2E4D_TARGET.firebaseProjectId,
      "--region", "us-central1",
      "--format=json",
    ]);
    let value;
    try {
      value = JSON.parse(result.stdout);
    } catch {
      fail("D2E4E_RUNTIME_READBACK_INVALID");
    }
    const revision = value?.status?.latestReadyRevisionName;
    if (typeof revision !== "string" || !revision.trim()) {
      fail("D2E4E_RUNTIME_READBACK_INVALID");
    }
    return Object.freeze({
      status: "READY",
      environment: "PREVIEW",
      revision,
      failedRevisions: 0,
    });
  }
}

export class RealCanaryPolicyRevalidationAdapterV1 {
  #policyRepository;
  #runtimeRevisionReader;
  #expectedRuntimeRevision;
  #target;
  #clock;
  #errorIdFactory;
  #traceId;

  constructor({
    policyRepository,
    runtimeRevisionReader,
    expectedRuntimeRevision = EXPECTED_PREVIEW_RUNTIME_REVISION,
    target = D2E4D_TARGET,
    clock = Date.now,
    errorIdFactory = () => `readiness-error-${randomUUID()}`,
    traceId,
  }) {
    assertTarget(target);
    if (typeof policyRepository?.resolveActive !== "function" ||
        typeof runtimeRevisionReader?.readCurrentRevision !== "function" ||
        typeof expectedRuntimeRevision !== "string" ||
        !expectedRuntimeRevision.trim() ||
        typeof clock !== "function" ||
        typeof errorIdFactory !== "function" ||
        (traceId !== undefined && !TRACE_ID.test(traceId))) {
      fail("D2E4E_CANARY_REVALIDATION_ADAPTER_REJECTED");
    }
    this.#policyRepository = policyRepository;
    this.#runtimeRevisionReader = runtimeRevisionReader;
    this.#expectedRuntimeRevision = expectedRuntimeRevision;
    this.#target = Object.freeze({ ...target });
    this.#clock = clock;
    this.#errorIdFactory = errorIdFactory;
    this.#traceId = traceId;
  }

  #failPolicy(code, traceId, details = {}, cause = null) {
    const fields = createRuntimeErrorFieldsV1({
      errorId: this.#errorIdFactory(),
      code,
      stage: "POLICY",
      producer: "D2E4E_READINESS",
      severity: "BLOCKING",
      message: code,
      cause,
      retryable: false,
      partialSideEffects: false,
      details,
      traceId,
      occurredAtMs: this.#clock(),
    });
    throw new D2E4ECompositionError(fields);
  }

  async revalidate(input) {
    assertTarget(this.#target);
    const traceId = input?.traceId ?? this.#traceId;
    if (!TRACE_ID.test(traceId ?? "") ||
        !SAFE_ID.test(input?.policyVersion ?? "")) {
      fail("D2E4E_CANARY_REQUEST_REJECTED");
    }

    const authorityObservedAtMs = this.#clock();
    try {
      assertAuthorityReceiptV1(input?.authority, {
        atMs: authorityObservedAtMs,
      });
    } catch (error) {
      this.#failPolicy(
        "D2E4E_CAPABILITY_AUTHORITY_REJECTED",
        traceId,
        { observedName: error?.name ?? "Error" },
      );
    }

    const resolution = await this.#policyRepository.resolveActive(
      input.authority,
      { traceId },
    );
    const receiptObservedAtMs = this.#clock();
    try {
      assertPolicyReadinessReceiptV1(resolution, {
        atMs: receiptObservedAtMs,
      });
    } catch (error) {
      this.#failPolicy(
        "D2E4E_CANARY_POLICY_NOT_READY",
        traceId,
        { observedName: error?.name ?? "Error" },
      );
    }

    if (
      resolution?.activePointerVersion !== ACTIVE_POINTER_VERSION ||
      resolution?.environment !== input.authority.environment ||
      resolution?.projectId !== input.authority.projectId ||
      resolution?.authoritativeTenantId !==
        input.authority.authoritativeTenantId ||
      resolution?.authoritativeTenantLocator !==
        input.authority.authoritativeTenantLocator ||
      resolution?.policyVersion !== input.policyVersion ||
      !resolution.allowedSyntheticFixtureLocators.includes(
        input.authority.syntheticFixtureLocator,
      ) ||
      !resolution.allowedIntentClasses.includes(input.authority.intentClass)
    ) {
      this.#failPolicy("D2E4E_CANARY_POLICY_NOT_READY", traceId);
    }

    const runtime = await this.#runtimeRevisionReader.readCurrentRevision();
    if (
      runtime?.status !== "READY" ||
      runtime?.environment !== "PREVIEW" ||
      runtime?.revision !== this.#expectedRuntimeRevision ||
      runtime?.failedRevisions !== 0
    ) {
      this.#failPolicy("D2E4E_CANARY_POLICY_NOT_READY", traceId);
    }
    return resolution;
  }
}

export class OperationalD2E4EFinalCeremonyEntrypointV1 {
  #rotationRepository;
  #authorityFactory;
  #policyRepository;
  #assertCertifiedAuthority;
  #browserRuntime;
  #runtimeRevisionReader;
  #rotatorClass;
  #runnerFactory;
  #clock;
  #created = false;

  constructor({
    rotationRepository,
    authorityFactory,
    policyRepository,
    assertCertifiedAuthority,
    browserRuntime,
    runtimeRevisionReader,
    rotatorClass,
    runnerFactory = createOperationalSingleProcessCeremonyRunnerV1,
    clock = Date.now,
  }) {
    if (typeof authorityFactory !== "function" ||
        typeof rotatorClass !== "function" || typeof runnerFactory !== "function" ||
        typeof clock !== "function") {
      fail("D2E4E_OPERATIONAL_ENTRYPOINT_REJECTED");
    }
    this.#rotationRepository = rotationRepository;
    this.#authorityFactory = authorityFactory;
    this.#policyRepository = policyRepository;
    this.#assertCertifiedAuthority = assertCertifiedAuthority;
    this.#browserRuntime = browserRuntime;
    this.#runtimeRevisionReader = runtimeRevisionReader;
    this.#rotatorClass = rotatorClass;
    this.#runnerFactory = runnerFactory;
    this.#clock = clock;
  }

  async preflight(input) {
    if (this.#created) fail("D2E4E_CEREMONY_ALREADY_CREATED");
    const now = this.#clock();
    const bindingResolution =
      await new AuthoritativeJitFixtureSessionBindingResolverV1({
        authorityFactory: this.#authorityFactory,
        rotationRepository: this.#rotationRepository,
        assertCertifiedAuthority: this.#assertCertifiedAuthority,
      }).resolve({
        authoritativeTenantId: input.authoritativeTenantId,
        syntheticFixtureLocator: input.syntheticFixtureLocator,
        intentClass: input.intentClass,
        turnId: input.turnId,
        traceId: input.traceId,
        now,
      });
    const authority = bindingResolution.authority;
    const consumerBoundary = new RealConsumerBoundaryReadinessAdapterV1({
      rotationRepository: this.#rotationRepository,
      browserRuntime: this.#browserRuntime,
    });
    const rotationAuthority = new RealCapabilityRotationAuthorityAdapterV1({
      rotationRepository: this.#rotationRepository,
      assertCertifiedAuthority: this.#assertCertifiedAuthority,
    });
    const canaryRevalidation = new RealCanaryPolicyRevalidationAdapterV1({
      policyRepository: this.#policyRepository,
      runtimeRevisionReader: this.#runtimeRevisionReader,
      clock: this.#clock,
      traceId: input.traceId,
    });

    await consumerBoundary.assertReady(authority, now, {
      traceId: input.traceId,
    });
    await rotationAuthority.revalidate({
      authority,
      operationId: input.operationId,
      changeId: input.changeId,
      now,
      traceId: input.traceId,
    });
    await canaryRevalidation.revalidate({
      authority,
      policyVersion: input.policyVersion,
      traceId: input.traceId,
    });

    const rotator = new this.#rotatorClass(
      authority,
      this.#rotationRepository,
      consumerBoundary,
      rotationAuthority,
      canaryRevalidation,
      this.#clock,
      undefined,
      input.traceId,
    );
    const runner = this.#runnerFactory({
      target: D2E4D_TARGET,
      authoritativeBinding: bindingResolution.binding,
    });
    this.#created = true;
    return Object.freeze({
      version: D2E4E_COMPOSITION_VERSION,
      status: "CEREMONY_READY",
      runner,
      rotator,
      capabilityAdapter: new RealSyntheticCapabilityRotationAdapterV1({ rotator }),
      authoritativeBinding: bindingResolution.binding,
      adapters: Object.freeze({
        consumerBoundary,
        rotationAuthority,
        canaryRevalidation,
      }),
    });
  }
}

export function createOperationalD2E4EFinalCeremonyEntrypointV1(input) {
  return new OperationalD2E4EFinalCeremonyEntrypointV1(input);
}
