import { createHash } from "node:crypto";

import {
  assertBrowserProofResultV1 as assertExecutionBrowserProofResultV1,
  createRuntimeErrorV1,
  deepFreezeExecutionContractV1,
} from "./ai-ux-02d2e4x-execution-receipt-contract-v1.mjs";

export const DEPLOYMENT_READINESS_CONTRACT_NAME_V1 =
  "DeploymentReadinessReceiptV1";
export const BROWSER_PROOF_RESULT_NAME_V1 = "BrowserProofResultV1";
export const DEPLOYMENT_ARTIFACT_MANIFEST_FORMAT_V1 =
  "AI_UX_02D2E4X_DEPLOYMENT_ARTIFACT_MANIFEST_V1";
export const DEPLOYMENT_CERTIFICATION_SIDECAR_PATH_V1 =
  ".well-known/ai-ux-02d2e4x-deployment-certification-v1.json";
export const DEPLOYMENT_READINESS_TTL_MS_V1 = 300_000;

export const DEPLOYMENT_READINESS_FIELDS_V1 = Object.freeze([
  "contractName", "contractVersion", "receiptId", "status", "environment",
  "projectId", "deploymentId", "deploymentRevision", "deploymentArtifactDigest",
  "controlProofDigest", "previewUrl", "deploymentType", "readyState",
  "reusedExistingPreview", "deploymentInvocations", "productionChanged",
  "stagingChanged", "readBackSource", "certifiedAtMs", "expiresAtMs",
]);

export const BROWSER_PROOF_RESULT_FIELDS_V1 = Object.freeze([
  "status", "deploymentId", "deploymentArtifactDigest",
  "expectedControlProofDigest", "observedControlProofDigest", "verifiedAtMs",
]);

const MANIFEST_FIELDS = Object.freeze([
  "format", "projectId", "controlProofDigest", "files",
]);
const SIDECAR_FIELDS = Object.freeze([
  ...MANIFEST_FIELDS, "deploymentArtifactDigest",
]);
const FILE_FIELDS = Object.freeze(["path", "byteLength", "sha256"]);
const IDENTIFIER = /^[^\u0000-\u001f\u007f]{1,256}$/u;
const SHA256 = /^[0-9a-f]{64}$/u;
const SAFE_PATH = /^(?!\/)(?!.*(?:^|\/)\.{1,2}(?:\/|$))(?!.*\\)[^\u0000-\u001f\u007f]+$/u;

export class BrowserProofDeploymentContractErrorV1 extends Error {
  constructor(code) {
    super(code);
    this.name = "BrowserProofDeploymentContractErrorV1";
    this.code = code;
  }
}

function fail(code) {
  throw new BrowserProofDeploymentContractErrorV1(code);
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactKeys(value, expected, code) {
  if (!isPlainObject(value)) fail(code);
  const actual = Object.keys(value).sort();
  const required = [...expected].sort();
  if (actual.length !== required.length ||
      actual.some((key, index) => key !== required[index])) fail(code);
}

function identifier(value, code) {
  if (typeof value !== "string" || value !== value.trim() || !IDENTIFIER.test(value)) {
    fail(code);
  }
}

function digest(value, code) {
  if (typeof value !== "string" || !SHA256.test(value)) fail(code);
}

function timestamp(value, code) {
  if (!Number.isSafeInteger(value) || value < 0) fail(code);
}

function httpsUrl(value, code) {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password ||
        parsed.hash) fail(code);
  } catch {
    fail(code);
  }
}

function canonicalize(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) =>
    `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`;
}

