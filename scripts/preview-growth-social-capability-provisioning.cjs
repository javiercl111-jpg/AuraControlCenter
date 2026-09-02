"use strict";

const { createHash } = require("node:crypto");
const { createRequire } = require("node:module");
const path = require("node:path");

const PROJECT_ID = "aura-intel-preview";
const ENVIRONMENT = "PREVIEW";

const PRINCIPAL_COLLECTION = "platform_global_admins";
const GRANT_COLLECTION =
  "platform_global_admin_growth_capability_grants";
const AUDIT_COLLECTION = "platform_audit_logs";

const GRANT_SCHEMA_VERSION =
  "GrowthSocialCapabilityGrantV1";

const REQUIRED_CAPABILITY =
  "growth.social.manage";

const FORBIDDEN_INITIAL_CAPABILITY =
  "growth.social.publish";

const AUDIT_ACTION =
  "PREVIEW_GROWTH_SOCIAL_CAPABILITY_PROVISIONING";

const APPLY_CHANGE_ID =
  "PREVIEW-GROWTH-SOCIAL-CAPABILITY-PROVISIONING-V1";

class PreviewGrowthSocialCapabilityProvisioningError
  extends Error {
  constructor(code) {
    super(code);
    this.name =
      "PreviewGrowthSocialCapabilityProvisioningError";
    this.code = code;
  }
}

function fail(code) {
  throw new PreviewGrowthSocialCapabilityProvisioningError(
    code,
  );
}

function digest(value) {
  return createHash("sha256")
    .update(value, "utf8")
    .digest("hex");
}

function uidLocator(firebaseUid) {
  return `uid-${digest(firebaseUid).slice(0, 24)}`;
}

function auditId(firebaseUid) {
  return (
    "preview-growth-social-manage-" +
    digest(
      `${firebaseUid}\u0000${REQUIRED_CAPABILITY}`,
    ).slice(0, 32)
  );
}

function exactKeys(value, expected) {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return false;
  }

  const actual =
    Object.keys(value).sort();

  const wanted =
    [...expected].sort();

  if (actual.length !== wanted.length) {
    return false;
  }

  return actual.every(
    (key, index) =>
      key === wanted[index],
  );
}

function expectedGrant() {
  return Object.freeze({
    capabilities:
      Object.freeze([REQUIRED_CAPABILITY]),
    environment:
      ENVIRONMENT,
    isActive:
      true,
    schemaVersion:
      GRANT_SCHEMA_VERSION,
  });
}

function isExactGrant(value) {
  if (
    !exactKeys(
      value,
      [
        "capabilities",
        "environment",
        "isActive",
        "schemaVersion",
      ],
    )
  ) {
    return false;
  }

  if (
    value.environment !== ENVIRONMENT ||
    value.isActive !== true ||
    value.schemaVersion !== GRANT_SCHEMA_VERSION
  ) {
    return false;
  }

  if (!Array.isArray(value.capabilities)) {
    return false;
  }

  if (value.capabilities.length !== 1) {
    return false;
  }

  return (
    value.capabilities[0] ===
    REQUIRED_CAPABILITY
  );
}

