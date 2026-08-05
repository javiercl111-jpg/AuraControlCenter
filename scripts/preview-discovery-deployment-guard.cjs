"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {
  assertPreviewParameterConfiguration,
} = require("./preview-discovery-parameter-guard.cjs");

const repositoryRoot = path.resolve(__dirname, "..");
const functionsRoot = path.join(repositoryRoot, "functions");
const exactProject = "aura-intel-preview";
const exactEnvironment = "PREVIEW";
const exactCodebase = "preview-discovery";
const exactDeployTarget = "functions:preview-discovery";

function fail(code) {
  throw new Error(code);
}

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function read(relativePath) {
  return fs.readFileSync(path.join(repositoryRoot, relativePath), "utf8");
}

function json(relativePath) {
  return JSON.parse(read(relativePath));
}

function equalSet(actual, expected) {
  return actual.length === expected.length &&
    [...actual].sort().every((value, index) => value === [...expected].sort()[index]);
}

const projectId = argument("--project");
const environment = argument("--environment");
if (projectId !== exactProject) fail("PREVIEW_GUARD_PROJECT_MISMATCH");
if (environment !== exactEnvironment) fail("PREVIEW_GUARD_ENVIRONMENT_MISMATCH");

const functionsPackage = json("functions/package.json");
const firebase = json("firebase.json");
if (functionsPackage.main !== "lib/previewDiscoveryIndex.js") {
  fail("PREVIEW_GUARD_MAIN_MISMATCH");
}
if (firebase.functions?.codebase !== exactCodebase) {
  fail("PREVIEW_GUARD_CODEBASE_MISMATCH");
}

const projectEnvironmentPath = "functions/.env.aura-intel-preview";
const otherEnvironmentFiles = Object.fromEntries(
  fs.readdirSync(functionsRoot)
    .filter((name) => name.startsWith(".env") && name !== ".env.aura-intel-preview")
    .map((name) => [`functions/${name}`, read(`functions/${name}`)]),
);
const parameterBindings = assertPreviewParameterConfiguration({
  projectEnvPath: projectEnvironmentPath,
  projectEnvContent: read(projectEnvironmentPath),
  otherEnvironmentFiles,
});

const contractPath = path.join(
  functionsRoot,
  "lib/discovery/deployment/previewDiscoveryDeploymentUnitV1.js",
);
const entrypointPath = path.join(functionsRoot, "lib/previewDiscoveryIndex.js");
if (!fs.existsSync(contractPath) || !fs.existsSync(entrypointPath)) {
  fail("PREVIEW_GUARD_BUILD_REQUIRED");
}

delete require.cache[require.resolve(contractPath)];
delete require.cache[require.resolve(entrypointPath)];
const contract = require(contractPath);
const deployment = require(entrypointPath);
const exportsFound = Object.keys(deployment).sort();
const allowlist = [...contract.PREVIEW_DISCOVERY_HANDLER_ALLOWLIST_V1];
if (!equalSet(exportsFound, allowlist)) fail("PREVIEW_GUARD_EXPORT_ALLOWLIST_MISMATCH");

const handlers = {};
for (const handler of allowlist) {
  const endpoint = deployment[handler]?.__endpoint;
  if (!endpoint) fail("PREVIEW_GUARD_ENDPOINT_METADATA_MISSING");
  handlers[handler] = {
    region: Array.isArray(endpoint.region) ? endpoint.region[0] : endpoint.region,
    serviceAccount: endpoint.serviceAccountEmail,
    enforceAppCheck:
      contract.PREVIEW_DISCOVERY_CALLABLE_OPTIONS_V1[handler].enforceAppCheck === true,
    secretBindings: (endpoint.secretEnvironmentVariables || [])
      .map((secret) => ({
        secretParamName: secret.key,
        secretResource: secret.secret ?? secret.key,
      })),
  };
}

const loadedUnitModules = Object.keys(require.cache)
  .filter((modulePath) => modulePath.startsWith(path.join(functionsRoot, "lib")));
if (loadedUnitModules.some((modulePath) =>
  /[\\/](reports|pdf|notifications)[\\/]|processMarketImportJob|generateDiscoveryReport|requestExecutiveDocument/i
    .test(modulePath))) {
  fail("PREVIEW_GUARD_FORBIDDEN_MODULE_LOADED");
}

