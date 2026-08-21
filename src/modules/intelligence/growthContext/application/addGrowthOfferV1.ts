import type {
  GrowthWorkspaceContextV1,
  GrowthOfferV1,
} from '../domain/GrowthWorkspaceContextV1';

import {
  validateGrowthWorkspaceContextV1,
} from '../domain/validation/validateGrowthWorkspaceContextV1';


export function addGrowthOfferV1(
  workspace: GrowthWorkspaceContextV1,
  offer: GrowthOfferV1,
): GrowthWorkspaceContextV1 {

  const updatedContext: GrowthWorkspaceContextV1 = {
    ...workspace,

    offers: [
      ...workspace.offers,
      offer,
    ],
  };


  validateGrowthWorkspaceContextV1(
    updatedContext,
  );


  return updatedContext;
}