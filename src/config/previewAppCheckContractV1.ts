export const PREVIEW_APP_CHECK_ENVIRONMENT_VARIABLE_V1 =
  "VITE_AURA_RUNTIME_ENVIRONMENT" as const;

export const PREVIEW_APP_CHECK_SITE_KEY_VARIABLE_V1 =
  "VITE_FIREBASE_APPCHECK_RECAPTCHA_ENTERPRISE_SITE_KEY" as const;

export const FRONTEND_RUNTIME_ENVIRONMENTS_V1 = Object.freeze([
  "LOCAL_DEMO",
  "PREVIEW",
  "STAGING",
  "PRODUCTION",
] as const);

export type FrontendRuntimeEnvironmentV1 =
  (typeof FRONTEND_RUNTIME_ENVIRONMENTS_V1)[number];

export type PreviewAppCheckContractErrorCodeV1 =
  | "APP_CHECK_RUNTIME_ENVIRONMENT_MISSING"
  | "APP_CHECK_RUNTIME_ENVIRONMENT_UNKNOWN"
  | "APP_CHECK_RUNTIME_PROJECT_MISSING"
  | "APP_CHECK_RUNTIME_PROJECT_MISMATCH"
  | "APP_CHECK_PREVIEW_SITE_KEY_MISSING"
  | "APP_CHECK_INITIALIZATION_FAILED";

export class PreviewAppCheckContractErrorV1 extends Error {
  readonly code: PreviewAppCheckContractErrorCodeV1;

  constructor(code: PreviewAppCheckContractErrorCodeV1) {
    super(code);
    this.name = "PreviewAppCheckContractErrorV1";
    this.code = code;
  }
}

export interface PreviewAppCheckEnvironmentSourceV1 {
  readonly VITE_AURA_RUNTIME_ENVIRONMENT?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_APPCHECK_RECAPTCHA_ENTERPRISE_SITE_KEY?: string;
}

export type PreviewAppCheckConfigurationV1 = Readonly<
  | {
      enabled: false;
      environment: Exclude<FrontendRuntimeEnvironmentV1, "PREVIEW">;
    }
  | {
      enabled: true;
      environment: "PREVIEW";
      provider: "RECAPTCHA_ENTERPRISE";
      siteKey: string;
      debugEnabled: false;
    }
>;

const PROJECT_BY_ENVIRONMENT = Object.freeze({
  PREVIEW: "aura-intel-preview",
  STAGING: "aura-intel-staging",
  PRODUCTION: "aura-control-center-debb3",
} as const);

function normalized(value: string | undefined): string | null {
  const result = value?.trim();
  return result ? result : null;
}

function resolveEnvironment(
  source: PreviewAppCheckEnvironmentSourceV1,
): FrontendRuntimeEnvironmentV1 {
  const value = normalized(source.VITE_AURA_RUNTIME_ENVIRONMENT);
  if (value === null) {
    throw new PreviewAppCheckContractErrorV1(
      "APP_CHECK_RUNTIME_ENVIRONMENT_MISSING",
    );
  }
  if (!(FRONTEND_RUNTIME_ENVIRONMENTS_V1 as readonly string[]).includes(value)) {
    throw new PreviewAppCheckContractErrorV1(
      "APP_CHECK_RUNTIME_ENVIRONMENT_UNKNOWN",
    );
  }
  return value as FrontendRuntimeEnvironmentV1;
}

export function resolvePreviewAppCheckConfigurationV1(
  source: PreviewAppCheckEnvironmentSourceV1,
): PreviewAppCheckConfigurationV1 {
  const environment = resolveEnvironment(source);
  const projectId = normalized(source.VITE_FIREBASE_PROJECT_ID);
  if (projectId === null) {
    throw new PreviewAppCheckContractErrorV1(
      "APP_CHECK_RUNTIME_PROJECT_MISSING",
    );
  }

  if (environment === "LOCAL_DEMO") {
    if (!projectId.startsWith("demo-")) {
      throw new PreviewAppCheckContractErrorV1(
        "APP_CHECK_RUNTIME_PROJECT_MISMATCH",
      );
    }
    return Object.freeze({ enabled: false, environment });
  }

  if (projectId !== PROJECT_BY_ENVIRONMENT[environment]) {
    throw new PreviewAppCheckContractErrorV1(
      "APP_CHECK_RUNTIME_PROJECT_MISMATCH",
    );
  }

  if (environment !== "PREVIEW") {
    return Object.freeze({ enabled: false, environment });
  }

  const siteKey = normalized(
    source.VITE_FIREBASE_APPCHECK_RECAPTCHA_ENTERPRISE_SITE_KEY,
  );
  if (siteKey === null) {
    throw new PreviewAppCheckContractErrorV1(
      "APP_CHECK_PREVIEW_SITE_KEY_MISSING",
    );
  }

  return Object.freeze({
    enabled: true,
    environment,
    provider: "RECAPTCHA_ENTERPRISE",
    siteKey,
    debugEnabled: false,
  });
}
