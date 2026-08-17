import { describe, expect, it } from 'vitest';

import {
  GrowthCoreSemanticMapperV1,
  type GrowthAssessCapabilitySemanticRequestV1,
} from '../GrowthCoreSemanticMapperV1';

function createRequest(): GrowthAssessCapabilitySemanticRequestV1 {
  return {
    context: {
      contractVersion: '1.0',
      requestId: 'growth-capability-request-001',
      correlationId: 'growth-capability-correlation-001',
      tenantId: 'tenant-capability-authority',
      actorId: 'actor-capability-authority',
      requestedAt: '2026-08-17T22:00:00.000Z',
      mode: 'SHADOW',
    },
    objective:
      'Assess enterprise capability to sustain profitable growth',
    capabilities: [
      {
        capabilityId: 'cap-strategy',
        name: 'Growth Strategy',
        currentState: 'DEFINED',
        evidenceIds: ['evidence-strategy-001'],
      },
      {
        capabilityId: 'cap-commercial',
        name: 'Commercial Performance',
        currentState: 'MEASURED',
        evidenceIds: ['evidence-commercial-001'],
      },
      {
        capabilityId: 'cap-campaign',
        name: 'Campaign Execution',
        currentState: 'PARTIAL',
        evidenceIds: ['evidence-campaign-001'],
      },
      {
        capabilityId: 'cap-opportunity',
        name: 'Opportunity Prioritization',
        currentState: 'DEVELOPING',
        evidenceIds: ['evidence-opportunity-001'],
      },
    ],
    evidence: [
      {
        evidenceId: 'evidence-strategy-001',
        sourceType: 'USER_INPUT',
        summary: 'Approved growth strategy exists',
        confidence: 0.9,
      },
      {
        evidenceId: 'evidence-commercial-001',
        sourceType: 'METRIC',
        summary: 'Commercial KPIs are measured monthly',
        confidence: 0.95,
      },
      {
        evidenceId: 'evidence-campaign-001',
        sourceType: 'CAMPAIGN',
        summary: 'Campaign performance evidence is partial',
        confidence: 0.76,
      },
      {
        evidenceId: 'evidence-opportunity-001',
        sourceType: 'OPPORTUNITY',
        summary: 'Opportunity scoring process is developing',
        confidence: 0.71,
      },
    ],
    constraints: [
      'Assessment is advisory only',
      'Human approval required for resulting actions',
    ],
  };
}

describe(
  'INTEL-GROWTH-01 — Growth capability semantic mapping',
  () => {
    it('maps capability assessment to the canonical Growth scenario', () => {
      const mapped =
        GrowthCoreSemanticMapperV1.mapAssessGrowthCapability(
          createRequest(),
        );

      expect(mapped.operation).toBe(
        'ASSESS_GROWTH_CAPABILITY',
      );
      expect(mapped.scenarioId).toBe(
        'GROWTH_INTELLIGENCE',
      );
      expect(mapped.objectiveKey).toBe(
        'ASSESS_GROWTH_INTELLIGENCE',
      );
    });

    it('uses all four canonical Growth domains', () => {
      const mapped =
        GrowthCoreSemanticMapperV1.mapAssessGrowthCapability(
          createRequest(),
        );

      expect(mapped.domains).toEqual([
        'growth_strategy',
        'commercial_performance',
        'campaigns',
        'opportunities',
      ]);
    });

    it('projects only capability business semantics', () => {
      const request = createRequest();

      const mapped =
        GrowthCoreSemanticMapperV1.mapAssessGrowthCapability(
          request,
        );

      expect(mapped.payload).toEqual({
        objective: request.objective,
        capabilities: request.capabilities,
        evidence: request.evidence,
        constraints: request.constraints,
      });
    });

    it('does not propagate authority context into payload', () => {
      const mapped =
        GrowthCoreSemanticMapperV1.mapAssessGrowthCapability(
          createRequest(),
        );

      const serialized = JSON.stringify(mapped.payload);

      expect(serialized).not.toContain(
        'tenant-capability-authority',
      );
      expect(serialized).not.toContain(
        'actor-capability-authority',
      );
      expect(serialized).not.toContain('SHADOW');

      expect(mapped.payload).not.toHaveProperty('tenantId');
      expect(mapped.payload).not.toHaveProperty('actorId');
      expect(mapped.payload).not.toHaveProperty('mode');
      expect(mapped.payload).not.toHaveProperty('role');
      expect(mapped.payload).not.toHaveProperty(
        'permission',
      );
    });

    it('preserves correlation outside semantic payload', () => {
      const mapped =
        GrowthCoreSemanticMapperV1.mapAssessGrowthCapability(
          createRequest(),
        );

      expect(mapped.requestId).toBe(
        'growth-capability-request-001',
      );
      expect(mapped.correlationId).toBe(
        'growth-capability-correlation-001',
      );

      expect(mapped.payload).not.toHaveProperty('requestId');
      expect(mapped.payload).not.toHaveProperty(
        'correlationId',
      );
    });

    it('creates a detached capability projection', () => {
      const request = createRequest();

      const mapped =
        GrowthCoreSemanticMapperV1.mapAssessGrowthCapability(
          request,
        );

      expect(mapped.payload.capabilities).not.toBe(
        request.capabilities,
      );
      expect(mapped.payload.capabilities[0]).not.toBe(
        request.capabilities[0],
      );
      expect(mapped.payload.capabilities[0].evidenceIds).not.toBe(
        request.capabilities[0].evidenceIds,
      );
      expect(mapped.payload.evidence).not.toBe(
        request.evidence,
      );
      expect(mapped.payload.constraints).not.toBe(
        request.constraints,
      );
    });

    it('contains no executable behavior in the semantic projection', () => {
      const mapped =
        GrowthCoreSemanticMapperV1.mapAssessGrowthCapability(
          createRequest(),
        );

      expect(mapped.payload).not.toHaveProperty('execute');
      expect(mapped.payload).not.toHaveProperty('command');
      expect(mapped.payload).not.toHaveProperty('write');
      expect(mapped.payload).not.toHaveProperty('apply');
    });
  },
);