function validateRequest(candidate) {
  if (
    candidate === null ||
    typeof candidate !== "object" ||
    Array.isArray(candidate)
  ) {
    fail("REQUEST_REQUIRED");
  }

  if (candidate.projectId !== PROJECT_ID) {
    fail("PROJECT_NOT_AUTHORIZED");
  }

  if (candidate.environment !== ENVIRONMENT) {
    fail("PREVIEW_ENVIRONMENT_REQUIRED");
  }

  if (
    typeof candidate.firebaseUid !== "string" ||
    candidate.firebaseUid.trim().length < 1
  ) {
    fail("FIREBASE_UID_REQUIRED");
  }

  if (
    candidate.capability !==
    REQUIRED_CAPABILITY
  ) {
    fail("MANAGE_CAPABILITY_REQUIRED");
  }

  if (
    candidate.capability ===
    FORBIDDEN_INITIAL_CAPABILITY
  ) {
    fail("PUBLISH_CAPABILITY_NOT_AUTHORIZED");
  }

  if (candidate.apply !== true) {
    fail("EXPLICIT_APPLY_REQUIRED");
  }

  if (
    candidate.changeId !==
    APPLY_CHANGE_ID
  ) {
    fail("APPLY_CHANGE_ID_REQUIRED");
  }

  return Object.freeze({
    projectId:
      PROJECT_ID,
    environment:
      ENVIRONMENT,
    firebaseUid:
      candidate.firebaseUid.trim(),
    capability:
      REQUIRED_CAPABILITY,
    apply:
      true,
    changeId:
      APPLY_CHANGE_ID,
  });
}

function planProvisioning(input) {
  const request =
    validateRequest(input.request);

  if (
    input.principal === null ||
    typeof input.principal !== "object" ||
    Array.isArray(input.principal)
  ) {
    fail("CANONICAL_PRINCIPAL_REQUIRED");
  }

  if (input.principal.isActive !== true) {
    fail("ACTIVE_CANONICAL_PRINCIPAL_REQUIRED");
  }

  const expected =
    expectedGrant();

  if (
    input.existingGrant === null ||
    input.existingGrant === undefined
  ) {
    return Object.freeze({
      action:
        "CREATE",
      request,
      expected,
    });
  }

  if (isExactGrant(input.existingGrant)) {
    return Object.freeze({
      action:
        "ALREADY_EXACT",
      request,
      expected,
    });
  }

  fail("EXISTING_GRANT_CONFLICT");
}

function auditRecord(
  request,
  action,
  serverTimestamp,
) {
  return Object.freeze({
    action:
      AUDIT_ACTION,
    capability:
      REQUIRED_CAPABILITY,
    environment:
      ENVIRONMENT,
    result:
      action,
    schemaVersion:
      GRANT_SCHEMA_VERSION,
    targetCollection:
      GRANT_COLLECTION,
    timestamp:
      serverTimestamp,
    uidLocator:
      uidLocator(request.firebaseUid),
  });
}

async function executeProvisioning(input) {
  const request =
    validateRequest(input.request);

  return input.repository.runTransaction(
    async (transaction) => {
      const principal =
        await transaction.getPrincipal(
          request.firebaseUid,
        );

      const existingGrant =
        await transaction.getGrant(
          request.firebaseUid,
        );

      const plan =
        planProvisioning({
          request,
          principal,
          existingGrant,
        });

      if (plan.action === "ALREADY_EXACT") {
        return Object.freeze({
          status:
            "ALREADY_EXACT",
          capability:
            REQUIRED_CAPABILITY,
          mutationExecuted:
            false,
        });
      }

      await transaction.createGrant(
        request.firebaseUid,
        plan.expected,
      );

      await transaction.createAudit(
        auditId(request.firebaseUid),
        auditRecord(
          request,
          "CREATED",
          input.serverTimestamp,
        ),
      );

      return Object.freeze({
        status:
          "CREATED",
        capability:
          REQUIRED_CAPABILITY,
        mutationExecuted:
          true,
      });
    },
  );
}

