"use strict";

const { readFileSync } = require("node:fs");
const { join, resolve } = require("node:path");
const { spawnSync } = require("node:child_process");

const REPOSITORY_ROOT = resolve(__dirname, "..");
const MANIFEST_PATH = join(
  REPOSITORY_ROOT,
  "scripts/manifests/preview-invocation-boundary-v1.json",
);
const DEPLOYMENT_UNIT_PATH = join(
  REPOSITORY_ROOT,
  "functions/src/discovery/deployment/previewDiscoveryDeploymentUnitV1.ts",
);

const REQUIRED_BRANCH = "fix/intelligence-preview-invocation-boundary";
const REQUIRED_PROJECT = "aura-intel-preview";
const REQUIRED_ENVIRONMENT = "PREVIEW";
const REQUIRED_REGION = "us-central1";
const REQUIRED_CHANGE_ID =
  "AI-02H1E.8-PREVIEW-INVOCATION-BOUNDARY-20260805-01";

const REQUIRED_SERVICES = Object.freeze([
  Object.freeze({
    functionName: "createDiscoveryLead",
    serviceName: "creatediscoverylead",
    runtimeServiceAccount:
      "preview-public-intake-runtime@aura-intel-preview.iam.gserviceaccount.com",
  }),
  Object.freeze({
    functionName: "exchangeDiscoveryToken",
    serviceName: "exchangediscoverytoken",
    runtimeServiceAccount:
      "preview-discovery-session-rt@aura-intel-preview.iam.gserviceaccount.com",
  }),
  Object.freeze({
    functionName: "resolveDiscoverySession",
    serviceName: "resolvediscoverysession",
    runtimeServiceAccount:
      "preview-discovery-session-rt@aura-intel-preview.iam.gserviceaccount.com",
  }),
  Object.freeze({
    functionName: "evaluateConversation",
    serviceName: "evaluateconversation",
    runtimeServiceAccount:
      "preview-conversation-runtime@aura-intel-preview.iam.gserviceaccount.com",
  }),
  Object.freeze({
    functionName: "completeDiscoverySession",
    serviceName: "completediscoverysession",
    runtimeServiceAccount:
      "preview-discovery-complete-rt@aura-intel-preview.iam.gserviceaccount.com",
  }),
]);

const ALLOWED_DIRTY_FILES = new Set([
  "package.json",
  "scripts/manifests/preview-invocation-boundary-v1.json",
  "scripts/preview-invocation-boundary-guard.cjs",
  "scripts/tests/preview-invocation-boundary-guard.test.cjs",
]);
const ALLOWED_DIRTY_PREFIX =
  "docs/security/discovery/post-deployment/invocation-boundary/";

function denied(code) {
  throw new Error(`INVOCATION_BOUNDARY_GUARD_DENIED:${code}`);
}

function equalExactObject(actual, expected) {
  return actual?.functionName === expected.functionName &&
    actual?.serviceName === expected.serviceName &&
    actual?.runtimeServiceAccount === expected.runtimeServiceAccount;
}

function assertPreviewInvocationBoundaryManifestV1(candidate) {
  if (candidate?.changeId !== REQUIRED_CHANGE_ID) denied("CHANGE_ID");
  if (candidate?.projectId !== REQUIRED_PROJECT) denied("PROJECT");
  if (candidate?.environment !== REQUIRED_ENVIRONMENT) denied("ENVIRONMENT");
  if (candidate?.region !== REQUIRED_REGION) denied("REGION");
  if (candidate?.binding?.scope !== "CLOUD_RUN_SERVICE") denied("SCOPE");
  if (candidate?.binding?.role !== "roles/run.invoker") denied("ROLE");
  if (candidate?.binding?.member !== "allUsers") denied("MEMBER");
  if (candidate?.binding?.projectLevel !== false) denied("PROJECT_LEVEL");
  if (!Array.isArray(candidate?.services)) denied("SERVICES");
  if (candidate.services.length !== REQUIRED_SERVICES.length) {
    denied(candidate.services.length > REQUIRED_SERVICES.length
      ? "EXTRA_SERVICE"
      : "MISSING_SERVICE");
  }
  for (const expected of REQUIRED_SERVICES) {
    const actual = candidate.services.find(
      ({ functionName }) => functionName === expected.functionName,
    );
    if (!actual) denied("MISSING_SERVICE");
    if (actual.serviceName !== expected.serviceName) denied("SERVICE_NAME");
    if (actual.runtimeServiceAccount !== expected.runtimeServiceAccount) {
      if (/production|aura-control-center-debb3/iu.test(
        actual.runtimeServiceAccount ?? "",
      )) denied("PRODUCTION_IDENTITY");
      denied("RUNTIME_SERVICE_ACCOUNT");
    }
    if (!equalExactObject(actual, expected)) denied("SERVICE_METADATA");
  }
  const preservation = candidate.preservation ?? {};
  if (preservation.runtimeServiceAccountsUnchanged !== true) {
    denied("RUNTIME_IDENTITY_MUTATION");
  }
  if (preservation.appCheckEnforcementMutation !== false) {
    denied("APP_CHECK_MUTATION");
  }
  if (preservation.secretMutation !== false) denied("SECRET_MUTATION");
  if (preservation.functionRevisionMutation !== false) denied("REVISION_MUTATION");
  if (preservation.stagingMutation !== false ||
      preservation.productionMutation !== false) {
    denied("NON_PREVIEW_MUTATION");
  }
  return Object.freeze({
    authorization: "PREVIEW_SERVICE_SCOPED_INVOKER_BINDINGS_ONLY",
    projectId: candidate.projectId,
    region: candidate.region,
    member: candidate.binding.member,
    role: candidate.binding.role,
    services: candidate.services.map(({ serviceName }) => serviceName),
  });
}

