"use strict";

const { createHash } = require("node:crypto");
const { existsSync, readFileSync } = require("node:fs");
const { dirname, join, relative, resolve } = require("node:path");
const { spawnSync } = require("node:child_process");

const REPOSITORY_ROOT = resolve(__dirname, "..");
const REQUIRED_BRANCH = "security/intelligence-preview-rules-targeting";
const REQUIRED_PROJECT = "aura-intel-preview";
const REQUIRED_CHANGE_ID =
  "AI-02H1E.5.R2B-PREVIEW-RULES-20260804-01";
const REQUIRED_NODE = "v20.20.2";
const REQUIRED_NPM = "10.8.2";
const REQUIRED_APPROVAL = "SECURITY_OWNER_APPROVED";
const REQUIRED_ACTOR = "RELEASE_IMPLEMENTER";
const REQUIRED_HOLD = "REMEDIATION_HOLD";
const REQUIRED_CONFIRMATION = "PREVIEW_RULES_ONLY";

const ALLOWED_DIRTY_FILES = new Set([
  ".firebaserc",
  "firestore.rules",
  "package.json",
  "scripts/preview-rules-target-guard.cjs",
  "scripts/tests/preview-rules-target-guard.test.cjs",
  "functions/tests/emulator/runPreviewRulesEmulator.cjs",
  "functions/tests/emulator/rulesBaseline/firestorePreviewRulesBaseline.test.ts",
  "functions/tests/emulator/rulesBaseline/vitest.config.ts",
]);
const ALLOWED_DIRTY_PREFIXES = [
  "docs/security/discovery/production-remediation/security-baseline/execution/",
];

const ARTIFACT_FILES = [
  ".firebaserc",
  "firestore.rules",
  "package.json",
  "scripts/preview-rules-target-guard.cjs",
  "scripts/tests/preview-rules-target-guard.test.cjs",
  "functions/tests/emulator/runPreviewRulesEmulator.cjs",
  "functions/tests/emulator/rulesBaseline/firestorePreviewRulesBaseline.test.ts",
  "functions/tests/emulator/rulesBaseline/vitest.config.ts",
];

function denied(code) {
  throw new Error(`TARGETING_GUARD_DENIED:${code}`);
}

function normalizePath(value) {
  return value.replaceAll("\\", "/");
}

function parseArguments(values) {
  const parsed = {};
  for (const value of values) {
    if (!value.startsWith("--") || !value.includes("=")) {
      denied("INVALID_ARGUMENT");
    }
    const separator = value.indexOf("=");
    const key = value.slice(2, separator);
    const argumentValue = value.slice(separator + 1);
    if (!key || Object.hasOwn(parsed, key)) denied("INVALID_ARGUMENT");
    parsed[key] = argumentValue;
  }
  return parsed;
}

function git(args) {
  const result = spawnSync("git", args, {
    cwd: REPOSITORY_ROOT,
    encoding: "utf8",
    shell: false,
  });
  if (result.status !== 0) denied("GIT_PROBE_FAILED");
  return result.stdout.trimEnd();
}

