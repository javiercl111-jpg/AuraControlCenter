import { randomUUID } from "node:crypto";

import {
  assertAuthorityReceiptV1,
  createRuntimeErrorFieldsV1,
  isRuntimeErrorV1,
} from "./ai-ux-02d2e4x-policy-readiness-contract-v1.mjs";

export const D2E4F_BINDING_VERSION =
  "AI_UX_02D2E4F_AUTHORITATIVE_JIT_FIXTURE_SESSION_BINDING_V1";

const PROJECT_ID = "aura-intel-preview";
const FIXTURE = /^SYNTHETIC_FIXTURE_V1_[A-F0-9]{32}$/u;
const TENANT = /^tenant-[a-f0-9]{64}$/u;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/u;

export class D2E4FBindingError extends Error {
  constructor(input) {
    const fields = typeof input === "string" ? null : input;
    const code = fields?.code ?? input;
    super(fields?.message ?? code);
    Object.defineProperty(this, "name", {
      configurable: true,
      enumerable: false,
      writable: true,
      value: "D2E4FBindingError",
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

function fail(code, context = {}) {
  if (
    SAFE_ID.test(context.traceId ?? "") &&
    Number.isSafeInteger(context.occurredAtMs) &&
    typeof context.errorIdFactory === "function"
  ) {
    const fields = createRuntimeErrorFieldsV1({
      errorId: context.errorIdFactory(),
      code,
      stage: "AUTHORITY",
      producer: "D2E4F_BINDING",
      severity: "BLOCKING",
      message: code,
      cause: isRuntimeErrorV1(context.cause) ? context.cause : null,
      retryable: false,
      partialSideEffects: false,
      details: { ...(context.details ?? {}) },
      traceId: context.traceId,
      occurredAtMs: context.occurredAtMs,
    });
    throw new D2E4FBindingError(fields);
  }
  throw new D2E4FBindingError(code);
}

function assertAuthority(authority, request, errorIdFactory) {
  try {
    assertAuthorityReceiptV1(authority, { atMs: request.now });
  } catch (cause) {
    fail("D2E4F_AUTHORITATIVE_BINDING_REJECTED", {
      traceId: request.traceId,
      occurredAtMs: request.now,
      errorIdFactory,
      cause,
      details: { observedName: cause?.name ?? "Error" },
    });
  }

  if (
    authority.projectId !== PROJECT_ID ||
    authority.authoritativeTenantId !== request.authoritativeTenantId ||
    authority.authoritativeTenantLocator !== request.authoritativeTenantId ||
    authority.syntheticFixtureLocator !== request.syntheticFixtureLocator ||
    authority.intentClass !== request.intentClass ||
    authority.turnId !== request.turnId
  ) {
    fail("D2E4F_AUTHORITATIVE_BINDING_REJECTED", {
      traceId: request.traceId,
      occurredAtMs: request.now,
      errorIdFactory,
    });
  }
}

export class AuthoritativeJitFixtureSessionBindingResolverV1 {
  #authorityFactory;
  #rotationRepository;
  #assertCertifiedAuthority;
  #errorIdFactory;

  constructor({
    authorityFactory,
    rotationRepository,
    assertCertifiedAuthority,
    errorIdFactory = () => `binding-error-${randomUUID()}`,
  }) {
    if (
      typeof authorityFactory !== "function" ||
      typeof rotationRepository?.inspectExpired !== "function" ||
      typeof assertCertifiedAuthority !== "function" ||
      typeof errorIdFactory !== "function"
    ) {
      fail("D2E4F_BINDING_RESOLVER_REJECTED");
    }
    this.#authorityFactory = authorityFactory;
    this.#rotationRepository = rotationRepository;
    this.#assertCertifiedAuthority = assertCertifiedAuthority;
    this.#errorIdFactory = errorIdFactory;
  }

  async resolve(input) {
    if (
      !TENANT.test(input?.authoritativeTenantId ?? "") ||
      !FIXTURE.test(input?.syntheticFixtureLocator ?? "") ||
      !new Set(["CLARIFICATION", "DISCOVER_PROBLEM"]).has(input?.intentClass) ||
      !SAFE_ID.test(input?.turnId ?? "") ||
      !SAFE_ID.test(input?.traceId ?? "") ||
      !Number.isSafeInteger(input?.now)
    ) {
      fail("D2E4F_FIXTURE_LOCATOR_REJECTED", {
        traceId: input?.traceId,
        occurredAtMs: input?.now,
        errorIdFactory: this.#errorIdFactory,
      });
    }

    const authority = await this.#authorityFactory(Object.freeze({
      authoritativeTenantId: input.authoritativeTenantId,
      syntheticFixtureLocator: input.syntheticFixtureLocator,
      intentClass: input.intentClass,
      turnId: input.turnId,
      traceId: input.traceId,
    }));
    assertAuthority(authority, input, this.#errorIdFactory);
    try {
      this.#assertCertifiedAuthority(authority, {
        atMs: input.now,
        traceId: input.traceId,
        errorIdFactory: this.#errorIdFactory,
      });
    } catch (cause) {
      if (isRuntimeErrorV1(cause)) throw cause;
      fail("D2E4F_CERTIFIED_AUTHORITY_REJECTED", {
        traceId: input.traceId,
        occurredAtMs: input.now,
        errorIdFactory: this.#errorIdFactory,
        cause,
        details: { observedName: cause?.name ?? "Error" },
      });
    }

    const expectation = await this.#rotationRepository.inspectExpired(
      authority,
      input.now,
      { traceId: input.traceId },
    );
    if (
      typeof expectation?.capabilityLocator !== "string" ||
      !expectation.capabilityLocator.trim()
    ) {
      fail("D2E4F_REPOSITORY_BINDING_NOT_FOUND", {
        traceId: input.traceId,
        occurredAtMs: input.now,
        errorIdFactory: this.#errorIdFactory,
      });
    }

    const binding = Object.freeze({
      authoritativeTenantId: authority.authoritativeTenantId,
      authoritativeTenantLocator: authority.authoritativeTenantLocator,
      syntheticFixtureLocator: authority.syntheticFixtureLocator,
      intentClass: authority.intentClass,
      linkId: authority.linkId,
      sessionId: authority.sessionId,
      turnId: authority.turnId,
    });
    return Object.freeze({
      version: D2E4F_BINDING_VERSION,
      status: "RESOLVED",
      authority,
      binding,
      fixtureMatch: true,
      tenantMatch: true,
      bootstrapScopeMatch: true,
      capabilityScopeMatch: true,
    });
  }
}

export function createAuthoritativeJitFixtureSessionBindingResolverV1(input) {
  return new AuthoritativeJitFixtureSessionBindingResolverV1(input);
}
