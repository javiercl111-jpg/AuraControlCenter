import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import test from "node:test";

import {
  RealConsumerBoundaryReadinessAdapterV1,
} from "../ai-ux-02d2e4e-real-capability-readiness.mjs";
import {
  AuthoritativeJitFixtureSessionBindingResolverV1,
} from "../ai-ux-02d2e4f-authoritative-jit-binding.mjs";
import {
  FirestoreSyntheticCapabilityRotationRepositoryV1,
} from "../ai-ux-02d2e4m-live-capability-rotation-repository.mjs";
import {
  assertCertifiedPreviewAuthorityV1,
  createFirestorePreviewAuthorityFactoryV1,
} from "../ai-ux-02d2e4n-live-preview-authority.mjs";
import {
  FirestoreAdaptiveCanaryPolicyRepositoryV1,
} from "../ai-ux-02d2e4o-live-adaptive-canary-policy-repository.mjs";
import {
  assertAuthorityReceiptV1,
  assertRuntimeErrorV1,
} from "../ai-ux-02d2e4x-policy-readiness-contract-v1.mjs";

const NOW = Date.parse("2026-08-13T18:00:00.000Z");
const TENANT = `tenant-${"ab".repeat(32)}`;
const OTHER_TENANT = `tenant-${"cd".repeat(32)}`;
const FIXTURE =
  "SYNTHETIC_FIXTURE_V1_8E5D766A3132FF687116E522304115BE";
const LINK = "synthetic-link-authority-contract-test";
const SESSION = "synthetic-session-authority-contract-test";
const TURN = "synthetic-turn-authority-contract-test";
const TRACE = "trace-authority-contract-test";
const POLICY = "AI_UX_02D3_PREVIEW_CANARY_POLICY_TEST_V1";
const AUDIT_ID = "authority-contract-policy-audit";
const CAPABILITY_HASH = "aa".repeat(32);

function snapshot(data, exists = true) {
  return Object.freeze({ exists, data: () => data });
}

function authorityDb(overrides = {}) {
  const link = {
    synthetic: true,
    environment: "PREVIEW",
    projectId: "aura-intel-preview",
    tenantId: TENANT,
    fixtureLocator: FIXTURE,
    requiredCapability: "EVALUATE_CONVERSATION",
    linkId: LINK,
    sessionId: SESSION,
    ...(overrides.link ?? {}),
  };
  const session = {
    synthetic: true,
    environment: "PREVIEW",
    projectId: "aura-intel-preview",
    tenantId: TENANT,
    fixtureLocator: FIXTURE,
    linkId: LINK,
    sessionId: SESSION,
    ...(overrides.session ?? {}),
  };
  const reads = [];
  return {
    reads,
    collection(name) {
      return {
        doc(id) {
          return {
            async get() {
              reads.push({ name, id });
              return name === "market_discovery_links"
                ? snapshot(link)
                : snapshot(session);
            },
          };
        },
      };
    },
  };
}

function producer(db = authorityDb()) {
  return createFirestorePreviewAuthorityFactoryV1({
    db,
    linkId: LINK,
    sessionId: SESSION,
    clock: () => NOW,
    receiptIdFactory: () => "authority-receipt-contract-test",
    errorIdFactory: () => "authority-error-contract-test",
  });
}

function authorityRequest(overrides = {}) {
  return {
    authoritativeTenantId: TENANT,
    syntheticFixtureLocator: FIXTURE,
    intentClass: "DISCOVER_PROBLEM",
    turnId: TURN,
    traceId: TRACE,
    ...overrides,
  };
}

