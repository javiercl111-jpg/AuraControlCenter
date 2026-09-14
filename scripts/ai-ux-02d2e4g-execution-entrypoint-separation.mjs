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
export const D2E4G_PREVIEW_PROJECT_NAME = "aura-control-center";
export const D2E4G_PREVIEW_PROJECT_ID = D2E4G_PREVIEW_PROJECT_NAME;

export const D2E4G_PREVIEW_TARGET = Object.freeze({
  deploymentId: D2E4G_PREVIEW_DEPLOYMENT_ID,
  deploymentUrl: D2E4G_PREVIEW_URL,
  previewUrl: D2E4G_PREVIEW_URL,
  projectName: D2E4G_PREVIEW_PROJECT_NAME,
  projectId: D2E4G_PREVIEW_PROJECT_ID,
});

export function assertD2E4GPreviewTargetV1(input) {
  let deploymentUrl;
  let previewUrl;

  try {
    deploymentUrl = new URL(input?.deploymentUrl);
    previewUrl = new URL(input?.previewUrl);
  } catch {
    fail("D2E4G_PREVIEW_TARGET_REJECTED");
  }

  const deploymentPathAccepted =
    deploymentUrl.pathname === "/" &&
    !deploymentUrl.search &&
    !deploymentUrl.hash &&
    !deploymentUrl.username &&
    !deploymentUrl.password;

  const previewPathAccepted =
    previewUrl.pathname === "/" &&
    !previewUrl.search &&
    !previewUrl.hash &&
    !previewUrl.username &&
    !previewUrl.password;

  const previewHostAccepted =
    previewUrl.hostname.endsWith(".vercel.app") ||
    previewUrl.hostname === "preview-controlcenter.auranexus.io";

  if (
    typeof input?.deploymentId !== "string" ||
    !/^dpl_[A-Za-z0-9]+$/u.test(input.deploymentId) ||
    deploymentUrl.protocol !== "https:" ||
    !deploymentUrl.hostname.endsWith(".vercel.app") ||
    !deploymentPathAccepted ||
    previewUrl.protocol !== "https:" ||
    !previewHostAccepted ||
    !previewPathAccepted ||
    typeof input?.projectName !== "string" ||
    !/^[a-z0-9][a-z0-9-]{2,99}$/u.test(input.projectName) ||
    typeof input?.projectId !== "string" ||
    !(
      /^[a-z0-9][a-z0-9-]{2,99}$/u.test(input.projectId) ||
      /^prj_[A-Za-z0-9]+$/u.test(input.projectId)
    )
  ) {
    fail("D2E4G_PREVIEW_TARGET_REJECTED");
  }

  return Object.freeze({
    deploymentId: input.deploymentId,
    deploymentUrl: deploymentUrl.origin,
    previewUrl: previewUrl.origin,
    projectName: input.projectName,
    projectId: input.projectId,
  });
}