function npmVersion() {
  const npmExecutable = join(dirname(process.execPath),
    process.platform === "win32" ? "npm.cmd" : "npm");
  const result = spawnSync(npmExecutable, ["--version"], {
    cwd: REPOSITORY_ROOT,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) denied("NPM_PROBE_FAILED");
  return result.stdout.trim();
}

function classifyDirtyState(output) {
  if (!output) return Object.freeze({ unexpected: [], staged: [] });
  const unexpected = [];
  const staged = [];
  for (const line of output.split(/\r?\n/u)) {
    const indexState = line[0];
    const worktreeState = line[1];
    let file = normalizePath(line.slice(3));
    if (file.includes(" -> ")) file = file.split(" -> ").at(-1);
    if (indexState !== " " && indexState !== "?") staged.push(file);
    const allowed = ALLOWED_DIRTY_FILES.has(file) ||
      ALLOWED_DIRTY_PREFIXES.some((prefix) => file.startsWith(prefix));
    if (!allowed || (!worktreeState && indexState !== "?")) unexpected.push(file);
  }
  return Object.freeze({ unexpected, staged });
}

function dirtyState() {
  return classifyDirtyState(
    git(["status", "--porcelain=v1", "--untracked-files=all"]),
  );
}

function readAliases() {
  const parsed = JSON.parse(readFileSync(join(REPOSITORY_ROOT, ".firebaserc"), "utf8"));
  return parsed.projects ?? {};
}

function sha256File(file) {
  return createHash("sha256")
    .update(readFileSync(join(REPOSITORY_ROOT, file)))
    .digest("hex");
}

function artifactHash() {
  const hash = createHash("sha256");
  for (const file of [...ARTIFACT_FILES].sort()) {
    if (!existsSync(join(REPOSITORY_ROOT, file))) denied("ARTIFACT_FILE_MISSING");
    hash.update(file, "utf8");
    hash.update("\0", "utf8");
    hash.update(readFileSync(join(REPOSITORY_ROOT, file)));
    hash.update("\0", "utf8");
  }
  return hash.digest("hex");
}

function validateAuthorization(input, context) {
  if (input.mode !== "dry-run" && input.mode !== "deploy") denied("MODE");
  if (input.alias === "default") denied("DEFAULT_ALIAS");
  if (input.alias !== "preview") denied("ALIAS");
  if (input.environment !== "preview") denied("ENVIRONMENT");
  if (!input.project) denied("EMPTY_PROJECT");
  if (input.project.includes("staging")) denied("STAGING_TARGET");
  if (input.project === "aura-control-center-debb3") denied("PRODUCTION_TARGET");
  if (input.project !== REQUIRED_PROJECT) denied("PROJECT");
  if (context.branch !== REQUIRED_BRANCH) denied("BRANCH");
  if (input.changeId !== REQUIRED_CHANGE_ID) denied("CHANGE_ID");
  if (input.approvalMarker !== REQUIRED_APPROVAL) denied("APPROVAL_MARKER");
  if (input.actor !== REQUIRED_ACTOR) denied("ACTOR");
  if (input.productionHold !== REQUIRED_HOLD) denied("PRODUCTION_HOLD");
  if (input.confirm !== REQUIRED_CONFIRMATION) denied("ACTOR_CONFIRMATION");
  if (context.nodeVersion !== REQUIRED_NODE) denied("NODE_VERSION");
  if (context.npmVersion !== REQUIRED_NPM) denied("NPM_VERSION");
  if (context.aliases.default !== undefined) denied("DEFAULT_ALIAS_PRESENT");
  if (context.aliases.preview !== REQUIRED_PROJECT ||
      context.aliases.staging !== "aura-intel-staging" ||
      context.aliases.production !== "aura-control-center-debb3") {
    denied("ALIAS_MAPPING");
  }
  if (context.staged.length > 0) denied("STAGED_CHANGES");
  if (context.unexpected.length > 0) denied("UNEXPECTED_WORKTREE_CHANGE");
  return Object.freeze({
    authorization: "AUTHORIZED_FOR_PREVIEW_RULES_ONLY",
    mode: input.mode,
    environment: input.environment,
    alias: input.alias,
    projectId: input.project,
    branch: context.branch,
    changeId: input.changeId,
    actorRole: input.actor,
    approverRole: "SECURITY_OWNER",
    productionHold: input.productionHold,
  });
}

function cliContext() {
  const state = dirtyState();
  return Object.freeze({
    branch: git(["branch", "--show-current"]),
    nodeVersion: process.version,
    npmVersion: npmVersion(),
    aliases: readAliases(),
    unexpected: state.unexpected,
    staged: state.staged,
  });
}

function main() {
  const args = parseArguments(process.argv.slice(2));
  const input = {
    mode: args.mode,
    alias: args.alias,
    project: args.project,
    environment: args.environment,
    changeId: args["change-id"],
    approvalMarker: args["approval-marker"],
    actor: args.actor,
    productionHold: args["production-hold"],
    confirm: args.confirm,
  };
  const result = validateAuthorization(input, cliContext());
  const evidence = {
    ...result,
    rulesHash: sha256File("firestore.rules"),
    artifactHash: artifactHash(),
    worktreePolicy: "ALLOWLISTED_R2B_UNSTAGED_ONLY",
  };
  process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
  process.stdout.write("AUTHORIZED_FOR_PREVIEW_RULES_ONLY\n");
}

module.exports = Object.freeze({
  REQUIRED_BRANCH,
  REQUIRED_PROJECT,
  classifyDirtyState,
  validateAuthorization,
});

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : "TARGETING_GUARD_DENIED:UNKNOWN"}\n`);
    process.exitCode = 1;
  }
}
