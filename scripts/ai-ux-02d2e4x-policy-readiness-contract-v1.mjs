import { createHash } from "node:crypto";

export const AUTHORITY_RECEIPT_CONTRACT_NAME_V1 = "AuthorityReceiptV1";
export const POLICY_READINESS_CONTRACT_NAME_V1 =
  "PolicyReadinessReceiptV1";
export const RUNTIME_ERROR_CONTRACT_NAME_V1 = "RuntimeErrorV1";
export const RUNTIME_CONTRACT_VERSION_V1 = "V1";

const SHA256 = /^[0-9a-f]{64}$/u;
const CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/u;
const AUTHORITY_FIELDS = Object.freeze([
  "contractName",
  "contractVersion",
  "receiptId",
  "status",
  "environment",
  "projectId",
  "authoritativeTenantId",
  "authoritativeTenantLocator",
  "syntheticFixtureLocator",
  "linkId",
  "sessionId",
  "turnId",
  "intentClass",
  "evidenceDigest",
  "certifiedAtMs",
  "expiresAtMs",
]);
const AUTHORITY_CONSTRUCTION_FIELDS = Object.freeze([
  "receiptId",
  "projectId",
  "authoritativeTenantId",
  "authoritativeTenantLocator",
  "syntheticFixtureLocator",
  "linkId",
  "sessionId",
  "turnId",
  "intentClass",
  "evidenceDigest",
  "certifiedAtMs",
  "expiresAtMs",
]);
const AUTHORITY_EVIDENCE_FIELDS = Object.freeze([
  "authorityEvidenceSchema",
  "environment",
  "projectId",
  "authoritativeTenantId",
  "authoritativeTenantLocator",
  "syntheticFixtureLocator",
  "linkId",
  "sessionId",
  "turnId",
  "intentClass",
  "linkEvidence",
  "sessionEvidence",
]);
const AUTHORITY_LINK_EVIDENCE_FIELDS = Object.freeze([
  "synthetic",
  "environment",
  "projectId",
  "tenantId",
  "fixtureLocator",
  "requiredCapability",
  "linkId",
  "sessionId",
]);
const AUTHORITY_SESSION_EVIDENCE_FIELDS = Object.freeze([
  "synthetic",
  "environment",
  "projectId",
  "tenantId",
  "fixtureLocator",
  "linkId",
  "sessionId",
]);
const POLICY_FIELDS = Object.freeze([
  "contractName",
  "contractVersion",
  "receiptId",
  "status",
  "environment",
  "projectId",
  "authoritativeTenantId",
  "authoritativeTenantLocator",
  "policyVersion",
  "activePointerVersion",
  "policyArtifactDigest",
  "activationAuditId",
  "mode",
  "enabled",
  "killSwitchState",
  "allowedSyntheticFixtureLocators",
  "allowedIntentClasses",
  "activatedAtMs",
  "expiresAtMs",
  "certifiedAtMs",
]);
const KILL_SWITCH_FIELDS = Object.freeze(["state", "revision"]);
const POLICY_DIGEST_FIELDS = Object.freeze([
  "schemaVersion",
  "activationVersion",
  "policyVersion",
  "authoritativeTenantLocator",
  "environment",
  "mode",
  "enabled",
  "expiresAtMs",
  "killSwitchState",
  "allowedSyntheticFixtureLocators",
  "allowedIntentClasses",
  "source",
]);
const POLICY_DIGEST_KILL_SWITCH_FIELDS = Object.freeze([
  "environment",
  "state",
  "revision",
  "source",
]);
const RUNTIME_ERROR_FIELDS = Object.freeze([
  "contractName",
  "contractVersion",
  "errorId",
  "code",
  "stage",
  "producer",
  "severity",
  "message",
  "cause",
  "retryable",
  "partialSideEffects",
  "details",
  "traceId",
  "occurredAtMs",
]);
const ERROR_STAGES = new Set([
  "CONFIGURATION",
  "AUTHORITY",
  "POLICY",
  "ROTATION",
  "COMPOSITION",
  "DEPLOYMENT",
  "BROWSER_PROOF",
  "TURN",
  "CLEANUP",
  "TERMINAL_VALIDATION",
]);
const ERROR_SEVERITIES = new Set([
  "BLOCKING",
  "FAILURE",
  "PARTIAL_FAILURE",
]);

function reject(label) {
  throw new TypeError(label);
}

function assertPlainObject(value, label) {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    (Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null)
  ) {
    reject(label);
  }
}

