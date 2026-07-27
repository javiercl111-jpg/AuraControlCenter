import type {
  GovernedExecutionRequest,
  GovernedExecutionResponse,
  BoundaryStatus,
  BoundaryPublicError,
} from './types';
import type {
  BoundaryClockPort,
  FeaturePolicyPort,
  BoundaryExecutionPort,
  ShadowComparisonPort,
  BoundaryAuditPort,
  InternalPayloadValue,
} from './ports';
import { GovernedBoundaryError } from './errors';
import { evaluateBoundaryPolicy } from './policies';
import {
  createSafeInternalPayload,
  validateGovernedRequest,
  estimateSizeInBytes,
} from './validators';
import {
  sanitizeMetadata,
  sanitizePublicError,
  sanitizeResultSummary,
  sanitizeComparisonSummary,
} from './sanitizers';

export interface GovernedExecutionBoundaryConfig {
  readonly featurePolicyPort?: FeaturePolicyPort;
  readonly clockPort: BoundaryClockPort;
  readonly executionPort: BoundaryExecutionPort;
  readonly shadowComparisonPort?: ShadowComparisonPort;
  readonly auditPort?: BoundaryAuditPort;
}

export class GovernedExecutionBoundary {
  private readonly featurePolicyPort?: FeaturePolicyPort;
  private readonly clockPort: BoundaryClockPort;
  private readonly executionPort: BoundaryExecutionPort;
  private readonly shadowComparisonPort?: ShadowComparisonPort;
  private readonly auditPort?: BoundaryAuditPort;

  constructor(config: GovernedExecutionBoundaryConfig) {
    this.featurePolicyPort = config.featurePolicyPort;
    this.clockPort = config.clockPort;
    this.executionPort = config.executionPort;
    this.shadowComparisonPort = config.shadowComparisonPort;
    this.auditPort = config.auditPort;
  }

  public async execute(rawRequest: unknown): Promise<GovernedExecutionResponse> {
    const startedAt = this.clockPort.now();
    const fallbackId = 'UNKNOWN_ID';
    let validatedReq: GovernedExecutionRequest | undefined = undefined;

    try {
      validatedReq = validateGovernedRequest(rawRequest);
    } catch (err: unknown) {
      const completedAt = this.clockPort.now();
      const pubError = sanitizePublicError(err);
      return this.buildResponse({
        requestId: this.extractString(rawRequest, 'requestId') || fallbackId,
        correlationId: this.extractString(rawRequest, 'correlationId') || fallbackId,
        mode: 'DISABLED',
        status: 'REJECTED',
        startedAt,
        completedAt,
        durationMs: this.calculateDuration(startedAt, completedAt),
        errors: [pubError],
        warnings: [],
      });
    }

    const req = validatedReq;

    // Fail-Closed: Policy evaluation
    let policyDecision;
    try {
      if (!this.featurePolicyPort) {
        throw new GovernedBoundaryError('BOUNDARY_DISABLED', 'FeaturePolicyPort is missing', false);
      }
      const policy = await this.featurePolicyPort.getEffectivePolicy(req.tenant.tenantId, req.source);
      const payloadSize = estimateSizeInBytes(req.payload);
      policyDecision = evaluateBoundaryPolicy(
        policy,
        req.requestedMode,
        req.source,
        req.timeoutMs,
        payloadSize
      );
    } catch (err: unknown) {
      const completedAt = this.clockPort.now();
      const pubError = sanitizePublicError(err);
      return this.buildResponse({
        requestId: req.requestId,
        correlationId: req.correlationId,
        mode: 'DISABLED',
        status: 'REJECTED',
        startedAt,
        completedAt,
        durationMs: this.calculateDuration(startedAt, completedAt),
        errors: [pubError],
        warnings: [],
      });
    }

    if (!policyDecision.allowed || policyDecision.error) {
      const completedAt = this.clockPort.now();
      const pubError = sanitizePublicError(
        policyDecision.error || new GovernedBoundaryError('BOUNDARY_DISABLED', 'Boundary access denied', false)
      );
      return this.buildResponse({
        requestId: req.requestId,
        correlationId: req.correlationId,
        mode: 'DISABLED',
        status: 'REJECTED',
        startedAt,
        completedAt,
        durationMs: this.calculateDuration(startedAt, completedAt),
        errors: [pubError],
        warnings: [],
      });
    }

    // Check cancellation
    if (req.cancellationSignal?.aborted) {
      const completedAt = this.clockPort.now();
      const pubError = sanitizePublicError(
        new GovernedBoundaryError('CANCELLED', 'Request was cancelled before execution', false)
      );
      return this.buildResponse({
        requestId: req.requestId,
        correlationId: req.correlationId,
        mode: req.requestedMode,
        status: 'CANCELLED',
        startedAt,
        completedAt,
        durationMs: this.calculateDuration(startedAt, completedAt),
        errors: [pubError],
        warnings: [],
      });
    }

    // Prepare execution
    const cleanMeta = sanitizeMetadata(req.metadata);
    let internalPayload: InternalPayloadValue;
    try {
      internalPayload = createSafeInternalPayload(req.payload);
    } catch (err: unknown) {
      const completedAt = this.clockPort.now();
      return this.buildResponse({
        requestId: req.requestId,
        correlationId: req.correlationId,
        mode: 'DISABLED',
        status: 'REJECTED',
        startedAt,
        completedAt,
        durationMs: this.calculateDuration(startedAt, completedAt),
        errors: [sanitizePublicError(err)],
        warnings: [],
      });
    }

    try {
      const internalInput = {
        sessionId: req.correlationId,
        payload: internalPayload,
        metadata: cleanMeta,
      };

      const internalResult = await this.executionPort.execute(internalInput, req.cancellationSignal);
      const completedAt = this.clockPort.now();
      const durationMs = this.calculateDuration(startedAt, completedAt);

      const resultSummary = sanitizeResultSummary(internalResult);
      let comparisonSummary: Record<string, unknown> | undefined = undefined;

      if (req.requestedMode === 'EVALUATION' && this.shadowComparisonPort) {
        try {
          const comp = await this.shadowComparisonPort.compare(internalPayload, internalResult.rawData || internalResult);
          comparisonSummary = sanitizeComparisonSummary(comp);
        } catch {
          // Failure in shadow comparison does not fail execution summary
        }
      }

      const responseStatus: BoundaryStatus = internalResult.status === 'SUCCEEDED' || internalResult.status === 'SUCCESS' || internalResult.status === 'COMPLETED'
        ? 'COMPLETED'
        : internalResult.status === 'TIMED_OUT'
        ? 'TIMED_OUT'
        : internalResult.status === 'CANCELLED'
        ? 'CANCELLED'
        : 'FAILED';

      const errors: BoundaryPublicError[] = [];
      if (internalResult.errors && internalResult.errors.length > 0) {
        for (let i = 0; i < internalResult.errors.length; i++) {
          const e = internalResult.errors[i];
          errors.push(sanitizePublicError(new Error(e.message)));
        }
      }

      const response = this.buildResponse({
        requestId: req.requestId,
        correlationId: req.correlationId,
        mode: req.requestedMode,
        status: responseStatus,
        startedAt,
        completedAt,
        durationMs,
        resultSummary,
        comparisonSummary,
        warnings: internalResult.warnings ? internalResult.warnings.map(w => ({ code: 'WARN', message: w })) : [],
        errors,
      });

      this.tryAuditLog('BOUNDARY_EXECUTION_COMPLETED', {
        requestId: req.requestId,
        tenantId: req.tenant.tenantId,
        mode: req.requestedMode,
        status: responseStatus,
        executionId: fallbackId,
      });

      return response;
    } catch (err: unknown) {
      const completedAt = this.clockPort.now();
      const pubError = sanitizePublicError(err);
      return this.buildResponse({
        requestId: req.requestId,
        correlationId: req.correlationId,
        mode: req.requestedMode,
        status: 'FAILED',
        startedAt,
        completedAt,
        durationMs: this.calculateDuration(startedAt, completedAt),
        errors: [pubError],
        warnings: [],
      });
    }
  }

