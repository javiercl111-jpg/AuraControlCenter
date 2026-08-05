export const RUNTIME_ENVIRONMENTS_V1 = Object.freeze([
  "LOCAL_DEMO",
  "PREVIEW",
  "STAGING",
  "PRODUCTION",
] as const);

export type RuntimeEnvironmentV1 =
  (typeof RUNTIME_ENVIRONMENTS_V1)[number];

export const RUNTIME_ENVIRONMENT_VARIABLE_V1 =
  "AURA_RUNTIME_ENVIRONMENT" as const;

export type RuntimeEnvironmentErrorCodeV1 =
  | "RUNTIME_ENVIRONMENT_MISSING"
  | "RUNTIME_ENVIRONMENT_UNKNOWN"
  | "RUNTIME_PROJECT_MISSING"
  | "RUNTIME_PROJECT_CONFLICT"
  | "RUNTIME_ENVIRONMENT_PROJECT_MISMATCH";

export class RuntimeEnvironmentErrorV1 extends Error {
  readonly code: RuntimeEnvironmentErrorCodeV1;

  constructor(code: RuntimeEnvironmentErrorCodeV1) {
    super(code);
    this.name = "RuntimeEnvironmentErrorV1";
    this.code = code;
  }
}

export interface RuntimeEnvironmentSourceV1 {
  readonly AURA_RUNTIME_ENVIRONMENT?: string;
  readonly GCLOUD_PROJECT?: string;
  readonly GOOGLE_CLOUD_PROJECT?: string;
  readonly FIRESTORE_EMULATOR_HOST?: string;
}

const PROJECT_BY_ENVIRONMENT = Object.freeze({
  PREVIEW: "aura-intel-preview",
  STAGING: "aura-intel-staging",
  PRODUCTION: "aura-control-center-debb3",
} as const);

function nonEmpty(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function projectId(source: RuntimeEnvironmentSourceV1): string {
  const gcloudProject = nonEmpty(source.GCLOUD_PROJECT);
  const googleCloudProject = nonEmpty(source.GOOGLE_CLOUD_PROJECT);
  if (
    gcloudProject !== null && googleCloudProject !== null &&
    gcloudProject !== googleCloudProject
  ) {
    throw new RuntimeEnvironmentErrorV1("RUNTIME_PROJECT_CONFLICT");
  }
  const resolved = gcloudProject ?? googleCloudProject;
  if (resolved === null) {
    throw new RuntimeEnvironmentErrorV1("RUNTIME_PROJECT_MISSING");
  }
  return resolved;
}

function requestedEnvironment(
  source: RuntimeEnvironmentSourceV1,
): RuntimeEnvironmentV1 {
  const requested = nonEmpty(source.AURA_RUNTIME_ENVIRONMENT);
  if (requested === null) {
    throw new RuntimeEnvironmentErrorV1("RUNTIME_ENVIRONMENT_MISSING");
  }
  if (!(RUNTIME_ENVIRONMENTS_V1 as readonly string[]).includes(requested)) {
    throw new RuntimeEnvironmentErrorV1("RUNTIME_ENVIRONMENT_UNKNOWN");
  }
  return requested as RuntimeEnvironmentV1;
}

export function resolveRuntimeEnvironmentV1(
  source: RuntimeEnvironmentSourceV1 = process.env,
): RuntimeEnvironmentV1 {
  const environment = requestedEnvironment(source);
  const project = projectId(source);

  if (environment === "LOCAL_DEMO") {
    if (
      !project.startsWith("demo-") ||
      nonEmpty(source.FIRESTORE_EMULATOR_HOST) === null
    ) {
      throw new RuntimeEnvironmentErrorV1(
        "RUNTIME_ENVIRONMENT_PROJECT_MISMATCH",
      );
    }
    return environment;
  }

  if (project !== PROJECT_BY_ENVIRONMENT[environment]) {
    throw new RuntimeEnvironmentErrorV1(
      "RUNTIME_ENVIRONMENT_PROJECT_MISMATCH",
    );
  }
  return environment;
}

export function isRuntimeEnvironmentErrorV1(
  error: unknown,
): error is RuntimeEnvironmentErrorV1 {
  return error instanceof RuntimeEnvironmentErrorV1;
}
