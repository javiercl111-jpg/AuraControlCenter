import type {
  BoundaryInvocationContextV1,
  GovernedExecutionRequest,
  GovernedExecutionResponse,
} from '../../os/boundary/types';

import type {
  GrowthGovernedExecutionInputV1,
  GrowthGovernedExecutionPortV1,
  GrowthGovernedExecutionResultV1,
} from './GrowthGovernedExecutionPortV1';

export interface GovernedBoundaryExecutorV1 {
  execute(
    request: GovernedExecutionRequest,
    invocationContext: BoundaryInvocationContextV1,
  ): Promise<GovernedExecutionResponse>;
}

export interface BoundaryInvocationContextProviderV1 {
  create(
    input: GrowthGovernedExecutionInputV1,
  ): BoundaryInvocationContextV1;
}

export class GrowthBoundaryExecutionAdapterV1
  implements GrowthGovernedExecutionPortV1
{
  private readonly boundary: GovernedBoundaryExecutorV1;

  private readonly invocationContext:
    BoundaryInvocationContextProviderV1;

  constructor(
    boundary: GovernedBoundaryExecutorV1,
    invocationContext: BoundaryInvocationContextProviderV1,
  ) {
    this.boundary = boundary;
    this.invocationContext = invocationContext;
  }

  async execute(
    input: GrowthGovernedExecutionInputV1,
  ): Promise<GrowthGovernedExecutionResultV1> {
    const request: GovernedExecutionRequest = {
      requestId: input.execution.requestId,
      correlationId: input.execution.correlationId,
      tenant: {
        tenantId: input.authority.tenantId,
      },
      actor: {
        actorId: input.authority.actor.actorId,
        actorType: input.authority.actor.actorType,
      },
      source: input.execution.source,
      requestedMode: input.execution.requestedMode,
      payload: {
        operation: input.semantic.operation,
        scenarioId: input.semantic.scenarioId,
        objectiveKey: input.semantic.objectiveKey,
        domains: [...input.semantic.domains],
        data: {
          ...input.semantic.payload,
        },
      },
    };

    const invocation =
      this.invocationContext.create(input);

    const response =
      await this.boundary.execute(
        request,
        invocation,
      );

    const warnings =
      response.warnings
        ? response.warnings.map(
            (warning) => warning.message,
          )
        : [];

    if (response.status === 'COMPLETED') {
      return {
        status: 'SUCCEEDED',
        requestId: input.execution.requestId,
        correlationId:
          input.execution.correlationId,
        mode: input.execution.requestedMode,
        warnings,
      };
    }

    const firstError =
      response.errors?.[0];

    return {
      status:
        response.status === 'REJECTED'
          ? 'REJECTED'
          : 'FAILED',
      requestId: input.execution.requestId,
      correlationId:
        input.execution.correlationId,
      mode: input.execution.requestedMode,
      warnings,
      ...(firstError
        ? {
            error: {
              code: firstError.code,
              message: firstError.message,
            },
          }
        : {}),
    };
  }
}

export default GrowthBoundaryExecutionAdapterV1;
