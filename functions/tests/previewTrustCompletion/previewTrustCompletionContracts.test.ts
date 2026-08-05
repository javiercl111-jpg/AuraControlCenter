import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  PREVIEW_APP_CHECK_ENVIRONMENT_VARIABLE_V1,
  PREVIEW_APP_CHECK_SITE_KEY_VARIABLE_V1,
  resolvePreviewAppCheckConfigurationV1,
} from "../../../src/config/previewAppCheckContractV1";
import { PREVIEW_RUNTIME_SECRET_MANIFEST_V1 } from
  "../../src/discovery/runtimeContracts";

const repositoryRoot = resolve(__dirname, "..", "..", "..");
const source = (path: string): string =>
  readFileSync(resolve(repositoryRoot, path), "utf8");
const evidenceMatrix = JSON.parse(source(
  "docs/security/discovery/production-remediation/security-baseline/execution/" +
  "preview-runtime/trust-completion/PREVIEW_TRUST_COMPLETION_MATRIX_V1.json",
)) as {
  target: Record<string, unknown>;
  secretManager: Record<string, unknown>;
  wif: Record<string, unknown>;
  appCheck: Record<string, unknown>;
  observability: Record<string, unknown>;
  keyInventory: Record<string, unknown>;
  resources: Record<string, unknown>;
};

describe("Preview App Check client contract", () => {
  it("uses explicit Preview environment and reCAPTCHA Enterprise site key names", () => {
    expect(PREVIEW_APP_CHECK_ENVIRONMENT_VARIABLE_V1)
      .toBe("VITE_AURA_RUNTIME_ENVIRONMENT");
    expect(PREVIEW_APP_CHECK_SITE_KEY_VARIABLE_V1)
      .toBe("VITE_FIREBASE_APPCHECK_RECAPTCHA_ENTERPRISE_SITE_KEY");
  });

  it("enables App Check only for the exact Preview project", () => {
    expect(resolvePreviewAppCheckConfigurationV1({
      VITE_AURA_RUNTIME_ENVIRONMENT: "PREVIEW",
      VITE_FIREBASE_PROJECT_ID: "aura-intel-preview",
      VITE_FIREBASE_APPCHECK_RECAPTCHA_ENTERPRISE_SITE_KEY: "site-key-metadata",
    })).toEqual({
      enabled: true,
      environment: "PREVIEW",
      provider: "RECAPTCHA_ENTERPRISE",
      siteKey: "site-key-metadata",
      debugEnabled: false,
    });
  });

  it("fails closed when the environment is missing", () => {
    expect(() => resolvePreviewAppCheckConfigurationV1({
      VITE_FIREBASE_PROJECT_ID: "aura-intel-preview",
    })).toThrowError("APP_CHECK_RUNTIME_ENVIRONMENT_MISSING");
  });

  it("fails closed for unknown environment", () => {
    expect(() => resolvePreviewAppCheckConfigurationV1({
      VITE_AURA_RUNTIME_ENVIRONMENT: "DEVELOPMENT",
      VITE_FIREBASE_PROJECT_ID: "aura-intel-preview",
    })).toThrowError("APP_CHECK_RUNTIME_ENVIRONMENT_UNKNOWN");
  });

  it("fails closed for Preview project mismatch", () => {
    expect(() => resolvePreviewAppCheckConfigurationV1({
      VITE_AURA_RUNTIME_ENVIRONMENT: "PREVIEW",
      VITE_FIREBASE_PROJECT_ID: "aura-intel-staging",
      VITE_FIREBASE_APPCHECK_RECAPTCHA_ENTERPRISE_SITE_KEY: "site-key-metadata",
    })).toThrowError("APP_CHECK_RUNTIME_PROJECT_MISMATCH");
  });

  it("fails closed when Preview site key metadata is missing", () => {
    expect(() => resolvePreviewAppCheckConfigurationV1({
      VITE_AURA_RUNTIME_ENVIRONMENT: "PREVIEW",
      VITE_FIREBASE_PROJECT_ID: "aura-intel-preview",
    })).toThrowError("APP_CHECK_PREVIEW_SITE_KEY_MISSING");
  });

  it.each([
    ["STAGING", "aura-intel-staging"],
    ["PRODUCTION", "aura-control-center-debb3"],
    ["LOCAL_DEMO", "demo-aura-preview"],
  ] as const)("does not apply Preview configuration to %s", (environment, projectId) => {
    expect(resolvePreviewAppCheckConfigurationV1({
      VITE_AURA_RUNTIME_ENVIRONMENT: environment,
      VITE_FIREBASE_PROJECT_ID: projectId,
      VITE_FIREBASE_APPCHECK_RECAPTCHA_ENTERPRISE_SITE_KEY: "preview-only-key",
    })).toEqual({ enabled: false, environment });
  });

  it("keeps debug disabled and never reads a debug token", () => {
    const contract = source("src/config/previewAppCheckContractV1.ts");
    const integration = source("src/config/firebase.ts");
    expect(contract).toContain("debugEnabled: false");
    expect(`${contract}\n${integration}`).not.toMatch(
      /FIREBASE_APPCHECK_DEBUG_TOKEN|VITE_FIREBASE_APPCHECK_DEBUG_TOKEN/,
    );
  });

  it("initializes reCAPTCHA Enterprise without logging key material", () => {
    const integration = source("src/config/firebase.ts");
    const appCheckIntegration = integration.slice(
      integration.indexOf("function initializeAuraAppCheck"),
    );
    expect(appCheckIntegration).toContain("ReCaptchaEnterpriseProvider");
    expect(appCheckIntegration).toContain("isTokenAutoRefreshEnabled: true");
    expect(appCheckIntegration).not.toMatch(/console\.(?:log|info|warn|error)/);
    expect(appCheckIntegration).not.toMatch(
      /import\.meta\.env\.(?:DEV|PROD)|NODE_ENV/,
    );
  });

  it("does not inspect App Check key material in Discovery logs", () => {
    const discovery = source("src/pages/DiscoverPage.tsx");
    expect(discovery).toContain("appCheckConfigured: appCheck !== null");
    expect(discovery).not.toContain("VITE_RECAPTCHA_SITE_KEY");
    expect(discovery).not.toContain(
      "VITE_FIREBASE_APPCHECK_RECAPTCHA_ENTERPRISE_SITE_KEY",
    );
  });
});

