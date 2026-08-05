import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "functions/tests/runtimeContracts/previewRuntimeContracts.test.ts",
    ],
    environment: "node",
    pool: "forks",
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