function assertExactFields(value, fields, label) {
  assertPlainObject(value, label);
  const actual = Object.keys(value).sort();
  const expected = [...fields].sort();
  if (
    actual.length !== expected.length ||
    actual.some((field, index) => field !== expected[index])
  ) {
    reject(label);
  }
}

function assertIdentifier(value, label) {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > 256 ||
    value.trim() !== value ||
    CONTROL_CHARACTER.test(value)
  ) {
    reject(label);
  }
}

function assertTimestamp(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    reject(label);
  }
}

function assertSha256(value, label) {
  if (!SHA256.test(value ?? "")) {
    reject(label);
  }
}

function compareCodePoints(left, right) {
  const leftPoints = Array.from(left, (value) => value.codePointAt(0));
  const rightPoints = Array.from(right, (value) => value.codePointAt(0));
  const length = Math.min(leftPoints.length, rightPoints.length);
  for (let index = 0; index < length; index += 1) {
    if (leftPoints[index] !== rightPoints[index]) {
      return leftPoints[index] - rightPoints[index];
    }
  }
  return leftPoints.length - rightPoints.length;
}

function assertSortedUniqueIdentifiers(values, label) {
  if (!Array.isArray(values) || values.length === 0) {
    reject(label);
  }
  values.forEach((value) => assertIdentifier(value, label));
  for (let index = 1; index < values.length; index += 1) {
    if (compareCodePoints(values[index - 1], values[index]) >= 0) {
      reject(label);
    }
  }
}

function assertDeepFrozen(value, label, seen = new Set()) {
  if (value === null || typeof value !== "object" || seen.has(value)) {
    return;
  }
  if (!Object.isFrozen(value)) {
    reject(label);
  }
  seen.add(value);
  for (const child of Object.values(value)) {
    assertDeepFrozen(child, label, seen);
  }
}

export function deepFreezeV1(value, seen = new Set()) {
  if (value === null || typeof value !== "object" || seen.has(value)) {
    return value;
  }
  seen.add(value);
  for (const child of Object.values(value)) {
    deepFreezeV1(child, seen);
  }
  return Object.freeze(value);
}

function assertCanonicalValue(value, label, depth = 0) {
  if (depth > 8) reject(label);
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return;
  }
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value < 0) reject(label);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => assertCanonicalValue(item, label, depth + 1));
    return;
  }
  assertPlainObject(value, label);
  for (const [key, child] of Object.entries(value)) {
    assertIdentifier(key, label);
    assertCanonicalValue(child, label, depth + 1);
  }
}

