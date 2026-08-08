"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { createRequire } = require("node:module");

const PREVIEW_PROJECT_ID = "aura-intel-preview";
const PREVIEW_ENVIRONMENT = "PREVIEW";
const PRINCIPAL_COLLECTION = "platform_global_admins";
const GRANT_COLLECTION = "platform_global_admin_capability_grants";
const AUDIT_COLLECTION = "platform_audit_logs";
const REQUIRED_ROLE = "VIEWER";
const REQUIRED_CAPABILITY = "crm.leads.create";
const GRANT_SCHEMA = "PlatformGlobalAdminCapabilityGrantV1";
const APPLY_CHANGE_ID = "PREVIEW-CRM-LEAD-CREATE-CAPABILITY-R8-V1";
const REQUEST_FIELDS = Object.freeze([
  "capability",
  "expectedRole",
  "firebaseUid",
  "targetEnvironment",
]);

class PreviewCrmLeadCapabilityProvisioningError extends Error {
  constructor(code) {
    super(code);
    this.name = "PreviewCrmLeadCapabilityProvisioningError";
    this.code = code;
  }
}

function fail(code) {
  throw new PreviewCrmLeadCapabilityProvisioningError(code);
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function digest(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function uidLocator(firebaseUid) {
  return `sha256:${digest(firebaseUid).slice(0, 12)}`;
}

function validateRequest(candidate) {
  if (!isRecord(candidate)) fail("INVALID_REQUEST");
  const keys = Object.keys(candidate).sort();
  if (keys.length !== REQUEST_FIELDS.length ||
      !keys.every((key, index) => key === REQUEST_FIELDS[index])) {
    fail("UNEXPECTED_REQUEST_FIELD");
  }
  if (candidate.targetEnvironment !== PREVIEW_ENVIRONMENT) {
    fail("ENVIRONMENT_NOT_PREVIEW");
  }
  if (candidate.expectedRole !== REQUIRED_ROLE) fail("VIEWER_ROLE_REQUIRED");
  if (candidate.capability !== REQUIRED_CAPABILITY) {
    fail("EXACT_CAPABILITY_REQUIRED");
  }
  if (typeof candidate.firebaseUid !== "string") fail("UID_REQUIRED");
  if (/\r|\n/u.test(candidate.firebaseUid)) fail("UID_MULTILINE_FORBIDDEN");
  const firebaseUid = candidate.firebaseUid.trim();
  if (!firebaseUid) fail("UID_REQUIRED");
  if (firebaseUid.length > 128) fail("UID_TOO_LONG");
  return Object.freeze({
    targetEnvironment: PREVIEW_ENVIRONMENT,
    firebaseUid,
    expectedRole: REQUIRED_ROLE,
    capability: REQUIRED_CAPABILITY,
  });
}

function assertTarget(target) {
  if (!isRecord(target)) fail("TARGET_GUARD_REJECTED");
  if (target.projectId !== PREVIEW_PROJECT_ID) fail("PROJECT_NOT_PREVIEW");
  if (target.environment !== PREVIEW_ENVIRONMENT) fail("ENVIRONMENT_NOT_PREVIEW");
  if (target.principalCollection !== PRINCIPAL_COLLECTION ||
      target.grantCollection !== GRANT_COLLECTION ||
      target.auditCollection !== AUDIT_COLLECTION) {
    fail("COLLECTION_TARGET_MISMATCH");
  }
}

function exactPrincipal(value) {
  if (!isRecord(value)) return false;
  const keys = Object.keys(value).sort();
  return keys.length === 2 && keys[0] === "isActive" && keys[1] === "role" &&
    value.isActive === true && value.role === REQUIRED_ROLE;
}

function desiredGrant() {
  return Object.freeze({
    schemaVersion: GRANT_SCHEMA,
    environment: PREVIEW_ENVIRONMENT,
    isActive: true,
    capabilities: Object.freeze([REQUIRED_CAPABILITY]),
  });
}

function exactGrant(value) {
  if (!isRecord(value)) return false;
  const keys = Object.keys(value).sort();
  return keys.length === 4 &&
    keys[0] === "capabilities" && keys[1] === "environment" &&
    keys[2] === "isActive" && keys[3] === "schemaVersion" &&
    value.schemaVersion === GRANT_SCHEMA &&
    value.environment === PREVIEW_ENVIRONMENT && value.isActive === true &&
    Array.isArray(value.capabilities) && value.capabilities.length === 1 &&
    value.capabilities[0] === REQUIRED_CAPABILITY;
}

function planProvisioning(input) {
  const request = validateRequest(input.request);
  assertTarget(input.target);
  if (input.principalDocument === null) fail("PRINCIPAL_NOT_FOUND");
  if (!exactPrincipal(input.principalDocument)) fail("PRINCIPAL_CONTRACT_INVALID");
  if (input.grantDocument === null) {
    return Object.freeze({ request, desired: desiredGrant(), action: "CREATE" });
  }
  if (!exactGrant(input.grantDocument)) fail("EXISTING_GRANT_CONFLICT");
  return Object.freeze({ request, desired: desiredGrant(), action: "REUSE" });
}

function safeResult(plan, dryRun, occurredAt) {
  const creating = plan.action === "CREATE";
  return Object.freeze({
    version: "PREVIEW_CRM_LEAD_CAPABILITY_PROVISIONING_V1",
    mode: dryRun ? "DRY_RUN" : "APPLY",
    targetProject: PREVIEW_PROJECT_ID,
    targetEnvironment: PREVIEW_ENVIRONMENT,
    targetCollection: GRANT_COLLECTION,
    action: creating ? (dryRun ? "WOULD_CREATE" : "CREATED") : "REUSED",
    roleBefore: REQUIRED_ROLE,
    roleAfter: REQUIRED_ROLE,
    capabilityBefore: creating ? "ABSENT" : "PRESENT",
    capabilityAfter: REQUIRED_CAPABILITY,
    additionalCapabilities: 0,
    writes: dryRun || !creating ? 0 : 2,
    uidLocator: uidLocator(plan.request.firebaseUid),
    occurredAt,
  });
}

function auditRecord(plan, occurredAt) {
  return Object.freeze({
    action: "PREVIEW_CRM_LEAD_CREATE_CAPABILITY_PROVISIONING",
    result: "CREATED",
    targetEnvironment: PREVIEW_ENVIRONMENT,
    targetCollection: GRANT_COLLECTION,
    roleBefore: REQUIRED_ROLE,
    roleAfter: REQUIRED_ROLE,
    capability: REQUIRED_CAPABILITY,
    additionalCapabilities: 0,
    uidLocator: uidLocator(plan.request.firebaseUid),
    timestamp: occurredAt,
  });
}

async function executeProvisioning(input) {
  if (!isRecord(input) || typeof input.dryRun !== "boolean") {
    fail("INVALID_EXECUTION_INPUT");
  }
  const request = validateRequest(input.request);
  assertTarget(input.target);
  if (!input.repository || typeof input.repository.runTransaction !== "function") {
    fail("REPOSITORY_REQUIRED");
  }
  const occurredAt = input.clock.now();
  return input.repository.runTransaction(async (transaction) => {
    const principalDocument = await transaction.getPrincipal(request.firebaseUid);
    const grantDocument = await transaction.getGrant(request.firebaseUid);
    const plan = planProvisioning({
      request,
      target: input.target,
      principalDocument,
      grantDocument,
    });
    const result = safeResult(plan, input.dryRun, occurredAt);
    if (input.dryRun || plan.action === "REUSE") return result;
    await transaction.createGrant(request.firebaseUid, plan.desired);
    await transaction.createAudit(
      `preview-crm-lead-capability-${digest(request.firebaseUid)}`,
      auditRecord(plan, occurredAt),
    );
    return result;
  });
}

function createFirestoreRepository(firestore, serverTimestamp) {
  return Object.freeze({
    runTransaction(operation) {
      return firestore.runTransaction(async (firestoreTransaction) => {
        const principals = firestore.collection(PRINCIPAL_COLLECTION);
        const grants = firestore.collection(GRANT_COLLECTION);
        const audits = firestore.collection(AUDIT_COLLECTION);
        return operation(Object.freeze({
          async getPrincipal(firebaseUid) {
            const snapshot = await firestoreTransaction.get(principals.doc(firebaseUid));
            return snapshot.exists ? snapshot.data() : null;
          },
          async getGrant(firebaseUid) {
            const snapshot = await firestoreTransaction.get(grants.doc(firebaseUid));
            return snapshot.exists ? snapshot.data() : null;
          },
          async createGrant(firebaseUid, document) {
            firestoreTransaction.create(grants.doc(firebaseUid), document);
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
  const prefixes = [
    "--project=", "--environment=", "--capability=", "--expected-role=",
    "--uid-file=", "--confirm-change-id=",
  ];
  for (const value of argv) {
    if (value !== "--dry-run" && value !== "--apply" &&
        !prefixes.some((prefix) => value.startsWith(prefix))) {
      fail("UNEXPECTED_ARGUMENT");
    }
  }
  const valueOf = (prefix) =>
    argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
  const dryRun = argv.includes("--dry-run");
  const apply = argv.includes("--apply");
  if (dryRun === apply) fail("EXECUTION_MODE_REQUIRED");
  if (apply && valueOf("--confirm-change-id=") !== APPLY_CHANGE_ID) {
    fail("APPLY_CONFIRMATION_REQUIRED");
  }
  return Object.freeze({
    dryRun,
    apply,
    projectId: valueOf("--project="),
    environment: valueOf("--environment="),
    capability: valueOf("--capability="),
    expectedRole: valueOf("--expected-role="),
    uidFile: valueOf("--uid-file=") || process.env.AURA_PREVIEW_UID_FILE,
  });
}

function readUidFile(uidFile) {
  if (typeof uidFile !== "string" || !uidFile.trim()) fail("UID_FILE_REQUIRED");
  return fs.readFileSync(uidFile, "utf8").trim();
}

function safeErrorCode(error) {
  return error instanceof PreviewCrmLeadCapabilityProvisioningError
    ? error.code
    : "CONTROLLED_OPERATION_FAILED";
}

async function run() {
  const options = parseArguments(process.argv.slice(2));
  const firebaseUid = readUidFile(options.uidFile);
  const request = validateRequest({
    targetEnvironment: options.environment,
    firebaseUid,
    expectedRole: options.expectedRole,
    capability: options.capability,
  });
  const target = Object.freeze({
    projectId: options.projectId,
    environment: options.environment,
    principalCollection: PRINCIPAL_COLLECTION,
    grantCollection: GRANT_COLLECTION,
    auditCollection: AUDIT_COLLECTION,
  });
  assertTarget(target);

  const functionsRequire = createRequire(
    path.resolve(__dirname, "..", "functions", "package.json"),
  );
  const { applicationDefault, getApps, initializeApp } =
    functionsRequire("firebase-admin/app");
  const { FieldValue, getFirestore } = functionsRequire("firebase-admin/firestore");
  const app = getApps().find((candidate) => candidate.name === "preview-crm-lead-r8") ||
    initializeApp(
      { credential: applicationDefault(), projectId: PREVIEW_PROJECT_ID },
      "preview-crm-lead-r8",
    );
  const result = await executeProvisioning({
    request,
    target,
    dryRun: options.dryRun,
    repository: createFirestoreRepository(
      getFirestore(app),
      () => FieldValue.serverTimestamp(),
    ),
    clock: Object.freeze({ now: () => new Date().toISOString() }),
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (require.main === module) {
  run().catch((error) => {
    process.stderr.write(`${JSON.stringify({
      status: "FAILED",
      safeErrorCode: safeErrorCode(error),
    })}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  APPLY_CHANGE_ID,
  AUDIT_COLLECTION,
  GRANT_COLLECTION,
  GRANT_SCHEMA,
  PREVIEW_ENVIRONMENT,
  PREVIEW_PROJECT_ID,
  PRINCIPAL_COLLECTION,
  REQUIRED_CAPABILITY,
  REQUIRED_ROLE,
  PreviewCrmLeadCapabilityProvisioningError,
  auditRecord,
  createFirestoreRepository,
  exactGrant,
  executeProvisioning,
  parseArguments,
  planProvisioning,
  uidLocator,
  validateRequest,
};
