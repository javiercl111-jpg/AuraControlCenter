"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const directPath =
  "src/modules/discovery/security/directEphemeralDiscoveryCapabilityInjectionV1.ts";
const browserPath = "src/pages/DiscoverPage.tsx";
const appPath = "src/App.tsx";
const handoffPath =
  "src/modules/discovery/security/ephemeralBrowserCapabilityHandoffV1.ts";
const gatewayPath =
  "src/modules/intelligence/core/services/AuraLLMGateway.ts";
const evidenceDirectory =
  "docs/security/ai-ux/discovery-experience-validation/ai-ux-02d2e3";

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function evaluateAiUx02D2E3ArchitectureV1(files) {
  const errors = [];
  const direct = files[directPath] || "";
  const browser = files[browserPath] || "";
  const app = files[appPath] || "";
  const handoff = files[handoffPath] || "";
  const gateway = files[gatewayPath] || "";

  const forbiddenDirectMechanisms = [
    /sessionStorage/iu,
    /localStorage/iu,
    /indexedDB/iu,
    /document\.cookie/iu,
    /cookieStore/iu,
    /serviceWorker/iu,
    /CacheStorage/iu,
    /caches\.(?:open|match|put)/iu,
    /BroadcastChannel/iu,
    /MessageChannel/iu,
    /postMessage/iu,
    /WebSocket/iu,
    /EventSource/iu,
    /window\./iu,
    /globalThis\./iu,
    /location\./iu,
    /URLSearchParams/iu,
    /#access/iu,
    /clipboard/iu,
  ];
  if (forbiddenDirectMechanisms.some((pattern) => pattern.test(direct))) {
    errors.push("DIRECT_BOUNDARY_FORBIDDEN_TRANSPORT");
  }
  if (
    /Object\.defineProperty\s*\(\s*(?:window|globalThis)/iu.test(browser) ||
    /(?:window|globalThis)\s*\[[^\]]*(?:inject|capability|bearer)/iu.test(browser)
  ) {
    errors.push("GLOBAL_INJECTION_EXPOSURE_FORBIDDEN");
  }
  if (
    /(?:input|dataset|setAttribute|CustomEvent|dispatchEvent)[^\n]*(?:bearer|sessionToken)/iu
      .test(`${direct}\n${browser}`)
  ) {
    errors.push("DOM_INJECTION_CARRIER_FORBIDDEN");
  }
  if (
    !/class DirectEphemeralDiscoveryCapabilityInjectionBoundaryV1/u.test(direct) ||
    !/readonly #handoff/u.test(direct) ||
    !/#available = false/u.test(direct) ||
    !/injectAndExecute/u.test(direct)
  ) {
    errors.push("ONE_SHOT_PRIVATE_BOUNDARY_MISSING");
  }
  if (
    !/INJECTION_KEYS[\s\S]*"bearer"[\s\S]*"expiresAt"[\s\S]*"version"/u
      .test(direct) ||
    !/Object\.keys\(injection\)\.sort\(\)/u.test(direct)
  ) {
    errors.push("EXACT_INJECTION_SHAPE_GUARD_MISSING");
  }
  if (
    /interface DirectEphemeralDiscoveryCapabilityInjectionV1[\s\S]{0,500}\b(?:tenantId|mode|policyVersion|capabilityScope|role|authority)\b/iu
      .test(direct)
  ) {
    errors.push("CLIENT_SUPPLIED_AUTHORITY_FORBIDDEN");
  }
  if (
    !/DIRECT_EPHEMERAL_DISCOVERY_CAPABILITY_TTL_MS_V1/u.test(direct) ||
    !/injection\.expiresAt <= now/u.test(direct) ||
    !/injection\.expiresAt - now/u.test(direct)
  ) {
    errors.push("BOUNDED_LIFETIME_GUARD_MISSING");
  }
  if (
    !/sessionToken/u.test(direct) ||
    !/"evaluateConversation"/u.test(gateway) ||
    /retainAfterSuccess/u.test(direct)
  ) {
    errors.push("SINGLE_EVALUATE_CONSUMPTION_MISSING");
  }
  if (
    !/createDirectEphemeralDiscoveryCapabilityChannelV1/u.test(direct) ||
    !/connect\(/u.test(direct) ||
    !/deliverOnce/u.test(direct) ||
    !/consumer = null/u.test(direct)
  ) {
    errors.push("ONE_TO_ONE_ISSUER_BRIDGE_MISSING");
  }
  if (
    !/directEphemeralCapabilitySource/u.test(browser) ||
    !/directEphemeralCapabilitySource\.connect/u.test(browser) ||
    !/boundary\.injectAndExecute/u.test(browser) ||
    !/processTurn\("", request\)/u.test(browser)
  ) {
    errors.push("DISCOVER_PAGE_DIRECT_INTEGRATION_MISSING");
  }
  if (
    !/directEphemeralCapabilitySource/u.test(app) ||
    !/<DiscoverPage[\s\S]*directEphemeralCapabilitySource=/u.test(app)
  ) {
    errors.push("APP_DEPENDENCY_INJECTION_MISSING");
  }
  if (
    !/new EphemeralBrowserCapabilityHandoffV1\(\)/u.test(browser) ||
    !/readonly #slots/u.test(handoff)
  ) {
    errors.push("D2E1_MEMORY_HANDOFF_REGRESSION");
  }
  if (
    /(?:console|telemetry|audit|replay)[^\n]*(?:bearer|sessionToken)/iu
      .test(direct)
  ) {
    errors.push("DIRECT_BEARER_OBSERVABILITY_COPY_FORBIDDEN");
  }

  return [...new Set(errors)];
}

function loadFiles() {
  return Object.fromEntries([
    directPath,
    browserPath,
    appPath,
    handoffPath,
    gatewayPath,
  ].map((file) => [file, read(file)]));
}

function validateEvidence() {
  const directory = path.join(root, evidenceDirectory);
  if (!fs.existsSync(directory)) return ["EVIDENCE_DIRECTORY_MISSING"];
  const files = fs.readdirSync(directory)
    .filter((name) => fs.statSync(path.join(directory, name)).isFile());
  const expected = new Set([
    "AI_UX_02D2E3_DIRECT_EPHEMERAL_INJECTION_CERTIFICATION_V1.md",
    "AI_UX_02D2E3_DIRECT_EPHEMERAL_INJECTION_MATRIX_V1.json",
    "AI_UX_02D2E3_DIRECT_EPHEMERAL_INJECTION_EVIDENCE_INDEX_V1.md",
    "AI_UX_02D2E3_DIRECT_EPHEMERAL_INJECTION_CHANGE_RECORD_V1.md",
  ]);
  const errors = files.length === 4 &&
    files.every((file) => expected.has(file))
    ? [] : ["EVIDENCE_FILE_SET_MISMATCH"];

  for (const file of files) {
    const content = read(`${evidenceDirectory}/${file}`);
    if (/[A-Za-z]:\\|\/(?:Users|home)\//u.test(content)) {
      errors.push("ABSOLUTE_PATH_FORBIDDEN");
    }
    if (/\b[a-f0-9]{64}\b/iu.test(content)) {
      errors.push("TOKEN_OR_HASH_LITERAL_FORBIDDEN");
    }
    if (/BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY|AIza[0-9A-Za-z_-]{20,}/u
      .test(content)) {
      errors.push("SECRET_LITERAL_FORBIDDEN");
    }
    if (/chain[- ]of[- ]thought|hidden reasoning|internal reasoning/iu
      .test(content)) {
      errors.push("PRIVATE_REASONING_FORBIDDEN");
    }
    if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/iu.test(content)) {
      errors.push("PII_EMAIL_FORBIDDEN");
    }
    if (file.endsWith(".json")) {
      try {
        JSON.parse(content);
      } catch {
        errors.push("EVIDENCE_JSON_INVALID");
      }
    }
  }
  return [...new Set(errors)];
}

if (require.main === module) {
  const errors = [
    ...evaluateAiUx02D2E3ArchitectureV1(loadFiles()),
    ...validateEvidence(),
  ];
  if (errors.length) {
    process.stderr.write(
      `AI_UX_02D2E3_ARCHITECTURE_GUARD_FAILED:${errors.join(",")}\n`,
    );
    process.exitCode = 1;
  } else {
    process.stdout.write("AI_UX_02D2E3_ARCHITECTURE_GUARD_PASS\n");
  }
}

module.exports = {
  evaluateAiUx02D2E3ArchitectureV1,
  validateEvidence,
};
