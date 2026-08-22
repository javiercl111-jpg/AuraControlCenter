import type {
  GrowthIntelligenceContextRequestV1,
} from '../intelligence/GrowthIntelligenceContextRequestV1';


import type {
  GrowthStrategyRecommendationV1,
} from '../strategy/GrowthStrategyRecommendationV1';



export interface AuraAIProviderPortV1 {


  reason(
    context:
      GrowthIntelligenceContextRequestV1,
  ):
    Promise<GrowthStrategyRecommendationV1>;


}