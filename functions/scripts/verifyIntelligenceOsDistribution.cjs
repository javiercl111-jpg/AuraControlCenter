"use strict";

const { createHash } = require("node:crypto");
const {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
} = require("node:fs");
const { relative, resolve, sep } = require("node:path");

const functionsRoot = resolve(__dirname, "..");
const stagingRoot = resolve(
  functionsRoot,
  ".generated",
  "aura-intelligence-os"
);
const stagedDistRoot = resolve(stagingRoot, "dist");

function fail(message) {
  throw new Error(
    `Aura Intelligence OS distribution verification failed: ${message}`
  );
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

function listRegularFiles(root) {
  if (!existsSync(root)) {
    fail(`required directory does not exist: ${root}`);
  }

  const rootStats = lstatSync(root);
  if (rootStats.isSymbolicLink() || !rootStats.isDirectory()) {
    fail(`required path is not a real directory: ${root}`);
  }

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

function verifyManifest(manifest) {
  const expectedExports = {
    "./server": {
      types: "./dist/server.d.ts",
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
    JSON.stringify(manifest.exports) !== JSON.stringify(expectedExports) ||
    JSON.stringify(manifest.files) !==
      JSON.stringify(["dist", "README.md"]) ||
    manifest.scripts !== undefined ||
    manifest.dependencies !== undefined ||
    manifest.devDependencies !== undefined ||
    manifest.auraDistribution?.schemaVersion !== "1"
  ) {
    fail("staged package manifest violates the distribution contract");
  }
}

function verifyIntelligenceOsDistribution() {
  const stagingFiles = listRegularFiles(stagingRoot);
  const stagingInventory = relativeInventory(stagingRoot, stagingFiles);

  const manifest = readJson(resolve(stagingRoot, "package.json"));
  verifyManifest(manifest);

  const distFiles = listRegularFiles(stagedDistRoot);
  const distInventory = relativeInventory(stagedDistRoot, distFiles);
  const expectedStagingInventory = [
    "README.md",
    "package.json",
    ...distInventory.map((file) => `dist/${file}`),
  ].sort(compareLexically);

  if (
    JSON.stringify(stagingInventory) !==
      JSON.stringify(expectedStagingInventory) ||
    !distInventory.includes("server.js") ||
    !distInventory.includes("server.d.ts") ||
    distInventory.some(
      (file) =>
        (!file.endsWith(".js") && !file.endsWith(".d.ts")) ||
        /(?:^|\/)(?:__tests__|tests?|components?|pages?|ui)(?:\/|$)/i.test(
          file
        ) ||
        /(?:^|\/)(?:core|engine|discovery|firebase)(?:\/|$)/i.test(file)
    ) ||
    distInventory.length !== manifest.auraDistribution.distFileCount ||
    fingerprintFiles(stagedDistRoot, distInventory) !==
      manifest.auraDistribution.distSha256
  ) {
    fail("staged dist violates its declared content contract");
  }
}

verifyIntelligenceOsDistribution();
