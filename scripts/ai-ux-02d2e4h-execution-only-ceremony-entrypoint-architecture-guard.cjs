"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const entrypoint = fs.readFileSync(path.join(
  root,
  "scripts",
  "ai-ux-02d2e4h-execution-only-ceremony-entrypoint.mjs",
), "utf8");
const runner = fs.readFileSync(path.join(
  root,
  "scripts",
  "ai-ux-02d2e4-final-preview-ceremony.mjs",
), "utf8");

function fail(code) {
  process.stderr.write(`AI_UX_02D2E4H_ARCHITECTURE_GUARD=FAIL ${code}\n`);
  process.exit(1);
}

for (const symbol of [
  "BrowserEvaluateConversationBoundaryV1",
  "OperationalExistingPreviewCeremonyExecutorV1",
  "createOperationalD2E4HExecutionCeremonyV1",
]) {
  if (!entrypoint.includes(`class ${symbol}`) &&
      !entrypoint.includes(`function ${symbol}`)) {
    fail(`SYMBOL_MISSING_${symbol}`);
  }
}
for (const required of [
  "async executeOnce(artifact)",
  "reuseExistingPreview",
  "adaptiveCanaryControlPlaneAdapter",
  "capabilityIssuerAdapter",
  "BrowserEvaluateConversationBoundaryV1",
  "turnReceipt",
  "authoritativeBinding",
  "assertBrowserProofResultV1",
  "certifiedArtifact.deployment",
]) {
  if (!entrypoint.includes(required)) fail(`OPERATIONAL_BINDING_MISSING_${required}`);
}
if (/\bmock\w*\b/iu.test(entrypoint) ||
    /\.deployPreview\s*\(/u.test(entrypoint) ||
    /previewConfigurationAdapter/u.test(entrypoint) ||
    /\.readBack\s*\(/u.test(entrypoint) ||
    /\.revalidate\s*\(/u.test(entrypoint) ||
    /environment:\s*["'](?:PRODUCTION|STAGING)["']/u.test(entrypoint)) {
  fail("FORBIDDEN_OPERATIONAL_PATH");
}
for (const required of [
  "PREVIEW_READY_REUSED",
  "async reuseExistingPreview(deployment)",
  "contractName !== \"DeploymentReadinessReceiptV1\"",
  "async bootstrapBrowser(adapter)",
  "deploymentInvocations !== 0",
  "productionChanged !== false",
  "stagingChanged !== false",
]) {
  if (!runner.includes(required)) fail(`EXISTING_PREVIEW_GUARD_MISSING_${required}`);
}
if (/configureDigestOnly|CONTROL_PROOF_SHA256|async configurePreview\(/u.test(runner)) {
  fail("RUNTIME_PROOF_SUBSTITUTION_SURFACE");
}

process.stdout.write("AI_UX_02D2E4H_ARCHITECTURE_GUARD=PASS\n");
