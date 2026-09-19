import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  PREVIEW_DISCOVERY_CALLABLE_OPTIONS_V1,
  PREVIEW_DISCOVERY_CODEBASE_V1,
  PREVIEW_DISCOVERY_DEPLOY_TARGET_V1,
  PREVIEW_DISCOVERY_ENVIRONMENT_V1,
  PREVIEW_DISCOVERY_HANDLER_ALLOWLIST_V1,
  PREVIEW_DISCOVERY_HTTP_OPTIONS_V1,
  PREVIEW_DISCOVERY_PROJECT_ID_V1,
  PREVIEW_DISCOVERY_REGION_V1,
  PREVIEW_DISCOVERY_SECRET_BINDINGS_V1,
  PREVIEW_DISCOVERY_SERVICE_ACCOUNTS_V1,
  PREVIEW_EXECUTIVE_DISCOVERY_RECEIVER_INVOKER_V1,
  assertPreviewDiscoveryDeploymentCandidateV1,
  assertPreviewDiscoveryRuntimeV1,
  type PreviewDiscoveryDeploymentCandidateV1,
} from "../../src/discovery/deployment/previewDiscoveryDeploymentUnitV1";

const root = resolve(__dirname, "..", "..", "..");
const source = (path: string): string =>
  readFileSync(resolve(root, path), "utf8");

function validCandidate(): PreviewDiscoveryDeploymentCandidateV1 {
  return {
    projectId: PREVIEW_DISCOVERY_PROJECT_ID_V1,
    environment: PREVIEW_DISCOVERY_ENVIRONMENT_V1,
    codebase: PREVIEW_DISCOVERY_CODEBASE_V1,
    deployTarget: PREVIEW_DISCOVERY_DEPLOY_TARGET_V1,
    exports: [...PREVIEW_DISCOVERY_HANDLER_ALLOWLIST_V1],
    handlers: Object.fromEntries(PREVIEW_DISCOVERY_HANDLER_ALLOWLIST_V1.map(
      (handler) => {
        const httpOidc = handler === "evaluateExecutiveDiscoveryV1";
        return [handler, {
          region: PREVIEW_DISCOVERY_REGION_V1,
          serviceAccount: PREVIEW_DISCOVERY_SERVICE_ACCOUNTS_V1[handler],
          transport: httpOidc ? ("HTTP_OIDC" as const) : ("CALLABLE" as const),
          enforceAppCheck: !httpOidc,
          invoker: httpOidc
            ? PREVIEW_EXECUTIVE_DISCOVERY_RECEIVER_INVOKER_V1
            : undefined,
          cors: httpOidc ? false : undefined,
          secretBindings: PREVIEW_DISCOVERY_SECRET_BINDINGS_V1[handler].map(
            (binding) => ({ ...binding }),
          ),
        }];
      },
    )),
  };
}

function changed(
  mutate: (candidate: PreviewDiscoveryDeploymentCandidateV1) => void,
): PreviewDiscoveryDeploymentCandidateV1 {
  const candidate = structuredClone(validCandidate());
  mutate(candidate);
  return candidate;
}

