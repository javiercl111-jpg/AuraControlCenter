"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  APPLY_CHANGE_ID,
  AUDIT_COLLECTION,
  GRANT_COLLECTION,
  REQUIRED_CAPABILITY,
  REQUIRED_ROLE,
  executeProvisioning,
  parseArguments,
  validateRequest,
} = require("../preview-crm-lead-capability-provisioning.cjs");

const UID = "synthetic-preview-uid-r8";
const TARGET = Object.freeze({
  projectId: "aura-intel-preview",
  environment: "PREVIEW",
  principalCollection: "platform_global_admins",
  grantCollection: GRANT_COLLECTION,
  auditCollection: AUDIT_COLLECTION,
});
const PRINCIPAL = Object.freeze({ isActive: true, role: "VIEWER" });

function request(overrides = {}) {
  return {
    targetEnvironment: "PREVIEW",
    firebaseUid: UID,
    expectedRole: REQUIRED_ROLE,
    capability: REQUIRED_CAPABILITY,
    ...overrides,
  };
}

function fakeRepository({ principal = PRINCIPAL, grant = null } = {}) {
  const state = { principal, grant, grantWrites: [], auditWrites: [] };
  return {
    state,
    repository: {
      async runTransaction(operation) {
        return operation({
          async getPrincipal(uid) { assert.equal(uid, UID); return state.principal; },
          async getGrant(uid) { assert.equal(uid, UID); return state.grant; },
          async createGrant(uid, document) {
            state.grantWrites.push({ uid, document });
            state.grant = document;
          },
          async createAudit(id, record) { state.auditWrites.push({ id, record }); },
        });
      },
    },
  };
}

function execution(options = {}) {
  const fake = fakeRepository(options);
  return {
    fake,
    input: {
      request: options.request || request(),
      target: options.target || TARGET,
      dryRun: options.dryRun ?? true,
      repository: fake.repository,
      clock: { now: () => "2026-08-08T12:00:00.000Z" },
    },
  };
}

async function rejectsCode(promise, code) {
  await assert.rejects(promise, (error) => error?.code === code);
}

