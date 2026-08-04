import type { DiscoveryContainmentErrorCode } from "./discoveryContainmentTypes";

export class DiscoveryContainmentError extends Error {
  constructor(
    readonly code: DiscoveryContainmentErrorCode,
    message: string = code,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "DiscoveryContainmentError";
  }
}

export function isDiscoveryContainmentError(
  error: unknown,
): error is DiscoveryContainmentError {
  return error instanceof DiscoveryContainmentError;
}
