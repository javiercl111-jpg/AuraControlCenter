import { describe, expect, it, vi } from 'vitest';

import {
  GrowthBoundaryExecutionAdapterV1,
  type BoundaryInvocationContextProviderV1,
  type GovernedBoundaryExecutorV1,
} from '../GrowthBoundaryExecutionAdapterV1';

import type {
  GovernedExecutionResponse,
} from '../../../os/boundary/types';

import type {
  GrowthGovernedExecutionInputV1,
} from '../GrowthGovernedExecutionPortV1';

function completedResponse(
  overrides: Partial<GovernedExecutionResponse> = {},
): GovernedExecutionResponse {
  return {
    requestId: 'growth-request-001',
    correlationId: 'growth-correlation-001',
    mode: 'SHADOW_ONLY',
    status: 'COMPLETED',
    startedAt: '2026-08-17T19:00:00.000Z',
    completedAt: '2026-08-17T19:00:01.000Z',
    durationMs: 1000,
    warnings: [],
    errors: [],
    ...overrides,
  };
}

function rejectedResponse(
  overrides: Partial<GovernedExecutionResponse> = {},
): GovernedExecutionResponse {
  return {
    requestId: 'growth-request-001',
    correlationId: 'growth-correlation-001',
    mode: 'SHADOW_ONLY',
    status: 'REJECTED',
    startedAt: '2026-08-17T19:00:00.000Z',
    completedAt: '2026-08-17T19:00:00.001Z',
    durationMs: 1,
    warnings: [],
    errors: [],
    ...overrides,
  };
}
function createInput(): GrowthGovernedExecutionInputV1 {
  return {
    authority: {
      tenantId: 'tenant-growth-001',
      actor: {
        actorId: 'actor-growth-001',
        actorType: 'SERVICE',
      },
    },
    execution: {
      requestId: 'growth-request-001',
      correlationId: 'growth-correlation-001',
      source: 'AURA_GROWTH',
      requestedMode: 'SHADOW_ONLY',
    },
    semantic: {
      operation: 'ANALYZE_CAMPAIGN',
      scenarioId: 'GROWTH_INTELLIGENCE',
      objectiveKey: 'ASSESS_GROWTH_INTELLIGENCE',
      domains: [
        'campaigns',
        'growth_strategy',
      ],
      payload: {
        campaign: {
          campaignId: 'campaign-001',
        },
      },
    },
  };
}

