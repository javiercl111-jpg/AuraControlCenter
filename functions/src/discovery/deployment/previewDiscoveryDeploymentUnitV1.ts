import type { CallableOptions } from "firebase-functions/v2/https";

import {
  resolveRuntimeEnvironmentV1,
  type RuntimeEnvironmentSourceV1,
} from "../runtimeContracts/runtimeEnvironmentV1";

export const PREVIEW_DISCOVERY_PROJECT_ID_V1 = "aura-intel-preview" as const;
export const PREVIEW_DISCOVERY_ENVIRONMENT_V1 = "PREVIEW" as const;
export const PREVIEW_DISCOVERY_REGION_V1 = "us-central1" as const;

export const PREVIEW_DISCOVERY_HANDLER_ALLOWLIST_V1 = Object.freeze([
  "createDiscoveryLead",
  "exchangeDiscoveryToken",
  "resolveDiscoverySession",
  "evaluateConversation",
  "completeDiscoverySession",
] as const);

export type PreviewDiscoveryHandlerNameV1 =
  (typeof PREVIEW_DISCOVERY_HANDLER_ALLOWLIST_V1)[number];

const serviceAccount = (name: string): string =>
  `${name}@${PREVIEW_DISCOVERY_PROJECT_ID_V1}.iam.gserviceaccount.com`;

export const PREVIEW_DISCOVERY_SERVICE_ACCOUNTS_V1 = Object.freeze({
  createDiscoveryLead: serviceAccount("preview-public-intake-runtime"),
  exchangeDiscoveryToken: serviceAccount("preview-discovery-session-rt"),
  resolveDiscoverySession: serviceAccount("preview-discovery-session-rt"),
  evaluateConversation: serviceAccount("preview-conversation-runtime"),
  completeDiscoverySession: serviceAccount("preview-discovery-complete-rt"),
} satisfies Record<PreviewDiscoveryHandlerNameV1, string>);

export interface PreviewDiscoverySecretBindingV1 {
  readonly key: string;
  readonly secret: string;
}

export const PREVIEW_DISCOVERY_SECRET_BINDINGS_V1 = Object.freeze({
  createDiscoveryLead: Object.freeze([
    Object.freeze({
      key: "IDEMPOTENCY_SECRET",
      secret: "discovery-idempotency-secret-preview",
    }),
  ]),
  exchangeDiscoveryToken: Object.freeze([]),
  resolveDiscoverySession: Object.freeze([]),
  evaluateConversation: Object.freeze([
    Object.freeze({
      key: "GEMINI_API_KEY",
      secret: "discovery-gemini-api-key-preview",
    }),
  ]),
  completeDiscoverySession: Object.freeze([
    Object.freeze({
      key: "DISCOVERY_HMAC_SECRET",
      secret: "discovery-hmac-secret-preview",
    }),
  ]),
} satisfies Record<
  PreviewDiscoveryHandlerNameV1,
  readonly PreviewDiscoverySecretBindingV1[]
>);

const callableOptions = (
  handler: PreviewDiscoveryHandlerNameV1,
): Readonly<CallableOptions> => Object.freeze({
  region: PREVIEW_DISCOVERY_REGION_V1,
  serviceAccount: PREVIEW_DISCOVERY_SERVICE_ACCOUNTS_V1[handler],
  enforceAppCheck: true,
});

export const PREVIEW_DISCOVERY_CALLABLE_OPTIONS_V1 = Object.freeze({
  createDiscoveryLead: callableOptions("createDiscoveryLead"),
  exchangeDiscoveryToken: callableOptions("exchangeDiscoveryToken"),
  resolveDiscoverySession: callableOptions("resolveDiscoverySession"),
  evaluateConversation: callableOptions("evaluateConversation"),
  completeDiscoverySession: callableOptions("completeDiscoverySession"),
} satisfies Record<PreviewDiscoveryHandlerNameV1, Readonly<CallableOptions>>);

export const PREVIEW_DISCOVERY_FORBIDDEN_EXPORTS_V1 = Object.freeze([
  "generateDiscoveryReport",
  "requestExecutiveDocument",
  "emitDiscoveryCompletedNotification",
  "markNotificationAsRead",
  "processMarketImportJob",
] as const);

export class PreviewDiscoveryDeploymentUnitErrorV1 extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "PreviewDiscoveryDeploymentUnitErrorV1";
  }
}

export function assertPreviewDiscoveryRuntimeV1(
  source: RuntimeEnvironmentSourceV1 = process.env,
): "PREVIEW" {
  const environment = resolveRuntimeEnvironmentV1(source);
  if (environment !== PREVIEW_DISCOVERY_ENVIRONMENT_V1) {
    throw new PreviewDiscoveryDeploymentUnitErrorV1(
      "PREVIEW_DEPLOYMENT_ENVIRONMENT_REQUIRED",
    );
  }
  return environment;
}

