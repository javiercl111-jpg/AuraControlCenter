import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InMemoryShadowCaptureAdapter } from '../InMemoryShadowCaptureAdapter';
import type { CaptureAdapterPolicy, CaptureRecord, ShadowComparisonResult } from '../types';
import type { ShadowClock } from '../../ports';

describe('Aura Intelligence OS - AI-02F Shadow Capture Adapter', () => {
  let mockClock: ShadowClock;
  let policy: CaptureAdapterPolicy;
  let defaultResult: ShadowComparisonResult;
  let defaultRecord: CaptureRecord;

  beforeEach(() => {
    mockClock = {
      now: vi.fn().mockReturnValue(1000000),
      toISOString: vi.fn().mockReturnValue('2023-01-01T00:00:00Z')
    };

    policy = {
      enabled: true,
      maxRecords: 5,
      ttlMs: 60000,
      maxRecordsPerSession: 2,
      captureSuccessfulComparisons: true,
      captureFailedComparisons: true,
      captureNotComparable: true,
      retainPipelineResultReference: true,
      redactMetadata: true,
      maxDifferencesPerRecord: 10
    };

    defaultResult = {
      comparisonId: 'comp-1',
      executionKey: 'exec-1',
      sessionKey: 'sess-1',
      status: 'COMPLETED_WITH_DIFFERENCES',
      startedAt: '2023-01-01T00:00:00Z',
      completedAt: '2023-01-01T00:00:01Z',
      durationMs: 1000,
      summary: 'Diffs found',
      differences: [{ type: 'STATUS_MISMATCH', field: 'status', legacyValue: 'x', osValue: 'y', severity: 'HIGH', message: '' }],
      metrics: { totalFieldsCompared: 1, totalDifferences: 1, differencesByType: {}, differencesBySeverity: {}, comparableRatio: 1, statusMatch: false, objectiveMatch: true },
      comparableFields: [],
      nonComparableFields: [],
      warnings: [],
      sanitizedMetadata: { safeKey: 'safeVal' }
    };

    defaultRecord = {
      comparisonResult: defaultResult,
      capturedAtMs: 1000000,
      expiresAtMs: 1060000,
      shadowResultReference: { shadowExecutionId: 'shadow-1', status: 'SUCCESS' }
    };
  });

  it('1. Captura valida', () => {
    const adapter = new InMemoryShadowCaptureAdapter(mockClock, policy);
    adapter.capture(defaultRecord);

    const metrics = adapter.getMetrics();
    expect(metrics.currentRecords).toBe(1);
    expect(metrics.capturedCount).toBe(1);

    const retrieved = adapter.getByExecutionKey('exec-1');
    expect(retrieved?.comparisonResult.comparisonId).toBe('comp-1');
  });

  it('2. Captura disabled', () => {
    policy.enabled = false;
    const adapter = new InMemoryShadowCaptureAdapter(mockClock, policy);

    expect(() => adapter.capture(defaultRecord)).toThrowError(/Capture is disabled/);
    expect(adapter.getMetrics().rejectedCount).toBe(1);
  });

  it('3. Consulta por executionKey, 4. Consulta por sessionKey', () => {
    const adapter = new InMemoryShadowCaptureAdapter(mockClock, policy);
    adapter.capture({ ...defaultRecord, capturedAtMs: 1000000 });
    adapter.capture({ ...defaultRecord, capturedAtMs: 1000001, comparisonResult: { ...defaultResult, comparisonId: 'comp-2', executionKey: 'exec-2' } });

    expect(adapter.getByExecutionKey('exec-1')?.comparisonResult.comparisonId).toBe('comp-1');
    expect(adapter.getByExecutionKey('exec-2')?.comparisonResult.comparisonId).toBe('comp-2');

    const bySession = adapter.getBySessionKey('sess-1');
    expect(bySession.length).toBe(2);
    expect(bySession[0].comparisonResult.comparisonId).toBe('comp-2'); // newest first
  });

  it('5. Copia defensiva, 6. No mutacion', () => {
    const adapter = new InMemoryShadowCaptureAdapter(mockClock, policy);
    adapter.capture(defaultRecord);

    const retrieved = adapter.getByExecutionKey('exec-1')!;
    retrieved.comparisonResult.differences.push({ type: 'NOT_COMPARABLE', field: 'f', severity: 'INFO', message: '' });

    const retrieved2 = adapter.getByExecutionKey('exec-1')!;
    expect(retrieved2.comparisonResult.differences.length).toBe(1); // Original unchanged
  });

  it('7. TTL, 8. Expiracion, 19. Clear expired', () => {
    const adapter = new InMemoryShadowCaptureAdapter(mockClock, policy);
    adapter.capture(defaultRecord);

    expect(adapter.getByExecutionKey('exec-1')).toBeDefined();

    // Advance time past TTL
    mockClock.now = vi.fn().mockReturnValue(1060001);

    expect(adapter.getByExecutionKey('exec-1')).toBeUndefined();
    expect(adapter.getMetrics().expiredCount).toBe(1);
    expect(adapter.getMetrics().currentRecords).toBe(0);
  });

  it('9. maxRecords, 11. Eviction determinista (FIFO)', () => {
    policy.maxRecords = 2;
    policy.maxRecordsPerSession = 5; // prevent session limit interference
    const adapter = new InMemoryShadowCaptureAdapter(mockClock, policy);

    adapter.capture({ ...defaultRecord, comparisonResult: { ...defaultResult, comparisonId: 'c1', executionKey: 'e1' }, capturedAtMs: 1 });
    adapter.capture({ ...defaultRecord, comparisonResult: { ...defaultResult, comparisonId: 'c2', executionKey: 'e2' }, capturedAtMs: 2 });
    adapter.capture({ ...defaultRecord, comparisonResult: { ...defaultResult, comparisonId: 'c3', executionKey: 'e3' }, capturedAtMs: 3 }); // Evicts c1

    expect(adapter.getMetrics().currentRecords).toBe(2);
    expect(adapter.getMetrics().evictedCount).toBe(1);
    expect(adapter.getByExecutionKey('e1')).toBeUndefined();
    expect(adapter.getByExecutionKey('e2')).toBeDefined();
    expect(adapter.getByExecutionKey('e3')).toBeDefined();
  });

  it('10. maxRecordsPerSession', () => {
    policy.maxRecordsPerSession = 2;
    const adapter = new InMemoryShadowCaptureAdapter(mockClock, policy);

    adapter.capture({ ...defaultRecord, comparisonResult: { ...defaultResult, comparisonId: 'c1', executionKey: 'e1' }, capturedAtMs: 1 });
    adapter.capture({ ...defaultRecord, comparisonResult: { ...defaultResult, comparisonId: 'c2', executionKey: 'e2' }, capturedAtMs: 2 });
    adapter.capture({ ...defaultRecord, comparisonResult: { ...defaultResult, comparisonId: 'c3', executionKey: 'e3' }, capturedAtMs: 3 }); // Evicts c1 from sess-1

    expect(adapter.getBySessionKey('sess-1').length).toBe(2);
    expect(adapter.getByExecutionKey('e1')).toBeUndefined();
  });

  it('13, 14, 15. Filtros de politica por status', () => {
    policy.captureSuccessfulComparisons = false;
    policy.captureFailedComparisons = false;
    policy.captureNotComparable = false;
    const adapter = new InMemoryShadowCaptureAdapter(mockClock, policy);

    adapter.capture({ ...defaultRecord, comparisonResult: { ...defaultResult, status: 'COMPLETED' } });
    adapter.capture({ ...defaultRecord, comparisonResult: { ...defaultResult, status: 'COMPLETED_WITH_DIFFERENCES' } });
    adapter.capture({ ...defaultRecord, comparisonResult: { ...defaultResult, status: 'NOT_COMPARABLE' } });

    expect(adapter.getMetrics().rejectedCount).toBe(3);
    expect(adapter.getMetrics().currentRecords).toBe(0);
  });

  it('16. maxDifferencesPerRecord', () => {
    policy.maxDifferencesPerRecord = 1;
    const adapter = new InMemoryShadowCaptureAdapter(mockClock, policy);

    const diff = defaultResult.differences[0];
    const bigResult = { ...defaultResult, differences: [diff, diff, diff] };
    adapter.capture({ ...defaultRecord, comparisonResult: bigResult });

    const retrieved = adapter.getByExecutionKey('exec-1')!;
    expect(retrieved.comparisonResult.differences.length).toBe(1);
  });
});
