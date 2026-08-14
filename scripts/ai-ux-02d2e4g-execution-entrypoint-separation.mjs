import { randomUUID } from "node:crypto";

import {
  D2E4D_TARGET,
  NodeProcessCommandExecutorV1,
} from "./ai-ux-02d2e4-final-preview-ceremony.mjs";
import {
  assertExecutionCompositionArtifactV1,
  assertExecutionResultV1,
  createRuntimeErrorV1,
  isRuntimeErrorV1,
} from "./ai-ux-02d2e4x-execution-receipt-contract-v1.mjs";
import {
  DEPLOYMENT_CERTIFICATION_SIDECAR_PATH_V1,
  DEPLOYMENT_READINESS_TTL_MS_V1,
  assertDeploymentCertificationSidecarV1,
  assertDeploymentReadinessReceiptV1,
  createBoundaryRuntimeErrorV1,
  createDeploymentReadinessReceiptV1,
  sha256BytesV1,
} from "./ai-ux-02d2e4x-browser-proof-deployment-contract-v1.mjs";

export const D2E4G_COMPOSITION_VERSION =
  "AI_UX_02D2E4G_COMPOSITION_PREFLIGHT_V1";
export const D2E4G_EXECUTION_VERSION =
  "AI_UX_02D2E4G_EXECUTION_CEREMONY_V1";
export const D2E4G_SHARED_ARTIFACT_VERSION =
  "AI_UX_02D2E4G_READ_ONLY_COMPOSITION_ARTIFACT_V1";
export const D2E4G_PREVIEW_DEPLOYMENT_ID =
  "dpl_7PqUaT1UvrNhNHupCND3YXTvLtbi";
export const D2E4G_PREVIEW_URL =
  "https://aura-control-center-hyqo6tsph-javiers-projects-eab33ae8.vercel.app";
export const D2E4G_PREVIEW_PROJECT_ID = "aura-control-center";

const COMPOSITION_STATUSES = new Set(["READY", "CONDITIONAL", "BLOCKED"]);
const TENANT = /^tenant-[a-f0-9]{64}$/u;
const FIXTURE = /^SYNTHETIC_FIXTURE_V1_[A-F0-9]{32}$/u;
const SAFE_RESOURCE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,255}$/u;

export class D2E4GEntrypointError extends Error {
  constructor(code) {
    super(code);
    this.name = "D2E4GEntrypointError";
    this.code = code;
  }
}

