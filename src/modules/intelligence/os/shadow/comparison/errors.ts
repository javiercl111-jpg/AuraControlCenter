import type { SerializableAuraOSError } from '../../types';

export const ShadowComparisonErrorCodes = {
  SHADOW_COMPARISON_INVALID_INPUT: 'SHADOW_COMPARISON_INVALID_INPUT',
  SHADOW_COMPARISON_FAILED: 'SHADOW_COMPARISON_FAILED',
  SHADOW_CAPTURE_DISABLED: 'SHADOW_CAPTURE_DISABLED',
  SHADOW_CAPTURE_LIMIT: 'SHADOW_CAPTURE_LIMIT',
  SHADOW_CAPTURE_INVALID_RECORD: 'SHADOW_CAPTURE_INVALID_RECORD'
} as const;

export class ShadowComparisonError extends Error {
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
    this.name = 'ShadowComparisonError';
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