function validateManifestFile(file, previousPath) {
  exactKeys(file, FILE_FIELDS, "DEPLOYMENT_ARTIFACT_FILE_SHAPE_REJECTED");
  if (typeof file.path !== "string" || file.path !== file.path.normalize("NFC") ||
      !SAFE_PATH.test(file.path) ||
      file.path === DEPLOYMENT_CERTIFICATION_SIDECAR_PATH_V1 ||
      (previousPath !== null && previousPath >= file.path)) {
    fail("DEPLOYMENT_ARTIFACT_FILE_PATH_REJECTED");
  }
  if (!Number.isSafeInteger(file.byteLength) || file.byteLength < 0) {
    fail("DEPLOYMENT_ARTIFACT_FILE_LENGTH_REJECTED");
  }
  digest(file.sha256, "DEPLOYMENT_ARTIFACT_FILE_DIGEST_REJECTED");
}

export function hashBrowserControlProofV1(controlProof) {
  if (typeof controlProof !== "string" ||
      !/^[A-Za-z0-9_-]{32,512}$/u.test(controlProof)) {
    fail("BROWSER_CONTROL_PROOF_REJECTED");
  }
  return createHash("sha256").update(controlProof, "utf8").digest("hex");
}

export function sha256BytesV1(bytes) {
  if (!(bytes instanceof Uint8Array)) fail("DEPLOYMENT_ARTIFACT_BYTES_REJECTED");
  return createHash("sha256").update(bytes).digest("hex");
}

export function createDeploymentArtifactManifestV1(input) {
  const manifest = {
    format: input?.format ?? DEPLOYMENT_ARTIFACT_MANIFEST_FORMAT_V1,
    projectId: input?.projectId,
    controlProofDigest: input?.controlProofDigest,
    files: input?.files,
  };
  return assertDeploymentArtifactManifestV1(
    deepFreezeExecutionContractV1(manifest),
  );
}

export function assertDeploymentArtifactManifestV1(manifest) {
  exactKeys(manifest, MANIFEST_FIELDS, "DEPLOYMENT_ARTIFACT_MANIFEST_SHAPE_REJECTED");
  if (manifest.format !== DEPLOYMENT_ARTIFACT_MANIFEST_FORMAT_V1) {
    fail("DEPLOYMENT_ARTIFACT_MANIFEST_IDENTITY_REJECTED");
  }
  identifier(manifest.projectId, "DEPLOYMENT_ARTIFACT_PROJECT_REJECTED");
  digest(manifest.controlProofDigest, "DEPLOYMENT_ARTIFACT_PROOF_DIGEST_REJECTED");
  if (!Array.isArray(manifest.files) || manifest.files.length === 0) {
    fail("DEPLOYMENT_ARTIFACT_FILES_REJECTED");
  }
  let previousPath = null;
  const foldedPaths = new Set();
  for (const file of manifest.files) {
    validateManifestFile(file, previousPath);
    const folded = file.path.toLocaleLowerCase("en-US");
    if (foldedPaths.has(folded)) fail("DEPLOYMENT_ARTIFACT_FILE_COLLISION_REJECTED");
    foldedPaths.add(folded);
    previousPath = file.path;
  }
  return manifest;
}

export function calculateDeploymentArtifactDigestV1(manifest) {
  assertDeploymentArtifactManifestV1(manifest);
  return createHash("sha256")
    .update(canonicalize(manifest), "utf8")
    .digest("hex");
}

export function createDeploymentCertificationSidecarV1(manifest) {
  const certified = assertDeploymentArtifactManifestV1(manifest);
  return deepFreezeExecutionContractV1({
    ...certified,
    deploymentArtifactDigest: calculateDeploymentArtifactDigestV1(certified),
  });
}

export function assertDeploymentCertificationSidecarV1(sidecar) {
  exactKeys(sidecar, SIDECAR_FIELDS, "DEPLOYMENT_CERTIFICATION_SIDECAR_SHAPE_REJECTED");
  const manifest = {
    format: sidecar.format,
    projectId: sidecar.projectId,
    controlProofDigest: sidecar.controlProofDigest,
    files: sidecar.files,
  };
  assertDeploymentArtifactManifestV1(manifest);
  digest(sidecar.deploymentArtifactDigest,
    "DEPLOYMENT_CERTIFICATION_SIDECAR_DIGEST_REJECTED");
  if (calculateDeploymentArtifactDigestV1(manifest) !== sidecar.deploymentArtifactDigest) {
    fail("DEPLOYMENT_CERTIFICATION_SIDECAR_DIGEST_REJECTED");
  }
  return sidecar;
}

