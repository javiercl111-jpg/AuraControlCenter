"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  REQUIRED_BRANCH,
  REQUIRED_PROJECT,
  classifyDirtyState,
  validateAuthorization,
} = require("../preview-rules-target-guard.cjs");

function validInput() {
  return {
    mode: "dry-run",
    alias: "preview",
    project: REQUIRED_PROJECT,
    environment: "preview",
    changeId: "AI-02H1E.5.R2B-PREVIEW-RULES-20260804-01",
    approvalMarker: "SECURITY_OWNER_APPROVED",
    actor: "RELEASE_IMPLEMENTER",
    productionHold: "REMEDIATION_HOLD",
    confirm: "PREVIEW_RULES_ONLY",
  };
}

function validContext() {
  return {
    branch: REQUIRED_BRANCH,
    nodeVersion: "v20.20.2",
    npmVersion: "10.8.2",
    aliases: {
      preview: "aura-intel-preview",
      staging: "aura-intel-staging",
      production: "aura-control-center-debb3",
    },
    staged: [],
    unexpected: [],
  };
}

function denied(mutator, code) {
  const input = validInput();
  const context = validContext();
  mutator(input, context);
  assert.throws(
    () => validateAuthorization(input, context),
    new RegExp(`TARGETING_GUARD_DENIED:${code}`),
  );
}

test("authorizes only the exact Preview Rules contract", () => {
  assert.equal(
    validateAuthorization(validInput(), validContext()).authorization,
    "AUTHORIZED_FOR_PREVIEW_RULES_ONLY",
  );
});

test("preserves the porcelain distinction between unstaged and staged changes", () => {
  assert.deepEqual(
    classifyDirtyState(" M firestore.rules\n?? scripts/preview-rules-target-guard.cjs"),
    { unexpected: [], staged: [] },
  );
  assert.deepEqual(
    classifyDirtyState("M  firestore.rules"),
    { unexpected: [], staged: ["firestore.rules"] },
  );
});

test("rejects default", () => denied((input) => { input.alias = "default"; }, "DEFAULT_ALIAS"));
test("rejects staging", () => denied((input) => { input.alias = "staging"; }, "ALIAS"));
test("rejects production", () => denied((input) => { input.project = "aura-control-center-debb3"; }, "PRODUCTION_TARGET"));
test("rejects an empty target", () => denied((input) => { input.project = ""; }, "EMPTY_PROJECT"));
test("rejects a project mismatch", () => denied((input) => { input.project = "aura-intel-preview-typo"; }, "PROJECT"));
test("rejects an invalid branch", () => denied((_input, context) => { context.branch = "main"; }, "BRANCH"));
test("rejects a missing Change ID", () => denied((input) => { input.changeId = ""; }, "CHANGE_ID"));
test("rejects a missing approval marker", () => denied((input) => { input.approvalMarker = ""; }, "APPROVAL_MARKER"));
test("rejects an altered Production hold", () => denied((input) => { input.productionHold = "OFF"; }, "PRODUCTION_HOLD"));
test("rejects missing actor confirmation", () => denied((input) => { input.confirm = ""; }, "ACTOR_CONFIRMATION"));
test("rejects staged changes", () => denied((_input, context) => { context.staged = ["firestore.rules"]; }, "STAGED_CHANGES"));
test("rejects unrelated worktree changes", () => denied((_input, context) => { context.unexpected = ["functions/src/index.ts"]; }, "UNEXPECTED_WORKTREE_CHANGE"));
test("rejects a default mapping in local aliases", () => denied((_input, context) => { context.aliases.default = "aura-control-center-debb3"; }, "DEFAULT_ALIAS_PRESENT"));
