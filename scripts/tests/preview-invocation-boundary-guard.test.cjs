"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  REQUIRED_CHANGE_ID,
  REQUIRED_PROJECT,
  REQUIRED_REGION,
  REQUIRED_SERVICES,
  assertPreviewInvocationBoundaryManifestV1,
} = require("../preview-invocation-boundary-guard.cjs");

function validCandidate() {
  return {
    changeId: REQUIRED_CHANGE_ID,
    projectId: REQUIRED_PROJECT,
    environment: "PREVIEW",
    region: REQUIRED_REGION,
    binding: {
      scope: "CLOUD_RUN_SERVICE",
      role: "roles/run.invoker",
      member: "allUsers",
      projectLevel: false,
    },
    services: REQUIRED_SERVICES.map((service) => ({ ...service })),
    preservation: {
      runtimeServiceAccountsUnchanged: true,
      appCheckEnforcementMutation: false,
      secretMutation: false,
      functionRevisionMutation: false,
      stagingMutation: false,
      productionMutation: false,
    },
  };
}

function denied(mutator, code) {
  const candidate = validCandidate();
  mutator(candidate);
  assert.throws(
    () => assertPreviewInvocationBoundaryManifestV1(candidate),
    new RegExp(`INVOCATION_BOUNDARY_GUARD_DENIED:${code}`),
  );
}

test("authorizes only five service-scoped Preview invoker bindings", () => {
  const result = assertPreviewInvocationBoundaryManifestV1(validCandidate());
  assert.equal(result.authorization, "PREVIEW_SERVICE_SCOPED_INVOKER_BINDINGS_ONLY");
  assert.equal(result.services.length, 5);
});

test("rejects wrong project", () => denied((value) => { value.projectId = "aura-intel-staging"; }, "PROJECT"));
test("rejects wrong region", () => denied((value) => { value.region = "europe-west1"; }, "REGION"));
test("rejects extra service", () => denied((value) => { value.services.push({ ...value.services[0], functionName: "extra", serviceName: "extra" }); }, "EXTRA_SERVICE"));
test("rejects a missing service", () => denied((value) => { value.services.pop(); }, "MISSING_SERVICE"));
test("rejects wrong role", () => denied((value) => { value.binding.role = "roles/run.admin"; }, "ROLE"));
test("rejects wrong member", () => denied((value) => { value.binding.member = "allAuthenticatedUsers"; }, "MEMBER"));
test("rejects project-level scope", () => denied((value) => { value.binding.scope = "PROJECT"; }, "SCOPE"));
test("rejects a Production identity", () => denied((value) => { value.services[0].runtimeServiceAccount = "runtime@aura-control-center-debb3.iam.gserviceaccount.com"; }, "PRODUCTION_IDENTITY"));
test("rejects App Check mutation", () => denied((value) => { value.preservation.appCheckEnforcementMutation = true; }, "APP_CHECK_MUTATION"));
test("rejects runtime identity mismatch", () => denied((value) => { value.services[0].runtimeServiceAccount = value.services[1].runtimeServiceAccount; }, "RUNTIME_SERVICE_ACCOUNT"));
test("rejects secret mutation", () => denied((value) => { value.preservation.secretMutation = true; }, "SECRET_MUTATION"));
test("rejects Staging or Production mutation", () => denied((value) => { value.preservation.productionMutation = true; }, "NON_PREVIEW_MUTATION"));
