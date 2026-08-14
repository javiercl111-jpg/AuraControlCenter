import { execFile as nodeExecFile } from "node:child_process";
import { existsSync } from "node:fs";
import { promisify } from "node:util";

import {
  BrowserAutomationEphemeralBootstrapAdapterV1,
  D2E4_CONTROL_CONTEXT,
  D2E4_FIREBASE_PROJECT_ID,
  D2E4_PROJECT_NAME,
  D2E4_RELEASE_BRANCH,
  createOperationalD2E4PreviewCeremonyControllerV1,
} from "./ai-ux-02d2e4-preview-ceremony-controller.mjs";

export const D2E4D_RUNNER_VERSION =
  "AI_UX_02D2E4D_SINGLE_PROCESS_CEREMONY_RUNNER_V1";

export const D2E4D_STATES = Object.freeze({
  CREATED: "CREATED",
  PREVIEW_READY_REUSED: "PREVIEW_READY_REUSED",
  CANARY_READY: "CANARY_READY",
  CAPABILITY_READY: "CAPABILITY_READY",
  BROWSER_READY: "BROWSER_READY",
  TURN_EXECUTED: "TURN_EXECUTED",
  DESTROYED: "DESTROYED",
});

export const D2E4D_TARGET = Object.freeze({
  environment: "PREVIEW",
  projectName: D2E4_PROJECT_NAME,
  firebaseProjectId: D2E4_FIREBASE_PROJECT_ID,
  gitBranch: D2E4_RELEASE_BRANCH,
  controlContext: D2E4_CONTROL_CONTEXT,
});

const SHA256 = /^[a-f0-9]{64}$/u;
const PREVIEW_URL = /^https:\/\/[a-z0-9-]+\.vercel\.app\/?$/u;
const LOCAL_HARNESS_URL = /^http:\/\/127\.0\.0\.1:\d+\/?$/u;
const CAPABILITY_BEARER = /^[a-f0-9]{64}$/u;
const FIXTURE = /^SYNTHETIC_FIXTURE_V1_[A-F0-9]{32}$/u;
const TENANT = /^tenant-[a-f0-9]{64}$/u;
const SAFE_RESOURCE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,255}$/u;
const VALID_CANARY_STATUSES = new Set(["ACTIVE", "DRY_RUN_VALIDATED"]);
const DEFAULT_EXEC_FILE = promisify(nodeExecFile);

export class D2E4DRunnerError extends Error {
  constructor(code) {
    super(code);
    this.name = "D2E4DRunnerError";
    this.code = code;
  }
}

function fail(code) {
  throw new D2E4DRunnerError(code);
}

function assertTarget(target) {
  if (
    target?.environment !== "PREVIEW" ||
    target?.projectName !== D2E4_PROJECT_NAME ||
    target?.firebaseProjectId !== D2E4_FIREBASE_PROJECT_ID ||
    target?.gitBranch !== D2E4_RELEASE_BRANCH ||
    target?.controlContext !== D2E4_CONTROL_CONTEXT
  ) {
    fail("D2E4D_TARGET_REJECTED");
  }
}

function assertAuthoritativeBinding(binding) {
  if (
    binding?.environment !== "PREVIEW" ||
    !TENANT.test(binding?.authoritativeTenantId ?? "") ||
    !FIXTURE.test(binding?.syntheticFixtureLocator ?? "") ||
    !SAFE_RESOURCE_ID.test(binding?.linkId ?? "") ||
    !SAFE_RESOURCE_ID.test(binding?.sessionId ?? "") ||
    !SAFE_RESOURCE_ID.test(binding?.turnId ?? "")
  ) {
    fail("D2E4D_AUTHORITATIVE_BINDING_REJECTED");
  }
}

function safeEnvironment(environment = process.env) {
  return Object.fromEntries(Object.entries(environment).filter(([key]) =>
    !/(?:CONTROL_PROOF|CAPABILITY_BEARER|SESSION_BEARER)/iu.test(key)));
}

function parseJsonOutput(output) {
  const source = String(output ?? "").trim();
  try {
    return JSON.parse(source);
  } catch {
    const lines = source.split(/\r?\n/u).reverse();
    for (const line of lines) {
      try {
        return JSON.parse(line);
      } catch {
        // Continue until the last JSON record is found.
      }
    }
  }
  fail("D2E4D_COMMAND_OUTPUT_INVALID");
}

