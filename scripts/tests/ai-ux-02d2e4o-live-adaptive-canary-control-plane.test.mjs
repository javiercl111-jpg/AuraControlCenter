import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import {
  FirestoreAdaptiveCanaryControlPlaneV1,
  D2E4OControlPlaneError,
} from "../ai-ux-02d2e4o-live-adaptive-canary-control-plane.mjs";

const NOW = 1_800_000_000_000;

const TENANT =
  "canary-authoritative-tenant";

const CURRENT_POLICY =
  "AI_UX_02D3_PREVIEW_CANARY_20260812_V3";

const NEXT_POLICY =
  "AI_UX_02D3_PREVIEW_CANARY_20260813_V4";

const FIXTURE =
  "SYNTHETIC_FIXTURE_V1_8E5D766A3132FF687116E522304115BE";

const CURRENT_AUDIT_ID =
  "logical-current-audit-id";

const ACTIVE_ID =
  "eb6cc289a9a2843c29b47263d321959a95d20d99639704477e78d968c3d42801";

function sha256(value) {
  return createHash("sha256")
    .update(value, "utf8")
    .digest("hex");
}

function snapshot(data, exists = true, id = "doc") {
  return {
    id,
    exists,
    data() {
      return data;
    },
  };
}

function currentActive(overrides = {}) {
  return {
    version:
      "DISCOVERY_ADAPTIVE_CANARY_ACTIVE_POINTER_V1",
    policyVersion: CURRENT_POLICY,
    authoritativeTenantLocator: TENANT,
    environment: "PREVIEW",
    auditId: CURRENT_AUDIT_ID,
    updatedAt: NOW - 10_000,
    ...overrides,
  };
}

function currentPolicy(overrides = {}) {
  return {
    version:
      "DISCOVERY_ADAPTIVE_CANARY_POLICY_V1",
    activationVersion:
      "DISCOVERY_ADAPTIVE_ACTIVATION_V1",
    policyVersion: CURRENT_POLICY,
    authoritativeTenantLocator: TENANT,
    environment: "PREVIEW",
    mode: "CANARY",
    enabled: true,
    expiresAt: "2026-08-12T17:51:12.192Z",
    killSwitchState: {
      environment: "PREVIEW",
      state: "OFF",
      revision: "CURRENT",
      source: "SERVER_CONFIGURATION",
    },
    allowedSyntheticFixtureLocators: [FIXTURE],
    allowedIntentClasses: [
      "CLARIFICATION",
      "DISCOVER_PROBLEM",
    ],
    source: "SERVER_CONFIGURATION",
    ...overrides,
  };
}

function currentAudit(overrides = {}) {
  return {
    version:
      "DISCOVERY_ADAPTIVE_CANARY_POLICY_AUDIT_V1",
    policyVersion: CURRENT_POLICY,
    previousPolicyVersion:
      "AI_UX_02D3_PREVIEW_CANARY_20260811_V3",
    authoritativeTenantLocator: TENANT,
    environment: "PREVIEW",
    actorLocator: "previous-actor",
    reasonCode: "previous-reason",
    activatedAt: NOW - 10_000,
    ...overrides,
  };
}

function candidate(overrides = {}) {
  return {
    environment: "PREVIEW",
    mode: "CANARY",
    enabled: true,
    source: "SERVER_CONFIGURATION",

    policyVersion: NEXT_POLICY,

    authoritativeTenantLocator: TENANT,

    actorLocator:
      "preview-canary-control-plane",

    reasonCode:
      "AI_UX_02D2E4_FINAL_CEREMONY",

    now: NOW,

    expiresAt:
      new Date(NOW + 30 * 60 * 1000).toISOString(),

    killSwitchState: {
      environment: "PREVIEW",
      state: "OFF",
      revision:
        "AI_UX_02D2E4_CANARY_KILL_SWITCH_OFF_V1",
      source: "SERVER_CONFIGURATION",
    },

    allowedSyntheticFixtureLocators: [
      FIXTURE,
    ],

    allowedIntentClasses: [
      "CLARIFICATION",
      "DISCOVER_PROBLEM",
    ],

    ...overrides,
  };
}

