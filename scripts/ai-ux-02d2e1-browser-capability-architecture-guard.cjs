"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const browserPath = "src/pages/DiscoverPage.tsx";
const handoffPath = "src/modules/discovery/security/ephemeralBrowserCapabilityHandoffV1.ts";
const exchangePath = "src/modules/discovery/services/discoveryLinkService.ts";
const verifierPath = "functions/src/infrastructure/firestore/discoveryCapabilities/FirestoreDiscoveryCapabilityRepository.ts";
const evaluatePath = "functions/src/intelligence/evaluateConversation.ts";
const evidenceDirectory = "docs/security/ai-ux/discovery-experience-validation/ai-ux-02d2e1";

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function evaluateAiUx02D2E1ArchitectureV1(files) {
  const errors = [];
  const browser = files[browserPath] || "";
  const handoff = files[handoffPath] || "";
  const exchange = files[exchangePath] || "";
  const verifier = files[verifierPath] || "";
  const evaluate = files[evaluatePath] || "";
  const browserBoundary = `${browser}\n${handoff}`;

  const forbiddenPersistence = [
    /sessionStorage/iu,
    /localStorage/iu,
    /indexedDB/iu,
    /document\.cookie/iu,
    /cookieStore/iu,
    /caches\.(?:open|match|put)/iu,
    /CacheStorage/iu,
    /serviceWorker/iu,
  ];
  if (forbiddenPersistence.some((pattern) => pattern.test(browserBoundary))) {
    errors.push("BROWSER_CAPABILITY_PERSISTENCE_FORBIDDEN");
  }
  if (/useState[^\n]*(?:bearer|sessionAccessToken|reportCapabilityToken)/iu.test(browser)) {
    errors.push("REACT_STATE_CAPABILITY_FORBIDDEN");
  }
  if (/(?:location|history|navigate|URLSearchParams)[^\n]*(?:sessionAccessToken|reportCapabilityToken|requestBearer)/iu.test(browser)) {
    errors.push("CAPABILITY_IN_URL_FORBIDDEN");
  }
  if (/<(?:input|meta|data)[^>]*(?:sessionAccessToken|reportCapabilityToken|requestBearer)/iu.test(browser)) {
    errors.push("CAPABILITY_IN_DOM_FORBIDDEN");
  }
  if (/(?:persist|redux|zustand|store\.dispatch)[^\n]*(?:sessionAccessToken|reportCapabilityToken|requestBearer|bearer)/iu.test(browserBoundary)) {
    errors.push("PERSISTENT_CLIENT_STORE_FORBIDDEN");
  }
  if (/(?:telemetry|replay|audit)[^\n]*(?:sessionAccessToken|reportCapabilityToken|requestBearer|bearer)/iu.test(browserBoundary)) {
    errors.push("OBSERVABILITY_CAPABILITY_COPY_FORBIDDEN");
  }
  if (/(?:throw new Error|setError)[^\n]*(?:sessionAccessToken|reportCapabilityToken|requestBearer|bearer)/iu.test(browserBoundary)) {
    errors.push("ERROR_MESSAGE_CAPABILITY_COPY_FORBIDDEN");
  }
  if (/console\.(?:log|info|warn|error)\([^)]*(?:sessionAccessToken|reportCapabilityToken|requestBearer|bearer)/isu.test(browserBoundary)) {
    errors.push("CAPABILITY_LOGGING_FORBIDDEN");
  }
  if (!/new EphemeralBrowserCapabilityHandoffV1\(\)/u.test(browser) || !/readonly #slots/u.test(handoff)) {
    errors.push("MEMORY_ONLY_CUSTODY_MISSING");
  }
  if (!/clearAll\(\)/u.test(browser) || !/pendingAccessRef\.current = null/u.test(browser)) {
    errors.push("UNMOUNT_OR_TERMINAL_CLEAR_MISSING");
  }
  if (!/EPHEMERAL_CAPABILITY_USE_IN_FLIGHT/u.test(handoff) || !/inFlight/u.test(handoff)) {
    errors.push("DUPLICATE_USE_GUARD_MISSING");
  }
  if (!/catch \(error: unknown\)[\s\S]*slot\.bearer = null/u.test(handoff)) {
    errors.push("UNCERTAIN_FAILURE_CLEAR_MISSING");
  }
  if (!/sessionAccessToken/u.test(exchange) || !/accept\("SESSION", result\.sessionAccessToken\)/u.test(browser)) {
    errors.push("EXCHANGE_TO_MEMORY_HANDOFF_MISSING");
  }
  if (!/sessionToken: requestBearer/u.test(browser) || !/"evaluateConversation"/u.test(read("src/modules/intelligence/core/services/AuraLLMGateway.ts"))) {
    errors.push("AUTHORIZED_EVALUATE_HANDOFF_MISSING");
  }
  if (!/hashDiscoveryCapabilityToken\(input\.token\)/u.test(verifier) || !/hashDiscoveryCapabilityToken\(data\.sessionToken\)/u.test(evaluate)) {
    errors.push("SERVER_HASH_ONLY_VERIFICATION_MISSING");
  }
  if (/return[^;]*(?:bearerToken|sessionToken)/iu.test(evaluate)) {
    errors.push("SERVER_BEARER_RETURN_FORBIDDEN");
  }

  return [...new Set(errors)];
}