function policyDb() {
  const active = Object.freeze({
    version: "DISCOVERY_ADAPTIVE_CANARY_ACTIVE_POINTER_V1",
    policyVersion: POLICY,
    environment: "PREVIEW",
    authoritativeTenantLocator: TENANT,
    auditId: AUDIT_ID,
    updatedAt: NOW - 10_000,
  });
  const policy = Object.freeze({
    version: "DISCOVERY_ADAPTIVE_CANARY_POLICY_V1",
    activationVersion: "DISCOVERY_ADAPTIVE_ACTIVATION_V1",
    policyVersion: POLICY,
    authoritativeTenantLocator: TENANT,
    environment: "PREVIEW",
    mode: "CANARY",
    enabled: true,
    expiresAt: "2026-08-13T18:30:00.000Z",
    killSwitchState: Object.freeze({
      environment: "PREVIEW",
      state: "OFF",
      revision: "kill-switch-contract-test",
      source: "SERVER_CONFIGURATION",
    }),
    allowedSyntheticFixtureLocators: Object.freeze([FIXTURE]),
    allowedIntentClasses: Object.freeze([
      "CLARIFICATION",
      "DISCOVER_PROBLEM",
    ]),
    source: "SERVER_CONFIGURATION",
  });
  const audit = Object.freeze({
    version: "DISCOVERY_ADAPTIVE_CANARY_POLICY_AUDIT_V1",
    policyVersion: POLICY,
    previousPolicyVersion: "previous-policy",
    authoritativeTenantLocator: TENANT,
    environment: "PREVIEW",
    actorLocator: "policy-actor-contract-test",
    reasonCode: "POLICY_TEST",
    activatedAt: NOW - 10_000,
  });
  const reads = [];
  const writes = [];
  return {
    reads,
    writes,
    collection(name) {
      const kind = {
        discoveryAdaptiveCanaryActiveV1: "active",
        discoveryAdaptiveCanaryPoliciesV1: "policy",
        discoveryAdaptiveCanaryAuditV1: "audit",
      }[name];
      return {
        doc(id) { return { kind, id }; },
        where(field, operator, value) {
          return { limit: (limit) => ({
            kind,
            field,
            operator,
            value,
            limit,
          }) };
        },
      };
    },
    async runTransaction(callback) {
      return callback({
        async get(target) {
          reads.push(target);
          if (target.kind === "active") return snapshot(active);
          if (target.kind === "policy") {
            return { size: 1, docs: [snapshot(policy)] };
          }
          assert.equal(
            target.id,
            createHash("sha256").update(AUDIT_ID, "utf8").digest("hex"),
          );
          return snapshot(audit);
        },
      });
    },
  };
}

function capabilityDb({ tenantId = TENANT } = {}) {
  const reads = [];
  const link = {
    synthetic: true,
    environment: "PREVIEW",
    projectId: "aura-intel-preview",
    tenantId,
    fixtureLocator: FIXTURE,
    requiredCapability: "EVALUATE_CONVERSATION",
    linkId: LINK,
    sessionId: SESSION,
    sessionCapabilityHash: CAPABILITY_HASH,
  };
  const capability = {
    version: "DISCOVERY_CAPABILITY_V1",
    type: "SESSION",
    purpose: "DISCOVERY_SESSION",
    synthetic: true,
    environment: "PREVIEW",
    projectId: "aura-intel-preview",
    tenantId,
    fixtureLocator: FIXTURE,
    requiredCapability: "EVALUATE_CONVERSATION",
    capabilityScope: "DISCOVERY_SESSION",
    linkId: LINK,
    sessionId: SESSION,
    tokenHash: CAPABILITY_HASH,
    generation: 1,
    updatedAt: NOW - 10_000,
    expiresAt: NOW - 1,
  };
  return {
    reads,
    collection(name) {
      return {
        doc(id) {
          return {
            async get() {
              reads.push({ name, id });
              return snapshot(
                name === "market_discovery_links" ? link : capability,
              );
            },
          };
        },
      };
    },
  };
}

test("D2E4N produces exact AuthorityReceiptV1 with complete frozen binding", async () => {
  const authority = await producer()(authorityRequest());
  assert.equal(assertAuthorityReceiptV1(authority, { atMs: NOW }), authority);
  assert.equal(Object.keys(authority).length, 16);
  assert.equal(Object.hasOwn(authority, "authorityRevision"), false);
  assert.equal(Object.hasOwn(authority, "targetProjectId"), false);
  assert.deepEqual(
    {
      authoritativeTenantId: authority.authoritativeTenantId,
      authoritativeTenantLocator: authority.authoritativeTenantLocator,
      syntheticFixtureLocator: authority.syntheticFixtureLocator,
      intentClass: authority.intentClass,
      linkId: authority.linkId,
      sessionId: authority.sessionId,
      turnId: authority.turnId,
    },
    {
      authoritativeTenantId: TENANT,
      authoritativeTenantLocator: TENANT,
      syntheticFixtureLocator: FIXTURE,
      intentClass: "DISCOVER_PROBLEM",
      linkId: LINK,
      sessionId: SESSION,
      turnId: TURN,
    },
  );
});

