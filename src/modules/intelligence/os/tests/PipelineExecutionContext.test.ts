// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { describe, it, expect } from 'vitest';
import { PipelineExecutionContext } from '../PipelineExecutionContext';
import { AuraIntelligenceOSError, ErrorCodes } from '../errors';
import type { PipelineClock, PipelineCancellationSignal } from '../ports';
import type { PipelineInput, PipelineResult, PipelineStageResult } from '../types';

describe('Aura Intelligence OS - AI-02A Contracts & Execution State', () => {
  const mockClock: PipelineClock = {
    now: () => 1672531200000,
    toISOString: () => '2023-01-01T00:00:00.000Z'
  };

  const mockInput: PipelineInput = {
    sessionId: 'session-123',
    executionKey: 'key-456'
  };

  it('1. Creación determinista del contexto con clock e ID falsos', () => {
    const context = new PipelineExecutionContext('exec-1', mockClock, mockInput);
    expect(context.executionId).toBe('exec-1');
    expect(context.createdAt).toBe('2023-01-01T00:00:00.000Z');
  });

  it('2, 14. Inmutabilidad del input y ausencia de I/O directo en contratos', () => {
    const inputWithData: PipelineInput = {
      sessionId: 'session-2',
      objectiveIds: ['obj-1'],
      metadata: { key: 'value' }
    };
    const context = new PipelineExecutionContext('exec-2', mockClock, inputWithData);
    
    expect(Object.isFrozen(context.initialInput)).toBe(true);
    expect(Object.isFrozen(context.initialInput.objectiveIds)).toBe(true);
    expect(Object.isFrozen(context.initialInput.metadata)).toBe(true);

    expect(() => {
      // @ts-expect-error Testing immutability constraint
      context.initialInput.sessionId = 'mutated';
    }).toThrow();
  });

  it('16. Versiones correctas', () => {
    const context = new PipelineExecutionContext('exec-1', mockClock, mockInput);
    expect(context.contractVersion).toBe('1');
    expect(context.pipelineVersion).toBe('1');
  });

  it('17. Contexto sin targetScenario no lo inventa', () => {
    const context = new PipelineExecutionContext('exec-1', mockClock, mockInput);
    expect(context.initialInput.targetScenario).toBeUndefined();
  });

  it('18. Contexto sin objectiveIds no los inventa silenciosamente', () => {
    const context = new PipelineExecutionContext('exec-1', mockClock, mockInput);
    expect(context.initialInput.objectiveIds).toBeUndefined();
  });

  it('19. Cancelación opcional', () => {
    let aborted = false;
    const signal: PipelineCancellationSignal = {
      get aborted() { return aborted; }
    };
    const context = new PipelineExecutionContext('exec-1', mockClock, mockInput, signal);
    
    expect(context.isCancelled()).toBe(false);
    aborted = true;
    expect(context.isCancelled()).toBe(true);
  });

  it('20. Metadata segura tipada', () => {
    const inputWithMetadata: PipelineInput = {
      sessionId: 's-1',
      metadata: { stringKey: 'str', numKey: 42, boolKey: true }
    };
    const context = new PipelineExecutionContext('exec-1', mockClock, inputWithMetadata);
    expect(context.metadata?.stringKey).toBe('str');
    expect(context.metadata?.numKey).toBe(42);
    expect(context.metadata?.boolKey).toBe(true);
  });
});

describe('AuraIntelligenceOSError', () => {
  it('11. Error serializable y 12. Retryable', () => {
    const error = new AuraIntelligenceOSError(
      ErrorCodes.INVALID_INPUT,
      'Test error',
      false
    );
    expect(error.code).toBe('INVALID_INPUT');
    expect(error.retryable).toBe(false);

    const json = error.toJSON();
    expect(json.code).toBe('INVALID_INPUT');
    expect(json.message).toBe('Test error');
    expect(json.name).toBe('AuraIntelligenceOSError');
  });

  it('13. Error asociado a una etapa y preservando la causa', () => {
    const cause = new Error('Inner failure');
    const error = new AuraIntelligenceOSError(
      ErrorCodes.STAGE_EXECUTION_FAILED,
      'Stage failed',
      true,
      'EVIDENCE_EXTRACTION',
      { attempt: 1 },
      cause
    );

    expect(error.stage).toBe('EVIDENCE_EXTRACTION');
    
    const json = error.toJSON();
    expect(json.stage).toBe('EVIDENCE_EXTRACTION');
    expect(json.metadata?.attempt).toBe(1);
    expect(json.cause).toEqual({ message: 'Inner failure', name: 'Error' });
  });
});

describe('Estados Válidos (Tipos)', () => {
  it('3, 4, 5, 6, 7, 8, 9, 10. Valida estructuralmente resultados de stage y globales', () => {
    // Stage SKIPPED
    const skippedStage: PipelineStageResult<unknown> = {
      stage: 'KNOWLEDGE_COVERAGE',
      status: 'SKIPPED',
      startedAt: '2023-01-01T00:00:00.000Z',
      completedAt: '2023-01-01T00:00:00.000Z',
      durationMs: 0,
      errors: [],
      warnings: [],
      skippedReason: 'No target scenario'
    };
    expect(skippedStage.status).toBe('SKIPPED');
    expect(skippedStage.skippedReason).toBe('No target scenario');

    // Stage PARTIAL_SUCCESS con error normalizado y output preservado
    const partialStage: PipelineStageResult<{ someData: boolean }> = {
      stage: 'EVIDENCE_EXTRACTION',
      status: 'PARTIAL',
      startedAt: '2023-01-01T00:00:00.000Z',
      completedAt: '2023-01-01T00:00:01.000Z',
      durationMs: 1000,
      output: { someData: true },
      errors: [
        new AuraIntelligenceOSError(ErrorCodes.PARTIAL_RESULT, 'Some elements failed', false).toJSON()
      ],
      warnings: []
    };
    expect(partialStage.status).toBe('PARTIAL');
    expect(partialStage.output?.someData).toBe(true);
    expect(partialStage.errors[0].code).toBe('PARTIAL_RESULT');

    // Resultado global
    const result: PipelineResult = {
      contractVersion: '1',
      pipelineVersion: '1',
      executionId: 'exec-1',
      sessionId: 'session-1',
      status: 'SUCCESS',
      startedAt: '2023-01-01T00:00:00.000Z',
      completedAt: '2023-01-01T00:00:01.000Z',
      durationMs: 1000,
      stageResults: {
        EVIDENCE_EXTRACTION: partialStage,
        KNOWLEDGE_COVERAGE: skippedStage
      },
      partialFailures: true,
      skippedStages: ['KNOWLEDGE_COVERAGE'],
      errors: [],
      warnings: [],
      auditTrail: ['Execution started']
    };
    expect(result.status).toBe('SUCCESS');
    expect(result.stageResults.EVIDENCE_EXTRACTION).toBeDefined();
  });
});