function fakeDb({
  active = currentActive(),
  policy = currentPolicy(),
  audit = currentAudit(),
  nextPolicyExists = false,
  nextAuditExists = false,
} = {}) {
  const state = {
    active: structuredClone(active),
    currentPolicy: structuredClone(policy),
    currentAudit: structuredClone(audit),

    nextPolicy: null,
    nextAudit: null,

    nextPolicyExists,
    nextAuditExists,
  };

  const writes = [];

  function ref(name, id) {
    return { name, id };
  }

  function getRefSnapshot(reference) {
    if (
      reference.name ===
        "discoveryAdaptiveCanaryActiveV1" &&
      reference.id === ACTIVE_ID
    ) {
      return snapshot(
        state.active,
        true,
        reference.id,
      );
    }

    if (
      reference.name ===
        "discoveryAdaptiveCanaryPoliciesV1"
    ) {
      if (
        state.nextPolicy &&
        reference.id === sha256(NEXT_POLICY)
      ) {
        return snapshot(
          state.nextPolicy,
          true,
          reference.id,
        );
      }

      if (
        reference.id === sha256(NEXT_POLICY)
      ) {
        return snapshot(
          {},
          state.nextPolicyExists,
          reference.id,
        );
      }
    }

    if (
      reference.name ===
        "discoveryAdaptiveCanaryAuditV1"
    ) {
      const currentAuditDocumentId =
        sha256(CURRENT_AUDIT_ID);

      if (
        reference.id === currentAuditDocumentId
      ) {
        return snapshot(
          state.currentAudit,
          true,
          reference.id,
        );
      }

      if (
        state.nextAudit &&
        reference.id === state.nextAudit.id
      ) {
        return snapshot(
          state.nextAudit.data,
          true,
          reference.id,
        );
      }

      return snapshot(
        {},
        state.nextAuditExists,
        reference.id,
      );
    }

    throw new Error(
      `UNEXPECTED_REF:${reference.name}:${reference.id}`,
    );
  }

  const db = {
    writes,
    state,

    collection(name) {
      return {
        doc(id) {
          return {
            ...ref(name, id),

            async get() {
              return getRefSnapshot(
                ref(name, id),
              );
            },
          };
        },

        where(field, operator, value) {
          if (
            name !==
              "discoveryAdaptiveCanaryPoliciesV1" ||
            field !== "policyVersion" ||
            operator !== "=="
          ) {
            throw new Error(
              "UNEXPECTED_QUERY",
            );
          }

          return {
            limit() {
              return {
                async get() {
                  if (
                    value ===
                      state.active.policyVersion
                  ) {
                    if (
                      state.nextPolicy &&
                      state.nextPolicy.policyVersion ===
                        value
                    ) {
                      return {
                        size: 1,
                        docs: [
                          snapshot(
                            state.nextPolicy,
                            true,
                            sha256(value),
                          ),
                        ],
                      };
                    }

                    return {
                      size: 1,
                      docs: [
                        snapshot(
                          state.currentPolicy,
                          true,
                          sha256(value),
                        ),
                      ],
                    };
                  }

                  return {
                    size: 0,
                    docs: [],
                  };
                },
              };
            },
          };
        },
      };
    },

    async runTransaction(fn) {
      const transaction = {
        async get(reference) {
          return getRefSnapshot(reference);
        },

        create(reference, value) {
          writes.push([
            "create",
            reference.name,
            reference.id,
          ]);

          if (
            reference.name ===
            "discoveryAdaptiveCanaryPoliciesV1"
          ) {
            state.nextPolicy =
              structuredClone(value);
            state.nextPolicyExists = true;
            return;
          }

          if (
            reference.name ===
            "discoveryAdaptiveCanaryAuditV1"
          ) {
            state.nextAudit = {
              id: reference.id,
              data: structuredClone(value),
            };
            state.nextAuditExists = true;
            return;
          }

          throw new Error(
            "UNEXPECTED_CREATE",
          );
        },

        set(reference, value) {
          writes.push([
            "set",
            reference.name,
            reference.id,
          ]);

          if (
            reference.name !==
              "discoveryAdaptiveCanaryActiveV1" ||
            reference.id !== ACTIVE_ID
          ) {
            throw new Error(
              "UNEXPECTED_SET",
            );
          }

          state.active =
            structuredClone(value);
        },
      };

      return fn(transaction);
    },
  };

  return db;
}

async function expectCode(action, code) {
  await assert.rejects(
    action,
    (error) =>
      error instanceof
        D2E4OControlPlaneError &&
      error.code === code,
  );
}

