export type GrowthIntelligenceModeV1 =
  | 'DETERMINISTIC'
  | 'SHADOW'
  | 'ADVISORY'
  | 'AUTHORITATIVE';

export type GrowthEvidenceSourceTypeV1 =
  | 'CAMPAIGN'
  | 'CONTENT'
  | 'OPPORTUNITY'
  | 'PROSPECT'
  | 'METRIC'
  | 'USER_INPUT'
  | 'SYSTEM_OBSERVATION';

export interface GrowthSemanticExecutionContextV1 {
  readonly contractVersion: '1.0';
  readonly requestId: string;
  readonly correlationId: string;
  readonly tenantId: string;
  readonly actorId: string;
  readonly requestedAt: string;
  readonly mode: GrowthIntelligenceModeV1;
}

export interface GrowthSemanticEvidenceReferenceV1 {
  readonly evidenceId: string;
  readonly sourceType: GrowthEvidenceSourceTypeV1;
  readonly summary: string;
  readonly confidence: number;
}

export interface GrowthAnalyzeCampaignSemanticRequestV1 {
  readonly context: GrowthSemanticExecutionContextV1;
  readonly campaign: {
    readonly campaignId: string;
    readonly objective: string;
    readonly audienceSummary: string;
    readonly valueProposition: string;
    readonly channels: readonly string[];
    readonly keyMessages: readonly string[];
    readonly expectedKpis: readonly {
      readonly metric: string;
      readonly target?: number;
      readonly unit?: string;
    }[];
  };
  readonly evidence: readonly GrowthSemanticEvidenceReferenceV1[];
  readonly constraints: readonly string[];
}

export interface GrowthOpportunitySignalsV1 {
  readonly marketPotential: number;
  readonly strategicFit: number;
  readonly expectedValue: number;
  readonly executionReadiness: number;
}

export interface GrowthSemanticOpportunityV1 {
  readonly opportunityId: string;
  readonly objective: string;
  readonly signals: GrowthOpportunitySignalsV1;
}

export interface GrowthOpportunityPrioritizationV1 {
  readonly dimensions: readonly string[];
  readonly excludedOpportunityIds: readonly string[];
}

export interface GrowthPrioritizeOpportunitiesSemanticRequestV1 {
  readonly context: GrowthSemanticExecutionContextV1;
  readonly objective: string;
  readonly opportunities: readonly GrowthSemanticOpportunityV1[];
  readonly prioritization: GrowthOpportunityPrioritizationV1;
  readonly constraints: readonly string[];
}

export interface GrowthPrioritizeOpportunitiesSemanticPayloadV1 {
  readonly objective: string;
  readonly opportunities: readonly GrowthSemanticOpportunityV1[];
  readonly prioritization: GrowthOpportunityPrioritizationV1;
  readonly constraints: readonly string[];
}

export interface GrowthPrioritizeOpportunitiesSemanticProjectionV1 {
  readonly operation: 'PRIORITIZE_OPPORTUNITIES';
  readonly scenarioId: 'GROWTH_INTELLIGENCE';
  readonly objectiveKey: 'ASSESS_GROWTH_INTELLIGENCE';
  readonly domains: readonly [
    'opportunities',
    'commercial_performance',
  ];
  readonly requestId: string;
  readonly correlationId: string;
  readonly payload: GrowthPrioritizeOpportunitiesSemanticPayloadV1;
}
export type GrowthRecommendationSubjectTypeV1 =
  | 'CAMPAIGN'
  | 'OPPORTUNITY'
  | 'GROWTH_OBJECTIVE'
  | 'CAPABILITY';

export interface GrowthRecommendationSubjectV1 {
  readonly subjectType: GrowthRecommendationSubjectTypeV1;
  readonly subjectId: string;
  readonly state: string;
  readonly summary: string;
}

export interface GrowthRecommendActionsSemanticRequestV1 {
  readonly context: GrowthSemanticExecutionContextV1;
  readonly subject: GrowthRecommendationSubjectV1;
  readonly allowedActions: readonly string[];
  readonly prohibitedActions: readonly string[];
  readonly evidence: readonly GrowthSemanticEvidenceReferenceV1[];
  readonly constraints: readonly string[];
}

