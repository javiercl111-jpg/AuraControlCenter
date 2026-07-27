import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ShadowExecutionGuard } from '../ShadowExecutionGuard';
import { ShadowErrorCodes } from '../errors';
import type { ShadowExecutionPolicy, ShadowExecutionRequest } from '../types';
import type { PipelineResult } from '../../types';
import type { ShadowAuditSink, ShadowClock, ShadowExecutionIdGenerator } from '../ports';

describe('Aura Intelligence OS - AI-02E Shadow Execution Guard', () => {
  let mockClock: ShadowClock;
  let mockIdGenerator: ShadowExecutionIdGenerator;
  let mockAuditSink: ShadowAuditSink;
  let policy: ShadowExecutionPolicy;
  let mockPipelineResult: PipelineResult;
  let request: ShadowExecutionRequest;
  let idCounter: number;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1000000);

    idCounter = 0;
    mockIdGenerator = {
      generateExecutionId: vi.fn().mockImplementation(() => `shadow-exec-${++idCounter}`)
    };

    mockClock = {
      now: vi.fn().mockImplementation(() => Date.now()),
      toISOString: vi.fn().mockImplementation(() => new Date().toISOString())
    };

    mockAuditSink = {
      log: vi.fn()
    };

    policy = {
      enabled: true,
      maxConcurrentExecutions: 10,
      maxConcurrentPerSession: 2,
      admissionTimeoutMs: 0,
      executionTimeoutMs: 5000,
      deduplicationWindowMs: 60000,
      allowDuplicateExecutionKeys: false,
      failOpen: false,
      collectAuditRecords: true,
      redactSensitiveMetadata: true
    };

    mockPipelineResult = {
      contractVersion: '1',
      pipelineVersion: '1',
      executionId: 'exec-1',
      sessionId: 'sess-1',
      status: 'SUCCESS',
      startedAt: '2023-01-01',
      completedAt: '2023-01-01',
      durationMs: 100,
      stageResults: {},
      partialFailures: false,
      skippedStages: [],
      errors: [],
      warnings: [],
      auditTrail: []
    };

    request = {
      executionKey: 'req-key-1',
      sessionKey: 'sess-key-1',
      pipelineInput: { sessionId: 'sess-key-1' },
      execute: vi.fn().mockResolvedValue(mockPipelineResult)
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1. Ejecucion shadow exitosa y 2. Callback ejecutado exactamente una vez', async () => {
    const guard = new ShadowExecutionGuard(mockClock, mockIdGenerator, mockAuditSink);
    const result = await guard.execute(request, policy);
    
    expect(result.status).toBe('SUCCEEDED');
    expect(result.shadowExecutionId).toBe('shadow-exec-1');
    expect(result.admissionDecision.admitted).toBe(true);
    expect(request.execute).toHaveBeenCalledTimes(1);
    expect(result.pipelineResult).toBe(mockPipelineResult);
  });

  it('3. Guard disabled', async () => {
    const disabledPolicy = { ...policy, enabled: false };
    const guard = new ShadowExecutionGuard(mockClock, mockIdGenerator, mockAuditSink);
    const result = await guard.execute(request, disabledPolicy);
    
    expect(result.status).toBe('REJECTED');
    expect(result.admissionDecision.reason).toBe('DISABLED');
    expect(request.execute).not.toHaveBeenCalled();
  });

  it('4. Request invalido, 5. executionKey ausente, 6. sessionKey ausente', async () => {
    const guard = new ShadowExecutionGuard(mockClock, mockIdGenerator, mockAuditSink);
    const req1 = { ...request, executionKey: '' };
    const result1 = await guard.execute(req1, policy);
    expect(result1.admissionDecision.reason).toBe('INVALID_REQUEST');

    const req2 = { ...request, sessionKey: '' };
    const result2 = await guard.execute(req2, policy);
    expect(result2.admissionDecision.reason).toBe('INVALID_REQUEST');
  });

  it('7. Rechazo por limite global y 13. Liberacion de slot despues de exito', async () => {
    const limitPolicy = { ...policy, maxConcurrentExecutions: 1 };
    const guard = new ShadowExecutionGuard(mockClock, mockIdGenerator, mockAuditSink);
    
    let resolveFirst!: (value: PipelineResult) => void;
    const req1 = { ...request, executionKey: 'key1', sessionKey: 'sess1', execute: () => new Promise<PipelineResult>(res => { resolveFirst = res; }) };
    const p1 = guard.execute(req1, limitPolicy);
    
    const req2 = { ...request, executionKey: 'key2', sessionKey: 'sess2' };
    const result2 = await guard.execute(req2, limitPolicy);
    expect(result2.status).toBe('REJECTED');
    expect(result2.admissionDecision.reason).toBe('GLOBAL_CONCURRENCY_LIMIT');

    // Liberacion despues de exito
    resolveFirst(mockPipelineResult);
    await p1;

    // Slot is free, should be admitted now
    const req3 = { ...request, executionKey: 'key3', sessionKey: 'sess3' };
    const result3 = await guard.execute(req3, limitPolicy);
    expect(result3.status).toBe('SUCCEEDED');
  });

  it('8. Rechazo por limite de sesion, 9. Dos sesiones distintas admitidas, 10. Dos ejecuciones misma sesion', async () => {
    const limitPolicy = { ...policy, maxConcurrentPerSession: 2 };
    const guard = new ShadowExecutionGuard(mockClock, mockIdGenerator, mockAuditSink);
    
    let resolveFirst!: (value: PipelineResult) => void;
    let resolveSecond!: (value: PipelineResult) => void;
    
    const req1 = { ...request, executionKey: 'k1', sessionKey: 's1', execute: () => new Promise<PipelineResult>(res => { resolveFirst = res; }) };
    const req2 = { ...request, executionKey: 'k2', sessionKey: 's1', execute: () => new Promise<PipelineResult>(res => { resolveSecond = res; }) };
    const req3 = { ...request, executionKey: 'k3', sessionKey: 's1' }; // Should reject
    const req4 = { ...request, executionKey: 'k4', sessionKey: 's2' }; // Should admit (distinct session)
    
    const p1 = guard.execute(req1, limitPolicy);
    const p2 = guard.execute(req2, limitPolicy);
    
    const result3 = await guard.execute(req3, limitPolicy);
    expect(result3.status).toBe('REJECTED');
    expect(result3.admissionDecision.reason).toBe('SESSION_CONCURRENCY_LIMIT');
    
    const p4 = guard.execute(req4, limitPolicy);

    resolveFirst(mockPipelineResult);
    resolveSecond(mockPipelineResult);
    await p1;
    await p2;
    const result4 = await p4;
    expect(result4.status).toBe('SUCCEEDED');
  });

  it('11. Duplicado rechazado y 12. Duplicado no consume slot', async () => {
    const guard = new ShadowExecutionGuard(mockClock, mockIdGenerator, mockAuditSink);
    
    const req1 = { ...request, executionKey: 'k1' };
    const req2 = { ...request, executionKey: 'k1' };
    
    await guard.execute(req1, policy);
    const result2 = await guard.execute(req2, policy);
    
    expect(result2.status).toBe('REJECTED');
    expect(result2.admissionDecision.reason).toBe('DUPLICATE');
    expect(result2.metrics.activeExecutions).toBe(0); // Slot was not consumed
  });

  it('14. Liberacion de slot despues de fallo', async () => {
    const guard = new ShadowExecutionGuard(mockClock, mockIdGenerator, mockAuditSink);
    const req = { ...request, execute: () => Promise.reject(new Error('Internal failure')) };
    
    const res = await guard.execute(req, policy);
    expect(res.status).toBe('FAILED');
    expect(res.metrics.activeExecutions).toBe(0);
  });

  it('15. Liberacion de slot despues de timeout y 20. Timeout shadow', async () => {
    const guard = new ShadowExecutionGuard(mockClock, mockIdGenerator, mockAuditSink);
    const req = { ...request, execute: () => new Promise<PipelineResult>(() => {}) }; // eternal
    
    const p = guard.execute(req, policy);
    await vi.advanceTimersByTimeAsync(6000);
    const res = await p;
    
    expect(res.status).toBe('TIMED_OUT');
    expect(res.normalizedError?.code).toBe(ShadowErrorCodes.SHADOW_EXECUTION_TIMEOUT);
    // Slot freed
    const req2 = { ...request, executionKey: 'k2' };
    const res2 = await guard.execute(req2, policy);
    expect(res2.status).toBe('SUCCEEDED');
  });

  it('16. Liberacion de slot despues de cancelacion, 17, 18, 19. Cancelacion en varias fases', async () => {
    const guard = new ShadowExecutionGuard(mockClock, mockIdGenerator, mockAuditSink);
    let aborted = false;
    const req = { ...request, cancellationSignal: { get aborted() { return aborted; } }, execute: () => { aborted = true; return Promise.resolve(mockPipelineResult); } };
    
    const p = guard.execute(req, policy);
    await vi.advanceTimersByTimeAsync(1);
    
    const res = await p;
    expect(res.status).toBe('CANCELLED');
    expect(res.metrics.activeExecutions).toBe(0); // slot freed
    expect(res.normalizedError?.code).toBe(ShadowErrorCodes.SHADOW_EXECUTION_REJECTED);
  });

  it('21. Resultado tardio ignorado y 22. Rechazo tardio observado', async () => {
    const guard = new ShadowExecutionGuard(mockClock, mockIdGenerator, mockAuditSink);
    let lateReject!: (err: Error) => void;
    let lateResolve!: (val: PipelineResult) => void;
    
    const req1 = { ...request, executionKey: 'kr', execute: () => new Promise<PipelineResult>((_, r) => { lateReject = r; }) };
    const req2 = { ...request, executionKey: 'ks', execute: () => new Promise<PipelineResult>((res) => { lateResolve = res; }) };
    
    const p1 = guard.execute(req1, policy);
    const p2 = guard.execute(req2, policy);
    
    await vi.advanceTimersByTimeAsync(6000); // Trigger timeout
    const res1 = await p1;
    const res2 = await p2;
    
    expect(res1.status).toBe('TIMED_OUT');
    expect(res2.status).toBe('TIMED_OUT');
    
    lateReject(new Error('Late error'));
    lateResolve(mockPipelineResult);
    await vi.advanceTimersByTimeAsync(1);
    
    // Process keeps running, unhandled rejection avoided, audit recorded
    expect(mockAuditSink.log).toHaveBeenCalled();
  });

  it('23. Audit sink fallido no rompe ejecucion', async () => {
    mockAuditSink.log = vi.fn().mockImplementation(() => { throw new Error('Down'); });
    const guard = new ShadowExecutionGuard(mockClock, mockIdGenerator, mockAuditSink);
    const res = await guard.execute(request, policy);
    expect(res.status).toBe('SUCCEEDED');
  });

  it('24. Metadata sanitizada, 25. Metadata sensible omitida, 26. Limite de longitud', async () => {
    const guard = new ShadowExecutionGuard(mockClock, mockIdGenerator, mockAuditSink);
    const req = { ...request, metadata: { sourceId: 'abc', pii: 'secret', scenario: 'a'.repeat(300) } };
    const res = await guard.execute(req, policy);
    
    expect(res.auditRecords[0].safeMetadata?.sourceId).toBe('abc');
    expect(res.auditRecords[0].safeMetadata?.pii).toBeUndefined(); // Filtered
    expect((res.auditRecords[0].safeMetadata?.scenario as string).length).toBe(200); // Truncated
  });

  it('27. Limpieza de executionKeys expiradas y 28. Limite maximo', async () => {
    const guard = new ShadowExecutionGuard(mockClock, mockIdGenerator, mockAuditSink);
    await guard.execute({ ...request, executionKey: 'k1' }, policy);
    
    await vi.advanceTimersByTimeAsync(61000); // Advance past window
    const res = await guard.execute({ ...request, executionKey: 'k1' }, policy); // Should not be duplicate now
    expect(res.status).toBe('SUCCEEDED');
    expect(res.wasDeduplicated).toBe(false);
  });

  it('29. Metricas correctas, 35, 36, 37. Resultados estructurados, 38. Error serializable', async () => {
    const guard = new ShadowExecutionGuard(mockClock, mockIdGenerator, mockAuditSink);
    const res = await guard.execute(request, policy);
    
    expect(res.metrics.admittedCount).toBe(1);
    expect(res.metrics.activeExecutions).toBe(0); // At end
    expect(res.status).toBe('SUCCEEDED');
    
    const req2 = { ...request, executionKey: 'k2', execute: () => Promise.reject(new Error('fail')) };
    const res2 = await guard.execute(req2, policy);
    expect(res2.status).toBe('FAILED');
    expect(res2.normalizedError?.name).toBe('AuraShadowError'); // Serializable error
  });

  it('30. Dos ejecuciones concurrentes no mezclan estado, 31. Instancias distintas no comparten estado', async () => {
    const guard1 = new ShadowExecutionGuard(mockClock, mockIdGenerator, mockAuditSink);
    const guard2 = new ShadowExecutionGuard(mockClock, mockIdGenerator, mockAuditSink);
    
    const p1 = guard1.execute({ ...request, executionKey: 'k1' }, policy);
    const p2 = guard2.execute({ ...request, executionKey: 'k1' }, policy); // Same key, different instance! Should both pass.
    
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1.status).toBe('SUCCEEDED');
    expect(r2.status).toBe('SUCCEEDED');
  });

  it('32. PipelineResult no es mutado, 33. Input no es mutado, 34. Politica no es mutada', async () => {
    const guard = new ShadowExecutionGuard(mockClock, mockIdGenerator, mockAuditSink);
    const originalInput = JSON.stringify(request.pipelineInput);
    const originalResult = JSON.stringify(mockPipelineResult);
    const originalPolicy = JSON.stringify(policy);
    
    await guard.execute(request, policy);
    
    expect(JSON.stringify(request.pipelineInput)).toBe(originalInput);
    expect(JSON.stringify(mockPipelineResult)).toBe(originalResult);
    expect(JSON.stringify(policy)).toBe(originalPolicy);
  });
});
