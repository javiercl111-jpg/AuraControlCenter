"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { createRequire } = require("node:module");

const PREVIEW_PROJECT_ID = "aura-intel-preview";
const PREVIEW_ENVIRONMENT = "PREVIEW";
const GLOBAL_ADMIN_COLLECTION = "platform_global_admins";
const GLOBAL_ADMIN_AUDIT_COLLECTION = "platform_audit_logs";
const RECOMMENDED_PREVIEW_ROLE = "VIEWER";
const APPLY_CHANGE_ID = "PREVIEW-GLOBAL-ADMIN-PROVISIONING-R3-V1";

const PRODUCTIVE_ADMIN_ROLES = Object.freeze([
  "PLATFORM_OWNER",
  "PLATFORM_PARTNER",
  "SUPER_ADMIN",
  "FOUNDER",
  "SALES_DIRECTOR",
  "CONSULTANT",
  "SALES_ADVISOR",
  "VIEWER",
  "ADMIN",
  "SUPPORT",
]);

const REQUEST_FIELDS = Object.freeze([
  "firebaseUid",
  "isActive",
  "role",
  "targetEnvironment",
]);

class PreviewGlobalAdminProvisioningError extends Error {
  constructor(code) {
    super(code);
    this.name = "PreviewGlobalAdminProvisioningError";
    this.code = code;
  }
}

