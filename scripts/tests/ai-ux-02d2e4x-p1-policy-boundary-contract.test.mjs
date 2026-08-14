import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import test from "node:test";

import {
  EXPECTED_PREVIEW_RUNTIME_REVISION,
  RealCanaryPolicyRevalidationAdapterV1,
} from "../ai-ux-02d2e4e-real-capability-readiness.mjs";
import {
  D2E4OPolicyRepositoryError,
  FirestoreAdaptiveCanaryPolicyRepositoryV1,
} from "../ai-ux-02d2e4o-live-adaptive-canary-policy-repository.mjs";
import {
  assertPolicyReadinessReceiptV1,
  assertRuntimeErrorV1,
} from "../ai-ux-02d2e4x-policy-readiness-contract-v1.mjs";

const NOW = Date.parse("2026-08-13T18:00:00.000Z");
const EXPIRES_AT_ISO = "2026-08-13T18:30:00.000Z";
const TENANT = `tenant-${"ab".repeat(32)}`;
const OTHER_TENANT = `tenant-${"cd".repeat(32)}`;
const FIXTURE =
  "SYNTHETIC_FIXTURE_V1_8E5D766A3132FF687116E522304115BE";
const OTHER_FIXTURE =
  "SYNTHETIC_FIXTURE_V1_FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF";
const POLICY_VERSION = "AI_UX_02D3_PREVIEW_CANARY_POLICY_BOUNDARY_V1";
const POINTER_VERSION = "DISCOVERY_ADAPTIVE_CANARY_ACTIVE_POINTER_V1";
const AUDIT_ID = "logical-policy-boundary-audit-v1";
const TRACE_ID = "trace-policy-boundary-contract-v1";

function authority(overrides = {}) {
  return Object.freeze({
    contractName: "AuthorityReceiptV1",
    contractVersion: "V1",
    receiptId: "authority-receipt-policy-boundary-v1",
    status: "CERTIFIED",
    environment: "PREVIEW",
    projectId: "aura-intel-preview",
    authoritativeTenantId: TENANT,
    authoritativeTenantLocator: TENANT,
    syntheticFixtureLocator: FIXTURE,
    linkId: "synthetic-link-policy-boundary-v1",
    sessionId: "synthetic-session-policy-boundary-v1",
    turnId: "synthetic-turn-policy-boundary-v1",
    intentClass: "DISCOVER_PROBLEM",
    evidenceDigest: "55".repeat(32),
    certifiedAtMs: NOW - 5_000,
    expiresAtMs: NOW + 60_000,
    ...overrides,
  });
}

function activePointer(overrides = {}) {
  return Object.freeze({
    version: POINTER_VERSION,
    policyVersion: POLICY_VERSION,
    environment: "PREVIEW",
    authoritativeTenantLocator: TENANT,
    auditId: AUDIT_ID,
    updatedAt: NOW - 10_000,
    ...overrides,
  });
}

