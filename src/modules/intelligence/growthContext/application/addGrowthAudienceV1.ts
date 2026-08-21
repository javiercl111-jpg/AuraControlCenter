import type {
  GrowthWorkspaceContextV1,
  GrowthAudienceV1,
} from '../domain/GrowthWorkspaceContextV1';

import {
  validateGrowthWorkspaceContextV1,
} from '../domain/validation/validateGrowthWorkspaceContextV1';


export function addGrowthAudienceV1(
  workspace: GrowthWorkspaceContextV1,
  audience: GrowthAudienceV1,
): GrowthWorkspaceContextV1 {

  const updatedContext: GrowthWorkspaceContextV1 = {
    ...workspace,

    audiences: [
      ...workspace.audiences,
      audience,
    ],
  };


  validateGrowthWorkspaceContextV1(
    updatedContext,
  );


  return updatedContext;
}