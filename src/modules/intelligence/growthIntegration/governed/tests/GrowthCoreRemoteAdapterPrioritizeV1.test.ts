import { describe, expect, it, vi } from 'vitest';

import {
  GrowthCoreRemoteAdapterV1,
} from '../GrowthCoreRemoteAdapterV1';

import type {
  GrowthGovernedExecutionPortV1,
} from '../GrowthGovernedExecutionPortV1';

import type {
  GrowthPrioritizeOpportunitiesSemanticRequestV1,
} from '../../GrowthCoreSemanticMapperV1';

function createPrioritizeRequest():
  GrowthPrioritizeOpportunitiesSemanticRequestV1 {
  return {
    context: {
      contractVersion: '1.0',
      requestId: 'growth-prioritize-request-001',
      correlationId: 'growth-prioritize-correlation-001',
      tenantId: 'tenant-001',
      actorId: 'actor-001',
      requestedAt: '2026-08-21T18:00:00.000Z',
      mode: 'SHADOW',
    },
    objective:
      'Prioritize growth opportunities',

    opportunities: [
      {
        opportunityId: 'opportunity-001',
        objective: 'Evaluate prospect fit',
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
    constraints: [],
  };
}

describe(
  'GROWTH-PRODUCT-01 | prioritizeOpportunities remote adapter',
  () => {
    it(
      'maps prioritizeOpportunities through governed SHADOW_ONLY execution',
      async () => {
        const execute = vi.fn<
          GrowthGovernedExecutionPortV1['execute']
        >(
          async (input) => ({
            status: 'SUCCEEDED',
            executionId:
              'execution-prioritize-001',
            requestId:
              input.execution.requestId,
            correlationId:
              input.execution.correlationId,
            mode:
              input.execution.requestedMode,
            warnings: [],
          }),
        );

        const adapter =
          new GrowthCoreRemoteAdapterV1({
            execute,
          });

        const result =
          await adapter.prioritizeOpportunities(
            createPrioritizeRequest(),
            {
              actorType: 'SERVICE',
              requestedMode: 'SHADOW_ONLY',
            },
          );

        expect(result.status).toBe(
          'SUCCEEDED',
        );

        expect(result.mode).toBe(
          'SHADOW_ONLY',
        );

        expect(execute).toHaveBeenCalledTimes(1);

        const [input] =
          execute.mock.calls[0];

        expect(input.authority).toEqual({
          tenantId: 'tenant-001',
          actor: {
            actorId: 'actor-001',
            actorType: 'SERVICE',
          },
        });

        expect(input.execution).toEqual({
          requestId:
            'growth-prioritize-request-001',
          correlationId:
            'growth-prioritize-correlation-001',
          source: 'AURA_GROWTH',
          requestedMode: 'SHADOW_ONLY',
        });

        expect(input.semantic.operation).toBe(
          'PRIORITIZE_OPPORTUNITIES',
        );

        expect(input.semantic.scenarioId).toBe(
          'GROWTH_INTELLIGENCE',
        );

        expect(input.semantic.objectiveKey).toBe(
          'ASSESS_GROWTH_INTELLIGENCE',
        );

        const serialized =
          JSON.stringify(input.semantic);

        expect(serialized).not.toContain(
          'tenant-001',
        );

        expect(serialized).not.toContain(
          'actor-001',
        );

        expect(serialized).not.toContain(
          'SHADOW_ONLY',
        );
      },
    );
  },
);