export interface PreviewDiscoveryDeploymentCandidateV1 {
  readonly projectId: string;
  readonly environment: string;
  readonly exports: readonly string[];
  readonly handlers: Readonly<Record<string, {
    readonly region: string;
    readonly serviceAccount: string;
    readonly enforceAppCheck: boolean;
    readonly secretBindings: readonly PreviewDiscoverySecretBindingV1[];
  }>>;
}

function equalSet(actual: readonly string[], expected: readonly string[]): boolean {
  return actual.length === expected.length &&
    [...actual].sort().every((value, index) => value === [...expected].sort()[index]);
}

function equalSecretBindings(
  actual: readonly PreviewDiscoverySecretBindingV1[],
  expected: readonly PreviewDiscoverySecretBindingV1[],
): boolean {
  const serialize = ({ key, secret }: PreviewDiscoverySecretBindingV1): string =>
    `${key}:${secret}`;
  return equalSet(actual.map(serialize), expected.map(serialize));
}

interface PreviewDeployableFunctionV1 {
  readonly __endpoint: {
    secretEnvironmentVariables?: Array<{
      key: string;
      secret?: string;
    }>;
  };
}

export function bindPreviewDiscoverySecretResourcesV1<
  T extends PreviewDeployableFunctionV1,
>(handler: PreviewDiscoveryHandlerNameV1, deployedFunction: T): T {
  const expected = PREVIEW_DISCOVERY_SECRET_BINDINGS_V1[handler];
  const declared = deployedFunction.__endpoint.secretEnvironmentVariables ?? [];
  if (!equalSet(declared.map(({ key }) => key), expected.map(({ key }) => key))) {
    throw new PreviewDiscoveryDeploymentUnitErrorV1(
      "PREVIEW_DEPLOYMENT_DECLARED_SECRET_MISMATCH",
    );
  }
  deployedFunction.__endpoint.secretEnvironmentVariables = expected.map(
    ({ key, secret }) => ({ key, secret }),
  );
  return deployedFunction;
}

export function assertPreviewDiscoveryDeploymentCandidateV1(
  candidate: PreviewDiscoveryDeploymentCandidateV1,
): void {
  if (candidate.projectId !== PREVIEW_DISCOVERY_PROJECT_ID_V1) {
    throw new PreviewDiscoveryDeploymentUnitErrorV1(
      "PREVIEW_DEPLOYMENT_PROJECT_MISMATCH",
    );
  }
  if (candidate.environment !== PREVIEW_DISCOVERY_ENVIRONMENT_V1) {
    throw new PreviewDiscoveryDeploymentUnitErrorV1(
      "PREVIEW_DEPLOYMENT_ENVIRONMENT_MISMATCH",
    );
  }
  if (!equalSet(candidate.exports, PREVIEW_DISCOVERY_HANDLER_ALLOWLIST_V1)) {
    throw new PreviewDiscoveryDeploymentUnitErrorV1(
      "PREVIEW_DEPLOYMENT_EXPORT_ALLOWLIST_MISMATCH",
    );
  }
  for (const forbidden of PREVIEW_DISCOVERY_FORBIDDEN_EXPORTS_V1) {
    if (candidate.exports.includes(forbidden)) {
      throw new PreviewDiscoveryDeploymentUnitErrorV1(
        "PREVIEW_DEPLOYMENT_FORBIDDEN_EXPORT",
      );
    }
  }
  for (const handler of PREVIEW_DISCOVERY_HANDLER_ALLOWLIST_V1) {
    const actual = candidate.handlers[handler];
    if (!actual) {
      throw new PreviewDiscoveryDeploymentUnitErrorV1(
        "PREVIEW_DEPLOYMENT_HANDLER_METADATA_MISSING",
      );
    }
    if (actual.region !== PREVIEW_DISCOVERY_REGION_V1) {
      throw new PreviewDiscoveryDeploymentUnitErrorV1(
        "PREVIEW_DEPLOYMENT_REGION_MISMATCH",
      );
    }
    if (actual.serviceAccount !== PREVIEW_DISCOVERY_SERVICE_ACCOUNTS_V1[handler]) {
      throw new PreviewDiscoveryDeploymentUnitErrorV1(
        "PREVIEW_DEPLOYMENT_SERVICE_ACCOUNT_MISMATCH",
      );
    }
    if (
      actual.serviceAccount.includes("aura-control-center-debb3") ||
      actual.serviceAccount.includes("production")
    ) {
      throw new PreviewDiscoveryDeploymentUnitErrorV1(
        "PREVIEW_DEPLOYMENT_PRODUCTION_IDENTITY_FORBIDDEN",
      );
    }
    if (!actual.enforceAppCheck) {
      throw new PreviewDiscoveryDeploymentUnitErrorV1(
        "PREVIEW_DEPLOYMENT_APP_CHECK_REQUIRED",
      );
    }
    if (!equalSecretBindings(
      actual.secretBindings,
      PREVIEW_DISCOVERY_SECRET_BINDINGS_V1[handler],
    )) {
      throw new PreviewDiscoveryDeploymentUnitErrorV1(
        "PREVIEW_DEPLOYMENT_SECRET_MAPPING_MISMATCH",
      );
    }
  }
}
