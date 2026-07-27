import type { PipelineResult } from '../types';
import type { ShadowClock, ShadowExecutionIdGenerator, ShadowAuditSink } from './ports';
import type { 
  ShadowExecutionRequest, 
  ShadowExecutionResult, 
  ShadowExecutionPolicy,
  ShadowAdmissionDecision,
  ShadowExecutionContext,
  ShadowAuditRecord,
  ShadowExecutionStatus
} from './types';
import { AuraShadowError, ShadowErrorCodes } from './errors';
import { MetadataSanitizer } from './metadataSanitizer';

class DefaultShadowExecutionContext implements ShadowExecutionContext {
  public readonly shadowExecutionId: string;
  public readonly executionKey: string;
  public readonly sessionKey: string;
  public readonly policy: ShadowExecutionPolicy;
  public readonly startedAtMs: number;
  private readonly requestSignal?: { readonly aborted: boolean; readonly reason?: unknown };

  constructor(
    shadowExecutionId: string,
    executionKey: string,
    sessionKey: string,
    policy: ShadowExecutionPolicy,
    startedAtMs: number,
    requestSignal?: { readonly aborted: boolean; readonly reason?: unknown }
  ) {
    this.shadowExecutionId = shadowExecutionId;
    this.executionKey = executionKey;
    this.sessionKey = sessionKey;
    this.policy = policy;
    this.startedAtMs = startedAtMs;
    this.requestSignal = requestSignal;
  }

  public isCancelled(): boolean {
    return this.requestSignal?.aborted ?? false;
  }
}

export class ShadowExecutionGuard {
  private activeExecutions = new Map<string, string>(); // shadowExecutionId -> sessionKey
  private activeSessions = new Map<string, number>(); // sessionKey -> count
  private recentExecutionKeys = new Map<string, number>(); // executionKey -> timestamp

  private admittedCount = 0;
  private rejectedCount = 0;
  private duplicateCount = 0;
  private timeoutCount = 0;
  private cancelledCount = 0;
  private clock: ShadowClock;
  private idGenerator: ShadowExecutionIdGenerator;
  private auditSink?: ShadowAuditSink;

  constructor(
    clock: ShadowClock,
    idGenerator: ShadowExecutionIdGenerator,
    auditSink?: ShadowAuditSink
  ) {
    this.clock = clock;
    this.idGenerator = idGenerator;
    this.auditSink = auditSink;
  }

