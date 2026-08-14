import assert from "node:assert/strict";
import test from "node:test";

import {
  assertCertifiedPreviewAuthorityV1,
  createFirestorePreviewAuthorityFactoryV1,
  D2E4NAuthorityError,
} from "../ai-ux-02d2e4n-live-preview-authority.mjs";
import {
  assertAuthorityReceiptV1,
  assertRuntimeErrorV1,
} from "../ai-ux-02d2e4x-policy-readiness-contract-v1.mjs";

const NOW = Date.parse("2026-08-13T18:00:00.000Z");
const TENANT = `tenant-${"a".repeat(64)}`;
const FIXTURE =
  "SYNTHETIC_FIXTURE_V1_8E5D766A3132FF687116E522304115BE";
const LINK = "ai-ux-02d3-preview-synthetic-discovery-link-v1";
const SESSION = "ai-ux-02d3-preview-synthetic-discovery-session-v1";
const TURN = "AI_UX_02D3_CANARY_TURN_0001";
const TRACE = "trace-d2e4n-authority-test";

function snapshot(data, exists = true) {
  return { exists, data: () => data };
}

function validLink(overrides = {}) {
  return {
    synthetic: true,
    environment: "PREVIEW",
    projectId: "aura-intel-preview",
    tenantId: TENANT,
    fixtureLocator: FIXTURE,
    requiredCapability: "EVALUATE_CONVERSATION",
    linkId: LINK,
    sessionId: SESSION,
    ...overrides,
  };
}

function validSession(overrides = {}) {
  return {
    synthetic: true,
    environment: "PREVIEW",
    projectId: "aura-intel-preview",
    tenantId: TENANT,
    fixtureLocator: FIXTURE,
    linkId: LINK,
    sessionId: SESSION,
    ...overrides,
  };
}

function fakeDb({
  link = validLink(),
  session = validSession(),
  linkExists = true,
  sessionExists = true,
} = {}) {
  const reads = [];
  const writes = [];
  return {
    reads,
    writes,
    collection(name) {
      return {
        doc(id) {
          return {
            async get() {
              reads.push({ name, id });
              if (name === "market_discovery_links") {
                return snapshot(link, linkExists);
              }
              if (name === "discovery_sessions") {
                return snapshot(session, sessionExists);
              }
              throw new Error("UNEXPECTED_COLLECTION");
            },
          };
        },
      };
    },
  };
}

function request(overrides = {}) {
  return {
    authoritativeTenantId: TENANT,
    syntheticFixtureLocator: FIXTURE,
    intentClass: "DISCOVER_PROBLEM",
    turnId: TURN,
    traceId: TRACE,
    ...overrides,
  };
}

function factory(db, overrides = {}) {
  return createFirestorePreviewAuthorityFactoryV1({
    db,
    linkId: LINK,
    sessionId: SESSION,
    clock: () => NOW,
    receiptIdFactory: () => "authority-receipt-d2e4n-test",
    errorIdFactory: () => "authority-error-d2e4n-test",
    ...overrides,
  });
}

async function expectCode(action, code) {
  await assert.rejects(action, (error) => {
    assert.equal(error instanceof D2E4NAuthorityError, true);
    assert.equal(error.code, code);
    assert.equal(assertRuntimeErrorV1(error), error);
    assert.equal(error.stage, "AUTHORITY");
    assert.equal(error.traceId, TRACE);
    return true;
  });
}

