export interface PipelineIdGenerator {
  generateExecutionId(): string;
}

export interface PipelineClock {
  now(): number;
  toISOString(): string;
}

export interface PipelineAuditSink {
  log(level: 'INFO' | 'WARN' | 'ERROR', message: string, metadata?: Record<string, unknown>): void;
}

export interface PipelineTimeoutPolicy {
  getExecutionTimeoutMs(): number;
  getStageTimeoutMs(stage: string): number;
}

export interface PipelineCancellationSignal {
  readonly aborted: boolean;
  readonly reason?: unknown;
}
