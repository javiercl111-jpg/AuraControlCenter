import type { PipelineResult, SerializableAuraOSError, PipelineInput } from '../types';

export type ShadowExecutionId = string;
export type ShadowExecutionKey = string;
export type ShadowSessionKey = string;

export type ShadowExecutionStatus =
  | 'PENDING'
  | 'WAITING'
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'REJECTED'
  | 'SKIPPED'
  | 'FAILED'
  | 'CANCELLED'
  | 'TIMED_OUT';

export type ShadowAdmissionReason =
  | 'DISABLED'
  | 'DUPLICATE'
  | 'GLOBAL_CONCURRENCY_LIMIT'
  | 'SESSION_CONCURRENCY_LIMIT'
  | 'CANCELLED'
  | 'ADMISSION_TIMEOUT'
  | 'INVALID_REQUEST';

export interface ShadowExecutionPolicy {
  readonly enabled: boolean;
  readonly maxConcurrentExecutions: number;
  readonly maxConcurrentPerSession: number;
  readonly admissionTimeoutMs: number;
  readonly executionTimeoutMs: number;
  readonly deduplicationWindowMs: number;
  readonly allowDuplicateExecutionKeys: boolean;
  readonly failOpen: boolean;
  readonly collectAuditRecords: boolean;
  readonly redactSensitiveMetadata: boolean;
}

export interface ShadowAdmissionDecision {
  admitted: boolean;
  reason?: ShadowAdmissionReason;
  executionKey: ShadowExecutionKey;
  sessionKey: ShadowSessionKey;
  decidedAt: string;
  retryable: boolean;
  safeMetadata?: Record<string, string | number | boolean>;
}

export interface ShadowExecutionRequest {
  executionKey: ShadowExecutionKey;
  sessionKey: ShadowSessionKey;
  pipelineInput: PipelineInput;
  execute: (context: ShadowExecutionContext) => Promise<PipelineResult>;
  cancellationSignal?: { readonly aborted: boolean; readonly reason?: unknown };
  metadata?: Record<string, unknown>;
}

export interface ShadowExecutionContext {
  readonly shadowExecutionId: ShadowExecutionId;
  readonly executionKey: ShadowExecutionKey;
  readonly sessionKey: ShadowSessionKey;
  readonly policy: ShadowExecutionPolicy;
  readonly startedAtMs: number;
  isCancelled(): boolean;
}

export interface ShadowAuditRecord {
  eventType: string;
  executionId: ShadowExecutionId;
  executionKey: ShadowExecutionKey;
  sessionKey: ShadowSessionKey;
  timestamp: string;
  status: ShadowExecutionStatus;
  reasonCode?: string;
  durationMs?: number;
  safeMetadata?: Record<string, string | number | boolean>;
}

export interface ShadowGuardMetrics {
  activeExecutions: number;
  activeSessions: number;
  queuedExecutions: number;
  admittedCount: number;
  rejectedCount: number;
  duplicateCount: number;
  timeoutCount: number;
  cancelledCount: number;
}

export interface ShadowExecutionResult {
  shadowExecutionId: ShadowExecutionId;
  executionKey: ShadowExecutionKey;
  sessionKey: ShadowSessionKey;
  admissionDecision: ShadowAdmissionDecision;
  status: ShadowExecutionStatus;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  pipelineResult?: PipelineResult;
  normalizedError?: SerializableAuraOSError;
  metrics: ShadowGuardMetrics;
  auditRecords: ShadowAuditRecord[];
  wasDeduplicated: boolean;
  wasQueued: boolean;
  slotWaitMs: number;
}