export interface GrowthRecommendActionsSemanticPayloadV1 {
  readonly subject: GrowthRecommendationSubjectV1;
  readonly allowedActions: readonly string[];
  readonly prohibitedActions: readonly string[];
  readonly evidence: readonly GrowthSemanticEvidenceReferenceV1[];
  readonly constraints: readonly string[];
}

export interface GrowthRecommendActionsSemanticProjectionV1 {
  readonly operation: 'RECOMMEND_ACTIONS';
  readonly scenarioId: 'GROWTH_INTELLIGENCE';
  readonly objectiveKey: 'ASSESS_GROWTH_INTELLIGENCE';
  readonly domains: readonly [
    'campaigns',
    'growth_strategy',
  ];
  readonly requestId: string;
  readonly correlationId: string;
  readonly payload: GrowthRecommendActionsSemanticPayloadV1;
}
export interface GrowthSemanticCapabilityV1 {
  readonly capabilityId: string;
  readonly name: string;
  readonly currentState: string;
  readonly evidenceIds: readonly string[];
}

export interface GrowthAssessCapabilitySemanticRequestV1 {
  readonly context: GrowthSemanticExecutionContextV1;
  readonly objective: string;
  readonly capabilities: readonly GrowthSemanticCapabilityV1[];
  readonly evidence: readonly GrowthSemanticEvidenceReferenceV1[];
  readonly constraints: readonly string[];
}

export interface GrowthAssessCapabilitySemanticPayloadV1 {
  readonly objective: string;
  readonly capabilities: readonly GrowthSemanticCapabilityV1[];
  readonly evidence: readonly GrowthSemanticEvidenceReferenceV1[];
  readonly constraints: readonly string[];
}

export interface GrowthAssessCapabilitySemanticProjectionV1 {
  readonly operation: 'ASSESS_GROWTH_CAPABILITY';
  readonly scenarioId: 'GROWTH_INTELLIGENCE';
  readonly objectiveKey: 'ASSESS_GROWTH_INTELLIGENCE';
  readonly domains: readonly [
    'growth_strategy',
    'commercial_performance',
    'campaigns',
    'opportunities',
  ];
  readonly requestId: string;
  readonly correlationId: string;
  readonly payload: GrowthAssessCapabilitySemanticPayloadV1;
}
export interface GrowthAnalyzeCampaignSemanticPayloadV1 {
  readonly campaign: {
    readonly campaignId: string;
    readonly objective: string;
    readonly audienceSummary: string;
    readonly valueProposition: string;
    readonly channels: readonly string[];
    readonly keyMessages: readonly string[];
    readonly expectedKpis: readonly {
      readonly metric: string;
      readonly target?: number;
      readonly unit?: string;
    }[];
  };
  readonly evidence: readonly GrowthSemanticEvidenceReferenceV1[];
  readonly constraints: readonly string[];
}

export interface GrowthAnalyzeCampaignSemanticProjectionV1 {
  readonly operation: 'ANALYZE_CAMPAIGN';
  readonly scenarioId: 'GROWTH_INTELLIGENCE';
  readonly objectiveKey: 'ASSESS_GROWTH_INTELLIGENCE';
  readonly domains: readonly [
    'campaigns',
    'growth_strategy',
  ];
  readonly requestId: string;
  readonly correlationId: string;
  readonly payload: GrowthAnalyzeCampaignSemanticPayloadV1;
}

function copyOptionalNumber(
  value: number | undefined,
): number | undefined {
  return value === undefined ? undefined : value;
}

function copyOptionalString(
  value: string | undefined,
): string | undefined {
  return value === undefined ? undefined : value;
}

