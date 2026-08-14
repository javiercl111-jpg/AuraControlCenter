import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import test from "node:test";

import {
  D2E4OPolicyRepositoryError,
  FirestoreAdaptiveCanaryPolicyRepositoryV1,
} from "../ai-ux-02d2e4o-live-adaptive-canary-policy-repository.mjs";
import {
  assertPolicyReadinessReceiptV1,
  assertRuntimeErrorV1,
} from "../ai-ux-02d2e4x-policy-readiness-contract-v1.mjs";

const NOW = Date.parse("2026-08-13T18:00:00.000Z");
const EXPIRES_AT = "2026-08-13T18:30:00.000Z";
const TENANT = `tenant-${"ab".repeat(32)}`;
const OTHER_TENANT = `tenant-${"cd".repeat(32)}`;
const FIXTURE =
  "SYNTHETIC_FIXTURE_V1_8E5D766A3132FF687116E522304115BE";
const OTHER_FIXTURE =
  "SYNTHETIC_FIXTURE_V1_FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF";
const POLICY = "AI_UX_02D3_PREVIEW_CANARY_POLICY_TEST_V1";
const TRACE_ID = "trace-d2e4o-policy-repository-test";
const AUDIT_ID = "logical-policy-activation-audit-test";

function authority(overrides = {}) {
  return Object.freeze({
    contractName: "AuthorityReceiptV1",
    contractVersion: "V1",
    receiptId: "authority-receipt-d2e4o-test",
    status: "CERTIFIED",
    environment: "PREVIEW",
    projectId: "aura-intel-preview",
    authoritativeTenantId: TENANT,
    authoritativeTenantLocator: TENANT,
    syntheticFixtureLocator: FIXTURE,
    linkId: "synthetic-link-d2e4o-test",
    sessionId: "synthetic-session-d2e4o-test",
    turnId: "synthetic-turn-d2e4o-test",
    intentClass: "DISCOVER_PROBLEM",
    evidenceDigest: "22".repeat(32),
    certifiedAtMs: NOW - 5_000,
    expiresAtMs: NOW + 60_000,
    ...overrides,
  });
}

function active(overrides = {}) {
  return Object.freeze({
    version: "DISCOVERY_ADAPTIVE_CANARY_ACTIVE_POINTER_V1",
    policyVersion: POLICY,
    environment: "PREVIEW",
    authoritativeTenantLocator: TENANT,
    auditId: AUDIT_ID,
    updatedAt: NOW - 10_000,
    ...overrides,
  });
}

function policy(overrides = {}) {
  return Object.freeze({
    version: "DISCOVERY_ADAPTIVE_CANARY_POLICY_V1",
    activationVersion: "DISCOVERY_ADAPTIVE_ACTIVATION_V1",
    policyVersion: POLICY,
    authoritativeTenantLocator: TENANT,
    environment: "PREVIEW",
    mode: "CANARY",
    enabled: true,
    expiresAt: EXPIRES_AT,
    killSwitchState: Object.freeze({
      environment: "PREVIEW",
      state: "OFF",
      revision: "kill-switch-d2e4o-test",
      source: "SERVER_CONFIGURATION",
    }),
    allowedSyntheticFixtureLocators: Object.freeze([FIXTURE]),
    allowedIntentClasses: Object.freeze([
      "CLARIFICATION",
      "DISCOVER_PROBLEM",
    ]),
    source: "SERVER_CONFIGURATION",
    ...overrides,
  });
}

function audit(overrides = {}) {
  return Object.freeze({
    version: "DISCOVERY_ADAPTIVE_CANARY_POLICY_AUDIT_V1",
    policyVersion: POLICY,
    previousPolicyVersion: "previous-policy",
    authoritativeTenantLocator: TENANT,
    environment: "PREVIEW",
    actorLocator: "policy-actor-test",
    reasonCode: "POLICY_TEST",
    activatedAt: NOW - 10_000,
    ...overrides,
  });
}

function snapshot(data, exists = true) {
  return Object.freeze({ exists, data: () => data });
}

