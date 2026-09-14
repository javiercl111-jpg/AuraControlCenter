import { createHash } from "node:crypto";

export const AI_UX_02D2E4X_EXECUTION_RECEIPT_V1 =
  "AI_UX_02D2E4X_EXECUTION_RECEIPT_V1";
export const EXECUTION_RESULT_CONTRACT_NAME = "ExecutionResultV1";
export const RUNTIME_ERROR_CONTRACT_NAME = "RuntimeErrorV1";
export const RUNTIME_CONTRACT_VERSION = "V1";

const IDENTIFIER = /^[^\u0000-\u001f\u007f]{1,256}$/u;
const SHA256 = /^[0-9a-f]{64}$/u;
const EXECUTION_STATUSES = new Set([
  "SUCCESS", "BLOCKED", "FAILED", "FAILED_PARTIAL",
]);
const EXECUTION_STATES = new Set([
  "CREATED",
  "ARTIFACT_VALIDATED",
  "PREVIEW_READY_REUSED",
  "ACTIVE_POLICY_VERIFIED",
  "CAPABILITY_ROTATED",
  "BROWSER_READY",
  "BROWSER_PROOF_VERIFIED",
  "TURN_EXECUTED",
  "CLEANUP_STARTED",
  "CLEANUP_COMPLETED",
  "TERMINATED_SUCCESS",
  "TERMINATED_BLOCKED",
  "TERMINATED_FAILED",
  "TERMINATED_FAILED_PARTIAL",
]);
const TERMINAL_STATE = Object.freeze({
  SUCCESS: "TERMINATED_SUCCESS",
  BLOCKED: "TERMINATED_BLOCKED",
  FAILED: "TERMINATED_FAILED",
  FAILED_PARTIAL: "TERMINATED_FAILED_PARTIAL",
});
const ERROR_STAGES = new Set([
  "CONFIGURATION", "AUTHORITY", "POLICY", "ROTATION", "COMPOSITION",
  "DEPLOYMENT", "BROWSER_PROOF", "TURN", "CLEANUP",
  "TERMINAL_VALIDATION",
]);
const ERROR_SEVERITIES = new Set([
  "BLOCKING", "FAILURE", "PARTIAL_FAILURE",
]);
const EFFECT_TYPES = new Set(["CAPABILITY_ROTATION", "BROWSER_TURN"]);
const EFFECT_OUTCOMES = new Set([
  "NOT_APPLIED", "APPLIED", "REJECTED", "UNKNOWN", "COMPENSATED",
]);
const RECOVERY_STATES = new Set(["NONE", "PENDING", "IN_PROGRESS", "COMPLETE"]);

const EXECUTION_KEYS = Object.freeze([
  "contractName", "contractVersion", "receiptId", "operationId", "changeId",
  "traceId", "artifactId", "artifactDigest", "environment",
  "authoritativeBinding", "policyCertification", "deploymentCertification",
  "status", "lifecycle", "errors", "sideEffects", "recovery",
  "browserProof", "turnReceipt", "startedAtMs", "completedAtMs",
]);
const RUNTIME_ERROR_KEYS = Object.freeze([
  "contractName", "contractVersion", "errorId", "code", "stage", "producer",
  "severity", "message", "cause", "retryable", "partialSideEffects",
  "details", "traceId", "occurredAtMs",
]);
const COMPOSITION_KEYS = Object.freeze([
  "contractName", "contractVersion", "artifactId", "artifactDigest", "status",
  "environment", "projectId", "authority", "policy", "rotationExpectation",
  "deployment", "replayReadiness", "adapterAttestations", "allowedMutations",
  "createdAtMs", "expiresAtMs",
]);

export class ExecutionReceiptContractError extends Error {
  constructor(code) {
    super(code);
    this.name = "ExecutionReceiptContractError";
    this.code = code;
  }
}

function fail(code) {
  throw new ExecutionReceiptContractError(code);
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactKeys(value, expected, code) {
  if (!isPlainObject(value)) fail(code);
  const actual = Object.keys(value).sort();
  const frozen = [...expected].sort();
  if (actual.length !== frozen.length ||
      actual.some((key, index) => key !== frozen[index])) {
    fail(code);
  }
}

function assertIdentifier(value, code) {
  if (typeof value !== "string" || value !== value.trim() ||
      !IDENTIFIER.test(value)) fail(code);
}

function assertDigest(value, code) {
  if (typeof value !== "string" || !SHA256.test(value)) fail(code);
}

function assertTimestamp(value, code) {
  if (!Number.isSafeInteger(value) || value < 0) fail(code);
}

function assertSafeInteger(value, code) {
  assertTimestamp(value, code);
}

function assertHttpsUrl(value, code) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.hash) {
      fail(code);
    }
  } catch {
    fail(code);
  }
}