const COMPOSITION_STATUSES = new Set(["READY", "CONDITIONAL", "BLOCKED"]);
const TENANT = /^tenant-[a-f0-9]{64}$/u;
const FIXTURE = /^SYNTHETIC_FIXTURE_V1_[A-F0-9]{32}$/u;
const SAFE_RESOURCE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,255}$/u;
const VERCEL_AUTOMATION_BYPASS_SECRET_V1 = /^[A-Za-z0-9]{32}$/u;
const DEPLOYMENT_FILE_STABILIZATION_ATTEMPTS_V1 = 16;
const DEPLOYMENT_FILE_STABILIZATION_DELAY_MS_V1 = 15000;
const DEPLOYMENT_GLOBAL_COHERENCY_DEADLINE_MS_V1 = 720_000;
const DEPLOYMENT_GLOBAL_COHERENCY_POLL_DELAY_MS_V1 = 30_000;

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
  #previewTarget;
  #read = false;

  constructor({
    executor = new NodeProcessCommandExecutorV1(),
    releaseRoot,
    httpReader = new DeploymentReadBackHttpReaderV1(),
    clock = Date.now,
    idFactory = randomUUID,
    previewTarget = D2E4G_PREVIEW_TARGET,
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
    this.#previewTarget =
      assertD2E4GPreviewTargetV1(previewTarget);
  }

  async readBack({ traceId } = {}) {
    const boundaryTraceId =
      traceId ??
      `deployment-readback-trace-${this.#idFactory()}`;

    try {
      if (this.#read) {
        fail("D2E4G_SECOND_DEPLOYMENT_READBACK_REJECTED");
      }

      this.#read = true;

      const executable =
        process.platform === "win32"
          ? "vercel.cmd"
          : "vercel";

      const result = await this.#executor.execute(
        executable,
        [
          "inspect",
          this.#previewTarget.deploymentId,
          "--json",
        ],
        { cwd: this.#releaseRoot },
      );

      const value = parseJsonOutput(result.stdout);
      const deploymentId = value.id;
      const readyState = value.readyState;
      const target =
        String(value.target ?? "").toLowerCase();
      const inspectProjectName = value.name;
      const inspectProjectId =
        value.project?.id ?? value.projectId;
      const deploymentRevision =
        value.deploymentRevision ?? deploymentId;
      const rawUrl = value.url;

      const deploymentUrl =
        String(rawUrl ?? "").startsWith("https://")
          ? String(rawUrl)
          : `https://${String(rawUrl ?? "")}`;

      if (
        deploymentId !==
          this.#previewTarget.deploymentId ||
        readyState !== "READY" ||
        target !== "preview" ||
        typeof inspectProjectName !== "string" ||
        inspectProjectName !== this.#previewTarget.projectName ||
        (
          inspectProjectId !== undefined &&
          inspectProjectId !== null &&
          inspectProjectId !== this.#previewTarget.projectId
        ) ||
        typeof deploymentRevision !== "string" ||
        !deploymentRevision ||
        deploymentUrl !==
          this.#previewTarget.deploymentUrl
      ) {
        fail("D2E4G_EXISTING_PREVIEW_REJECTED");
      }

      /*
       * Certification bytes are always read from the immutable
       * Vercel deployment URL. The canonical Preview URL is only
       * emitted in the readiness receipt for browser execution.
       */
      const sidecarUrl = new URL(
        DEPLOYMENT_CERTIFICATION_SIDECAR_PATH_V1,
        `${deploymentUrl}/`,
      ).href;

      const sidecar =
        assertDeploymentCertificationSidecarV1(
          await this.#httpReader.readJson(sidecarUrl),
        );

      if (
        sidecar.projectId !== this.#previewTarget.projectId ||
        (
          value.deploymentArtifactDigest !== undefined &&
          value.deploymentArtifactDigest !==
            sidecar.deploymentArtifactDigest
        ) ||
        (
          value.controlProofDigest !== undefined &&
          value.controlProofDigest !==
            sidecar.controlProofDigest
        )
      ) {
        fail(
          "D2E4G_DEPLOYMENT_CERTIFICATION_MISMATCH"
        );
      }

      const certifiedFiles =
        sidecar.files.map((file) => {
          const fileUrl =
            new URL(file.path, `${deploymentUrl}/`);

          if (
            fileUrl.origin !==
            new URL(deploymentUrl).origin
          ) {
            fail(
              "D2E4G_DEPLOYMENT_FILE_ORIGIN_REJECTED"
            );
          }

          return Object.freeze({
            url: fileUrl.href,
            byteLength: file.byteLength,
            sha256: file.sha256,
          });
        });

      const globallyCoherentBytes =
        typeof this.#httpReader.readCertifiedFileSet ===
        "function"
          ? await this.#httpReader.readCertifiedFileSet(
              certifiedFiles,
            )
          : null;

      if (
        globallyCoherentBytes !== null &&
        (
          !Array.isArray(globallyCoherentBytes) ||
          globallyCoherentBytes.length !==
            certifiedFiles.length
        )
      ) {
        fail(
          "D2E4G_DEPLOYMENT_COHERENCY_RESULT_REJECTED"
        );
      }

      for (
        let index = 0;
        index < sidecar.files.length;
        index += 1
      ) {
        const file =
          sidecar.files[index];

        const certifiedFile =
          certifiedFiles[index];

        const bytes =
          globallyCoherentBytes === null
            ? await this.#httpReader.readBytes(
                certifiedFile.url,
                Object.freeze({
                  byteLength: file.byteLength,
                  sha256: file.sha256,
                }),
              )
            : globallyCoherentBytes[index];

        if (
          !(bytes instanceof Uint8Array) ||
          bytes.byteLength !== file.byteLength ||
          sha256BytesV1(bytes) !== file.sha256
        ) {
          fail(
            "D2E4G_DEPLOYMENT_FILE_DIGEST_REJECTED"
          );
        }
      }

      const certifiedAtMs = this.#clock();

      return createDeploymentReadinessReceiptV1({
        receiptId:
          `deployment-readiness-${this.#idFactory()}`,
        status: "READY",
        environment: "PREVIEW",
        projectId: sidecar.projectId,
        deploymentId,
        deploymentRevision,
        deploymentArtifactDigest:
          sidecar.deploymentArtifactDigest,
        controlProofDigest:
          sidecar.controlProofDigest,
        previewUrl:
          this.#previewTarget.previewUrl,
        deploymentType: "Preview",
        readyState,
        reusedExistingPreview: true,
        deploymentInvocations: 0,
        productionChanged: false,
        stagingChanged: false,
        readBackSource: "VERCEL_INSPECT",
        certifiedAtMs,
        expiresAtMs:
          certifiedAtMs +
          DEPLOYMENT_READINESS_TTL_MS_V1,
      }, { now: certifiedAtMs });
    } catch (error) {
      if (error?.contractName === "RuntimeErrorV1") {
        throw error;
      }

      const occurredAtMs = this.#clock();
      const code =
        error?.code ??
        "D2E4G_DEPLOYMENT_READBACK_FAILED";

      throw createBoundaryRuntimeErrorV1({
        code,
        stage: "DEPLOYMENT",
        producer: "DeploymentReadBack",
        traceId: boundaryTraceId,
        occurredAtMs,
        errorId:
          `deployment-readback-error-${this.#idFactory()}`,
        retryable: false,
        details: {
          deploymentId:
            this.#previewTarget.deploymentId,
          deploymentUrl:
            this.#previewTarget.deploymentUrl,
          previewUrl:
            this.#previewTarget.previewUrl,
        },
      });
    }
  }
}

