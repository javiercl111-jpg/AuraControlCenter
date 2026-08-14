import test from "node:test";
import assert from "node:assert/strict";

import {
  FirestoreSyntheticCapabilityRotationRepositoryV1,
  D2E4MRotationRepositoryError,
} from "../ai-ux-02d2e4m-live-capability-rotation-repository.mjs";
import {
  createAuthorityReceiptV1,
} from "../ai-ux-02d2e4x-policy-readiness-contract-v1.mjs";

const NOW = 1_800_000_000_000;
const OLD_HASH = "a".repeat(64);
const NEW_HASH = "b".repeat(64);

const authority = createAuthorityReceiptV1({
  receiptId: "authority-receipt-d2e4m-cas-test",
  projectId: "aura-intel-preview",
  authoritativeTenantId: "tenant-" + "c".repeat(64),
  authoritativeTenantLocator: "tenant-" + "c".repeat(64),
  syntheticFixtureLocator:
    "SYNTHETIC_FIXTURE_V1_8E5D766A3132FF687116E522304115BE",
  intentClass: "DISCOVER_PROBLEM",
  linkId: "synthetic-link",
  sessionId: "synthetic-session",
  turnId: "synthetic-turn-d2e4m-cas-test",
  evidenceDigest: "33".repeat(32),
  certifiedAtMs: NOW - 1_000,
  expiresAtMs: NOW + 60_000,
});

function ts(value) {
  return {
    toMillis() {
      return value;
    },
  };
}

function capability(overrides = {}) {
  return {
    version: "DISCOVERY_CAPABILITY_V1",
    type: "SESSION",
    purpose: "DISCOVERY_SESSION",
    synthetic: true,
    environment: "PREVIEW",
    projectId: "aura-intel-preview",
    tenantId: authority.authoritativeTenantId,
    fixtureLocator: authority.syntheticFixtureLocator,
    requiredCapability: "EVALUATE_CONVERSATION",
    capabilityScope: "DISCOVERY_SESSION",
    linkId: authority.linkId,
    sessionId: authority.sessionId,
    tokenHash: OLD_HASH,
    generation: 1,
    issuedAt: ts(NOW - 600_000),
    expiresAt: ts(NOW - 1),
    consumedAt: null,
    completedAt: null,
    revokedAt: null,
    revocationReason: null,
    createdAt: ts(NOW - 600_000),
    updatedAt: ts(NOW - 10_000),
    ...overrides,
  };
}

function link(overrides = {}) {
  return {
    tenantId: authority.authoritativeTenantId,
    fixtureLocator: authority.syntheticFixtureLocator,
    linkId: authority.linkId,
    sessionId: authority.sessionId,
    sessionCapabilityHash: OLD_HASH,
    sessionCapabilityGeneration: 1,
    ...overrides,
  };
}

function snap(data, exists = true) {
  return {
    exists,
    data() {
      return data;
    },
  };
}

function fakeDb(overrides = {}) {
  const writes = [];

  const current = overrides.current ?? capability();
  const linkData = overrides.link ?? link();
  const nextExists = overrides.nextExists ?? false;

  return {
    writes,

    collection(name) {
      return {
        doc(id) {
          return { name, id };
        },
      };
    },

    async runTransaction(fn) {
      const tx = {
        async get(ref) {
          if (
            ref.name === "discovery_capabilities_v1" &&
            ref.id === OLD_HASH
          ) {
            return snap(current);
          }

          if (
            ref.name === "discovery_capabilities_v1" &&
            ref.id === NEW_HASH
          ) {
            return snap({}, nextExists);
          }

          if (
            ref.name === "market_discovery_links" &&
            ref.id === authority.linkId
          ) {
            return snap(linkData);
          }

          throw new Error("UNEXPECTED_READ");
        },

        set(ref, value) {
          writes.push(["set", ref, value]);
        },

        create(ref, value) {
          writes.push(["create", ref, value]);
        },

        update(ref, value) {
          writes.push(["update", ref, value]);
        },
      };

      return fn(tx);
    },
  };
}

const expectation = Object.freeze({
  capabilityLocator: OLD_HASH,
  expectedTokenHash: OLD_HASH,
  expectedCapabilityVersion: "DISCOVERY_CAPABILITY_V1",
  expectedUpdatedAt: NOW - 10_000,
  expectedExpiresAt: NOW - 1,
  expectedRotationVersion: 0,
});

test("CAS rotation writes exactly current revoke + next create + link update", async () => {
  const db = fakeDb();

  const repository =
    new FirestoreSyntheticCapabilityRotationRepositoryV1({ db });

  const result = await repository.rotateExpired({
    authority,
    expectation,
    nextTokenHash: NEW_HASH,
    now: NOW,
  });

  assert.equal(result.status, "ROTATED");
  assert.equal(result.generation, 2);
  assert.equal(result.expiresAt, NOW + 300_000);

  assert.equal(db.writes.length, 3);
  assert.deepEqual(
    db.writes.map(([kind]) => kind),
    ["set", "create", "update"],
  );
});

test("CAS fails if current updatedAt changed", async () => {
  const db = fakeDb({
    current: capability({
      updatedAt: ts(NOW - 9_999),
    }),
  });

  const repository =
    new FirestoreSyntheticCapabilityRotationRepositoryV1({ db });

  await assert.rejects(
    () =>
      repository.rotateExpired({
        authority,
        expectation,
        nextTokenHash: NEW_HASH,
        now: NOW,
      }),
    (error) =>
      error instanceof D2E4MRotationRepositoryError &&
      error.code === "D2E4M_ROTATION_CAS_FAILED",
  );

  assert.equal(db.writes.length, 0);
});

test("CAS fails if next capability already exists", async () => {
  const db = fakeDb({ nextExists: true });

  const repository =
    new FirestoreSyntheticCapabilityRotationRepositoryV1({ db });

  await assert.rejects(
    () =>
      repository.rotateExpired({
        authority,
        expectation,
        nextTokenHash: NEW_HASH,
        now: NOW,
      }),
    (error) =>
      error instanceof D2E4MRotationRepositoryError &&
      error.code === "D2E4M_ROTATION_CAS_FAILED",
  );

  assert.equal(db.writes.length, 0);
});

test("rejects identical next hash", async () => {
  const db = fakeDb();

  const repository =
    new FirestoreSyntheticCapabilityRotationRepositoryV1({ db });

  await assert.rejects(
    () =>
      repository.rotateExpired({
        authority,
        expectation,
        nextTokenHash: OLD_HASH,
        now: NOW,
      }),
    (error) =>
      error instanceof D2E4MRotationRepositoryError &&
      error.code === "D2E4M_ROTATION_PRECONDITION_REJECTED",
  );

  assert.equal(db.writes.length, 0);
});
