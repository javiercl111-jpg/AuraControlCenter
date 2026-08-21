export interface GrowthStrategyRecommendationV1 {

  readonly strategyId: string;

  readonly summary: string;

  readonly recommendedApproach: string;

  readonly keyMessages: readonly string[];

  readonly recommendedChannels: readonly string[];

  readonly successMetrics: readonly string[];

}