function policyStore({
  activeValue = active(),
  policyValues = [policy()],
  auditValue = audit(),
  activeExists = true,
  auditExists = true,
} = {}) {
  const reads = [];
  const writes = [];
  const collections = {
    discoveryAdaptiveCanaryActiveV1: "active",
    discoveryAdaptiveCanaryPoliciesV1: "policy",
    discoveryAdaptiveCanaryAuditV1: "audit",
  };

  return Object.freeze({
    reads,
    writes,
    collection(name) {
      const kind = collections[name];
      if (!kind) throw new Error(`UNEXPECTED_COLLECTION:${name}`);
      return Object.freeze({
        doc(id) {
          return Object.freeze({ kind, id, type: "document" });
        },
        where(field, operator, value) {
          return Object.freeze({
            limit(limit) {
              return Object.freeze({
                kind,
                type: "query",
                field,
                operator,
                value,
                limit,
              });
            },
          });
        },
      });
    },
    async runTransaction(callback) {
      const transaction = Object.freeze({
        async get(target) {
          reads.push(Object.freeze({ ...target }));
          if (target.kind === "active") {
            return snapshot(activeValue, activeExists);
          }
          if (target.kind === "policy") {
            return Object.freeze({
              size: policyValues.length,
              docs: Object.freeze(policyValues.map((value) => snapshot(value))),
            });
          }
          if (target.kind === "audit") {
            assert.equal(
              target.id,
              createHash("sha256").update(AUDIT_ID, "utf8").digest("hex"),
            );
            return snapshot(auditValue, auditExists);
          }
          throw new Error("UNEXPECTED_TRANSACTION_TARGET");
        },
      });
      return callback(transaction);
    },
  });
}

function repository(db = policyStore()) {
  let errorSequence = 0;
  return new FirestoreAdaptiveCanaryPolicyRepositoryV1({
    db,
    clock: () => NOW,
    receiptIdFactory: () => "policy-receipt-d2e4o-test",
    errorIdFactory: () => `policy-error-${++errorSequence}`,
  });
}

async function expectPolicyError(promise, code) {
  let failure;
  try {
    await promise;
  } catch (error) {
    failure = error;
  }
  assert.ok(failure instanceof D2E4OPolicyRepositoryError);
  assert.equal(failure.code, code);
  assert.equal(failure.message, code);
  assert.equal(failure.stage, "POLICY");
  assert.equal(failure.producer, "D2E4O_POLICY_REPOSITORY");
  assert.equal(failure.traceId, TRACE_ID);
  assert.equal(failure.partialSideEffects, false);
  assert.equal(assertRuntimeErrorV1(failure), failure);
  return failure;
}

test("active policy emits exact immutable PolicyReadinessReceiptV1", async () => {
  const db = policyStore();
  const result = await repository(db).resolveActive(authority(), {
    traceId: TRACE_ID,
  });

  assert.equal(assertPolicyReadinessReceiptV1(result, { atMs: NOW }), result);
  assert.equal(result.receiptId, "policy-receipt-d2e4o-test");
  assert.equal(result.projectId, "aura-intel-preview");
  assert.equal(result.authoritativeTenantId, TENANT);
  assert.equal(result.authoritativeTenantLocator, TENANT);
  assert.equal(result.policyVersion, POLICY);
  assert.equal(result.activePointerVersion,
    "DISCOVERY_ADAPTIVE_CANARY_ACTIVE_POINTER_V1");
  assert.match(result.policyArtifactDigest, /^[0-9a-f]{64}$/u);
  assert.equal(result.activationAuditId, AUDIT_ID);
  assert.equal(result.activatedAtMs, NOW - 10_000);
  assert.equal(result.expiresAtMs, Date.parse(EXPIRES_AT));
  assert.equal(result.certifiedAtMs, NOW);
  assert.equal(Object.keys(result).length, 20);
  assert.equal(Object.hasOwn(result, "pointerVersion"), false);
  assert.equal(Object.hasOwn(result, "policy"), false);
  assert.deepEqual(db.reads.map((read) => read.kind), [
    "active",
    "policy",
    "audit",
  ]);
  assert.equal(db.writes.length, 0);
});

test("invalid authority fails before repository reads", async () => {
  const db = policyStore();
  await expectPolicyError(repository(db).resolveActive(authority({
    authoritativeTenantLocator: OTHER_TENANT,
  }), { traceId: TRACE_ID }), "D2E4O_POLICY_REQUEST_REJECTED");
  assert.equal(db.reads.length, 0);
  assert.equal(db.writes.length, 0);
});

