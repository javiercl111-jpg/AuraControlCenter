import { createHash, randomUUID } from "node:crypto";

import {
  assertAuthorityReceiptV1,
  createPolicyReadinessReceiptV1,
  createRuntimeErrorFieldsV1,
  isRuntimeErrorV1,
  policyArtifactDigestV1,
} from "./ai-ux-02d2e4x-policy-readiness-contract-v1.mjs";

const PROJECT_ID = "aura-intel-preview";
const POLICY_COLLECTION = "discoveryAdaptiveCanaryPoliciesV1";
const ACTIVE_COLLECTION = "discoveryAdaptiveCanaryActiveV1";
const AUDIT_COLLECTION = "discoveryAdaptiveCanaryAuditV1";
const POINTER_VERSION = "DISCOVERY_ADAPTIVE_CANARY_ACTIVE_POINTER_V1";
const POLICY_VERSION = "DISCOVERY_ADAPTIVE_CANARY_POLICY_V1";
const ACTIVATION_VERSION = "DISCOVERY_ADAPTIVE_ACTIVATION_V1";
const AUDIT_VERSION = "DISCOVERY_ADAPTIVE_CANARY_POLICY_AUDIT_V1";
const ACTIVE_DOCUMENT_ID =
  "eb6cc289a9a2843c29b47263d321959a95d20d99639704477e78d968c3d42801";
const TRACE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/u;

const RETRYABLE_CODES = new Set([
  "D2E4O_ACTIVE_POINTER_MISSING",
  "D2E4O_POLICY_KILL_SWITCHED",
  "D2E4O_POLICY_EXPIRED",
  "D2E4O_POLICY_READ_FAILED",
]);

