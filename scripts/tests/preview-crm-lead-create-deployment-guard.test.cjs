"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  DEPLOY_TARGET,
  FUNCTION_NAME,
  SERVICE_ACCOUNT,
  validatePreviewCrmLeadDeployment,
} = require("../preview-crm-lead-create-deployment-guard.cjs");

test("1 source readiness accepts only Preview", () => {
  const result = validatePreviewCrmLeadDeployment({
    projectId: "aura-intel-preview",
    environment: "PREVIEW",
    requireBuilt: false,
  });
  assert.equal(result.status, "PASS");
  assert.equal(result.functionName, "createCrmLead");
});
test("2 Production rejected", () => {
  assert.throws(() => validatePreviewCrmLeadDeployment({
    projectId: "aura-control-center-debb3", environment: "PREVIEW", requireBuilt: false,
  }), /CRM_DEPLOY_PROJECT_MISMATCH/u);
});
test("3 Staging rejected", () => {
  assert.throws(() => validatePreviewCrmLeadDeployment({
    projectId: "aura-intel-preview", environment: "STAGING", requireBuilt: false,
  }), /CRM_DEPLOY_ENVIRONMENT_MISMATCH/u);
});
test("4 target is one exact function in one codebase", () => {
  assert.equal(DEPLOY_TARGET, "functions:preview-discovery:createCrmLead");
  assert.equal(FUNCTION_NAME, "createCrmLead");
});
test("5 service account is isolated to Preview", () => {
  assert.equal(
    SERVICE_ACCOUNT,
    "preview-crm-lead-runtime@aura-intel-preview.iam.gserviceaccount.com",
  );
  assert.doesNotMatch(SERVICE_ACCOUNT, /production|staging|debb3/u);
});
