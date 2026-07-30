export const EMULATOR_AUTHORITY_PROJECT_ID =
  "demo-aura-intelligence-os-authority";

interface EmulatorAuthorityEnvironment {
  readonly FIREBASE_CONFIG?: string;
  readonly FIRESTORE_EMULATOR_HOST?: string;
  readonly GCLOUD_PROJECT?: string;
  readonly GOOGLE_APPLICATION_CREDENTIALS?: string;
  readonly GOOGLE_CLOUD_PROJECT?: string;
}

function readFirebaseConfigProjectId(
  firebaseConfig: string | undefined,
): string | undefined {
  if (firebaseConfig === undefined) {
    return undefined;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(firebaseConfig);
  } catch {
    throw new Error(
      "FIREBASE_CONFIG must be valid JSON for emulator certification.",
    );
  }
  if (typeof parsed !== "object" || parsed === null) {
    return undefined;
  }
  const projectId = Reflect.get(parsed, "projectId");
  return typeof projectId === "string" ? projectId : undefined;
}

export function assertAuthorityEmulatorIsolation(
  environment: EmulatorAuthorityEnvironment = process.env,
): Readonly<{
  projectId: string;
  emulatorHost: string;
}> {
  if (
    environment.GOOGLE_APPLICATION_CREDENTIALS !== undefined
  ) {
    throw new Error(
      "GOOGLE_APPLICATION_CREDENTIALS is forbidden for emulator certification.",
    );
  }
  const emulatorHost = environment.FIRESTORE_EMULATOR_HOST;
  if (
    emulatorHost === undefined ||
    !/^(?:127\.0\.0\.1|localhost):[1-9]\d{0,4}$/.test(
      emulatorHost,
    )
  ) {
    throw new Error(
      "FIRESTORE_EMULATOR_HOST must target an explicit loopback port.",
    );
  }
  const projectIds = [
    environment.GCLOUD_PROJECT,
    environment.GOOGLE_CLOUD_PROJECT,
    readFirebaseConfigProjectId(environment.FIREBASE_CONFIG),
  ];
  if (
    projectIds.some(
      (projectId) =>
        projectId !== EMULATOR_AUTHORITY_PROJECT_ID,
    )
  ) {
    throw new Error(
      "Every configured project ID must match the certified demo project.",
    );
  }
  if (
    projectIds.some((projectId) => projectId === undefined) ||
    !EMULATOR_AUTHORITY_PROJECT_ID.startsWith("demo-")
  ) {
    throw new Error(
      "The complete demo project environment is required.",
    );
  }
  return Object.freeze({
    projectId: EMULATOR_AUTHORITY_PROJECT_ID,
    emulatorHost,
  });
}
