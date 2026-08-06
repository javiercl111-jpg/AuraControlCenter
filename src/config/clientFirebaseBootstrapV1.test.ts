import { describe, expect, it } from "vitest";

import {
  resolveClientFirebaseBootstrapV1,
  resolveClientRuntimeEnvironmentV1,
  type ClientFirebaseEnvironmentSourceV1,
} from "./clientFirebaseBootstrapV1";

const validPreviewSource = (): ClientFirebaseEnvironmentSourceV1 => ({
  VITE_AURA_RUNTIME_ENVIRONMENT: "PREVIEW",
  VITE_FIREBASE_API_KEY: "AIza-preview-public-metadata",
  VITE_FIREBASE_AUTH_DOMAIN: "aura-intel-preview.firebaseapp.com",
  VITE_FIREBASE_PROJECT_ID: "aura-intel-preview",
  VITE_FIREBASE_MESSAGING_SENDER_ID: "1234567890",
  VITE_FIREBASE_APP_ID: "1:1234567890:web:previewmetadata",
  VITE_RECAPTCHA_SITE_KEY: "preview-site-key-metadata",
});

const validProductionSource = (): ClientFirebaseEnvironmentSourceV1 => ({
  VITE_AURA_RUNTIME_ENVIRONMENT: "PRODUCTION",
  VITE_FIREBASE_API_KEY: "AIza-production-public-metadata",
  VITE_FIREBASE_AUTH_DOMAIN: "aura-control-center-debb3.firebaseapp.com",
  VITE_FIREBASE_PROJECT_ID: "aura-control-center-debb3",
  VITE_FIREBASE_MESSAGING_SENDER_ID: "2468135790",
  VITE_FIREBASE_APP_ID: "1:2468135790:web:productionmetadata",
});

describe("Production and Preview Firebase bootstrap isolation", () => {
  it("resolves Preview only from an explicit Preview environment", () => {
    expect(resolveClientFirebaseBootstrapV1(
      validPreviewSource(),
      "preview-controlcenter.auranexus.io",
    )).toMatchObject({
      environment: "PREVIEW",
      projectId: "aura-intel-preview",
      appCheckEnabled: true,
      appCheckDebugEnabled: false,
    });
  });

  it("keeps the existing Preview missing-variable error", () => {
    expect(() => resolveClientFirebaseBootstrapV1({
      ...validPreviewSource(),
      VITE_RECAPTCHA_SITE_KEY: undefined,
    }, "preview-controlcenter.auranexus.io"))
      .toThrowError("PREVIEW_CLIENT_VARIABLE_MISSING");
  });

  it("keeps the existing Preview project boundary", () => {
    expect(() => resolveClientFirebaseBootstrapV1({
      ...validPreviewSource(),
      VITE_FIREBASE_PROJECT_ID: "aura-control-center-debb3",
    }, "preview-controlcenter.auranexus.io"))
      .toThrowError("PREVIEW_CLIENT_PROJECT_MISMATCH");
  });

  it("rejects Preview on the Production domain", () => {
    expect(() => resolveClientFirebaseBootstrapV1(
      validPreviewSource(),
      "controlcenter.auranexus.io",
    )).toThrowError("PREVIEW_CLIENT_DOMAIN_MISMATCH");
  });

  it("resolves Production only from an explicit Production environment", () => {
    expect(resolveClientFirebaseBootstrapV1(
      validProductionSource(),
      "controlcenter.auranexus.io",
    )).toMatchObject({
      environment: "PRODUCTION",
      projectId: "aura-control-center-debb3",
      appCheckEnabled: false,
    });
  });

  it("Production does not evaluate the Preview site-key contract", () => {
    const source = {
      ...validProductionSource(),
      VITE_RECAPTCHA_SITE_KEY: undefined,
    };
    expect(() => resolveClientFirebaseBootstrapV1(
      source,
      "controlcenter.auranexus.io",
    )).not.toThrow();
  });

  it("Production never requires the Preview project", () => {
    expect(resolveClientFirebaseBootstrapV1(
      validProductionSource(),
      "controlcenter.auranexus.io",
    ).projectId).not.toBe("aura-intel-preview");
  });

  it("Production never requires the Preview domain", () => {
    expect(() => resolveClientFirebaseBootstrapV1(
      validProductionSource(),
      "preview-controlcenter.auranexus.io",
    )).toThrowError("PRODUCTION_CLIENT_DOMAIN_MISMATCH");
  });

  it("Preview never accepts the Production project", () => {
    expect(() => resolveClientFirebaseBootstrapV1({
      ...validPreviewSource(),
      VITE_FIREBASE_PROJECT_ID: "aura-control-center-debb3",
    }, "preview-controlcenter.auranexus.io"))
      .toThrowError("PREVIEW_CLIENT_PROJECT_MISMATCH");
  });

  it.each(["STAGING", "DEVELOPMENT", "LOCAL_DEMO"])(
    "fails closed for unsupported environment %s",
    (environment) => {
      expect(() => resolveClientRuntimeEnvironmentV1({
        VITE_AURA_RUNTIME_ENVIRONMENT: environment,
      })).toThrowError("CLIENT_RUNTIME_ENVIRONMENT_UNSUPPORTED");
    },
  );

  it("fails closed when environment is absent", () => {
    expect(() => resolveClientRuntimeEnvironmentV1({}))
      .toThrowError("CLIENT_RUNTIME_ENVIRONMENT_MISSING");
  });

  it("does not fall back from Production identifiers to Production", () => {
    expect(() => resolveClientFirebaseBootstrapV1({
      ...validProductionSource(),
      VITE_AURA_RUNTIME_ENVIRONMENT: undefined,
    }, "controlcenter.auranexus.io"))
      .toThrowError("CLIENT_RUNTIME_ENVIRONMENT_MISSING");
  });

  it("does not fall back from Preview identifiers to Preview", () => {
    expect(() => resolveClientFirebaseBootstrapV1({
      ...validPreviewSource(),
      VITE_AURA_RUNTIME_ENVIRONMENT: undefined,
    }, "preview-controlcenter.auranexus.io"))
      .toThrowError("CLIENT_RUNTIME_ENVIRONMENT_MISSING");
  });

  it("does not cross Production configuration into Preview", () => {
    expect(() => resolveClientFirebaseBootstrapV1({
      ...validProductionSource(),
      VITE_AURA_RUNTIME_ENVIRONMENT: "PREVIEW",
      VITE_RECAPTCHA_SITE_KEY: "preview-site-key-metadata",
    }, "preview-controlcenter.auranexus.io"))
      .toThrowError("PREVIEW_CLIENT_PROJECT_MISMATCH");
  });

  it("does not cross Preview configuration into Production", () => {
    expect(() => resolveClientFirebaseBootstrapV1({
      ...validPreviewSource(),
      VITE_AURA_RUNTIME_ENVIRONMENT: "PRODUCTION",
    }, "controlcenter.auranexus.io"))
      .toThrowError("PRODUCTION_CLIENT_PROJECT_MISMATCH");
  });
});