describe("Inherited runtime identity and secret boundary", () => {
  it("keeps exact handler to runtime identity and secret mappings", () => {
    expect(PREVIEW_RUNTIME_SECRET_MANIFEST_V1.mappings).toEqual([
      expect.objectContaining({
        handler: "createDiscoveryLead",
        runtimeIdentity: "preview-public-intake-runtime",
        secretResource: "discovery-idempotency-secret-preview",
        secretParamName: "discovery-idempotency-secret-preview",
      }),
      expect.objectContaining({
        handler: "completeDiscoverySession",
        runtimeIdentity: "preview-discovery-complete-rt",
        secretResource: "discovery-hmac-secret-preview",
        secretParamName: "discovery-hmac-secret-preview",
      }),
      expect.objectContaining({
        handler: "evaluateConversation",
        runtimeIdentity: "preview-conversation-runtime",
        secretResource: "discovery-gemini-api-key-preview",
        secretParamName: "discovery-gemini-api-key-preview",
      }),
    ]);
  });

  it("keeps session secretless and IP salt deferred", () => {
    expect(PREVIEW_RUNTIME_SECRET_MANIFEST_V1.secretlessHandlers)
      .toEqual(["exchangeDiscoveryToken", "resolveDiscoverySession"]);
    expect(PREVIEW_RUNTIME_SECRET_MANIFEST_V1.deferred).toEqual([
      expect.objectContaining({
        secretResource: "discovery-ip-hash-salt-preview",
        consumers: [],
      }),
    ]);
  });
});

describe("Sanitized Preview trust read-back", () => {
  it("records exact resource-level secret bindings with no project access", () => {
    expect(evidenceMatrix.secretManager).toMatchObject({
      projectLevelSecretAccessorBindings: 0,
      crossRuntimeBindings: 0,
      defaultComputeAccessors: 0,
      deployerAccessors: 0,
    });
  });

  it("keeps WIF fail-closed until the deployment ref is approved", () => {
    expect(evidenceMatrix.wif).toMatchObject({
      actual: {
        poolCount: 0,
        providerCount: 0,
        deployerImpersonationBindings: 0,
      },
      approvedDesign: {
        repository: "javiercl111-jpg/AuraControlCenter",
        repositoryOwner: "javiercl111-jpg",
        environment: "Preview",
        branchRef: null,
        branchRefStatus: "PENDING_OPERATOR_APPROVAL",
        providerEnabled: false,
        impersonationBindingCreated: false,
        rejectForks: true,
        rejectPullRequests: true,
      },
    });
  });

  it("records App Check enforcement as unverified and debug off", () => {
    expect(evidenceMatrix.appCheck).toMatchObject({
      provider: "RECAPTCHA_ENTERPRISE",
      providerStatus: "UNKNOWN_READBACK_403",
      enforcement: "INHERITED_OFF_NOT_API_VERIFIED",
      debugTokenCount: 0,
    });
  });

  it("records zero permanent keys and zero deployed resources", () => {
    expect(evidenceMatrix.keyInventory).toMatchObject({
      userManagedKeyCount: 0,
      jsonKeysCreated: 0,
    });
    expect(evidenceMatrix.resources).toMatchObject({
      functions: 0,
      cloudRunServices: 0,
      storageBuckets: 0,
      cloudTasksApiEnabled: false,
      functionDeployPerformed: false,
      cloudRunDeployPerformed: false,
    });
  });

  it("contains no Staging or Production mutation target", () => {
    expect(evidenceMatrix.target).toMatchObject({
      environment: "PREVIEW",
      projectId: "aura-intel-preview",
      stagingMutation: false,
      productionMutation: false,
    });
  });

  it("does not invent alerts or budget evidence", () => {
    expect(evidenceMatrix.observability).toMatchObject({
      alertPolicyCount: 0,
      alertsStatus: "PENDING_APPROVED_THRESHOLDS_CHANNEL_AND_OWNER",
      budgets: {
        usd5: "UNKNOWN_READBACK_BLOCKED",
        usd10: "UNKNOWN_READBACK_BLOCKED",
      },
    });
  });
});