function fail(code) {
  throw new PreviewGlobalAdminProvisioningError(code);
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * @typedef {Readonly<{
 *   targetEnvironment: "PREVIEW";
 *   firebaseUid: string;
 *   role: string;
 *   isActive: true;
 * }>} PreviewGlobalAdminProvisioningRequestV1
 */

/** @returns {PreviewGlobalAdminProvisioningRequestV1} */
function validatePreviewGlobalAdminProvisioningRequestV1(candidate) {
  if (!isRecord(candidate)) fail("INVALID_REQUEST");
  const keys = Object.keys(candidate).sort();
  if (
    keys.length !== REQUEST_FIELDS.length ||
    !keys.every((key, index) => key === REQUEST_FIELDS[index])
  ) {
    fail("UNEXPECTED_REQUEST_FIELD");
  }
  if (candidate.targetEnvironment !== PREVIEW_ENVIRONMENT) {
    fail("ENVIRONMENT_NOT_PREVIEW");
  }
  if (typeof candidate.firebaseUid !== "string") fail("UID_REQUIRED");
  if (/\r|\n/u.test(candidate.firebaseUid)) fail("UID_MULTILINE_FORBIDDEN");
  const firebaseUid = candidate.firebaseUid.trim();
  if (firebaseUid.length === 0) fail("UID_REQUIRED");
  if (firebaseUid.length > 128) fail("UID_TOO_LONG");
  if (
    typeof candidate.role !== "string" ||
    !PRODUCTIVE_ADMIN_ROLES.includes(candidate.role)
  ) {
    fail("ROLE_NOT_ALLOWED");
  }
  if (candidate.isActive !== true) fail("ACTIVE_STATE_REQUIRED");
  return Object.freeze({
    targetEnvironment: PREVIEW_ENVIRONMENT,
    firebaseUid,
    role: candidate.role,
    isActive: true,
  });
}

function assertTargetV1(target) {
  if (!isRecord(target)) fail("TARGET_GUARD_REJECTED");
  if (target.projectId !== PREVIEW_PROJECT_ID) fail("PROJECT_NOT_PREVIEW");
  if (target.environment !== PREVIEW_ENVIRONMENT) {
    fail("ENVIRONMENT_NOT_PREVIEW");
  }
  if (target.collection !== GLOBAL_ADMIN_COLLECTION) {
    fail("COLLECTION_NOT_GLOBAL_ADMINS");
  }
}

function desiredDocument(request) {
  return Object.freeze({ isActive: true, role: request.role });
}

function isExactDocument(value, expected) {
  if (!isRecord(value)) return false;
  const keys = Object.keys(value).sort();
  return (
    keys.length === 2 &&
    keys[0] === "isActive" &&
    keys[1] === "role" &&
    value.isActive === expected.isActive &&
    value.role === expected.role
  );
}

function digest(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function uidLocator(firebaseUid) {
  return `sha256:${digest(firebaseUid).slice(0, 12)}`;
}

function auditId(firebaseUid, role) {
  return `preview-global-admin-${digest(`${firebaseUid}\u0000${role}`)}`;
}

function planPreviewGlobalAdminProvisioningV1(input) {
  const request = validatePreviewGlobalAdminProvisioningRequestV1(input.request);
  assertTargetV1(input.target);
  const expected = desiredDocument(request);
  if (input.existingDocument === null) {
    return Object.freeze({ request, expected, action: "CREATED", beforeExists: false });
  }
  if (!isExactDocument(input.existingDocument, expected)) {
    fail("EXISTING_DOCUMENT_CONFLICT");
  }
  return Object.freeze({ request, expected, action: "REUSED", beforeExists: true });
}

function safeResult(plan, dryRun, occurredAt) {
  return Object.freeze({
    version: "PREVIEW_GLOBAL_ADMIN_PROVISIONING_V1",
    mode: dryRun ? "DRY_RUN" : "APPLY",
    targetEnvironment: PREVIEW_ENVIRONMENT,
    targetProject: PREVIEW_PROJECT_ID,
    targetCollection: GLOBAL_ADMIN_COLLECTION,
    action: plan.action,
    role: plan.request.role,
    uidLocator: uidLocator(plan.request.firebaseUid),
    beforeExists: plan.beforeExists,
    afterValid: true,
    writes: dryRun || plan.action === "REUSED" ? 0 : 2,
    occurredAt,
  });
}

function safeAuditRecord(plan, occurredAt) {
  return Object.freeze({
    action: "PREVIEW_GLOBAL_ADMIN_PROVISIONING",
    result: plan.action,
    targetEnvironment: PREVIEW_ENVIRONMENT,
    targetCollection: GLOBAL_ADMIN_COLLECTION,
    role: plan.request.role,
    uidLocator: uidLocator(plan.request.firebaseUid),
    beforeExists: plan.beforeExists,
    afterValid: true,
    timestamp: occurredAt,
  });
}

async function executePreviewGlobalAdminProvisioningV1(input) {
  if (!isRecord(input) || typeof input.dryRun !== "boolean") {
    fail("INVALID_EXECUTION_INPUT");
  }
  const request = validatePreviewGlobalAdminProvisioningRequestV1(input.request);
  assertTargetV1(input.target);
  if (!input.repository || typeof input.repository.runTransaction !== "function") {
    fail("REPOSITORY_REQUIRED");
  }
  const occurredAt = input.clock.now();
  return input.repository.runTransaction(async (transaction) => {
    const existingDocument = await transaction.getAdmin(request.firebaseUid);
    const plan = planPreviewGlobalAdminProvisioningV1({
      request,
      target: input.target,
      existingDocument,
    });
    const result = safeResult(plan, input.dryRun, occurredAt);
    if (input.dryRun || plan.action === "REUSED") return result;
    await transaction.createAdmin(request.firebaseUid, plan.expected);
    await transaction.createAudit(
      auditId(request.firebaseUid, request.role),
      safeAuditRecord(plan, occurredAt),
    );
    return result;
  });
}

function createFirestoreRepositoryV1(firestore, serverTimestamp) {
  return Object.freeze({
    runTransaction(operation) {
      return firestore.runTransaction(async (firestoreTransaction) => {
        const admins = firestore.collection(GLOBAL_ADMIN_COLLECTION);
        const audits = firestore.collection(GLOBAL_ADMIN_AUDIT_COLLECTION);
        return operation(Object.freeze({
          async getAdmin(firebaseUid) {
            const snapshot = await firestoreTransaction.get(admins.doc(firebaseUid));
            return snapshot.exists ? snapshot.data() : null;
          },
          async createAdmin(firebaseUid, document) {
            firestoreTransaction.create(admins.doc(firebaseUid), document);
          },
          async createAudit(id, record) {
            firestoreTransaction.create(audits.doc(id), {
              ...record,
              timestamp: serverTimestamp(),
            });
          },
        }));
      });
    },
  });
}

function parseArguments(argv) {
  const allowedPrefixes = [
    "--project=",
    "--environment=",
    "--role=",
    "--is-active=",
    "--uid-file=",
    "--confirm-change-id=",
  ];
  for (const value of argv) {
    if (
      value !== "--dry-run" &&
      value !== "--apply" &&
      !allowedPrefixes.some((prefix) => value.startsWith(prefix))
    ) {
      fail("UNEXPECTED_ARGUMENT");
    }
  }
  const valueOf = (prefix) =>
    argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
  const dryRun = argv.includes("--dry-run");
  const apply = argv.includes("--apply");
  if (dryRun === apply) fail("EXECUTION_MODE_REQUIRED");
  const confirmChangeId = valueOf("--confirm-change-id=");
  if (apply && confirmChangeId !== APPLY_CHANGE_ID) fail("APPLY_CONFIRMATION_REQUIRED");
  return Object.freeze({
    dryRun,
    apply,
    projectId: valueOf("--project="),
    environment: valueOf("--environment="),
    role: valueOf("--role="),
    isActive: valueOf("--is-active=") === "true",
    uidFile: valueOf("--uid-file=") || process.env.AURA_PREVIEW_UID_FILE,
  });
}

function readUidFile(uidFile) {
  if (typeof uidFile !== "string" || uidFile.trim().length === 0) {
    fail("UID_FILE_REQUIRED");
  }
  return fs.readFileSync(uidFile, "utf8").trim();
}

function safeErrorCode(error) {
  return error instanceof PreviewGlobalAdminProvisioningError
    ? error.code
    : "CONTROLLED_OPERATION_FAILED";
}

async function run() {
  const options = parseArguments(process.argv.slice(2));
  const firebaseUid = readUidFile(options.uidFile);
  const request = validatePreviewGlobalAdminProvisioningRequestV1({
    targetEnvironment: options.environment,
    firebaseUid,
    role: options.role,
    isActive: options.isActive,
  });
  const target = Object.freeze({
    projectId: options.projectId,
    environment: options.environment,
    collection: GLOBAL_ADMIN_COLLECTION,
  });
  assertTargetV1(target);

  const functionsRequire = createRequire(
    path.resolve(__dirname, "..", "functions", "package.json"),
  );
  const { applicationDefault, getApps, initializeApp } = functionsRequire("firebase-admin/app");
  const { FieldValue, getFirestore } = functionsRequire("firebase-admin/firestore");
  const app = getApps().find((candidate) => candidate.name === "preview-global-admin-r3") ||
    initializeApp(
      { credential: applicationDefault(), projectId: PREVIEW_PROJECT_ID },
      "preview-global-admin-r3",
    );
  const repository = createFirestoreRepositoryV1(
    getFirestore(app),
    () => FieldValue.serverTimestamp(),
  );
  const result = await executePreviewGlobalAdminProvisioningV1({
    request,
    target,
    dryRun: options.dryRun,
    repository,
    clock: Object.freeze({ now: () => new Date().toISOString() }),
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (require.main === module) {
  run().catch((error) => {
    process.stderr.write(`${JSON.stringify({ status: "FAILED", safeErrorCode: safeErrorCode(error) })}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  APPLY_CHANGE_ID,
  GLOBAL_ADMIN_AUDIT_COLLECTION,
  GLOBAL_ADMIN_COLLECTION,
  PREVIEW_ENVIRONMENT,
  PREVIEW_PROJECT_ID,
  PRODUCTIVE_ADMIN_ROLES,
  RECOMMENDED_PREVIEW_ROLE,
  PreviewGlobalAdminProvisioningError,
  assertTargetV1,
  createFirestoreRepositoryV1,
  executePreviewGlobalAdminProvisioningV1,
  isExactDocument,
  parseArguments,
  planPreviewGlobalAdminProvisioningV1,
  safeAuditRecord,
  uidLocator,
  validatePreviewGlobalAdminProvisioningRequestV1,
};
