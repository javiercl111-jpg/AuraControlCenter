export const ExecutiveDiscoveryTransportErrorCode = {
  INVALID_REQUEST: "INVALID_REQUEST",
  INVALID_EVIDENCE: "INVALID_EVIDENCE",
  UNSUPPORTED_SCHEMA_VERSION: "UNSUPPORTED_SCHEMA_VERSION",
  AUTHENTICATION_REQUIRED: "AUTHENTICATION_REQUIRED",
  ACCESS_FORBIDDEN: "ACCESS_FORBIDDEN",
  REQUEST_REJECTED: "REQUEST_REJECTED",
  TIMEOUT: "TIMEOUT",
  ABORTED: "ABORTED",
  NETWORK_FAILURE: "NETWORK_FAILURE",
  SERVICE_FAILURE: "SERVICE_FAILURE",
  INVALID_RESPONSE: "INVALID_RESPONSE",
  INVALID_DIAGNOSIS: "INVALID_DIAGNOSIS",
} as const;

export type ExecutiveDiscoveryTransportErrorCode =
  (typeof ExecutiveDiscoveryTransportErrorCode)[keyof typeof ExecutiveDiscoveryTransportErrorCode];

export interface ExecutiveDiscoveryTransportErrorOptions {
  readonly code: ExecutiveDiscoveryTransportErrorCode;
  readonly message: string;
  readonly retryable: boolean;
  readonly httpStatus?: number;
  readonly correlationId?: string;
}

/** Safe public error. It deliberately carries no response body, token, stack source or provider detail. */
export class ExecutiveDiscoveryTransportError extends Error {
  public readonly code: ExecutiveDiscoveryTransportErrorCode;
  public readonly retryable: boolean;
  public readonly httpStatus?: number;
  public readonly correlationId?: string;

  public constructor(options: ExecutiveDiscoveryTransportErrorOptions) {
    super(options.message);
    this.name = "ExecutiveDiscoveryTransportError";
    this.code = options.code;
    this.retryable = options.retryable;
    this.httpStatus = options.httpStatus;
    this.correlationId = options.correlationId;
  }
}

