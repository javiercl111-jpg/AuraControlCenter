"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const {
  REQUIRED_VARIABLES,
  evaluateRemoteContract,
  evaluateSourceInventory,
  loadSourceInventory,
} = require("../preview-client-enablement-guard.cjs");

const validValues = () => ({
  VITE_AURA_RUNTIME_ENVIRONMENT: "PREVIEW",
  VITE_FIREBASE_API_KEY: "AIza-preview-public-metadata",
  VITE_FIREBASE_AUTH_DOMAIN: "aura-intel-preview.firebaseapp.com",
  VITE_FIREBASE_PROJECT_ID: "aura-intel-preview",
  VITE_FIREBASE_MESSAGING_SENDER_ID: "1234567890",
  VITE_FIREBASE_APP_ID: "1:1234567890:web:previewmetadata",
  VITE_RECAPTCHA_SITE_KEY: "preview-site-key-metadata",
});

const validInput = () => ({
  vercelProject: "aura-control-center-preview",
  domain: "preview-controlcenter.auranexus.io",
  sharedVariables: false,
  values: validValues(),
  variables: ["preview", "production"].flatMap((target) =>
    REQUIRED_VARIABLES.map((key) => ({ key, target, source: "project" }))),
});

const denied = (mutate, code) => {
  const input = validInput();
  mutate(input);
  assert.ok(evaluateRemoteContract(input).includes(code));
};

test("accepts the exact isolated Preview contract", () => {
  assert.deepEqual(evaluateRemoteContract(validInput()), []);
});
test("real client source inventory passes", () => {
  const root = path.resolve(__dirname, "..", "..");
  assert.deepEqual(evaluateSourceInventory(loadSourceInventory(root)), []);
});
test("rejects a missing variable", () => denied((v) => {
  v.variables = v.variables.filter((e) =>
    !(e.key === REQUIRED_VARIABLES[0] && e.target === "preview"));
}, "REQUIRED_VARIABLE_MISSING"));
test("rejects a duplicate variable", () => denied((v) => {
  v.variables.push({ ...v.variables[0] });
}, "DUPLICATE_VARIABLE"));
test("rejects a project mismatch", () => denied((v) => {
  v.values.VITE_FIREBASE_PROJECT_ID = "not-preview";
}, "PROJECT_MISMATCH"));
test("rejects an auth domain mismatch", () => denied((v) => {
  v.values.VITE_FIREBASE_AUTH_DOMAIN = "not-preview.firebaseapp.com";
}, "AUTH_DOMAIN_MISMATCH"));
test("rejects an absent site key", () => denied((v) => {
  delete v.values.VITE_RECAPTCHA_SITE_KEY;
}, "SITE_KEY_MISSING"));
test("rejects an empty site key", () => denied((v) => {
  v.values.VITE_RECAPTCHA_SITE_KEY = " ";
}, "SITE_KEY_MISSING"));
test("rejects a non-Preview environment", () => denied((v) => {
  v.values.VITE_AURA_RUNTIME_ENVIRONMENT = "STAGING";
}, "ENVIRONMENT_MISMATCH"));
test("rejects a shared variable", () => denied((v) => {
  v.variables[0].source = "shared";
}, "SHARED_VARIABLE_PRESENT"));
test("rejects an unexpected variable", () => denied((v) => {
  v.variables.push({ key: "PRODUCTION_TOKEN", target: "preview" });
}, "UNEXPECTED_VARIABLE_OR_TARGET"));
test("rejects the wrong Vercel project", () => denied((v) => {
  v.vercelProject = "not-preview";
}, "VERCEL_TARGET_MISMATCH"));
test("rejects the wrong domain", () => denied((v) => {
  v.domain = "not-preview.example";
}, "DOMAIN_MISMATCH"));
test("rejects a malformed API key", () => denied((v) => {
  v.values.VITE_FIREBASE_API_KEY = "invalid";
}, "API_KEY_FORMAT_INVALID"));
test("rejects a malformed sender ID", () => denied((v) => {
  v.values.VITE_FIREBASE_MESSAGING_SENDER_ID = "invalid";
}, "SENDER_ID_FORMAT_INVALID"));
test("rejects a mismatched App ID", () => denied((v) => {
  v.values.VITE_FIREBASE_APP_ID = "invalid";
}, "APP_ID_FORMAT_INVALID"));

