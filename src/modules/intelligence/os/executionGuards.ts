import { AuraIntelligenceOSError, ErrorCodes } from './errors';
import type { PipelineClock, PipelineCancellationSignal, PipelineTimeoutPolicy, PipelineAuditSink } from './ports';
import type { PipelineStageId } from './types';

export interface GuardContext {
  clock: PipelineClock;
  timeoutPolicy?: PipelineTimeoutPolicy;
  cancellationSignal?: PipelineCancellationSignal;
  auditSink?: PipelineAuditSink;
  globalStartedAtMs: number;
  executionId: string;
}

export async function executeWithGuards<T>(
  operationFn: () => Promise<T>,
  stage: PipelineStageId,
  ctx: GuardContext
): Promise<T> {
  const safeLog = (level: 'INFO' | 'WARN' | 'ERROR', message: string, metadata?: Record<string, unknown>) => {
    try {
      ctx.auditSink?.log(level, message, metadata);
    } catch (e) {
      // Ignore audit sink failures
    }
  };

  // 1. Check early cancellation
  if (ctx.cancellationSignal?.aborted) {
    throw new AuraIntelligenceOSError(ErrorCodes.CANCELLED, 'Execution cancelled', false, stage, { reason: ctx.cancellationSignal?.reason ? String(ctx.cancellationSignal.reason) : undefined });
  }

  const now = ctx.clock.now();
  const globalTimeoutMs = ctx.timeoutPolicy?.getExecutionTimeoutMs() ?? 0;
  let timeRemainingMs = Infinity;

  // 2. Check early global timeout
  if (globalTimeoutMs > 0) {
    const elapsed = now - ctx.globalStartedAtMs;
    timeRemainingMs = globalTimeoutMs - elapsed;
    if (timeRemainingMs <= 0) {
      throw new AuraIntelligenceOSError(ErrorCodes.PIPELINE_TIMEOUT, 'Global timeout exceeded', false, stage);
    }
  }

  const stageTimeoutMs = ctx.timeoutPolicy?.getStageTimeoutMs(stage) ?? 0;
  const effectiveTimeoutMs = stageTimeoutMs > 0 ? Math.min(stageTimeoutMs, timeRemainingMs) : timeRemainingMs;

  let isSettled = false;
  let timerId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<T>((_, reject) => {
    if (effectiveTimeoutMs !== Infinity) {
      timerId = setTimeout(() => {
        if (!isSettled) {
          isSettled = true;
          const isGlobal = effectiveTimeoutMs === timeRemainingMs && stageTimeoutMs !== timeRemainingMs;
          const code = isGlobal ? ErrorCodes.PIPELINE_TIMEOUT : ErrorCodes.STAGE_TIMEOUT;
          reject(new AuraIntelligenceOSError(code, `Timeout exceeded in stage ${stage}`, false, stage));
        }
      }, effectiveTimeoutMs);
    }
  });

  const runOperation = async () => {
    let result: T;
    try {
      result = await operationFn();
    } catch (error) {
      if (isSettled) {
        safeLog('WARN', `Late rejection in stage ${stage} after timeout or cancellation`, {
          executionId: ctx.executionId,
          stage,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        });
        throw error;
      }
      isSettled = true;
      if (timerId) clearTimeout(timerId);

      if (ctx.cancellationSignal?.aborted) {
        throw new AuraIntelligenceOSError(ErrorCodes.CANCELLED, 'Execution cancelled during operation', false, stage, { reason: ctx.cancellationSignal?.reason ? String(ctx.cancellationSignal.reason) : undefined, originalError: error instanceof Error ? error.message : String(error) });
      }
      throw error;
    }

    if (isSettled) {
      safeLog('WARN', `Late resolution in stage ${stage} after timeout or cancellation`, { executionId: ctx.executionId, stage });
      return result;
    }
    isSettled = true;
    if (timerId) clearTimeout(timerId);

    if (ctx.cancellationSignal?.aborted) {
      throw new AuraIntelligenceOSError(ErrorCodes.CANCELLED, 'Execution cancelled after resolution', false, stage, { reason: ctx.cancellationSignal?.reason ? String(ctx.cancellationSignal.reason) : undefined });
    }

    return result;
  };

  const operationPromise = runOperation();

  // Observer to prevent unhandled rejections on late failures
  // This does not alter operationPromise type but ensures Node doesn't crash
  operationPromise.catch(() => {});

  if (effectiveTimeoutMs !== Infinity) {
    return Promise.race([operationPromise, timeoutPromise]);
  }

  return operationPromise;
}