function fail(code) {
  throw new D2E4GEntrypointError(code);
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function parseJsonOutput(output) {
  const source = String(output ?? "").trim();
  try {
    return JSON.parse(source);
  } catch {
    for (const line of source.split(/\r?\n/u).reverse()) {
      try {
        return JSON.parse(line);
      } catch {
        // Continue until the final JSON record is found.
      }
    }
  }
  fail("D2E4G_DEPLOYMENT_READBACK_INVALID");
}

function assertBinding(binding) {
  if (
    binding?.environment !== "PREVIEW" ||
    !TENANT.test(binding?.authoritativeTenantId ?? "") ||
    !FIXTURE.test(binding?.syntheticFixtureLocator ?? "") ||
    !SAFE_RESOURCE_ID.test(binding?.linkId ?? "") ||
    !SAFE_RESOURCE_ID.test(binding?.sessionId ?? "") ||
    !SAFE_RESOURCE_ID.test(binding?.turnId ?? "")
  ) {
    fail("D2E4G_AUTHORITY_BINDING_REJECTED");
  }
}

function normalizeReadStatus(receipt, code) {
  const status = receipt?.status;
  if (!COMPOSITION_STATUSES.has(status)) fail(code);
  return status;
}

export class ExistingPreviewDeploymentReadBackAdapterV1 {
  #executor;
  #releaseRoot;
  #httpReader;
  #clock;
  #idFactory;
  #read = false;

  constructor({
    executor = new NodeProcessCommandExecutorV1(),
    releaseRoot,
    httpReader = new DeploymentReadBackHttpReaderV1(),
    clock = Date.now,
    idFactory = randomUUID,
  } = {}) {
    if (typeof executor?.execute !== "function" ||
        typeof releaseRoot !== "string" || !releaseRoot.trim() ||
        typeof httpReader?.readJson !== "function" ||
        typeof httpReader?.readBytes !== "function" ||
        typeof clock !== "function" || typeof idFactory !== "function") {
      fail("D2E4G_DEPLOYMENT_READBACK_ADAPTER_REJECTED");
    }
    this.#executor = executor;
    this.#releaseRoot = releaseRoot;
    this.#httpReader = httpReader;
    this.#clock = clock;
    this.#idFactory = idFactory;
  }

  async readBack({ traceId } = {}) {
    const boundaryTraceId = traceId ?? `deployment-readback-trace-${this.#idFactory()}`;
    try {
      if (this.#read) fail("D2E4G_SECOND_DEPLOYMENT_READBACK_REJECTED");
      this.#read = true;
      const executable = process.platform === "win32" ? "vercel.cmd" : "vercel";
      const result = await this.#executor.execute(executable, [
        "inspect",
        D2E4G_PREVIEW_DEPLOYMENT_ID,
        "--json",
      ], { cwd: this.#releaseRoot });
      const value = parseJsonOutput(result.stdout);
      const deploymentId = value.id;
      const readyState = value.readyState;
      const target = String(value.target ?? "").toLowerCase();
      const projectId = value.project?.id ?? value.projectId;
      const deploymentRevision = value.deploymentRevision;
      const rawUrl = value.url;
      const previewUrl = String(rawUrl ?? "").startsWith("https://")
        ? String(rawUrl)
        : `https://${String(rawUrl ?? "")}`;
      if (
        deploymentId !== D2E4G_PREVIEW_DEPLOYMENT_ID ||
        readyState !== "READY" || target !== "preview" ||
        projectId !== D2E4G_PREVIEW_PROJECT_ID ||
        typeof deploymentRevision !== "string" || !deploymentRevision ||
        previewUrl !== D2E4G_PREVIEW_URL
      ) {
        fail("D2E4G_EXISTING_PREVIEW_REJECTED");
      }

      const sidecarUrl = new URL(
        DEPLOYMENT_CERTIFICATION_SIDECAR_PATH_V1,
        `${previewUrl}/`,
      ).href;
      const sidecar = assertDeploymentCertificationSidecarV1(
        await this.#httpReader.readJson(sidecarUrl),
      );
      if (sidecar.projectId !== projectId ||
          (value.deploymentArtifactDigest !== undefined &&
            value.deploymentArtifactDigest !== sidecar.deploymentArtifactDigest) ||
          (value.controlProofDigest !== undefined &&
            value.controlProofDigest !== sidecar.controlProofDigest)) {
        fail("D2E4G_DEPLOYMENT_CERTIFICATION_MISMATCH");
      }
      for (const file of sidecar.files) {
        const fileUrl = new URL(file.path, `${previewUrl}/`);
        if (fileUrl.origin !== new URL(previewUrl).origin) {
          fail("D2E4G_DEPLOYMENT_FILE_ORIGIN_REJECTED");
        }
        const bytes = await this.#httpReader.readBytes(fileUrl.href);
        if (!(bytes instanceof Uint8Array) || bytes.byteLength !== file.byteLength ||
            sha256BytesV1(bytes) !== file.sha256) {
          fail("D2E4G_DEPLOYMENT_FILE_DIGEST_REJECTED");
        }
      }
      const certifiedAtMs = this.#clock();
      return createDeploymentReadinessReceiptV1({
        receiptId: `deployment-readiness-${this.#idFactory()}`,
        status: "READY",
        environment: "PREVIEW",
        projectId,
        deploymentId,
        deploymentRevision,
        deploymentArtifactDigest: sidecar.deploymentArtifactDigest,
        controlProofDigest: sidecar.controlProofDigest,
        previewUrl,
        deploymentType: "Preview",
        readyState,
        reusedExistingPreview: true,
        deploymentInvocations: 0,
        productionChanged: false,
        stagingChanged: false,
        readBackSource: "VERCEL_INSPECT",
        certifiedAtMs,
        expiresAtMs: certifiedAtMs + DEPLOYMENT_READINESS_TTL_MS_V1,
      }, { now: certifiedAtMs });
    } catch (error) {
      if (error?.contractName === "RuntimeErrorV1") throw error;
      const occurredAtMs = this.#clock();
      const code = error?.code ?? "D2E4G_DEPLOYMENT_READBACK_FAILED";
      throw createBoundaryRuntimeErrorV1({
        code,
        stage: "DEPLOYMENT",
        producer: "DeploymentReadBack",
        traceId: boundaryTraceId,
        occurredAtMs,
        errorId: `deployment-readback-error-${this.#idFactory()}`,
        retryable: false,
        details: {
          deploymentId: D2E4G_PREVIEW_DEPLOYMENT_ID,
          previewUrl: D2E4G_PREVIEW_URL,
        },
      });
    }
  }
}

export class DeploymentReadBackHttpReaderV1 {
  async #read(url) {
    const response = await fetch(url, {
      cache: "no-store",
      redirect: "error",
      headers: Object.freeze({ "cache-control": "no-store" }),
    });
    if (!response.ok || response.url !== url) fail("D2E4G_DEPLOYMENT_HTTP_REJECTED");
    return response;
  }

  async readJson(url) {
    return (await this.#read(url)).json();
  }

  async readBytes(url) {
    return new Uint8Array(await (await this.#read(url)).arrayBuffer());
  }
}

export class D2E4GCompositionPreflightV1 {
  #authorityReader;
  #rotationReadiness;
  #canaryControlPlane;
  #replayRepositories;
  #deploymentReadBack;
  #used = false;

  constructor({
    authorityReader,
    rotationReadiness,
    canaryControlPlane,
    replayRepositories,
    deploymentReadBack,
  }) {
    if (
      typeof authorityReader?.readAuthority !== "function" ||
      typeof rotationReadiness?.readReadiness !== "function" ||
      typeof canaryControlPlane?.readReadiness !== "function" ||
      typeof replayRepositories?.readReadiness !== "function" ||
      typeof deploymentReadBack?.readBack !== "function"
    ) {
      fail("D2E4G_COMPOSITION_DEPENDENCY_REJECTED");
    }
    this.#authorityReader = authorityReader;
    this.#rotationReadiness = rotationReadiness;
    this.#canaryControlPlane = canaryControlPlane;
    this.#replayRepositories = replayRepositories;
    this.#deploymentReadBack = deploymentReadBack;
  }

  async preflight(input) {
    if (this.#used) return deepFreeze({ COMPOSITION_STATUS: "BLOCKED" });
    this.#used = true;
    if (input?.environment !== "PREVIEW" ||
        input?.deploymentId !== D2E4G_PREVIEW_DEPLOYMENT_ID) {
      return deepFreeze({ COMPOSITION_STATUS: "BLOCKED" });
    }
    try {
      const authority = await this.#authorityReader.readAuthority(input);
      if (normalizeReadStatus(authority, "D2E4G_AUTHORITY_READBACK_INVALID") !== "READY") {
        return deepFreeze({ COMPOSITION_STATUS: authority.status });
      }
      assertBinding(authority.binding);

      const rotation = await this.#rotationReadiness.readReadiness({
        environment: "PREVIEW",
        binding: authority.binding,
      });
      if (normalizeReadStatus(rotation, "D2E4G_ROTATION_READINESS_INVALID") !== "READY") {
        return deepFreeze({ COMPOSITION_STATUS: rotation.status });
      }

      const canary = await this.#canaryControlPlane.readReadiness({
        environment: "PREVIEW",
        binding: authority.binding,
      });
      if (normalizeReadStatus(canary, "D2E4G_CANARY_READINESS_INVALID") !== "READY") {
        return deepFreeze({ COMPOSITION_STATUS: canary.status });
      }

      const replay = await this.#replayRepositories.readReadiness({
        environment: "PREVIEW",
        binding: authority.binding,
      });
      if (normalizeReadStatus(replay, "D2E4G_REPLAY_READINESS_INVALID") !== "READY") {
        return deepFreeze({ COMPOSITION_STATUS: replay.status });
      }

      const deployment = await this.#deploymentReadBack.readBack();
      if (normalizeReadStatus(deployment, "D2E4G_DEPLOYMENT_READINESS_INVALID") !== "READY" ||
          assertDeploymentReadinessReceiptV1(deployment).deploymentId !==
            D2E4G_PREVIEW_DEPLOYMENT_ID ||
          deployment.projectId !== D2E4G_PREVIEW_PROJECT_ID ||
          deployment.previewUrl !== D2E4G_PREVIEW_URL) {
        return deepFreeze({ COMPOSITION_STATUS: "BLOCKED" });
      }

      const artifact = deepFreeze({
        version: D2E4G_SHARED_ARTIFACT_VERSION,
        environment: "PREVIEW",
        target: D2E4D_TARGET,
        authoritativeBinding: authority.binding,
        deployment,
        readiness: {
          authority: "READY",
          rotation: "READY",
          adaptiveCanary: "READY",
          replay: "READY",
        },
      });
      return deepFreeze({ COMPOSITION_STATUS: "READY", artifact });
    } catch (error) {
      return deepFreeze({
        COMPOSITION_STATUS: "BLOCKED",
        errorCode:
          error?.code ??
          "UNKNOWN_D2E4G_ERROR",
        errorMessage:
          error?.message ??
          "UNKNOWN_D2E4G_ERROR",
      });
    }
  }
}

