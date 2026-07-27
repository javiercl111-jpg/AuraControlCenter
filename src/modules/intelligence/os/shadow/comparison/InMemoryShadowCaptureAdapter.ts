import type { ShadowClock } from '../ports';
import type { ShadowCapturePort } from './ports';
import type {
  CaptureRecord,
  CaptureAdapterPolicy,
  CaptureAdapterMetrics
} from './types';
import { ShadowComparisonError, ShadowComparisonErrorCodes } from './errors';

export class InMemoryShadowCaptureAdapter implements ShadowCapturePort {
  private records = new Map<string, CaptureRecord>();
  private executionKeyIndex = new Map<string, string>(); // executionKey -> comparisonId
  private sessionKeyIndex = new Map<string, Set<string>>(); // sessionKey -> Set<comparisonId>

  private capturedCount = 0;
  private evictedCount = 0;
  private expiredCount = 0;
  private rejectedCount = 0;

  private clock: ShadowClock;
  private policy: CaptureAdapterPolicy;

  constructor(
    clock: ShadowClock,
    policy: CaptureAdapterPolicy
  ) {
    this.clock = clock;
    this.policy = policy;
  }

  public capture(record: CaptureRecord): void {
    if (!this.policy.enabled) {
      this.rejectedCount++;
      throw new ShadowComparisonError(ShadowComparisonErrorCodes.SHADOW_CAPTURE_DISABLED, 'Capture is disabled', false);
    }

    const { comparisonResult } = record;
    if (!comparisonResult || !comparisonResult.comparisonId || !comparisonResult.executionKey || !comparisonResult.sessionKey) {
      this.rejectedCount++;
      throw new ShadowComparisonError(ShadowComparisonErrorCodes.SHADOW_CAPTURE_INVALID_RECORD, 'Invalid record', false);
    }

    if (comparisonResult.status === 'COMPLETED' && !this.policy.captureSuccessfulComparisons) {
      this.rejectedCount++;
      return;
    }
    if (comparisonResult.status === 'COMPLETED_WITH_DIFFERENCES' && !this.policy.captureFailedComparisons) {
      this.rejectedCount++;
      return;
    }
    if (comparisonResult.status === 'NOT_COMPARABLE' && !this.policy.captureNotComparable) {
      this.rejectedCount++;
      return;
    }

    this.clearExpired();

    // Check global limit
    if (this.records.size >= this.policy.maxRecords) {
      this.evictOldest();
    }

    // Check session limit
    const sessionSet = this.sessionKeyIndex.get(comparisonResult.sessionKey);
    if (sessionSet && sessionSet.size >= this.policy.maxRecordsPerSession) {
      this.evictOldestInSession(comparisonResult.sessionKey);
    }

    // Enforce differences limit per record
    let finalDifferences = comparisonResult.differences;
    if (finalDifferences.length > this.policy.maxDifferencesPerRecord) {
      finalDifferences = finalDifferences.slice(0, this.policy.maxDifferencesPerRecord);
    }

    // Create defensive copy
    const safeRecord: CaptureRecord = {
      comparisonResult: {
        ...comparisonResult,
        differences: finalDifferences.map(d => ({ ...d })),
        warnings: [...comparisonResult.warnings],
        comparableFields: [...comparisonResult.comparableFields],
        nonComparableFields: [...comparisonResult.nonComparableFields],
        metrics: {
          ...comparisonResult.metrics,
          differencesByType: { ...comparisonResult.metrics.differencesByType },
          differencesBySeverity: { ...comparisonResult.metrics.differencesBySeverity }
        },
        legacySnapshot: comparisonResult.legacySnapshot ? { ...comparisonResult.legacySnapshot } : undefined,
        osSnapshot: comparisonResult.osSnapshot ? { ...comparisonResult.osSnapshot } : undefined,
        sanitizedMetadata: this.policy.redactMetadata
          ? (comparisonResult.sanitizedMetadata ? { ...comparisonResult.sanitizedMetadata } : undefined)
          : comparisonResult.sanitizedMetadata
      },
      capturedAtMs: record.capturedAtMs,
      expiresAtMs: record.expiresAtMs || (record.capturedAtMs + this.policy.ttlMs)
    };

    if (this.policy.retainPipelineResultReference && record.shadowResultReference) {
      safeRecord.shadowResultReference = { ...record.shadowResultReference };
    }

    this.records.set(comparisonResult.comparisonId, safeRecord);
    this.executionKeyIndex.set(comparisonResult.executionKey, comparisonResult.comparisonId);

    let set = this.sessionKeyIndex.get(comparisonResult.sessionKey);
    if (!set) {
      set = new Set();
      this.sessionKeyIndex.set(comparisonResult.sessionKey, set);
    }
    set.add(comparisonResult.comparisonId);

    this.capturedCount++;
  }

