export const PREVIEW_APP_CHECK_ENVIRONMENT_VARIABLE_V1 =
  "VITE_AURA_RUNTIME_ENVIRONMENT" as const;

export const PREVIEW_APP_CHECK_SITE_KEY_VARIABLE_V1 =
  "VITE_RECAPTCHA_SITE_KEY" as const;

export type PreviewAppCheckContractErrorCodeV1 =
  | "APP_CHECK_RUNTIME_ENVIRONMENT_MISSING"
  | "APP_CHECK_RUNTIME_ENVIRONMENT_NOT_PREVIEW"
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
  readonly VITE_RECAPTCHA_SITE_KEY?: string;
}

export type PreviewAppCheckConfigurationV1 = Readonly<{
  enabled: true;
  environment: "PREVIEW";
  provider: "RECAPTCHA_ENTERPRISE";
  siteKey: string;
  debugEnabled: false;
}>;

function normalized(value: string | undefined): string | null {
  const result = value?.trim();
  return result ? result : null;
}

function resolveEnvironment(
  source: PreviewAppCheckEnvironmentSourceV1,
): "PREVIEW" {
  const value = normalized(source.VITE_AURA_RUNTIME_ENVIRONMENT);
  if (value === null) {
    throw new PreviewAppCheckContractErrorV1(
      "APP_CHECK_RUNTIME_ENVIRONMENT_MISSING",
    );
  }
  if (value !== "PREVIEW") {
    throw new PreviewAppCheckContractErrorV1(
      "APP_CHECK_RUNTIME_ENVIRONMENT_NOT_PREVIEW",
    );
  }
  return value;
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

  if (projectId !== "aura-intel-preview") {
    throw new PreviewAppCheckContractErrorV1(
      "APP_CHECK_RUNTIME_PROJECT_MISMATCH",
    );
  }

  const siteKey = normalized(source.VITE_RECAPTCHA_SITE_KEY);
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
