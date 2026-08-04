import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "functions/tests/emulator/containment/firestoreContainmentEmulator.test.ts",
    ],
    pool: "forks",
    fileParallelism: false,
    testTimeout: 180_000,
    hookTimeout: 30_000,
  },
});

