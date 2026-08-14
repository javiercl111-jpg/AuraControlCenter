import { randomUUID } from "node:crypto";

import {
  assertAuthorityReceiptV1,
  authorityEvidenceDigestV1,
  createAuthorityReceiptV1,
  createRuntimeErrorFieldsV1,
  isRuntimeErrorV1,
} from "./ai-ux-02d2e4x-policy-readiness-contract-v1.mjs";

const PROJECT_ID = "aura-intel-preview";
const AUTHORITY_RECEIPT_TTL_MS = 60_000;

const TENANT = /^tenant-[a-f0-9]{64}$/u;
const FIXTURE = /^SYNTHETIC_FIXTURE_V1_[A-F0-9]{32}$/u;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/u;
const REQUEST_FIELDS = Object.freeze([
  "authoritativeTenantId",
  "syntheticFixtureLocator",
  "intentClass",
  "turnId",
  "traceId",
]);

export class D2E4NAuthorityError extends Error {
  constructor(input) {
    const fields = typeof input === "string" ? null : input;
    const code = fields?.code ?? input;
    super(fields?.message ?? code);
    Object.defineProperty(this, "name", {
      configurable: true,
      enumerable: false,
      writable: true,
      value: "D2E4NAuthorityError",
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

function runtimeFailureFields(code, context) {
  if (
    !SAFE_ID.test(context?.traceId ?? "") ||
    typeof context?.clock !== "function" ||
    typeof context?.errorIdFactory !== "function"
  ) {
    return null;
  }

  try {
    return createRuntimeErrorFieldsV1({
      errorId: context.errorIdFactory(),
      code,
      stage: "AUTHORITY",
      producer: "D2E4N_AUTHORITY",
      severity: "BLOCKING",
      message: code,
      cause: isRuntimeErrorV1(context.cause) ? context.cause : null,
      retryable: false,
      partialSideEffects: false,
      details: { ...(context.details ?? {}) },
      traceId: context.traceId,
      occurredAtMs: context.clock(),
    });
  } catch {
    return null;
  }
}

function fail(code, context) {
  throw new D2E4NAuthorityError(
    runtimeFailureFields(code, context) ?? code,
  );
}

function hasExactFields(value, fields) {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    (Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null)
  ) {
    return false;
  }
  const actual = Object.keys(value).sort();
  const expected = [...fields].sort();
  return actual.length === expected.length &&
    actual.every((field, index) => field === expected[index]);
}

function assertRequest(input, context) {
  if (
    !hasExactFields(input, REQUEST_FIELDS) ||
    !TENANT.test(input?.authoritativeTenantId ?? "") ||
    !FIXTURE.test(input?.syntheticFixtureLocator ?? "") ||
    !new Set(["CLARIFICATION", "DISCOVER_PROBLEM"]).has(
      input?.intentClass,
    ) ||
    !SAFE_ID.test(input?.turnId ?? "") ||
    !SAFE_ID.test(input?.traceId ?? "")
  ) {
    fail("D2E4N_AUTHORITY_REQUEST_REJECTED", context);
  }
}

export function assertCertifiedPreviewAuthorityV1(
  authority,
  { atMs, traceId, clock = Date.now, errorIdFactory } = {},
) {
  try {
    assertAuthorityReceiptV1(authority, { atMs });
    if (authority.projectId !== PROJECT_ID) {
      throw new TypeError("D2E4N_PROJECT_REJECTED");
    }
  } catch (cause) {
    fail("D2E4N_CERTIFIED_AUTHORITY_REJECTED", {
      traceId,
      clock,
      errorIdFactory,
      cause,
      details: { observedName: cause?.name ?? "Error" },
    });
  }

  return authority;
}

export function createFirestorePreviewAuthorityFactoryV1({
  db,
  linkId,
  sessionId,
  clock = Date.now,
  receiptIdFactory = () => `authority-receipt-${randomUUID()}`,
  errorIdFactory = () => `authority-error-${randomUUID()}`,
}) {
  if (
    !db ||
    typeof db.collection !== "function" ||
    !SAFE_ID.test(linkId ?? "") ||
    !SAFE_ID.test(sessionId ?? "") ||
    typeof clock !== "function" ||
    typeof receiptIdFactory !== "function" ||
    typeof errorIdFactory !== "function"
  ) {
    fail("D2E4N_FACTORY_CONFIGURATION_REJECTED");
  }

  return async function authorityFactory(input) {
    const failureContext = {
      traceId: input?.traceId,
      clock,
      errorIdFactory,
    };
    assertRequest(input, failureContext);

    let linkSnapshot;
    let sessionSnapshot;
    try {
      [linkSnapshot, sessionSnapshot] = await Promise.all([
        db.collection("market_discovery_links").doc(linkId).get(),
        db.collection("discovery_sessions").doc(sessionId).get(),
      ]);
    } catch (cause) {
      fail("D2E4N_REMOTE_BINDING_READ_FAILED", {
        ...failureContext,
        cause,
        details: { observedName: cause?.name ?? "Error" },
      });
    }

    if (!linkSnapshot.exists || !sessionSnapshot.exists) {
      fail("D2E4N_REMOTE_BINDING_MISSING", failureContext);
    }

    const link = linkSnapshot.data();
    const session = sessionSnapshot.data();

    if (
      link?.synthetic !== true ||
      link?.environment !== "PREVIEW" ||
      link?.projectId !== PROJECT_ID ||
      link?.tenantId !== input.authoritativeTenantId ||
      link?.fixtureLocator !== input.syntheticFixtureLocator ||
      link?.requiredCapability !== "EVALUATE_CONVERSATION" ||
      link?.linkId !== linkId ||
      link?.sessionId !== sessionId ||
      session?.synthetic !== true ||
      session?.environment !== "PREVIEW" ||
      session?.projectId !== PROJECT_ID ||
      session?.tenantId !== input.authoritativeTenantId ||
      session?.fixtureLocator !== input.syntheticFixtureLocator ||
      session?.linkId !== linkId ||
      session?.sessionId !== sessionId
    ) {
      fail("D2E4N_REMOTE_BINDING_REJECTED", failureContext);
    }

    const evidenceDigest = authorityEvidenceDigestV1({
      authorityEvidenceSchema: "AUTHORITY_EVIDENCE_V1",
      environment: "PREVIEW",
      projectId: PROJECT_ID,
      authoritativeTenantId: input.authoritativeTenantId,
      authoritativeTenantLocator: input.authoritativeTenantId,
      syntheticFixtureLocator: input.syntheticFixtureLocator,
      linkId,
      sessionId,
      turnId: input.turnId,
      intentClass: input.intentClass,
      linkEvidence: {
        synthetic: link.synthetic,
        environment: link.environment,
        projectId: link.projectId,
        tenantId: link.tenantId,
        fixtureLocator: link.fixtureLocator,
        requiredCapability: link.requiredCapability,
        linkId: link.linkId,
        sessionId: link.sessionId,
      },
      sessionEvidence: {
        synthetic: session.synthetic,
        environment: session.environment,
        projectId: session.projectId,
        tenantId: session.tenantId,
        fixtureLocator: session.fixtureLocator,
        linkId: session.linkId,
        sessionId: session.sessionId,
      },
    });
    const certifiedAtMs = clock();

    let authority;
    try {
      authority = createAuthorityReceiptV1({
        receiptId: receiptIdFactory(),
        projectId: PROJECT_ID,
        authoritativeTenantId: input.authoritativeTenantId,
        authoritativeTenantLocator: input.authoritativeTenantId,
        syntheticFixtureLocator: input.syntheticFixtureLocator,
        linkId,
        sessionId,
        turnId: input.turnId,
        intentClass: input.intentClass,
        evidenceDigest,
        certifiedAtMs,
        expiresAtMs: certifiedAtMs + AUTHORITY_RECEIPT_TTL_MS,
      });
    } catch (cause) {
      fail("D2E4N_AUTHORITY_CERTIFICATION_FAILED", {
        ...failureContext,
        cause,
        details: { observedName: cause?.name ?? "Error" },
      });
    }

    return assertCertifiedPreviewAuthorityV1(authority, {
      atMs: certifiedAtMs,
      traceId: input.traceId,
      clock,
      errorIdFactory,
    });
  };
}