  private extractString(obj: unknown, key: string): string | undefined {
    if (typeof obj === 'object' && obj !== null && key in obj) {
      const val = (obj as Record<string, unknown>)[key];
      if (typeof val === 'string') return val;
    }
    return undefined;
  }

  private calculateDuration(startedAt: string, completedAt: string): number {
    try {
      const startMs = Date.parse(startedAt);
      const endMs = Date.parse(completedAt);
      if (!Number.isNaN(startMs) && !Number.isNaN(endMs)) {
        return Math.max(0, endMs - startMs);
      }
    } catch {
      // Fallback
    }
    return 0;
  }

  private tryAuditLog(eventName: string, data: Readonly<Record<string, unknown>>): void {
    if (this.auditPort) {
      try {
        void this.auditPort.logEvent(eventName, data);
      } catch {
        // Non-blocking audit
      }
    }
  }

  private buildResponse(params: {
    requestId: string;
    correlationId: string;
    mode: GovernedExecutionResponse['mode'];
    status: BoundaryStatus;
    startedAt: string;
    completedAt: string;
    durationMs: number;
    resultSummary?: Record<string, unknown>;
    comparisonSummary?: Record<string, unknown>;
    warnings: GovernedExecutionResponse['warnings'];
    errors: GovernedExecutionResponse['errors'];
  }): GovernedExecutionResponse {
    return {
      requestId: params.requestId,
      correlationId: params.correlationId,
      mode: params.mode,
      status: params.status,
      startedAt: params.startedAt,
      completedAt: params.completedAt,
      durationMs: params.durationMs,
      ...(params.resultSummary ? { resultSummary: params.resultSummary } : {}),
      ...(params.comparisonSummary ? { comparisonSummary: params.comparisonSummary } : {}),
      warnings: params.warnings,
      errors: params.errors,
    };
  }
}

export default GovernedExecutionBoundary;
