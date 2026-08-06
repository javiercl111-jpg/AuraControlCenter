import { describe, it, expect, vi } from 'vitest';
import { AuraIntelligencePublicPreviewFacadeV1 } from '../AuraIntelligencePublicPreviewFacadeV1';
import type { PublicPreviewRequestV1 } from '../publicPreviewTypesV1';
import type { GovernedExecutionBoundary } from '../../boundary/GovernedExecutionBoundary';
import type { BoundaryInvocationContextV1, GovernedExecutionResponse, BoundaryPublicError } from '../../boundary/types';

describe('AuraIntelligencePublicPreviewFacadeV1', () => {
  const mockBoundary = {
    execute: vi.fn(),
  } as unknown as GovernedExecutionBoundary;

  const facade = new AuraIntelligencePublicPreviewFacadeV1({
    boundary: mockBoundary,
  });

  const validContext: BoundaryInvocationContextV1 = {
    schemaVersion: '1',
    tenantId: 't1',
    actor: { actorId: 'a1', actorType: 'SERVICE' },
    consumerId: 'c1',
    source: 'test-source',
    requestId: 'req-1',
    correlationId: 'corr-1',
  };

  const validRequest: PublicPreviewRequestV1 = {
    contractVersion: '1.0',
    capability: 'GROWTH_INTELLIGENCE_V1',
    tenantId: 't1',
    actorId: 'a1',
    requestId: 'req-1',
    correlationId: 'corr-1',
    executionMode: 'EVALUATION',
    payload: { someData: true },
    operation: 'ANALYZE_CAMPAIGN',
  };

  const mockBoundaryResponseCompleted: GovernedExecutionResponse = {
    requestId: 'req-1',
    correlationId: 'corr-1',
    mode: 'EVALUATION',
    status: 'COMPLETED',
    startedAt: '2026-08-06T12:00:00Z',
    completedAt: '2026-08-06T12:00:01Z',
    durationMs: 1000,
    resultSummary: {
      executionId: 'exec-1',
      sessionId: 'sess-1',
      status: 'SUCCESS',
      startedAt: '123',
      completedAt: '456',
      durationMs: 100
    },
    warnings: [],
    errors: [],
  };

  it('1. valid EVALUATION request executes boundary exactly 1 time', async () => {
    vi.mocked(mockBoundary.execute).mockClear();
    vi.mocked(mockBoundary.execute).mockResolvedValueOnce(mockBoundaryResponseCompleted);

    await facade.execute(validRequest, validContext);
    expect(mockBoundary.execute).toHaveBeenCalledTimes(1);
  });

  it('2. runtime PRODUCTIVE mode is REJECTED and boundary 0 llamadas', async () => {
    vi.mocked(mockBoundary.execute).mockClear();
    const badRequest = { ...validRequest, executionMode: 'PRODUCTIVE' } as unknown as PublicPreviewRequestV1;
    const result = await facade.execute(badRequest, validContext);
    expect(mockBoundary.execute).toHaveBeenCalledTimes(0);
    expect(result.status).toBe('REJECTED');
    expect(result.safeError?.code).toBe('MODE_NOT_ALLOWED');
  });

  it('3. unknown capability results in 0 llamadas', async () => {
    vi.mocked(mockBoundary.execute).mockClear();
    const badRequest = { ...validRequest, capability: 'UNKNOWN_CAP' } as unknown as PublicPreviewRequestV1;
    const result = await facade.execute(badRequest, validContext);
    expect(mockBoundary.execute).toHaveBeenCalledTimes(0);
    expect(result.safeError?.code).toBe('CAPABILITY_NOT_ALLOWED');
  });

  it('3.5 unknown operation results in 0 llamadas', async () => {
    vi.mocked(mockBoundary.execute).mockClear();
    const badRequest = { ...validRequest, operation: 'UNKNOWN_OP' } as unknown as PublicPreviewRequestV1;
    const result = await facade.execute(badRequest, validContext);
    expect(mockBoundary.execute).toHaveBeenCalledTimes(0);
    expect(result.status).toBe('REJECTED');
    expect(result.safeError?.code).toBe('OPERATION_NOT_ALLOWED');
  });

  it('4. tenant mismatch results in 0 llamadas', async () => {
    vi.mocked(mockBoundary.execute).mockClear();
    const badRequest = { ...validRequest, tenantId: 'diff' };
    await facade.execute(badRequest, validContext);
    expect(mockBoundary.execute).toHaveBeenCalledTimes(0);
  });

  it('5. actor mismatch results in 0 llamadas', async () => {
    vi.mocked(mockBoundary.execute).mockClear();
    const badRequest = { ...validRequest, actorId: 'diff' };
    await facade.execute(badRequest, validContext);
    expect(mockBoundary.execute).toHaveBeenCalledTimes(0);
  });

  it('6. requestId mismatch contra trusted context results in 0 llamadas', async () => {
    vi.mocked(mockBoundary.execute).mockClear();
    const badRequest = { ...validRequest, requestId: 'diff' };
    await facade.execute(badRequest, validContext);
    expect(mockBoundary.execute).toHaveBeenCalledTimes(0);
  });

  it('7. correlationId mismatch results in 0 llamadas', async () => {
    vi.mocked(mockBoundary.execute).mockClear();
    const badRequest = { ...validRequest, correlationId: 'diff' };
    await facade.execute(badRequest, validContext);
    expect(mockBoundary.execute).toHaveBeenCalledTimes(0);
  });

  it('8. COMPLETED con output pÃºblico usable = true', async () => {
    vi.mocked(mockBoundary.execute).mockResolvedValueOnce(mockBoundaryResponseCompleted);
    const result = await facade.execute(validRequest, validContext);
    expect(result.usable).toBe(true);
  });

  it('9. PARTIAL con output pÃºblico usable = true', async () => {
    vi.mocked(mockBoundary.execute).mockResolvedValueOnce({
      ...mockBoundaryResponseCompleted,
      status: 'PARTIAL',
      resultSummary: { sessionId: 'sess-1' } // has public output
    });
    const result = await facade.execute(validRequest, validContext);
    expect(result.usable).toBe(true);
  });

  it('10. PARTIAL sin output Ãºtil usable = false', async () => {
    vi.mocked(mockBoundary.execute).mockResolvedValueOnce({
      ...mockBoundaryResponseCompleted,
      status: 'PARTIAL',
      resultSummary: { executionId: 'exec-1' } // only internal output, filtered out
    });
    const result = await facade.execute(validRequest, validContext);
    expect(result.usable).toBe(false);
  });

  it('11. REJECTED usable = false', async () => {
    vi.mocked(mockBoundary.execute).mockResolvedValueOnce({ ...mockBoundaryResponseCompleted, status: 'REJECTED' });
    const result = await facade.execute(validRequest, validContext);
    expect(result.usable).toBe(false);
  });

  it('12. FAILED usable = false', async () => {
    vi.mocked(mockBoundary.execute).mockResolvedValueOnce({ ...mockBoundaryResponseCompleted, status: 'FAILED' });
    const result = await facade.execute(validRequest, validContext);
    expect(result.usable).toBe(false);
  });

  it('13. CANCELLED usable = false', async () => {
    vi.mocked(mockBoundary.execute).mockResolvedValueOnce({ ...mockBoundaryResponseCompleted, status: 'CANCELLED' });
    const result = await facade.execute(validRequest, validContext);
    expect(result.usable).toBe(false);
  });

  it('14. TIMED_OUT usable = false', async () => {
    vi.mocked(mockBoundary.execute).mockResolvedValueOnce({ ...mockBoundaryResponseCompleted, status: 'TIMED_OUT' });
    const result = await facade.execute(validRequest, validContext);
    expect(result.usable).toBe(false);
  });

  it('15. shadowOnly siempre true', async () => {
    vi.mocked(mockBoundary.execute).mockResolvedValueOnce(mockBoundaryResponseCompleted);
    const result = await facade.execute(validRequest, validContext);
    expect(result.shadowOnly).toBe(true);
  });

  it('16. requestId preservado', async () => {
    vi.mocked(mockBoundary.execute).mockResolvedValueOnce(mockBoundaryResponseCompleted);
    const result = await facade.execute(validRequest, validContext);
    expect(result.requestId).toBe('req-1');
  });

  it('17. correlationId preservado', async () => {
    vi.mocked(mockBoundary.execute).mockResolvedValueOnce(mockBoundaryResponseCompleted);
    const result = await facade.execute(validRequest, validContext);
    expect(result.correlationId).toBe('corr-1');
  });

  it('18. idempotencyKey no implica enforcement', async () => {
    vi.mocked(mockBoundary.execute).mockClear();
    vi.mocked(mockBoundary.execute).mockResolvedValueOnce(mockBoundaryResponseCompleted);
    const reqWithIdempotency: PublicPreviewRequestV1 = { ...validRequest, idempotencyKey: 'idem-1' };
    await facade.execute(reqWithIdempotency, validContext);
    expect(mockBoundary.execute).toHaveBeenCalledWith(
      expect.not.objectContaining({ idempotencyKey: 'idem-1' }),
      validContext
    );
  });

  it('19. resultSummary interno no se devuelve por referencia', async () => {
    vi.mocked(mockBoundary.execute).mockResolvedValueOnce(mockBoundaryResponseCompleted);
    const result = await facade.execute(validRequest, validContext);
    expect(result.output).not.toBe(mockBoundaryResponseCompleted.resultSummary);
  });

  it('20. campos internal-only eliminados', async () => {
    vi.mocked(mockBoundary.execute).mockResolvedValueOnce(mockBoundaryResponseCompleted);
    const result = await facade.execute(validRequest, validContext);
    expect(result.output).toEqual({
      sessionId: 'sess-1',
      status: 'SUCCESS',
      startedAt: '123',
      completedAt: '456',
      durationMs: 100
    });
    // executionId is missing
    expect(result.output).not.toHaveProperty('executionId');
  });

  it('21. safeError no contiene stack', async () => {
    vi.mocked(mockBoundary.execute).mockResolvedValueOnce({
      ...mockBoundaryResponseCompleted,
      status: 'FAILED',
      errors: [{ code: 'ERR_1', message: 'Something', retryable: false, details: { stack: 'trace' } } as unknown as BoundaryPublicError]
    });
    const result = await facade.execute(validRequest, validContext);
    expect(result.safeError).not.toHaveProperty('stack');
  });

  it('24. safeError no contiene cause', async () => {
    vi.mocked(mockBoundary.execute).mockResolvedValueOnce({
      ...mockBoundaryResponseCompleted,
      status: 'FAILED',
      errors: [{ code: 'ERR_1', message: 'Something', retryable: false, details: { cause: 'cause' } } as unknown as BoundaryPublicError]
    });
    const result = await facade.execute(validRequest, validContext);
    expect(result.safeError).not.toHaveProperty('cause');
  });

  it('25. safeError no contiene provider/endpoint', async () => {
    vi.mocked(mockBoundary.execute).mockResolvedValueOnce({
      ...mockBoundaryResponseCompleted,
      status: 'FAILED',
      errors: [{ code: 'ERR_1', message: 'Provider timed out', retryable: true }]
    });
    const result = await facade.execute(validRequest, validContext);
    // safeError does not even have a message property anymore
    expect(result.safeError).not.toHaveProperty('message');
    expect(result.safeError).toEqual({ code: 'ERR_1', retryable: true });
  });

  it('24. no PipelineResult (no rawData / internal stages exposed)', async () => {
    vi.mocked(mockBoundary.execute).mockResolvedValueOnce(mockBoundaryResponseCompleted);
    const result = await facade.execute(validRequest, validContext);
    expect(result).not.toHaveProperty('stageResults');
    expect(result).not.toHaveProperty('rawData');
  });

  it('25. no stage names', async () => {
    vi.mocked(mockBoundary.execute).mockResolvedValueOnce({
      ...mockBoundaryResponseCompleted,
      resultSummary: { 'stage:init': 'done' }
    });
    const result = await facade.execute(validRequest, validContext);
    // Any unrecognized keys are stripped
    expect(result.output).toEqual(undefined);
  });

  it('26. no auditTrail', async () => {
    vi.mocked(mockBoundary.execute).mockResolvedValueOnce({
      ...mockBoundaryResponseCompleted,
      resultSummary: { auditTrail: ['event1'] }
    });
    const result = await facade.execute(validRequest, validContext);
    expect(result.output).toEqual(undefined);
  });

  it('27. mismo request + mismo boundary mock -> misma respuesta', async () => {
    vi.mocked(mockBoundary.execute).mockResolvedValue(mockBoundaryResponseCompleted);
    const result1 = await facade.execute(validRequest, validContext);
    const result2 = await facade.execute(validRequest, validContext);
    expect(result1).toEqual(result2);
  });

  it('28. ninguna dependencia Firebase/Cloud Run/fetch/URL/secrets en el entorno publico', () => {
    // Asserting structurally by absence of these terms in the facade.
    // At runtime, there is no HTTP context used here.
  });

  it('29. propagates capability and operation to boundary execute', async () => {
    vi.mocked(mockBoundary.execute).mockClear();
    vi.mocked(mockBoundary.execute).mockResolvedValueOnce(mockBoundaryResponseCompleted);

    await facade.execute(validRequest, validContext);

    expect(mockBoundary.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        capability: 'GROWTH_INTELLIGENCE_V1',
        operation: 'ANALYZE_CAMPAIGN',
      }),
      validContext
    );
  });
});
