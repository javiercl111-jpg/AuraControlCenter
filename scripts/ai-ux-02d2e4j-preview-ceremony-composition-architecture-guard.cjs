"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const sourcePath = path.join(
  root,
  "scripts",
  "ai-ux-02d2e4j-preview-ceremony-composition.mjs",
);

function fail(code) {
  process.stderr.write(`AI_UX_02D2E4J_ARCHITECTURE_GUARD=FAIL ${code}\n`);
  process.exit(1);
}

if (!fs.existsSync(sourcePath)) fail("COMPOSITION_ROOT_MISSING");
const source = fs.readFileSync(sourcePath, "utf8");

for (const required of [
  "D2E4GCompositionPreflightV1",
  "ExistingPreviewDeploymentReadBackAdapterV1",
  "createOperationalD2E4EFinalCeremonyEntrypointV1",
  "RealVercelPreviewCeremonyAdapterV1",
  "RealAdaptiveCanaryControlPlaneAdapterV1",
  "RealSyntheticCapabilityRotationAdapterV1",
  "PlaywrightCoreBrowserRuntimeV1",
  "BrowserEvaluateConversationBoundaryV1",
  "createOperationalD2E4HExecutionCeremonyV1",
  "async executeOnce(...args)",
  "validatePreviewTarget",
  "configuration.previewTarget.deployment",
  "target: controlTarget",
  "previewTarget:",
  "D2E4J_REQUIRED_PREVIEW_TARGET_MISSING",
]) {
  if (!source.includes(required)) fail(`REQUIRED_BINDING_MISSING_${required}`);
}

for (const forbidden of [
  /\bmock\w*\b/iu,
  /\b(?:function|const)\s+readyArtifact\b/iu,
  /D2E4G_SHARED_ARTIFACT_VERSION/u,
  /D2E4G_PREVIEW_DEPLOYMENT_ID/u,
  /\.deploy(?:Once|Preview)?\s*\(/u,
  /await\s+[^;]*\.executeOnce\s*\(/u,
  /environment:\s*["'](?:PRODUCTION|STAGING)["']/u,
]) {
  if (forbidden.test(source)) fail("FORBIDDEN_COMPOSITION_SURFACE");
}

for (const key of [
  "releaseRoot",
  "approver",
  "changeId",
  "operationId",
  "policyVersion",
  "reasonCode",
]) {
  if (!source.includes(`"${key}"`)) fail(`REQUIRED_CONFIG_MISSING_${key}`);
}

const preflight = source.indexOf("await compositionPreflight.preflight");
const readyGate = source.indexOf("compositionResult?.COMPOSITION_STATUS !== \"READY\"");
const artifact = source.indexOf(
  "assertD2E4GReadyArtifactV1(compositionResult, deploymentTarget)",
);
const execution = source.indexOf("createOperationalD2E4HExecutionCeremonyV1({");
if (!(preflight >= 0 && preflight < readyGate && readyGate < artifact &&
      artifact < execution)) {
  fail("MANDATORY_SEQUENCE_REJECTED");
}

process.stdout.write("AI_UX_02D2E4J_ARCHITECTURE_GUARD=PASS\n");
