export const GROWTH_GOVERNED_EXECUTION_MODES_V1 = Object.freeze([
  'SHADOW_ONLY',
  'EVALUATION',
] as const);

export type GrowthGovernedExecutionModeV1 =
  (typeof GROWTH_GOVERNED_EXECUTION_MODES_V1)[number];

export type GrowthGovernedActorTypeV1 =
  | 'USER'
  | 'SERVICE'
  | 'SYSTEM';

export interface GrowthGovernedAuthorityV1 {
  readonly tenantId: string;
  readonly actor: {
    readonly actorId: string;
    readonly actorType: GrowthGovernedActorTypeV1;
  };
}

export interface GrowthGovernedExecutionContextV1 {
  readonly requestId: string;
  readonly correlationId: string;
  readonly source: 'AURA_GROWTH';
  readonly requestedMode: GrowthGovernedExecutionModeV1;
}

export type GrowthGovernedOperationV1 =
  | 'ANALYZE_CAMPAIGN'
  | 'PRIORITIZE_OPPORTUNITIES'
  | 'RECOMMEND_ACTIONS'
  | 'ASSESS_GROWTH_CAPABILITY';

export type GrowthGovernedDomainV1 =
  | 'growth_strategy'
  | 'commercial_performance'
  | 'campaigns'
  | 'opportunities';

export interface GrowthGovernedSemanticProjectionV1 {
  readonly operation: GrowthGovernedOperationV1;
  readonly scenarioId: 'GROWTH_INTELLIGENCE';
  readonly objectiveKey: 'ASSESS_GROWTH_INTELLIGENCE';
  readonly domains: readonly GrowthGovernedDomainV1[];
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface GrowthGovernedExecutionInputV1 {
  readonly authority: GrowthGovernedAuthorityV1;
  readonly execution: GrowthGovernedExecutionContextV1;
  readonly semantic: GrowthGovernedSemanticProjectionV1;
}

export type GrowthGovernedExecutionStatusV1 =
  | 'SUCCEEDED'
  | 'REJECTED'
  | 'FAILED';

export interface GrowthGovernedExecutionErrorV1 {
  readonly code: string;
  readonly message: string;
}

export interface GrowthGovernedExecutionResultV1 {
  readonly status: GrowthGovernedExecutionStatusV1;
  readonly executionId?: string;
  readonly requestId: string;
  readonly correlationId: string;
  readonly mode: GrowthGovernedExecutionModeV1;
  readonly warnings: readonly string[];
  readonly error?: GrowthGovernedExecutionErrorV1;
}

export interface GrowthGovernedExecutionPortV1 {
  execute(
    input: GrowthGovernedExecutionInputV1,
  ): Promise<GrowthGovernedExecutionResultV1>;
}
