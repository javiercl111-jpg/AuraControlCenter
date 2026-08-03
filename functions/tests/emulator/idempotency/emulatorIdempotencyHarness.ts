import { generateKeyPairSync } from "node:crypto";

import { cert, deleteApp, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

export const IDEMPOTENCY_EMULATOR_PROJECT_ID =
  "demo-aura-discovery-idempotency";

export interface EmulatorIdempotencyHarness {
  readonly app: App;
  readonly firestore: Firestore;
  clear(): Promise<void>;
  close(): Promise<void>;
}

function assertIsolation(): Readonly<{
  projectId: string;
  emulatorHost: string;
}> {
  const projectId = process.env.GCLOUD_PROJECT ?? "";
  const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST ?? "";
  if (
    projectId !== IDEMPOTENCY_EMULATOR_PROJECT_ID ||
    !projectId.startsWith("demo-") ||
    !/^127\.0\.0\.1:\d+$/.test(emulatorHost) ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS !== undefined
  ) {
    throw new Error("Idempotency tests require the isolated Firestore Emulator.");
  }
  return Object.freeze({ projectId, emulatorHost });
}

function emulatorCredential(projectId: string) {
  const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2_048,
    privateKeyEncoding: { format: "pem", type: "pkcs8" },
    publicKeyEncoding: { format: "pem", type: "spki" },
  });
  return cert({
    projectId,
    clientEmail: `emulator-only@${projectId}.iam.gserviceaccount.com`,
    privateKey,
  });
}

let instance = 0;

export function createEmulatorIdempotencyHarness(): EmulatorIdempotencyHarness {
  const isolation = assertIsolation();
  instance += 1;
  const app = initializeApp(
    {
      projectId: isolation.projectId,
      credential: emulatorCredential(isolation.projectId),
    },
    `idempotency-emulator-${process.pid}-${instance}`,
  );
  const firestore = getFirestore(app);
  return {
    app,
    firestore,
    async clear(): Promise<void> {
      const endpoint =
        `http://${isolation.emulatorHost}/emulator/v1/projects/` +
        `${encodeURIComponent(isolation.projectId)}` +
        "/databases/(default)/documents";
      const response = await fetch(endpoint, { method: "DELETE" });
      if (!response.ok) {
        throw new Error(`Emulator cleanup failed: ${response.status}.`);
      }
    },
    async close(): Promise<void> {
      await firestore.terminate();
      await deleteApp(app);
    },
  };
}