function loadFiles() {
  return Object.fromEntries([
    browserPath,
    handoffPath,
    exchangePath,
    verifierPath,
    evaluatePath,
  ].map((file) => [file, read(file)]));
}

function validateEvidence() {
  const directory = path.join(root, evidenceDirectory);
  if (!fs.existsSync(directory)) return ["EVIDENCE_DIRECTORY_MISSING"];
  const files = fs.readdirSync(directory).filter((name) => fs.statSync(path.join(directory, name)).isFile());
  const expected = new Set([
    "AI_UX_02D2E1_EPHEMERAL_BROWSER_HANDOFF_CERTIFICATION_V1.md",
    "AI_UX_02D2E1_EPHEMERAL_BROWSER_HANDOFF_MATRIX_V1.json",
    "AI_UX_02D2E1_EPHEMERAL_BROWSER_HANDOFF_EVIDENCE_INDEX_V1.md",
    "AI_UX_02D2E1_EPHEMERAL_BROWSER_HANDOFF_CHANGE_RECORD_V1.md",
  ]);
  const errors = files.length === 4 && files.every((file) => expected.has(file)) ? [] : ["EVIDENCE_FILE_SET_MISMATCH"];

  for (const file of files) {
    const content = read(`${evidenceDirectory}/${file}`);
    if (/[A-Za-z]:\\|\/(?:Users|home)\//u.test(content)) errors.push("ABSOLUTE_PATH_FORBIDDEN");
    if (/\b[a-f0-9]{64}\b/iu.test(content)) errors.push("TOKEN_OR_HASH_LITERAL_FORBIDDEN");
    if (/BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY|AIza[0-9A-Za-z_-]{20,}/u.test(content)) errors.push("SECRET_LITERAL_FORBIDDEN");
    if (/chain[- ]of[- ]thought|hidden reasoning|internal reasoning/iu.test(content)) errors.push("PRIVATE_REASONING_FORBIDDEN");
    if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/iu.test(content)) errors.push("PII_EMAIL_FORBIDDEN");
    if (file.endsWith(".json")) {
      try { JSON.parse(content); } catch { errors.push("EVIDENCE_JSON_INVALID"); }
    }
  }
  return [...new Set(errors)];
}

if (require.main === module) {
  const errors = [...evaluateAiUx02D2E1ArchitectureV1(loadFiles()), ...validateEvidence()];
  if (errors.length) {
    process.stderr.write(`AI_UX_02D2E1_ARCHITECTURE_GUARD_FAILED:${errors.join(",")}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write("AI_UX_02D2E1_ARCHITECTURE_GUARD_PASS\n");
  }
}

module.exports = { evaluateAiUx02D2E1ArchitectureV1, validateEvidence };
