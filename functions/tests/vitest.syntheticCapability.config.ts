import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["functions/tests/syntheticDiscoveryCapabilityIssuer.test.ts"],
  },
});