  public async execute(
    request: ShadowExecutionRequest,
    policy: ShadowExecutionPolicy
  ): Promise<ShadowExecutionResult> {
    const startedAt = this.clock.toISOString();
    const startedAtMs = this.clock.now();
    const shadowExecutionId = this.idGenerator.generateExecutionId();
    const auditRecords: ShadowAuditRecord[] = [];

    const safeMetadata = policy.redactSensitiveMetadata 
      ? MetadataSanitizer.sanitize(request.metadata)
      : request.metadata as Record<string, string | number | boolean>;

    const safeLog = (status: ShadowExecutionStatus, reasonCode?: string, duration?: number) => {
      if (!policy.collectAuditRecords) return;
      const record: ShadowAuditRecord = {
        eventType: 'SHADOW_EXECUTION',
        executionId: shadowExecutionId,
        executionKey: request.executionKey,
        sessionKey: request.sessionKey,
        timestamp: this.clock.toISOString(),
        status,
        reasonCode,
        durationMs: duration,
        safeMetadata
      };
      auditRecords.push(record);
      
      try {
        this.auditSink?.log(status === 'FAILED' ? 'ERROR' : 'INFO', `Shadow execution ${status}`, {
          executionId: shadowExecutionId,
          executionKey: request.executionKey,
          reasonCode
        });
      } catch (e) {
        // Ignore audit sink failures
      }
    };

    // 1. Check admission
    this.cleanupDeduplicationCache(policy.deduplicationWindowMs);

    let admission = this.checkAdmission(request, policy, safeMetadata);

    if (request.cancellationSignal?.aborted) {
      admission = {
        admitted: false,
        reason: 'CANCELLED',
        executionKey: request.executionKey,
        sessionKey: request.sessionKey,
        decidedAt: this.clock.toISOString(),
        retryable: false,
        safeMetadata
      };
    }

    if (!admission.admitted) {
      this.incrementRejectionMetrics(admission.reason);
      safeLog('REJECTED', admission.reason);
      return this.buildResult(shadowExecutionId, request, admission, 'REJECTED', startedAt, startedAtMs, undefined, undefined, auditRecords);
    }

    // 2. Acquire slot
    this.admittedCount++;
    this.activeExecutions.set(shadowExecutionId, request.sessionKey);
    const sessionCount = this.activeSessions.get(request.sessionKey) ?? 0;
    this.activeSessions.set(request.sessionKey, sessionCount + 1);
    this.recentExecutionKeys.set(request.executionKey, startedAtMs);

    const context = new DefaultShadowExecutionContext(
      shadowExecutionId,
      request.executionKey,
      request.sessionKey,
      policy,
      startedAtMs,
      request.cancellationSignal
    );

    let finalStatus: ShadowExecutionStatus = 'RUNNING';
    let pipelineResult: PipelineResult | undefined;
    let normalizedError: AuraShadowError | undefined;

    try {
      safeLog('RUNNING');
      
      if (context.isCancelled()) {
        finalStatus = 'CANCELLED';
        this.cancelledCount++;
        throw new AuraShadowError(ShadowErrorCodes.SHADOW_EXECUTION_REJECTED, 'Cancelled before execution', false);
      }

      pipelineResult = await this.executeWithTimeout(request.execute, context, policy.executionTimeoutMs);
      finalStatus = 'SUCCEEDED';
    } catch (error) {
      if (context.isCancelled()) {
        finalStatus = 'CANCELLED';
        this.cancelledCount++;
        normalizedError = new AuraShadowError(ShadowErrorCodes.SHADOW_EXECUTION_REJECTED, 'Cancelled during execution', false);
      } else if (error instanceof AuraShadowError && error.code === ShadowErrorCodes.SHADOW_EXECUTION_TIMEOUT) {
        finalStatus = 'TIMED_OUT';
        this.timeoutCount++;
        normalizedError = error;
      } else {
        finalStatus = 'FAILED';
        normalizedError = error instanceof AuraShadowError 
          ? error 
          : new AuraShadowError(ShadowErrorCodes.SHADOW_EXECUTION_REJECTED, error instanceof Error ? error.message : 'Unknown error', false, error);
      }
    } finally {
      // 3. Release slot
      this.activeExecutions.delete(shadowExecutionId);
      const currentCount = this.activeSessions.get(request.sessionKey) ?? 0;
      if (currentCount <= 1) {
        this.activeSessions.delete(request.sessionKey);
      } else {
        this.activeSessions.set(request.sessionKey, currentCount - 1);
      }
      
      const completedAtMs = this.clock.now();
      safeLog(finalStatus, normalizedError?.code, completedAtMs - startedAtMs);
    }

    return this.buildResult(shadowExecutionId, request, admission, finalStatus, startedAt, startedAtMs, pipelineResult, normalizedError, auditRecords);
  }

  private checkAdmission(
    request: ShadowExecutionRequest, 
    policy: ShadowExecutionPolicy,
    safeMetadata?: Record<string, string | number | boolean>
  ): ShadowAdmissionDecision {
    const decidedAt = this.clock.toISOString();
    
    if (!policy.enabled) {
      return { admitted: false, reason: 'DISABLED', executionKey: request.executionKey, sessionKey: request.sessionKey, decidedAt, retryable: false, safeMetadata };
    }
    
    if (!request.executionKey || !request.sessionKey) {
      return { admitted: false, reason: 'INVALID_REQUEST', executionKey: request.executionKey, sessionKey: request.sessionKey, decidedAt, retryable: false, safeMetadata };
    }

    if (!policy.allowDuplicateExecutionKeys && this.recentExecutionKeys.has(request.executionKey)) {
      return { admitted: false, reason: 'DUPLICATE', executionKey: request.executionKey, sessionKey: request.sessionKey, decidedAt, retryable: false, safeMetadata };
    }

    if (this.activeExecutions.size >= policy.maxConcurrentExecutions) {
      return { admitted: false, reason: 'GLOBAL_CONCURRENCY_LIMIT', executionKey: request.executionKey, sessionKey: request.sessionKey, decidedAt, retryable: true, safeMetadata };
    }

    const sessionCount = this.activeSessions.get(request.sessionKey) ?? 0;
    if (sessionCount >= policy.maxConcurrentPerSession) {
      return { admitted: false, reason: 'SESSION_CONCURRENCY_LIMIT', executionKey: request.executionKey, sessionKey: request.sessionKey, decidedAt, retryable: true, safeMetadata };
    }

    return { admitted: true, executionKey: request.executionKey, sessionKey: request.sessionKey, decidedAt, retryable: false, safeMetadata };
  }

