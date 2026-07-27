import type { BoundaryPublicError } from './types';

export type BoundaryPublicErrorCode =
  | 'BOUNDARY_DISABLED'
  | 'MODE_NOT_ALLOWED'
  | 'INVALID_REQUEST'
  | 'INVALID_TENANT_CONTEXT'
  | 'INVALID_ACTOR_CONTEXT'
  | 'SOURCE_NOT_ALLOWED'
  | 'PAYLOAD_TOO_LARGE'
  | 'DUPLICATE_REQUEST'
  | 'CONCURRENCY_LIMIT'
  | 'TIMEOUT'
  | 'CANCELLED'
  | 'EXECUTION_FAILED'
  | 'OUTPUT_SANITIZATION_FAILED';

export class GovernedBoundaryError extends Error {
  public readonly code: BoundaryPublicErrorCode;
  public readonly retryable: boolean;
  public readonly details?: Readonly<Record<string, string | number | boolean>>;

  constructor(
    code: BoundaryPublicErrorCode,
    message: string,
    retryable: boolean = false,
    details?: Readonly<Record<string, string | number | boolean>>
  ) {
    super(message);
    this.name = 'GovernedBoundaryError';
    this.code = code;
    this.retryable = retryable;
    this.details = details;
  }
}

export function createPublicError(
  code: BoundaryPublicErrorCode,
  message: string,
  retryable: boolean = false,
  details?: Readonly<Record<string, string | number | boolean>>
): BoundaryPublicError {
  return {
    code,
    message,
    retryable,
    ...(details ? { details } : {}),
  };
}

export default GovernedBoundaryError;
