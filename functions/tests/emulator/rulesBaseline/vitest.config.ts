import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    fileParallelism: false,
    include: [
      "functions/tests/emulator/rulesBaseline/**/*.test.ts",
    ],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
