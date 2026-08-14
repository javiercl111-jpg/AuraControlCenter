"use strict";

const fs = require("node:fs");
const path = require("node:path");

const sourcePath = path.join(
  path.resolve(__dirname, ".."),
  "scripts",
  "ai-ux-02d2e4g-execution-entrypoint-separation.mjs",
);

function fail(code) {
  process.stderr.write(`AI_UX_02D2E4G_ARCHITECTURE_GUARD=FAIL ${code}\n`);
  process.exit(1);
}

if (!fs.existsSync(sourcePath)) fail("ENTRYPOINT_MISSING");
const source = fs.readFileSync(sourcePath, "utf8");
for (const symbol of [
  "ExistingPreviewDeploymentReadBackAdapterV1",
  "D2E4GCompositionPreflightV1",
  "D2E4GExecutionCeremonyV1",
]) {
  if (!source.includes(`class ${symbol}`)) fail(`SYMBOL_MISSING_${symbol}`);
}

const compositionStart = source.indexOf("export class D2E4GCompositionPreflightV1");
const executionStart = source.indexOf("export class D2E4GExecutionCeremonyV1");
const composition = source.slice(compositionStart, executionStart);
const execution = source.slice(executionStart);

for (const forbidden of [
  /\.deploy(?:Once)?\s*\(/u,
  /\.apply\s*\(/u,
  /\.rotate\s*\(/u,
  /\.issue\w*\s*\(/u,
  /\.executeOnce\s*\(/u,
]) {
  if (forbidden.test(composition)) fail("COMPOSITION_SIDE_EFFECT_SURFACE");
}
for (const forbidden of [
  /\.readAuthority\s*\(/u,
  /\.readReadiness\s*\(/u,
  /\.readBack\s*\(/u,
  /\.revalidate\s*\(/u,
  /\bvercel\b/iu,
  /\bdeploy\b/iu,
]) {
  if (forbidden.test(execution)) fail("EXECUTION_INFRASTRUCTURE_VALIDATION_SURFACE");
}
if (!source.includes("createDeploymentReadinessReceiptV1") ||
    !source.includes("assertDeploymentReadinessReceiptV1") ||
    !source.includes("deploymentArtifactDigest") ||
    !source.includes("controlProofDigest") ||
    !source.includes("reusedExistingPreview: true") ||
    !source.includes("deploymentInvocations: 0")) {
  fail("EXISTING_PREVIEW_REUSE_GUARD_MISSING");
}
if (/deploymentState|controlProofSha256|configureDigestOnly/u.test(source)) {
  fail("LEGACY_DEPLOYMENT_CONTRACT_AVAILABLE");
}
if (!source.includes("COMPOSITION_STATUS: \"READY\"") ||
    !source.includes("assertExecutionResultV1(receipt, { artifact })")) {
  fail("PHASE_OUTPUT_GUARD_MISSING");
}
if (/environment:\s*["'](?:PRODUCTION|STAGING)["']/u.test(source)) {
  fail("NON_PREVIEW_TARGET_AVAILABLE");
}

process.stdout.write("AI_UX_02D2E4G_ARCHITECTURE_GUARD=PASS\n");