function git(args) {
  const result = spawnSync("git", args, {
    cwd: REPOSITORY_ROOT,
    encoding: "utf8",
    shell: false,
  });
  if (result.status !== 0) denied("GIT_PROBE_FAILED");
  return result.stdout.trimEnd();
}

function assertWorktreeScope() {
  const status = git(["status", "--porcelain=v1", "--untracked-files=all"]);
  for (const line of status.split(/\r?\n/u).filter(Boolean)) {
    if (line[0] !== " " && line[0] !== "?") denied("STAGED_CHANGE");
    let file = line.slice(3).replaceAll("\\", "/");
    if (file.includes(" -> ")) file = file.split(" -> ").at(-1);
    if (!ALLOWED_DIRTY_FILES.has(file) && !file.startsWith(ALLOWED_DIRTY_PREFIX)) {
      denied("OUT_OF_SCOPE_CHANGE");
    }
  }
}

function assertDeploymentUnitPreserved() {
  const source = readFileSync(DEPLOYMENT_UNIT_PATH, "utf8");
  if (!source.includes('PREVIEW_DISCOVERY_PROJECT_ID_V1 = "aura-intel-preview"')) {
    denied("DEPLOYMENT_UNIT_PROJECT_DRIFT");
  }
  if (!source.includes('PREVIEW_DISCOVERY_REGION_V1 = "us-central1"')) {
    denied("DEPLOYMENT_UNIT_REGION_DRIFT");
  }
  if (!source.includes("enforceAppCheck: true") ||
      source.includes("enforceAppCheck: false")) {
    denied("DEPLOYMENT_UNIT_APP_CHECK_DRIFT");
  }
  for (const expected of REQUIRED_SERVICES) {
    const accountName = expected.runtimeServiceAccount.split("@")[0];
    if (!source.includes(`serviceAccount("${accountName}")`)) {
      denied("DEPLOYMENT_UNIT_IDENTITY_DRIFT");
    }
  }
}

function parseArguments(values) {
  const parsed = {};
  for (const value of values) {
    if (!value.startsWith("--") || !value.includes("=")) denied("ARGUMENT");
    const separator = value.indexOf("=");
    parsed[value.slice(2, separator)] = value.slice(separator + 1);
  }
  return parsed;
}

function main() {
  const args = parseArguments(process.argv.slice(2));
  if (args.project !== REQUIRED_PROJECT) denied("CLI_PROJECT");
  if (args.region !== REQUIRED_REGION) denied("CLI_REGION");
  if (git(["branch", "--show-current"]) !== REQUIRED_BRANCH) denied("BRANCH");
  assertWorktreeScope();
  assertDeploymentUnitPreserved();
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
  const result = assertPreviewInvocationBoundaryManifestV1(manifest);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.stdout.write("PREVIEW_INVOCATION_BOUNDARY_GUARD_PASS\n");
}

module.exports = Object.freeze({
  REQUIRED_CHANGE_ID,
  REQUIRED_PROJECT,
  REQUIRED_REGION,
  REQUIRED_SERVICES,
  assertPreviewInvocationBoundaryManifestV1,
});

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error instanceof Error
      ? error.message
      : "INVOCATION_BOUNDARY_GUARD_DENIED:UNKNOWN"}\n`);
    process.exitCode = 1;
  }
}
