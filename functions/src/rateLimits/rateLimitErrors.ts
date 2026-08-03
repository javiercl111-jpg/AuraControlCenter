export const RATE_LIMIT_ERROR_CODES = Object.freeze([
  "RATE_LIMIT_EXCEEDED",
  "POLICY_NOT_FOUND",
  "COUNTER_CORRUPTED",
  "CLOCK_ERROR",
  "CONFIGURATION_ERROR",
  "INTERNAL_RATE_LIMIT_FAILURE",
] as const);

export type RateLimitErrorCode =
  (typeof RATE_LIMIT_ERROR_CODES)[number];

export class RateLimitError extends Error {
  readonly code: RateLimitErrorCode;

  constructor(
    code: RateLimitErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "RateLimitError";
    this.code = code;
  }
}

export function isRateLimitError(
  value: unknown,
): value is RateLimitError {
  return value instanceof RateLimitError;
}
