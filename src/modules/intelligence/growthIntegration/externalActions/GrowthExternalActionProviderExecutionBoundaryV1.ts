import type {
  GrowthExternalActionRequestV1,
  GrowthExternalActionResultV1,
  GrowthExternalActionTargetV1,
} from './GrowthExternalActionContractV1';


export interface GrowthExternalActionProviderAdapterV1 {

  readonly target:
    GrowthExternalActionTargetV1;


  execute(
    request:
      GrowthExternalActionRequestV1,
  ): Promise<GrowthExternalActionResultV1>;

}


export interface GrowthExternalActionProviderExecutionBoundaryDependenciesV1 {

  readonly adapters:
    readonly GrowthExternalActionProviderAdapterV1[];

}


export class GrowthExternalActionProviderExecutionBoundaryV1 {

  private readonly adaptersByTarget:
    ReadonlyMap<
      GrowthExternalActionTargetV1,
      GrowthExternalActionProviderAdapterV1
    >;


  constructor(
    dependencies:
      GrowthExternalActionProviderExecutionBoundaryDependenciesV1,
  ) {

    this.adaptersByTarget =
      new Map(
        dependencies.adapters.map(
          (adapter) => [
            adapter.target,
            adapter,
          ],
        ),
      );

  }


  async execute(
    request:
      GrowthExternalActionRequestV1,
  ): Promise<GrowthExternalActionResultV1> {

    const adapter =
      this.adaptersByTarget.get(
        request.target,
      );


    if (!adapter) {

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
            'PROVIDER_ADAPTER_UNAVAILABLE',

          message:
            `No provider adapter is registered for target ${request.target}.`,

          retryable:
            false,
        },
      };

    }


    return adapter.execute(
      request,
    );

  }

}