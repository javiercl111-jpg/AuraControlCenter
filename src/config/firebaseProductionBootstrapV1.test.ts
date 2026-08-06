import { afterAll, describe, expect, it, vi } from "vitest";

const productionVariables = Object.freeze({
  VITE_AURA_RUNTIME_ENVIRONMENT: "PRODUCTION",
  VITE_FIREBASE_API_KEY: "AIza-production-public-metadata",
  VITE_FIREBASE_AUTH_DOMAIN: "aura-control-center-debb3.firebaseapp.com",
  VITE_FIREBASE_PROJECT_ID: "aura-control-center-debb3",
  VITE_FIREBASE_MESSAGING_SENDER_ID: "2468135790",
  VITE_FIREBASE_APP_ID: "1:2468135790:web:productionmetadata",
});

function stubProductionEnvironment(): void {
  for (const [name, value] of Object.entries(productionVariables)) {
    vi.stubEnv(name, value);
  }
  vi.stubEnv("VITE_RECAPTCHA_SITE_KEY", "");
}

afterAll(() => {
  vi.unstubAllEnvs();
});

describe.sequential("Production Firebase module graph", () => {
  it("imports config/firebase without a Preview configuration error", async () => {
    stubProductionEnvironment();
    const firebaseModule = await import("./firebase");

    expect(firebaseModule.firebaseApp.options.projectId)
      .toBe("aura-control-center-debb3");
    expect(firebaseModule.appCheck).toBeNull();
  });

  it("evaluates the Market Intelligence graph without a Preview error", async () => {
    stubProductionEnvironment();
    await expect(import("../pages/MarketIntelligencePage"))
      .resolves.toHaveProperty("default");
  });
});
