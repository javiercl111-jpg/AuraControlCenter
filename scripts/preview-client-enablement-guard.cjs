"use strict";

const fs = require("node:fs");
const path = require("node:path");

const REQUIRED_VARIABLES = Object.freeze([
  "VITE_AURA_RUNTIME_ENVIRONMENT",
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
  "VITE_RECAPTCHA_SITE_KEY",
]);
const REQUIRED_TARGETS = Object.freeze(["preview", "production"]);
const EXPECTED_PROJECT = "aura-intel-preview";
const EXPECTED_AUTH_DOMAIN = "aura-intel-preview.firebaseapp.com";
const EXPECTED_VERCEL_PROJECT = "aura-control-center-preview";
const EXPECTED_DOMAIN = "preview-controlcenter.auranexus.io";

const SOURCE_FILES = Object.freeze([
  ".env.example",
  "src/config/firebase.ts",
  "src/config/previewAppCheckContractV1.ts",
  "src/config/previewClientConfigurationV1.ts",
  "src/modules/discovery/services/discoveryLinkService.ts",
  "src/modules/discovery/services/dossierBuilderService.ts",
  "src/modules/intelligence/core/services/AuraLLMGateway.ts",
  "src/pages/dev/ExecutiveIntakeSmokeTestPage.tsx",
]);

function add(errors, code) {
  if (!errors.includes(code)) errors.push(code);
}

