import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    fileParallelism: false,
    include: [
      "functions/tests/emulator/rateLimits/**/*.test.ts",
    ],
    testTimeout: 120_000,
    hookTimeout: 30_000,
  },
});
