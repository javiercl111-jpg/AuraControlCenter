"use strict";

const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const {
  APPLY_CHANGE_ID,
  GLOBAL_ADMIN_COLLECTION,
  PRODUCTIVE_ADMIN_ROLES,
  RECOMMENDED_PREVIEW_ROLE,
  executePreviewGlobalAdminProvisioningV1,
  parseArguments,
  validatePreviewGlobalAdminProvisioningRequestV1,
} = require("../preview-global-admin-provisioning.cjs");

const FIREBASE_UID = "preview-uid-r3-0001";
const TARGET = Object.freeze({
  projectId: "aura-intel-preview",
  environment: "PREVIEW",
  collection: GLOBAL_ADMIN_COLLECTION,
});

function request(overrides = {}) {
  return {
    targetEnvironment: "PREVIEW",
    firebaseUid: FIREBASE_UID,
    role: RECOMMENDED_PREVIEW_ROLE,
    isActive: true,
    ...overrides,
  };
}

function fakeRepository(existingDocument = null) {
  const state = {
    existingDocument,
    adminWrites: [],
    auditWrites: [],
  };
  return {
    state,
    repository: {
      async runTransaction(operation) {
        return operation({
          async getAdmin(firebaseUid) {
            assert.equal(firebaseUid, FIREBASE_UID);
            return state.existingDocument;
          },
          async createAdmin(firebaseUid, document) {
            state.adminWrites.push({ path: `${GLOBAL_ADMIN_COLLECTION}/${firebaseUid}`, document });
            state.existingDocument = document;
          },
          async createAudit(id, record) {
            state.auditWrites.push({ id, record });
          },
        });
      },
    },
  };
}

function input(options = {}) {
  const fake = options.fake || fakeRepository(options.existingDocument ?? null);
  return {
    fake,
    execution: {
      request: options.request || request(),
      target: options.target || TARGET,
      dryRun: options.dryRun ?? false,
      repository: fake.repository,
      clock: { now: () => "2026-08-08T12:00:00.000Z" },
    },
  };
}

async function expectCode(promise, code) {
  await assert.rejects(promise, (error) => error?.code === code);
}

test("1. Preview accepted with the productive role allowlist and VIEWER recommendation", async () => {
  const rules = fs.readFileSync(path.resolve("firestore.rules"), "utf8");
  const roleBlock = rules.match(/data\.role in \[([\s\S]*?)\]/u)?.[1];
  assert.ok(roleBlock);
  const rulesRoles = [...roleBlock.matchAll(/'([^']+)'/gu)].map((match) => match[1]);
  assert.deepEqual(rulesRoles, PRODUCTIVE_ADMIN_ROLES);
  assert.equal(RECOMMENDED_PREVIEW_ROLE, "VIEWER");
  assert.equal(validatePreviewGlobalAdminProvisioningRequestV1(request()).role, "VIEWER");
});

test("2. Production rejected", async () => {
  const { execution } = input({ target: { ...TARGET, projectId: "production-forbidden" } });
  await expectCode(executePreviewGlobalAdminProvisioningV1(execution), "PROJECT_NOT_PREVIEW");
});

test("3. Staging rejected", async () => {
  const { execution } = input({ request: request({ targetEnvironment: "STAGING" }) });
  await expectCode(executePreviewGlobalAdminProvisioningV1(execution), "ENVIRONMENT_NOT_PREVIEW");
});

test("4. missing UID rejected", () => {
  assert.throws(() => validatePreviewGlobalAdminProvisioningRequestV1(request({ firebaseUid: "" })), { code: "UID_REQUIRED" });
});

test("5. multiline UID rejected", () => {
  assert.throws(() => validatePreviewGlobalAdminProvisioningRequestV1(request({ firebaseUid: "line-one\nline-two" })), { code: "UID_MULTILINE_FORBIDDEN" });
});

test("6. oversized UID rejected", () => {
  assert.throws(() => validatePreviewGlobalAdminProvisioningRequestV1(request({ firebaseUid: "x".repeat(129) })), { code: "UID_TOO_LONG" });
});

test("7. invalid role rejected", () => {
  assert.throws(() => validatePreviewGlobalAdminProvisioningRequestV1(request({ role: "READ_ONLY" })), { code: "ROLE_NOT_ALLOWED" });
});

test("8. unexpected request field rejected", () => {
  assert.throws(() => validatePreviewGlobalAdminProvisioningRequestV1(request({ extra: true })), { code: "UNEXPECTED_REQUEST_FIELD" });
});