const deployCommand = functionsPackage.scripts?.["deploy:preview-discovery"];
if (typeof deployCommand !== "string") fail("PREVIEW_GUARD_DEPLOY_COMMAND_MISSING");
if (
  !deployCommand.includes("--project aura-intel-preview") ||
  !deployCommand.includes("--non-interactive")
) {
  fail("PREVIEW_GUARD_DEPLOY_COMMAND_NOT_PINNED");
}
const onlyTargets = [...deployCommand.matchAll(/--only\s+([^\s]+)/g)]
  .map((match) => match[1]);
if (!equalSet(onlyTargets, [exactDeployTarget])) {
  fail("PREVIEW_GUARD_DEPLOY_TARGET_MISMATCH");
}
const buildIndex = deployCommand.indexOf("npm run build");
const guardIndex = deployCommand.indexOf("npm run guard:preview-discovery");
const firebaseIndex = deployCommand.indexOf("firebase deploy");
if (
  buildIndex < 0 || guardIndex <= buildIndex || firebaseIndex <= guardIndex
) {
  fail("PREVIEW_GUARD_DEPLOY_ORDER_MISMATCH");
}

contract.assertPreviewDiscoveryDeploymentCandidateV1({
  projectId,
  environment,
  codebase: firebase.functions.codebase,
  deployTarget: onlyTargets[0],
  exports: exportsFound,
  handlers,
});

const sourceFiles = [
  "functions/src/previewDiscoveryIndex.ts",
  "functions/src/discovery/createDiscoveryLead.ts",
  "functions/src/discovery/exchangeDiscoveryToken.ts",
  "functions/src/discovery/resolveDiscoverySession.ts",
  "functions/src/intelligence/evaluateConversation.ts",
  "functions/src/discovery/completeDiscoverySession.ts",
  "functions/src/discovery/discoveryCapabilityHandlerSupport.ts",
];
const deploymentSource = sourceFiles.map(read).join("\n");
if (/aura-control-center-debb3|firebase-admin\/functions|taskQueue\s*\(|admin\.storage\s*\(|getSignedUrl\s*\(|generateDiscoveryReport|requestExecutiveDocument|emitDiscoveryCompletedNotification/i.test(deploymentSource)) {
  fail("PREVIEW_GUARD_FORBIDDEN_RUNTIME_REFERENCE");
}
if (/export\s+\{\s*(generateDiscoveryReport|requestExecutiveDocument|emitDiscoveryCompletedNotification)/i.test(deploymentSource)) {
  fail("PREVIEW_GUARD_FORBIDDEN_EXPORT_REFERENCE");
}
for (const handler of allowlist) {
  const sourcePath = handler === "evaluateConversation"
    ? "functions/src/intelligence/evaluateConversation.ts"
    : `functions/src/discovery/${handler}.ts`;
  const handlerSource = read(sourcePath);
  if (!handlerSource.includes("assertPreviewDiscoveryRuntimeV1();")) {
    fail(`PREVIEW_GUARD_RUNTIME_ASSERTION_MISSING:${handler}`);
  }
  if (!handlerSource.includes(`PREVIEW_DISCOVERY_CALLABLE_OPTIONS_V1.${handler}`)) {
    fail(`PREVIEW_GUARD_OPTIONS_BINDING_MISSING:${handler}`);
  }
  const declaredSecretParams = [...handlerSource.matchAll(
    /defineSecret\(["']([^"']+)["']\)/g,
  )].map((match) => match[1]);
  const expectedSecretParams = contract.PREVIEW_DISCOVERY_SECRET_BINDINGS_V1[handler]
    .map(({ secretParamName }) => secretParamName);
  if (!equalSet(declaredSecretParams, expectedSecretParams)) {
    fail(`PREVIEW_GUARD_SECRET_PARAM_MISMATCH:${handler}`);
  }
}
if (/\b(?:IDEMPOTENCY_SECRET|GEMINI_API_KEY|DISCOVERY_HMAC_SECRET)\b/.test(deploymentSource)) {
  fail("PREVIEW_GUARD_LOGICAL_SECRET_ALIAS_FORBIDDEN");
}
if (/discovery-ip-hash-salt-preview|defineSecret\(["']IP_HASH_SALT["']\)/i.test(deploymentSource)) {
  fail("PREVIEW_GUARD_IP_SALT_CONSUMER_FORBIDDEN");
}

process.stdout.write(JSON.stringify({
  status: "PASS",
  projectId,
  environment,
  codebase: firebase.functions.codebase,
  exports: exportsFound,
  secretBindings: Object.fromEntries(Object.entries(handlers).map(
    ([handler, metadata]) => [handler, metadata.secretBindings],
  )),
  parameterBindings,
  deploymentExecuted: false,
}) + "\n");