test("D2E4N emits exact deeply frozen AuthorityReceiptV1", async () => {
  const db = fakeDb();
  const authority = await factory(db)(request());

  assert.deepEqual(Object.keys(authority).sort(), [
    "authoritativeTenantId",
    "authoritativeTenantLocator",
    "certifiedAtMs",
    "contractName",
    "contractVersion",
    "environment",
    "evidenceDigest",
    "expiresAtMs",
    "intentClass",
    "linkId",
    "projectId",
    "receiptId",
    "sessionId",
    "status",
    "syntheticFixtureLocator",
    "turnId",
  ]);
  assert.equal(authority.contractName, "AuthorityReceiptV1");
  assert.equal(authority.contractVersion, "V1");
  assert.equal(authority.status, "CERTIFIED");
  assert.equal(authority.projectId, "aura-intel-preview");
  assert.equal(authority.authoritativeTenantId, TENANT);
  assert.equal(authority.authoritativeTenantLocator, TENANT);
  assert.equal(authority.syntheticFixtureLocator, FIXTURE);
  assert.equal(authority.intentClass, "DISCOVER_PROBLEM");
  assert.equal(authority.linkId, LINK);
  assert.equal(authority.sessionId, SESSION);
  assert.equal(authority.turnId, TURN);
  assert.match(authority.evidenceDigest, /^[0-9a-f]{64}$/u);
  assert.equal(authority.certifiedAtMs, NOW);
  assert.equal(authority.expiresAtMs, NOW + 60_000);
  assert.equal(Object.hasOwn(authority, "authorityRevision"), false);
  assert.equal(Object.hasOwn(authority, "targetProjectId"), false);
  assert.equal(Object.isFrozen(authority), true);
  assert.equal(assertAuthorityReceiptV1(authority, { atMs: NOW }), authority);
  assert.equal(assertCertifiedPreviewAuthorityV1(authority, { atMs: NOW }), authority);
  assert.equal(db.reads.length, 2);
  assert.equal(db.writes.length, 0);
});

test("turn and intent changes require distinct evidence digests", async () => {
  const first = await factory(fakeDb())(request());
  const second = await factory(fakeDb())(request({
    turnId: "AI_UX_02D3_CANARY_TURN_0002",
  }));
  const third = await factory(fakeDb())(request({ intentClass: "CLARIFICATION" }));
  assert.notEqual(first.evidenceDigest, second.evidenceDigest);
  assert.notEqual(first.evidenceDigest, third.evidenceDigest);
});

test("remote tenant, fixture, and missing evidence fail as RuntimeErrorV1", async () => {
  await expectCode(
    () => factory(fakeDb({
      link: validLink({ tenantId: `tenant-${"b".repeat(64)}` }),
    }))(request()),
    "D2E4N_REMOTE_BINDING_REJECTED",
  );
  await expectCode(
    () => factory(fakeDb({
      session: validSession({
        fixtureLocator: "SYNTHETIC_FIXTURE_V1_FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF",
      }),
    }))(request()),
    "D2E4N_REMOTE_BINDING_REJECTED",
  );
  await expectCode(
    () => factory(fakeDb({ sessionExists: false }))(request()),
    "D2E4N_REMOTE_BINDING_MISSING",
  );
});

test("missing binding fields fail closed before remote reads", async () => {
  const db = fakeDb();
  const malformed = request();
  delete malformed.turnId;
  await expectCode(
    () => factory(db)(malformed),
    "D2E4N_AUTHORITY_REQUEST_REJECTED",
  );
  assert.equal(db.reads.length, 0);
  assert.equal(db.writes.length, 0);
});

test("certified assertion rejects mutable and extra-field receipts", async () => {
  const authority = await factory(fakeDb())(request());
  assert.throws(
    () => assertCertifiedPreviewAuthorityV1({ ...authority }, {
      atMs: NOW,
      traceId: TRACE,
      clock: () => NOW,
      errorIdFactory: () => "authority-error-assertion-test",
    }),
    (error) =>
      error instanceof D2E4NAuthorityError &&
      error.code === "D2E4N_CERTIFIED_AUTHORITY_REJECTED" &&
      assertRuntimeErrorV1(error) === error,
  );
  assert.throws(
    () => assertCertifiedPreviewAuthorityV1(Object.freeze({
      ...authority,
      authorityRevision: "forbidden",
    })),
    /D2E4N_CERTIFIED_AUTHORITY_REJECTED/u,
  );
});