test("D2E4F and D2E4E preserve the same receipt and seven-field tuple", async () => {
  const authorityFactory = producer();
  const repository = {
    inspectExpired(received, atMs, context) {
      assert.equal(received.contractName, "AuthorityReceiptV1");
      assert.equal(atMs, NOW);
      assert.deepEqual(context, { traceId: TRACE });
      return Object.freeze({
        capabilityLocator: CAPABILITY_HASH,
        expectedTokenHash: CAPABILITY_HASH,
        expectedCapabilityVersion: "DISCOVERY_CAPABILITY_V1",
        expectedUpdatedAt: NOW - 10_000,
        expectedExpiresAt: NOW - 1,
        expectedRotationVersion: 0,
      });
    },
  };
  const resolution = await new AuthoritativeJitFixtureSessionBindingResolverV1({
    authorityFactory,
    rotationRepository: repository,
    assertCertifiedAuthority: assertCertifiedPreviewAuthorityV1,
    errorIdFactory: () => "binding-error-contract-test",
  }).resolve({ ...authorityRequest(), now: NOW });
  const readiness = new RealConsumerBoundaryReadinessAdapterV1({
    rotationRepository: repository,
    browserRuntime: {
      async inspectReadiness() {
        return {
          status: "READY",
          environment: "PREVIEW",
          automation: "PLAYWRIGHT_CORE",
          executableAvailable: true,
          consumerAvailable: true,
          persistentStorageUsed: false,
        };
      },
    },
    bootstrapAdapterClass: class { async claimEphemeral() {} },
  });
  const ready = await readiness.assertReady(resolution.authority, NOW, {
    traceId: TRACE,
  });
  assert.equal(ready.status, "READY");
  assert.equal(resolution.binding.turnId, resolution.authority.turnId);
  assert.equal(resolution.binding.intentClass, resolution.authority.intentClass);
  assert.equal(resolution.binding.authoritativeTenantLocator,
    resolution.authority.authoritativeTenantLocator);
});

test("D2E4O consumes the exact D2E4N receipt without reconstruction", async () => {
  const authority = await producer()(authorityRequest());
  const db = policyDb();
  const policy = await new FirestoreAdaptiveCanaryPolicyRepositoryV1({
    db,
    clock: () => NOW,
    receiptIdFactory: () => "policy-receipt-authority-contract-test",
    errorIdFactory: () => "policy-error-authority-contract-test",
  }).resolveActive(authority, { traceId: TRACE });
  assert.equal(policy.contractName, "PolicyReadinessReceiptV1");
  assert.equal(policy.authoritativeTenantId, authority.authoritativeTenantId);
  assert.equal(policy.authoritativeTenantLocator,
    authority.authoritativeTenantLocator);
  assert.equal(db.writes.length, 0);
});

test("D2E4M validates exact authority before capability reads", async () => {
  const authority = await producer()(authorityRequest());
  const db = capabilityDb();
  const expectation = await new FirestoreSyntheticCapabilityRotationRepositoryV1({
    db,
    errorIdFactory: () => "rotation-error-authority-contract-test",
  }).inspectExpired(authority, NOW, { traceId: TRACE });
  assert.equal(expectation.capabilityLocator, CAPABILITY_HASH);
  assert.equal(db.reads.length, 2);

  const malformed = Object.freeze({ ...authority, turnId: undefined });
  const rejectedDb = capabilityDb();
  await assert.rejects(
    () => new FirestoreSyntheticCapabilityRotationRepositoryV1({
      db: rejectedDb,
      errorIdFactory: () => "rotation-error-rejection-test",
    }).inspectExpired(malformed, NOW, { traceId: TRACE }),
    (error) => {
      assert.equal(error.code, "D2E4M_AUTHORITY_REJECTED");
      assert.equal(assertRuntimeErrorV1(error), error);
      return true;
    },
  );
  assert.equal(rejectedDb.reads.length, 0);
});

test("tenant, fixture, intent, and turn substitutions fail closed", async () => {
  const authority = await producer()(authorityRequest());
  for (const override of [
    { authoritativeTenantLocator: OTHER_TENANT },
    { syntheticFixtureLocator: undefined },
    { intentClass: "OTHER" },
    { turnId: undefined },
  ]) {
    assert.throws(
      () => assertAuthorityReceiptV1(Object.freeze({
        ...authority,
        ...override,
      }), { atMs: NOW }),
      /AUTHORITY_RECEIPT_V1_REJECTED/u,
    );
  }
});

test("D2E4N failures preserve exact RuntimeErrorV1 and perform no writes", async () => {
  const db = authorityDb({
    link: { tenantId: OTHER_TENANT },
  });
  await assert.rejects(
    () => producer(db)(authorityRequest()),
    (error) => {
      assert.equal(error.code, "D2E4N_REMOTE_BINDING_REJECTED");
      assert.equal(error.stage, "AUTHORITY");
      assert.equal(error.producer, "D2E4N_AUTHORITY");
      assert.equal(error.traceId, TRACE);
      assert.equal(assertRuntimeErrorV1(error), error);
      return true;
    },
  );
  assert.equal(db.reads.length, 2);
});
