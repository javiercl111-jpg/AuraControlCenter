"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const FUNCTIONS_ROOT = path.join(ROOT, "functions");
const PROJECT = "aura-intel-preview";
const ENVIRONMENT = "PREVIEW";
const CODEBASE = "preview-discovery";
const FUNCTION_NAME = "createCrmLead";
const DEPLOY_TARGET = `functions:${CODEBASE}:${FUNCTION_NAME}`;
const SERVICE_ACCOUNT =
  "preview-crm-lead-runtime@aura-intel-preview.iam.gserviceaccount.com";

function fail(code) { throw new Error(code); }
function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}
function json(relativePath) { return JSON.parse(read(relativePath)); }

function validatePreviewCrmLeadDeployment(input) {
  if (input.projectId !== PROJECT) fail("CRM_DEPLOY_PROJECT_MISMATCH");
  if (input.environment !== ENVIRONMENT) fail("CRM_DEPLOY_ENVIRONMENT_MISMATCH");
  const firebase = json("firebase.json");
  const functionsPackage = json("functions/package.json");
  if (firebase.functions?.codebase !== CODEBASE) fail("CRM_DEPLOY_CODEBASE_MISMATCH");
  if (functionsPackage.main !== "lib/previewDiscoveryIndex.js") {
    fail("CRM_DEPLOY_ENTRYPOINT_MISMATCH");
  }
  const deploy = functionsPackage.scripts?.["deploy:preview-crm-lead-create"];
  if (typeof deploy !== "string" ||
      !deploy.includes("--project aura-intel-preview") ||
      !deploy.includes(`--only ${DEPLOY_TARGET}`) ||
      !deploy.includes("--non-interactive") || deploy.includes("--force")) {
    fail("CRM_DEPLOY_COMMAND_NOT_EXACT");
  }
  const source = read("functions/src/crm/createCrmLead.ts");
  const index = read("functions/src/previewDiscoveryIndex.ts");
  const contract = read(
    "functions/src/discovery/deployment/previewDiscoveryDeploymentUnitV1.ts",
  );
  if (!source.includes("assertPreviewDiscoveryRuntimeV1();") ||
      !source.includes("PREVIEW_DISCOVERY_CALLABLE_OPTIONS_V1.createCrmLead")) {
    fail("CRM_DEPLOY_HANDLER_GUARDS_MISSING");
  }
  if (!index.includes("export const createCrmLead = createCrmLeadHandler")) {
    fail("CRM_DEPLOY_EXPORT_MISSING");
  }
  if (!contract.includes(`createCrmLead: serviceAccount("preview-crm-lead-runtime")`) ||
      !contract.includes('"createCrmLead"')) {
    fail("CRM_DEPLOY_RUNTIME_CONTRACT_MISSING");
  }
  if (/aura-control-center-debb3|aura-intel-staging/u.test(source)) {
    fail("CRM_DEPLOY_FORBIDDEN_TARGET_REFERENCE");
  }

  if (input.requireBuilt === true) {
    const contractPath = path.join(
      FUNCTIONS_ROOT,
      "lib/discovery/deployment/previewDiscoveryDeploymentUnitV1.js",
    );
    const entrypointPath = path.join(FUNCTIONS_ROOT, "lib/previewDiscoveryIndex.js");
    if (!fs.existsSync(contractPath) || !fs.existsSync(entrypointPath)) {
      fail("CRM_DEPLOY_BUILD_REQUIRED");
    }
    delete require.cache[require.resolve(contractPath)];
    delete require.cache[require.resolve(entrypointPath)];
    const runtimeContract = require(contractPath);
    const entrypoint = require(entrypointPath);
    const endpoint = entrypoint.createCrmLead?.__endpoint;
    if (!endpoint) fail("CRM_DEPLOY_ENDPOINT_METADATA_MISSING");
    const region = Array.isArray(endpoint.region) ? endpoint.region[0] : endpoint.region;
    if (region !== "us-central1" || endpoint.serviceAccountEmail !== SERVICE_ACCOUNT ||
        runtimeContract.PREVIEW_DISCOVERY_CALLABLE_OPTIONS_V1.createCrmLead
          .enforceAppCheck !== true) {
      fail("CRM_DEPLOY_ENDPOINT_METADATA_MISMATCH");
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
    deploymentExecuted: false,
  });
}

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

if (require.main === module) {
  try {
    const result = validatePreviewCrmLeadDeployment({
      projectId: argument("--project"),
      environment: argument("--environment"),
      requireBuilt: !process.argv.includes("--source-only"),
    });
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(`${JSON.stringify({
      status: "FAILED",
      safeErrorCode: error instanceof Error ? error.message : "UNKNOWN_FAILURE",
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
  SERVICE_ACCOUNT,
  validatePreviewCrmLeadDeployment,
};
