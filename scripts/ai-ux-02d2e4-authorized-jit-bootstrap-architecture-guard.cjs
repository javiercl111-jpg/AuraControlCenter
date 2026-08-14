"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const bootstrapPath =
  "src/modules/discovery/security/authorizedJitBootstrapV1.ts";
const directPath =
  "src/modules/discovery/security/directEphemeralDiscoveryCapabilityInjectionV1.ts";
const mainPath = "src/main.tsx";
const vitePath = "vite.config.ts";
const appPath = "src/App.tsx";
const discoverPath = "src/pages/DiscoverPage.tsx";
const harnessPath = "tests/ai-ux-02d2e4/browser-harness.tsx";
const evidenceDirectory =
  "docs/security/ai-ux/discovery-experience-validation/ai-ux-02d2e4";

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function evaluateAiUx02D2E4ArchitectureV1(files) {
  const errors = [];
  const bootstrap = files[bootstrapPath] || "";
  const direct = files[directPath] || "";
  const main = files[mainPath] || "";
  const vite = files[vitePath] || "";
  const app = files[appPath] || "";
  const discover = files[discoverPath] || "";
  const harness = files[harnessPath] || "";
  const combined = [bootstrap, main, vite, harness].join("\n");

  if (/\b(?:onCall|onRequest|express\s*\(|httpsCallable\s*\()/u.test(bootstrap)) {
    errors.push("PUBLIC_ENDPOINT_FORBIDDEN");
  }
  if (/\b(?:sessionStorage|localStorage|indexedDB|document\.cookie|caches\.open|serviceWorker|BroadcastChannel|MessageChannel|postMessage|clipboard)\b/u.test(bootstrap)) {
    errors.push("BOOTSTRAP_PERSISTENT_OR_OPEN_TRANSPORT_FORBIDDEN");
  }
  if (/\b(?:location|URLSearchParams|history\.replaceState)\b|#access/u.test(bootstrap)) {
    errors.push("BOOTSTRAP_URL_TRANSPORT_FORBIDDEN");
  }
  if (/window\s*\.[A-Za-z_$][\w$]*\s*=.*(?:bearer|sessionToken)/iu.test(combined)) {
    errors.push("GLOBAL_BEARER_EXPOSURE_FORBIDDEN");
  }
  if (!/Object\.defineProperty\(/u.test(bootstrap) ||
      !/enumerable:\s*false/u.test(bootstrap) ||
      !/configurable:\s*true/u.test(bootstrap) ||
      !/Reflect\.deleteProperty/u.test(bootstrap)) {
    errors.push("TEMPORARY_NON_ENUMERABLE_CLAIM_MISSING");
  }
  if (!/environment !== "PREVIEW"/u.test(bootstrap) ||
      !/projectId !== PREVIEW_PROJECT_ID/u.test(bootstrap) ||
      !/status:\s*"UNAVAILABLE"/u.test(bootstrap)) {
    errors.push("PREVIEW_ONLY_ISOLATION_MISSING");
  }
  if (!/controlProofDigest/u.test(bootstrap) ||
      !/crypto\.subtle\.digest\("SHA-256"/u.test(bootstrap) ||
      !/constantTimeEqual/u.test(bootstrap)) {
    errors.push("CONTROL_PROOF_AUTHORITY_MISSING");
  }
  if (!/proofObservation/u.test(bootstrap) ||
      !/expectedControlProofDigest/u.test(bootstrap) ||
      !/observedControlProofDigest/u.test(bootstrap) ||
      !/verifiedAtMs/u.test(bootstrap)) {
    errors.push("PRIVATE_PROOF_OBSERVATION_MISSING");
  }
  if (!/CLAIM_KEYS[\s\S]*"binding"[\s\S]*"controlProof"[\s\S]*"version"/u.test(bootstrap) ||
      !/Object\.keys\(input\)\.sort\(\)/u.test(bootstrap)) {
    errors.push("EXACT_CLAIM_CONTRACT_MISSING");
  }
  if (/interface AuthorizedJitBootstrapClaimV1\s*\{[^}]*\b(?:tenantId|mode|policyVersion|capabilityScope|role|authority|linkId|sessionId|turnId)\b/iu.test(bootstrap)) {
    errors.push("CLIENT_SUPPLIED_SCOPE_FORBIDDEN");
  }
  if (!/interface AuthorizedJitBootstrapBindingV1/u.test(bootstrap) ||
      !/exactBinding/u.test(bootstrap) ||
      !/createDirectEphemeralDiscoveryCapabilityChannelV1\([\s\S]*claim\.binding\.linkId[\s\S]*claim\.binding\.sessionId/u.test(bootstrap) ||
      /ai-ux-02d3-preview-synthetic-discovery-(?:link|session)-v1/u.test(bootstrap)) {
    errors.push("AUTHORIZED_RESOLVED_BINDING_MISSING");
  }
  if (!/handleAvailable = false;[\s\S]*return channel\.issuerPort\.deliverOnce/u.test(bootstrap) ||
      !/JIT_BOOTSTRAP_HANDLE_STALE/u.test(bootstrap) ||
      !/AUTHORIZED_JIT_BOOTSTRAP_HANDLE_TTL_MS_V1/u.test(bootstrap)) {
    errors.push("ONE_SHOT_STALE_HANDLE_MISSING");
  }
  if (!/isReady\(\): boolean/u.test(direct) ||
      !/return !delivered && consumer !== null/u.test(direct)) {
    errors.push("MOUNTED_FRONTEND_READINESS_MISSING");
  }
  if (!/installAuthorizedJitBootstrapV1/u.test(main) ||
      !/VITE_AI_UX_02D2E4_CONTROL_PROOF_DIGEST_V1/u.test(main) ||
      !/mountFrontend:\s*mountApplication/u.test(main)) {
    errors.push("APPLICATION_BOOTSTRAP_INTEGRATION_MISSING");
  }
  if (!/loadEnv/u.test(vite) ||
      !/preview-certification/u.test(vite) ||
      !/BROWSER_PROOF_CERTIFIED_DIGEST_REQUIRED/u.test(vite) ||
      !/BROWSER_PROOF_LEGACY_BUILD_INPUT_REJECTED/u.test(vite)) {
    errors.push("PREVIEW_BUILD_CERTIFICATION_GUARD_MISSING");
  }
  if (/VITE_AI_UX_02D2E4_CONTROL_PROOF_SHA256/u.test(bootstrap + main) ||
      /\bconfigureDigestOnly\b|\bvercel\s+env\b/iu.test(combined)) {
    errors.push("RUNTIME_PROOF_SUBSTITUTION_FORBIDDEN");
  }
  if (!/directEphemeralCapabilitySource/u.test(app) ||
      !/directEphemeralCapabilitySource\.connect/u.test(discover)) {
    errors.push("DIRECT_FRONTEND_PATH_MISSING");
  }
  if (!/createRoot/u.test(harness) ||
      !/MountedFrontendProbe/u.test(harness) ||
      !/MOCK_EVALUATE_CONVERSATION_CONSUMED/u.test(harness) ||
      /httpsCallable|firebase/u.test(harness)) {
    errors.push("LOCAL_BROWSER_HARNESS_INVALID");
  }
  if (/console\.(?:log|info|warn|error)\([^\n]*(?:bearer|controlProof)/iu.test(combined)) {
    errors.push("SECRET_LOGGING_FORBIDDEN");
  }
  return [...new Set(errors)];
}

function loadFiles() {
  return Object.fromEntries([
    bootstrapPath,
    directPath,
    mainPath,
    vitePath,
    appPath,
    discoverPath,
    harnessPath,
  ].map((file) => [file, read(file)]));
}

function validateEvidence() {
  const directory = path.join(root, evidenceDirectory);
  if (!fs.existsSync(directory)) return ["EVIDENCE_DIRECTORY_MISSING"];
  const files = fs.readdirSync(directory)
    .filter((name) => fs.statSync(path.join(directory, name)).isFile());
  const expected = new Set([
    "AI_UX_02D2E4_AUTHORIZED_JIT_BOOTSTRAP_CERTIFICATION_V1.md",
    "AI_UX_02D2E4_AUTHORIZED_JIT_BOOTSTRAP_MATRIX_V1.json",
    "AI_UX_02D2E4_AUTHORIZED_JIT_BOOTSTRAP_EVIDENCE_INDEX_V1.md",
    "AI_UX_02D2E4_AUTHORIZED_JIT_BOOTSTRAP_CHANGE_RECORD_V1.md",
  ]);
  const errors = files.length === 4 && files.every((file) => expected.has(file))
    ? [] : ["EVIDENCE_FILE_SET_MISMATCH"];
  for (const file of files) {
    const content = read(`${evidenceDirectory}/${file}`);
    if (/[A-Za-z]:\\|\/(?:Users|home)\//u.test(content)) {
      errors.push("ABSOLUTE_PATH_FORBIDDEN");
    }
    if (/\b[a-f0-9]{64}\b/iu.test(content)) {
      errors.push("TOKEN_OR_HASH_LITERAL_FORBIDDEN");
    }
    if (/BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY|AIza[0-9A-Za-z_-]{20,}/u.test(content)) {
      errors.push("SECRET_LITERAL_FORBIDDEN");
    }
    if (/chain[- ]of[- ]thought|hidden reasoning|internal reasoning/iu.test(content)) {
      errors.push("PRIVATE_REASONING_FORBIDDEN");
    }
    if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/iu.test(content)) {
      errors.push("PII_EMAIL_FORBIDDEN");
    }
    if (file.endsWith(".json")) {
      try { JSON.parse(content); } catch { errors.push("EVIDENCE_JSON_INVALID"); }
    }
  }
  return [...new Set(errors)];
}

function collectAiUx02D2E4GuardErrorsV1(
  files,
  evidenceErrors,
  options = {},
) {
  return [
    ...evaluateAiUx02D2E4ArchitectureV1(files),
    ...(options.sourceOnly ? [] : evidenceErrors),
  ];
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const sourceOnly = args.length === 1 && args[0] === "--source-only";
  const argumentsValid = args.length === 0 || sourceOnly;
  const errors = argumentsValid
    ? collectAiUx02D2E4GuardErrorsV1(
      loadFiles(),
      sourceOnly ? [] : validateEvidence(),
      { sourceOnly },
    )
    : ["GUARD_ARGUMENT_INVALID"];
  if (errors.length) {
    process.stderr.write(
      `AI_UX_02D2E4_ARCHITECTURE_GUARD_FAILED:${errors.join(",")}\n`,
    );
    process.exitCode = 1;
  } else {
    process.stdout.write("AI_UX_02D2E4_ARCHITECTURE_GUARD_PASS\n");
  }
}

module.exports = {
  collectAiUx02D2E4GuardErrorsV1,
  evaluateAiUx02D2E4ArchitectureV1,
  validateEvidence,
};