export class GrowthCoreSemanticMapperV1 {
  static mapAnalyzeCampaign(
    request: GrowthAnalyzeCampaignSemanticRequestV1,
  ): GrowthAnalyzeCampaignSemanticProjectionV1 {
    return {
      operation: 'ANALYZE_CAMPAIGN',
      scenarioId: 'GROWTH_INTELLIGENCE',
      objectiveKey: 'ASSESS_GROWTH_INTELLIGENCE',
      domains: [
        'campaigns',
        'growth_strategy',
      ],
      requestId: request.context.requestId,
      correlationId: request.context.correlationId,
      payload: {
        campaign: {
          campaignId: request.campaign.campaignId,
          objective: request.campaign.objective,
          audienceSummary: request.campaign.audienceSummary,
          valueProposition: request.campaign.valueProposition,
          channels: [...request.campaign.channels],
          keyMessages: [...request.campaign.keyMessages],
          expectedKpis: request.campaign.expectedKpis.map(
            (kpi) => ({
              metric: kpi.metric,
              target: copyOptionalNumber(kpi.target),
              unit: copyOptionalString(kpi.unit),
            }),
          ),
        },
        evidence: request.evidence.map((item) => ({
          evidenceId: item.evidenceId,
          sourceType: item.sourceType,
          summary: item.summary,
          confidence: item.confidence,
        })),
        constraints: [...request.constraints],
      },
    };
  }

  static mapPrioritizeOpportunities(
    request: GrowthPrioritizeOpportunitiesSemanticRequestV1,
  ): GrowthPrioritizeOpportunitiesSemanticProjectionV1 {
    return {
      operation: 'PRIORITIZE_OPPORTUNITIES',
      scenarioId: 'GROWTH_INTELLIGENCE',
      objectiveKey: 'ASSESS_GROWTH_INTELLIGENCE',
      domains: [
        'opportunities',
        'commercial_performance',
      ],
      requestId: request.context.requestId,
      correlationId: request.context.correlationId,
      payload: {
        objective: request.objective,
        opportunities: request.opportunities.map(
          (opportunity) => ({
            opportunityId: opportunity.opportunityId,
            objective: opportunity.objective,
            signals: {
              marketPotential:
                opportunity.signals.marketPotential,
              strategicFit:
                opportunity.signals.strategicFit,
              expectedValue:
                opportunity.signals.expectedValue,
              executionReadiness:
                opportunity.signals.executionReadiness,
            },
          }),
        ),
        prioritization: {
          dimensions: [
            ...request.prioritization.dimensions,
          ],
          excludedOpportunityIds: [
            ...request.prioritization.excludedOpportunityIds,
          ],
        },
        constraints: [...request.constraints],
      },
    };
  }

  static mapRecommendActions(
    request: GrowthRecommendActionsSemanticRequestV1,
  ): GrowthRecommendActionsSemanticProjectionV1 {
    return {
      operation: 'RECOMMEND_ACTIONS',
      scenarioId: 'GROWTH_INTELLIGENCE',
      objectiveKey: 'ASSESS_GROWTH_INTELLIGENCE',
      domains: [
        'campaigns',
        'growth_strategy',
      ],
      requestId: request.context.requestId,
      correlationId: request.context.correlationId,
      payload: {
        subject: {
          subjectType: request.subject.subjectType,
          subjectId: request.subject.subjectId,
          state: request.subject.state,
          summary: request.subject.summary,
        },
        allowedActions: [...request.allowedActions],
        prohibitedActions: [...request.prohibitedActions],
        evidence: request.evidence.map((item) => ({
          evidenceId: item.evidenceId,
          sourceType: item.sourceType,
          summary: item.summary,
          confidence: item.confidence,
        })),
        constraints: [...request.constraints],
      },
    };
  }

  static mapAssessGrowthCapability(
    request: GrowthAssessCapabilitySemanticRequestV1,
  ): GrowthAssessCapabilitySemanticProjectionV1 {
    return {
      operation: 'ASSESS_GROWTH_CAPABILITY',
      scenarioId: 'GROWTH_INTELLIGENCE',
      objectiveKey: 'ASSESS_GROWTH_INTELLIGENCE',
      domains: [
        'growth_strategy',
        'commercial_performance',
        'campaigns',
        'opportunities',
      ],
      requestId: request.context.requestId,
      correlationId: request.context.correlationId,
      payload: {
        objective: request.objective,
        capabilities: request.capabilities.map(
          (capability) => ({
            capabilityId: capability.capabilityId,
            name: capability.name,
            currentState: capability.currentState,
            evidenceIds: [...capability.evidenceIds],
          }),
        ),
        evidence: request.evidence.map((item) => ({
          evidenceId: item.evidenceId,
          sourceType: item.sourceType,
          summary: item.summary,
          confidence: item.confidence,
        })),
        constraints: [...request.constraints],
      },
    };
  }
}

export default GrowthCoreSemanticMapperV1;
