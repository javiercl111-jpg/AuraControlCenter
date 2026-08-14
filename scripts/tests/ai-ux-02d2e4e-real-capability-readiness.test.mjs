import assert from "node:assert/strict";
import test from "node:test";

import {
  EXPECTED_PREVIEW_RUNTIME_REVISION,
  RealCanaryPolicyRevalidationAdapterV1,
  RealCapabilityRotationAuthorityAdapterV1,
  RealConsumerBoundaryReadinessAdapterV1,
  createOperationalD2E4EFinalCeremonyEntrypointV1,
} from "../ai-ux-02d2e4e-real-capability-readiness.mjs";
import {
  assertRuntimeErrorV1,
  createAuthorityReceiptV1,
  createPolicyReadinessReceiptV1,
} from "../ai-ux-02d2e4x-policy-readiness-contract-v1.mjs";

const NOW = Date.parse("2026-08-12T20:00:00.000Z");
const FIXTURE = "SYNTHETIC_FIXTURE_V1_8E5D766A3132FF687116E522304115BE";
const POLICY = "AI_UX_02D3_PREVIEW_CANARY_20260812_V4";
const TRACE_ID = "trace-d2e4e-policy-readiness-test";
const authority = createAuthorityReceiptV1({
  receiptId: "authority-receipt-d2e4e-policy-test",
  projectId: "aura-intel-preview",
  authoritativeTenantId: `tenant-${"ab".repeat(32)}`,
  authoritativeTenantLocator: `tenant-${"ab".repeat(32)}`,
  syntheticFixtureLocator: FIXTURE,
  intentClass: "DISCOVER_PROBLEM",
  linkId: "synthetic_link_certified_v1",
  sessionId: "synthetic_session_certified_v1",
  turnId: "AI_UX_02D3_CANARY_TURN_0001",
  evidenceDigest: "33".repeat(32),
  certifiedAtMs: NOW - 1_000,
  expiresAtMs: NOW + 60_000,
});

const policyAuthority = authority;

const expectation = Object.freeze({
  capabilityLocator: "capability_locator_certified_v1",
  expectedTokenHash: "cd".repeat(32),
  expectedCapabilityVersion: "DISCOVERY_CAPABILITY_V1",
  expectedUpdatedAt: NOW - 10_000,
  expectedExpiresAt: NOW - 1,
  expectedRotationVersion: 0,
});

function authorityFactory(events, produced = authority) {
  return (input) => {
    events?.push("authority.resolve");
    assert.deepEqual(input, {
      authoritativeTenantId: authority.authoritativeTenantId,
      syntheticFixtureLocator: authority.syntheticFixtureLocator,
      intentClass: authority.intentClass,
      turnId: authority.turnId,
      traceId: TRACE_ID,
    });
    return produced;
  };
}

const preflightInput = Object.freeze({
  authoritativeTenantId: authority.authoritativeTenantId,
  syntheticFixtureLocator: authority.syntheticFixtureLocator,
  intentClass: authority.intentClass,
  turnId: "AI_UX_02D3_CANARY_TURN_0001",
  operationId: "AI_UX_02D2E4E_ROTATION_01",
  changeId: "AI_UX_02D2E4E_CHANGE_01",
  policyVersion: POLICY,
  traceId: TRACE_ID,
});

function rotationRepository(overrides = {}) {
  return {
    inspectCalls: 0,
    rotateCalls: 0,
    async inspectExpired(received, now, context) {
      this.inspectCalls += 1;
      assert.deepEqual(received, authority);
      assert.equal(now, NOW);
      assert.equal(context?.traceId, TRACE_ID);
      return { ...expectation, ...overrides };
    },
    async rotate() {
      this.rotateCalls += 1;
      throw new Error("REMOTE_WRITE_FORBIDDEN_IN_D2E4E");
    },
  };
}

function browserRuntime(status = "READY") {
  return {
    async inspectReadiness() {
      return {
        status,
        environment: "PREVIEW",
        automation: "PLAYWRIGHT_CORE",
        executableAvailable: true,
        consumerAvailable: true,
        persistentStorageUsed: false,
      };
    },
  };
}

function policyReceipt(overrides = {}) {
  return createPolicyReadinessReceiptV1({
    receiptId: "policy-receipt-d2e4e-test",
    projectId: "aura-intel-preview",
    authoritativeTenantId: policyAuthority.authoritativeTenantId,
    authoritativeTenantLocator: policyAuthority.authoritativeTenantLocator,
    policyVersion: POLICY,
    activePointerVersion: "DISCOVERY_ADAPTIVE_CANARY_ACTIVE_POINTER_V1",
    policyArtifactDigest: "44".repeat(32),
    activationAuditId: "activation-audit-d2e4e-test",
    killSwitchState: { revision: "kill-switch-d2e4e-test" },
    allowedSyntheticFixtureLocators: [FIXTURE],
    allowedIntentClasses: ["CLARIFICATION", "DISCOVER_PROBLEM"],
    activatedAtMs: NOW - 10_000,
    expiresAtMs: NOW + 30 * 60 * 1_000,
    certifiedAtMs: NOW,
    ...overrides,
  });
}

