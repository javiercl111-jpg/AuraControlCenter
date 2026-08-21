import {
  GrowthCoreSemanticMapperV1,
  type GrowthAnalyzeCampaignSemanticRequestV1,
  type GrowthPrioritizeOpportunitiesSemanticRequestV1,
} from '../GrowthCoreSemanticMapperV1';

import type {
  GrowthGovernedActorTypeV1,
  GrowthGovernedExecutionModeV1,
  GrowthGovernedExecutionPortV1,
  GrowthGovernedExecutionResultV1,
  GrowthGovernedSemanticProjectionV1,
} from './GrowthGovernedExecutionPortV1';

export interface GrowthCoreRemoteExecutionOptionsV1 {
  readonly actorType: GrowthGovernedActorTypeV1;
  readonly requestedMode: GrowthGovernedExecutionModeV1;
}

export class GrowthCoreRemoteAdapterV1 {
  private readonly governedExecution:
    GrowthGovernedExecutionPortV1;

  constructor(
    governedExecution: GrowthGovernedExecutionPortV1,
  ) {
    this.governedExecution = governedExecution;
  }

  async analyzeCampaign(
    request: GrowthAnalyzeCampaignSemanticRequestV1,
    options: GrowthCoreRemoteExecutionOptionsV1,
  ): Promise<GrowthGovernedExecutionResultV1> {
    const mapped =
      GrowthCoreSemanticMapperV1.mapAnalyzeCampaign(request);

    const semantic: GrowthGovernedSemanticProjectionV1 = {
      operation: mapped.operation,
      scenarioId: mapped.scenarioId,
      objectiveKey: mapped.objectiveKey,
      domains: [...mapped.domains],
      payload: {
        campaign: {
          campaignId: mapped.payload.campaign.campaignId,
          objective: mapped.payload.campaign.objective,
          audienceSummary:
            mapped.payload.campaign.audienceSummary,
          valueProposition:
            mapped.payload.campaign.valueProposition,
          channels: [...mapped.payload.campaign.channels],
          keyMessages: [
            ...mapped.payload.campaign.keyMessages,
          ],
          expectedKpis:
            mapped.payload.campaign.expectedKpis.map(
              (kpi) => ({ ...kpi }),
            ),
        },
        evidence: mapped.payload.evidence.map(
          (item) => ({ ...item }),
        ),
        constraints: [...mapped.payload.constraints],
      },
    };

    return this.governedExecution.execute({
      authority: {
        tenantId: request.context.tenantId,
        actor: {
          actorId: request.context.actorId,
          actorType: options.actorType,
        },
      },
      execution: {
        requestId: mapped.requestId,
        correlationId: mapped.correlationId,
        source: 'AURA_GROWTH',
        requestedMode: options.requestedMode,
      },
      semantic,
    });
  }

  async prioritizeOpportunities(
    request: GrowthPrioritizeOpportunitiesSemanticRequestV1,
    options: GrowthCoreRemoteExecutionOptionsV1,
  ): Promise<GrowthGovernedExecutionResultV1> {
    const mapped =
      GrowthCoreSemanticMapperV1.mapPrioritizeOpportunities(
        request,
      );

    const semantic: GrowthGovernedSemanticProjectionV1 = {
      operation: mapped.operation,
      scenarioId: mapped.scenarioId,
      objectiveKey: mapped.objectiveKey,
      domains: [...mapped.domains],
      payload: {
        opportunities:
          mapped.payload.opportunities.map(
            (opportunity) => ({
              ...opportunity,
            }),
          ),
        constraints: [
          ...mapped.payload.constraints,
        ],
      },
    };

    return this.governedExecution.execute({
      authority: {
        tenantId: request.context.tenantId,
        actor: {
          actorId: request.context.actorId,
          actorType: options.actorType,
        },
      },
      execution: {
        requestId: mapped.requestId,
        correlationId: mapped.correlationId,
        source: 'AURA_GROWTH',
        requestedMode: options.requestedMode,
      },
      semantic,
    });
  }
}

export default GrowthCoreRemoteAdapterV1;
