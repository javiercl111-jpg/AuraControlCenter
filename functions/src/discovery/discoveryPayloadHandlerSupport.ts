import { HttpsError } from "firebase-functions/v2/https";
import { DiscoveryPayloadError } from "./payloadBounds";

export function toDiscoveryPayloadHttpsError(error: unknown): HttpsError | null {
  if (!(error instanceof DiscoveryPayloadError)) return null;
  if (error.code === "CONVERSATION_BUDGET_EXCEEDED" ||
      error.code === "REPORT_BUDGET_EXCEEDED" ||
      error.code === "DOWNLOAD_LIMIT_EXCEEDED") {
    return new HttpsError("resource-exhausted", error.code);
  }
  if (error.code === "COST_BOUND_CONFIGURATION_ERROR") {
    return new HttpsError("internal", error.code);
  }
  return new HttpsError("invalid-argument", error.code);
}
