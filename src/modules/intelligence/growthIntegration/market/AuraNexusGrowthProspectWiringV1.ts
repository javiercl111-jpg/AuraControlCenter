import type {
  InegiCompany,
} from '../../../market-intelligence/types/inegi';

import type {
  GrowthGovernedExecutionResultV1,
} from '../governed/GrowthGovernedExecutionPortV1';

import type {
  GrowthCoreRemoteAdapterV1,
} from '../governed/GrowthCoreRemoteAdapterV1';

import type {
  GrowthPrioritizeOpportunitiesSemanticRequestV1,
} from '../GrowthCoreSemanticMapperV1';

import {
  projectInegiCompanyToGrowthProspectV1,
} from './GrowthProspectProjectionV1';

export interface AuraNexusGrowthProspectAuthorityV1 {
  readonly tenantId: string;
  readonly actorId: string;
}

export interface AuraNexusGrowthProspectRequestMetadataV1 {
  readonly requestId: string;
  readonly correlationId: string;
  readonly requestedAt: string;
}

export interface AuraNexusGrowthProspectSubmissionV1 {
  readonly company: InegiCompany;
  readonly authority:
    AuraNexusGrowthProspectAuthorityV1;
  readonly request:
    AuraNexusGrowthProspectRequestMetadataV1;
}

export interface AuraNexusGrowthProspectWiringDependenciesV1 {
  readonly growthCore: Pick<
    GrowthCoreRemoteAdapterV1,
    'prioritizeOpportunities'
  >;
}

export interface AuraNexusGrowthProspectWiringV1 {
  submitProspect(
    input: AuraNexusGrowthProspectSubmissionV1,
  ): Promise<GrowthGovernedExecutionResultV1>;
}

function requireValue(
  value: string,
  code: string,
): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(code);
  }

  return normalized;
}

/**
 * Aura Nexus internal commercial wiring.
 *
 * Authority boundaries:
 *
 * - DENUE/INEGI remains a Control Center source.
 * - Aura Growth does not depend directly on DENUE.
 * - Control Center opportunityScore is NOT reinterpreted
 *   as Growth marketPotential, strategicFit, expectedValue
 *   or executionReadiness.
 * - Until an explicit Intelligence assessment supplies
 *   Growth-native scores, those dimensions remain neutral.
 * - Execution is forced to SHADOW_ONLY.
 */
export function createAuraNexusGrowthProspectWiringV1(
  dependencies:
    AuraNexusGrowthProspectWiringDependenciesV1,
): AuraNexusGrowthProspectWiringV1 {
  return {
    async submitProspect(
      input,
    ): Promise<GrowthGovernedExecutionResultV1> {
      const tenantId =
        requireValue(
          input.authority.tenantId,
          'AURA_NEXUS_GROWTH_TENANT_REQUIRED',
        );

      const actorId =
        requireValue(
          input.authority.actorId,
          'AURA_NEXUS_GROWTH_ACTOR_REQUIRED',
        );

      const requestId =
        requireValue(
          input.request.requestId,
          'AURA_NEXUS_GROWTH_REQUEST_ID_REQUIRED',
        );

      const correlationId =
        requireValue(
          input.request.correlationId,
          'AURA_NEXUS_GROWTH_CORRELATION_ID_REQUIRED',
        );

      const requestedAt =
        requireValue(
          input.request.requestedAt,
          'AURA_NEXUS_GROWTH_REQUESTED_AT_REQUIRED',
        );

      const projection =
        projectInegiCompanyToGrowthProspectV1(
          input.company,
        );

      const companyName =
        projection.contact.companyName ||
        projection.contact.legalName ||
        projection.prospect.prospectId;

      const request:
        GrowthPrioritizeOpportunitiesSemanticRequestV1 = {
          context: {
            contractVersion: '1.0',
            requestId,
            correlationId,
            tenantId,
            actorId,
            requestedAt,
            mode: 'SHADOW',
          },

          objective:
            'Evaluate Aura Nexus commercial prospect without autonomous execution',

          opportunities: [
            {
              opportunityId:
                projection.prospect.prospectId,

              objective:
                `Evaluate commercial fit for ${companyName}`,

              /*
               * Fail-closed semantic bridge.
               *
               * These values are deliberately neutral.
               * Neither DENUE facts nor Control Center
               * opportunityScore are Growth-native scores.
               */
              signals: {
                marketPotential: 0,
                strategicFit: 0,
                expectedValue: 0,
                executionReadiness: 0,
              },
            },
          ],

          prioritization: {
            dimensions: [
              'marketPotential',
              'strategicFit',
              'expectedValue',
              'executionReadiness',
            ],
            excludedOpportunityIds: [],
          },

          constraints: [
            'No autonomous opportunity execution',
            'Human approval required',
            'DENUE source authority remains Control Center',
            'Control Center scores are not Growth intelligence scores',
          ],
        };

      return dependencies.growthCore
        .prioritizeOpportunities(
          request,
          {
            actorType: 'SERVICE',
            requestedMode: 'SHADOW_ONLY',
          },
        );
    },
  };
}

export default createAuraNexusGrowthProspectWiringV1;