describe(
  'INTEL-GROWTH-01 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â GrowthBoundaryExecutionAdapterV1',
  () => {
    it('translates Growth authority and execution metadata into the Boundary request', async () => {
      const execute = vi.fn<
        GovernedBoundaryExecutorV1['execute']
      >(
        async () => completedResponse(),

      );

      const executor =
        { execute } as unknown as GovernedBoundaryExecutorV1;

      const contextProvider:
        BoundaryInvocationContextProviderV1 = {
          create: () => ({
            schemaVersion: '1',
            consumerId: 'AURA_GROWTH',
          } as never),
        };

      const adapter =
        new GrowthBoundaryExecutionAdapterV1(
          executor,
          contextProvider,
        );

      await adapter.execute(createInput());

      expect(execute).toHaveBeenCalledTimes(1);

      const [request] = execute.mock.calls[0];

      expect(request).toMatchObject({
        requestId: 'growth-request-001',
        correlationId: 'growth-correlation-001',
        tenant: {
          tenantId: 'tenant-growth-001',
        },
        actor: {
          actorId: 'actor-growth-001',
          actorType: 'SERVICE',
        },
        source: 'AURA_GROWTH',
        requestedMode: 'SHADOW_ONLY',
      });
    });

    it('places only semantic Growth data in Boundary payload', async () => {
      const execute = vi.fn<
        GovernedBoundaryExecutorV1['execute']
      >(
        async () => completedResponse(),

      );

      const adapter =
        new GrowthBoundaryExecutionAdapterV1(
          { execute } as unknown as GovernedBoundaryExecutorV1,
          {
            create: () => ({
              schemaVersion: '1',
              consumerId: 'AURA_GROWTH',
            } as never),
          },
        );

      await adapter.execute(createInput());

      const [request] = execute.mock.calls[0];

      expect(request.payload).toEqual({
        operation: 'ANALYZE_CAMPAIGN',
        scenarioId: 'GROWTH_INTELLIGENCE',
        objectiveKey: 'ASSESS_GROWTH_INTELLIGENCE',
        domains: [
          'campaigns',
          'growth_strategy',
        ],
        data: {
          campaign: {
            campaignId: 'campaign-001',
          },
        },
      });

      const payload = JSON.stringify(request.payload);

      expect(payload).not.toContain('tenant-growth-001');
      expect(payload).not.toContain('actor-growth-001');
      expect(payload).not.toContain('SHADOW_ONLY');
      expect(payload).not.toContain('AURA_GROWTH');
    });

    it('supplies explicit invocation context as the second Boundary argument', async () => {
      const invocation = {
        schemaVersion: '1',
        consumerId: 'AURA_GROWTH',
      } as never;

      const create = vi.fn(() => invocation);

      const execute = vi.fn<
        GovernedBoundaryExecutorV1['execute']
      >(
        async () => completedResponse(),

      );

      const adapter =
        new GrowthBoundaryExecutionAdapterV1(
          { execute } as unknown as GovernedBoundaryExecutorV1,
          { create },
        );

      const input = createInput();

      await adapter.execute(input);

      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith(input);

      expect(execute).toHaveBeenCalledTimes(1);
      expect(execute.mock.calls[0][1]).toBe(invocation);
    });

    it('maps COMPLETED to sanitized SUCCEEDED result', async () => {
      const adapter =
        new GrowthBoundaryExecutionAdapterV1(
          {
            execute: async () =>
              completedResponse({
                warnings: [
                  {
                    code: 'SHADOW_COMPARISON_RETAINED',
                    message: 'shadow comparison retained',
                  },
                ],
              }),
          } as unknown as GovernedBoundaryExecutorV1,
          {
            create: () => ({
              schemaVersion: '1',
              consumerId: 'AURA_GROWTH',
            } as never),
          },
        );

      const result = await adapter.execute(createInput());

      expect(result).toEqual({
        status: 'SUCCEEDED',
        requestId: 'growth-request-001',
        correlationId: 'growth-correlation-001',
        mode: 'SHADOW_ONLY',
        warnings: ['shadow comparison retained'],
      });

      expect(result).not.toHaveProperty('payload');
      expect(result).not.toHaveProperty('authority');
      expect(result).not.toHaveProperty('semantic');
    });

    it('maps Boundary rejection to sanitized Growth rejection', async () => {
      const adapter =
        new GrowthBoundaryExecutionAdapterV1(
          {
            execute: async () =>
              rejectedResponse({
                errors: [
                  {
                    code: 'INVALID_REQUEST',
                    message: 'Request rejected',
                    retryable: false,
                  },
                ],
              }),
          } as unknown as GovernedBoundaryExecutorV1,
          {
            create: () => ({
              schemaVersion: '1',
              consumerId: 'AURA_GROWTH',
            } as never),
          },
        );

      const result = await adapter.execute(createInput());

      expect(result.status).toBe('REJECTED');
      expect(result.requestId).toBe('growth-request-001');
      expect(result.correlationId).toBe(
        'growth-correlation-001',
      );
      expect(result.mode).toBe('SHADOW_ONLY');

      expect(result.error).toEqual({
        code: 'INVALID_REQUEST',
        message: 'Request rejected',
      });
    });

    it('does not mutate the governed Growth input', async () => {
      const input = createInput();
      const before = JSON.stringify(input);

      const adapter =
        new GrowthBoundaryExecutionAdapterV1(
          {
            execute: async () => completedResponse(),

          } as unknown as GovernedBoundaryExecutorV1,
          {
            create: () => ({
              schemaVersion: '1',
              consumerId: 'AURA_GROWTH',
            } as never),
          },
        );

      await adapter.execute(input);

      expect(JSON.stringify(input)).toBe(before);
    });
  },
);