export class NodeProcessCommandExecutorV1 {
  #execFile;
  #environment;

  constructor({ execFile = DEFAULT_EXEC_FILE, environment = process.env } = {}) {
    this.#execFile = execFile;
    this.#environment = safeEnvironment(environment);
  }

  async execute(executable, args, options = {}) {
    if (!Array.isArray(args) || args.some((value) => typeof value !== "string")) {
      fail("D2E4D_COMMAND_REJECTED");
    }
    const result = await this.#execFile(executable, args, {
      cwd: options.cwd,
      env: this.#environment,
      encoding: "utf8",
      windowsHide: true,
      maxBuffer: 8 * 1024 * 1024,
    });
    return Object.freeze({
      stdout: String(result?.stdout ?? ""),
      stderr: String(result?.stderr ?? ""),
    });
  }
}

export class RealVercelPreviewCeremonyAdapterV1 {
  #executor;
  #releaseRoot;
  #target;
  #mode;
  #deployInvoked = false;

  constructor({ executor, releaseRoot, target = D2E4D_TARGET, mode = "DRY_RUN" }) {
    assertTarget(target);
    if (!executor || typeof executor.execute !== "function" ||
        typeof releaseRoot !== "string" || !releaseRoot.trim() ||
        !new Set(["DRY_RUN", "APPLY"]).has(mode)) {
      fail("D2E4D_VERCEL_ADAPTER_REJECTED");
    }
    this.#executor = executor;
    this.#releaseRoot = releaseRoot;
    this.#target = Object.freeze({ ...target });
    this.#mode = mode;
  }

  #vercelExecutable() {
    return process.platform === "win32" ? "vercel.cmd" : "vercel";
  }

  async deployOnce() {
    if (this.#deployInvoked) fail("D2E4D_SECOND_DEPLOY_REJECTED");
    this.#deployInvoked = true;
    if (this.#mode === "DRY_RUN") {
      const result = await this.#executor.execute(
        this.#vercelExecutable(),
        ["deploy", "--dry", "--json"],
        { cwd: this.#releaseRoot },
      );
      parseJsonOutput(result.stdout);
      return Object.freeze({
        status: "DRY_RUN_READY",
        deploymentType: "Preview",
        projectName: this.#target.projectName,
        gitBranch: this.#target.gitBranch,
      });
    }

    const deployment = await this.#executor.execute(
      this.#vercelExecutable(),
      ["deploy", "--yes", "--json"],
      { cwd: this.#releaseRoot },
    );
    const created = parseJsonOutput(deployment.stdout);
    const previewUrl = created.url?.startsWith("http")
      ? created.url
      : `https://${created.url ?? ""}`;
    if (!PREVIEW_URL.test(previewUrl)) fail("D2E4D_PREVIEW_URL_INVALID");
    const inspection = await this.#executor.execute(
      this.#vercelExecutable(),
      ["inspect", previewUrl, "--wait", "--timeout", "10m", "--json"],
      { cwd: this.#releaseRoot },
    );
    const inspected = parseJsonOutput(inspection.stdout);
    const state = inspected.readyState ?? inspected.state;
    const target = String(inspected.target ?? "preview").toLowerCase();
    if (state !== "READY" || target !== "preview") {
      fail("D2E4D_PREVIEW_DEPLOY_NOT_READY");
    }
    return Object.freeze({
      status: "READY",
      deploymentType: "Preview",
      projectName: this.#target.projectName,
      gitBranch: this.#target.gitBranch,
      deploymentId: created.id ?? inspected.id,
      previewUrl,
    });
  }
}

export class RealAdaptiveCanaryControlPlaneAdapterV1 {
  #controlPlane;
  #mode;
  #applied = false;

  constructor({ controlPlane, mode = "DRY_RUN" }) {
    if (!controlPlane || typeof controlPlane.dryRun !== "function" ||
        typeof controlPlane.apply !== "function" ||
        typeof controlPlane.readBack !== "function" ||
        !new Set(["DRY_RUN", "APPLY"]).has(mode)) {
      fail("D2E4D_CANARY_ADAPTER_REJECTED");
    }
    this.#controlPlane = controlPlane;
    this.#mode = mode;
  }