  private cleanupDeduplicationCache(windowMs: number) {
    if (windowMs <= 0) return;
    const now = this.clock.now();
    
    // Prevent unbounded growth
    if (this.recentExecutionKeys.size > 1000) {
       this.recentExecutionKeys.clear();
       return;
    }

    for (const [key, timestamp] of this.recentExecutionKeys.entries()) {
      if (now - timestamp > windowMs) {
        this.recentExecutionKeys.delete(key);
      }
    }
  }

  private async executeWithTimeout(
    executeFn: (ctx: ShadowExecutionContext) => Promise<PipelineResult>,
    context: ShadowExecutionContext,
    timeoutMs: number
  ): Promise<PipelineResult> {
    if (timeoutMs <= 0) {
      return executeFn(context);
    }

    let isSettled = false;
    let timerId: ReturnType<typeof setTimeout> | undefined;

    const timeoutPromise = new Promise<PipelineResult>((_, reject) => {
      timerId = setTimeout(() => {
        if (!isSettled) {
          isSettled = true;
          reject(new AuraShadowError(ShadowErrorCodes.SHADOW_EXECUTION_TIMEOUT, 'Shadow execution timed out', false));
        }
      }, timeoutMs);
    });

    const operationPromise = (async () => {
      let result: PipelineResult;
      try {
        result = await executeFn(context);
      } catch (error) {
        if (isSettled) {
          throw error; // Caught by safe hidden catch
        }
        isSettled = true;
        if (timerId) clearTimeout(timerId);
        
        if (context.isCancelled()) {
          throw new AuraShadowError(ShadowErrorCodes.SHADOW_EXECUTION_REJECTED, 'Cancelled during execution', false);
        }
        throw error;
      }

      if (isSettled) {
        return result; // Late resolution, ignored by race
      }
      isSettled = true;
      if (timerId) clearTimeout(timerId);

      if (context.isCancelled()) {
        throw new AuraShadowError(ShadowErrorCodes.SHADOW_EXECUTION_REJECTED, 'Cancelled after execution', false);
      }

      return result;
    })();

    operationPromise.catch(() => {}); // Prevent unhandled rejections for late failures

    return Promise.race([operationPromise, timeoutPromise]);
  }

  private incrementRejectionMetrics(reason?: string) {
    this.rejectedCount++;
    if (reason === 'DUPLICATE') this.duplicateCount++;
    if (reason === 'CANCELLED') this.cancelledCount++;
  }

  private buildResult(
    shadowExecutionId: string,
    request: ShadowExecutionRequest,
    admissionDecision: ShadowAdmissionDecision,
    status: ShadowExecutionStatus,
    startedAt: string,
    startedAtMs: number,
    pipelineResult?: PipelineResult,
    normalizedError?: AuraShadowError,
    auditRecords: ShadowAuditRecord[] = []
  ): ShadowExecutionResult {
    const completedAt = this.clock.toISOString();
    return {
      shadowExecutionId,
      executionKey: request.executionKey,
      sessionKey: request.sessionKey,
      admissionDecision,
      status,
      startedAt,
      completedAt,
      durationMs: this.clock.now() - startedAtMs,
      pipelineResult,
      normalizedError: normalizedError?.toJSON(),
      metrics: {
        activeExecutions: this.activeExecutions.size,
        activeSessions: this.activeSessions.size,
        queuedExecutions: 0,
        admittedCount: this.admittedCount,
        rejectedCount: this.rejectedCount,
        duplicateCount: this.duplicateCount,
        timeoutCount: this.timeoutCount,
        cancelledCount: this.cancelledCount
      },
      auditRecords,
      wasDeduplicated: admissionDecision.reason === 'DUPLICATE',
      wasQueued: false,
      slotWaitMs: 0
    };
  }
}