const validSources = () => ({
  ".env.example": REQUIRED_VARIABLES.map((key) => `${key}=`).join("\n"),
  "src/config/firebase.ts": "getFunctions(firebaseApp, config.functionsRegion)",
  "src/config/previewAppCheckContractV1.ts": "debugEnabled: false",
  "src/config/previewClientConfigurationV1.ts":
    `${REQUIRED_VARIABLES.map((key) => `"${key}"`).join("\n")}\n` +
    "aura-intel-preview\naura-intel-preview.firebaseapp.com\n" +
    "preview-controlcenter.auranexus.io\nfunctionsRegion: \"us-central1\"",
  "src/modules/discovery/services/discoveryLinkService.ts":
    "httpsCallable(functions, \"createDiscoveryLead\")\n" +
    "\"exchangeDiscoveryToken\"\n\"resolveDiscoverySession\"\n" +
    "encodeURIComponent(response.linkId)\n" +
    "encodeURIComponent(response.oneTimeToken)",
  "src/modules/discovery/services/dossierBuilderService.ts":
    "\"completeDiscoverySession\"",
  "src/modules/intelligence/core/services/AuraLLMGateway.ts":
    "\"evaluateConversation\"",
  "src/pages/dev/ExecutiveIntakeSmokeTestPage.tsx":
    "getDiscoveryNavigationTarget(data)",
});

test("rejects the Production control-center domain", () => {
  const sources = validSources();
  sources["src/config/firebase.ts"] += "\nhttps://controlcenter.auranexus.io";
  assert.ok(evaluateSourceInventory(sources).includes(
    "PRODUCTION_DOMAIN_REFERENCE",
  ));
});
test("rejects the Production intelligence domain", () => {
  const sources = validSources();
  sources["src/config/firebase.ts"] += "\nhttps://intelligence.auranexus.io";
  assert.ok(evaluateSourceInventory(sources).includes(
    "PRODUCTION_INTELLIGENCE_DOMAIN_REFERENCE",
  ));
});
test("rejects a Production Firebase project", () => {
  const sources = validSources();
  sources["src/config/firebase.ts"] += "\naura-control-center-debb3";
  assert.ok(evaluateSourceInventory(sources).includes(
    "PRODUCTION_FIREBASE_REFERENCE",
  ));
});
test("rejects a direct Cloud Run URL", () => {
  const sources = validSources();
  sources["src/config/firebase.ts"] += "\nhttps://service.a.run.app";
  assert.ok(evaluateSourceInventory(sources).includes("DIRECT_CLOUD_RUN_URL"));
});
test("rejects App Check debug", () => {
  const sources = validSources();
  sources["src/config/firebase.ts"] += "\nFIREBASE_APPCHECK_DEBUG_TOKEN";
  assert.ok(evaluateSourceInventory(sources).includes(
    "APP_CHECK_DEBUG_REFERENCE",
  ));
});
test("rejects a silent environment fallback", () => {
  const sources = validSources();
  sources["src/config/firebase.ts"] +=
    "\nimport.meta.env.VITE_FIREBASE_PROJECT_ID || 'fallback'";
  assert.ok(evaluateSourceInventory(sources).includes(
    "SILENT_ENVIRONMENT_FALLBACK",
  ));
});
test("rejects direct discoveryUrl use in the development smoke page", () => {
  const sources = validSources();
  sources["src/pages/dev/ExecutiveIntakeSmokeTestPage.tsx"] =
    "window.open(discoveryUrl); data.discoveryUrl";
  assert.ok(evaluateSourceInventory(sources).includes(
    "DEVELOPMENT_SMOKE_NOT_ORIGIN_ISOLATED",
  ));
});