  public getByExecutionKey(executionKey: string): CaptureRecord | undefined {
    this.clearExpired();
    const id = this.executionKeyIndex.get(executionKey);
    if (!id) return undefined;
    const record = this.records.get(id);
    return record ? this.deepCloneDefensive(record) : undefined;
  }

  public getBySessionKey(sessionKey: string): CaptureRecord[] {
    this.clearExpired();
    const set = this.sessionKeyIndex.get(sessionKey);
    if (!set) return [];

    const results: CaptureRecord[] = [];
    for (const id of set) {
      const record = this.records.get(id);
      if (record) {
        results.push(this.deepCloneDefensive(record));
      }
    }
    return results.sort((a, b) => b.capturedAtMs - a.capturedAtMs); // newest first
  }

  public getMetrics(): CaptureAdapterMetrics {
    this.clearExpired();
    return {
      currentRecords: this.records.size,
      currentSessions: this.sessionKeyIndex.size,
      capturedCount: this.capturedCount,
      evictedCount: this.evictedCount,
      expiredCount: this.expiredCount,
      rejectedCount: this.rejectedCount
    };
  }

  public clearExpired(): void {
    const now = this.clock.now();
    for (const [id, record] of this.records.entries()) {
      if (now > record.expiresAtMs) {
        this.removeRecord(id, record);
        this.expiredCount++;
      }
    }
  }

  private evictOldest(): void {
    if (this.records.size === 0) return;
    let oldestId: string | undefined;
    let oldestTime = Infinity;

    for (const [id, record] of this.records.entries()) {
      if (record.capturedAtMs < oldestTime) {
        oldestTime = record.capturedAtMs;
        oldestId = id;
      }
    }

    if (oldestId) {
      const record = this.records.get(oldestId);
      if (record) {
        this.removeRecord(oldestId, record);
        this.evictedCount++;
      }
    }
  }

  private evictOldestInSession(sessionKey: string): void {
    const set = this.sessionKeyIndex.get(sessionKey);
    if (!set || set.size === 0) return;

    let oldestId: string | undefined;
    let oldestTime = Infinity;

    for (const id of set) {
      const record = this.records.get(id);
      if (record && record.capturedAtMs < oldestTime) {
        oldestTime = record.capturedAtMs;
        oldestId = id;
      }
    }

    if (oldestId) {
      const record = this.records.get(oldestId);
      if (record) {
        this.removeRecord(oldestId, record);
        this.evictedCount++;
      }
    }
  }

  private removeRecord(id: string, record: CaptureRecord): void {
    this.records.delete(id);
    this.executionKeyIndex.delete(record.comparisonResult.executionKey);
    const set = this.sessionKeyIndex.get(record.comparisonResult.sessionKey);
    if (set) {
      set.delete(id);
      if (set.size === 0) {
        this.sessionKeyIndex.delete(record.comparisonResult.sessionKey);
      }
    }
  }

  private deepCloneDefensive(record: CaptureRecord): CaptureRecord {
    // Return a shallow copy of the record with shallow copies of internal arrays/objects
    // For this sprint, it's sufficient to prevent accidental mutation by consumer
    return {
      comparisonResult: {
        ...record.comparisonResult,
        differences: record.comparisonResult.differences.map(d => ({ ...d })),
        warnings: [...record.comparisonResult.warnings],
        metrics: { ...record.comparisonResult.metrics },
        legacySnapshot: record.comparisonResult.legacySnapshot ? { ...record.comparisonResult.legacySnapshot } : undefined,
        osSnapshot: record.comparisonResult.osSnapshot ? { ...record.comparisonResult.osSnapshot } : undefined
      },
      capturedAtMs: record.capturedAtMs,
      expiresAtMs: record.expiresAtMs,
      shadowResultReference: record.shadowResultReference ? { ...record.shadowResultReference } : undefined
    };
  }
}