function policyRepository({ receipt = policyReceipt() } = {}) {
  return {
    resolveCalls: 0,
    activateCalls: 0,
    async resolveActive(input, context) {
      this.resolveCalls += 1;
      assert.equal(input, policyAuthority);
      assert.deepEqual(context, { traceId: TRACE_ID });
      return receipt;
    },
    async activateImmutable() {
      this.activateCalls += 1;
      throw new Error("REMOTE_WRITE_FORBIDDEN_IN_D2E4E");
    },
  };
}

function runtimeRevisionReader(revision = EXPECTED_PREVIEW_RUNTIME_REVISION) {
  return {
    async readCurrentRevision() {
      return {
        status: "READY",
        environment: "PREVIEW",
        revision,
        failedRevisions: 0,
      };
    },
  };
}

class BootstrapAdapterContract {
  async claimEphemeral() {}
}

class CertifiedRotatorContract {
  constructor(...dependencies) {
    this.dependencies = dependencies;
  }
  async issueAndRotate() {
    throw new Error("REMOTE_ISSUANCE_FORBIDDEN_IN_D2E4E");
  }
}

test("consumer boundary validates repository bindings and browser contract read-only", async () => {
  const repository = rotationRepository();
  const adapter = new RealConsumerBoundaryReadinessAdapterV1({
    rotationRepository: repository,
    browserRuntime: browserRuntime(),
    bootstrapAdapterClass: BootstrapAdapterContract,
  });
  const result = await adapter.assertReady(authority, NOW, {
    traceId: TRACE_ID,
  });
  assert.equal(result.status, "READY");
  assert.equal(result.environment, "PREVIEW");
  assert.equal(result.persistentStorageUsed, false);
  assert.match(result.boundaryLocator, /^[a-f0-9]{64}$/u);
  assert.equal(repository.inspectCalls, 1);
  assert.equal(repository.rotateCalls, 0);
});

test("consumer boundary fails closed for unavailable browser runtime", async () => {
  const adapter = new RealConsumerBoundaryReadinessAdapterV1({
    rotationRepository: rotationRepository(),
    browserRuntime: browserRuntime("UNAVAILABLE"),
    bootstrapAdapterClass: BootstrapAdapterContract,
  });
  await assert.rejects(() => adapter.assertReady(authority, NOW, {
    traceId: TRACE_ID,
  }),
    /D2E4E_BROWSER_CONSUMER_NOT_READY/u);
});

test("rotation authority uses certified assertion and expired repository state", async () => {
  const repository = rotationRepository();
  let assertions = 0;
  const adapter = new RealCapabilityRotationAuthorityAdapterV1({
    rotationRepository: repository,
    assertCertifiedAuthority(value, options) {
      assertions += 1;
      assert.deepEqual(value, authority);
      assert.equal(options.atMs, NOW);
      assert.equal(options.traceId, TRACE_ID);
    },
  });
  const result = await adapter.revalidate({
    authority,
    operationId: "AI_UX_02D2E4E_ROTATION_01",
    changeId: "AI_UX_02D2E4E_CHANGE_01",
    now: NOW,
    traceId: TRACE_ID,
  });
  assert.equal(result.status, "AUTHORIZED");
  assert.equal(assertions, 1);
  assert.equal(repository.inspectCalls, 1);
  assert.equal(repository.rotateCalls, 0);
});

test("rotation authority rejects Production before repository access", async () => {
  const repository = rotationRepository();
  const adapter = new RealCapabilityRotationAuthorityAdapterV1({
    rotationRepository: repository,
    assertCertifiedAuthority() {},
  });
  await assert.rejects(() => adapter.revalidate({
    authority: { ...authority, environment: "PRODUCTION" },
    operationId: "AI_UX_02D2E4E_ROTATION_01",
    changeId: "AI_UX_02D2E4E_CHANGE_01",
    now: NOW,
    traceId: TRACE_ID,
  }), /D2E4E_CAPABILITY_AUTHORITY_REJECTED/u);
  assert.equal(repository.inspectCalls, 0);
});

