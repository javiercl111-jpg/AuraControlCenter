import type { GovernedExecutionBoundary } from '../boundary/GovernedExecutionBoundary';
import type { BoundaryInvocationContextV1 } from '../boundary/types';
import type {
  PublicPreviewRequestV1,
  PublicPreviewResponseV1,
  PublicPreviewSafeErrorV1,
  PublicPreviewWarningV1,
} from './publicPreviewTypesV1';
import { PUBLIC_PREVIEW_CAPABILITIES_V1 } from './publicPreviewTypesV1';

export interface AuraIntelligencePublicPreviewFacadeV1Dependencies {
  readonly boundary: GovernedExecutionBoundary;
}

export class AuraIntelligencePublicPreviewFacadeV1 {
  private readonly deps: AuraIntelligencePublicPreviewFacadeV1Dependencies;

  constructor(deps: AuraIntelligencePublicPreviewFacadeV1Dependencies) {
    this.deps = deps;
  }

  public async execute(
    request: PublicPreviewRequestV1,
    invocationContext: BoundaryInvocationContextV1
  ): Promise<PublicPreviewResponseV1> {
    if (request.contractVersion !== '1.0') {
      return this.createRejectedResponse(
        request.requestId,
        request.correlationId,
        'CONTRACT_VERSION_UNSUPPORTED'
      );
    }

    if (request.tenantId !== invocationContext.tenantId) {
      return this.createRejectedResponse(
        request.requestId,
        request.correlationId,
        'TENANT_MISMATCH'
      );
    }

    if (request.actorId !== invocationContext.actor.actorId) {
      return this.createRejectedResponse(
        request.requestId,
        request.correlationId,
        'ACTOR_MISMATCH'
      );
    }

    if (request.requestId !== invocationContext.requestId) {
      return this.createRejectedResponse(
        request.requestId,
        request.correlationId,
        'REQUEST_ID_MISMATCH'
      );
    }

    if (request.correlationId !== invocationContext.correlationId) {
      return this.createRejectedResponse(
        request.requestId,
        request.correlationId,
        'CORRELATION_ID_MISMATCH'
      );
    }

    if (request.executionMode !== 'EVALUATION') {
      return this.createRejectedResponse(
        request.requestId,
        request.correlationId,
        'MODE_NOT_ALLOWED'
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!PUBLIC_PREVIEW_CAPABILITIES_V1.includes(request.capability as any)) {
      return this.createRejectedResponse(
        request.requestId,
        request.correlationId,
        'CAPABILITY_NOT_ALLOWED'
      );
    }

    const validOperations = [
      'ANALYZE_CAMPAIGN',
      'PRIORITIZE_OPPORTUNITIES',
      'RECOMMEND_ACTIONS',
      'ASSESS_GROWTH_CAPABILITY'
    ];

    if (!validOperations.includes(request.operation)) {
      return this.createRejectedResponse(
        request.requestId,
        request.correlationId,
        'OPERATION_NOT_ALLOWED'
      );
    }

    try {
      const boundaryResponse = await this.deps.boundary.execute(
        {
          requestId: invocationContext.requestId,
          correlationId: invocationContext.correlationId,
          tenant: { tenantId: invocationContext.tenantId },
          actor: { actorId: invocationContext.actor.actorId, actorType: invocationContext.actor.actorType },
          source: invocationContext.source,
          requestedMode: 'EVALUATION',
          payload: request.payload,
          capability: request.capability,
          operation: request.operation,
        },
        invocationContext
      );

      let usable = false;
      let output: Record<string, unknown> | undefined;

      if (boundaryResponse.status === 'COMPLETED' || boundaryResponse.status === 'PARTIAL') {
        if (boundaryResponse.resultSummary) {
          const safeOutput: Record<string, unknown> = {};
          const publicKeys = ['sessionId', 'status', 'startedAt', 'completedAt', 'durationMs'];
          for (const key of publicKeys) {
            if (key in boundaryResponse.resultSummary) {
              safeOutput[key] = boundaryResponse.resultSummary[key];
            }
          }
          if (Object.keys(safeOutput).length > 0) {
            output = safeOutput;
            usable = true;
          }
        }
      }

      let safeError: PublicPreviewSafeErrorV1 | undefined;

      if (!usable && boundaryResponse.errors.length > 0) {
        const firstError = boundaryResponse.errors[0];
        safeError = {
          code: firstError.code,
          retryable: firstError.retryable,
        };
      }

      const warnings: PublicPreviewWarningV1[] = boundaryResponse.warnings.map(w => ({
        code: w.code,
        message: w.message,
      }));

      return {
        contractVersion: '1.0',
        requestId: boundaryResponse.requestId,
        correlationId: boundaryResponse.correlationId,
        status: boundaryResponse.status,
        usable,
        shadowOnly: true,
        output,
        warnings,
        safeError,
      };
    } catch {
      return this.createRejectedResponse(
        request.requestId,
        request.correlationId,
        'INTERNAL_BOUNDARY_ERROR',
        false
      );
    }
  }

  private createRejectedResponse(
    requestId: string,
    correlationId: string,
    code: string,
    retryable = false
  ): PublicPreviewResponseV1 {
    return {
      contractVersion: '1.0',
      requestId,
      correlationId,
      status: 'REJECTED',
      usable: false,
      shadowOnly: true,
      warnings: [],
      safeError: {
        code,
        retryable,
      },
    };
  }
}