  async prepare(change) {
    const dryRun = await this.#controlPlane.dryRun(change);
    const deltas = dryRun?.deltas;
    if (!SHA256.test(dryRun?.fingerprint ?? "") ||
        deltas?.policy !== 0 || deltas?.pointer !== 0 ||
        deltas?.audit !== 0 || deltas?.replay !== 0) {
      fail("D2E4D_CANARY_DRY_RUN_REJECTED");
    }
    if (this.#mode === "DRY_RUN") {
      return Object.freeze({
        status: "DRY_RUN_VALIDATED",
        policyVersion: dryRun.proposedPolicyVersion,
        fingerprint: dryRun.fingerprint,
      });
    }
    if (this.#applied) fail("D2E4D_SECOND_CANARY_APPLY_REJECTED");
    this.#applied = true;
    const applied = await this.#controlPlane.apply({
      ...change,
      dryRunFingerprint: dryRun.fingerprint,
    });
    const readRequest = {
      environment: change.environment,
      projectId: change.projectId,
      authoritativeTenantId: change.authoritativeTenantId,
      actor: change.actor,
      approver: change.approver,
      reasonCode: change.reasonCode,
    };
    const readBack = await this.#controlPlane.readBack(readRequest);
    if (applied?.status !== "APPLIED" || readBack?.status !== "ACTIVE" ||
        readBack?.pointer?.policyVersion !== change.policy?.policyVersion) {
      fail("D2E4D_CANARY_READBACK_REJECTED");
    }
    return Object.freeze({
      status: "ACTIVE",
      policyVersion: change.policy.policyVersion,
      fingerprint: dryRun.fingerprint,
    });
  }
}

class EphemeralCapabilityEnvelopeV1 {
  #bearer;
  #expiresAt;
  #available = true;

  constructor(bearer, expiresAt) {
    if (!CAPABILITY_BEARER.test(bearer) || !Number.isSafeInteger(expiresAt)) {
      fail("D2E4D_CAPABILITY_HANDOFF_REJECTED");
    }
    this.#bearer = bearer;
    this.#expiresAt = expiresAt;
  }

