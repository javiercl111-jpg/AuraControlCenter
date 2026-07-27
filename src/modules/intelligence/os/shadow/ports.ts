import type { ShadowExecutionId } from './types';

export interface ShadowExecutionIdGenerator {
  generateExecutionId(): ShadowExecutionId;
}

export interface ShadowClock {
  now(): number;
  toISOString(): string;
}

export interface ShadowAuditSink {
  log(level: 'INFO' | 'WARN' | 'ERROR', message: string, metadata?: Record<string, unknown>): void;
}
