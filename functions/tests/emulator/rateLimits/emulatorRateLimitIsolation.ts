export const EMULATOR_RATE_LIMIT_PROJECT_ID =
  "demo-aura-public-rate-limits" as const;

export interface EmulatorRateLimitIsolation {
  readonly projectId: typeof EMULATOR_RATE_LIMIT_PROJECT_ID;
  readonly emulatorHost: string;
}

function projectIdFromFirebaseConfig(
  serializedConfig: string | undefined,
): string | undefined {
  if (serializedConfig === undefined) return undefined;
  const parsed = JSON.parse(serializedConfig) as {
    projectId?: unknown;
  };
  return typeof parsed.projectId === "string"
    ? parsed.projectId
    : undefined;
}

export function assertRateLimitEmulatorIsolation(
  environment: NodeJS.ProcessEnv = process.env,
): EmulatorRateLimitIsolation {
  if (environment.GOOGLE_APPLICATION_CREDENTIALS !== undefined) {
    throw new Error(
      "GOOGLE_APPLICATION_CREDENTIALS is forbidden for rate-limit emulator tests.",
    );
  }
  const emulatorHost = environment.FIRESTORE_EMULATOR_HOST;
  if (
    typeof emulatorHost !== "string" ||
    !/^127\.0\.0\.1:\d+$/.test(emulatorHost)
  ) {
    throw new Error(
      "FIRESTORE_EMULATOR_HOST must target an explicit loopback port.",
    );
  }
  const configuredProjectIds = [
    environment.GCLOUD_PROJECT,
    environment.GOOGLE_CLOUD_PROJECT,
    projectIdFromFirebaseConfig(environment.FIREBASE_CONFIG),
  ];
  if (
    configuredProjectIds.some(
      (projectId) => projectId !== EMULATOR_RATE_LIMIT_PROJECT_ID,
    )
  ) {
    throw new Error(
      "Rate-limit emulator project configuration is inconsistent.",
    );
  }
  return Object.freeze({
    projectId: EMULATOR_RATE_LIMIT_PROJECT_ID,
    emulatorHost,
  });
}
