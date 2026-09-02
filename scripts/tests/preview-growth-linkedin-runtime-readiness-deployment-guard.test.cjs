"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../..");
const GUARD_PATH = path.join(
  ROOT,
  "scripts",
  "preview-growth-linkedin-runtime-readiness-deployment-guard.cjs",
);

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function json(relativePath) {
  return JSON.parse(read(relativePath));
}

function loadGuard() {
  assert.equal(
    fs.existsSync(GUARD_PATH),
    true,
    "LINKEDIN_DEPLOY_GUARD_MISSING",
  );
  delete require.cache[require.resolve(GUARD_PATH)];
  return require(GUARD_PATH);
}

test("1 source readiness accepts only Preview", () => {
  const { validatePreviewGrowthLinkedInDeployment } = loadGuard();
  const result = validatePreviewGrowthLinkedInDeployment({
    projectId: "aura-intel-preview",
    environment: "PREVIEW",
    requireBuilt: false,
  });
  assert.equal(result.status, "PASS");
  assert.equal(result.functionName, "growthLinkedInRuntimeReadinessV1");
  assert.equal(result.deploymentExecuted, false);
});

test("2 Production project is rejected", () => {
  const { validatePreviewGrowthLinkedInDeployment } = loadGuard();
  assert.throws(() => validatePreviewGrowthLinkedInDeployment({
    projectId: "aura-control-center-debb3",
    environment: "PREVIEW",
    requireBuilt: false,
  }), /LINKEDIN_DEPLOY_PROJECT_MISMATCH/u);
});

test("3 Staging environment is rejected", () => {
  const { validatePreviewGrowthLinkedInDeployment } = loadGuard();
  assert.throws(() => validatePreviewGrowthLinkedInDeployment({
    projectId: "aura-intel-preview",
    environment: "STAGING",
    requireBuilt: false,
  }), /LINKEDIN_DEPLOY_ENVIRONMENT_MISMATCH/u);
});

test("4 target, runtime and secret are exact", () => {
  const {
    DEPLOY_TARGET,
    FUNCTION_NAME,
    SECRET_NAME,
    SERVICE_ACCOUNT,
  } = loadGuard();

  assert.equal(
    DEPLOY_TARGET,
    "functions:preview-discovery:growthLinkedInRuntimeReadinessV1",
  );
  assert.equal(
    FUNCTION_NAME,
    "growthLinkedInRuntimeReadinessV1",
  );
  assert.equal(
    SERVICE_ACCOUNT,
    "preview-growth-linkedin-rt@aura-intel-preview.iam.gserviceaccount.com",
  );
  assert.equal(
    SECRET_NAME,
    "GROWTH_LINKEDIN_ACCESS_TOKEN",
  );
  assert.doesNotMatch(
    SERVICE_ACCOUNT,
    /production|staging|debb3/u,
  );
});

test("5 functions package exposes guarded exact selective deploy", () => {
  const pkg = json("functions/package.json");

  assert.equal(
    pkg.scripts?.["guard:preview-growth-linkedin-runtime-readiness"],
    "node ../scripts/preview-growth-linkedin-runtime-readiness-deployment-guard.cjs --project aura-intel-preview --environment PREVIEW",
  );

  assert.equal(
    pkg.scripts?.["deploy:preview-growth-linkedin-runtime-readiness"],
    "npm run build && npm run guard:preview-growth-linkedin-runtime-readiness && firebase deploy --project aura-intel-preview --only functions:preview-discovery:growthLinkedInRuntimeReadinessV1 --non-interactive",
  );

  assert.doesNotMatch(
    pkg.scripts?.["deploy:preview-growth-linkedin-runtime-readiness"] ?? "",
    /--force/u,
  );
});

test("6 root package exposes the guard test", () => {
  const pkg = json("package.json");
  assert.equal(
    pkg.scripts?.["test:preview-growth-linkedin-runtime-readiness-deployment-guard"],
    "node --test scripts/tests/preview-growth-linkedin-runtime-readiness-deployment-guard.test.cjs",
  );
});

test("7 guard enforces LinkedIn safety boundaries", () => {
  loadGuard();
  const guardSource = read(
    "scripts/preview-growth-linkedin-runtime-readiness-deployment-guard.cjs",
  );

  assert.match(
    guardSource,
    /assertPreviewDiscoveryRuntimeV1\(\);/u,
  );
  assert.match(
    guardSource,
    /PREVIEW_DISCOVERY_CALLABLE_OPTIONS_V1\.growthLinkedInRuntimeReadinessV1/u,
  );
  assert.match(
    guardSource,
    /resolveDiscoveryPrincipalV1/u,
  );
  assert.match(
    guardSource,
    /GROWTH_LINKEDIN_ACCESS_TOKEN/u,
  );
});