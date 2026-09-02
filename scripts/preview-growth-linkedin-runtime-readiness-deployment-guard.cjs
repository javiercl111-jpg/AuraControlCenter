"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const FUNCTIONS_ROOT = path.join(ROOT, "functions");
const PROJECT = "aura-intel-preview";
const ENVIRONMENT = "PREVIEW";
const CODEBASE = "preview-discovery";
const FUNCTION_NAME = "growthLinkedInRuntimeReadinessV1";
const DEPLOY_TARGET = `functions:${CODEBASE}:${FUNCTION_NAME}`;
const SERVICE_ACCOUNT =
  "preview-growth-linkedin-rt@aura-intel-preview.iam.gserviceaccount.com";
const SECRET_NAME = "GROWTH_LINKEDIN_ACCESS_TOKEN";

const EXPECTED_GUARD_COMMAND =
  "node ../scripts/preview-growth-linkedin-runtime-readiness-deployment-guard.cjs --project aura-intel-preview --environment PREVIEW";

const EXPECTED_DEPLOY_COMMAND =
  "npm run build && npm run guard:preview-growth-linkedin-runtime-readiness && firebase deploy --project aura-intel-preview --only functions:preview-discovery:growthLinkedInRuntimeReadinessV1 --non-interactive";

function fail(code) {
  throw new Error(code);
}

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function json(relativePath) {
  return JSON.parse(read(relativePath));
}

