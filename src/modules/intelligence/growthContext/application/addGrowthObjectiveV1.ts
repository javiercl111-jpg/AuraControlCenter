import type {
  GrowthWorkspaceContextV1,
  GrowthObjectiveV1,
} from '../domain/GrowthWorkspaceContextV1';

import {
  validateGrowthWorkspaceContextV1,
} from '../domain/validation/validateGrowthWorkspaceContextV1';


export function addGrowthObjectiveV1(
  workspace: GrowthWorkspaceContextV1,
  objective: GrowthObjectiveV1,
): GrowthWorkspaceContextV1 {

  const updatedContext: GrowthWorkspaceContextV1 = {
    ...workspace,

    objectives: [
      ...workspace.objectives,
      objective,
    ],
  };


  validateGrowthWorkspaceContextV1(
    updatedContext,
  );


  return updatedContext;
}