export function assertD2E4GReadyArtifactV1(result) {
  const artifact = result?.artifact;
  if (
    result?.COMPOSITION_STATUS !== "READY" ||
    artifact?.version !== D2E4G_SHARED_ARTIFACT_VERSION ||
    artifact?.environment !== "PREVIEW" ||
    artifact?.deployment?.deploymentId !== D2E4G_PREVIEW_DEPLOYMENT_ID ||
    artifact?.deployment?.projectId !== D2E4G_PREVIEW_PROJECT_ID ||
    artifact?.deployment?.previewUrl !== D2E4G_PREVIEW_URL ||
    artifact?.readiness?.authority !== "READY" ||
    artifact?.readiness?.rotation !== "READY" ||
    artifact?.readiness?.adaptiveCanary !== "READY" ||
    artifact?.readiness?.replay !== "READY" ||
    !Object.isFrozen(artifact)
  ) {
    fail("D2E4G_READY_ARTIFACT_REQUIRED");
  }
  assertDeploymentReadinessReceiptV1(artifact.deployment);
  assertBinding(artifact.authoritativeBinding);
  return artifact;
}

export class D2E4GExecutionCeremonyV1 {
  #ceremonyExecutor;
  #clock;
  #idFactory;
  #used = false;

  constructor({ ceremonyExecutor, clock = Date.now, idFactory = randomUUID }) {
    if (typeof ceremonyExecutor?.executeOnce !== "function" ||
        typeof clock !== "function" || typeof idFactory !== "function") {
      fail("D2E4G_EXECUTION_DEPENDENCY_REJECTED");
    }
    this.#ceremonyExecutor = ceremonyExecutor;
    this.#clock = clock;
    this.#idFactory = idFactory;
  }

