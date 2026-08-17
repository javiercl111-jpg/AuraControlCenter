import { describe, expect, it } from 'vitest';

import {
  GrowthCoreSemanticMapperV1,
  type GrowthRecommendActionsSemanticRequestV1,
} from '../GrowthCoreSemanticMapperV1';

function createRequest(): GrowthRecommendActionsSemanticRequestV1 {
  return {
    context: {
      contractVersion: '1.0',
      requestId: 'growth-action-request-001',
      correlationId: 'growth-action-correlation-001',
      tenantId: 'tenant-action-authority',
      actorId: 'actor-action-authority',
      requestedAt: '2026-08-17T21:00:00.000Z',
      mode: 'SHADOW',
    },
    subject: {
      subjectType: 'CAMPAIGN',
      subjectId: 'campaign-001',
      state: 'UNDERPERFORMING',
      summary:
        'Campaign conversion is below the approved target',
    },
    allowedActions: [
      'REVIEW_AUDIENCE',
      'REVIEW_MESSAGE',
      'REVIEW_CHANNEL_MIX',
    ],
    prohibitedActions: [
      'AUTO_PUBLISH',
      'AUTO_CHANGE_BUDGET',
      'AUTO_CONTACT_PROSPECTS',
    ],
    evidence: [
      {
        evidenceId: 'metric-001',
        sourceType: 'METRIC',
        summary:
          'Qualified conversion is 18 percent below target',
        confidence: 0.94,
      },
    ],
    constraints: [
      'Human approval required before execution',
      'No autonomous commercial action',
    ],
  };
}

describe(
  'INTEL-GROWTH-01 — Growth recommend actions semantic mapping',
  () => {
    it('maps recommendation request to the canonical Growth scenario', () => {
      const mapped =
        GrowthCoreSemanticMapperV1.mapRecommendActions(
          createRequest(),
        );

      expect(mapped.operation).toBe('RECOMMEND_ACTIONS');
      expect(mapped.scenarioId).toBe(
        'GROWTH_INTELLIGENCE',
      );
      expect(mapped.objectiveKey).toBe(
        'ASSESS_GROWTH_INTELLIGENCE',
      );
    });

    it('maps campaign subjects to campaign and growth strategy domains', () => {
      const mapped =
        GrowthCoreSemanticMapperV1.mapRecommendActions(
          createRequest(),
        );

      expect(mapped.domains).toEqual([
        'campaigns',
        'growth_strategy',
      ]);
    });

    it('projects recommendation constraints without executable commands', () => {
      const request = createRequest();

      const mapped =
        GrowthCoreSemanticMapperV1.mapRecommendActions(
          request,
        );

      expect(mapped.payload).toEqual({
        subject: request.subject,
        allowedActions: request.allowedActions,
        prohibitedActions: request.prohibitedActions,
        evidence: request.evidence,
        constraints: request.constraints,
      });

      expect(mapped.payload).not.toHaveProperty('execute');
      expect(mapped.payload).not.toHaveProperty('command');
      expect(mapped.payload).not.toHaveProperty('write');
    });

    it('preserves prohibited actions explicitly', () => {
      const mapped =
        GrowthCoreSemanticMapperV1.mapRecommendActions(
          createRequest(),
        );

      expect(mapped.payload.prohibitedActions).toEqual([
        'AUTO_PUBLISH',
        'AUTO_CHANGE_BUDGET',
        'AUTO_CONTACT_PROSPECTS',
      ]);
    });

    it('does not propagate authority context into payload', () => {
      const mapped =
        GrowthCoreSemanticMapperV1.mapRecommendActions(
          createRequest(),
        );

      const serialized = JSON.stringify(mapped.payload);

      expect(serialized).not.toContain(
        'tenant-action-authority',
      );
      expect(serialized).not.toContain(
        'actor-action-authority',
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

    it('preserves correlation outside payload', () => {
      const mapped =
        GrowthCoreSemanticMapperV1.mapRecommendActions(
          createRequest(),
        );

      expect(mapped.requestId).toBe(
        'growth-action-request-001',
      );
      expect(mapped.correlationId).toBe(
        'growth-action-correlation-001',
      );

      expect(mapped.payload).not.toHaveProperty('requestId');
      expect(mapped.payload).not.toHaveProperty(
        'correlationId',
      );
    });

    it('creates a detached recommendation projection', () => {
      const request = createRequest();

      const mapped =
        GrowthCoreSemanticMapperV1.mapRecommendActions(
          request,
        );

      expect(mapped.payload.subject).not.toBe(
        request.subject,
      );
      expect(mapped.payload.allowedActions).not.toBe(
        request.allowedActions,
      );
      expect(mapped.payload.prohibitedActions).not.toBe(
        request.prohibitedActions,
      );
      expect(mapped.payload.evidence).not.toBe(
        request.evidence,
      );
      expect(mapped.payload.constraints).not.toBe(
        request.constraints,
      );
    });
  },
);
