import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["functions/tests/crmLeadCreate/**/*.test.ts"],
  },
});
