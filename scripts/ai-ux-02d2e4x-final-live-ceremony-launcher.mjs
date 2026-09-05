import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  createOperationalD2E4JPreviewCeremonyCompositionV1,
} from "./ai-ux-02d2e4j-preview-ceremony-composition.mjs";
import {
  createBrowserProofCustodyV1,
} from "./ai-ux-02d2e4-preview-ceremony-controller.mjs";
import {
  D2E4D_TARGET,
  NodeProcessCommandExecutorV1,
  RealVercelPreviewCeremonyAdapterV1,
} from "./ai-ux-02d2e4-final-preview-ceremony.mjs";
import {
  createFirestorePreviewAuthorityFactoryV1,
  assertCertifiedPreviewAuthorityV1,
} from "./ai-ux-02d2e4n-live-preview-authority.mjs";
import {
  FirestoreSyntheticCapabilityRotationRepositoryV1,
} from "./ai-ux-02d2e4m-live-capability-rotation-repository.mjs";
import {
  LiveSyntheticCapabilityRotatorV1,
} from "./ai-ux-02d2e4m-live-synthetic-capability-rotator.mjs";
import {
  FirestoreAdaptiveCanaryPolicyRepositoryV1,
} from "./ai-ux-02d2e4o-live-adaptive-canary-policy-repository.mjs";
import {
  FirestoreAdaptiveCanaryControlPlaneV1,
} from "./ai-ux-02d2e4o-live-adaptive-canary-control-plane.mjs";
import {
  ExistingPreviewDeploymentReadBackAdapterV1,
} from "./ai-ux-02d2e4g-execution-entrypoint-separation.mjs";
import {
  assertExecutionResultV1,
  createRuntimeErrorV1,
  deepFreezeExecutionContractV1,
} from "./ai-ux-02d2e4x-execution-receipt-contract-v1.mjs";

const DISC_INT_03_CANONICAL_PREVIEW_URL =
  "https://preview-controlcenter.auranexus.io";

const DISC_INT_03_PROJECT_ID =
  "aura-control-center-preview";

const DISC_INT_03_GIT_BRANCH =
  "fix/disc-int-03-preview-ceremony-binding";
const requireFromFunctions = createRequire(
  new URL("../functions/package.json", import.meta.url),
);
const admin = requireFromFunctions("firebase-admin");

const PROJECT_ID = "aura-intel-preview";
const POLICY_VERSION = "AI_UX_02D3_PREVIEW_CANARY_20260813_V4";
const TURN_ID = "AI_UX_02D2E4_FINAL_TURN_0001";
const SAFE_ID = /^[^\u0000-\u001f\u007f]{1,256}$/u;

export function certifyLauncherExecutionResultV1(
  result,
  { clock = Date.now, idFactory = randomUUID } = {},
) {
  try {
    assertExecutionResultV1(result);
  } catch (error) {
    const traceId = typeof result?.traceId === "string" &&
      result.traceId === result.traceId.trim() && SAFE_ID.test(result.traceId)
      ? result.traceId
      : `launcher-trace-${idFactory()}`;
    throw createRuntimeErrorV1({
      errorId: `launcher-error-${idFactory()}`,
      code: "D2E4X_LAUNCHER_EXECUTION_RESULT_REJECTED",
      stage: "TERMINAL_VALIDATION",
      producer: "D2E4X_LAUNCHER",
      severity: "FAILURE",
      message: String(error?.message ??
        "D2E4X_LAUNCHER_EXECUTION_RESULT_REJECTED").slice(0, 1024),
      cause: null,
      retryable: false,
      partialSideEffects: false,
      details: {
        sourceCode: typeof error?.code === "string" ? error.code :
          "D2E4X_LAUNCHER_EXECUTION_RESULT_REJECTED",
        sourceName: typeof error?.name === "string" ? error.name : "UnknownError",
      },
      traceId,
      occurredAtMs: clock(),
    });
  }

  const presentation = deepFreezeExecutionContractV1({
    status: `D2E4X_LIVE_PREVIEW_CEREMONY_${result.status}`,
    contractName: result.contractName,
    contractVersion: result.contractVersion,
    executionStatus: result.status,
    receiptId: result.receiptId,
    traceId: result.traceId,
    artifactId: result.artifactId,
    artifactDigest: result.artifactDigest,
    terminalLifecycleState: result.lifecycle.currentState,
    errors: result.errors.map((error) => ({
      errorId: error.errorId,
      code: error.code,
      stage: error.stage,
      producer: error.producer,
      severity: error.severity,
      message: error.message,
      retryable: error.retryable,
      partialSideEffects: error.partialSideEffects,
    })),
    sideEffects: result.sideEffects,
    recovery: result.recovery,
    browserProofStatus: result.browserProof?.status ?? null,
    turnStatus: result.turnReceipt?.status ?? null,
    startedAtMs: result.startedAtMs,
    completedAtMs: result.completedAtMs,
  });

  return deepFreezeExecutionContractV1({ result, presentation });
}

