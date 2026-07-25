import type { PipelineStageId, SerializableAuraOSError, OSErrorsMetadata } from './types';

export class AuraIntelligenceOSError extends Error implements SerializableAuraOSError {
  public readonly code: string;
  public readonly retryable: boolean;
  public readonly stage?: PipelineStageId;
  public readonly metadata?: OSErrorsMetadata;
  public readonly cause?: unknown;

  constructor(
    code: string,
    message: string,
    retryable: boolean,
    stage?: PipelineStageId,
    metadata?: OSErrorsMetadata,
    cause?: unknown
  ) {
    super(message);
    this.name = 'AuraIntelligenceOSError';
    this.code = code;
    this.retryable = retryable;
    this.stage = stage;
    this.metadata = metadata;
    this.cause = cause;
    Object.setPrototypeOf(this, AuraIntelligenceOSError.prototype);
  }

  public toJSON(): SerializableAuraOSError {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      retryable: this.retryable,
      stage: this.stage,
      metadata: this.metadata,
      cause: this.cause instanceof Error ? { message: this.cause.message, name: this.cause.name } : this.cause
    };
  }
}

export const ErrorCodes = {
  INVALID_INPUT: 'INVALID_INPUT',
  INVALID_CONTRACT: 'INVALID_CONTRACT',
  DEPENDENCY_RESOLUTION_FAILED: 'DEPENDENCY_RESOLUTION_FAILED',
  CONTEXT_CONSTRUCTION_FAILED: 'CONTEXT_CONSTRUCTION_FAILED',
  STAGE_EXECUTION_FAILED: 'STAGE_EXECUTION_FAILED',
  STAGE_TIMEOUT: 'STAGE_TIMEOUT',
  PIPELINE_TIMEOUT: 'PIPELINE_TIMEOUT',
  CANCELLED: 'CANCELLED',
  PARTIAL_RESULT: 'PARTIAL_RESULT',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
} as const;
