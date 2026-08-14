import test from "node:test";
import assert from "node:assert/strict";

import {
  D2E4MRotationRepositoryError,
  FirestoreSyntheticCapabilityRotationRepositoryV1,
} from "../ai-ux-02d2e4m-live-capability-rotation-repository.mjs";
import {
  assertRuntimeErrorV1,
  createAuthorityReceiptV1,
} from "../ai-ux-02d2e4x-policy-readiness-contract-v1.mjs";

const NOW = 1_800_000_000_000;
const TENANT = "tenant-" + "a".repeat(64);
const FIXTURE = "SYNTHETIC_FIXTURE_V1_8E5D766A3132FF687116E522304115BE";
const LINK = "synthetic-link";
const SESSION = "synthetic-session";
const HASH = "b".repeat(64);
const TRACE = "trace-d2e4m-authority-test";

const authority = createAuthorityReceiptV1({
  receiptId: "authority-receipt-d2e4m-test",
  projectId: "aura-intel-preview",
  authoritativeTenantId: TENANT,
  authoritativeTenantLocator: TENANT,
  syntheticFixtureLocator: FIXTURE,
  intentClass: "DISCOVER_PROBLEM",
  linkId: LINK,
  sessionId: SESSION,
  turnId: "AI_UX_02D3_CANARY_TURN_0001",
  evidenceDigest: "22".repeat(32),
  certifiedAtMs: NOW - 1_000,
  expiresAtMs: NOW + 60_000,
});

function timestamp(value) {
  return Object.freeze({
    toMillis() {
      return value;
    },
  });
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
    sessionCapabilityHash: HASH,
    ...overrides,
  };
}

function validCapability(overrides = {}) {
  return {
    version: "DISCOVERY_CAPABILITY_V1",
    type: "SESSION",
    purpose: "DISCOVERY_SESSION",
    synthetic: true,
    environment: "PREVIEW",
    projectId: "aura-intel-preview",
    tenantId: TENANT,
    fixtureLocator: FIXTURE,
    requiredCapability: "EVALUATE_CONVERSATION",
    capabilityScope: "DISCOVERY_SESSION",
    linkId: LINK,
    sessionId: SESSION,
    tokenHash: HASH,
    generation: 1,
    updatedAt: timestamp(NOW - 10_000),
    expiresAt: timestamp(NOW - 1),
    ...overrides,
  };
}

function snapshot(data, exists = true) {
  return {
    exists,
    data() {
      return data;
    },
  };
}

function fakeDb({
  link = validLink(),
  capability = validCapability(),
  linkExists = true,
  capabilityExists = true,
} = {}) {
  const reads = [];

  return {
    reads,

    collection(name) {
      return {
        doc(id) {
          return {
            async get() {
              reads.push({ name, id });

              if (name === "market_discovery_links") {
                return snapshot(link, linkExists);
              }

              if (name === "discovery_capabilities_v1") {
                return snapshot(capability, capabilityExists);
              }

              throw new Error(`UNEXPECTED_COLLECTION:${name}`);
            },
          };
        },
      };
    },
  };
}

async function expectCode(action, code) {
  await assert.rejects(
    action,
    (error) =>
      error instanceof D2E4MRotationRepositoryError &&
      error.code === code,
  );
}

function inspect(repository, value = authority) {
  return repository.inspectExpired(value, NOW, { traceId: TRACE });
}

test("returns exact expired capability expectation", async () => {
  const db = fakeDb();

  const repository =
    new FirestoreSyntheticCapabilityRotationRepositoryV1({ db });

  const result = await inspect(repository);

  assert.deepEqual(result, {
    capabilityLocator: HASH,
    expectedTokenHash: HASH,
    expectedCapabilityVersion: "DISCOVERY_CAPABILITY_V1",
    expectedUpdatedAt: NOW - 10_000,
    expectedExpiresAt: NOW - 1,
    expectedRotationVersion: 0,
  });

  assert.deepEqual(db.reads, [
    { name: "market_discovery_links", id: LINK },
    { name: "discovery_capabilities_v1", id: HASH },
  ]);
});

