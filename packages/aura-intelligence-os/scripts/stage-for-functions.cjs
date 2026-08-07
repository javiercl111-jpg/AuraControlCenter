"use strict";

const { createHash } = require("node:crypto");
const {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} = require("node:fs");
const { dirname, extname, relative, resolve, sep } = require("node:path");

const DISTRIBUTION_SCHEMA_VERSION = "1";
const packageRoot = resolve(__dirname, "..");
const repositoryRoot = resolve(packageRoot, "..", "..");
const functionsRoot = resolve(repositoryRoot, "functions");
const distRoot = resolve(packageRoot, "dist");
const stagingParent = resolve(functionsRoot, ".generated");
const stagingRoot = resolve(stagingParent, "aura-intelligence-os");
const sourceManifestPath = resolve(packageRoot, "package.json");
const sourceReadmePath = resolve(packageRoot, "README.md");

function fail(message) {
  throw new Error(`Aura Intelligence OS staging failed: ${message}`);
}

function compareLexically(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    fail(`cannot read valid JSON from ${path}`);
  }
}

function assertDirectChild(parent, child, label) {
  if (dirname(child) !== parent) {
    fail(`${label} is outside its authorized parent`);
  }
}

function assertDirectory(path, label) {
  if (!existsSync(path)) {
    fail(`${label} does not exist`);
  }

  const stats = lstatSync(path);
  if (stats.isSymbolicLink() || !stats.isDirectory()) {
    fail(`${label} must be a real directory`);
  }
}

function assertRegularFile(path, label) {
  if (!existsSync(path)) {
    fail(`${label} does not exist`);
  }

  const stats = lstatSync(path);
  if (stats.isSymbolicLink() || !stats.isFile()) {
    fail(`${label} must be a regular file`);
  }
}

function listRegularFiles(root) {
  const files = [];
  const pending = [root];

  while (pending.length > 0) {
    const current = pending.pop();
    if (!current) {
      continue;
    }

    for (const entry of readdirSync(current, { withFileTypes: true }).sort(
      (left, right) => compareLexically(left.name, right.name)
    )) {
      const absolutePath = resolve(current, entry.name);
      const stats = lstatSync(absolutePath);

      if (stats.isSymbolicLink()) {
        fail(`symbolic link is forbidden: ${absolutePath}`);
      }

      if (stats.isDirectory()) {
        pending.push(absolutePath);
      } else if (stats.isFile()) {
        files.push(absolutePath);
      } else {
        fail(`unsupported filesystem entry: ${absolutePath}`);
      }
    }
  }

  return files.sort(compareLexically);
}

function relativeInventory(root, files) {
  return files
    .map((path) => relative(root, path).split(sep).join("/"))
    .sort(compareLexically);
}

function fingerprintFiles(root, inventory) {
  const hash = createHash("sha256");

  for (const file of inventory) {
    hash.update(file);
    hash.update("\0");
    hash.update(readFileSync(resolve(root, file)));
    hash.update("\0");
  }

  return hash.digest("hex");
}

function validateRepositoryBoundary() {
  assertDirectory(repositoryRoot, "repository root");
  assertDirectory(packageRoot, "source package root");
  assertDirectory(functionsRoot, "Functions root");
  assertDirectChild(resolve(repositoryRoot, "packages"), packageRoot, "package root");
  assertDirectChild(functionsRoot, stagingParent, "staging parent");
  assertDirectChild(stagingParent, stagingRoot, "staging root");
  assertRegularFile(
    resolve(repositoryRoot, "src/modules/intelligence/server.ts"),
    "canonical server entrypoint"
  );

  const rootManifest = readJson(resolve(repositoryRoot, "package.json"));
  const functionsManifest = readJson(resolve(functionsRoot, "package.json"));

  if (
    rootManifest.name !== "aura-control-center" ||
    functionsManifest.name !== "functions"
  ) {
    fail("repository identity does not match the expected project");
  }
}

function validateSourceManifest() {
  assertRegularFile(sourceManifestPath, "source package manifest");
  assertRegularFile(sourceReadmePath, "source package README");

  const manifest = readJson(sourceManifestPath);
  const expectedExports = {
    "./server": {
      types: "./dist/server.d.ts",
      import: "./dist/server.js",
      require: "./dist/server.js",
    },
  };

  if (
    manifest.name !== "@aura/intelligence-os" ||
    manifest.version !== "0.0.0-internal" ||
    manifest.private !== true ||
    manifest.type !== "commonjs" ||
    manifest.engines?.node !== "20" ||
    manifest.sideEffects !== false ||
    manifest.main !== "./dist/server.js" ||
    manifest.types !== "./dist/server.d.ts" ||
    JSON.stringify(manifest.exports) !== JSON.stringify(expectedExports)
  ) {
    fail("source package manifest violates the certified contract");
  }

  return manifest;
}

