export const PREVIEW_CLIENT_PROJECT_ID_V1 = "aura-intel-preview" as const;
export const PREVIEW_CLIENT_AUTH_DOMAIN_V1 =
  "aura-intel-preview.firebaseapp.com" as const;
export const PREVIEW_CLIENT_DOMAIN_V1 =
  "preview-controlcenter.auranexus.io" as const;

const PREVIEW_CLIENT_IMMUTABLE_DEPLOYMENT_DOMAIN_PATTERN_V1 =
  /^aura-control-center-[a-z0-9]{9}-javiers-projects-eab33ae8\.vercel\.app$/u;

export const PREVIEW_CLIENT_REQUIRED_VARIABLES_V1 = Object.freeze([
  "VITE_AURA_RUNTIME_ENVIRONMENT",
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
  "VITE_RECAPTCHA_SITE_KEY",
] as const);

export type PreviewClientRequiredVariableV1 =
  (typeof PREVIEW_CLIENT_REQUIRED_VARIABLES_V1)[number];

export type PreviewClientConfigurationErrorCodeV1 =
  | "PREVIEW_CLIENT_VARIABLE_MISSING"
  | "PREVIEW_CLIENT_ENVIRONMENT_MISMATCH"
  | "PREVIEW_CLIENT_PROJECT_MISMATCH"
  | "PREVIEW_CLIENT_AUTH_DOMAIN_MISMATCH"
  | "PREVIEW_CLIENT_API_KEY_INVALID"
  | "PREVIEW_CLIENT_SENDER_ID_INVALID"
  | "PREVIEW_CLIENT_APP_ID_INVALID"
  | "PREVIEW_CLIENT_DOMAIN_MISMATCH";

export class PreviewClientConfigurationErrorV1 extends Error {
  readonly code: PreviewClientConfigurationErrorCodeV1;

  constructor(code: PreviewClientConfigurationErrorCodeV1) {
    super(code);
    this.name = "PreviewClientConfigurationErrorV1";
    this.code = code;
  }
}

export type PreviewClientEnvironmentSourceV1 = Readonly<
  Partial<Record<PreviewClientRequiredVariableV1, string>>
>;

export interface PreviewClientConfigurationV1 {
  readonly environment: "PREVIEW";
  readonly apiKey: string;
  readonly authDomain: typeof PREVIEW_CLIENT_AUTH_DOMAIN_V1;
  readonly projectId: typeof PREVIEW_CLIENT_PROJECT_ID_V1;
  readonly messagingSenderId: string;
  readonly appId: string;
  readonly recaptchaSiteKey: string;
  readonly functionsRegion: "us-central1";
  readonly appCheckDebugEnabled: false;
}

function requiredValue(
  source: PreviewClientEnvironmentSourceV1,
  name: PreviewClientRequiredVariableV1,
): string {
  const value = source[name]?.trim();
  if (!value) {
    throw new PreviewClientConfigurationErrorV1(
      "PREVIEW_CLIENT_VARIABLE_MISSING",
    );
  }
  return value;
}

export function resolvePreviewClientConfigurationV1(
  source: PreviewClientEnvironmentSourceV1,
): Readonly<PreviewClientConfigurationV1> {
  const values = Object.fromEntries(
    PREVIEW_CLIENT_REQUIRED_VARIABLES_V1.map((name) => [
      name,
      requiredValue(source, name),
    ]),
  ) as Record<PreviewClientRequiredVariableV1, string>;

  if (values.VITE_AURA_RUNTIME_ENVIRONMENT !== "PREVIEW") {
    throw new PreviewClientConfigurationErrorV1(
      "PREVIEW_CLIENT_ENVIRONMENT_MISMATCH",
    );
  }
  if (values.VITE_FIREBASE_PROJECT_ID !== PREVIEW_CLIENT_PROJECT_ID_V1) {
    throw new PreviewClientConfigurationErrorV1(
      "PREVIEW_CLIENT_PROJECT_MISMATCH",
    );
  }
  if (values.VITE_FIREBASE_AUTH_DOMAIN !== PREVIEW_CLIENT_AUTH_DOMAIN_V1) {
    throw new PreviewClientConfigurationErrorV1(
      "PREVIEW_CLIENT_AUTH_DOMAIN_MISMATCH",
    );
  }
  if (!values.VITE_FIREBASE_API_KEY.startsWith("AIza")) {
    throw new PreviewClientConfigurationErrorV1(
      "PREVIEW_CLIENT_API_KEY_INVALID",
    );
  }
  if (!/^\d+$/.test(values.VITE_FIREBASE_MESSAGING_SENDER_ID)) {
    throw new PreviewClientConfigurationErrorV1(
      "PREVIEW_CLIENT_SENDER_ID_INVALID",
    );
  }
  if (
    !values.VITE_FIREBASE_APP_ID.startsWith(
      `1:${values.VITE_FIREBASE_MESSAGING_SENDER_ID}:web:`,
    )
  ) {
    throw new PreviewClientConfigurationErrorV1(
      "PREVIEW_CLIENT_APP_ID_INVALID",
    );
  }

  return Object.freeze({
    environment: "PREVIEW",
    apiKey: values.VITE_FIREBASE_API_KEY,
    authDomain: PREVIEW_CLIENT_AUTH_DOMAIN_V1,
    projectId: PREVIEW_CLIENT_PROJECT_ID_V1,
    messagingSenderId: values.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: values.VITE_FIREBASE_APP_ID,
    recaptchaSiteKey: values.VITE_RECAPTCHA_SITE_KEY,
    functionsRegion: "us-central1",
    appCheckDebugEnabled: false,
  });
}

export function assertPreviewClientDomainV1(hostname: string): void {
  const normalizedHostname = hostname.trim().toLowerCase();
  const isCanonicalPreviewDomain =
    normalizedHostname === PREVIEW_CLIENT_DOMAIN_V1;
  const isImmutablePreviewDeploymentDomain =
    PREVIEW_CLIENT_IMMUTABLE_DEPLOYMENT_DOMAIN_PATTERN_V1.test(
      normalizedHostname,
    );

  if (!isCanonicalPreviewDomain && !isImmutablePreviewDeploymentDomain) {
    throw new PreviewClientConfigurationErrorV1(
      "PREVIEW_CLIENT_DOMAIN_MISMATCH",
    );
  }
}