test("rejects non-expired capability", async () => {
  const db = fakeDb({
    capability: validCapability({
      expiresAt: timestamp(NOW + 60_000),
    }),
  });

  const repository =
    new FirestoreSyntheticCapabilityRotationRepositoryV1({ db });

  await expectCode(
    () => inspect(repository),
    "D2E4M_CAPABILITY_NOT_EXPIRED",
  );
});

test("rejects tenant mismatch", async () => {
  const db = fakeDb({
    link: validLink({ tenantId: "tenant-" + "c".repeat(64) }),
  });

  const repository =
    new FirestoreSyntheticCapabilityRotationRepositoryV1({ db });

  await expectCode(
    () => inspect(repository),
    "D2E4M_LINK_BINDING_MISMATCH",
  );
});

test("rejects fixture mismatch", async () => {
  const db = fakeDb({
    link: validLink({
      fixtureLocator:
        "SYNTHETIC_FIXTURE_V1_FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF",
    }),
  });

  const repository =
    new FirestoreSyntheticCapabilityRotationRepositoryV1({ db });

  await expectCode(
    () => inspect(repository),
    "D2E4M_LINK_BINDING_MISMATCH",
  );
});

test("rejects capability binding mismatch", async () => {
  const db = fakeDb({
    capability: validCapability({ sessionId: "wrong-session" }),
  });

  const repository =
    new FirestoreSyntheticCapabilityRotationRepositoryV1({ db });

  await expectCode(
    () => inspect(repository),
    "D2E4M_CAPABILITY_BINDING_MISMATCH",
  );
});

test("rejects invalid generation", async () => {
  const db = fakeDb({
    capability: validCapability({ generation: 0 }),
  });

  const repository =
    new FirestoreSyntheticCapabilityRotationRepositoryV1({ db });

  await expectCode(
    () => inspect(repository),
    "D2E4M_CAPABILITY_BINDING_MISMATCH",
  );
});

test("rejects missing link", async () => {
  const db = fakeDb({ linkExists: false });

  const repository =
    new FirestoreSyntheticCapabilityRotationRepositoryV1({ db });

  await expectCode(
    () => inspect(repository),
    "D2E4M_LINK_NOT_FOUND",
  );
});

test("rejects missing capability", async () => {
  const db = fakeDb({ capabilityExists: false });

  const repository =
    new FirestoreSyntheticCapabilityRotationRepositoryV1({ db });

  await expectCode(
    () => inspect(repository),
    "D2E4M_CAPABILITY_NOT_FOUND",
  );
});

test("rejects invalid authority before Firestore read", async () => {
  const db = fakeDb();

  const repository =
    new FirestoreSyntheticCapabilityRotationRepositoryV1({ db });

  await expectCode(
    () => inspect(repository, Object.freeze({
      ...authority,
      projectId: "wrong-project",
    })),
    "D2E4M_AUTHORITY_REJECTED",
  );

  assert.equal(db.reads.length, 0);
});

test("missing binding and expired receipts fail with RuntimeErrorV1 before reads", async () => {
  for (const malformed of [
    Object.freeze({ ...authority, turnId: undefined }),
    Object.freeze({ ...authority, expiresAtMs: NOW }),
  ]) {
    const db = fakeDb();
    const repository = new FirestoreSyntheticCapabilityRotationRepositoryV1({
      db,
      errorIdFactory: () => "rotation-error-d2e4m-test",
    });
    await assert.rejects(() => inspect(repository, malformed), (error) => {
      assert.equal(error.code, "D2E4M_AUTHORITY_REJECTED");
      assert.equal(assertRuntimeErrorV1(error), error);
      assert.equal(error.stage, "AUTHORITY");
      return true;
    });
    assert.equal(db.reads.length, 0);
  }
});