function policyDocument(overrides = {}) {
  return Object.freeze({
    version: "DISCOVERY_ADAPTIVE_CANARY_POLICY_V1",
    activationVersion: "DISCOVERY_ADAPTIVE_ACTIVATION_V1",
    policyVersion: POLICY_VERSION,
    authoritativeTenantLocator: TENANT,
    environment: "PREVIEW",
    mode: "CANARY",
    enabled: true,
    expiresAt: EXPIRES_AT_ISO,
    killSwitchState: Object.freeze({
      environment: "PREVIEW",
      state: "OFF",
      revision: "kill-switch-policy-boundary-v1",
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

function activationAudit(overrides = {}) {
  return Object.freeze({
    version: "DISCOVERY_ADAPTIVE_CANARY_POLICY_AUDIT_V1",
    policyVersion: POLICY_VERSION,
    previousPolicyVersion: "previous-policy-boundary-v1",
    authoritativeTenantLocator: TENANT,
    environment: "PREVIEW",
    actorLocator: "policy-boundary-actor-v1",
    reasonCode: "POLICY_BOUNDARY_TEST",
    activatedAt: NOW - 10_000,
    ...overrides,
  });
}

function snapshot(data, exists = true) {
  return Object.freeze({ exists, data: () => data });
}

function readOnlyPolicyStore({
  active = activePointer(),
  policy = policyDocument(),
  audit = activationAudit(),
} = {}) {
  const reads = [];
  const writes = [];
  const collectionKinds = {
    discoveryAdaptiveCanaryActiveV1: "active",
    discoveryAdaptiveCanaryPoliciesV1: "policy",
    discoveryAdaptiveCanaryAuditV1: "audit",
  };
  return Object.freeze({
    reads,
    writes,
    collection(name) {
      const kind = collectionKinds[name];
      if (!kind) throw new Error(`UNEXPECTED_COLLECTION:${name}`);
      return Object.freeze({
        doc(id) {
          return Object.freeze({ type: "document", kind, id });
        },
        where(field, operator, value) {
          return Object.freeze({
            limit(limit) {
              return Object.freeze({
                type: "query",
                kind,
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
      return callback(Object.freeze({
        async get(target) {
          reads.push(Object.freeze({ ...target }));
          if (target.kind === "active") return snapshot(active);
          if (target.kind === "policy") {
            return Object.freeze({
              size: 1,
              docs: Object.freeze([snapshot(policy)]),
            });
          }
          if (target.kind === "audit") {
            assert.equal(target.id, createHash("sha256")
              .update(AUDIT_ID, "utf8").digest("hex"));
            return snapshot(audit);
          }
          throw new Error("UNEXPECTED_TRANSACTION_TARGET");
        },
      }));
    },
  });
}

function readyRuntimeRevisionControl() {
  return Object.freeze({
    async readCurrentRevision() {
      return Object.freeze({
        status: "READY",
        environment: "PREVIEW",
        revision: EXPECTED_PREVIEW_RUNTIME_REVISION,
        failedRevisions: 0,
      });
    },
  });
}

function repository(db) {
  let errorSequence = 0;
  return new FirestoreAdaptiveCanaryPolicyRepositoryV1({
    db,
    clock: () => NOW,
    receiptIdFactory: () => "policy-receipt-boundary-v1",
    errorIdFactory: () => `policy-error-boundary-${++errorSequence}`,
  });
}

function consumer(policyRepository) {
  return new RealCanaryPolicyRevalidationAdapterV1({
    policyRepository,
    runtimeRevisionReader: readyRuntimeRevisionControl(),
    clock: () => NOW,
    errorIdFactory: () => "readiness-error-boundary-v1",
  });
}

function traceWithoutTranslation(target, calls) {
  return new Proxy(target, {
    get(value, property) {
      if (property === "resolveActive") {
        return async (authorityReceipt, context) => {
          calls.push(Object.freeze({ authorityReceipt, context }));
          return value.resolveActive(authorityReceipt, context);
        };
      }
      return Reflect.get(value, property, value);
    },
  });
}

test("real D2E4E passes exact authority unchanged to real D2E4O", async () => {
  const db = readOnlyPolicyStore();
  const calls = [];
  const producer = repository(db);
  const inputAuthority = authority();
  const result = await consumer(traceWithoutTranslation(producer, calls))
    .revalidate({
      authority: inputAuthority,
      policyVersion: POLICY_VERSION,
      traceId: TRACE_ID,
    });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].authorityReceipt, inputAuthority);
  assert.deepEqual(calls[0].context, { traceId: TRACE_ID });
  assert.equal(assertPolicyReadinessReceiptV1(result, { atMs: NOW }), result);
  assert.deepEqual(db.reads.map((read) => read.kind), [
    "active",
    "policy",
    "audit",
  ]);
  assert.equal(db.writes.length, 0);
});

test("real D2E4O output uses exact pointer and epoch timestamp fields", async () => {
  const result = await repository(readOnlyPolicyStore()).resolveActive(
    authority(),
    { traceId: TRACE_ID },
  );
  assert.equal(result.contractName, "PolicyReadinessReceiptV1");
  assert.equal(result.contractVersion, "V1");
  assert.equal(result.activePointerVersion, POINTER_VERSION);
  assert.equal(result.expiresAtMs, Date.parse(EXPIRES_AT_ISO));
  assert.equal(typeof result.expiresAtMs, "number");
  assert.equal(Object.hasOwn(result, "pointerVersion"), false);
  assert.equal(Object.hasOwn(result, "policy"), false);
  assert.equal(Object.hasOwn(result, "expiresAt"), false);
  assert.equal(Object.keys(result).length, 20);
});

test("tenant, fixture, and intent are bound at the real repository", async () => {
  await assert.rejects(
    repository(readOnlyPolicyStore()).resolveActive(authority({
      authoritativeTenantId: OTHER_TENANT,
      authoritativeTenantLocator: OTHER_TENANT,
    }), { traceId: TRACE_ID }),
    (error) => {
      assert.equal(error.code, "D2E4O_POLICY_TENANT_BINDING_REJECTED");
      assert.equal(assertRuntimeErrorV1(error), error);
      return true;
    },
  );
  await assert.rejects(
    repository(readOnlyPolicyStore()).resolveActive(authority({
      syntheticFixtureLocator: OTHER_FIXTURE,
    }), { traceId: TRACE_ID }),
    /D2E4O_POLICY_NOT_ELIGIBLE/u,
  );
  await assert.rejects(
    repository(readOnlyPolicyStore({
      policy: policyDocument({
        allowedIntentClasses: Object.freeze(["CLARIFICATION"]),
      }),
    })).resolveActive(authority(), { traceId: TRACE_ID }),
    /D2E4O_POLICY_NOT_ELIGIBLE/u,
  );
});

test("real producer failures preserve D2E4O code in RuntimeErrorV1", async () => {
  let failure;
  try {
    await repository(readOnlyPolicyStore()).resolveActive(Object.freeze({
      environment: "PREVIEW",
      authoritativeTenantId: TENANT,
      now: NOW,
    }), { traceId: TRACE_ID });
  } catch (error) {
    failure = error;
  }
  assert.ok(failure instanceof D2E4OPolicyRepositoryError);
  assert.equal(failure.code, "D2E4O_POLICY_REQUEST_REJECTED");
  assert.equal(failure.stage, "POLICY");
  assert.equal(failure.producer, "D2E4O_POLICY_REPOSITORY");
  assert.equal(failure.traceId, TRACE_ID);
  assert.equal(assertRuntimeErrorV1(failure), failure);
});

test("D2E4E rejects legacy response normalization and preserves fail-closed behavior", async () => {
  const legacyRepository = Object.freeze({
    async resolveActive() {
      return Object.freeze({
        status: "ACTIVE",
        pointerVersion: POINTER_VERSION,
        policy: Object.freeze({
          policyVersion: POLICY_VERSION,
          expiresAt: Date.parse(EXPIRES_AT_ISO),
        }),
      });
    },
  });
  await assert.rejects(
    consumer(legacyRepository).revalidate({
      authority: authority(),
      policyVersion: POLICY_VERSION,
      traceId: TRACE_ID,
    }),
    (error) => {
      assert.equal(error.code, "D2E4E_CANARY_POLICY_NOT_READY");
      assert.equal(assertRuntimeErrorV1(error), error);
      return true;
    },
  );
});