function validateDist() {
  assertDirectory(distRoot, "built dist");
  const files = listRegularFiles(distRoot);
  const inventory = relativeInventory(distRoot, files);

  if (
    !inventory.includes("server.js") ||
    !inventory.includes("server.d.ts") ||
    inventory.length === 0
  ) {
    fail("built dist is incomplete");
  }

  for (const file of inventory) {
    if (!file.endsWith(".js") && !file.endsWith(".d.ts")) {
      fail(`dist contains a forbidden file type: ${file}`);
    }

    if (
      /(?:^|\/)(?:__tests__|tests?|components?|pages?|ui)(?:\/|$)/i.test(
        file
      ) ||
      /(?:^|\/)(?:core|engine|discovery|firebase)(?:\/|$)/i.test(file)
    ) {
      fail(`dist contains a forbidden path: ${file}`);
    }
  }

  return {
    inventory,
    fingerprint: fingerprintFiles(distRoot, inventory),
  };
}

function assertStagingHasNoSymlinks() {
  if (!existsSync(stagingRoot)) {
    return;
  }

  const stats = lstatSync(stagingRoot);
  if (stats.isSymbolicLink() || !stats.isDirectory()) {
    fail("existing staging root is not a real directory");
  }

  listRegularFiles(stagingRoot);
}

function copyDist(inventory) {
  for (const file of inventory) {
    const source = resolve(distRoot, file);
    const destination = resolve(stagingRoot, "dist", file);
    const authorizedDistRoot = resolve(stagingRoot, "dist");
    const relativeDestination = relative(authorizedDistRoot, destination);

    if (
      relativeDestination === ".." ||
      relativeDestination.startsWith(`..${sep}`)
    ) {
      fail(`dist destination escapes staging: ${file}`);
    }

    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(source, destination);
  }
}

function createStagedManifest(sourceManifest, distContract) {
  return {
    name: sourceManifest.name,
    version: sourceManifest.version,
    private: true,
    type: sourceManifest.type,
    engines: {
      node: sourceManifest.engines.node,
    },
    sideEffects: false,
    main: sourceManifest.main,
    types: sourceManifest.types,
    exports: sourceManifest.exports,
    files: ["dist", "README.md"],
    auraDistribution: {
      schemaVersion: DISTRIBUTION_SCHEMA_VERSION,
      distFileCount: distContract.inventory.length,
      distSha256: distContract.fingerprint,
    },
  };
}

function validateStagedArtifact(expectedDistContract) {
  const files = listRegularFiles(stagingRoot);
  const inventory = relativeInventory(stagingRoot, files);
  const expectedInventory = [
    "README.md",
    "package.json",
    ...expectedDistContract.inventory.map((file) => `dist/${file}`),
  ].sort(compareLexically);

  if (JSON.stringify(inventory) !== JSON.stringify(expectedInventory)) {
    fail("staged inventory differs from the authorized allowlist");
  }

  const stagedDistRoot = resolve(stagingRoot, "dist");
  const stagedDistFiles = listRegularFiles(stagedDistRoot);
  const stagedDistInventory = relativeInventory(
    stagedDistRoot,
    stagedDistFiles
  );
  const stagedFingerprint = fingerprintFiles(
    stagedDistRoot,
    stagedDistInventory
  );

  if (
    JSON.stringify(stagedDistInventory) !==
      JSON.stringify(expectedDistContract.inventory) ||
    stagedFingerprint !== expectedDistContract.fingerprint
  ) {
    fail("staged dist differs from the canonical build");
  }
}

function stageForFunctions() {
  validateRepositoryBoundary();
  const sourceManifest = validateSourceManifest();
  const distContract = validateDist();

  if (existsSync(stagingParent)) {
    const stats = lstatSync(stagingParent);
    if (stats.isSymbolicLink() || !stats.isDirectory()) {
      fail("staging parent must be a real directory");
    }
  } else {
    mkdirSync(stagingParent, { recursive: false });
  }

  assertStagingHasNoSymlinks();
  rmSync(stagingRoot, { recursive: true, force: true });
  mkdirSync(stagingRoot, { recursive: false });

  copyDist(distContract.inventory);
  copyFileSync(sourceReadmePath, resolve(stagingRoot, "README.md"));
  writeFileSync(
    resolve(stagingRoot, "package.json"),
    `${JSON.stringify(
      createStagedManifest(sourceManifest, distContract),
      null,
      2
    )}\n`,
    "utf8"
  );

  validateStagedArtifact(distContract);
}

if (require.main === module) {
  stageForFunctions();
}

module.exports = {
  stageForFunctions,
};
