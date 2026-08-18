import { GovernedExecutionBoundary } from '../../os/boundary/GovernedExecutionBoundary';

import type {
  BoundaryClockPort,
  BoundaryExecutionPort,
  FeaturePolicyPort,
} from '../../os/boundary/ports';

import type {
  TrustedServerRequestContextV1,
} from '../../serverComposition/types';

import {
  createGovernedGrowthCoreCompositionV1,
} from '../governed/createGovernedGrowthCoreCompositionV1';

import {
  TrustedGrowthBoundaryInvocationContextProviderV1,
} from './TrustedGrowthBoundaryInvocationContextProviderV1';

export interface GovernedGrowthRuntimeCompositionDependenciesV1 {
  readonly trustedContext: TrustedServerRequestContextV1;
  readonly featurePolicyPort: FeaturePolicyPort;
  readonly executionPort: BoundaryExecutionPort;
  readonly clockPort: BoundaryClockPort;
}

export function createGovernedGrowthRuntimeCompositionV1(
  dependencies: GovernedGrowthRuntimeCompositionDependenciesV1,
) {
  const invocationContextProvider =
    new TrustedGrowthBoundaryInvocationContextProviderV1(
      dependencies.trustedContext,
    );

  const boundary =
    new GovernedExecutionBoundary({
      featurePolicyPort: dependencies.featurePolicyPort,
      executionPort: dependencies.executionPort,
      clockPort: dependencies.clockPort,
    });

  const growthComposition =
    createGovernedGrowthCoreCompositionV1({
      boundary,
      invocationContext: invocationContextProvider,
    });

  return {
    growthCore: growthComposition,
    boundary,
    invocationContextProvider,
    dependencies: {
      featurePolicyPort: dependencies.featurePolicyPort,
      executionPort: dependencies.executionPort,
      clockPort: dependencies.clockPort,
    },
  };
}