function canonicalize(value) {
  if (value === null || typeof value === "boolean" || typeof value === "number") {
    return JSON.stringify(value);
  }
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalize(item)).join(",")}]`;
  }
  return `{${Object.keys(value).sort().map((key) =>
    `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`;
}

export function canonicalJsonV1(value) {
  assertCanonicalValue(value, "RUNTIME_CONTRACT_CANONICAL_VALUE_REJECTED");
  return canonicalize(value);
}

export function sha256CanonicalV1(value) {
  return createHash("sha256")
    .update(canonicalJsonV1(value), "utf8")
    .digest("hex");
}

function assertAuthorityEvidenceV1(value) {
  assertExactFields(
    value,
    AUTHORITY_EVIDENCE_FIELDS,
    "AUTHORITY_EVIDENCE_V1_REJECTED",
  );
  assertExactFields(
    value.linkEvidence,
    AUTHORITY_LINK_EVIDENCE_FIELDS,
    "AUTHORITY_EVIDENCE_V1_REJECTED",
  );
  assertExactFields(
    value.sessionEvidence,
    AUTHORITY_SESSION_EVIDENCE_FIELDS,
    "AUTHORITY_EVIDENCE_V1_REJECTED",
  );

  for (const field of [
    "projectId",
    "authoritativeTenantId",
    "authoritativeTenantLocator",
    "syntheticFixtureLocator",
    "linkId",
    "sessionId",
    "turnId",
  ]) {
    assertIdentifier(value[field], "AUTHORITY_EVIDENCE_V1_REJECTED");
  }

  if (
    value.authorityEvidenceSchema !== "AUTHORITY_EVIDENCE_V1" ||
    value.environment !== "PREVIEW" ||
    value.authoritativeTenantLocator !== value.authoritativeTenantId ||
    !new Set(["CLARIFICATION", "DISCOVER_PROBLEM"]).has(value.intentClass) ||
    value.linkEvidence.synthetic !== true ||
    value.linkEvidence.environment !== value.environment ||
    value.linkEvidence.projectId !== value.projectId ||
    value.linkEvidence.tenantId !== value.authoritativeTenantId ||
    value.linkEvidence.fixtureLocator !== value.syntheticFixtureLocator ||
    value.linkEvidence.requiredCapability !== "EVALUATE_CONVERSATION" ||
    value.linkEvidence.linkId !== value.linkId ||
    value.linkEvidence.sessionId !== value.sessionId ||
    value.sessionEvidence.synthetic !== true ||
    value.sessionEvidence.environment !== value.environment ||
    value.sessionEvidence.projectId !== value.projectId ||
    value.sessionEvidence.tenantId !== value.authoritativeTenantId ||
    value.sessionEvidence.fixtureLocator !== value.syntheticFixtureLocator ||
    value.sessionEvidence.linkId !== value.linkId ||
    value.sessionEvidence.sessionId !== value.sessionId
  ) {
    reject("AUTHORITY_EVIDENCE_V1_REJECTED");
  }

  return value;
}

export function authorityEvidenceDigestV1(value) {
  assertAuthorityEvidenceV1(value);
  return sha256CanonicalV1(value);
}

export function assertAuthorityReceiptV1(value, { atMs } = {}) {
  assertExactFields(value, AUTHORITY_FIELDS, "AUTHORITY_RECEIPT_V1_REJECTED");
  if (
    value.contractName !== AUTHORITY_RECEIPT_CONTRACT_NAME_V1 ||
    value.contractVersion !== RUNTIME_CONTRACT_VERSION_V1 ||
    value.status !== "CERTIFIED" ||
    value.environment !== "PREVIEW" ||
    value.authoritativeTenantLocator !== value.authoritativeTenantId ||
    !new Set(["CLARIFICATION", "DISCOVER_PROBLEM"]).has(value.intentClass)
  ) {
    reject("AUTHORITY_RECEIPT_V1_REJECTED");
  }
  for (const field of [
    "receiptId",
    "projectId",
    "authoritativeTenantId",
    "authoritativeTenantLocator",
    "syntheticFixtureLocator",
    "linkId",
    "sessionId",
    "turnId",
  ]) {
    assertIdentifier(value[field], "AUTHORITY_RECEIPT_V1_REJECTED");
  }
  assertSha256(value.evidenceDigest, "AUTHORITY_RECEIPT_V1_REJECTED");
  assertTimestamp(value.certifiedAtMs, "AUTHORITY_RECEIPT_V1_REJECTED");
  assertTimestamp(value.expiresAtMs, "AUTHORITY_RECEIPT_V1_REJECTED");
  if (value.certifiedAtMs >= value.expiresAtMs) {
    reject("AUTHORITY_RECEIPT_V1_REJECTED");
  }
  if (atMs !== undefined) {
    assertTimestamp(atMs, "AUTHORITY_RECEIPT_V1_REJECTED");
    if (atMs < value.certifiedAtMs || atMs >= value.expiresAtMs) {
      reject("AUTHORITY_RECEIPT_V1_REJECTED");
    }
  }
  assertDeepFrozen(value, "AUTHORITY_RECEIPT_V1_MUTABLE");
  return value;
}

export function createAuthorityReceiptV1(input) {
  assertExactFields(
    input,
    AUTHORITY_CONSTRUCTION_FIELDS,
    "AUTHORITY_RECEIPT_V1_INPUT_REJECTED",
  );
  const receipt = {
    contractName: AUTHORITY_RECEIPT_CONTRACT_NAME_V1,
    contractVersion: RUNTIME_CONTRACT_VERSION_V1,
    receiptId: input.receiptId,
    status: "CERTIFIED",
    environment: "PREVIEW",
    projectId: input.projectId,
    authoritativeTenantId: input.authoritativeTenantId,
    authoritativeTenantLocator: input.authoritativeTenantLocator,
    syntheticFixtureLocator: input.syntheticFixtureLocator,
    linkId: input.linkId,
    sessionId: input.sessionId,
    turnId: input.turnId,
    intentClass: input.intentClass,
    evidenceDigest: input.evidenceDigest,
    certifiedAtMs: input.certifiedAtMs,
    expiresAtMs: input.expiresAtMs,
  };
  deepFreezeV1(receipt);
  return assertAuthorityReceiptV1(receipt);
}

export function assertPolicyReadinessReceiptV1(value, { atMs } = {}) {
  assertExactFields(value, POLICY_FIELDS, "POLICY_READINESS_RECEIPT_V1_REJECTED");
  assertExactFields(
    value.killSwitchState,
    KILL_SWITCH_FIELDS,
    "POLICY_READINESS_RECEIPT_V1_REJECTED",
  );
  if (
    value.contractName !== POLICY_READINESS_CONTRACT_NAME_V1 ||
    value.contractVersion !== RUNTIME_CONTRACT_VERSION_V1 ||
    value.status !== "ACTIVE" ||
    value.environment !== "PREVIEW" ||
    value.authoritativeTenantLocator !== value.authoritativeTenantId ||
    value.mode !== "CANARY" ||
    value.enabled !== true ||
    value.killSwitchState.state !== "OFF"
  ) {
    reject("POLICY_READINESS_RECEIPT_V1_REJECTED");
  }
  for (const field of [
    "receiptId",
    "projectId",
    "authoritativeTenantId",
    "authoritativeTenantLocator",
    "policyVersion",
    "activePointerVersion",
    "activationAuditId",
  ]) {
    assertIdentifier(value[field], "POLICY_READINESS_RECEIPT_V1_REJECTED");
  }
  assertIdentifier(
    value.killSwitchState.revision,
    "POLICY_READINESS_RECEIPT_V1_REJECTED",
  );
  assertSha256(
    value.policyArtifactDigest,
    "POLICY_READINESS_RECEIPT_V1_REJECTED",
  );
  assertSortedUniqueIdentifiers(
    value.allowedSyntheticFixtureLocators,
    "POLICY_READINESS_RECEIPT_V1_REJECTED",
  );
  assertSortedUniqueIdentifiers(
    value.allowedIntentClasses,
    "POLICY_READINESS_RECEIPT_V1_REJECTED",
  );
  if (value.allowedIntentClasses.some((intent) =>
    intent !== "CLARIFICATION" && intent !== "DISCOVER_PROBLEM")) {
    reject("POLICY_READINESS_RECEIPT_V1_REJECTED");
  }
  for (const field of ["activatedAtMs", "expiresAtMs", "certifiedAtMs"]) {
    assertTimestamp(value[field], "POLICY_READINESS_RECEIPT_V1_REJECTED");
  }
  if (
    value.activatedAtMs > value.certifiedAtMs ||
    value.certifiedAtMs >= value.expiresAtMs
  ) {
    reject("POLICY_READINESS_RECEIPT_V1_REJECTED");
  }
  if (atMs !== undefined) {
    assertTimestamp(atMs, "POLICY_READINESS_RECEIPT_V1_REJECTED");
    if (atMs < value.certifiedAtMs || atMs >= value.expiresAtMs) {
      reject("POLICY_READINESS_RECEIPT_V1_REJECTED");
    }
  }
  assertDeepFrozen(value, "POLICY_READINESS_RECEIPT_V1_MUTABLE");
  return value;
}

export function policyArtifactDigestV1(input) {
  assertExactFields(
    input,
    POLICY_DIGEST_FIELDS,
    "POLICY_ARTIFACT_DIGEST_INPUT_REJECTED",
  );
  assertExactFields(
    input.killSwitchState,
    POLICY_DIGEST_KILL_SWITCH_FIELDS,
    "POLICY_ARTIFACT_DIGEST_INPUT_REJECTED",
  );
  for (const field of [
    "schemaVersion",
    "activationVersion",
    "policyVersion",
    "authoritativeTenantLocator",
    "source",
  ]) {
    assertIdentifier(input[field], "POLICY_ARTIFACT_DIGEST_INPUT_REJECTED");
  }
  if (
    input.environment !== "PREVIEW" ||
    input.mode !== "CANARY" ||
    input.enabled !== true ||
    input.killSwitchState.environment !== "PREVIEW" ||
    input.killSwitchState.state !== "OFF"
  ) {
    reject("POLICY_ARTIFACT_DIGEST_INPUT_REJECTED");
  }
  assertIdentifier(
    input.killSwitchState.revision,
    "POLICY_ARTIFACT_DIGEST_INPUT_REJECTED",
  );
  assertIdentifier(
    input.killSwitchState.source,
    "POLICY_ARTIFACT_DIGEST_INPUT_REJECTED",
  );
  assertTimestamp(input.expiresAtMs, "POLICY_ARTIFACT_DIGEST_INPUT_REJECTED");
  assertSortedUniqueIdentifiers(
    input.allowedSyntheticFixtureLocators,
    "POLICY_ARTIFACT_DIGEST_INPUT_REJECTED",
  );
  assertSortedUniqueIdentifiers(
    input.allowedIntentClasses,
    "POLICY_ARTIFACT_DIGEST_INPUT_REJECTED",
  );
  return sha256CanonicalV1(input);
}

export function createPolicyReadinessReceiptV1(input) {
  const receipt = {
    contractName: POLICY_READINESS_CONTRACT_NAME_V1,
    contractVersion: RUNTIME_CONTRACT_VERSION_V1,
    receiptId: input.receiptId,
    status: "ACTIVE",
    environment: "PREVIEW",
    projectId: input.projectId,
    authoritativeTenantId: input.authoritativeTenantId,
    authoritativeTenantLocator: input.authoritativeTenantLocator,
    policyVersion: input.policyVersion,
    activePointerVersion: input.activePointerVersion,
    policyArtifactDigest: input.policyArtifactDigest,
    activationAuditId: input.activationAuditId,
    mode: "CANARY",
    enabled: true,
    killSwitchState: {
      state: "OFF",
      revision: input.killSwitchState?.revision,
    },
    allowedSyntheticFixtureLocators: [
      ...(input.allowedSyntheticFixtureLocators ?? []),
    ],
    allowedIntentClasses: [...(input.allowedIntentClasses ?? [])],
    activatedAtMs: input.activatedAtMs,
    expiresAtMs: input.expiresAtMs,
    certifiedAtMs: input.certifiedAtMs,
  };
  deepFreezeV1(receipt);
  return assertPolicyReadinessReceiptV1(receipt);
}

function assertDetails(value, label) {
  assertPlainObject(value, label);
  assertCanonicalValue(value, label);
  if (Buffer.byteLength(canonicalize(value), "utf8") > 16_384) {
    reject(label);
  }
}

function assertRuntimeErrorInternal(value, seen, depth) {
  if (depth >= 16 || seen.has(value)) {
    reject("RUNTIME_ERROR_V1_REJECTED");
  }
  seen.add(value);
  const enumerable = Object.fromEntries(Object.entries(value ?? {}));
  assertExactFields(enumerable, RUNTIME_ERROR_FIELDS, "RUNTIME_ERROR_V1_REJECTED");
  if (
    value.contractName !== RUNTIME_ERROR_CONTRACT_NAME_V1 ||
    value.contractVersion !== RUNTIME_CONTRACT_VERSION_V1 ||
    !ERROR_STAGES.has(value.stage) ||
    !ERROR_SEVERITIES.has(value.severity) ||
    typeof value.retryable !== "boolean" ||
    typeof value.partialSideEffects !== "boolean" ||
    (value.partialSideEffects && value.severity !== "PARTIAL_FAILURE") ||
    typeof value.message !== "string" ||
    value.message.length < 1 ||
    value.message.length > 1_024
  ) {
    reject("RUNTIME_ERROR_V1_REJECTED");
  }
  for (const field of ["errorId", "code", "producer", "traceId"]) {
    assertIdentifier(value[field], "RUNTIME_ERROR_V1_REJECTED");
  }
  assertTimestamp(value.occurredAtMs, "RUNTIME_ERROR_V1_REJECTED");
  assertDetails(value.details, "RUNTIME_ERROR_V1_REJECTED");
  if (value.cause !== null) {
    assertRuntimeErrorInternal(value.cause, seen, depth + 1);
  }
  return value;
}

export function assertRuntimeErrorV1(value) {
  return assertRuntimeErrorInternal(value, new Set(), 0);
}

export function isRuntimeErrorV1(value) {
  try {
    assertRuntimeErrorV1(value);
    return true;
  } catch {
    return false;
  }
}

export function createRuntimeErrorFieldsV1(input) {
  const fields = {
    contractName: RUNTIME_ERROR_CONTRACT_NAME_V1,
    contractVersion: RUNTIME_CONTRACT_VERSION_V1,
    errorId: input.errorId,
    code: input.code,
    stage: input.stage,
    producer: input.producer,
    severity: input.severity,
    message: input.message ?? input.code,
    cause: input.cause ?? null,
    retryable: input.retryable,
    partialSideEffects: input.partialSideEffects,
    details: { ...(input.details ?? {}) },
    traceId: input.traceId,
    occurredAtMs: input.occurredAtMs,
  };
  deepFreezeV1(fields);
  return assertRuntimeErrorV1(fields);
}
