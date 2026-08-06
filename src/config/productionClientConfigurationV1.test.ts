import { describe, expect, it } from "vitest";

import {
  assertProductionClientDomainV1,
  PRODUCTION_CLIENT_REQUIRED_VARIABLES_V1,
  resolveProductionClientConfigurationV1,
  type ProductionClientEnvironmentSourceV1,
} from "./productionClientConfigurationV1";

const validProductionSource = (): ProductionClientEnvironmentSourceV1 => ({
  VITE_AURA_RUNTIME_ENVIRONMENT: "PRODUCTION",
  VITE_FIREBASE_API_KEY: "AIza-production-public-metadata",
  VITE_FIREBASE_AUTH_DOMAIN: "aura-control-center-debb3.firebaseapp.com",
  VITE_FIREBASE_PROJECT_ID: "aura-control-center-debb3",
  VITE_FIREBASE_MESSAGING_SENDER_ID: "2468135790",
  VITE_FIREBASE_APP_ID: "1:2468135790:web:productionmetadata",
});

describe("Production client configuration contract", () => {
  it("defines the exact minimum Production variable set", () => {
    expect(PRODUCTION_CLIENT_REQUIRED_VARIABLES_V1).toHaveLength(6);
    expect(new Set(PRODUCTION_CLIENT_REQUIRED_VARIABLES_V1).size).toBe(6);
  });

  it("resolves only the authorized Production configuration", () => {
    expect(resolveProductionClientConfigurationV1(validProductionSource()))
      .toMatchObject({
        environment: "PRODUCTION",
        projectId: "aura-control-center-debb3",
        authDomain: "aura-control-center-debb3.firebaseapp.com",
        functionsRegion: "us-central1",
        appCheckEnabled: false,
      });
  });

  it.each(PRODUCTION_CLIENT_REQUIRED_VARIABLES_V1)(
    "fails closed when %s is missing",
    (name) => {
      const source = { ...validProductionSource(), [name]: undefined };
      expect(() => resolveProductionClientConfigurationV1(source))
        .toThrowError("PRODUCTION_CLIENT_VARIABLE_MISSING");
    },
  );

  it("rejects every non-Production environment", () => {
    expect(() => resolveProductionClientConfigurationV1({
      ...validProductionSource(),
      VITE_AURA_RUNTIME_ENVIRONMENT: "PREVIEW",
    })).toThrowError("PRODUCTION_CLIENT_ENVIRONMENT_MISMATCH");
  });

  it("rejects Preview project and auth-domain identifiers", () => {
    expect(() => resolveProductionClientConfigurationV1({
      ...validProductionSource(),
      VITE_FIREBASE_PROJECT_ID: "aura-intel-preview",
    })).toThrowError("PRODUCTION_CLIENT_PROJECT_MISMATCH");
    expect(() => resolveProductionClientConfigurationV1({
      ...validProductionSource(),
      VITE_FIREBASE_AUTH_DOMAIN: "aura-intel-preview.firebaseapp.com",
    })).toThrowError("PRODUCTION_CLIENT_AUTH_DOMAIN_MISMATCH");
  });

  it("rejects malformed Firebase identifiers", () => {
    expect(() => resolveProductionClientConfigurationV1({
      ...validProductionSource(),
      VITE_FIREBASE_API_KEY: "invalid",
    })).toThrowError("PRODUCTION_CLIENT_API_KEY_INVALID");
    expect(() => resolveProductionClientConfigurationV1({
      ...validProductionSource(),
      VITE_FIREBASE_MESSAGING_SENDER_ID: "not-numeric",
    })).toThrowError("PRODUCTION_CLIENT_SENDER_ID_INVALID");
    expect(() => resolveProductionClientConfigurationV1({
      ...validProductionSource(),
      VITE_FIREBASE_APP_ID: "mismatched",
    })).toThrowError("PRODUCTION_CLIENT_APP_ID_INVALID");
  });

  it("accepts only the exact Production hostname", () => {
    expect(() => assertProductionClientDomainV1(
      "controlcenter.auranexus.io",
    )).not.toThrow();
    expect(() => assertProductionClientDomainV1(
      "preview-controlcenter.auranexus.io",
    )).toThrowError("PRODUCTION_CLIENT_DOMAIN_MISMATCH");
    expect(() => assertProductionClientDomainV1("localhost"))
      .toThrowError("PRODUCTION_CLIENT_DOMAIN_MISMATCH");
  });
});
