import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({
  resolve: {
    alias: {
      "@aura/intelligence-os/server": path.resolve(currentDirectory, "..", ".generated", "aura-intelligence-os", "dist", "server.js"),
    },
  },
  test: { environment: "node", include: ["functions/tests/authorityProvisioningAdapter.test.ts"] },
});