test("Canary revalidation proves exact active policy, fixture, intent, kill switch, and runtime", async () => {
  const expectedReceipt = policyReceipt();
  const repository = policyRepository({ receipt: expectedReceipt });
  const adapter = new RealCanaryPolicyRevalidationAdapterV1({
    policyRepository: repository,
    runtimeRevisionReader: runtimeRevisionReader(),
    clock: () => NOW,
    errorIdFactory: () => "readiness-error-d2e4e-test",
  });
  const result = await adapter.revalidate({
    authority: policyAuthority,
    policyVersion: POLICY,
    traceId: TRACE_ID,
  });
  assert.equal(result, expectedReceipt);
  assert.equal(result.contractName, "PolicyReadinessReceiptV1");
  assert.equal(result.expiresAtMs, NOW + 30 * 60 * 1_000);
  assert.equal(Object.hasOwn(result, "expiresAt"), false);
  assert.equal(repository.resolveCalls, 1);
  assert.equal(repository.activateCalls, 0);
});

test("Canary revalidation fails closed on runtime revision mismatch", async () => {
  const adapter = new RealCanaryPolicyRevalidationAdapterV1({
    policyRepository: policyRepository(),
    runtimeRevisionReader: runtimeRevisionReader("evaluateconversation-unsafe"),
    clock: () => NOW,
    errorIdFactory: () => "readiness-error-runtime-mismatch",
  });
  await assert.rejects(() => adapter.revalidate({
    authority: policyAuthority,
    policyVersion: POLICY,
    traceId: TRACE_ID,
  }), (error) => {
    assert.equal(error.code, "D2E4E_CANARY_POLICY_NOT_READY");
    assert.equal(assertRuntimeErrorV1(error), error);
    return true;
  });
});

test("operational entrypoint preserves exact authority through all consumers", async () => {
  const events = [];
  const repository = rotationRepository();
  const originalInspect = repository.inspectExpired.bind(repository);
  repository.inspectExpired = async (...args) => {
    events.push("repository.inspectExpired");
    return originalInspect(...args);
  };
  const policies = policyRepository();
  const originalResolve = policies.resolveActive.bind(policies);
  policies.resolveActive = async (...args) => {
    events.push("policy.resolveActive");
    return originalResolve(...args);
  };
  let runnerCreations = 0;
  const entrypoint = createOperationalD2E4EFinalCeremonyEntrypointV1({
    rotationRepository: repository,
    authorityFactory: authorityFactory(events),
    policyRepository: policies,
    assertCertifiedAuthority(value) {
      events.push("authority.assert");
      assert.equal(value, authority);
    },
    browserRuntime: browserRuntime(),
    runtimeRevisionReader: runtimeRevisionReader(),
    rotatorClass: CertifiedRotatorContract,
    runnerFactory() {
      runnerCreations += 1;
      events.push("runner.create");
      return { state: "CREATED" };
    },
    clock: () => NOW,
  });
  const result = await entrypoint.preflight(preflightInput);
  assert.equal(result.status, "CEREMONY_READY");
  assert.equal(result.authoritativeBinding.authoritativeTenantId,
    authority.authoritativeTenantId);
  assert.equal(result.authoritativeBinding.authoritativeTenantLocator,
    authority.authoritativeTenantLocator);
  assert.equal(result.authoritativeBinding.intentClass, authority.intentClass);
  assert.equal(result.authoritativeBinding.turnId, authority.turnId);
  assert.equal(runnerCreations, 1);
  assert.deepEqual(events, [
    "authority.resolve",
    "authority.assert",
    "repository.inspectExpired",
    "repository.inspectExpired",
    "authority.assert",
    "repository.inspectExpired",
    "policy.resolveActive",
    "runner.create",
  ]);
  assert.equal(policies.resolveCalls, 1);
  assert.equal(repository.rotateCalls, 0);
  assert.equal(policies.activateCalls, 0);
});

test("missing binding field fails preflight before ceremony or writes", async () => {
  const repository = rotationRepository();
  const policies = policyRepository();
  let runnerCreations = 0;
  const entrypoint = createOperationalD2E4EFinalCeremonyEntrypointV1({
    rotationRepository: repository,
    authorityFactory: authorityFactory(undefined, Object.freeze({
      ...authority,
      turnId: undefined,
    })),
    policyRepository: policies,
    assertCertifiedAuthority() {},
    browserRuntime: browserRuntime(),
    runtimeRevisionReader: runtimeRevisionReader(),
    rotatorClass: CertifiedRotatorContract,
    runnerFactory() { runnerCreations += 1; },
    clock: () => NOW,
  });
  await assert.rejects(() => entrypoint.preflight(preflightInput),
    /D2E4F_AUTHORITATIVE_BINDING_REJECTED/u);
  assert.equal(runnerCreations, 0);
  assert.equal(repository.rotateCalls, 0);
  assert.equal(policies.activateCalls, 0);
});
