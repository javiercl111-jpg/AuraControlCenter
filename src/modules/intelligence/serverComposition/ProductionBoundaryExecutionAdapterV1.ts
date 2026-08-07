import type {
  BoundaryExecutionPort,
  InternalExecutionInput,
  InternalExecutionResult,
} from '../os/boundary/ports';
import {
  createBootstrapBoundaryBridgeAuthorityV1,
  createBootstrapBoundaryBridgeEnvelopeV1,
} from '../os/bootstrapBoundaryBridge/validators';
import {
  mapBootstrapBoundaryEnvelopeToPipelineInputV1,
} from '../os/bootstrapBoundaryAdapter/BootstrapBoundaryInputMapperV1';
import {
  PipelineBootstrapExecutionComposer,
  type PipelineBootstrapExecutionResult,
} from '../os/bootstrap/PipelineBootstrapExecutionComposer';
import type {
  PipelineResult,
  PipelineStatus,
} from '../os/types';

function mapPipelineStatus(
  status: PipelineStatus,
): string {
  switch (status) {
    case 'SUCCESS':
      return 'SUCCEEDED';
    case 'PARTIAL_SUCCESS':
      return 'PARTIAL';
    case 'FAILED':
      return 'FAILED';
    case 'CANCELLED':
      return 'CANCELLED';
    case 'TIMED_OUT':
      return 'TIMED_OUT';
    default:
      return 'FAILED';
  }
}

function mapPipelineResult(
  result: PipelineResult,
): InternalExecutionResult {
  return Object.freeze({
    executionId: result.executionId,
    sessionId: result.sessionId,
    status: mapPipelineStatus(result.status),
    stageResults: Object.freeze({
      ...result.stageResults,
    }),
    rawData: result,
    errors: Object.freeze(
      result.errors.map((error) =>
        Object.freeze({
          message: error.message,
          ...(error.code !== undefined
            ? { code: error.code }
            : {}),
        }),
      ),
    ),
    warnings: Object.freeze([...result.warnings]),
  });
}

function mapComposerResult(
  result: PipelineBootstrapExecutionResult,
  fallbackSessionId: string,
): InternalExecutionResult {
  if (result.status === 'BOOTSTRAP_REJECTED') {
    return Object.freeze({
      executionId: result.bootstrapState.bootstrapId,
      sessionId: fallbackSessionId,
      status: 'FAILED',
      rawData: result.bootstrapState,
      errors: Object.freeze([]),
      warnings: Object.freeze([]),
    });
  }

  return mapPipelineResult(result.pipelineResult);
}

export class ProductionBoundaryExecutionAdapterV1
  implements BoundaryExecutionPort
{
  private readonly composer: Pick<
    PipelineBootstrapExecutionComposer,
    'execute'
  >;

  public constructor(
    composer: Pick<
      PipelineBootstrapExecutionComposer,
      'execute'
    >,
  ) {
    this.composer = composer;
  }

  public async execute(
    input: InternalExecutionInput,
    signal?: AbortSignal,
  ): Promise<InternalExecutionResult> {
    if (!input.authoritativeContext) {
      throw new Error(
        'Authoritative execution context is required',
      );
    }

    const authority =
      createBootstrapBoundaryBridgeAuthorityV1(
        input.authoritativeContext,
      );

    const envelope =
      createBootstrapBoundaryBridgeEnvelopeV1(
        authority,
        input.payload,
        signal,
      );

    const bootstrapInput =
      mapBootstrapBoundaryEnvelopeToPipelineInputV1(
        envelope,
      );

    const result = await this.composer.execute(
      bootstrapInput,
      signal,
    );

    return mapComposerResult(
      result,
      input.sessionId,
    );
  }
}
