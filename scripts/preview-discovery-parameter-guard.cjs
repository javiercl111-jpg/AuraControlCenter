"use strict";

const path = require("node:path");

const EXACT_PROJECT_ENV_PATH = "functions/.env.aura-intel-preview";
const CONTROLLED_PARAMETER_NAMES = Object.freeze([
  "AURA_RUNTIME_ENVIRONMENT",
  "DISCOVERY_SHADOW_EVALUATION",
  "DISCOVERY_PRIMARY_EVALUATION",
  "EXECUTIVE_DISCOVERY_TIMEOUT_MS",
  "EXECUTIVE_DISCOVERY_ENDPOINT",
]);

function fail(code) {
  throw new Error(code);
}

function normalized(relativePath) {
  return relativePath.split(path.sep).join("/");
}

function parseEnvironment(content) {
  const values = Object.create(null);
  const activeLines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));

  for (const line of activeLines) {
    const match = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line);
    if (!match) fail("PREVIEW_PARAMETER_INVALID_ENV_LINE");
    const [, key, value] = match;
    if (Object.prototype.hasOwnProperty.call(values, key)) {
      fail(`PREVIEW_PARAMETER_DUPLICATE:${key}`);
    }
    values[key] = value;
  }

  return values;
}

function assertNoControlledParameters(relativePath, content) {
  const values = parseEnvironment(content);
  const controlled = CONTROLLED_PARAMETER_NAMES.filter((name) =>
    Object.prototype.hasOwnProperty.call(values, name));
  if (controlled.length === 0) return;
  if (normalized(relativePath) === "functions/.env") {
    fail("PREVIEW_PARAMETER_GLOBAL_ENV_FORBIDDEN");
  }
  fail(`PREVIEW_PARAMETER_NON_PREVIEW_ENV_FORBIDDEN:${normalized(relativePath)}`);
}

function required(values, name, missingCode) {
  if (!Object.prototype.hasOwnProperty.call(values, name)) fail(missingCode);
  return values[name];
}

function assertPreviewParameterConfiguration({
  projectEnvPath,
  projectEnvContent,
  otherEnvironmentFiles = {},
}) {
  if (normalized(projectEnvPath) !== EXACT_PROJECT_ENV_PATH) {
    fail("PREVIEW_PARAMETER_PROJECT_ENV_PATH_MISMATCH");
  }

  for (const [relativePath, content] of Object.entries(otherEnvironmentFiles)) {
    assertNoControlledParameters(relativePath, content);
  }

  const values = parseEnvironment(projectEnvContent);
  const unknown = Object.keys(values).filter(
    (name) => !CONTROLLED_PARAMETER_NAMES.includes(name));
  if (unknown.length > 0) fail(`PREVIEW_PARAMETER_UNEXPECTED:${unknown[0]}`);

  const environment = required(
    values,
    "AURA_RUNTIME_ENVIRONMENT",
    "PREVIEW_PARAMETER_RUNTIME_ENVIRONMENT_MISSING",
  );
  if (environment !== "PREVIEW") {
    fail("PREVIEW_PARAMETER_RUNTIME_ENVIRONMENT_MISMATCH");
  }

  const shadow = required(
    values,
    "DISCOVERY_SHADOW_EVALUATION",
    "PREVIEW_PARAMETER_SHADOW_MISSING",
  );
  if (shadow !== "false") fail("PREVIEW_PARAMETER_SHADOW_MUST_BE_FALSE");

  const primary = required(
    values,
    "DISCOVERY_PRIMARY_EVALUATION",
    "PREVIEW_PARAMETER_PRIMARY_MISSING",
  );
  if (primary !== "false") fail("PREVIEW_PARAMETER_PRIMARY_MUST_BE_FALSE");

  const timeout = required(
    values,
    "EXECUTIVE_DISCOVERY_TIMEOUT_MS",
    "PREVIEW_PARAMETER_TIMEOUT_MISSING",
  );
  if (!/^\d+$/.test(timeout)) fail("PREVIEW_PARAMETER_TIMEOUT_INVALID");
  if (timeout !== "10000") fail("PREVIEW_PARAMETER_TIMEOUT_MISMATCH");

  const endpoint = required(
    values,
    "EXECUTIVE_DISCOVERY_ENDPOINT",
    "PREVIEW_PARAMETER_ENDPOINT_MISSING",
  );
  if (/controlcenter\.auranexus\.io|intelligence\.auranexus\.io/i.test(endpoint)) {
    fail("PREVIEW_PARAMETER_PRODUCTION_ENDPOINT_FORBIDDEN");
  }
  if (endpoint !== "") fail("PREVIEW_PARAMETER_ENDPOINT_MUST_BE_EMPTY");

  return Object.freeze({
    AURA_RUNTIME_ENVIRONMENT: environment,
    DISCOVERY_SHADOW_EVALUATION: false,
    DISCOVERY_PRIMARY_EVALUATION: false,
    EXECUTIVE_DISCOVERY_TIMEOUT_MS: 10_000,
    EXECUTIVE_DISCOVERY_ENDPOINT: "",
    remoteEndpointAuthorized: false,
  });
}

module.exports = {
  CONTROLLED_PARAMETER_NAMES,
  EXACT_PROJECT_ENV_PATH,
  assertPreviewParameterConfiguration,
  parseEnvironment,
};
