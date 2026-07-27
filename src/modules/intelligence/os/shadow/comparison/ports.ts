import type { ShadowComparisonRequest, ShadowComparisonResult, CaptureRecord, CaptureAdapterMetrics } from './types';

export interface ShadowComparatorPort {
  compare(request: ShadowComparisonRequest): ShadowComparisonResult;
}

export interface ShadowCapturePort {
  capture(record: CaptureRecord): void | Promise<void>;
  getByExecutionKey(executionKey: string): CaptureRecord | undefined;
  getBySessionKey(sessionKey: string): CaptureRecord[];
  getMetrics(): CaptureAdapterMetrics;
  clearExpired(): void;
}
