"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  assertPreviewParameterConfiguration,
} = require("../preview-discovery-parameter-guard.cjs");

const repositoryRoot = path.resolve(__dirname, "..", "..");
const exactPath = "functions/.env.aura-intel-preview";
const valid = [
  "AURA_RUNTIME_ENVIRONMENT=PREVIEW",
  "DISCOVERY_SHADOW_EVALUATION=false",
  "DISCOVERY_PRIMARY_EVALUATION=false",
  "EXECUTIVE_DISCOVERY_TIMEOUT_MS=10000",
  "EXECUTIVE_DISCOVERY_ENDPOINT=",
].join("\n");

function candidate(content = valid, overrides = {}) {
  return {
    projectEnvPath: exactPath,
    projectEnvContent: content,
    otherEnvironmentFiles: {},
    ...overrides,
  };
}

function replace(name, value) {
  return valid.replace(new RegExp(`^${name}=.*$`, "m"), `${name}=${value}`);
}

function remove(name) {
  return valid.split("\n").filter((line) => !line.startsWith(`${name}=`)).join("\n");
}

test("accepts the exact fail-closed Preview parameter configuration", () => {
  assert.deepEqual(assertPreviewParameterConfiguration(candidate()), {
    AURA_RUNTIME_ENVIRONMENT: "PREVIEW",
    DISCOVERY_SHADOW_EVALUATION: false,
    DISCOVERY_PRIMARY_EVALUATION: false,
    EXECUTIVE_DISCOVERY_TIMEOUT_MS: 10000,
    EXECUTIVE_DISCOVERY_ENDPOINT: "",
    remoteEndpointAuthorized: false,
  });
});

test("rejects shadow activation", () => assert.throws(
  () => assertPreviewParameterConfiguration(candidate(replace("DISCOVERY_SHADOW_EVALUATION", "true"))),
  /PREVIEW_PARAMETER_SHADOW_MUST_BE_FALSE/,
));

test("rejects primary activation", () => assert.throws(
  () => assertPreviewParameterConfiguration(candidate(replace("DISCOVERY_PRIMARY_EVALUATION", "true"))),
  /PREVIEW_PARAMETER_PRIMARY_MUST_BE_FALSE/,
));

test("rejects the Control Center Production endpoint", () => assert.throws(
  () => assertPreviewParameterConfiguration(candidate(replace(
    "EXECUTIVE_DISCOVERY_ENDPOINT",
    "https://controlcenter.auranexus.io/evaluate",
  ))),
  /PREVIEW_PARAMETER_PRODUCTION_ENDPOINT_FORBIDDEN/,
));

test("rejects the Intelligence Production endpoint", () => assert.throws(
  () => assertPreviewParameterConfiguration(candidate(replace(
    "EXECUTIVE_DISCOVERY_ENDPOINT",
    "https://intelligence.auranexus.io/evaluate",
  ))),
  /PREVIEW_PARAMETER_PRODUCTION_ENDPOINT_FORBIDDEN/,
));

test("rejects a missing timeout", () => assert.throws(
  () => assertPreviewParameterConfiguration(candidate(remove("EXECUTIVE_DISCOVERY_TIMEOUT_MS"))),
  /PREVIEW_PARAMETER_TIMEOUT_MISSING/,
));

test("rejects a non-numeric timeout", () => assert.throws(
  () => assertPreviewParameterConfiguration(candidate(replace("EXECUTIVE_DISCOVERY_TIMEOUT_MS", "ten-seconds"))),
  /PREVIEW_PARAMETER_TIMEOUT_INVALID/,
));

test("rejects a timeout other than 10000", () => assert.throws(
  () => assertPreviewParameterConfiguration(candidate(replace("EXECUTIVE_DISCOVERY_TIMEOUT_MS", "9000"))),
  /PREVIEW_PARAMETER_TIMEOUT_MISMATCH/,
));

test("rejects a missing Preview environment", () => assert.throws(
  () => assertPreviewParameterConfiguration(candidate(remove("AURA_RUNTIME_ENVIRONMENT"))),
  /PREVIEW_PARAMETER_RUNTIME_ENVIRONMENT_MISSING/,
));

test("rejects a project-specific file for a different project", () => assert.throws(
  () => assertPreviewParameterConfiguration(candidate(valid, {
    projectEnvPath: "functions/.env.aura-intel-staging",
  })),
  /PREVIEW_PARAMETER_PROJECT_ENV_PATH_MISMATCH/,
));

test("rejects a duplicated parameter", () => assert.throws(
  () => assertPreviewParameterConfiguration(candidate(`${valid}\nDISCOVERY_SHADOW_EVALUATION=false`)),
  /PREVIEW_PARAMETER_DUPLICATE:DISCOVERY_SHADOW_EVALUATION/,
));

test("rejects controlled configuration in the global Functions env", () => assert.throws(
  () => assertPreviewParameterConfiguration(candidate(valid, {
    otherEnvironmentFiles: { "functions/.env": "DISCOVERY_SHADOW_EVALUATION=false" },
  })),
  /PREVIEW_PARAMETER_GLOBAL_ENV_FORBIDDEN/,
));

test("rejects controlled configuration directed to Staging or Production", () => {
  for (const foreignPath of [
    "functions/.env.aura-intel-staging",
    "functions/.env.aura-control-center-debb3",
  ]) {
    assert.throws(
      () => assertPreviewParameterConfiguration(candidate(valid, {
        otherEnvironmentFiles: { [foreignPath]: "DISCOVERY_PRIMARY_EVALUATION=false" },
      })),
      /PREVIEW_PARAMETER_NON_PREVIEW_ENV_FORBIDDEN/,
    );
  }
});

test("rejects a generic invented endpoint", () => assert.throws(
  () => assertPreviewParameterConfiguration(candidate(replace(
    "EXECUTIVE_DISCOVERY_ENDPOINT",
    "https://invented-preview.example.test/evaluate",
  ))),
  /PREVIEW_PARAMETER_ENDPOINT_MUST_BE_EMPTY/,
));

test("keeps remote integration unreachable while shadow is disabled", () => {
  const shadowSource = fs.readFileSync(path.join(
    repositoryRoot,
    "functions/src/discovery/executive-intelligence/integration/DiscoveryShadowEvaluation.ts",
  ), "utf8");
  const completionSource = fs.readFileSync(path.join(
    repositoryRoot,
    "functions/src/discovery/completeDiscoverySession.ts",
  ), "utf8");
  assert.ok(shadowSource.indexOf("if (!options.flags.shadowEvaluation)") >= 0);
  assert.ok(
    shadowSource.indexOf("if (!options.flags.shadowEvaluation)") <
    shadowSource.indexOf("const adapter = options.adapterFactory()"),
  );
  assert.match(shadowSource, /SKIPPED_DISABLED/);
  assert.doesNotMatch(completionSource, /HttpExecutiveDiscoveryApiClient|DevelopmentExecutiveDiscoveryRequestSigner/);
  assert.match(completionSource, /authentication is not configured/);
});