export class D2E4OPolicyRepositoryError extends Error {
  constructor(input) {
    const fields = typeof input === "string" ? null : input;
    const code = fields?.code ?? input;
    super(fields?.message ?? code);
    Object.defineProperty(this, "name", {
      configurable: true,
      enumerable: false,
      writable: true,
      value: "D2E4OPolicyRepositoryError",
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

function failLegacy(code) {
  throw new D2E4OPolicyRepositoryError(code);
}

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function parseIsoExpiry(value) {
  if (typeof value !== "string") {
    throw new TypeError("D2E4O_POLICY_EXPIRY_REJECTED");
  }
  const milliseconds = Date.parse(value);
  if (
    !Number.isSafeInteger(milliseconds) ||
    milliseconds < 0 ||
    new Date(milliseconds).toISOString() !== value
  ) {
    throw new TypeError("D2E4O_POLICY_EXPIRY_REJECTED");
  }
  return milliseconds;
}

function safeErrorDetails(error) {
  return {
    observedName:
      typeof error?.name === "string" ? error.name.slice(0, 128) : "Error",
    observedCode:
      typeof error?.code === "string" ? error.code.slice(0, 256) : "UNAVAILABLE",
  };
}

export class FirestoreAdaptiveCanaryPolicyRepositoryV1 {
  #db;
  #clock;
  #receiptIdFactory;
  #errorIdFactory;

  constructor({
    db,
    clock = Date.now,
    receiptIdFactory = () => `policy-receipt-${randomUUID()}`,
    errorIdFactory = () => `policy-error-${randomUUID()}`,
  }) {
    if (
      !db ||
      typeof db.collection !== "function" ||
      typeof db.runTransaction !== "function" ||
      typeof clock !== "function" ||
      typeof receiptIdFactory !== "function" ||
      typeof errorIdFactory !== "function"
    ) {
      failLegacy("D2E4O_POLICY_REPOSITORY_CONFIGURATION_REJECTED");
    }
    this.#db = db;
    this.#clock = clock;
    this.#receiptIdFactory = receiptIdFactory;
    this.#errorIdFactory = errorIdFactory;
  }

  #error(code, traceId, details = {}, cause = null) {
    const occurredAtMs = this.#clock();
    const fields = createRuntimeErrorFieldsV1({
      errorId: this.#errorIdFactory(),
      code,
      stage: "POLICY",
      producer: "D2E4O_POLICY_REPOSITORY",
      severity: "BLOCKING",
      message: code,
      cause,
      retryable: RETRYABLE_CODES.has(code),
      partialSideEffects: false,
      details,
      traceId,
      occurredAtMs,
    });
    return new D2E4OPolicyRepositoryError(fields);
  }

  #fail(code, traceId, details = {}, cause = null) {
    throw this.#error(code, traceId, details, cause);
  }

  async #readActivePolicyAndAudit(traceId) {
    return this.#db.runTransaction(async (transaction) => {
      const activeRef = this.#db
        .collection(ACTIVE_COLLECTION)
        .doc(ACTIVE_DOCUMENT_ID);
      const activeSnapshot = await transaction.get(activeRef);

      if (!activeSnapshot.exists) {
        this.#fail("D2E4O_ACTIVE_POINTER_MISSING", traceId);
      }

      const active = activeSnapshot.data();
      if (
        active?.version !== POINTER_VERSION ||
        active?.environment !== "PREVIEW" ||
        typeof active?.policyVersion !== "string" ||
        active.policyVersion.length === 0 ||
        typeof active?.auditId !== "string" ||
        active.auditId.length === 0 ||
        typeof active?.authoritativeTenantLocator !== "string" ||
        active.authoritativeTenantLocator.length === 0 ||
        !Number.isSafeInteger(active?.updatedAt) ||
        active.updatedAt < 0
      ) {
        this.#fail("D2E4O_ACTIVE_POINTER_REJECTED", traceId);
      }

      const policyQuery = this.#db
        .collection(POLICY_COLLECTION)
        .where("policyVersion", "==", active.policyVersion)
        .limit(2);
      const auditRef = this.#db
        .collection(AUDIT_COLLECTION)
        .doc(sha256(active.auditId));

      const [policySnapshot, auditSnapshot] = await Promise.all([
        transaction.get(policyQuery),
        transaction.get(auditRef),
      ]);

      if (policySnapshot.size !== 1) {
        this.#fail("D2E4O_ACTIVE_POLICY_CARDINALITY_REJECTED", traceId);
      }
      if (!auditSnapshot.exists) {
        this.#fail("D2E4O_ACTIVATION_AUDIT_MISSING", traceId);
      }

      return Object.freeze({
        active,
        policy: policySnapshot.docs[0].data(),
        audit: auditSnapshot.data(),
      });
    });
  }

  async resolveActive(authority, context) {
    const traceId = context?.traceId;
    if (!TRACE_ID.test(traceId ?? "")) {
      failLegacy("D2E4O_POLICY_REQUEST_REJECTED");
    }

    const requestedAtMs = this.#clock();
    try {
      try {
        assertAuthorityReceiptV1(authority, { atMs: requestedAtMs });
      } catch (error) {
        this.#fail(
          "D2E4O_POLICY_REQUEST_REJECTED",
          traceId,
          safeErrorDetails(error),
        );
      }

      if (
        authority.projectId !== PROJECT_ID ||
        authority.environment !== "PREVIEW"
      ) {
        this.#fail("D2E4O_POLICY_REQUEST_REJECTED", traceId);
      }

      const { active, policy, audit } =
        await this.#readActivePolicyAndAudit(traceId);

      if (
        policy?.version !== POLICY_VERSION ||
        policy?.activationVersion !== ACTIVATION_VERSION ||
        policy?.policyVersion !== active.policyVersion ||
        policy?.environment !== "PREVIEW" ||
        typeof policy?.authoritativeTenantLocator !== "string" ||
        policy.authoritativeTenantLocator !== active.authoritativeTenantLocator ||
        policy?.source !== "SERVER_CONFIGURATION" ||
        !Array.isArray(policy?.allowedSyntheticFixtureLocators) ||
        !Array.isArray(policy?.allowedIntentClasses) ||
        policy?.killSwitchState?.environment !== "PREVIEW" ||
        policy?.killSwitchState?.source !== "SERVER_CONFIGURATION" ||
        typeof policy?.killSwitchState?.revision !== "string" ||
        policy.killSwitchState.revision.length === 0
      ) {
        this.#fail("D2E4O_ACTIVE_POLICY_REJECTED", traceId);
      }

      if (
        audit?.version !== AUDIT_VERSION ||
        audit?.policyVersion !== active.policyVersion ||
        audit?.authoritativeTenantLocator !== active.authoritativeTenantLocator ||
        audit?.environment !== "PREVIEW" ||
        audit?.activatedAt !== active.updatedAt
      ) {
        this.#fail("D2E4O_POLICY_BINDING_REJECTED", traceId);
      }

      if (
        authority.authoritativeTenantId !== active.authoritativeTenantLocator ||
        authority.authoritativeTenantLocator !== active.authoritativeTenantLocator
      ) {
        this.#fail("D2E4O_POLICY_TENANT_BINDING_REJECTED", traceId);
      }

      if (policy.mode !== "CANARY" || policy.enabled !== true) {
        this.#fail("D2E4O_POLICY_DISABLED", traceId);
      }
      if (policy.killSwitchState.state !== "OFF") {
        this.#fail("D2E4O_POLICY_KILL_SWITCHED", traceId);
      }

      const expiresAtMs = parseIsoExpiry(policy.expiresAt);
      const certifiedAtMs = this.#clock();

      if (
        !policy.allowedSyntheticFixtureLocators.includes(
          authority.syntheticFixtureLocator,
        ) ||
        !policy.allowedIntentClasses.includes(authority.intentClass)
      ) {
        this.#fail("D2E4O_POLICY_NOT_ELIGIBLE", traceId);
      }
      if (expiresAtMs <= certifiedAtMs) {
        this.#fail("D2E4O_POLICY_EXPIRED", traceId);
      }
      if (active.updatedAt > certifiedAtMs) {
        this.#fail("D2E4O_POLICY_BINDING_REJECTED", traceId);
      }

      const digestInput = Object.freeze({
        schemaVersion: policy.version,
        activationVersion: policy.activationVersion,
        policyVersion: policy.policyVersion,
        authoritativeTenantLocator: policy.authoritativeTenantLocator,
        environment: policy.environment,
        mode: policy.mode,
        enabled: policy.enabled,
        expiresAtMs,
        killSwitchState: Object.freeze({
          environment: policy.killSwitchState.environment,
          state: policy.killSwitchState.state,
          revision: policy.killSwitchState.revision,
          source: policy.killSwitchState.source,
        }),
        allowedSyntheticFixtureLocators: Object.freeze([
          ...policy.allowedSyntheticFixtureLocators,
        ]),
        allowedIntentClasses: Object.freeze([
          ...policy.allowedIntentClasses,
        ]),
        source: policy.source,
      });

      let policyArtifactDigest;
      try {
        policyArtifactDigest = policyArtifactDigestV1(digestInput);
      } catch (error) {
        this.#fail(
          "D2E4O_ACTIVE_POLICY_REJECTED",
          traceId,
          safeErrorDetails(error),
        );
      }

      return createPolicyReadinessReceiptV1({
        receiptId: this.#receiptIdFactory(),
        projectId: PROJECT_ID,
        authoritativeTenantId: authority.authoritativeTenantId,
        authoritativeTenantLocator: authority.authoritativeTenantLocator,
        policyVersion: policy.policyVersion,
        activePointerVersion: active.version,
        policyArtifactDigest,
        activationAuditId: active.auditId,
        killSwitchState: {
          revision: policy.killSwitchState.revision,
        },
        allowedSyntheticFixtureLocators:
          policy.allowedSyntheticFixtureLocators,
        allowedIntentClasses: policy.allowedIntentClasses,
        activatedAtMs: audit.activatedAt,
        expiresAtMs,
        certifiedAtMs,
      });
    } catch (error) {
      if (error instanceof D2E4OPolicyRepositoryError && isRuntimeErrorV1(error)) {
        throw error;
      }
      if (error instanceof D2E4OPolicyRepositoryError) {
        throw error;
      }
      throw this.#error(
        error?.message === "D2E4O_POLICY_EXPIRY_REJECTED"
          ? "D2E4O_POLICY_EXPIRY_REJECTED"
          : "D2E4O_POLICY_READ_FAILED",
        traceId,
        safeErrorDetails(error),
      );
    }
  }
}