export class DeploymentReadBackHttpReaderV1 {
  #protectionBypass;
  #sleep;
  #clock;
  constructor({
    protectionBypass =
      process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
    sleep = (ms) =>
      new Promise((resolve) => setTimeout(resolve, ms)),
    clock = Date.now,
  } = {}) {
    if (
      protectionBypass !== undefined &&
      (
        typeof protectionBypass !== "string" ||
        !VERCEL_AUTOMATION_BYPASS_SECRET_V1.test(
          protectionBypass,
        )
      )
    ) {
      fail("D2E4G_PROTECTION_BYPASS_REJECTED");
    }

    if (typeof sleep !== "function") {
      fail("D2E4G_DEPLOYMENT_STABILIZATION_SLEEP_REJECTED");
    }

    if (typeof clock !== "function") {
      fail("D2E4G_DEPLOYMENT_COHERENCY_CLOCK_REJECTED");
    }

    this.#protectionBypass =
      protectionBypass;
    this.#sleep = sleep;
    this.#clock = clock;
  }

  async #read(url) {
    const headers = {
      "cache-control": "no-store",
      ...(this.#protectionBypass === undefined
        ? {}
        : {
            "x-vercel-protection-bypass":
              this.#protectionBypass,
          }),
    };

    const response =
      await fetch(url, {
        cache: "no-store",
        redirect: "error",
        headers: Object.freeze(headers),
      });

    if (
      !response.ok ||
      response.url !== url
    ) {
      fail(
        "D2E4G_DEPLOYMENT_HTTP_REJECTED",
      );
    }

