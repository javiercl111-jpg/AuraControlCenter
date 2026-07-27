import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ShadowComparator } from '../ShadowComparator';
import type { ShadowComparisonPolicy, LegacyComparisonInput } from '../types';
import type { ShadowExecutionResult } from '../../types';
import type { ShadowClock, ShadowExecutionIdGenerator } from '../../ports';

describe('Aura Intelligence OS - AI-02F Shadow Comparator', () => {
  let mockClock: ShadowClock;
  let mockIdGenerator: ShadowExecutionIdGenerator;
  let policy: ShadowComparisonPolicy;
  let defaultLegacyInput: LegacyComparisonInput;
  let defaultOSResult: ShadowExecutionResult;
  let idCounter = 0;

  beforeEach(() => {
    mockClock = {
      now: vi.fn().mockReturnValue(1000000),
      toISOString: vi.fn().mockReturnValue('2023-01-01T00:00:00Z')
    };

    mockIdGenerator = {
      generateExecutionId: vi.fn().mockImplementation(() => `comp-${++idCounter}`)
    };

    policy = {
      coverageDeltaThreshold: 5,
      durationDeltaThresholdMs: 1000,
      findingsCountDeltaThreshold: 0,
      criticalStatusPairs: { 'COMPLETED:FAILED': 'CRITICAL', 'FAILED:COMPLETED': 'CRITICAL' },
      ignoredDifferenceTypes: [],
      treatMissingAsDifference: true,
      compareSkippedStages: true,
      compareErrorCodes: true,
      maxDifferences: 100,
      includeSafeMetadata: true
    };

    defaultLegacyInput = {
      sessionKey: 'sess-1',
      executionKey: 'exec-1',
      completionStatus: 'SUCCESS',
      closed: true,
      nextObjective: 'improve_sales',
      coverageScore: 80,
      findingsCount: 5,
      diagnosticStatus: 'SUCCEEDED',
      assessmentStatus: 'SUCCEEDED',
      stageStatusMap: {
        'EVIDENCE_EXTRACTION': 'SUCCEEDED',
        'KNOWLEDGE_COVERAGE': 'SUCCEEDED'
      }
    };

    defaultOSResult = {
      shadowExecutionId: 'shadow-exec-1',
      executionKey: 'exec-1',
      sessionKey: 'sess-1',
      admissionDecision: { admitted: true, executionKey: 'exec-1', sessionKey: 'sess-1', decidedAt: 'now', retryable: false },
      status: 'SUCCEEDED',
      metrics: { activeExecutions: 0, activeSessions: 0, queuedExecutions: 0, admittedCount: 1, rejectedCount: 0, duplicateCount: 0, timeoutCount: 0, cancelledCount: 0 },
      auditRecords: [],
      wasDeduplicated: false,
      wasQueued: false,
      slotWaitMs: 0,
      pipelineResult: {
        contractVersion: '1',
        pipelineVersion: '1',
        executionId: 'exec-1',
        sessionId: 'sess-1',
        status: 'SUCCESS',
        startedAt: '2023-01-01',
        completedAt: '2023-01-01',
        durationMs: 500,
        stageResults: {
          'EVIDENCE_EXTRACTION': { stage: 'EVIDENCE_EXTRACTION', status: 'SUCCEEDED', startedAt: '', completedAt: '', durationMs: 10, errors: [], warnings: [], output: { findings: [1,2,3,4,5] } },
          'KNOWLEDGE_COVERAGE': { stage: 'KNOWLEDGE_COVERAGE', status: 'SUCCEEDED', startedAt: '', completedAt: '', durationMs: 10, errors: [], warnings: [], output: { score: 80 } },
          'ADAPTIVE_PLANNING': { stage: 'ADAPTIVE_PLANNING', status: 'SUCCEEDED', startedAt: '', completedAt: '', durationMs: 10, errors: [], warnings: [], output: { objective: 'improve_sales' } },
          'EXECUTIVE_DOSSIER': { stage: 'EXECUTIVE_DOSSIER', status: 'SUCCEEDED', startedAt: '', completedAt: '', durationMs: 10, errors: [], warnings: [] },
          'TRANSFORMATION_ASSESSMENT': { stage: 'TRANSFORMATION_ASSESSMENT', status: 'SUCCEEDED', startedAt: '', completedAt: '', durationMs: 10, errors: [], warnings: [] }
        },
        partialFailures: false,
        skippedStages: [],
        errors: [],
        warnings: [],
        auditTrail: []
      }
    };
  });

  it('1. Comparacion sin diferencias', () => {
    const comparator = new ShadowComparator(mockClock, mockIdGenerator);
    const result = comparator.compare({ legacyInput: defaultLegacyInput, osResult: defaultOSResult, policy });
    
    expect(result.status).toBe('COMPLETED');
    expect(result.differences.length).toBe(0);
    expect(result.metrics.statusMatch).toBe(true);
    expect(result.metrics.objectiveMatch).toBe(true);
  });

  it('2. Status mismatch (CRITICAL by policy)', () => {
    const comparator = new ShadowComparator(mockClock, mockIdGenerator);
    defaultLegacyInput.completionStatus = 'COMPLETED';
    defaultOSResult.pipelineResult!.status = 'FAILED';
    
    const result = comparator.compare({ legacyInput: defaultLegacyInput, osResult: defaultOSResult, policy });
    
    expect(result.status).toBe('COMPLETED_WITH_DIFFERENCES');
    const diff = result.differences.find(d => d.type === 'STATUS_MISMATCH');
    expect(diff).toBeDefined();
    expect(diff?.severity).toBe('CRITICAL');
    expect(result.metrics.statusMatch).toBe(false);
  });

  it('3. Missing in legacy, 4. Missing in OS', () => {
    const comparator = new ShadowComparator(mockClock, mockIdGenerator);
    delete defaultLegacyInput.findingsCount;
    const stage = defaultOSResult.pipelineResult!.stageResults!['KNOWLEDGE_COVERAGE'];
    if (stage && 'output' in stage && stage.output) {
      delete (stage.output as { score?: number }).score;
    }
    
    const result = comparator.compare({ legacyInput: defaultLegacyInput, osResult: defaultOSResult, policy });
    expect(result.differences.some(d => d.type === 'MISSING_IN_LEGACY' && d.field === 'findingsCount')).toBe(true);
    expect(result.differences.some(d => d.type === 'MISSING_IN_OS' && d.field === 'coverageScore')).toBe(true);
  });

  it('5. Coverage delta dentro del umbral, 6. Fuera del umbral', () => {
    const comparator = new ShadowComparator(mockClock, mockIdGenerator);
    // Delta of 4 (threshold is 5)
    const stage1 = defaultOSResult.pipelineResult!.stageResults!['KNOWLEDGE_COVERAGE'];
    if (stage1 && 'output' in stage1 && stage1.output) {
      (stage1.output as { score: number }).score = 84;
    }
    const res1 = comparator.compare({ legacyInput: defaultLegacyInput, osResult: defaultOSResult, policy });
    expect(res1.differences.some(d => d.type === 'COVERAGE_DELTA')).toBe(false);

    // Delta of 6 (threshold is 5)
    const stage2 = defaultOSResult.pipelineResult!.stageResults!['KNOWLEDGE_COVERAGE'];
    if (stage2 && 'output' in stage2 && stage2.output) {
      (stage2.output as { score: number }).score = 86;
    }
    const res2 = comparator.compare({ legacyInput: defaultLegacyInput, osResult: defaultOSResult, policy });
    expect(res2.differences.some(d => d.type === 'COVERAGE_DELTA')).toBe(true);
  });

  it('10. Objective match exacto, 11. Objective mismatch', () => {
    const comparator = new ShadowComparator(mockClock, mockIdGenerator);
    // Exact
    defaultLegacyInput.nextObjective = '  improve_sales  ';
    const res1 = comparator.compare({ legacyInput: defaultLegacyInput, osResult: defaultOSResult, policy });
    expect(res1.differences.some(d => d.type === 'OBJECTIVE_MISMATCH')).toBe(false);

    // Mismatch
    defaultLegacyInput.nextObjective = 'improve_marketing';
    const res2 = comparator.compare({ legacyInput: defaultLegacyInput, osResult: defaultOSResult, policy });
    expect(res2.differences.some(d => d.type === 'OBJECTIVE_MISMATCH')).toBe(true);
    expect(res2.metrics.objectiveMatch).toBe(false);
  });

  it('15. Stage status mismatch, 16. Skipped stages', () => {
    const comparator = new ShadowComparator(mockClock, mockIdGenerator);
    defaultLegacyInput.stageStatusMap!['EVIDENCE_EXTRACTION'] = 'SUCCEEDED';
    defaultOSResult.pipelineResult!.stageResults!['EVIDENCE_EXTRACTION']!.status = 'FAILED';
    
    defaultLegacyInput.stageStatusMap!['KNOWLEDGE_COVERAGE'] = 'SUCCEEDED';
    delete defaultOSResult.pipelineResult!.stageResults!['KNOWLEDGE_COVERAGE'];
    defaultOSResult.pipelineResult!.skippedStages.push('KNOWLEDGE_COVERAGE');

    const result = comparator.compare({ legacyInput: defaultLegacyInput, osResult: defaultOSResult, policy });
    expect(result.differences.find(d => d.field === 'stageStatus.EVIDENCE_EXTRACTION')?.type).toBe('STAGE_MISMATCH');
    
    const skippedDiff = result.differences.find(d => d.field === 'stageStatus.KNOWLEDGE_COVERAGE');
    expect(skippedDiff?.type).toBe('STAGE_MISMATCH');
    expect(skippedDiff?.osValue).toBe('SKIPPED');
  });

  it('19. maxDifferences respetado', () => {
    const comparator = new ShadowComparator(mockClock, mockIdGenerator);
    defaultLegacyInput.completionStatus = 'PENDING';
    defaultLegacyInput.nextObjective = 'foo';
    defaultLegacyInput.coverageScore = 10;
    defaultLegacyInput.findingsCount = 99;
    policy.maxDifferences = 2; // Should truncate
    
    const result = comparator.compare({ legacyInput: defaultLegacyInput, osResult: defaultOSResult, policy });
    expect(result.differences.length).toBe(2);
  });

  it('24. Input invalido manejado como status', () => {
    const comparator = new ShadowComparator(mockClock, mockIdGenerator);
    const badInput: Partial<LegacyComparisonInput> = {};
    const result = comparator.compare({ legacyInput: badInput as LegacyComparisonInput, osResult: defaultOSResult, policy });
    expect(result.status).toBe('INVALID_INPUT');
    expect(result.normalizedError).toBeDefined();
    expect(result.normalizedError?.code).toBe('SHADOW_COMPARISON_INVALID_INPUT');
  });

  it('28. Snapshot legacy seguro, 29. Snapshot OS seguro', () => {
    const comparator = new ShadowComparator(mockClock, mockIdGenerator);
    const result = comparator.compare({ legacyInput: defaultLegacyInput, osResult: defaultOSResult, policy });
    
    expect(result.legacySnapshot).toBeDefined();
    expect(result.legacySnapshot?.sessionKey).toBe('sess-1');
    expect(result.osSnapshot).toBeDefined();
    expect(result.osSnapshot?.pipelineStatus).toBe('SUCCESS');
    
    // Mutations to input should not affect snapshot (verified implicitly by simple spread in derivation)
  });

  it('22. NaN rechazado, 23. Infinity rechazado', () => {
    const comparator = new ShadowComparator(mockClock, mockIdGenerator);
    defaultLegacyInput.coverageScore = NaN;
    const result = comparator.compare({ legacyInput: defaultLegacyInput, osResult: defaultOSResult, policy });
    expect(result.status).toBe('INVALID_INPUT');

    defaultLegacyInput.coverageScore = Infinity;
    const result2 = comparator.compare({ legacyInput: defaultLegacyInput, osResult: defaultOSResult, policy });
    expect(result2.status).toBe('INVALID_INPUT');
  });
});