test("9. missing document creates the exact contract and sanitized audit", async () => {
  const { fake, execution } = input();
  const result = await executePreviewGlobalAdminProvisioningV1(execution);
  assert.equal(result.action, "CREATED");
  assert.deepEqual(fake.state.adminWrites[0].document, { isActive: true, role: "VIEWER" });
  assert.equal(fake.state.auditWrites.length, 1);
  assert.equal(fake.state.auditWrites[0].record.beforeExists, false);
  assert.equal(fake.state.auditWrites[0].record.afterValid, true);
  assert.doesNotMatch(JSON.stringify(fake.state.auditWrites[0]), new RegExp(FIREBASE_UID, "u"));
});

test("10. identical replay is REUSED with zero writes", async () => {
  const { fake, execution } = input({ existingDocument: { isActive: true, role: "VIEWER" } });
  const result = await executePreviewGlobalAdminProvisioningV1(execution);
  assert.equal(result.action, "REUSED");
  assert.equal(result.writes, 0);
  assert.equal(fake.state.adminWrites.length + fake.state.auditWrites.length, 0);
});

test("11. conflicting existing document fails closed", async () => {
  const { fake, execution } = input({ existingDocument: { isActive: true, role: "SUPPORT" } });
  await expectCode(executePreviewGlobalAdminProvisioningV1(execution), "EXISTING_DOCUMENT_CONFLICT");
  assert.equal(fake.state.adminWrites.length + fake.state.auditWrites.length, 0);
});

test("12. dry-run validates create state with zero writes", async () => {
  const { fake, execution } = input({ dryRun: true });
  const result = await executePreviewGlobalAdminProvisioningV1(execution);
  assert.equal(result.mode, "DRY_RUN");
  assert.equal(result.action, "CREATED");
  assert.equal(result.writes, 0);
  assert.equal(fake.state.adminWrites.length + fake.state.auditWrites.length, 0);
});

test("13. no email is persisted", async () => {
  const { fake, execution } = input();
  await executePreviewGlobalAdminProvisioningV1(execution);
  assert.equal(Object.hasOwn(fake.state.adminWrites[0].document, "email"), false);
  assert.equal(Object.hasOwn(fake.state.auditWrites[0].record, "email"), false);
});

test("14. no tenant is persisted", async () => {
  const { fake, execution } = input();
  await executePreviewGlobalAdminProvisioningV1(execution);
  assert.equal(Object.hasOwn(fake.state.adminWrites[0].document, "tenantId"), false);
  assert.equal(Object.hasOwn(fake.state.auditWrites[0].record, "tenantId"), false);
});

test("15. no custom claims operation or field exists", async () => {
  const source = fs.readFileSync(path.resolve("scripts/preview-global-admin-provisioning.cjs"), "utf8");
  assert.doesNotMatch(source, /setCustomUserClaims|customAttributes/u);
  const { fake, execution } = input();
  await executePreviewGlobalAdminProvisioningV1(execution);
  assert.equal(Object.hasOwn(fake.state.adminWrites[0].document, "claims"), false);
});

test("16. wildcard role rejected", () => {
  assert.throws(() => validatePreviewGlobalAdminProvisioningRequestV1(request({ role: "*" })), { code: "ROLE_NOT_ALLOWED" });
});

test("17. only the canonical platform_global_admins UID path is touched", async () => {
  const { fake, execution } = input();
  await executePreviewGlobalAdminProvisioningV1(execution);
  assert.deepEqual(fake.state.adminWrites.map((write) => write.path), [
    `${GLOBAL_ADMIN_COLLECTION}/${FIREBASE_UID}`,
  ]);
});

test("18. non-canonical target collection rejected", async () => {
  const { execution } = input({ target: { ...TARGET, collection: "other_collection" } });
  await expectCode(executePreviewGlobalAdminProvisioningV1(execution), "COLLECTION_NOT_GLOBAL_ADMINS");
});

test("19. provisioning rejects isActive other than true", () => {
  assert.throws(() => validatePreviewGlobalAdminProvisioningRequestV1(request({ isActive: false })), { code: "ACTIVE_STATE_REQUIRED" });
});

test("20. apply requires the exact explicit change confirmation", () => {
  const base = [
    "--apply",
    "--project=aura-intel-preview",
    "--environment=PREVIEW",
    "--role=VIEWER",
    "--is-active=true",
    "--uid-file=external-locator.txt",
  ];
  assert.throws(() => parseArguments(base), { code: "APPLY_CONFIRMATION_REQUIRED" });
  const parsed = parseArguments([...base, `--confirm-change-id=${APPLY_CHANGE_ID}`]);
  assert.equal(parsed.apply, true);
  assert.equal(parsed.dryRun, false);
});
