import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "functions/tests/emulator/idempotency/firestoreIdempotencyEmulator.test.ts",
    ],
    pool: "forks",
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
