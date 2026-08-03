import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "functions/tests/emulator/capabilities/firestoreCapabilityEmulator.test.ts",
    ],
    pool: "forks",
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 30_000,
  },
});