export async function runFinalLiveCeremonyLauncherV1({ browserProofCustody } = {}) {
  const proofCustody =
    browserProofCustody ?? createBrowserProofCustodyV1();
  if (
    typeof proofCustody?.deriveDigest !== "function" ||
    typeof proofCustody?.claimOnce !== "function" ||
    typeof proofCustody?.destroy !== "function"
  ) {
    throw new Error("D2E4X_BROWSER_PROOF_CUSTODY_REQUIRED");
  }

  const {
    SYNTHETIC_DISCOVERY_CAPABILITY_POLICY_V1: syntheticPolicy,
  } = await import(
    "../functions/lib/discovery/capabilities/syntheticDiscoveryCapabilityIssuerV1.js"
  );

  const app = admin.apps?.find(
    (candidate) => candidate?.options?.projectId === PROJECT_ID,
  ) ?? admin.initializeApp(
    { projectId: PROJECT_ID },
    "ai-ux-02d2e4x-final-live-ceremony",
  );
  const db = admin.firestore(app);
  let handle = null;

  try {
    const controlProofDigest =
      proofCustody.deriveDigest();

    const liveCommandExecutor =
      new NodeProcessCommandExecutorV1();

    const livePreviewAdapter =
      new RealVercelPreviewCeremonyAdapterV1({
        executor: liveCommandExecutor,
        releaseRoot: process.cwd(),
        target: Object.freeze({
          ...D2E4D_TARGET,
          projectName: DISC_INT_03_PROJECT_ID,
          gitBranch: DISC_INT_03_GIT_BRANCH,
        }),
        mode: "APPLY",
        controlProofDigest,
      });

    const deployment =
      await livePreviewAdapter.deployOnce();

    if (
      typeof deployment?.deploymentId !== "string" ||
      !deployment.deploymentId.trim() ||
      typeof deployment?.previewUrl !== "string" ||
      !deployment.previewUrl.trim()
    ) {
      throw new Error("D2E4X_PREVIEW_DEPLOYMENT_IDENTITY_REJECTED");
    }

    const vercelExecutable =
      process.platform === "win32" ? "vercel.cmd" : "vercel";

    await liveCommandExecutor.execute(
      vercelExecutable,
      [
        "alias",
        "set",
        deployment.previewUrl,
        new URL(DISC_INT_03_CANONICAL_PREVIEW_URL).hostname,
      ],
      { cwd: process.cwd() },
    );

    const previewTarget =
      Object.freeze({
        deploymentId: deployment.deploymentId,
        deploymentUrl: deployment.previewUrl,
        previewUrl: DISC_INT_03_CANONICAL_PREVIEW_URL,
        projectId: DISC_INT_03_PROJECT_ID,
        gitBranch: DISC_INT_03_GIT_BRANCH,
      });
    const authorityFactory = createFirestorePreviewAuthorityFactoryV1({
      db,
      linkId: syntheticPolicy.linkId,
      sessionId: syntheticPolicy.sessionId,
    });
    const rotationRepository =
      new FirestoreSyntheticCapabilityRotationRepositoryV1({ db });
    const policyRepository =
      new FirestoreAdaptiveCanaryPolicyRepositoryV1({ db });
    const adaptiveCanaryControlPlane =
      new FirestoreAdaptiveCanaryControlPlaneV1({ db });
    const deploymentReadBack = new ExistingPreviewDeploymentReadBackAdapterV1({
      releaseRoot: process.cwd(),
      previewTarget,
    });
    const browserExecutablePath =
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
    const authoritativeTenantLocator = syntheticPolicy.tenantId;

    if (syntheticPolicy?.environment !== "PREVIEW" ||
        typeof syntheticPolicy?.tenantId !== "string" || !syntheticPolicy.tenantId ||
        typeof syntheticPolicy?.fixtureLocator !== "string" ||
        !syntheticPolicy.fixtureLocator ||
        typeof syntheticPolicy?.linkId !== "string" || !syntheticPolicy.linkId ||
        typeof syntheticPolicy?.sessionId !== "string" || !syntheticPolicy.sessionId) {
      throw new Error("D2E4X_R17B_SYNTHETIC_POLICY_REJECTED");
    }

    handle = await createOperationalD2E4JPreviewCeremonyCompositionV1({
      browserProofCustody: proofCustody,
      environment: "PREVIEW",
      previewTarget,
      releaseRoot: process.cwd(),
      approver: "preview-canary-control-plane",
      authoritativeTenantLocator,
      changeId: "AI_UX_02D2E4_FINAL_CHANGE_0001",
      operationId: "AI_UX_02D2E4_FINAL_OPERATION_0001",
      policyVersion: POLICY_VERSION,
      reasonCode: "AI_UX_02D2E4_FINAL_CEREMONY",
      authoritativeTenantId: syntheticPolicy.tenantId,
      syntheticFixtureLocator: syntheticPolicy.fixtureLocator,
      intentClass: "DISCOVER_PROBLEM",
      now: Date.now(),
      turnId: TURN_ID,
      traceId: randomUUID(),
      authorityFactory,
      assertCertifiedAuthority: assertCertifiedPreviewAuthorityV1,
      rotationRepository,
      policyRepository,
      adaptiveCanaryControlPlane,
      deploymentReadBack,
      rotatorClass: LiveSyntheticCapabilityRotatorV1,
      browserExecutablePath,
    });

    if (handle?.environment !== "PREVIEW")
      throw new Error("D2E4X_R17B_HANDLE_ENVIRONMENT_REJECTED");

    const result = await handle.executeOnce();
    const certified = certifyLauncherExecutionResultV1(result);
    console.log(JSON.stringify(certified.presentation, null, 2));
    return certified.result;
  } finally {
    if (handle && typeof handle.destroy === "function") await handle.destroy();
    proofCustody.destroy();
    await app.delete();
  }
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : null;
if (invokedPath === import.meta.url) {
  await runFinalLiveCeremonyLauncherV1();
}
