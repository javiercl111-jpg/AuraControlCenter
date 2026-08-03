import type {
  DiscoveryIntakeIdempotencyErrorCode,
} from "./discoveryIntakeIdempotencyTypes";

export class DiscoveryIntakeIdempotencyError extends Error {
  readonly code: DiscoveryIntakeIdempotencyErrorCode;
  readonly causeValue?: unknown;

  constructor(
    code: DiscoveryIntakeIdempotencyErrorCode,
    message: string,
    options: Readonly<{ cause?: unknown }> = {},
  ) {
    super(message);
    this.name = "DiscoveryIntakeIdempotencyError";
    this.code = code;
    this.causeValue = options.cause;
  }
}

export function isDiscoveryIntakeIdempotencyError(
  value: unknown,
): value is DiscoveryIntakeIdempotencyError {
  return value instanceof DiscoveryIntakeIdempotencyError;
}
