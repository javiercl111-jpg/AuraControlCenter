import {
  GovernedExecutionBoundary,
} from "@aura/intelligence-os/server";

import type {
  BoundaryClockPort,
  BoundaryExecutionPort,
  FeaturePolicyPort,
  TrustedServerRequestContextV1,
} from "@aura/intelligence-os/server";

import {
  TrustedDiscoveryBoundaryInvocationContextProviderV1,
} from "./TrustedDiscoveryBoundaryInvocationContextProviderV1";

export interface GovernedDiscoveryRuntimeCompositionDependenciesV1 {
  readonly trustedContext: TrustedServerRequestContextV1;
  readonly featurePolicyPort: FeaturePolicyPort;
  readonly executionPort: BoundaryExecutionPort;
  readonly clockPort: BoundaryClockPort;
}

export function createGovernedDiscoveryRuntimeCompositionV1(
  dependencies:
    GovernedDiscoveryRuntimeCompositionDependenciesV1,
) {
  const invocationContextProvider =
    new TrustedDiscoveryBoundaryInvocationContextProviderV1(
      dependencies.trustedContext,
    );

  const boundary =
    new GovernedExecutionBoundary({
      featurePolicyPort: dependencies.featurePolicyPort,
      executionPort: dependencies.executionPort,
      clockPort: dependencies.clockPort,
    });

  return {
    boundary,
    invocationContextProvider,
    dependencies: {
      featurePolicyPort: dependencies.featurePolicyPort,
      executionPort: dependencies.executionPort,
      clockPort: dependencies.clockPort,
    },
  };
}

export type GovernedDiscoveryRuntimeCompositionV1 =
  ReturnType<
    typeof createGovernedDiscoveryRuntimeCompositionV1
  >;