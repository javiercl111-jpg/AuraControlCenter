import type {
  GrowthExternalActionRequestV1,
  GrowthExternalActionResultV1,
} from './GrowthExternalActionContractV1';

import type {
  GrowthExternalActionIdempotencyPortV1,
} from './GrowthExternalActionIdempotencyPortV1';


export interface GrowthExternalActionExecutorV1 {

  execute(
    request: GrowthExternalActionRequestV1,
  ): Promise<GrowthExternalActionResultV1>;

}


export interface GrowthExternalActionOrchestratorDependenciesV1 {

  readonly executor:
    GrowthExternalActionExecutorV1;

  readonly idempotency?:
    GrowthExternalActionIdempotencyPortV1;

}


export class GrowthExternalActionOrchestratorV1 {

  private readonly dependencies:
    GrowthExternalActionOrchestratorDependenciesV1;


  constructor(
    dependencies:
      GrowthExternalActionOrchestratorDependenciesV1,
  ) {

    this.dependencies =
      dependencies;

  }


  async execute(
    request:
      GrowthExternalActionRequestV1,
  ): Promise<GrowthExternalActionResultV1> {

    /*
     * Governance order is deliberate:
     *
     * 1. Authorization
     * 2. Execution-state validation
     * 3. Idempotency
     * 4. Executor
     *
     * Unauthorized or terminal actions must never claim
     * an idempotency key or reach an external executor.
     */

    if (
      request.authorization.required &&
      request.authorization.state !== 'AUTHORIZED'
    ) {

      return {
        actionId:
          request.actionId,

        requestId:
          request.correlation.requestId,

        correlationId:
          request.correlation.correlationId,

        state:
          'REJECTED',

        warnings: [],

        failure: {
          code:
            'AUTHORIZATION_REQUIRED',

          message:
            'External action requires valid authorization before execution.',

          retryable:
            false,
        },
      };

    }


    if (
      request.executionState === 'REJECTED' ||
      request.executionState === 'CANCELLED' ||
      request.executionState === 'FAILED' ||
      request.executionState === 'SUCCEEDED'
    ) {

      return {
        actionId:
          request.actionId,

        requestId:
          request.correlation.requestId,

        correlationId:
          request.correlation.correlationId,

        state:
          'REJECTED',

        warnings: [],

        failure: {
          code:
            'INVALID_EXECUTION_STATE',

          message:
            'External action cannot execute from its current state.',

          retryable:
            false,
        },
      };

    }


    const idempotency =
      this.dependencies.idempotency;


    /*
     * Compatibility mode:
     *
     * Existing callers that have not yet been migrated to the
     * idempotency port retain the previous governed behavior.
     *
     * Production external-provider compositions must inject an
     * idempotency implementation before provider execution is enabled.
     */
    if (!idempotency) {

      return this.dependencies.executor.execute(
        request,
      );

    }


    const claim =
      await idempotency.claim(
        request.idempotencyKey,
        request.actionId,
      );


    if (claim.state === 'ALREADY_CLAIMED') {

      const existing =
        await idempotency.get(
          request.idempotencyKey,
        );


      if (existing?.result) {

        return existing.result;

      }


      return {
        actionId:
          request.actionId,

        requestId:
          request.correlation.requestId,

        correlationId:
          request.correlation.correlationId,

        state:
          'REJECTED',

        warnings: [
          'An execution with the same idempotency key is already in progress.',
        ],

        failure: {
          code:
            'IDEMPOTENCY_IN_PROGRESS',

          message:
            'Duplicate external action execution was prevented because the idempotency key is already claimed.',

          retryable:
            true,
        },
      };

    }


    const result =
      await this.dependencies.executor.execute(
        request,
      );


    await idempotency.complete(
      request.idempotencyKey,
      request.actionId,
      result,
    );


    return result;

  }

}