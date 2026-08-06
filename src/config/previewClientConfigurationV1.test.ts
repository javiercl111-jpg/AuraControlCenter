import { describe, expect, it } from "vitest";

import {
  assertPreviewClientDomainV1,
  PREVIEW_CLIENT_REQUIRED_VARIABLES_V1,
  resolvePreviewClientConfigurationV1,
  type PreviewClientEnvironmentSourceV1,
} from "./previewClientConfigurationV1";

const validSource = (): PreviewClientEnvironmentSourceV1 => ({
  VITE_AURA_RUNTIME_ENVIRONMENT: "PREVIEW",
  VITE_FIREBASE_API_KEY: "AIza-preview-public-metadata",
  VITE_FIREBASE_AUTH_DOMAIN: "aura-intel-preview.firebaseapp.com",
  VITE_FIREBASE_PROJECT_ID: "aura-intel-preview",
  VITE_FIREBASE_MESSAGING_SENDER_ID: "1234567890",
  VITE_FIREBASE_APP_ID: "1:1234567890:web:previewmetadata",
  VITE_RECAPTCHA_SITE_KEY: "preview-site-key-metadata",
});

describe("Preview client configuration contract", () => {
  it("defines exactly seven required variables", () => {
    expect(PREVIEW_CLIENT_REQUIRED_VARIABLES_V1).toHaveLength(7);
    expect(new Set(PREVIEW_CLIENT_REQUIRED_VARIABLES_V1).size).toBe(7);
  });

  it("resolves the exact Preview configuration and keeps debug off", () => {
    expect(resolvePreviewClientConfigurationV1(validSource())).toMatchObject({
      environment: "PREVIEW",
      projectId: "aura-intel-preview",
      authDomain: "aura-intel-preview.firebaseapp.com",
      functionsRegion: "us-central1",
      appCheckDebugEnabled: false,
    });
  });

  it.each(PREVIEW_CLIENT_REQUIRED_VARIABLES_V1)(
    "fails closed when %s is missing",
    (name) => {
      const source = { ...validSource(), [name]: undefined };
      expect(() => resolvePreviewClientConfigurationV1(source))
        .toThrowError("PREVIEW_CLIENT_VARIABLE_MISSING");
    },
  );

  it.each(["STAGING", "PRODUCTION", "LOCAL_DEMO"])(
    "rejects the %s environment",
    (environment) => {
      expect(() => resolvePreviewClientConfigurationV1({
        ...validSource(),
        VITE_AURA_RUNTIME_ENVIRONMENT: environment,
      })).toThrowError("PREVIEW_CLIENT_ENVIRONMENT_MISMATCH");
    },
  );

  it("rejects a non-Preview Firebase project", () => {
    expect(() => resolvePreviewClientConfigurationV1({
      ...validSource(),
      VITE_FIREBASE_PROJECT_ID: "not-preview",
    })).toThrowError("PREVIEW_CLIENT_PROJECT_MISMATCH");
  });

  it("rejects a non-Preview auth domain", () => {
    expect(() => resolvePreviewClientConfigurationV1({
      ...validSource(),
      VITE_FIREBASE_AUTH_DOMAIN: "not-preview.firebaseapp.com",
    })).toThrowError("PREVIEW_CLIENT_AUTH_DOMAIN_MISMATCH");
  });

  it("rejects malformed Firebase identifiers", () => {
    expect(() => resolvePreviewClientConfigurationV1({
      ...validSource(),
      VITE_FIREBASE_API_KEY: "invalid",
    })).toThrowError("PREVIEW_CLIENT_API_KEY_INVALID");
    expect(() => resolvePreviewClientConfigurationV1({
      ...validSource(),
      VITE_FIREBASE_MESSAGING_SENDER_ID: "not-numeric",
    })).toThrowError("PREVIEW_CLIENT_SENDER_ID_INVALID");
    expect(() => resolvePreviewClientConfigurationV1({
      ...validSource(),
      VITE_FIREBASE_APP_ID: "mismatched",
    })).toThrowError("PREVIEW_CLIENT_APP_ID_INVALID");
  });

  it("accepts only the exact Preview hostname", () => {
    expect(() => assertPreviewClientDomainV1(
      "preview-controlcenter.auranexus.io",
    )).not.toThrow();
    expect(() => assertPreviewClientDomainV1("localhost"))
      .toThrowError("PREVIEW_CLIENT_DOMAIN_MISMATCH");
    expect(() => assertPreviewClientDomainV1("not-preview.example"))
      .toThrowError("PREVIEW_CLIENT_DOMAIN_MISMATCH");
  });
});
