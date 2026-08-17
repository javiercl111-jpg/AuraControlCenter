import { describe, expect, it } from 'vitest';

import {
  GrowthCoreSemanticMapperV1,
  type GrowthPrioritizeOpportunitiesSemanticRequestV1,
} from '../GrowthCoreSemanticMapperV1';

function createRequest(): GrowthPrioritizeOpportunitiesSemanticRequestV1 {
  return {
    context: {
      contractVersion: '1.0',
      requestId: 'growth-opportunity-request-001',
      correlationId: 'growth-opportunity-correlation-001',
      tenantId: 'tenant-authority-001',
      actorId: 'actor-authority-001',
      requestedAt: '2026-08-17T20:00:00.000Z',
      mode: 'SHADOW',
    },
    objective: 'Prioritize enterprise growth opportunities',
    opportunities: [
      {
        opportunityId: 'opp-001',
        objective: 'Expand enterprise maintenance offering',
        signals: {
          marketPotential: 0.91,
          strategicFit: 0.88,
          expectedValue: 0.84,
          executionReadiness: 0.72,
        },
      },
      {
        opportunityId: 'opp-002',
        objective: 'Increase HCM cross-sell adoption',
        signals: {
          marketPotential: 0.76,
          strategicFit: 0.93,
          expectedValue: 0.81,
          executionReadiness: 0.86,
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
      excludedOpportunityIds: ['opp-excluded'],
    },
    constraints: [
      'No autonomous opportunity execution',
      'Human approval required',
    ],
  };
}

describe(
  'INTEL-GROWTH-01 — Growth opportunity semantic mapping',
  () => {
    it('maps prioritization to the canonical Growth scenario', () => {
      const mapped =
        GrowthCoreSemanticMapperV1.mapPrioritizeOpportunities(
          createRequest(),
        );

      expect(mapped.operation).toBe(
        'PRIORITIZE_OPPORTUNITIES',
      );
      expect(mapped.scenarioId).toBe(
        'GROWTH_INTELLIGENCE',
      );
      expect(mapped.objectiveKey).toBe(
        'ASSESS_GROWTH_INTELLIGENCE',
      );
    });

    it('selects only opportunities and commercial performance domains', () => {
      const mapped =
        GrowthCoreSemanticMapperV1.mapPrioritizeOpportunities(
          createRequest(),
        );

      expect(mapped.domains).toEqual([
        'opportunities',
        'commercial_performance',
      ]);
    });

    it('projects only opportunity business semantics', () => {
      const request = createRequest();

      const mapped =
        GrowthCoreSemanticMapperV1.mapPrioritizeOpportunities(
          request,
        );

      expect(mapped.payload).toEqual({
        objective:
          'Prioritize enterprise growth opportunities',
        opportunities: request.opportunities,
        prioritization: request.prioritization,
        constraints: request.constraints,
      });
    });

    it('does not propagate execution authority into payload', () => {
      const mapped =
        GrowthCoreSemanticMapperV1.mapPrioritizeOpportunities(
          createRequest(),
        );

      const serialized = JSON.stringify(mapped.payload);

      expect(serialized).not.toContain('tenant-authority-001');
      expect(serialized).not.toContain('actor-authority-001');
      expect(serialized).not.toContain('SHADOW');

      expect(mapped.payload).not.toHaveProperty('tenantId');
      expect(mapped.payload).not.toHaveProperty('actorId');
      expect(mapped.payload).not.toHaveProperty('mode');
      expect(mapped.payload).not.toHaveProperty('authority');
      expect(mapped.payload).not.toHaveProperty('role');
      expect(mapped.payload).not.toHaveProperty('permission');
    });

    it('preserves request correlation outside payload', () => {
      const mapped =
        GrowthCoreSemanticMapperV1.mapPrioritizeOpportunities(
          createRequest(),
        );

      expect(mapped.requestId).toBe(
        'growth-opportunity-request-001',
      );
      expect(mapped.correlationId).toBe(
        'growth-opportunity-correlation-001',
      );

      expect(mapped.payload).not.toHaveProperty('requestId');
      expect(mapped.payload).not.toHaveProperty(
        'correlationId',
      );
    });

    it('creates a detached opportunity projection', () => {
      const request = createRequest();

      const mapped =
        GrowthCoreSemanticMapperV1.mapPrioritizeOpportunities(
          request,
        );

      expect(mapped.payload.opportunities).not.toBe(
        request.opportunities,
      );

      expect(mapped.payload.opportunities[0]).not.toBe(
        request.opportunities[0],
      );

      expect(mapped.payload.prioritization).not.toBe(
        request.prioritization,
      );

      expect(mapped.payload.constraints).not.toBe(
        request.constraints,
      );
    });
  },
);
