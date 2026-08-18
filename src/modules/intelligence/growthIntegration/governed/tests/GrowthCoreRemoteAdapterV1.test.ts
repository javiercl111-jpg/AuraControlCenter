import { describe, expect, it, vi } from 'vitest';

import {
  GrowthCoreRemoteAdapterV1,
} from '../GrowthCoreRemoteAdapterV1';

import type {
  GrowthGovernedExecutionInputV1,
  GrowthGovernedExecutionPortV1,
  GrowthGovernedExecutionResultV1,
} from '../GrowthGovernedExecutionPortV1';

import type {
  GrowthAnalyzeCampaignSemanticRequestV1,
} from '../../GrowthCoreSemanticMapperV1';

function createRequest(): GrowthAnalyzeCampaignSemanticRequestV1 {
  return {
    context: {
      contractVersion: '1.0',
      requestId: 'growth-request-001',
      correlationId: 'growth-correlation-001',
      tenantId: 'tenant-001',
      actorId: 'actor-001',
      requestedAt: '2026-08-17T23:00:00.000Z',
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
      ],
      expectedKpis: [
        {
          metric: 'qualified_leads',
          target: 25,
          unit: 'COUNT',
        },
      ],
    },
    evidence: [],
    constraints: [
      'No autonomous commercial execution',
    ],
  };
}

describe(
  'INTEL-GROWTH-01 — GrowthCoreRemoteAdapterV1',
  () => {
    it('maps analyzeCampaign into the governed execution port', async () => {
      const expectedResult: GrowthGovernedExecutionResultV1 = {
        status: 'SUCCEEDED',
        executionId: 'execution-001',
        requestId: 'growth-request-001',
        correlationId: 'growth-correlation-001',
        mode: 'SHADOW_ONLY',
        warnings: [],
      };

      const execute = vi.fn<
        GrowthGovernedExecutionPortV1['execute']
      >(async () => expectedResult);

      const port: GrowthGovernedExecutionPortV1 = {
        execute,
      };

      const adapter = new GrowthCoreRemoteAdapterV1(port);

      const result = await adapter.analyzeCampaign(
        createRequest(),
        {
          actorType: 'USER',
          requestedMode: 'SHADOW_ONLY',
        },
      );

      expect(result).toEqual(expectedResult);
      expect(execute).toHaveBeenCalledTimes(1);
    });

    it('keeps authority outside semantic projection', async () => {
      let captured:
        | GrowthGovernedExecutionInputV1
        | undefined;

      const port: GrowthGovernedExecutionPortV1 = {
        execute: async (input) => {
          captured = input;

          return {
            status: 'SUCCEEDED',
            executionId: 'execution-001',
            requestId: input.execution.requestId,
            correlationId:
              input.execution.correlationId,
            mode: input.execution.requestedMode,
            warnings: [],
          };
        },
      };

      const adapter = new GrowthCoreRemoteAdapterV1(port);

      await adapter.analyzeCampaign(
        createRequest(),
        {
          actorType: 'USER',
          requestedMode: 'SHADOW_ONLY',
        },
      );

      expect(captured).toBeDefined();

      expect(captured?.authority).toEqual({
        tenantId: 'tenant-001',
        actor: {
          actorId: 'actor-001',
          actorType: 'USER',
        },
      });

      const semantic = JSON.stringify(captured?.semantic);

      expect(semantic).not.toContain('tenant-001');
      expect(semantic).not.toContain('actor-001');
    });

    it('uses canonical Growth execution metadata', async () => {
      let captured:
        | GrowthGovernedExecutionInputV1
        | undefined;

      const port: GrowthGovernedExecutionPortV1 = {
        execute: async (input) => {
          captured = input;

          return {
            status: 'SUCCEEDED',
            requestId: input.execution.requestId,
            correlationId:
              input.execution.correlationId,
            mode: input.execution.requestedMode,
            warnings: [],
          };
        },
      };

      const adapter = new GrowthCoreRemoteAdapterV1(port);

      await adapter.analyzeCampaign(
        createRequest(),
        {
          actorType: 'USER',
          requestedMode: 'SHADOW_ONLY',
        },
      );

      expect(captured?.execution).toEqual({
        requestId: 'growth-request-001',
        correlationId: 'growth-correlation-001',
        source: 'AURA_GROWTH',
        requestedMode: 'SHADOW_ONLY',
      });

      expect(captured?.semantic.operation).toBe(
        'ANALYZE_CAMPAIGN',
      );
      expect(captured?.semantic.scenarioId).toBe(
        'GROWTH_INTELLIGENCE',
      );
      expect(captured?.semantic.objectiveKey).toBe(
        'ASSESS_GROWTH_INTELLIGENCE',
      );
      expect(captured?.semantic.domains).toEqual([
        'campaigns',
        'growth_strategy',
      ]);
    });

    it('supports EVALUATION without exposing PRODUCTIVE', async () => {
      let captured:
        | GrowthGovernedExecutionInputV1
        | undefined;

      const port: GrowthGovernedExecutionPortV1 = {
        execute: async (input) => {
          captured = input;

          return {
            status: 'SUCCEEDED',
            requestId: input.execution.requestId,
            correlationId:
              input.execution.correlationId,
            mode: input.execution.requestedMode,
            warnings: [],
          };
        },
      };

      const adapter = new GrowthCoreRemoteAdapterV1(port);

      await adapter.analyzeCampaign(
        createRequest(),
        {
          actorType: 'SERVICE',
          requestedMode: 'EVALUATION',
        },
      );

      expect(captured?.execution.requestedMode).toBe(
        'EVALUATION',
      );

      expect(
        JSON.stringify(captured),
      ).not.toContain('PRODUCTIVE');
    });

    it('does not mutate the Growth request', async () => {
      const request = createRequest();

      const before = JSON.stringify(request);

      const port: GrowthGovernedExecutionPortV1 = {
        execute: async (input) => ({
          status: 'SUCCEEDED',
          requestId: input.execution.requestId,
          correlationId:
            input.execution.correlationId,
          mode: input.execution.requestedMode,
          warnings: [],
        }),
      };

      const adapter = new GrowthCoreRemoteAdapterV1(port);

      await adapter.analyzeCampaign(
        request,
        {
          actorType: 'USER',
          requestedMode: 'SHADOW_ONLY',
        },
      );

      expect(JSON.stringify(request)).toBe(before);
    });

    it('does not add Boundary, Firebase, network or write behavior to the public result', async () => {
      const port: GrowthGovernedExecutionPortV1 = {
        execute: async (input) => ({
          status: 'REJECTED',
          requestId: input.execution.requestId,
          correlationId:
            input.execution.correlationId,
          mode: input.execution.requestedMode,
          warnings: [],
          error: {
            code: 'GROWTH_GOVERNED_EXECUTION_REJECTED',
            message: 'Governed execution was rejected',
          },
        }),
      };

      const adapter = new GrowthCoreRemoteAdapterV1(port);

      const result = await adapter.analyzeCampaign(
        createRequest(),
        {
          actorType: 'USER',
          requestedMode: 'SHADOW_ONLY',
        },
      );

      expect(result.status).toBe('REJECTED');
      expect(result).not.toHaveProperty('payload');
      expect(result).not.toHaveProperty('semantic');
      expect(result).not.toHaveProperty('authority');
    });
  },
);
