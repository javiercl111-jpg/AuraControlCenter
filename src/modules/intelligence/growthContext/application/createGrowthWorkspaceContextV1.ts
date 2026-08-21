import type {
  GrowthWorkspaceContextV1,
} from '../domain/GrowthWorkspaceContextV1';

import {
  validateGrowthWorkspaceContextV1,
} from '../domain/validation/validateGrowthWorkspaceContextV1';


export function createGrowthWorkspaceContextV1(
  context: GrowthWorkspaceContextV1,
): GrowthWorkspaceContextV1 {

  validateGrowthWorkspaceContextV1(
    context,
  );

  return context;
}