import {
  assertPreviewClientDomainV1,
  resolvePreviewClientConfigurationV1,
  type PreviewClientConfigurationV1,
  type PreviewClientEnvironmentSourceV1,
} from "./previewClientConfigurationV1";
import {
  assertProductionClientDomainV1,
  resolveProductionClientConfigurationV1,
  type ProductionClientConfigurationV1,
  type ProductionClientEnvironmentSourceV1,
} from "./productionClientConfigurationV1";

export type ClientRuntimeEnvironmentV1 = "PREVIEW" | "PRODUCTION";

export type ClientFirebaseEnvironmentSourceV1 =
  PreviewClientEnvironmentSourceV1 &
  ProductionClientEnvironmentSourceV1;

export type ClientFirebaseBootstrapErrorCodeV1 =
  | "CLIENT_RUNTIME_ENVIRONMENT_MISSING"
  | "CLIENT_RUNTIME_ENVIRONMENT_UNSUPPORTED";

export class ClientFirebaseBootstrapErrorV1 extends Error {
  readonly code: ClientFirebaseBootstrapErrorCodeV1;

  constructor(code: ClientFirebaseBootstrapErrorCodeV1) {
    super(code);
    this.name = "ClientFirebaseBootstrapErrorV1";
    this.code = code;
  }
}

export type PreviewFirebaseBootstrapConfigurationV1 = Readonly<
  PreviewClientConfigurationV1 & { readonly appCheckEnabled: true }
>;

export type ClientFirebaseBootstrapConfigurationV1 =
  | PreviewFirebaseBootstrapConfigurationV1
  | Readonly<ProductionClientConfigurationV1>;

export function resolveClientRuntimeEnvironmentV1(
  source: Pick<
    ClientFirebaseEnvironmentSourceV1,
    "VITE_AURA_RUNTIME_ENVIRONMENT"
  >,
): ClientRuntimeEnvironmentV1 {
  const value = source.VITE_AURA_RUNTIME_ENVIRONMENT?.trim();
  if (!value) {
    throw new ClientFirebaseBootstrapErrorV1(
      "CLIENT_RUNTIME_ENVIRONMENT_MISSING",
    );
  }
  if (value !== "PREVIEW" && value !== "PRODUCTION") {
    throw new ClientFirebaseBootstrapErrorV1(
      "CLIENT_RUNTIME_ENVIRONMENT_UNSUPPORTED",
    );
  }
  return value;
}

export function resolveClientFirebaseBootstrapV1(
  source: ClientFirebaseEnvironmentSourceV1,
  hostname?: string,
): ClientFirebaseBootstrapConfigurationV1 {
  const environment = resolveClientRuntimeEnvironmentV1(source);

  if (environment === "PREVIEW") {
    const configuration = resolvePreviewClientConfigurationV1(source);
    if (hostname !== undefined) {
      assertPreviewClientDomainV1(hostname);
    }
    return Object.freeze({
      ...configuration,
      appCheckEnabled: true,
    });
  }

  const configuration = resolveProductionClientConfigurationV1(source);
  if (hostname !== undefined) {
    assertProductionClientDomainV1(hostname);
  }
  return configuration;
}
