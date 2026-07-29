"use strict";

const { rmSync } = require("node:fs");
const { dirname, resolve } = require("node:path");

const packageRoot = resolve(__dirname, "..");
const distDirectory = resolve(packageRoot, "dist");

if (dirname(distDirectory) !== packageRoot) {
  throw new Error("Refusing to clean outside the package boundary");
}

rmSync(distDirectory, { recursive: true, force: true });
