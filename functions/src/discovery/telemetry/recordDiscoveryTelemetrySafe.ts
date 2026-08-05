import type { Firestore } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { FirestoreStructuredAbuseTelemetryRepository } from
  "../../infrastructure/firestore/discoveryTelemetry";
import { StructuredAbuseTelemetryRecorder } from
  "./StructuredAbuseTelemetryRecorder";
import {
  isRuntimeEnvironmentErrorV1,
  resolveRuntimeEnvironmentV1,
} from "../runtimeContracts";
import type {
  StructuredAbuseEnvironment,
  StructuredAbuseTelemetryCommandV1,
} from "./structuredAbuseTelemetryTypes";

type RuntimeTelemetryCommand = Omit<
  StructuredAbuseTelemetryCommandV1,
  "environment"
> & { readonly environment?: StructuredAbuseEnvironment };

export function resolveStructuredAbuseEnvironmentV1(): StructuredAbuseEnvironment {
  return resolveRuntimeEnvironmentV1();
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
  } catch (error: unknown) {
    if (isRuntimeEnvironmentErrorV1(error)) throw error;
    logger.warn("DISCOVERY_TELEMETRY_WRITE_FAILED", {
      reasonCode: "TELEMETRY_WRITE_FAILED",
      component: command.component,
    });
    return "FAILED";
  }
}
