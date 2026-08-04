import type { Firestore } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { FirestoreStructuredAbuseTelemetryRepository } from
  "../../infrastructure/firestore/discoveryTelemetry";
import { StructuredAbuseTelemetryRecorder } from
  "./StructuredAbuseTelemetryRecorder";
import type {
  StructuredAbuseEnvironment,
  StructuredAbuseTelemetryCommandV1,
} from "./structuredAbuseTelemetryTypes";

type RuntimeTelemetryCommand = Omit<
  StructuredAbuseTelemetryCommandV1,
  "environment"
> & { readonly environment?: StructuredAbuseEnvironment };

export function resolveStructuredAbuseEnvironmentV1(): StructuredAbuseEnvironment {
  const project = process.env.GCLOUD_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT ?? "";
  if (process.env.FIRESTORE_EMULATOR_HOST || project.startsWith("demo-")) return "TEST";
  if (/staging|sandbox|test/i.test(project)) return "STAGING";
  if (!project || process.env.NODE_ENV !== "production") return "DEVELOPMENT";
  return "PRODUCTION";
}

export async function recordDiscoveryTelemetrySafe(
  db: Firestore,
  command: RuntimeTelemetryCommand,
): Promise<"CREATED" | "REPLAY" | "FAILED"> {
  try {
    const recorder = new StructuredAbuseTelemetryRecorder(
      new FirestoreStructuredAbuseTelemetryRepository(db),
    );
    const result = await recorder.record({
      ...command,
      environment: command.environment ?? resolveStructuredAbuseEnvironmentV1(),
    });
    return result.decision;
  } catch {
    logger.warn("DISCOVERY_TELEMETRY_WRITE_FAILED", {
      reasonCode: "TELEMETRY_WRITE_FAILED",
      component: command.component,
    });
    return "FAILED";
  }
}
