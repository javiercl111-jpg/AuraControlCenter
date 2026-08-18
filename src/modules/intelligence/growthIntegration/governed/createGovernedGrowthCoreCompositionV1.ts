import {
  GrowthBoundaryExecutionAdapterV1,
  type BoundaryInvocationContextProviderV1,
  type GovernedBoundaryExecutorV1,
} from './GrowthBoundaryExecutionAdapterV1';

import {
  GrowthCoreRemoteAdapterV1,
} from './GrowthCoreRemoteAdapterV1';

export interface GovernedGrowthCoreCompositionDependenciesV1 {
  readonly boundary: GovernedBoundaryExecutorV1;
  readonly invocationContext:
    BoundaryInvocationContextProviderV1;
}

export function createGovernedGrowthCoreCompositionV1(
  dependencies:
    GovernedGrowthCoreCompositionDependenciesV1,
): GrowthCoreRemoteAdapterV1 {
  const governedExecution =
    new GrowthBoundaryExecutionAdapterV1(
      dependencies.boundary,
      dependencies.invocationContext,
    );

  return new GrowthCoreRemoteAdapterV1(
    governedExecution,
  );
}

export default createGovernedGrowthCoreCompositionV1;