function assertStringArray(value, { empty = false, sorted = false, code }) {
  if (!Array.isArray(value) || (!empty && value.length === 0)) fail(code);
  for (const item of value) assertIdentifier(item, code);
  if (new Set(value).size !== value.length) fail(code);
  if (sorted && value.some((item, index) => index > 0 && value[index - 1] > item)) {
    fail(code);
  }
}

export function deepFreezeExecutionContractV1(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreezeExecutionContractV1(child);
  return Object.freeze(value);
}

function assertDeepFrozen(value, code, seen = new Set()) {
  if (!value || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  if (!Object.isFrozen(value)) fail(code);
  for (const child of Object.values(value)) assertDeepFrozen(child, code, seen);
}

function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (isPlainObject(value)) {
    return `{${Object.keys(value).sort().map((key) =>
      `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function calculateCompositionArtifactDigestV1(artifact) {
  if (!isPlainObject(artifact)) fail("EXECUTION_ARTIFACT_OBJECT_REJECTED");
  const { artifactDigest: _omitted, ...digestable } = artifact;
  return createHash("sha256").update(canonicalize(digestable), "utf8").digest("hex");
}

function assertNoSecretsOrInvalidJson(value, code, depth = 0, seen = new Set()) {
  if (depth > 8 || value === undefined || typeof value === "function" ||
      typeof value === "symbol" || typeof value === "bigint" ||
      (typeof value === "number" && !Number.isFinite(value))) fail(code);
  if (value === null || typeof value === "string" ||
      typeof value === "boolean" || typeof value === "number") return;
  if (typeof value !== "object" || seen.has(value)) fail(code);
  seen.add(value);
  if (!Array.isArray(value) && !isPlainObject(value)) fail(code);
  for (const [key, child] of Object.entries(value)) {
    if (/bearer|credential|private.?key|raw.?proof/iu.test(key) || /^token$/iu.test(key)) {
      fail(code);
    }
    assertNoSecretsOrInvalidJson(child, code, depth + 1, seen);
  }
}

function assertAuthorityReceipt(authority) {
  exactKeys(authority, [
    "contractName", "contractVersion", "receiptId", "status", "environment",
    "projectId", "authoritativeTenantId", "authoritativeTenantLocator",
    "syntheticFixtureLocator", "linkId", "sessionId", "turnId", "intentClass",
    "evidenceDigest", "certifiedAtMs", "expiresAtMs",
  ], "EXECUTION_ARTIFACT_AUTHORITY_SHAPE_REJECTED");
  if (authority.contractName !== "AuthorityReceiptV1" ||
      authority.contractVersion !== "V1" || authority.status !== "CERTIFIED" ||
      authority.environment !== "PREVIEW") fail("EXECUTION_ARTIFACT_AUTHORITY_REJECTED");
  for (const key of [
    "receiptId", "projectId", "authoritativeTenantId", "authoritativeTenantLocator",
    "syntheticFixtureLocator", "linkId", "sessionId", "turnId",
  ]) assertIdentifier(authority[key], "EXECUTION_ARTIFACT_AUTHORITY_REJECTED");
  if (authority.authoritativeTenantLocator !== authority.authoritativeTenantId ||
      !new Set(["CLARIFICATION", "DISCOVER_PROBLEM"]).has(authority.intentClass)) {
    fail("EXECUTION_ARTIFACT_AUTHORITY_REJECTED");
  }
  assertDigest(authority.evidenceDigest, "EXECUTION_ARTIFACT_AUTHORITY_REJECTED");
  assertTimestamp(authority.certifiedAtMs, "EXECUTION_ARTIFACT_AUTHORITY_REJECTED");
  assertTimestamp(authority.expiresAtMs, "EXECUTION_ARTIFACT_AUTHORITY_REJECTED");
  if (authority.certifiedAtMs >= authority.expiresAtMs) {
    fail("EXECUTION_ARTIFACT_AUTHORITY_REJECTED");
  }
}

function assertPolicyReceipt(policy, authority) {
  exactKeys(policy, [
    "contractName", "contractVersion", "receiptId", "status", "environment",
    "projectId", "authoritativeTenantId", "authoritativeTenantLocator",
    "policyVersion", "activePointerVersion", "policyArtifactDigest",
    "activationAuditId", "mode", "enabled", "killSwitchState",
    "allowedSyntheticFixtureLocators", "allowedIntentClasses", "activatedAtMs",
    "expiresAtMs", "certifiedAtMs",
  ], "EXECUTION_ARTIFACT_POLICY_SHAPE_REJECTED");
  if (policy.contractName !== "PolicyReadinessReceiptV1" ||
      policy.contractVersion !== "V1" || policy.status !== "ACTIVE" ||
      policy.environment !== "PREVIEW" || policy.mode !== "CANARY" ||
      policy.enabled !== true) fail("EXECUTION_ARTIFACT_POLICY_REJECTED");
  for (const key of [
    "receiptId", "projectId", "authoritativeTenantId", "authoritativeTenantLocator",
    "policyVersion", "activePointerVersion", "activationAuditId",
  ]) assertIdentifier(policy[key], "EXECUTION_ARTIFACT_POLICY_REJECTED");
  assertDigest(policy.policyArtifactDigest, "EXECUTION_ARTIFACT_POLICY_REJECTED");
  exactKeys(policy.killSwitchState, ["state", "revision"],
    "EXECUTION_ARTIFACT_POLICY_REJECTED");
  if (policy.killSwitchState.state !== "OFF") fail("EXECUTION_ARTIFACT_POLICY_REJECTED");
  assertIdentifier(policy.killSwitchState.revision, "EXECUTION_ARTIFACT_POLICY_REJECTED");
  assertStringArray(policy.allowedSyntheticFixtureLocators,
    { sorted: true, code: "EXECUTION_ARTIFACT_POLICY_REJECTED" });
  assertStringArray(policy.allowedIntentClasses,
    { sorted: true, code: "EXECUTION_ARTIFACT_POLICY_REJECTED" });
  for (const key of ["activatedAtMs", "certifiedAtMs", "expiresAtMs"])
    assertTimestamp(policy[key], "EXECUTION_ARTIFACT_POLICY_REJECTED");
  if (policy.activatedAtMs > policy.certifiedAtMs ||
      policy.certifiedAtMs >= policy.expiresAtMs ||
      policy.projectId !== authority.projectId ||
      policy.authoritativeTenantId !== authority.authoritativeTenantId ||
      policy.authoritativeTenantLocator !== authority.authoritativeTenantLocator ||
      !policy.allowedSyntheticFixtureLocators.includes(authority.syntheticFixtureLocator) ||
      !policy.allowedIntentClasses.includes(authority.intentClass)) {
    fail("EXECUTION_ARTIFACT_POLICY_REJECTED");
  }
}

function assertRotationExpectation(rotation, authority, policy) {
  exactKeys(rotation, [
    "contractName", "contractVersion", "expectationId", "status", "environment",
    "projectId", "authoritativeTenantId", "syntheticFixtureLocator", "linkId",
    "sessionId", "policyVersion", "capabilityLocator", "expectedGeneration",
    "expectedTokenHash", "expectedUpdatedAtMs", "expectedExpiresAtMs",
    "expectedConsumedAtMs", "nextGeneration", "expectationDigest",
    "certifiedAtMs", "expiresAtMs",
  ], "EXECUTION_ARTIFACT_ROTATION_SHAPE_REJECTED");
  if (rotation.contractName !== "RotationExpectationV1" ||
      rotation.contractVersion !== "V1" || rotation.status !== "ROTATION_READY" ||
      rotation.environment !== "PREVIEW") fail("EXECUTION_ARTIFACT_ROTATION_REJECTED");
  for (const key of [
    "expectationId", "projectId", "authoritativeTenantId",
    "syntheticFixtureLocator", "linkId", "sessionId", "policyVersion",
    "capabilityLocator",
  ]) assertIdentifier(rotation[key], "EXECUTION_ARTIFACT_ROTATION_REJECTED");
  for (const key of [
    "expectedGeneration", "expectedUpdatedAtMs", "expectedExpiresAtMs",
    "nextGeneration", "certifiedAtMs", "expiresAtMs",
  ]) assertTimestamp(rotation[key], "EXECUTION_ARTIFACT_ROTATION_REJECTED");
  if (rotation.expectedConsumedAtMs !== null)
    assertTimestamp(rotation.expectedConsumedAtMs, "EXECUTION_ARTIFACT_ROTATION_REJECTED");
  assertDigest(rotation.expectedTokenHash, "EXECUTION_ARTIFACT_ROTATION_REJECTED");
  assertDigest(rotation.expectationDigest, "EXECUTION_ARTIFACT_ROTATION_REJECTED");
  if (rotation.nextGeneration !== rotation.expectedGeneration + 1 ||
      rotation.expectedExpiresAtMs > rotation.certifiedAtMs ||
      rotation.certifiedAtMs >= rotation.expiresAtMs ||
      rotation.projectId !== authority.projectId ||
      rotation.authoritativeTenantId !== authority.authoritativeTenantId ||
      rotation.syntheticFixtureLocator !== authority.syntheticFixtureLocator ||
      rotation.linkId !== authority.linkId || rotation.sessionId !== authority.sessionId ||
      rotation.policyVersion !== policy.policyVersion) {
    fail("EXECUTION_ARTIFACT_ROTATION_REJECTED");
  }
}

function assertDeploymentReceipt(deployment, projectId) {
  exactKeys(deployment, [
    "contractName", "contractVersion", "receiptId", "status", "environment",
    "projectId", "deploymentId", "deploymentRevision", "deploymentArtifactDigest",
    "controlProofDigest", "previewUrl", "deploymentType", "readyState",
    "reusedExistingPreview", "deploymentInvocations", "productionChanged",
    "stagingChanged", "readBackSource", "certifiedAtMs", "expiresAtMs",
  ], "EXECUTION_ARTIFACT_DEPLOYMENT_SHAPE_REJECTED");
  if (deployment.contractName !== "DeploymentReadinessReceiptV1" ||
      deployment.contractVersion !== "V1" || deployment.status !== "READY" ||
      deployment.environment !== "PREVIEW" || deployment.projectId !== projectId ||
      deployment.deploymentType !== "Preview" || deployment.readyState !== "READY" ||
      deployment.reusedExistingPreview !== true || deployment.deploymentInvocations !== 0 ||
      deployment.productionChanged !== false || deployment.stagingChanged !== false ||
      deployment.readBackSource !== "VERCEL_INSPECT") {
    fail("EXECUTION_ARTIFACT_DEPLOYMENT_REJECTED");
  }
  for (const key of ["receiptId", "projectId", "deploymentId", "deploymentRevision"])
    assertIdentifier(deployment[key], "EXECUTION_ARTIFACT_DEPLOYMENT_REJECTED");
  assertDigest(deployment.deploymentArtifactDigest, "EXECUTION_ARTIFACT_DEPLOYMENT_REJECTED");
  assertDigest(deployment.controlProofDigest, "EXECUTION_ARTIFACT_DEPLOYMENT_REJECTED");
  assertHttpsUrl(deployment.previewUrl, "EXECUTION_ARTIFACT_DEPLOYMENT_REJECTED");
  assertTimestamp(deployment.certifiedAtMs, "EXECUTION_ARTIFACT_DEPLOYMENT_REJECTED");
  assertTimestamp(deployment.expiresAtMs, "EXECUTION_ARTIFACT_DEPLOYMENT_REJECTED");
  if (deployment.certifiedAtMs >= deployment.expiresAtMs)
    fail("EXECUTION_ARTIFACT_DEPLOYMENT_REJECTED");
}

function assertReplayReadiness(replay, authority) {
  exactKeys(replay, [
    "readinessBasis", "replayPersistenceClaimed", "externalReplayArtifactAccepted",
    "environment", "authoritativeTenantId", "syntheticFixtureLocator", "linkId",
    "sessionId", "turnId", "certifiedAtMs",
  ], "EXECUTION_ARTIFACT_REPLAY_REJECTED");
  if (replay.readinessBasis !== "CERTIFIED_SINGLE_TURN_BINDING" ||
      replay.replayPersistenceClaimed !== false ||
      replay.externalReplayArtifactAccepted !== false || replay.environment !== "PREVIEW" ||
      replay.authoritativeTenantId !== authority.authoritativeTenantId ||
      replay.syntheticFixtureLocator !== authority.syntheticFixtureLocator ||
      replay.linkId !== authority.linkId || replay.sessionId !== authority.sessionId ||
      replay.turnId !== authority.turnId) fail("EXECUTION_ARTIFACT_REPLAY_REJECTED");
  assertTimestamp(replay.certifiedAtMs, "EXECUTION_ARTIFACT_REPLAY_REJECTED");
}

function assertAdapterAttestations(attestations, projectId) {
  if (!Array.isArray(attestations) || attestations.length === 0) {
    fail("EXECUTION_ARTIFACT_ATTESTATIONS_REJECTED");
  }
  let previous = null;
  for (const attestation of attestations) {
    exactKeys(attestation, [
      "attestationContractVersion", "adapterId", "implementationId",
      "implementationVersion", "capabilities", "environment", "projectId",
      "artifactDigest", "attestedAtMs",
    ], "EXECUTION_ARTIFACT_ATTESTATION_SHAPE_REJECTED");
    if (attestation.attestationContractVersion !== "V1" ||
        attestation.environment !== "PREVIEW" || attestation.projectId !== projectId) {
      fail("EXECUTION_ARTIFACT_ATTESTATION_REJECTED");
    }
    for (const key of ["adapterId", "implementationId", "implementationVersion"])
      assertIdentifier(attestation[key], "EXECUTION_ARTIFACT_ATTESTATION_REJECTED");
    assertStringArray(attestation.capabilities,
      { sorted: true, code: "EXECUTION_ARTIFACT_ATTESTATION_REJECTED" });
    assertDigest(attestation.artifactDigest, "EXECUTION_ARTIFACT_ATTESTATION_REJECTED");
    assertTimestamp(attestation.attestedAtMs, "EXECUTION_ARTIFACT_ATTESTATION_REJECTED");
    if (previous !== null && previous >= attestation.adapterId)
      fail("EXECUTION_ARTIFACT_ATTESTATION_REJECTED");
    previous = attestation.adapterId;
  }
}

export function assertExecutionCompositionArtifactV1(artifact, { now } = {}) {
  exactKeys(artifact, COMPOSITION_KEYS, "EXECUTION_ARTIFACT_SHAPE_REJECTED");
  if (artifact.contractName !== "CompositionArtifactV1" ||
      artifact.contractVersion !== "V1" || artifact.status !== "READY" ||
      artifact.environment !== "PREVIEW") fail("EXECUTION_ARTIFACT_IDENTITY_REJECTED");
  assertIdentifier(artifact.artifactId, "EXECUTION_ARTIFACT_IDENTITY_REJECTED");
  assertDigest(artifact.artifactDigest, "EXECUTION_ARTIFACT_DIGEST_REJECTED");
  assertIdentifier(artifact.projectId, "EXECUTION_ARTIFACT_PROJECT_REJECTED");
  assertTimestamp(artifact.createdAtMs, "EXECUTION_ARTIFACT_TIME_REJECTED");
  assertTimestamp(artifact.expiresAtMs, "EXECUTION_ARTIFACT_TIME_REJECTED");
  if (artifact.createdAtMs >= artifact.expiresAtMs ||
      (now !== undefined && (!Number.isSafeInteger(now) || now >= artifact.expiresAtMs))) {
    fail("EXECUTION_ARTIFACT_EXPIRED");
  }
  assertAuthorityReceipt(artifact.authority);
  assertPolicyReceipt(artifact.policy, artifact.authority);
  assertRotationExpectation(artifact.rotationExpectation, artifact.authority, artifact.policy);
  assertDeploymentReceipt(artifact.deployment, artifact.projectId);
  assertReplayReadiness(artifact.replayReadiness, artifact.authority);
  assertAdapterAttestations(artifact.adapterAttestations, artifact.projectId);
  if (artifact.projectId !== artifact.authority.projectId ||
      artifact.createdAtMs < Math.max(
        artifact.authority.certifiedAtMs,
        artifact.policy.certifiedAtMs,
        artifact.rotationExpectation.certifiedAtMs,
        artifact.deployment.certifiedAtMs,
        artifact.replayReadiness.certifiedAtMs,
        ...artifact.adapterAttestations.map(({ attestedAtMs }) => attestedAtMs),
      ) || artifact.expiresAtMs > Math.min(
        artifact.authority.expiresAtMs,
        artifact.policy.expiresAtMs,
        artifact.rotationExpectation.expiresAtMs,
        artifact.deployment.expiresAtMs,
      ) || !Array.isArray(artifact.allowedMutations) ||
      artifact.allowedMutations.length !== 2 ||
      artifact.allowedMutations[0] !== "CAPABILITY_ROTATION" ||
      artifact.allowedMutations[1] !== "BROWSER_TURN" ||
      calculateCompositionArtifactDigestV1(artifact) !== artifact.artifactDigest) {
    fail("EXECUTION_ARTIFACT_INVARIANT_REJECTED");
  }
  assertDeepFrozen(artifact, "EXECUTION_ARTIFACT_MUTABLE_REJECTED");
  return artifact;
}

function assertAuthoritativeBinding(binding) {
  exactKeys(binding, [
    "authoritativeTenantId", "authoritativeTenantLocator", "syntheticFixtureLocator",
    "linkId", "sessionId", "turnId", "intentClass",
  ], "EXECUTION_RESULT_AUTHORITY_BINDING_REJECTED");
  for (const key of [
    "authoritativeTenantId", "authoritativeTenantLocator", "syntheticFixtureLocator",
    "linkId", "sessionId", "turnId",
  ]) assertIdentifier(binding[key], "EXECUTION_RESULT_AUTHORITY_BINDING_REJECTED");
  if (!new Set(["CLARIFICATION", "DISCOVER_PROBLEM"]).has(binding.intentClass))
    fail("EXECUTION_RESULT_AUTHORITY_BINDING_REJECTED");
}

function assertPolicyCertification(certification) {
  exactKeys(certification, [
    "policyVersion", "activePointerVersion", "policyArtifactDigest", "activationAuditId",
  ], "EXECUTION_RESULT_POLICY_CERTIFICATION_REJECTED");
  for (const key of ["policyVersion", "activePointerVersion", "activationAuditId"])
    assertIdentifier(certification[key], "EXECUTION_RESULT_POLICY_CERTIFICATION_REJECTED");
  assertDigest(certification.policyArtifactDigest,
    "EXECUTION_RESULT_POLICY_CERTIFICATION_REJECTED");
}

function assertDeploymentCertification(certification) {
  exactKeys(certification, [
    "deploymentId", "deploymentRevision", "deploymentArtifactDigest",
    "controlProofDigest", "previewUrl",
  ], "EXECUTION_RESULT_DEPLOYMENT_CERTIFICATION_REJECTED");
  assertIdentifier(certification.deploymentId,
    "EXECUTION_RESULT_DEPLOYMENT_CERTIFICATION_REJECTED");
  assertIdentifier(certification.deploymentRevision,
    "EXECUTION_RESULT_DEPLOYMENT_CERTIFICATION_REJECTED");
  assertDigest(certification.deploymentArtifactDigest,
    "EXECUTION_RESULT_DEPLOYMENT_CERTIFICATION_REJECTED");
  assertDigest(certification.controlProofDigest,
    "EXECUTION_RESULT_DEPLOYMENT_CERTIFICATION_REJECTED");
  assertHttpsUrl(certification.previewUrl,
    "EXECUTION_RESULT_DEPLOYMENT_CERTIFICATION_REJECTED");
}

export function assertRuntimeErrorV1(error, { traceId, maxDepth = 16 } = {}, seen = new Set()) {
  if (maxDepth < 1 || seen.has(error)) fail("RUNTIME_ERROR_CAUSE_REJECTED");
  seen.add(error);
  exactKeys(error, RUNTIME_ERROR_KEYS, "RUNTIME_ERROR_SHAPE_REJECTED");
  if (error.contractName !== RUNTIME_ERROR_CONTRACT_NAME ||
      error.contractVersion !== RUNTIME_CONTRACT_VERSION ||
      !ERROR_STAGES.has(error.stage) || !ERROR_SEVERITIES.has(error.severity) ||
      typeof error.retryable !== "boolean" ||
      typeof error.partialSideEffects !== "boolean" ||
      (error.partialSideEffects && error.severity !== "PARTIAL_FAILURE")) {
    fail("RUNTIME_ERROR_IDENTITY_REJECTED");
  }
  for (const key of ["errorId", "code", "producer", "traceId"])
    assertIdentifier(error[key], "RUNTIME_ERROR_FIELD_REJECTED");
  if (traceId !== undefined && error.traceId !== traceId)
    fail("RUNTIME_ERROR_TRACE_REJECTED");
  if (typeof error.message !== "string" || error.message.length < 1 ||
      error.message.length > 1024) fail("RUNTIME_ERROR_MESSAGE_REJECTED");
  assertTimestamp(error.occurredAtMs, "RUNTIME_ERROR_TIME_REJECTED");
  if (!isPlainObject(error.details) ||
      Buffer.byteLength(canonicalize(error.details), "utf8") > 16_384) {
    fail("RUNTIME_ERROR_DETAILS_REJECTED");
  }
  assertNoSecretsOrInvalidJson(error.details, "RUNTIME_ERROR_DETAILS_REJECTED");
  if (error.cause !== null) {
    assertRuntimeErrorV1(error.cause, { traceId: error.traceId, maxDepth: maxDepth - 1 }, seen);
  }
  assertDeepFrozen(error, "RUNTIME_ERROR_MUTABLE_REJECTED");
  return error;
}

export function isRuntimeErrorV1(error) {
  try {
    assertRuntimeErrorV1(error);
    return true;
  } catch {
    return false;
  }
}

export function createRuntimeErrorV1(input) {
  const error = deepFreezeExecutionContractV1({
    contractName: RUNTIME_ERROR_CONTRACT_NAME,
    contractVersion: RUNTIME_CONTRACT_VERSION,
    ...input,
  });
  return assertRuntimeErrorV1(error);
}

function assertLifecycle(lifecycle, status, completedAtMs) {
  exactKeys(lifecycle, ["currentState", "transitions"],
    "EXECUTION_RESULT_LIFECYCLE_REJECTED");
  if (lifecycle.currentState !== TERMINAL_STATE[status] ||
      !Array.isArray(lifecycle.transitions) || lifecycle.transitions.length === 0) {
    fail("EXECUTION_RESULT_LIFECYCLE_REJECTED");
  }
  let previousTime = -1;
  lifecycle.transitions.forEach((transition, index) => {
    exactKeys(transition, ["sequence", "state", "component", "occurredAtMs"],
      "EXECUTION_RESULT_LIFECYCLE_REJECTED");
    if (transition.sequence !== index || !EXECUTION_STATES.has(transition.state))
      fail("EXECUTION_RESULT_LIFECYCLE_REJECTED");
    assertIdentifier(transition.component, "EXECUTION_RESULT_LIFECYCLE_REJECTED");
    assertTimestamp(transition.occurredAtMs, "EXECUTION_RESULT_LIFECYCLE_REJECTED");
    if (transition.occurredAtMs < previousTime || transition.occurredAtMs > completedAtMs)
      fail("EXECUTION_RESULT_LIFECYCLE_REJECTED");
    previousTime = transition.occurredAtMs;
  });
  if (lifecycle.transitions[0].state !== "CREATED" ||
      lifecycle.transitions.at(-1).state !== lifecycle.currentState) {
    fail("EXECUTION_RESULT_LIFECYCLE_REJECTED");
  }
}

function assertSideEffects(effects, completedAtMs) {
  if (!Array.isArray(effects)) fail("EXECUTION_RESULT_EFFECTS_REJECTED");
  for (const effect of effects) {
    exactKeys(effect, [
      "type", "owner", "targetLocator", "attemptedAtMs", "outcome",
      "receiptLocator", "reversible",
    ], "EXECUTION_RESULT_EFFECTS_REJECTED");
    if (!EFFECT_TYPES.has(effect.type) || !EFFECT_OUTCOMES.has(effect.outcome) ||
        typeof effect.reversible !== "boolean") fail("EXECUTION_RESULT_EFFECTS_REJECTED");
    assertIdentifier(effect.owner, "EXECUTION_RESULT_EFFECTS_REJECTED");
    assertIdentifier(effect.targetLocator, "EXECUTION_RESULT_EFFECTS_REJECTED");
    assertTimestamp(effect.attemptedAtMs, "EXECUTION_RESULT_EFFECTS_REJECTED");
    if (effect.attemptedAtMs > completedAtMs) fail("EXECUTION_RESULT_EFFECTS_REJECTED");
    if (effect.receiptLocator !== null)
      assertIdentifier(effect.receiptLocator, "EXECUTION_RESULT_EFFECTS_REJECTED");
  }
}

function assertRecovery(recovery) {
  exactKeys(recovery, [
    "required", "state", "owner", "actions", "safeToRetry", "retryPreconditions",
  ], "EXECUTION_RESULT_RECOVERY_REJECTED");
  if (typeof recovery.required !== "boolean" || !RECOVERY_STATES.has(recovery.state) ||
      typeof recovery.safeToRetry !== "boolean") fail("EXECUTION_RESULT_RECOVERY_REJECTED");
  if (recovery.owner !== null) assertIdentifier(recovery.owner, "EXECUTION_RESULT_RECOVERY_REJECTED");
  assertStringArray(recovery.actions,
    { empty: true, code: "EXECUTION_RESULT_RECOVERY_REJECTED" });
  assertStringArray(recovery.retryPreconditions,
    { empty: true, code: "EXECUTION_RESULT_RECOVERY_REJECTED" });
  if (recovery.required) {
    if (recovery.state === "NONE" || recovery.owner === null || recovery.actions.length === 0)
      fail("EXECUTION_RESULT_RECOVERY_REJECTED");
  } else if (recovery.state !== "NONE" || recovery.owner !== null || recovery.actions.length !== 0) {
    fail("EXECUTION_RESULT_RECOVERY_REJECTED");
  }
}

export function assertBrowserProofResultV1(proof, deployment, completedAtMs) {
  exactKeys(proof, [
    "status", "deploymentId", "deploymentArtifactDigest",
    "expectedControlProofDigest", "observedControlProofDigest", "verifiedAtMs",
  ], "EXECUTION_RESULT_BROWSER_PROOF_REJECTED");
  if (!new Set(["VERIFIED", "REJECTED"]).has(proof.status) ||
      proof.deploymentId !== deployment.deploymentId ||
      proof.deploymentArtifactDigest !== deployment.deploymentArtifactDigest ||
      proof.expectedControlProofDigest !== deployment.controlProofDigest) {
    fail("EXECUTION_RESULT_BROWSER_PROOF_REJECTED");
  }
  assertDigest(proof.observedControlProofDigest, "EXECUTION_RESULT_BROWSER_PROOF_REJECTED");
  assertTimestamp(proof.verifiedAtMs, "EXECUTION_RESULT_BROWSER_PROOF_REJECTED");
  if (proof.verifiedAtMs > completedAtMs) fail("EXECUTION_RESULT_BROWSER_PROOF_REJECTED");
  return proof;
}

export function assertTurnReceiptV1(receipt, completedAtMs = Number.MAX_SAFE_INTEGER) {
  exactKeys(receipt, [
    "status", "functionalRequests", "canaryEligible", "replayResult",
    "activationDecision", "baselineQuestionLocator",
    "intelligenceProposedQuestionLocator", "authoritativeQuestionLocator",
    "visibleQuestionSource", "visibleQuestionCount", "completedAtMs",
  ], "EXECUTION_RESULT_TURN_RECEIPT_REJECTED");
  if (receipt.status !== "CONSUMED" || receipt.functionalRequests !== 1 ||
      receipt.canaryEligible !== true || receipt.replayResult !== "CREATED" ||
      receipt.activationDecision !== "USE_INTELLIGENCE" ||
      receipt.authoritativeQuestionLocator !== receipt.intelligenceProposedQuestionLocator ||
      receipt.visibleQuestionSource !== "INTELLIGENCE" ||
      receipt.visibleQuestionCount !== 1) fail("EXECUTION_RESULT_TURN_RECEIPT_REJECTED");
  for (const key of [
    "baselineQuestionLocator", "intelligenceProposedQuestionLocator",
    "authoritativeQuestionLocator",
  ]) assertIdentifier(receipt[key], "EXECUTION_RESULT_TURN_RECEIPT_REJECTED");
  assertSafeInteger(receipt.functionalRequests, "EXECUTION_RESULT_TURN_RECEIPT_REJECTED");
  assertSafeInteger(receipt.visibleQuestionCount, "EXECUTION_RESULT_TURN_RECEIPT_REJECTED");
  assertTimestamp(receipt.completedAtMs, "EXECUTION_RESULT_TURN_RECEIPT_REJECTED");
  if (receipt.completedAtMs > completedAtMs) fail("EXECUTION_RESULT_TURN_RECEIPT_REJECTED");
  return receipt;
}

function artifactExpectedResultValues(artifact) {
  return {
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
  };
}

export function executionResultEvidenceFromArtifactV1(artifact) {
  assertExecutionCompositionArtifactV1(artifact);
  return deepFreezeExecutionContractV1(artifactExpectedResultValues(artifact));
}

export function assertExecutionResultV1(result, { artifact } = {}) {
  exactKeys(result, EXECUTION_KEYS, "EXECUTION_RESULT_SHAPE_REJECTED");
  if (result.contractName !== EXECUTION_RESULT_CONTRACT_NAME ||
      result.contractVersion !== RUNTIME_CONTRACT_VERSION ||
      result.environment !== "PREVIEW" || !EXECUTION_STATUSES.has(result.status)) {
    fail("EXECUTION_RESULT_IDENTITY_REJECTED");
  }
  for (const key of ["receiptId", "operationId", "changeId", "traceId", "artifactId"])
    assertIdentifier(result[key], "EXECUTION_RESULT_FIELD_REJECTED");
  assertDigest(result.artifactDigest, "EXECUTION_RESULT_FIELD_REJECTED");
  assertTimestamp(result.startedAtMs, "EXECUTION_RESULT_TIME_REJECTED");
  assertTimestamp(result.completedAtMs, "EXECUTION_RESULT_TIME_REJECTED");
  if (result.startedAtMs > result.completedAtMs) fail("EXECUTION_RESULT_TIME_REJECTED");
  assertAuthoritativeBinding(result.authoritativeBinding);
  assertPolicyCertification(result.policyCertification);
  assertDeploymentCertification(result.deploymentCertification);
  assertLifecycle(result.lifecycle, result.status, result.completedAtMs);
  if (!Array.isArray(result.errors)) fail("EXECUTION_RESULT_ERRORS_REJECTED");
  for (const error of result.errors) {
    assertRuntimeErrorV1(error, { traceId: result.traceId });
    if (error.occurredAtMs > result.completedAtMs) fail("EXECUTION_RESULT_ERRORS_REJECTED");
  }
  assertSideEffects(result.sideEffects, result.completedAtMs);
  assertRecovery(result.recovery);
  if (result.browserProof !== null)
    assertBrowserProofResultV1(result.browserProof, result.deploymentCertification,
      result.completedAtMs);
  if (result.turnReceipt !== null) assertTurnReceiptV1(result.turnReceipt, result.completedAtMs);

  const unresolvedEffects = result.sideEffects.some(({ outcome }) =>
    outcome === "APPLIED" || outcome === "UNKNOWN");
  if (result.status === "SUCCESS") {
    if (result.errors.length !== 0 || result.recovery.required ||
        result.browserProof?.status !== "VERIFIED" ||
        result.turnReceipt?.status !== "CONSUMED" ||
        result.sideEffects.some(({ outcome }) => outcome === "UNKNOWN")) {
      fail("EXECUTION_RESULT_SUCCESS_INVARIANT_REJECTED");
    }
  } else if (result.errors.length === 0) {
    fail("EXECUTION_RESULT_ERROR_INVARIANT_REJECTED");
  }
  if (new Set(["BLOCKED", "FAILED"]).has(result.status) && unresolvedEffects)
    fail("EXECUTION_RESULT_EFFECT_INVARIANT_REJECTED");
  if (result.status === "FAILED_PARTIAL" && (!unresolvedEffects || !result.recovery.required))
    fail("EXECUTION_RESULT_PARTIAL_INVARIANT_REJECTED");

  if (artifact !== undefined) {
    assertExecutionCompositionArtifactV1(artifact);
    const expected = artifactExpectedResultValues(artifact);
    if (result.artifactId !== artifact.artifactId ||
        result.artifactDigest !== artifact.artifactDigest ||
        canonicalize(result.authoritativeBinding) !== canonicalize(expected.authoritativeBinding) ||
        canonicalize(result.policyCertification) !== canonicalize(expected.policyCertification) ||
        canonicalize(result.deploymentCertification) !==
          canonicalize(expected.deploymentCertification)) {
      fail("EXECUTION_RESULT_ARTIFACT_BINDING_REJECTED");
    }
  }
  assertDeepFrozen(result, "EXECUTION_RESULT_MUTABLE_REJECTED");
  return result;
}

export function createExecutionResultV1(input, options = {}) {
  const result = deepFreezeExecutionContractV1({
    contractName: EXECUTION_RESULT_CONTRACT_NAME,
    contractVersion: RUNTIME_CONTRACT_VERSION,
    ...input,
  });
  return assertExecutionResultV1(result, options);
}