  take(now = Date.now()) {
    if (!this.#available || this.#expiresAt <= now) {
      fail("D2E4D_CAPABILITY_UNAVAILABLE");
    }
    this.#available = false;
    const value = Object.freeze({ bearer: this.#bearer, expiresAt: this.#expiresAt });
    this.#bearer = undefined;
    return value;
  }

  destroy() {
    this.#available = false;
    this.#bearer = undefined;
    this.#expiresAt = undefined;
  }

  toJSON() {
    return Object.freeze({ available: this.#available });
  }
}

export class RealSyntheticCapabilityRotationAdapterV1 {
  #rotator;
  #issued = false;

  constructor({ rotator }) {
    if (!rotator || typeof rotator.issueAndRotate !== "function") {
      fail("D2E4D_CAPABILITY_ADAPTER_REJECTED");
    }
    this.#rotator = rotator;
  }

  async issueOnce(request) {
    if (this.#issued) fail("D2E4D_SECOND_CAPABILITY_REJECTED");
    this.#issued = true;
    const result = await this.#rotator.issueAndRotate(request);
    const handoff = result?.handoff;
    const envelope = new EphemeralCapabilityEnvelopeV1(
      handoff?.bearerToken,
      result?.expiresAt ?? handoff?.expiresAt,
    );
    return Object.freeze({
      status: "ACTIVE",
      disposition: result.disposition,
      actualWriteCount: result.actualWriteCount,
      capabilityLocator: result.capabilityLocator,
      envelope,
    });
  }
}

function defaultBrowserExecutable() {
  const candidates = process.platform === "win32"
    ? [
        `${process.env.PROGRAMFILES ?? ""}\\Google\\Chrome\\Application\\chrome.exe`,
        `${process.env["PROGRAMFILES(X86)"] ?? ""}\\Microsoft\\Edge\\Application\\msedge.exe`,
        `${process.env.LOCALAPPDATA ?? ""}\\Google\\Chrome\\Application\\chrome.exe`,
      ]
    : ["/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"];
  return candidates.find((candidate) => candidate && existsSync(candidate));
}

export class PlaywrightCoreBrowserRuntimeV1 {
  #browser;
  #context;
  #page;
  #executablePath;
  #allowLocalHarness;

  constructor({
    executablePath = defaultBrowserExecutable(),
    allowLocalHarness = false,
  } = {}) {
    if (!executablePath || !existsSync(executablePath)) {
      fail("D2E4D_BROWSER_EXECUTABLE_MISSING");
    }
    this.#executablePath = executablePath;
    this.#allowLocalHarness = allowLocalHarness === true;
  }

  async inspectReadiness() {
    if (this.#browser || this.#context || this.#page) {
      fail("D2E4D_BROWSER_CONSUMER_CONFLICT");
    }
    const runtime = await import("playwright-core");
    if (!runtime?.chromium || typeof runtime.chromium.launch !== "function") {
      fail("D2E4D_BROWSER_RUNTIME_UNAVAILABLE");
    }
    return Object.freeze({
      status: "READY",
      environment: "PREVIEW",
      automation: "PLAYWRIGHT_CORE",
      executableAvailable: true,
      consumerAvailable: true,
      persistentStorageUsed: false,
    });
  }

  async open(previewUrl) {
    if (!PREVIEW_URL.test(previewUrl) &&
        !(this.#allowLocalHarness && LOCAL_HARNESS_URL.test(previewUrl))) {
      fail("D2E4D_BROWSER_URL_REJECTED");
    }
    if (this.#browser) fail("D2E4D_SECOND_BROWSER_REJECTED");
    const { chromium } = await import("playwright-core");
    this.#browser = await chromium.launch({
      executablePath: this.#executablePath,
      headless: true,
    });
    this.#context = await this.#browser.newContext({ serviceWorkers: "block" });
    this.#page = await this.#context.newPage();
    await this.#page.goto(previewUrl, { waitUntil: "domcontentloaded" });
    return this.#page;
  }

  page() {
    if (!this.#page) fail("D2E4D_BROWSER_NOT_OPEN");
    return this.#page;
  }

  createBootstrapAdapter() {
    return new BrowserAutomationEphemeralBootstrapAdapterV1({
      page: this.page(),
      telemetryDisabled: true,
    });
  }

  async close() {
    await this.#context?.close();
    await this.#browser?.close();
    this.#page = undefined;
    this.#context = undefined;
    this.#browser = undefined;
  }
}

export class OperationalSingleProcessCeremonyRunnerV1 {
  #state = D2E4D_STATES.CREATED;
  #controller;
  #target;
  #capability;
  #canary;
  #deployment;
  #turnReceipt;
  #authoritativeBinding;

  constructor({
    target = D2E4D_TARGET,
    authoritativeBinding,
    controllerFactory,
    randomBytes,
    proofCustody,
    clock,
    lifecycle,
  } = {}) {
    assertTarget(target);
    assertAuthoritativeBinding(authoritativeBinding);
    this.#target = Object.freeze({ ...target });
    this.#authoritativeBinding = Object.freeze({ ...authoritativeBinding });
    const factory = controllerFactory ?? createOperationalD2E4PreviewCeremonyControllerV1;
    this.#controller = factory({
      target: this.#target,
      randomBytes,
      proofCustody,
      clock,
      lifecycle,
    });
  }

  get state() {
    return this.#state;
  }

  #expect(expected) {
    if (this.#state !== expected) fail("D2E4D_INVALID_STATE_TRANSITION");
  }

  async reuseExistingPreview(deployment) {
    this.#expect(D2E4D_STATES.CREATED);
    if (
      !Object.isFrozen(deployment) ||
      deployment?.contractName !== "DeploymentReadinessReceiptV1" ||
      deployment?.contractVersion !== "V1" ||
      deployment?.status !== "READY" ||
      typeof deployment?.deploymentId !== "string" ||
      !deployment.deploymentId.startsWith("dpl_") ||
      deployment?.readyState !== "READY" ||
      deployment?.deploymentType !== "Preview" ||
      deployment?.projectId !== this.#target.projectName ||
      deployment?.environment !== "PREVIEW" ||
      deployment?.reusedExistingPreview !== true ||
      deployment?.deploymentInvocations !== 0 ||
      deployment?.productionChanged !== false ||
      deployment?.stagingChanged !== false ||
      !PREVIEW_URL.test(deployment?.previewUrl ?? "")
    ) {
      fail("D2E4D_EXISTING_PREVIEW_REJECTED");
    }
    await this.#controller.deriveDigest();
    this.#controller.bindCertifiedDeployment(deployment);
    this.#deployment = deployment;
    this.#state = D2E4D_STATES.PREVIEW_READY_REUSED;
    return deployment;
  }

  async prepareCanary(adapter, change) {
    if (this.#state !== D2E4D_STATES.PREVIEW_READY_REUSED) {
      fail("D2E4D_INVALID_STATE_TRANSITION");
    }
    if (typeof adapter?.prepare !== "function") fail("D2E4D_CANARY_ADAPTER_REQUIRED");
    const result = await adapter.prepare(change);
    if (!VALID_CANARY_STATUSES.has(result?.status) ||
        typeof result?.policyVersion !== "string") {
      fail("D2E4D_CANARY_NOT_READY");
    }
    this.#canary = Object.freeze({ ...result });
    this.#state = D2E4D_STATES.CANARY_READY;
    return this.#canary;
  }

  async issueCapability(adapter, request) {
    this.#expect(D2E4D_STATES.CANARY_READY);
    if (typeof adapter?.issueOnce !== "function") fail("D2E4D_CAPABILITY_ADAPTER_REQUIRED");
    const result = await adapter.issueOnce(request);
    if (result?.status !== "ACTIVE" || !result?.envelope) {
      fail("D2E4D_CAPABILITY_NOT_READY");
    }
    this.#capability = result.envelope;
    this.#state = D2E4D_STATES.CAPABILITY_READY;
    return Object.freeze({
      status: result.status,
      disposition: result.disposition,
      actualWriteCount: result.actualWriteCount,
      capabilityLocator: result.capabilityLocator,
    });
  }

  async bootstrapBrowser(adapter) {
    this.#expect(D2E4D_STATES.CAPABILITY_READY);
    const proofResult = await this.#controller.bootstrapBrowser(
      adapter,
      this.#authoritativeBinding,
    );
    if (proofResult?.status === "VERIFIED") {
      this.#state = D2E4D_STATES.BROWSER_READY;
    }
    return proofResult;
  }

  async executeTurn() {
    this.#expect(D2E4D_STATES.BROWSER_READY);
    const secret = this.#capability.take();
    this.#capability = undefined;
    let bearer = secret.bearer;
    try {
      this.#turnReceipt = await this.#controller.consumeOnce(Object.freeze({
        version: "DIRECT_EPHEMERAL_DISCOVERY_CAPABILITY_V1",
        bearer,
        expiresAt: secret.expiresAt,
      }));
    } finally {
      bearer = "";
    }
    if (this.#turnReceipt?.status !== "CONSUMED") {
      fail("D2E4D_TURN_NOT_CONSUMED");
    }
    this.#state = D2E4D_STATES.TURN_EXECUTED;
    return this.#turnReceipt;
  }

  destroy() {
    this.#capability?.destroy?.();
    this.#capability = undefined;
    this.#controller?.destroy();
    this.#turnReceipt = undefined;
    this.#canary = undefined;
    this.#deployment = undefined;
    this.#authoritativeBinding = undefined;
    this.#state = D2E4D_STATES.DESTROYED;
  }

  toJSON() {
    return Object.freeze({
      version: D2E4D_RUNNER_VERSION,
      state: this.#state,
      environment: "PREVIEW",
      projectName: this.#target.projectName,
      gitBranch: this.#target.gitBranch,
      canaryReady: this.#state === D2E4D_STATES.CANARY_READY ||
        this.#state === D2E4D_STATES.CAPABILITY_READY ||
        this.#state === D2E4D_STATES.BROWSER_READY ||
        this.#state === D2E4D_STATES.TURN_EXECUTED,
      capabilityReady: this.#state === D2E4D_STATES.CAPABILITY_READY,
    });
  }
}

export function createOperationalSingleProcessCeremonyRunnerV1(input) {
  return new OperationalSingleProcessCeremonyRunnerV1(input);
}