    return response;
  }

  async readJson(url) {
    return (
      await this.#read(url)
    ).json();
  }

  async readCertifiedFileSet(entries) {
    if (
      !Array.isArray(entries) ||
      entries.length < 1 ||
      entries.some(
        (entry) =>
          typeof entry?.url !== "string" ||
          !entry.url ||
          !Number.isSafeInteger(entry?.byteLength) ||
          entry.byteLength < 0 ||
          typeof entry?.sha256 !== "string" ||
          !/^[a-f0-9]{64}$/u.test(entry.sha256),
      )
    ) {
      fail("D2E4G_DEPLOYMENT_COHERENCY_INPUT_REJECTED");
    }

    const deadlineMs =
      this.#clock() +
      DEPLOYMENT_GLOBAL_COHERENCY_DEADLINE_MS_V1;

    let pass = 0;

    while (true) {
      if (
        pass > 0 &&
        this.#clock() >= deadlineMs
      ) {
        fail("D2E4G_DEPLOYMENT_FILE_DIGEST_REJECTED");
      }

      pass += 1;

      const observed = [];
      let coherent = true;

      for (const entry of entries) {
        let bytes;

        try {
          bytes =
            await this.readBytes(entry.url);
        } catch (error) {
          if (
            error?.code !==
            "D2E4G_DEPLOYMENT_HTTP_REJECTED"
          ) {
            throw error;
          }

          coherent = false;
          observed.push(null);
          continue;
        }

        const exact =
          bytes instanceof Uint8Array &&
          bytes.byteLength === entry.byteLength &&
          sha256BytesV1(bytes) === entry.sha256;

        if (!exact) {
          coherent = false;
        }

        observed.push(bytes);
      }

      if (coherent) {
        if (this.#clock() > deadlineMs) {
          fail("D2E4G_DEPLOYMENT_FILE_DIGEST_REJECTED");
        }

        return Object.freeze(observed);
      }

      const remainingMs =
        deadlineMs - this.#clock();

      if (remainingMs <= 0) {
        fail("D2E4G_DEPLOYMENT_FILE_DIGEST_REJECTED");
      }

      await this.#sleep(
        Math.min(
          DEPLOYMENT_GLOBAL_COHERENCY_POLL_DELAY_MS_V1,
          remainingMs,
        ),
      );
    }
  }
  async readBytes(url, expectation = undefined) {
    const expected =
      expectation === undefined
        ? null
        : expectation;

    if (
      expected !== null &&
      (
        !Number.isSafeInteger(expected?.byteLength) ||
        expected.byteLength < 0 ||
        typeof expected?.sha256 !== "string" ||
        !/^[a-f0-9]{64}$/u.test(expected.sha256)
      )
    ) {
      fail("D2E4G_DEPLOYMENT_FILE_EXPECTATION_REJECTED");
    }

    const attempts =
      expected === null
        ? 1
        : DEPLOYMENT_FILE_STABILIZATION_ATTEMPTS_V1;

    let bytes;

    for (
      let attempt = 1;
      attempt <= attempts;
      attempt += 1
    ) {
      bytes =
        new Uint8Array(
          await (
            await this.#read(url)
          ).arrayBuffer(),
        );

      if (
        expected === null ||
        (
          bytes.byteLength === expected.byteLength &&
          sha256BytesV1(bytes) === expected.sha256
        )
      ) {
        return bytes;
      }

      if (attempt < attempts) {
        await this.#sleep(
          DEPLOYMENT_FILE_STABILIZATION_DELAY_MS_V1,
        );
      }
    }

    return bytes;
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

    const previewTarget =
      assertD2E4GPreviewTargetV1(
        input?.previewTarget ?? D2E4G_PREVIEW_TARGET,
      );

    if (
      input?.environment !== "PREVIEW" ||
      input?.deploymentId !== previewTarget.deploymentId
    ) {
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
            previewTarget.deploymentId ||
          deployment.projectId !== previewTarget.projectId ||
          deployment.previewUrl !== previewTarget.previewUrl) {
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

export function assertD2E4GReadyArtifactV1(
  result,
  previewTarget = D2E4G_PREVIEW_TARGET,
) {
  const expectedTarget =
    assertD2E4GPreviewTargetV1(previewTarget);

  const artifact = result?.artifact;

  if (
    result?.COMPOSITION_STATUS !== "READY" ||
    artifact?.version !== D2E4G_SHARED_ARTIFACT_VERSION ||
    artifact?.environment !== "PREVIEW" ||
    artifact?.deployment?.deploymentId !== expectedTarget.deploymentId ||
    artifact?.deployment?.projectId !== expectedTarget.projectId ||
    artifact?.deployment?.previewUrl !== expectedTarget.previewUrl ||
    artifact?.readiness?.authority !== "READY" ||
    artifact?.readiness?.rotation !== "READY" ||
    artifact?.readiness?.adaptiveCanary !== "READY" ||
    artifact?.readiness?.replay !== "READY" ||
    !Object.isFrozen(artifact)
  ) {
    fail("D2E4G_READY_ARTIFACT_REQUIRED");
  }

  assertDeploymentReadinessReceiptV1(
    artifact.deployment
  );

  assertBinding(
    artifact.authoritativeBinding
  );

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
