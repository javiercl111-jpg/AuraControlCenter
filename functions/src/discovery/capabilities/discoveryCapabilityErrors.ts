import type { DiscoveryCapabilityErrorCode } from "./discoveryCapabilityTypes";

export class DiscoveryCapabilityError extends Error {
  readonly code: DiscoveryCapabilityErrorCode;
  readonly causeValue?: unknown;
  constructor(
    code: DiscoveryCapabilityErrorCode,
    message: string,
    options: Readonly<{ cause?: unknown }> = {},
  ) {
    super(message);
    this.name = "DiscoveryCapabilityError";
    this.code = code;
    this.causeValue = options.cause;
  }
}

export function isDiscoveryCapabilityError(
  value: unknown,
): value is DiscoveryCapabilityError {
  return value instanceof DiscoveryCapabilityError;
}