function createFirestoreRepository(
  firestore,
) {
  return Object.freeze({
    runTransaction: async (callback) =>
      firestore.runTransaction(
        async (firestoreTransaction) => {
          const principals =
            firestore.collection(
              PRINCIPAL_COLLECTION,
            );

          const grants =
            firestore.collection(
              GRANT_COLLECTION,
            );

          const audits =
            firestore.collection(
              AUDIT_COLLECTION,
            );

          return callback({
            getPrincipal:
              async (firebaseUid) => {
                const snapshot =
                  await firestoreTransaction.get(
                    principals.doc(firebaseUid),
                  );

                if (!snapshot.exists) {
                  return null;
                }

                return snapshot.data() ?? null;
              },

            getGrant:
              async (firebaseUid) => {
                const snapshot =
                  await firestoreTransaction.get(
                    grants.doc(firebaseUid),
                  );

                if (!snapshot.exists) {
                  return null;
                }

                return snapshot.data() ?? null;
              },

            createGrant:
              async (
                firebaseUid,
                document,
              ) => {
                firestoreTransaction.create(
                  grants.doc(firebaseUid),
                  document,
                );
              },

            createAudit:
              async (
                id,
                record,
              ) => {
                firestoreTransaction.create(
                  audits.doc(id),
                  record,
                );
              },
          });
        },
      ),
  });
}

function parseOptions(argv) {
  const values =
    new Map();

  for (const argument of argv) {
    if (!argument.startsWith("--")) {
      continue;
    }

    const separator =
      argument.indexOf("=");

    if (separator < 0) {
      continue;
    }

    values.set(
      argument.slice(0, separator),
      argument.slice(separator + 1),
    );
  }

  return Object.freeze({
    projectId:
      values.get("--project") ?? "",
    environment:
      values.get("--environment") ?? "",
    firebaseUid:
      values.get("--firebase-uid") ?? "",
    capability:
      values.get("--capability") ?? "",
    apply:
      values.get("--apply") === "true",
    changeId:
      values.get("--change-id") ?? "",
  });
}

function safeErrorCode(error) {
  if (
    error instanceof
    PreviewGrowthSocialCapabilityProvisioningError
  ) {
    return error.code;
  }

  return "INTERNAL_FAILURE";
}

async function main() {
  const request =
    validateRequest(
      parseOptions(
        process.argv.slice(2),
      ),
    );

  const functionsRequire =
    createRequire(
      path.resolve(
        __dirname,
        "../functions/package.json",
      ),
    );

  const {
    applicationDefault,
    getApps,
    initializeApp,
  } =
    functionsRequire(
      "firebase-admin/app",
    );

  const {
    FieldValue,
    getFirestore,
  } =
    functionsRequire(
      "firebase-admin/firestore",
    );

  const appName =
    "preview-growth-social-capability-provisioner";

  const app =
    getApps().find(
      (candidate) =>
        candidate.name === appName,
    ) ??
    initializeApp(
      {
        credential:
          applicationDefault(),
        projectId:
          PROJECT_ID,
      },
      appName,
    );

  const firestore =
    getFirestore(app);

  const result =
    await executeProvisioning({
      request,
      repository:
        createFirestoreRepository(
          firestore,
        ),
      serverTimestamp:
        FieldValue.serverTimestamp(),
    });

  process.stdout.write(
    `${JSON.stringify({
      status:
        result.status,
      capability:
        result.capability,
      mutationExecuted:
        result.mutationExecuted,
      projectId:
        PROJECT_ID,
      environment:
        ENVIRONMENT,
      uidPrinted:
        false,
    })}\n`,
  );
}

if (require.main === module) {
  main().catch(
    (error) => {
      process.stderr.write(
        `${JSON.stringify({
          status:
            "FAILED",
          safeErrorCode:
            safeErrorCode(error),
          uidPrinted:
            false,
        })}\n`,
      );

      process.exitCode = 1;
    },
  );
}

module.exports = Object.freeze({
  APPLY_CHANGE_ID,
  AUDIT_ACTION,
  AUDIT_COLLECTION,
  ENVIRONMENT,
  GRANT_COLLECTION,
  GRANT_SCHEMA_VERSION,
  PRINCIPAL_COLLECTION,
  PROJECT_ID,
  REQUIRED_CAPABILITY,
  auditId,
  auditRecord,
  createFirestoreRepository,
  exactKeys,
  executeProvisioning,
  expectedGrant,
  isExactGrant,
  parseOptions,
  planProvisioning,
  safeErrorCode,
  uidLocator,
  validateRequest,
});