function validatePreviewGrowthLinkedInDeployment(input) {
  if (input.projectId !== PROJECT) {
    fail("LINKEDIN_DEPLOY_PROJECT_MISMATCH");
  }

  if (input.environment !== ENVIRONMENT) {
    fail("LINKEDIN_DEPLOY_ENVIRONMENT_MISMATCH");
  }

  const firebase = json("firebase.json");
  const functionsPackage = json("functions/package.json");

  if (firebase.functions?.codebase !== CODEBASE) {
    fail("LINKEDIN_DEPLOY_CODEBASE_MISMATCH");
  }

  if (functionsPackage.main !== "lib/previewDiscoveryIndex.js") {
    fail("LINKEDIN_DEPLOY_ENTRYPOINT_MISMATCH");
  }

  const guard =
    functionsPackage.scripts?.["guard:preview-growth-linkedin-runtime-readiness"];

  if (guard !== EXPECTED_GUARD_COMMAND) {
    fail("LINKEDIN_DEPLOY_GUARD_COMMAND_NOT_EXACT");
  }

  const deploy =
    functionsPackage.scripts?.["deploy:preview-growth-linkedin-runtime-readiness"];

  if (deploy !== EXPECTED_DEPLOY_COMMAND || deploy.includes("--force")) {
    fail("LINKEDIN_DEPLOY_COMMAND_NOT_EXACT");
  }

  const source = read(
    "functions/src/composition/linkedin/GrowthLinkedInCallableRuntimeV1.ts",
  );

  const previewSource = read(
    "functions/src/composition/linkedin/GrowthLinkedInPreviewCallableRuntimeV1.ts",
  );

  const index = read("functions/src/previewDiscoveryIndex.ts");

  const contract = read(
    "functions/src/discovery/deployment/previewDiscoveryDeploymentUnitV1.ts",
  );

  const secretSource = read(
    "functions/src/infrastructure/linkedin/credentials/GrowthLinkedInFirebaseSecretSourceV1.ts",
  );

  if (!previewSource.includes("assertPreviewDiscoveryRuntimeV1") ||
      !previewSource.includes("PREVIEW_DISCOVERY_CALLABLE_OPTIONS_V1") ||
      !previewSource.includes("GROWTH_SOCIAL_CAPABILITY_PREVIEW_ENVIRONMENT_V1") ||
      !previewSource.includes("createGrowthLinkedInRuntimeReadinessV1") ||
      !source.includes("resolveDiscoveryPrincipalV1") ||
      !source.includes("growthLinkedInAccessTokenSecretV1") ||
      !source.includes("secrets:") ||
      !source.includes("enforceAppCheck") ||
      !source.includes("GROWTH_SOCIAL_MANAGE_CAPABILITY_V1") ||
      !source.includes("hasGrowthSocialCapabilityV1")) {
    fail("LINKEDIN_DEPLOY_HANDLER_GUARDS_MISSING");
  }

  if (source.includes(".acquire(") ||
      source.includes(".value()") ||
      source.includes("fetch(") ||
      source.includes("api.linkedin.com")) {
    fail("LINKEDIN_DEPLOY_NETWORK_OR_SECRET_READ_FORBIDDEN");
  }

  if (!source.includes("DECLARED_NOT_READ") ||
      !source.includes("NOT_EXECUTED")) {
    fail("LINKEDIN_DEPLOY_READINESS_CONTRACT_MISSING");
  }

  if (!index.includes(
    "export const growthLinkedInRuntimeReadinessV1 = growthLinkedInRuntimeReadinessV1Handler",
  )) {
    fail("LINKEDIN_DEPLOY_EXPORT_MISSING");
  }

  if (!contract.includes(
        `growthLinkedInRuntimeReadinessV1: serviceAccount("preview-growth-linkedin-rt")`,
      ) ||
      !contract.includes(
        `"growthLinkedInRuntimeReadinessV1"`,
      ) ||
      !contract.includes(
        `secretParamName: "${SECRET_NAME}"`,
      ) ||
      !contract.includes(
        `secretResource: "${SECRET_NAME}"`,
      )) {
    fail("LINKEDIN_DEPLOY_RUNTIME_CONTRACT_MISSING");
  }

  if (!secretSource.includes(`'${SECRET_NAME}'`)) {
    fail("LINKEDIN_DEPLOY_SECRET_AUTHORITY_MISSING");
  }

  if (/aura-control-center-debb3|aura-intel-staging/u.test(source)) {
    fail("LINKEDIN_DEPLOY_FORBIDDEN_TARGET_REFERENCE");
  }

  if (input.requireBuilt === true) {
    const contractPath = path.join(
      FUNCTIONS_ROOT,
      "lib/discovery/deployment/previewDiscoveryDeploymentUnitV1.js",
    );

    const entrypointPath = path.join(
      FUNCTIONS_ROOT,
      "lib/previewDiscoveryIndex.js",
    );

    if (!fs.existsSync(contractPath) || !fs.existsSync(entrypointPath)) {
      fail("LINKEDIN_DEPLOY_BUILD_REQUIRED");
    }

    delete require.cache[require.resolve(contractPath)];
    delete require.cache[require.resolve(entrypointPath)];

    const runtimeContract = require(contractPath);
    const entrypoint = require(entrypointPath);

    const endpoint =
      entrypoint.growthLinkedInRuntimeReadinessV1?.__endpoint;

    if (!endpoint) {
      fail("LINKEDIN_DEPLOY_ENDPOINT_METADATA_MISSING");
    }

    const region =
      Array.isArray(endpoint.region)
        ? endpoint.region[0]
        : endpoint.region;

    if (
      region !== "us-central1" ||
      endpoint.serviceAccountEmail !== SERVICE_ACCOUNT ||
      runtimeContract
        .PREVIEW_DISCOVERY_CALLABLE_OPTIONS_V1
        .growthLinkedInRuntimeReadinessV1
        .enforceAppCheck !== true
    ) {
      fail("LINKEDIN_DEPLOY_ENDPOINT_METADATA_MISMATCH");
    }
  }

  return Object.freeze({
    status: "PASS",
    projectId: PROJECT,
    environment: ENVIRONMENT,
    codebase: CODEBASE,
    functionName: FUNCTION_NAME,
    deployTarget: DEPLOY_TARGET,
    serviceAccount: SERVICE_ACCOUNT,
    secretName: SECRET_NAME,
    deploymentExecuted: false,
  });
}

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

if (require.main === module) {
  try {
    const result = validatePreviewGrowthLinkedInDeployment({
      projectId: argument("--project"),
      environment: argument("--environment"),
      requireBuilt: !process.argv.includes("--source-only"),
    });

    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(`${JSON.stringify({
      status: "FAILED",
      safeErrorCode:
        error instanceof Error
          ? error.message
          : "UNKNOWN_FAILURE",
    })}\n`);

    process.exitCode = 1;
  }
}

module.exports = {
  CODEBASE,
  DEPLOY_TARGET,
  ENVIRONMENT,
  FUNCTION_NAME,
  PROJECT,
  SECRET_NAME,
  SERVICE_ACCOUNT,
  validatePreviewGrowthLinkedInDeployment,
};