import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "functions/tests/publicIntakeAbuseCertification/" +
        "publicIntakeAbuseCertification.test.ts",
    ],
    environment: "node",
    pool: "forks",
    fileParallelism: false,
    testTimeout: 180_000,
    hookTimeout: 30_000,
  },
});

