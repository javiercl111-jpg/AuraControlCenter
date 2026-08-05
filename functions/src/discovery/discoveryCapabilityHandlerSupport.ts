import { HttpsError } from "firebase-functions/v2/https";

import {
  DiscoveryCapabilityError,
} from "./capabilities";

export function toDiscoveryCapabilityHttpsError(
  error: unknown,
): HttpsError {
  if (!(error instanceof DiscoveryCapabilityError)) {
    return new HttpsError("internal", "COMPLETION_INTERNAL_FAILURE");
  }
  const permissionDenied = new Set([
    "CAPABILITY_NOT_FOUND",
    "CAPABILITY_TYPE_MISMATCH",
    "CAPABILITY_BINDING_MISMATCH",
    "CAPABILITY_GENERATION_MISMATCH",
    "REPORT_CAPABILITY_REQUIRED",
  ]);
  const failedPrecondition = new Set([
    "CAPABILITY_EXPIRED",
    "CAPABILITY_REVOKED",
    "CAPABILITY_ALREADY_CONSUMED",
    "SESSION_ALREADY_COMPLETED",
  ]);
  const status = permissionDenied.has(error.code)
    ? "permission-denied"
    : failedPrecondition.has(error.code)
      ? "failed-precondition"
      : error.code === "COMPLETION_REQUEST_CONFLICT"
        ? "already-exists"
        : "internal";
  return new HttpsError(status, error.code);
}
