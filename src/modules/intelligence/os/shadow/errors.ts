import type { SerializableAuraOSError } from '../types';

export const ShadowErrorCodes = {
  SHADOW_EXECUTION_REJECTED: 'SHADOW_EXECUTION_REJECTED',
  SHADOW_DUPLICATE_EXECUTION: 'SHADOW_DUPLICATE_EXECUTION',
  SHADOW_CONCURRENCY_LIMIT: 'SHADOW_CONCURRENCY_LIMIT',
  SHADOW_EXECUTION_TIMEOUT: 'SHADOW_EXECUTION_TIMEOUT',
  SHADOW_INVALID_REQUEST: 'SHADOW_INVALID_REQUEST'
} as const;

export class AuraShadowError extends Error {
  public readonly code: string;
  public readonly retryable: boolean;
  public readonly cause?: unknown;

  constructor(
    code: string,
    message: string,
    retryable: boolean,
    cause?: unknown
  ) {
    super(message);
    this.name = 'AuraShadowError';
    this.code = code;
    this.retryable = retryable;
    this.cause = cause;
  }

  public toJSON(): SerializableAuraOSError {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      retryable: this.retryable,
      cause: this.cause instanceof Error ? { name: this.cause.name, message: this.cause.message } : this.cause
    };
  }
}
