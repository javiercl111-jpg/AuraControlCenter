"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const files = [
  "src/modules/discovery/security/authorizedJitBootstrapV1.ts",
  "scripts/ai-ux-02d2e4-preview-ceremony-controller.mjs",
  "scripts/ai-ux-02d2e4-final-preview-ceremony.mjs",
  "scripts/ai-ux-02d2e4e-real-capability-readiness.mjs",
  "scripts/ai-ux-02d2e4f-authoritative-jit-binding.mjs",
];

const sources = Object.fromEntries(files.map((file) => [
  file,
  fs.readFileSync(path.join(root, file), "utf8"),
]));
const bootstrap = sources[files[0]];
const controller = sources[files[1]];
const runner = sources[files[2]];
const entrypoint = sources[files[3]];
const resolver = sources[files[4]];
const combined = Object.values(sources).join("\n");
const errors = [];

if (/ai-ux-02d3-preview-synthetic-discovery-(?:link|session)-v1/u.test(combined) ||
    /AUTHORIZED_JIT_BOOTSTRAP_SCOPE_V1/u.test(combined)) {
  errors.push("HARDCODED_LINK_SESSION_REMAINS");
}
if (!/exactBinding/u.test(bootstrap) ||
    !/claim\.binding\.linkId/u.test(bootstrap) ||
    !/claim\.binding\.sessionId/u.test(bootstrap)) {
  errors.push("BOOTSTRAP_AUTHORIZED_BINDING_MISSING");
}
if (!/claimEphemeral\(controlProof, authoritativeBinding\)/u.test(controller) ||
    !/binding:\s*claimInput\.binding/u.test(controller)) {
  errors.push("CONTROLLER_BINDING_HANDOFF_MISSING");
}
if (!/#authoritativeBinding/u.test(runner) ||
    !/this\.#controller\.bootstrapBrowser\(adapter, this\.#authoritativeBinding\)/u.test(runner) ||
    !/bootstrapBrowser\(adapter, authoritativeBinding\)/u.test(controller)) {
  errors.push("RUNNER_BINDING_COMPOSITION_MISSING");
}
const resolveAt = entrypoint.indexOf("bindingResolution =");
const consumerAt = entrypoint.indexOf("consumerBoundary.assertReady");
const rotationAt = entrypoint.indexOf("rotationAuthority.revalidate");
const canaryAt = entrypoint.indexOf("canaryRevalidation.revalidate");
if (!(resolveAt >= 0 && resolveAt < consumerAt && consumerAt < rotationAt &&
      rotationAt < canaryAt)) {
  errors.push("PREFLIGHT_ORDER_INVALID");
}
if (!/authorityFactory/u.test(resolver) ||
    !/rotationRepository\.inspectExpired/u.test(resolver) ||
    !/authority\.linkId/u.test(resolver) ||
    !/authority\.sessionId/u.test(resolver)) {
  errors.push("CERTIFIED_REPOSITORY_RESOLUTION_MISSING");
}
if (/\b(?:PRODUCTION|STAGING)\b[\s\S]{0,80}(?:available|enabled)\s*:\s*true/iu.test(combined)) {
  errors.push("NON_PREVIEW_AVAILABILITY_FORBIDDEN");
}

if (errors.length) {
  process.stderr.write(`AI_UX_02D2E4F_ARCHITECTURE_GUARD_FAILED:${errors.join(",")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write("AI_UX_02D2E4F_ARCHITECTURE_GUARD_PASS\n");
}
