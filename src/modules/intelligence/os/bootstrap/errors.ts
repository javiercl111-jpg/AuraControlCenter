export const PIPELINE_BOOTSTRAP_ERROR_CODES = [
  'INVALID_BOOTSTRAP_INPUT',
  'UNSUPPORTED_SCHEMA_VERSION',
  'INVALID_TARGET_SCENARIO',
  'TARGET_SCENARIO_REQUIRED',
  'EMPTY_FACT_SET',
  'TOO_MANY_FACTS',
  'DUPLICATE_FACT_ID',
  'UNKNOWN_TAXONOMY_CATEGORY',
  'INVALID_FACT_VALUE',
  'INVALID_PROVENANCE',
  'TENANT_CONTEXT_MISMATCH',
  'CORRELATION_CONTEXT_MISMATCH',
  'DUPLICATE_FACT_CONFLICT',
  'UNRESOLVED_FACT_CONFLICT',
  'PAYLOAD_TOO_LARGE',
  'CANCELLED',
  'BOOTSTRAP_FAILED',
] as const;

export type PipelineBootstrapErrorCode =
  (typeof PIPELINE_BOOTSTRAP_ERROR_CODES)[number];

export interface PipelineBootstrapError {
  readonly code: PipelineBootstrapErrorCode;
  readonly message: string;
  readonly retryable: boolean;
}

export type PipelineBootstrapValidationResult<T> =
  | {
      readonly valid: true;
      readonly value: T;
      readonly errors: readonly [];
    }
  | {
      readonly valid: false;
      readonly errors: readonly PipelineBootstrapError[];
    };

export function createPipelineBootstrapError(
  code: PipelineBootstrapErrorCode,
  message: string,
  retryable = false
): PipelineBootstrapError {
  return Object.freeze({
    code,
    message,
    retryable,
  });
}
