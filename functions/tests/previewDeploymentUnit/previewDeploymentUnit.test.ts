import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  PREVIEW_DISCOVERY_CALLABLE_OPTIONS_V1,
  PREVIEW_DISCOVERY_ENVIRONMENT_V1,
  PREVIEW_DISCOVERY_HANDLER_ALLOWLIST_V1,
  PREVIEW_DISCOVERY_PROJECT_ID_V1,
  PREVIEW_DISCOVERY_REGION_V1,
  PREVIEW_DISCOVERY_SECRET_BINDINGS_V1,
  PREVIEW_DISCOVERY_SERVICE_ACCOUNTS_V1,
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
    exports: [...PREVIEW_DISCOVERY_HANDLER_ALLOWLIST_V1],
    handlers: Object.fromEntries(PREVIEW_DISCOVERY_HANDLER_ALLOWLIST_V1.map(
      (handler) => [handler, {
        region: PREVIEW_DISCOVERY_REGION_V1,
        serviceAccount: PREVIEW_DISCOVERY_SERVICE_ACCOUNTS_V1[handler],
        enforceAppCheck: true,
        secretBindings: PREVIEW_DISCOVERY_SECRET_BINDINGS_V1[handler].map(
          (binding) => ({ ...binding }),
        ),
      }],
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
          key: "GEMINI_API_KEY",
          secret: "discovery-hmac-secret-preview",
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
      expect(entrypoint).toContain(`\n  "${handler}",`);
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
    for (const handler of PREVIEW_DISCOVERY_HANDLER_ALLOWLIST_V1) {
      expect(deploy).toContain(`functions:${handler}`);
    }
    expect(Object.values(PREVIEW_DISCOVERY_CALLABLE_OPTIONS_V1).every(
      (options) => options.enforceAppCheck === true,
    )).toBe(true);
    expect(PREVIEW_DISCOVERY_SECRET_BINDINGS_V1.createDiscoveryLead[0].secret)
      .toBe("discovery-idempotency-secret-preview");
    expect(PREVIEW_DISCOVERY_SECRET_BINDINGS_V1.evaluateConversation[0].secret)
      .toBe("discovery-gemini-api-key-preview");
    expect(PREVIEW_DISCOVERY_SECRET_BINDINGS_V1.completeDiscoverySession[0].secret)
      .toBe("discovery-hmac-secret-preview");
  });
});