function evaluateSourceInventory(sourceTexts) {
  const errors = [];
  const combined = Object.values(sourceTexts).join("\n");
  if (/controlcenter\.auranexus\.io/iu.test(
    combined.replaceAll(EXPECTED_DOMAIN, ""),
  )) add(errors, "PRODUCTION_DOMAIN_REFERENCE");
  if (/intelligence\.auranexus\.io/iu.test(combined)) {
    add(errors, "PRODUCTION_INTELLIGENCE_DOMAIN_REFERENCE");
  }
  if (/aura-control-center-debb3/iu.test(combined)) {
    add(errors, "PRODUCTION_FIREBASE_REFERENCE");
  }
  if (/https?:\/\/[^\s"'`]*\.a\.run\.app/iu.test(combined)) {
    add(errors, "DIRECT_CLOUD_RUN_URL");
  }
  if (/FIREBASE_APPCHECK_DEBUG_TOKEN|APPCHECK_DEBUG_TOKEN/iu.test(combined)) {
    add(errors, "APP_CHECK_DEBUG_REFERENCE");
  }
  if (/VITE_FIREBASE_APPCHECK_RECAPTCHA_ENTERPRISE_SITE_KEY/iu.test(combined)) {
    add(errors, "LEGACY_SITE_KEY_VARIABLE");
  }
  if (/VITE_FIREBASE_STORAGE_BUCKET/iu.test(combined)) {
    add(errors, "UNEXPECTED_FIREBASE_VARIABLE");
  }
  if (/import\.meta\.env\.[A-Z0-9_]+\s*(?:\?\?|\|\|)/u.test(combined)) {
    add(errors, "SILENT_ENVIRONMENT_FALLBACK");
  }

  const contract = sourceTexts["src/config/previewClientConfigurationV1.ts"] || "";
  const firebase = sourceTexts["src/config/firebase.ts"] || "";
  const linkService = sourceTexts[
    "src/modules/discovery/services/discoveryLinkService.ts"
  ] || "";
  const dossier = sourceTexts[
    "src/modules/discovery/services/dossierBuilderService.ts"
  ] || "";
  const gateway = sourceTexts[
    "src/modules/intelligence/core/services/AuraLLMGateway.ts"
  ] || "";
  const developmentSmokePage = sourceTexts[
    "src/pages/dev/ExecutiveIntakeSmokeTestPage.tsx"
  ] || "";
  const template = sourceTexts[".env.example"] || "";

  for (const variable of REQUIRED_VARIABLES) {
    if (!contract.includes(`"${variable}"`) ||
        !new RegExp(`^${variable}=`, "mu").test(template)) {
      add(errors, "SOURCE_REQUIRED_VARIABLE_MISSING");
    }
  }
  if (!contract.includes(EXPECTED_PROJECT) ||
      !contract.includes(EXPECTED_AUTH_DOMAIN) ||
      !contract.includes(EXPECTED_DOMAIN)) {
    add(errors, "SOURCE_PREVIEW_BOUNDARY_MISSING");
  }
  if (!contract.includes('functionsRegion: "us-central1"') ||
      !firebase.includes("getFunctions(")) {
    add(errors, "FUNCTIONS_REGION_NOT_PINNED");
  }
  for (const handler of [
    "createDiscoveryLead",
    "exchangeDiscoveryToken",
    "resolveDiscoverySession",
  ]) {
    if (!linkService.includes(`"${handler}"`)) {
      add(errors, "CALLABLE_ALLOWLIST_INCOMPLETE");
    }
  }
  if (!dossier.includes('"completeDiscoverySession"') ||
      !gateway.includes('"evaluateConversation"')) {
    add(errors, "CALLABLE_ALLOWLIST_INCOMPLETE");
  }
  if (!linkService.includes("httpsCallable(functions, \"createDiscoveryLead\")") ||
      linkService.includes("new URL(response.discoveryUrl)") ||
      !linkService.includes("encodeURIComponent(response.linkId)") ||
      !linkService.includes("encodeURIComponent(response.oneTimeToken)")) {
    add(errors, "CREATE_DISCOVERY_LEAD_NOT_ORIGIN_ISOLATED");
  }
  if (/data\.discoveryUrl|window\.open\(discoveryUrl/iu.test(
    developmentSmokePage,
  ) || !developmentSmokePage.includes("getDiscoveryNavigationTarget(data)")) {
    add(errors, "DEVELOPMENT_SMOKE_NOT_ORIGIN_ISOLATED");
  }
  return errors;
}

function evaluateRemoteContract(input) {
  const errors = [];
  const variables = Array.isArray(input.variables) ? input.variables : [];
  const values = input.values && typeof input.values === "object"
    ? input.values
    : {};

  if (input.vercelProject !== EXPECTED_VERCEL_PROJECT) {
    add(errors, "VERCEL_TARGET_MISMATCH");
  }
  if (input.domain !== EXPECTED_DOMAIN) add(errors, "DOMAIN_MISMATCH");
  if (input.sharedVariables === true ||
      variables.some((entry) => entry.source === "shared")) {
    add(errors, "SHARED_VARIABLE_PRESENT");
  }

  for (const target of REQUIRED_TARGETS) {
    for (const key of REQUIRED_VARIABLES) {
      const matches = variables.filter(
        (entry) => entry.key === key && entry.target === target,
      );
      if (matches.length === 0) add(errors, "REQUIRED_VARIABLE_MISSING");
      if (matches.length > 1) add(errors, "DUPLICATE_VARIABLE");
    }
  }
  if (variables.some((entry) =>
    !REQUIRED_VARIABLES.includes(entry.key) ||
    !REQUIRED_TARGETS.includes(entry.target))) {
    add(errors, "UNEXPECTED_VARIABLE_OR_TARGET");
  }

  for (const key of REQUIRED_VARIABLES) {
    if (typeof values[key] !== "string" || values[key].trim() === "") {
      add(errors, "REQUIRED_VALUE_MISSING");
    }
  }
  if (values.VITE_AURA_RUNTIME_ENVIRONMENT !== "PREVIEW") {
    add(errors, "ENVIRONMENT_MISMATCH");
  }
  if (values.VITE_FIREBASE_PROJECT_ID !== EXPECTED_PROJECT) {
    add(errors, "PROJECT_MISMATCH");
  }
  if (values.VITE_FIREBASE_AUTH_DOMAIN !== EXPECTED_AUTH_DOMAIN) {
    add(errors, "AUTH_DOMAIN_MISMATCH");
  }
  if (!values.VITE_RECAPTCHA_SITE_KEY?.trim()) {
    add(errors, "SITE_KEY_MISSING");
  }
  if (values.VITE_FIREBASE_API_KEY &&
      !values.VITE_FIREBASE_API_KEY.startsWith("AIza")) {
    add(errors, "API_KEY_FORMAT_INVALID");
  }
  if (values.VITE_FIREBASE_MESSAGING_SENDER_ID &&
      !/^\d+$/u.test(values.VITE_FIREBASE_MESSAGING_SENDER_ID)) {
    add(errors, "SENDER_ID_FORMAT_INVALID");
  }
  if (values.VITE_FIREBASE_APP_ID && values.VITE_FIREBASE_MESSAGING_SENDER_ID &&
      !values.VITE_FIREBASE_APP_ID.startsWith(
        `1:${values.VITE_FIREBASE_MESSAGING_SENDER_ID}:web:`,
      )) {
    add(errors, "APP_ID_FORMAT_INVALID");
  }
  return errors;
}

function loadSourceInventory(repositoryRoot) {
  return Object.fromEntries(SOURCE_FILES.map((relativePath) => [
    relativePath,
    fs.readFileSync(path.join(repositoryRoot, relativePath), "utf8"),
  ]));
}

function runCli() {
  const repositoryRoot = path.resolve(__dirname, "..");
  const sourceErrors = evaluateSourceInventory(loadSourceInventory(repositoryRoot));
  if (process.argv.includes("--source-only")) {
    if (sourceErrors.length > 0) {
      console.error(`PREVIEW_CLIENT_GUARD_FAILED:${sourceErrors.join(",")}`);
      process.exitCode = 1;
      return;
    }
    console.log("PREVIEW_CLIENT_SOURCE_GUARD_PASS");
    return;
  }

  let input;
  try {
    input = JSON.parse(process.env.PREVIEW_CLIENT_GUARD_INPUT || "");
  } catch {
    console.error("PREVIEW_CLIENT_GUARD_FAILED:GUARD_INPUT_MISSING_OR_INVALID");
    process.exitCode = 1;
    return;
  }
  const errors = [...sourceErrors, ...evaluateRemoteContract(input)];
  if (errors.length > 0) {
    console.error(`PREVIEW_CLIENT_GUARD_FAILED:${[...new Set(errors)].join(",")}`);
    process.exitCode = 1;
    return;
  }
  console.log("PREVIEW_CLIENT_ENABLEMENT_GUARD_PASS");
}

module.exports = {
  REQUIRED_VARIABLES,
  REQUIRED_TARGETS,
  evaluateRemoteContract,
  evaluateSourceInventory,
  loadSourceInventory,
};

if (require.main === module) runCli();
