export const PRODUCTION_CLIENT_PROJECT_ID_V1 =
  "aura-control-center-debb3" as const;

export const PRODUCTION_CLIENT_AUTH_DOMAIN_V1 =
  "aura-control-center-debb3.firebaseapp.com" as const;

export const PRODUCTION_CLIENT_DOMAIN_V1 =
  "controlcenter.auranexus.io" as const;


export const PRODUCTION_CLIENT_REQUIRED_VARIABLES_V1 = Object.freeze([
  "VITE_AURA_RUNTIME_ENVIRONMENT",
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
  "VITE_RECAPTCHA_SITE_KEY",
] as const);


export type ProductionClientRequiredVariableV1 =
  (typeof PRODUCTION_CLIENT_REQUIRED_VARIABLES_V1)[number];


export type ProductionClientConfigurationErrorCodeV1 =
  | "PRODUCTION_CLIENT_VARIABLE_MISSING"
  | "PRODUCTION_CLIENT_ENVIRONMENT_MISMATCH"
  | "PRODUCTION_CLIENT_PROJECT_MISMATCH"
  | "PRODUCTION_CLIENT_AUTH_DOMAIN_MISMATCH"
  | "PRODUCTION_CLIENT_API_KEY_INVALID"
  | "PRODUCTION_CLIENT_SENDER_ID_INVALID"
  | "PRODUCTION_CLIENT_APP_ID_INVALID"
  | "PRODUCTION_CLIENT_DOMAIN_MISMATCH";


export class ProductionClientConfigurationErrorV1 extends Error {
  readonly code: ProductionClientConfigurationErrorCodeV1;

  constructor(code: ProductionClientConfigurationErrorCodeV1) {
    super(code);

    this.name =
      "ProductionClientConfigurationErrorV1";

    this.code =
      code;
  }
}


export type ProductionClientEnvironmentSourceV1 = Readonly<
  Partial<Record<ProductionClientRequiredVariableV1, string>>
>;


export interface ProductionClientConfigurationV1 {
  readonly environment: "PRODUCTION";
  readonly apiKey: string;
  readonly authDomain: typeof PRODUCTION_CLIENT_AUTH_DOMAIN_V1;
  readonly projectId: typeof PRODUCTION_CLIENT_PROJECT_ID_V1;
  readonly messagingSenderId: string;
  readonly appId: string;
  readonly functionsRegion: "us-central1";
  readonly recaptchaSiteKey: string;
  readonly appCheckEnabled: true;
}


function requiredValue(
  source: ProductionClientEnvironmentSourceV1,
  name: ProductionClientRequiredVariableV1,
): string {
  const value =
    source[name]?.trim();

  if (!value) {
    throw new ProductionClientConfigurationErrorV1(
      "PRODUCTION_CLIENT_VARIABLE_MISSING",
    );
  }

  return value;
}


export function resolveProductionClientConfigurationV1(
  source: ProductionClientEnvironmentSourceV1,
): Readonly<ProductionClientConfigurationV1> {
  const values =
    Object.fromEntries(
      PRODUCTION_CLIENT_REQUIRED_VARIABLES_V1.map(
        (name) => [
          name,
          requiredValue(
            source,
            name,
          ),
        ],
      ),
    ) as Record<
      ProductionClientRequiredVariableV1,
      string
    >;


  if (
    values.VITE_AURA_RUNTIME_ENVIRONMENT !==
    "PRODUCTION"
  ) {
    throw new ProductionClientConfigurationErrorV1(
      "PRODUCTION_CLIENT_ENVIRONMENT_MISMATCH",
    );
  }


  if (
    values.VITE_FIREBASE_PROJECT_ID !==
    PRODUCTION_CLIENT_PROJECT_ID_V1
  ) {
    throw new ProductionClientConfigurationErrorV1(
      "PRODUCTION_CLIENT_PROJECT_MISMATCH",
    );
  }


  if (
    values.VITE_FIREBASE_AUTH_DOMAIN !==
    PRODUCTION_CLIENT_AUTH_DOMAIN_V1
  ) {
    throw new ProductionClientConfigurationErrorV1(
      "PRODUCTION_CLIENT_AUTH_DOMAIN_MISMATCH",
    );
  }


  if (
    !values.VITE_FIREBASE_API_KEY.startsWith(
      "AIza",
    )
  ) {
    throw new ProductionClientConfigurationErrorV1(
      "PRODUCTION_CLIENT_API_KEY_INVALID",
    );
  }


  if (
    !/^\d+$/.test(
      values.VITE_FIREBASE_MESSAGING_SENDER_ID,
    )
  ) {
    throw new ProductionClientConfigurationErrorV1(
      "PRODUCTION_CLIENT_SENDER_ID_INVALID",
    );
  }


  if (
    !values.VITE_FIREBASE_APP_ID.startsWith(
      `1:${values.VITE_FIREBASE_MESSAGING_SENDER_ID}:web:`,
    )
  ) {
    throw new ProductionClientConfigurationErrorV1(
      "PRODUCTION_CLIENT_APP_ID_INVALID",
    );
  }


  return Object.freeze({
    environment:
      "PRODUCTION",

    apiKey:
      values.VITE_FIREBASE_API_KEY,

    authDomain:
      PRODUCTION_CLIENT_AUTH_DOMAIN_V1,

    projectId:
      PRODUCTION_CLIENT_PROJECT_ID_V1,

    messagingSenderId:
      values.VITE_FIREBASE_MESSAGING_SENDER_ID,

    appId:
      values.VITE_FIREBASE_APP_ID,

    functionsRegion:
      "us-central1",

    recaptchaSiteKey:
      values.VITE_RECAPTCHA_SITE_KEY,

    appCheckEnabled:
      true,
  });
}


export function assertProductionClientDomainV1(
  hostname: string,
): void {
  if (
    hostname.trim().toLowerCase() !==
    PRODUCTION_CLIENT_DOMAIN_V1
  ) {
    throw new ProductionClientConfigurationErrorV1(
      "PRODUCTION_CLIENT_DOMAIN_MISMATCH",
    );
  }
}