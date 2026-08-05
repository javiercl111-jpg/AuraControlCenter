import {
  resolveRuntimeEnvironmentV1,
  type RuntimeEnvironmentSourceV1,
  type RuntimeEnvironmentV1,
} from "./runtimeEnvironmentV1";

export interface DiscoveryRuntimeFeatureGatesV1 {
  readonly structuredResultEnabled: boolean;
  readonly pdfGenerationEnabled: boolean;
  readonly storageEnabled: boolean;
  readonly signedUrlsEnabled: boolean;
  readonly notificationsEnabled: boolean;
  readonly cloudTasksEnabled: boolean;
}

export interface DiscoveryRuntimeContractV1 {
  readonly version: "DISCOVERY_RUNTIME_CONTRACT_V1";
  readonly environment: RuntimeEnvironmentV1;
  readonly features: DiscoveryRuntimeFeatureGatesV1;
}

export const PREVIEW_MVP_FEATURE_GATES_V1 = Object.freeze({
  structuredResultEnabled: true,
  pdfGenerationEnabled: false,
  storageEnabled: false,
  signedUrlsEnabled: false,
  notificationsEnabled: false,
  cloudTasksEnabled: false,
} satisfies DiscoveryRuntimeFeatureGatesV1);

const CLOSED_FEATURE_GATES_V1 = Object.freeze({
  structuredResultEnabled: false,
  pdfGenerationEnabled: false,
  storageEnabled: false,
  signedUrlsEnabled: false,
  notificationsEnabled: false,
  cloudTasksEnabled: false,
} satisfies DiscoveryRuntimeFeatureGatesV1);

export class DiscoveryRuntimeContractErrorV1 extends Error {
  readonly code = "DISCOVERY_RUNTIME_CONTRACT_NOT_AUTHORIZED" as const;

  constructor() {
    super("DISCOVERY_RUNTIME_CONTRACT_NOT_AUTHORIZED");
    this.name = "DiscoveryRuntimeContractErrorV1";
  }
}

export function resolveDiscoveryRuntimeContractV1(
  source: RuntimeEnvironmentSourceV1 = process.env,
): DiscoveryRuntimeContractV1 {
  const environment = resolveRuntimeEnvironmentV1(source);
  const features = environment === "PREVIEW" || environment === "LOCAL_DEMO"
    ? PREVIEW_MVP_FEATURE_GATES_V1
    : CLOSED_FEATURE_GATES_V1;
  return Object.freeze({
    version: "DISCOVERY_RUNTIME_CONTRACT_V1" as const,
    environment,
    features,
  });
}

export function assertStructuredResultOnlyContractV1(
  contract: DiscoveryRuntimeContractV1,
): void {
  const features = contract.features;
  if (
    !features.structuredResultEnabled ||
    features.pdfGenerationEnabled ||
    features.storageEnabled ||
    features.signedUrlsEnabled ||
    features.notificationsEnabled ||
    features.cloudTasksEnabled
  ) {
    throw new DiscoveryRuntimeContractErrorV1();
  }
}
