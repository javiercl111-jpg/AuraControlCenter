import { describe, expect, it } from 'vitest';

import {
  GrowthCoreSemanticMapperV1,
  type GrowthAnalyzeCampaignSemanticRequestV1,
} from '../GrowthCoreSemanticMapperV1';

function createRequest(): GrowthAnalyzeCampaignSemanticRequestV1 {
  return {
    context: {
      contractVersion: '1.0',
      requestId: 'growth-request-001',
      correlationId: 'growth-correlation-001',
      tenantId: 'tenant-secret-authority',
      actorId: 'actor-secret-authority',
      requestedAt: '2026-08-17T19:00:00.000Z',
      mode: 'SHADOW',
    },
    campaign: {
      campaignId: 'campaign-001',
      objective: 'Increase qualified enterprise demand',
      audienceSummary: 'Mid-market operations leaders',
      valueProposition: 'Governed enterprise intelligence',
      channels: ['LINKEDIN', 'EMAIL'],
      keyMessages: [
        'Improve decision quality',
        'Preserve human authority',
      ],
      expectedKpis: [
        {
          metric: 'qualified_leads',
          target: 25,
          unit: 'COUNT',
        },
      ],
    },
    evidence: [
      {
        evidenceId: 'evidence-001',
        sourceType: 'METRIC',
        summary: 'Qualified lead conversion increased during the prior campaign',
        confidence: 0.82,
      },
    ],
    constraints: [
      'No autonomous commercial execution',
      'Human approval required',
    ],
  };
}

describe('INTEL-GROWTH-01 â€” GrowthCoreSemanticMapperV1', () => {
  it('maps analyzeCampaign to the canonical governed Growth scenario', () => {
    const mapped = GrowthCoreSemanticMapperV1.mapAnalyzeCampaign(
      createRequest(),
    );

    expect(mapped.operation).toBe('ANALYZE_CAMPAIGN');
    expect(mapped.scenarioId).toBe('GROWTH_INTELLIGENCE');
    expect(mapped.objectiveKey).toBe(
      'ASSESS_GROWTH_INTELLIGENCE',
    );
  });

  it('selects only campaign and growth strategy domains', () => {
    const mapped = GrowthCoreSemanticMapperV1.mapAnalyzeCampaign(
      createRequest(),
    );

    expect(mapped.domains).toEqual([
      'campaigns',
      'growth_strategy',
    ]);
  });

  it('projects only business-semantic campaign fields', () => {
    const mapped = GrowthCoreSemanticMapperV1.mapAnalyzeCampaign(
      createRequest(),
    );

    expect(mapped.payload).toEqual({
      campaign: {
        campaignId: 'campaign-001',
        objective: 'Increase qualified enterprise demand',
        audienceSummary: 'Mid-market operations leaders',
        valueProposition: 'Governed enterprise intelligence',
        channels: ['LINKEDIN', 'EMAIL'],
        keyMessages: [
          'Improve decision quality',
          'Preserve human authority',
        ],
        expectedKpis: [
          {
            metric: 'qualified_leads',
            target: 25,
            unit: 'COUNT',
          },
        ],
      },
      evidence: [
        {
          evidenceId: 'evidence-001',
          sourceType: 'METRIC',
          summary:
            'Qualified lead conversion increased during the prior campaign',
          confidence: 0.82,
        },
      ],
      constraints: [
        'No autonomous commercial execution',
        'Human approval required',
      ],
    });
  });

  it('does not place tenant, actor, mode or authority fields in semantic payload', () => {
    const mapped = GrowthCoreSemanticMapperV1.mapAnalyzeCampaign(
      createRequest(),
    );

    const serializedPayload = JSON.stringify(mapped.payload);

    expect(serializedPayload).not.toContain('tenantId');
    expect(serializedPayload).not.toContain('actorId');
    expect(serializedPayload).not.toContain('tenant-secret-authority');
    expect(serializedPayload).not.toContain('actor-secret-authority');
    expect(serializedPayload).not.toContain('SHADOW');

    expect(mapped.payload).not.toHaveProperty('tenantId');
    expect(mapped.payload).not.toHaveProperty('actorId');
    expect(mapped.payload).not.toHaveProperty('mode');
    expect(mapped.payload).not.toHaveProperty('authority');
    expect(mapped.payload).not.toHaveProperty('authoritative');
    expect(mapped.payload).not.toHaveProperty('role');
    expect(mapped.payload).not.toHaveProperty('permission');
  });

  it('preserves correlation identifiers outside the semantic payload', () => {
    const mapped = GrowthCoreSemanticMapperV1.mapAnalyzeCampaign(
      createRequest(),
    );

    expect(mapped.requestId).toBe('growth-request-001');
    expect(mapped.correlationId).toBe(
      'growth-correlation-001',
    );

    expect(mapped.payload).not.toHaveProperty('requestId');
    expect(mapped.payload).not.toHaveProperty('correlationId');
  });

  it('creates a detached semantic projection', () => {
    const request = createRequest();

    const mapped =
      GrowthCoreSemanticMapperV1.mapAnalyzeCampaign(request);

    expect(mapped.payload).not.toBe(request);
    expect(mapped.payload.campaign).not.toBe(request.campaign);
    expect(mapped.payload.evidence).not.toBe(request.evidence);
    expect(mapped.payload.constraints).not.toBe(
      request.constraints,
    );
  });
});
