"use strict";

const test =
  require("node:test");

const assert =
  require("node:assert/strict");

const {
  APPLY_CHANGE_ID,
  AUDIT_ACTION,
  ENVIRONMENT,
  GRANT_COLLECTION,
  GRANT_SCHEMA_VERSION,
  PROJECT_ID,
  REQUIRED_CAPABILITY,
  executeProvisioning,
  expectedGrant,
  isExactGrant,
  parseOptions,
  planProvisioning,
  validateRequest,
} =
  require(
    "../preview-growth-social-capability-provisioning.cjs",
  );

function request() {
  return {
    projectId:
      PROJECT_ID,
    environment:
      ENVIRONMENT,
    firebaseUid:
      "synthetic-admin-1",
    capability:
      REQUIRED_CAPABILITY,
    apply:
      true,
    changeId:
      APPLY_CHANGE_ID,
  };
}

function principal() {
  return {
    isActive:
      true,
    role:
      "VIEWER",
  };
}

function fakeRepository(options = {}) {
  const writes =
    [];

  return {
    writes,

    repository: {
      runTransaction:
        async (callback) =>
          callback({
            getPrincipal:
              async () =>
                options.principal ??
                principal(),

            getGrant:
              async () =>
                options.existingGrant ??
                null,

            createGrant:
              async (
                firebaseUid,
                document,
              ) => {
                writes.push({
                  type:
                    "grant",
                  firebaseUid,
                  document,
                });
              },

            createAudit:
              async (
                id,
                record,
              ) => {
                writes.push({
                  type:
                    "audit",
                  id,
                  record,
                });
              },
          }),
    },
  };
}

test(
  "defines the exact manage-only Preview grant",
  () => {
    assert.deepEqual(
      expectedGrant(),
      {
        capabilities: [
          "growth.social.manage",
        ],
        environment:
          "PREVIEW",
        isActive:
          true,
        schemaVersion:
          "GrowthSocialCapabilityGrantV1",
      },
    );

    assert.equal(
      GRANT_COLLECTION,
      "platform_global_admin_growth_capability_grants",
    );

    assert.equal(
      AUDIT_ACTION,
      "PREVIEW_GROWTH_SOCIAL_CAPABILITY_PROVISIONING",
    );
  },
);

test(
  "accepts a VIEWER principal because authorization is capability-based",
  () => {
    const plan =
      planProvisioning({
        request:
          request(),
        principal:
          principal(),
        existingGrant:
          null,
      });

    assert.equal(
      plan.action,
      "CREATE",
    );
  },
);

test(
  "rejects publish as the initial provisioning capability",
  () => {
    assert.throws(
      () =>
        validateRequest({
          ...request(),
          capability:
            "growth.social.publish",
        }),
      /MANAGE_CAPABILITY_REQUIRED/,
    );
  },
);

test(
  "requires explicit apply and exact change id",
  () => {
    assert.throws(
      () =>
        validateRequest({
          ...request(),
          apply:
            false,
        }),
      /EXPLICIT_APPLY_REQUIRED/,
    );

    assert.throws(
      () =>
        validateRequest({
          ...request(),
          changeId:
            "WRONG",
        }),
      /APPLY_CHANGE_ID_REQUIRED/,
    );
  },
);

test(
  "rejects projects and environments outside Preview authority",
  () => {
    assert.throws(
      () =>
        validateRequest({
          ...request(),
          projectId:
            "wrong-project",
        }),
      /PROJECT_NOT_AUTHORIZED/,
    );

    assert.throws(
      () =>
        validateRequest({
          ...request(),
          environment:
            "PRODUCTION",
        }),
      /PREVIEW_ENVIRONMENT_REQUIRED/,
    );
  },
);

test(
  "fails closed when the canonical principal is inactive",
  () => {
    assert.throws(
      () =>
        planProvisioning({
          request:
            request(),
          principal: {
            isActive:
              false,
            role:
              "VIEWER",
          },
          existingGrant:
            null,
        }),
      /ACTIVE_CANONICAL_PRINCIPAL_REQUIRED/,
    );
  },
);

test(
  "accepts only the exact grant shape",
  () => {
    assert.equal(
      isExactGrant(
        expectedGrant(),
      ),
      true,
    );

    assert.equal(
      isExactGrant({
        ...expectedGrant(),
        extra:
          "forbidden",
      }),
      false,
    );

    assert.equal(
      isExactGrant({
        ...expectedGrant(),
        capabilities: [
          "growth.social.manage",
          "growth.social.publish",
        ],
      }),
      false,
    );
  },
);

test(
  "returns ALREADY_EXACT without mutation",
  async () => {
    const fake =
      fakeRepository({
        existingGrant:
          expectedGrant(),
      });

    const result =
      await executeProvisioning({
        request:
          request(),
        repository:
          fake.repository,
        serverTimestamp:
          "SERVER_TIMESTAMP",
      });

    assert.equal(
      result.status,
      "ALREADY_EXACT",
    );

    assert.equal(
      result.mutationExecuted,
      false,
    );

    assert.equal(
      fake.writes.length,
      0,
    );
  },
);

test(
  "fails closed instead of updating a conflicting grant",
  () => {
    assert.throws(
      () =>
        planProvisioning({
          request:
            request(),
          principal:
            principal(),
          existingGrant: {
            capabilities: [
              "growth.social.publish",
            ],
            environment:
              "PREVIEW",
            isActive:
              true,
            schemaVersion:
              GRANT_SCHEMA_VERSION,
          },
        }),
      /EXISTING_GRANT_CONFLICT/,
    );
  },
);

test(
  "creates exactly one grant and one redacted audit record",
  async () => {
    const fake =
      fakeRepository();

    const result =
      await executeProvisioning({
        request:
          request(),
        repository:
          fake.repository,
        serverTimestamp:
          "SERVER_TIMESTAMP",
      });

    assert.equal(
      result.status,
      "CREATED",
    );

    assert.equal(
      result.capability,
      REQUIRED_CAPABILITY,
    );

    assert.equal(
      fake.writes.length,
      2,
    );

    assert.equal(
      fake.writes[0].type,
      "grant",
    );

    assert.deepEqual(
      fake.writes[0].document,
      expectedGrant(),
    );

    assert.equal(
      fake.writes[1].type,
      "audit",
    );

    assert.equal(
      fake.writes[1].record.uidLocator.startsWith(
        "uid-",
      ),
      true,
    );

    assert.equal(
      JSON.stringify(
        fake.writes[1].record,
      ).includes(
        "synthetic-admin-1",
      ),
      false,
    );
  },
);

test(
  "parses the exact guarded CLI contract",
  () => {
    const options =
      parseOptions([
        `--project=${PROJECT_ID}`,
        `--environment=${ENVIRONMENT}`,
        "--firebase-uid=synthetic-admin-1",
        `--capability=${REQUIRED_CAPABILITY}`,
        "--apply=true",
        `--change-id=${APPLY_CHANGE_ID}`,
      ]);

    assert.deepEqual(
      options,
      request(),
    );
  },
);