import type {
  GrowthWorkspaceContextV1,
} from '../domain/GrowthWorkspaceContextV1';

import type {
  GrowthIntelligenceContextRequestV1,
} from './GrowthIntelligenceContextRequestV1';





export class GrowthIntelligenceContextMapperV1 {


  static map(
    context: GrowthWorkspaceContextV1,
  ): GrowthIntelligenceContextRequestV1 {


    const offer =
      context.offers[0];


    const audience =
      context.audiences[0];


    const objective =
      context.objectives[0];


    return {

      workspaceId:
        context.workspaceId,


      subject:
        context.ownerRef.displayName,


      offerSummary:
        offer?.name ?? null,


      audienceSummary:
        audience?.description ?? null,


      growthObjective:
        objective?.type ?? null,

    };

  }

}