export function assertDeploymentReadinessReceiptV1(receipt, { now } = {}) {
  exactKeys(receipt, DEPLOYMENT_READINESS_FIELDS_V1,
    "DEPLOYMENT_READINESS_SHAPE_REJECTED");
  if (receipt.contractName !== DEPLOYMENT_READINESS_CONTRACT_NAME_V1 ||
      receipt.contractVersion !== "V1" || receipt.status !== "READY" ||
      receipt.environment !== "PREVIEW" || receipt.deploymentType !== "Preview" ||
      receipt.readyState !== "READY" || receipt.reusedExistingPreview !== true ||
      receipt.deploymentInvocations !== 0 || receipt.productionChanged !== false ||
      receipt.stagingChanged !== false || receipt.readBackSource !== "VERCEL_INSPECT") {
    fail("DEPLOYMENT_READINESS_IDENTITY_REJECTED");
  }
  for (const key of ["receiptId", "projectId", "deploymentId", "deploymentRevision"])
    identifier(receipt[key], "DEPLOYMENT_READINESS_FIELD_REJECTED");
  digest(receipt.deploymentArtifactDigest, "DEPLOYMENT_READINESS_DIGEST_REJECTED");
  digest(receipt.controlProofDigest, "DEPLOYMENT_READINESS_DIGEST_REJECTED");
  httpsUrl(receipt.previewUrl, "DEPLOYMENT_READINESS_URL_REJECTED");
  timestamp(receipt.certifiedAtMs, "DEPLOYMENT_READINESS_TIME_REJECTED");
  timestamp(receipt.expiresAtMs, "DEPLOYMENT_READINESS_TIME_REJECTED");
  if (receipt.certifiedAtMs >= receipt.expiresAtMs ||
      (now !== undefined && (!Number.isSafeInteger(now) || now >= receipt.expiresAtMs))) {
    fail("DEPLOYMENT_READINESS_EXPIRED");
  }
  if (!Object.isFrozen(receipt)) fail("DEPLOYMENT_READINESS_MUTABLE_REJECTED");
  return receipt;
}

export function createDeploymentReadinessReceiptV1(input, options = {}) {
  return assertDeploymentReadinessReceiptV1(deepFreezeExecutionContractV1({
    contractName: DEPLOYMENT_READINESS_CONTRACT_NAME_V1,
    contractVersion: "V1",
    ...input,
  }), options);
}

export function createBrowserProofResultV1(input, deployment, completedAtMs) {
  const result = deepFreezeExecutionContractV1(input);
  assertExecutionBrowserProofResultV1(result, deployment, completedAtMs);
  if ((result.status === "VERIFIED") !==
      (result.expectedControlProofDigest === result.observedControlProofDigest)) {
    fail("BROWSER_PROOF_RESULT_STATUS_REJECTED");
  }
  if (!Object.isFrozen(result)) fail("BROWSER_PROOF_RESULT_MUTABLE_REJECTED");
  return result;
}

export function createBoundaryRuntimeErrorV1({
  code,
  stage,
  producer,
  traceId,
  occurredAtMs,
  errorId,
  cause = null,
  retryable = false,
  partialSideEffects = false,
  details = {},
}) {
  return createRuntimeErrorV1({
    errorId,
    code,
    stage,
    producer,
    severity: partialSideEffects ? "PARTIAL_FAILURE" : "BLOCKING",
    message: code,
    cause,
    retryable,
    partialSideEffects,
    details,
    traceId,
    occurredAtMs,
  });
}
