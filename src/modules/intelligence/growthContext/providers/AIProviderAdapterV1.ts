import type {
  GrowthStrategyRecommendationV1,
} from '../strategy/GrowthStrategyRecommendationV1';



export interface AIProviderAdapterV1 {


  adapt(
    providerOutput: unknown,
  ):
    GrowthStrategyRecommendationV1;


}