  async execute(compositionResult) {
    if (this.#used) {
      throw this.#boundaryError(
        "D2E4G_SECOND_EXECUTION_REJECTED",
        "COMPOSITION",
      );
    }
    this.#used = true;

    let artifact;
    try {
      if (compositionResult?.COMPOSITION_STATUS !== "READY") {
        throw new D2E4GEntrypointError("D2E4G_READY_ARTIFACT_REQUIRED");
      }
      artifact = assertExecutionCompositionArtifactV1(compositionResult.artifact, {
        now: this.#clock(),
      });
    } catch (error) {
      if (isRuntimeErrorV1(error)) throw error;
      throw this.#boundaryError(
        error?.code ?? "D2E4G_READY_ARTIFACT_REQUIRED",
        "COMPOSITION",
        error,
      );
    }

    let receipt;
    try {
      receipt = await this.#ceremonyExecutor.executeOnce(artifact);
    } catch (error) {
      if (isRuntimeErrorV1(error)) throw error;
      throw this.#boundaryError(
        "D2E4G_TERMINAL_CONSTRUCTION_FAILED",
        "TERMINAL_VALIDATION",
        error,
      );
    }

    try {
      assertExecutionResultV1(receipt, { artifact });
    } catch (error) {
      if (isRuntimeErrorV1(error)) throw error;
      throw this.#boundaryError(
        "D2E4G_EXECUTION_RESULT_REJECTED",
        "TERMINAL_VALIDATION",
        error,
        receipt?.traceId,
      );
    }
    return receipt;
  }

  #boundaryError(code, stage, cause, traceId) {
    const safeTraceId = typeof traceId === "string" && SAFE_RESOURCE_ID.test(traceId)
      ? traceId
      : `d2e4g-trace-${this.#idFactory()}`;
    return createRuntimeErrorV1({
      errorId: `d2e4g-error-${this.#idFactory()}`,
      code,
      stage,
      producer: "D2E4G_EXECUTION_GATE",
      severity: stage === "COMPOSITION" ? "BLOCKING" : "FAILURE",
      message: String(cause?.message ?? code).slice(0, 1024),
      cause: null,
      retryable: false,
      partialSideEffects: false,
      details: {
        sourceCode: typeof cause?.code === "string" ? cause.code : code,
        sourceName: typeof cause?.name === "string" ? cause.name : "UnknownError",
      },
      traceId: safeTraceId,
      occurredAtMs: this.#clock(),
    });
  }
}

export function createD2E4GCompositionPreflightV1(input) {
  return new D2E4GCompositionPreflightV1(input);
}

export function createD2E4GExecutionCeremonyV1(input) {
  return new D2E4GExecutionCeremonyV1(input);
}