test("tenant, fixture, and intent binding fail closed", async () => {
  await expectPolicyError(repository(policyStore({
    activeValue: active({ authoritativeTenantLocator: OTHER_TENANT }),
    policyValues: [policy({ authoritativeTenantLocator: OTHER_TENANT })],
    auditValue: audit({ authoritativeTenantLocator: OTHER_TENANT }),
  })).resolveActive(authority(), { traceId: TRACE_ID }),
  "D2E4O_POLICY_TENANT_BINDING_REJECTED");

  await expectPolicyError(repository().resolveActive(authority({
    syntheticFixtureLocator: OTHER_FIXTURE,
  }), { traceId: TRACE_ID }), "D2E4O_POLICY_NOT_ELIGIBLE");

  await expectPolicyError(repository(policyStore({
    policyValues: [policy({
      allowedIntentClasses: Object.freeze(["CLARIFICATION"]),
    })],
  })).resolveActive(authority(), { traceId: TRACE_ID }),
  "D2E4O_POLICY_NOT_ELIGIBLE");
});

test("missing pointer, policy cardinality, and audit evidence fail closed", async () => {
  await expectPolicyError(repository(policyStore({ activeExists: false }))
    .resolveActive(authority(), { traceId: TRACE_ID }),
  "D2E4O_ACTIVE_POINTER_MISSING");
  await expectPolicyError(repository(policyStore({ policyValues: [] }))
    .resolveActive(authority(), { traceId: TRACE_ID }),
  "D2E4O_ACTIVE_POLICY_CARDINALITY_REJECTED");
  await expectPolicyError(repository(policyStore({ auditExists: false }))
    .resolveActive(authority(), { traceId: TRACE_ID }),
  "D2E4O_ACTIVATION_AUDIT_MISSING");
  await expectPolicyError(repository(policyStore({
    auditValue: audit({ activatedAt: NOW - 20_000 }),
  })).resolveActive(authority(), { traceId: TRACE_ID }),
  "D2E4O_POLICY_BINDING_REJECTED");
});

test("disabled, kill-switched, expired, and malformed policies fail closed", async () => {
  await expectPolicyError(repository(policyStore({
    policyValues: [policy({ enabled: false })],
  })).resolveActive(authority(), { traceId: TRACE_ID }),
  "D2E4O_POLICY_DISABLED");
  await expectPolicyError(repository(policyStore({
    policyValues: [policy({
      killSwitchState: Object.freeze({
        environment: "PREVIEW",
        state: "ON",
        revision: "kill-switch-d2e4o-test",
        source: "SERVER_CONFIGURATION",
      }),
    })],
  })).resolveActive(authority(), { traceId: TRACE_ID }),
  "D2E4O_POLICY_KILL_SWITCHED");
  await expectPolicyError(repository(policyStore({
    policyValues: [policy({ expiresAt: "2026-08-13T17:59:59.000Z" })],
  })).resolveActive(authority(), { traceId: TRACE_ID }),
  "D2E4O_POLICY_EXPIRED");
  await expectPolicyError(repository(policyStore({
    policyValues: [policy({ expiresAt: "not-iso" })],
  })).resolveActive(authority(), { traceId: TRACE_ID }),
  "D2E4O_POLICY_EXPIRY_REJECTED");
});

test("non-canonical policy collections are rejected instead of normalized", async () => {
  await expectPolicyError(repository(policyStore({
    policyValues: [policy({
      allowedIntentClasses: Object.freeze([
        "DISCOVER_PROBLEM",
        "CLARIFICATION",
      ]),
    })],
  })).resolveActive(authority(), { traceId: TRACE_ID }),
  "D2E4O_ACTIVE_POLICY_REJECTED");
});

test("missing trace context preserves legacy fail-closed request behavior", async () => {
  const db = policyStore();
  await assert.rejects(
    repository(db).resolveActive(authority(), {}),
    (error) => {
      assert.ok(error instanceof D2E4OPolicyRepositoryError);
      assert.equal(error.code, "D2E4O_POLICY_REQUEST_REJECTED");
      assert.equal(error.contractName, undefined);
      return true;
    },
  );
  assert.equal(db.reads.length, 0);
});
