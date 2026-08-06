"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  APPROVED_DOMAINS,
  CHANGE_ID,
  ENVIRONMENT,
  PROJECT_ID,
  assertInvocation,
  configSummary,
  fingerprintLocator,
  locator,
  maskedEmail,
  parseArguments,
} = require("../preview-synthetic-authority-provisioning.cjs");

test("accepts audit mode only for the exact Preview target", () => {
  assert.doesNotThrow(() => assertInvocation({
    apply: false,
    project: PROJECT_ID,
    environment: ENVIRONMENT,
  }));
});

test("rejects a different project", () => {
  assert.throws(() => assertInvocation({
    apply: false,
    project: "wrong-project",
    environment: ENVIRONMENT,
  }), /TARGET_GUARD_REJECTED/u);
});

test("rejects a different environment", () => {
  assert.throws(() => assertInvocation({
    apply: false,
    project: PROJECT_ID,
    environment: "STAGING",
  }), /TARGET_GUARD_REJECTED/u);
});

test("requires the exact Change ID for apply", () => {
  assert.throws(() => assertInvocation({
    apply: true,
    project: PROJECT_ID,
    environment: ENVIRONMENT,
    changeId: "wrong-change",
  }), /CHANGE_ID_GUARD_REJECTED/u);
  assert.doesNotThrow(() => assertInvocation({
    apply: true,
    project: PROJECT_ID,
    environment: ENVIRONMENT,
    changeId: CHANGE_ID,
  }));
});

test("parses the closed apply invocation", () => {
  assert.deepEqual(parseArguments([
    "--apply",
    `--project=${PROJECT_ID}`,
    `--environment=${ENVIRONMENT}`,
    `--confirm-change-id=${CHANGE_ID}`,
  ]), {
    apply: true,
    project: PROJECT_ID,
    environment: ENVIRONMENT,
    changeId: CHANGE_ID,
  });
});

test("accepts only the four approved Preview domains", () => {
  const result = configSummary({
    signIn: {
      email: { enabled: true, passwordRequired: true },
      anonymous: { enabled: false },
    },
    authorizedDomains: APPROVED_DOMAINS,
  }, 0);
  assert.equal(result.approvedDomainsPresent, true);
  assert.equal(result.prohibitedDomainPresent, false);
});

test("rejects the exact Production and Staging domains", () => {
  for (const domain of [
    "controlcenter.auranexus.io",
    "aura-control-center-debb3",
    "aura-intel-staging",
  ]) {
    const result = configSummary({ authorizedDomains: [...APPROVED_DOMAINS, domain] }, 0);
    assert.equal(result.prohibitedDomainPresent, true);
  }
});

test("sanitizes identity and fingerprint locators", () => {
  const uid = "synthetic-complete-uid-value";
  const email = "synthetic.preview@example.invalid";
  const fingerprint = `sha256:${"a".repeat(64)}`;
  assert.equal(locator(uid), "synthe...alue");
  assert.equal(maskedEmail(email), "sy***@ex***.invalid");
  assert.equal(fingerprintLocator(fingerprint), "sha256:aaaaaaaaaa...aaaaaaaa");
  assert.equal(locator(uid).includes(uid), false);
  assert.equal(maskedEmail(email).includes(email), false);
  assert.equal(fingerprintLocator(fingerprint).includes(fingerprint), false);
});
