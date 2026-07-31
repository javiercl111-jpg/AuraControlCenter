export const AUTHORITY_END_TO_END_PROJECT_ID =
  "demo-aura-intelligence-os-authority-e2e";
export const AUTHORITY_END_TO_END_EMULATOR_HOST =
  "127.0.0.1:8089";

interface AuthorityEndToEndEnvironment {
  readonly FIREBASE_CONFIG?: string;
  readonly FIRESTORE_EMULATOR_HOST?: string;
  readonly GCLOUD_PROJECT?: string;
  readonly GOOGLE_APPLICATION_CREDENTIALS?: string;
  readonly GOOGLE_CLOUD_PROJECT?: string;
}

function firebaseProjectId(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("D.9 FIREBASE_CONFIG must be valid JSON.");
  }
  if (typeof parsed !== "object" || parsed === null) {
    return undefined;
  }
  const projectId = Reflect.get(parsed, "projectId");
  return typeof projectId === "string" ? projectId : undefined;
}

export function assertAuthorityEndToEndIsolation(
  environment: AuthorityEndToEndEnvironment = process.env,
): Readonly<{ projectId: string; emulatorHost: string }> {
  if (environment.GOOGLE_APPLICATION_CREDENTIALS !== undefined) {
    throw new Error("D.9 forbids GOOGLE_APPLICATION_CREDENTIALS.");
  }
  if (
    environment.FIRESTORE_EMULATOR_HOST !==
      AUTHORITY_END_TO_END_EMULATOR_HOST ||
    !environment.FIRESTORE_EMULATOR_HOST.startsWith("127.0.0.1:")
  ) {
    throw new Error("D.9 requires its certified loopback emulator host.");
  }
  const projectIds = [
    environment.GCLOUD_PROJECT,
    environment.GOOGLE_CLOUD_PROJECT,
    firebaseProjectId(environment.FIREBASE_CONFIG),
  ];
  if (
    projectIds.some(
      (projectId) => projectId !== AUTHORITY_END_TO_END_PROJECT_ID,
    ) ||
    !AUTHORITY_END_TO_END_PROJECT_ID.startsWith("demo-")
  ) {
    throw new Error("D.9 requires one closed demo project identity.");
  }
  return Object.freeze({
    projectId: AUTHORITY_END_TO_END_PROJECT_ID,
    emulatorHost: AUTHORITY_END_TO_END_EMULATOR_HOST,
  });
}
