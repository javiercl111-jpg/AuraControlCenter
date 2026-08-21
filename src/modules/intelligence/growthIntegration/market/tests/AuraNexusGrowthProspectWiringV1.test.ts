import { describe, expect, it, vi } from 'vitest';

import type { InegiCompany } from '../../../../market-intelligence/types/inegi';

import {
  GrowthCoreRemoteAdapterV1,
} from '../../governed/GrowthCoreRemoteAdapterV1';

import type {
  GrowthGovernedExecutionPortV1,
} from '../../governed/GrowthGovernedExecutionPortV1';

import {
  createAuraNexusGrowthProspectWiringV1,
} from '../AuraNexusGrowthProspectWiringV1';

function createCompany(): InegiCompany {
  return {
    id: 'inegi-prospect-001',
    razonSocial: 'EMPRESA INDUSTRIAL SA DE CV',
    nombreComercial: 'Empresa Industrial',
    sector: 'Manufactura',
    tamano: 'Mediana',
    rangoPersonal: '31 a 50 personas',
    telefono: '8112345678',
    email: 'contacto@empresa.mx',
    sitioWeb: 'https://empresa.mx',
    direccion: 'Monterrey',
    municipio: 'Monterrey',
    estado: 'Nuevo LeÃƒÂ³n',
    cp: '64000',
    scian: '332000',
    actividad: 'Manufactura',
    latitud: 25.6866,
    longitud: -100.3161,
    altaDenue: '2024-01',
    sourceScore: 20,
    opportunityScore: 82,
    scoreBreakdown: {
      total: 82,
      sourceScore: 20,
      companySizeScore: 17,
      sectorScore: 18,
      reachabilityScore: 27,
    },
    recommendedSuites: [],
    status: 'QUALIFIED',
    priorityLevel: 'HIGH',
    motives: ['Afinidad comercial'],
    nextAction: 'Contactar',
    createdAt: null,
    updatedAt: null,
  };
}

describe(
  'GROWTH-PRODUCT-01 | Aura Nexus Growth prospect wiring',
  () => {
    it(
      'projects a Control Center prospect into governed Growth SHADOW_ONLY execution without fabricating opportunity scores',
      async () => {
        const execute = vi.fn<
          GrowthGovernedExecutionPortV1['execute']
        >(
          async (input) => ({
            status: 'SUCCEEDED',
            executionId: 'growth-shadow-001',
            requestId: input.execution.requestId,
            correlationId:
              input.execution.correlationId,
            mode: input.execution.requestedMode,
            warnings: [],
          }),
        );

        const growthCore =
          new GrowthCoreRemoteAdapterV1({
            execute,
          });

        const wiring =
          createAuraNexusGrowthProspectWiringV1({
            growthCore,
          });

        const result =
          await wiring.submitProspect({
            company: createCompany(),
            authority: {
              tenantId: 'aura-nexus',
              actorId: 'commercial-intelligence',
            },
            request: {
              requestId: 'prospect-request-001',
              correlationId:
                'prospect-correlation-001',
              requestedAt:
                '2026-08-21T18:00:00.000Z',
            },
          });

        expect(result.status).toBe(
          'SUCCEEDED',
        );

        expect(execute).toHaveBeenCalledTimes(1);

        const [input] =
          execute.mock.calls[0];

        expect(input.execution).toEqual({
          requestId: 'prospect-request-001',
          correlationId:
            'prospect-correlation-001',
          source: 'AURA_GROWTH',
          requestedMode: 'SHADOW_ONLY',
        });

        expect(input.authority).toEqual({
          tenantId: 'aura-nexus',
          actor: {
            actorId:
              'commercial-intelligence',
            actorType: 'SERVICE',
          },
        });

        expect(input.semantic.operation).toBe(
          'PRIORITIZE_OPPORTUNITIES',
        );

        const payload =
          input.semantic.payload as {
            opportunities: Array<{
              opportunityId: string;
              objective: string;
              signals: {
                marketPotential: number;
                strategicFit: number;
                expectedValue: number;
                executionReadiness: number;
              };
            }>;
          };

        expect(payload.opportunities).toHaveLength(1);

        const opportunity =
          payload.opportunities[0];

        expect(opportunity.opportunityId).toBe(
          'inegi-prospect-001',
        );

        /*
         * Fail-closed:
         * DENUE / Control Center scores are NOT silently
         * reinterpreted as Growth intelligence scores.
         */
        expect(opportunity.signals).toEqual({
          marketPotential: 0,
          strategicFit: 0,
          expectedValue: 0,
          executionReadiness: 0,
        });

        const serialized =
          JSON.stringify(input.semantic);

        expect(serialized).not.toContain(
          '"marketPotential":82',
        );

        expect(serialized).not.toContain(
          '"strategicFit":82',
        );

        expect(serialized).not.toContain(
          '"expectedValue":82',
        );

        expect(serialized).not.toContain(
          'aura-nexus',
        );

        expect(serialized).not.toContain(
          'commercial-intelligence',
        );

        expect(serialized).not.toContain(
          'SHADOW_ONLY',
        );
      },
    );
  },
);