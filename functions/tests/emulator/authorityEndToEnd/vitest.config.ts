import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@aura/intelligence-os/server": path.resolve(
        currentDirectory,
        "..",
        "..",
        "..",
        ".generated",
        "aura-intelligence-os",
        "dist",
        "server.js",
      ),
    },
  },
  test: {
    environment: "node",
    fileParallelism: false,
    include: [
      "functions/tests/emulator/authorityEndToEnd/**/*.test.ts",
    ],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