test("1 Preview exact request accepted", () => {
  assert.equal(validateRequest(request()).capability, REQUIRED_CAPABILITY);
});
test("2 Production project rejected", async () => {
  const { input } = execution({ target: { ...TARGET, projectId: "production" } });
  await rejectsCode(executeProvisioning(input), "PROJECT_NOT_PREVIEW");
});
test("3 Staging rejected", async () => {
  const { input } = execution({ request: request({ targetEnvironment: "STAGING" }) });
  await rejectsCode(executeProvisioning(input), "ENVIRONMENT_NOT_PREVIEW");
});
test("4 missing UID rejected", () => {
  assert.throws(() => validateRequest(request({ firebaseUid: "" })), { code: "UID_REQUIRED" });
});
test("5 multiline UID rejected", () => {
  assert.throws(() => validateRequest(request({ firebaseUid: "a\nb" })), { code: "UID_MULTILINE_FORBIDDEN" });
});
test("6 oversized UID rejected", () => {
  assert.throws(() => validateRequest(request({ firebaseUid: "x".repeat(129) })), { code: "UID_TOO_LONG" });
});
test("7 role escalation rejected", () => {
  assert.throws(() => validateRequest(request({ expectedRole: "ADMIN" })), { code: "VIEWER_ROLE_REQUIRED" });
});
test("8 broad crm.write rejected", () => {
  assert.throws(() => validateRequest(request({ capability: "crm.write" })), { code: "EXACT_CAPABILITY_REQUIRED" });
});
test("9 wildcard rejected", () => {
  assert.throws(() => validateRequest(request({ capability: "*" })), { code: "EXACT_CAPABILITY_REQUIRED" });
});
test("10 unexpected fields rejected", () => {
  assert.throws(() => validateRequest(request({ email: "forbidden" })), { code: "UNEXPECTED_REQUEST_FIELD" });
});
test("11 missing principal rejected", async () => {
  const { input } = execution({ principal: null });
  await rejectsCode(executeProvisioning(input), "PRINCIPAL_NOT_FOUND");
});
test("12 inactive principal rejected", async () => {
  const { input } = execution({ principal: { isActive: false, role: "VIEWER" } });
  await rejectsCode(executeProvisioning(input), "PRINCIPAL_CONTRACT_INVALID");
});
test("13 non-VIEWER principal rejected", async () => {
  const { input } = execution({ principal: { isActive: true, role: "ADMIN" } });
  await rejectsCode(executeProvisioning(input), "PRINCIPAL_CONTRACT_INVALID");
});
test("14 real dry-run plan is WOULD_CREATE with zero writes", async () => {
  const { input, fake } = execution();
  const result = await executeProvisioning(input);
  assert.equal(result.action, "WOULD_CREATE");
  assert.equal(result.writes, 0);
  assert.equal(result.roleBefore, "VIEWER");
  assert.equal(result.roleAfter, "VIEWER");
  assert.equal(result.capabilityBefore, "ABSENT");
  assert.equal(result.capabilityAfter, "crm.leads.create");
  assert.equal(result.additionalCapabilities, 0);
  assert.equal(fake.state.grantWrites.length + fake.state.auditWrites.length, 0);
});
test("15 apply plan creates exact grant and one audit", async () => {
  const { input, fake } = execution({ dryRun: false });
  const result = await executeProvisioning(input);
  assert.equal(result.action, "CREATED");
  assert.equal(result.writes, 2);
  assert.deepEqual(fake.state.grantWrites[0].document, {
    schemaVersion: "PlatformGlobalAdminCapabilityGrantV1",
    environment: "PREVIEW",
    isActive: true,
    capabilities: ["crm.leads.create"],
  });
  assert.equal(fake.state.auditWrites.length, 1);
});
test("16 identical replay is REUSED with zero writes", async () => {
  const grant = {
    schemaVersion: "PlatformGlobalAdminCapabilityGrantV1",
    environment: "PREVIEW",
    isActive: true,
    capabilities: ["crm.leads.create"],
  };
  const { input, fake } = execution({ grant, dryRun: false });
  const result = await executeProvisioning(input);
  assert.equal(result.action, "REUSED");
  assert.equal(result.writes, 0);
  assert.equal(fake.state.grantWrites.length + fake.state.auditWrites.length, 0);
});
test("17 conflicting grant fails closed", async () => {
  const { input } = execution({ grant: { capabilities: ["crm.write"] } });
  await rejectsCode(executeProvisioning(input), "EXISTING_GRANT_CONFLICT");
});
test("18 source has no email, claims, or role mutation path", () => {
  const source = fs.readFileSync(path.resolve("scripts/preview-crm-lead-capability-provisioning.cjs"), "utf8");
  assert.doesNotMatch(source, /setCustomUserClaims|updateUser|createUser|normalizedEmail/u);
  assert.doesNotMatch(source, /updatePrincipal|createPrincipal/u);
});
test("19 only grant and audit writes are exposed", async () => {
  const { input, fake } = execution({ dryRun: false });
  await executeProvisioning(input);
  assert.equal(fake.state.grantWrites.length, 1);
  assert.equal(fake.state.auditWrites.length, 1);
});
test("20 apply requires exact change authorization", () => {
  const base = [
    "--apply", "--project=aura-intel-preview", "--environment=PREVIEW",
    "--capability=crm.leads.create", "--expected-role=VIEWER", "--uid-file=locator.txt",
  ];
  assert.throws(() => parseArguments(base), { code: "APPLY_CONFIRMATION_REQUIRED" });
  assert.equal(parseArguments([...base, `--confirm-change-id=${APPLY_CHANGE_ID}`]).apply, true);
});
test("21 dry-run mode parses without apply authorization", () => {
  const parsed = parseArguments([
    "--dry-run", "--project=aura-intel-preview", "--environment=PREVIEW",
    "--capability=crm.leads.create", "--expected-role=VIEWER", "--uid-file=locator.txt",
  ]);
  assert.equal(parsed.dryRun, true);
});
test("22 audit and result never contain the full UID", async () => {
  const { input, fake } = execution({ dryRun: false });
  const result = await executeProvisioning(input);
  assert.doesNotMatch(JSON.stringify({ result, audit: fake.state.auditWrites }), new RegExp(UID, "u"));
});