describe("Preview Discovery deployment unit", () => {
  it("01 accepts only the exact certified candidate", () => {
    expect(() => assertPreviewDiscoveryDeploymentCandidateV1(validCandidate()))
      .not.toThrow();
  });

  it("02 rejects an incorrect project", () => {
    expect(() => assertPreviewDiscoveryDeploymentCandidateV1(changed(
      (candidate) => Object.assign(candidate, { projectId: "wrong-project" }),
    ))).toThrowError("PREVIEW_DEPLOYMENT_PROJECT_MISMATCH");
  });

  it("03 rejects a missing runtime environment", () => {
    expect(() => assertPreviewDiscoveryRuntimeV1({
      GCLOUD_PROJECT: PREVIEW_DISCOVERY_PROJECT_ID_V1,
    })).toThrowError("RUNTIME_ENVIRONMENT_MISSING");
  });

  it("04 rejects a runtime environment other than Preview", () => {
    expect(() => assertPreviewDiscoveryRuntimeV1({
      AURA_RUNTIME_ENVIRONMENT: "STAGING",
      GCLOUD_PROJECT: PREVIEW_DISCOVERY_PROJECT_ID_V1,
    })).toThrowError("RUNTIME_ENVIRONMENT_PROJECT_MISMATCH");
  });

  it("05 rejects a handler outside the allowlist", () => {
    expect(() => assertPreviewDiscoveryDeploymentCandidateV1(changed(
      (candidate) => (candidate.exports as string[]).push("generateDiscoveryReport"),
    ))).toThrowError("PREVIEW_DEPLOYMENT_EXPORT_ALLOWLIST_MISMATCH");
  });

  it("06 rejects a missing allowlisted handler", () => {
    expect(() => assertPreviewDiscoveryDeploymentCandidateV1(changed(
      (candidate) => (candidate.exports as string[]).pop(),
    ))).toThrowError("PREVIEW_DEPLOYMENT_EXPORT_ALLOWLIST_MISMATCH");
  });

  it("07 rejects an incorrect service account", () => {
    expect(() => assertPreviewDiscoveryDeploymentCandidateV1(changed(
      (candidate) => Object.assign(candidate.handlers.createDiscoveryLead, {
        serviceAccount: "wrong-runtime@aura-intel-preview.iam.gserviceaccount.com",
      }),
    ))).toThrowError("PREVIEW_DEPLOYMENT_SERVICE_ACCOUNT_MISMATCH");
  });

  it("08 rejects a crossed secret mapping", () => {
    expect(() => assertPreviewDiscoveryDeploymentCandidateV1(changed(
      (candidate) => Object.assign(candidate.handlers.evaluateConversation, {
        secretBindings: [{
          secretParamName: "discovery-hmac-secret-preview",
          secretResource: "discovery-hmac-secret-preview",
        }],
      }),
    ))).toThrowError("PREVIEW_DEPLOYMENT_SECRET_MAPPING_MISMATCH");
  });

  it("09 rejects a Production identity", () => {
    expect(() => assertPreviewDiscoveryDeploymentCandidateV1(changed(
      (candidate) => Object.assign(candidate.handlers.completeDiscoverySession, {
        serviceAccount: "runtime@aura-control-center-debb3.iam.gserviceaccount.com",
      }),
    ))).toThrowError("PREVIEW_DEPLOYMENT_SERVICE_ACCOUNT_MISMATCH");
  });

  it("10 rejects a Storage export", () => {
    expect(() => assertPreviewDiscoveryDeploymentCandidateV1(changed(
      (candidate) => (candidate.exports as string[]).push("storageWriter"),
    ))).toThrowError("PREVIEW_DEPLOYMENT_EXPORT_ALLOWLIST_MISMATCH");
  });

  it("11 rejects a Tasks export", () => {
    expect(() => assertPreviewDiscoveryDeploymentCandidateV1(changed(
      (candidate) => (candidate.exports as string[]).push("emitDiscoveryCompletedNotification"),
    ))).toThrowError("PREVIEW_DEPLOYMENT_EXPORT_ALLOWLIST_MISMATCH");
  });

  it("12 rejects a report export", () => {
    expect(() => assertPreviewDiscoveryDeploymentCandidateV1(changed(
      (candidate) => (candidate.exports as string[]).push("requestExecutiveDocument"),
    ))).toThrowError("PREVIEW_DEPLOYMENT_EXPORT_ALLOWLIST_MISMATCH");
  });

  it("13 rejects a handler without App Check enforcement", () => {
    expect(() => assertPreviewDiscoveryDeploymentCandidateV1(changed(
      (candidate) => Object.assign(candidate.handlers.resolveDiscoverySession, {
        enforceAppCheck: false,
      }),
    ))).toThrowError("PREVIEW_DEPLOYMENT_APP_CHECK_REQUIRED");
  });

  it("14 keeps the entrypoint exact and free of optional-service exports", () => {
    const entrypoint = source("functions/src/previewDiscoveryIndex.ts");
    for (const handler of PREVIEW_DISCOVERY_HANDLER_ALLOWLIST_V1) {
      expect(entrypoint).toContain(`export const ${handler}`);
    }
    expect(entrypoint).not.toMatch(
      /Storage|task|report|pdf|notification|generateDiscoveryReport|requestExecutiveDocument/i,
    );
  });

  it("15 pins package main, codebase, environment, and deploy command", () => {
    const functionsPackage = JSON.parse(source("functions/package.json"));
    const firebase = JSON.parse(source("firebase.json"));
    const environment = source("functions/.env.aura-intel-preview");
    expect(functionsPackage.main).toBe("lib/previewDiscoveryIndex.js");
    expect(firebase.functions.codebase).toBe("preview-discovery");
    expect(environment).toContain("AURA_RUNTIME_ENVIRONMENT=PREVIEW");
    const deploy = functionsPackage.scripts["deploy:preview-discovery"] as string;
    expect(deploy).toContain("--project aura-intel-preview");
    expect(deploy).toContain("--non-interactive");
    expect(deploy).toContain("--only functions:preview-discovery");
    expect(deploy).not.toMatch(/functions:(?:create|exchange|resolve|evaluate|complete)/);
    expect(Object.values(PREVIEW_DISCOVERY_CALLABLE_OPTIONS_V1).every(
      (options) => options.enforceAppCheck === true,
    )).toBe(true);
    expect(PREVIEW_DISCOVERY_SECRET_BINDINGS_V1.createDiscoveryLead[0].secretResource)
      .toBe("discovery-idempotency-secret-preview");
    expect(PREVIEW_DISCOVERY_SECRET_BINDINGS_V1.evaluateConversation[0].secretResource)
      .toBe("discovery-gemini-api-key-preview");
    expect(PREVIEW_DISCOVERY_SECRET_BINDINGS_V1.completeDiscoverySession[0].secretResource)
      .toBe("discovery-hmac-secret-preview");
  });

  it("16 rejects a logical uppercase SecretParam alias", () => {
    expect(() => assertPreviewDiscoveryDeploymentCandidateV1(changed(
      (candidate) => Object.assign(candidate.handlers.createDiscoveryLead, {
        secretBindings: [{
          secretParamName: "IDEMPOTENCY_SECRET",
          secretResource: "discovery-idempotency-secret-preview",
        }],
      }),
    ))).toThrowError("PREVIEW_DEPLOYMENT_SECRET_MAPPING_MISMATCH");
  });

  it("17 rejects an incorrect Preview secret resource", () => {
    expect(() => assertPreviewDiscoveryDeploymentCandidateV1(changed(
      (candidate) => Object.assign(candidate.handlers.evaluateConversation, {
        secretBindings: [{
          secretParamName: "discovery-gemini-api-key-preview-wrong",
          secretResource: "discovery-gemini-api-key-preview-wrong",
        }],
      }),
    ))).toThrowError("PREVIEW_DEPLOYMENT_SECRET_MAPPING_MISMATCH");
  });

  it("18 rejects a secret on a session runtime", () => {
    expect(() => assertPreviewDiscoveryDeploymentCandidateV1(changed(
      (candidate) => Object.assign(candidate.handlers.exchangeDiscoveryToken, {
        secretBindings: [{
          secretParamName: "discovery-hmac-secret-preview",
          secretResource: "discovery-hmac-secret-preview",
        }],
      }),
    ))).toThrowError("PREVIEW_DEPLOYMENT_SECRET_MAPPING_MISMATCH");
  });

  it("19 rejects activation of the deferred IP salt", () => {
    expect(() => assertPreviewDiscoveryDeploymentCandidateV1(changed(
      (candidate) => Object.assign(candidate.handlers.resolveDiscoverySession, {
        secretBindings: [{
          secretParamName: "discovery-ip-hash-salt-preview",
          secretResource: "discovery-ip-hash-salt-preview",
        }],
      }),
    ))).toThrowError("PREVIEW_DEPLOYMENT_SECRET_MAPPING_MISMATCH");
  });

  it("20 rejects a codebase other than preview-discovery", () => {
    expect(() => assertPreviewDiscoveryDeploymentCandidateV1(changed(
      (candidate) => Object.assign(candidate, { codebase: "default" }),
    ))).toThrowError("PREVIEW_DEPLOYMENT_CODEBASE_MISMATCH");
  });

  it("21 rejects an individual handler deployment filter", () => {
    expect(() => assertPreviewDiscoveryDeploymentCandidateV1(changed(
      (candidate) => Object.assign(candidate, {
        deployTarget: "functions:createDiscoveryLead",
      }),
    ))).toThrowError("PREVIEW_DEPLOYMENT_TARGET_MISMATCH");
  });

  it("22 declares only exact Preview SecretParams in handler source", () => {
    const declarations = [
      ["functions/src/discovery/createDiscoveryLead.ts", "discovery-idempotency-secret-preview"],
      ["functions/src/intelligence/evaluateConversation.ts", "discovery-gemini-api-key-preview"],
      ["functions/src/discovery/completeDiscoverySession.ts", "discovery-hmac-secret-preview"],
    ] as const;
    for (const [path, secret] of declarations) {
      expect(source(path)).toContain(`defineSecret("${secret}")`);
    }
    const deployedHandlers = declarations.map(([path]) => source(path)).join("\n");
    expect(deployedHandlers).not.toMatch(
      /defineSecret\(["'](?:IDEMPOTENCY_SECRET|GEMINI_API_KEY|DISCOVERY_HMAC_SECRET)["']\)/,
    );
  });
  it("23 pins the executive receiver to private OIDC Preview options", () => {
    const options =
      PREVIEW_DISCOVERY_HTTP_OPTIONS_V1.evaluateExecutiveDiscoveryV1;
    expect(options.region).toBe(PREVIEW_DISCOVERY_REGION_V1);
    expect(options.serviceAccount).toBe(
      PREVIEW_DISCOVERY_SERVICE_ACCOUNTS_V1.evaluateExecutiveDiscoveryV1,
    );
    expect(options.invoker).toBe(
      PREVIEW_EXECUTIVE_DISCOVERY_RECEIVER_INVOKER_V1,
    );
    expect(options.invoker).toMatch(/^serviceAccount:/);
    expect(options.cors).toBe(false);
  });

  it("24 rejects an incorrect executive receiver invoker", () => {
    expect(() => assertPreviewDiscoveryDeploymentCandidateV1(changed(
      (candidate) => Object.assign(
        candidate.handlers.evaluateExecutiveDiscoveryV1,
        { invoker: "serviceAccount:wrong@aura-intel-preview.iam.gserviceaccount.com" },
      ),
    ))).toThrowError("PREVIEW_DEPLOYMENT_INVOKER_MISMATCH");
  });

  it("25 rejects App Check substitution for the OIDC receiver", () => {
    expect(() => assertPreviewDiscoveryDeploymentCandidateV1(changed(
      (candidate) => Object.assign(
        candidate.handlers.evaluateExecutiveDiscoveryV1,
        { enforceAppCheck: true },
      ),
    ))).toThrowError("PREVIEW_DEPLOYMENT_HTTP_OIDC_APP_CHECK_FORBIDDEN");
  });

  it("26 rejects callable transport for the OIDC receiver", () => {
    expect(() => assertPreviewDiscoveryDeploymentCandidateV1(changed(
      (candidate) => Object.assign(
        candidate.handlers.evaluateExecutiveDiscoveryV1,
        { transport: "CALLABLE" },
      ),
    ))).toThrowError("PREVIEW_DEPLOYMENT_TRANSPORT_MISMATCH");
  });

  it("27 binds receiver source to Preview runtime and HTTP options", () => {
    const receiver = source(
      "functions/src/discovery/executive-intelligence/receiver/evaluateExecutiveDiscoveryV1.ts",
    );
    expect(receiver).toContain("assertPreviewDiscoveryRuntimeV1();");
    expect(receiver).toContain(
      "PREVIEW_DISCOVERY_HTTP_OPTIONS_V1.evaluateExecutiveDiscoveryV1",
    );
    expect(receiver).not.toContain(
      'onRequest({ region: "us-central1", cors: false }',
    );
  });
});