test("dryRun produces deterministic SHA-256 fingerprint and zero writes", async () => {
  const db = fakeDb();

  const controlPlane =
    new FirestoreAdaptiveCanaryControlPlaneV1({
      db,
    });

  const first =
    await controlPlane.dryRun(candidate());

  const second =
    await controlPlane.dryRun(candidate());

  assert.equal(
    first.status,
    "DRY_RUN_VALIDATED",
  );

  assert.match(
    first.fingerprint,
    /^[a-f0-9]{64}$/u,
  );

  assert.equal(
    first.fingerprint,
    second.fingerprint,
  );

  assert.equal(
    first.cas.previousPolicyVersion,
    CURRENT_POLICY,
  );

  assert.equal(
    first.cas.previousUpdatedAt,
    NOW - 10_000,
  );

  assert.equal(
    first.cas.previousAuditId,
    CURRENT_AUDIT_ID,
  );

  assert.equal(db.writes.length, 0);
});

test("apply performs exactly policy create + audit create + active set", async () => {
  const db = fakeDb();

  const controlPlane =
    new FirestoreAdaptiveCanaryControlPlaneV1({
      db,
    });

  const dryRun =
    await controlPlane.dryRun(candidate());

  const result =
    await controlPlane.apply(dryRun);

  assert.equal(result.status, "APPLIED");
  assert.equal(
    result.policyVersion,
    NEXT_POLICY,
  );
  assert.equal(result.logicalMutations, 3);

  assert.deepEqual(
    db.writes.map(
      ([operation, collection]) =>
        `${operation}:${collection}`,
    ),
    [
      "create:discoveryAdaptiveCanaryPoliciesV1",
      "create:discoveryAdaptiveCanaryAuditV1",
      "set:discoveryAdaptiveCanaryActiveV1",
    ],
  );

  assert.equal(
    db.state.active.policyVersion,
    NEXT_POLICY,
  );

  assert.equal(
    db.state.nextPolicy.policyVersion,
    NEXT_POLICY,
  );

  assert.equal(
    db.state.nextAudit.data.policyVersion,
    NEXT_POLICY,
  );

  assert.equal(
    sha256(db.state.active.auditId),
    db.state.nextAudit.id,
  );
});

test("readBack certifies pointer policy audit after apply", async () => {
  const db = fakeDb();

  const controlPlane =
    new FirestoreAdaptiveCanaryControlPlaneV1({
      db,
    });

  const dryRun =
    await controlPlane.dryRun(candidate());

  const applied =
    await controlPlane.apply(dryRun);

  const result =
    await controlPlane.readBack({
      policyVersion:
        applied.policyVersion,

      fingerprint:
        applied.fingerprint,
    });

  assert.equal(
    result.status,
    "READ_BACK_CERTIFIED",
  );

  assert.equal(
    result.policyVersion,
    NEXT_POLICY,
  );

  assert.equal(
    result.pointerPolicyAuditMatch,
    true,
  );
});

test("stale active pointer fails CAS with zero writes", async () => {
  const db = fakeDb();

  const controlPlane =
    new FirestoreAdaptiveCanaryControlPlaneV1({
      db,
    });

  const dryRun =
    await controlPlane.dryRun(candidate());

  db.state.active.updatedAt += 1;

  await expectCode(
    () => controlPlane.apply(dryRun),
    "D2E4O_CONTROL_PLANE_CAS_FAILED",
  );

  assert.equal(db.writes.length, 0);
});

test("fingerprint mutation fails before transaction", async () => {
  const db = fakeDb();

  const controlPlane =
    new FirestoreAdaptiveCanaryControlPlaneV1({
      db,
    });

  const dryRun =
    await controlPlane.dryRun(candidate());

  await expectCode(
    () =>
      controlPlane.apply({
        ...dryRun,
        fingerprint: "f".repeat(64),
      }),
    "D2E4O_CONTROL_PLANE_FINGERPRINT_MISMATCH",
  );

  assert.equal(db.writes.length, 0);
});

test("existing proposed policy fails CAS with zero writes", async () => {
  const db = fakeDb({
    nextPolicyExists: true,
  });

  const controlPlane =
    new FirestoreAdaptiveCanaryControlPlaneV1({
      db,
    });

  const dryRun =
    await controlPlane.dryRun(candidate());

  await expectCode(
    () => controlPlane.apply(dryRun),
    "D2E4O_CONTROL_PLANE_CAS_FAILED",
  );

  assert.equal(db.writes.length, 0);
});

test("existing proposed audit fails CAS with zero writes", async () => {
  const db = fakeDb({
    nextAuditExists: true,
  });

  const controlPlane =
    new FirestoreAdaptiveCanaryControlPlaneV1({
      db,
    });

  const dryRun =
    await controlPlane.dryRun(candidate());

  await expectCode(
    () => controlPlane.apply(dryRun),
    "D2E4O_CONTROL_PLANE_CAS_FAILED",
  );

  assert.equal(db.writes.length, 0);
});
