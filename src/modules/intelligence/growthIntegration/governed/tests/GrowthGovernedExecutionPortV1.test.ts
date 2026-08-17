import { describe, expect, it } from 'vitest';

import {
  GROWTH_GOVERNED_EXECUTION_MODES_V1,
  type GrowthGovernedExecutionInputV1,
  type GrowthGovernedExecutionPortV1,
  type GrowthGovernedExecutionResultV1,
} from '../GrowthGovernedExecutionPortV1';

function createInput(): GrowthGovernedExecutionInputV1 {
  return {
    authority: {
      tenantId: 'tenant-001',
      actor: {
        actorId: 'actor-001',
        actorType: 'USER',
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
          objective: 'Increase qualified demand',
        },
      },
    },
  };
}

describe(
  'INTEL-GROWTH-01 â€” GrowthGovernedExecutionPortV1',
  () => {
    it('exports the canonical non-productive governed modes', () => {
      expect(GROWTH_GOVERNED_EXECUTION_MODES_V1).toEqual([
        'SHADOW_ONLY',
        'EVALUATION',
      ]);

      expect(
        GROWTH_GOVERNED_EXECUTION_MODES_V1,
      ).not.toContain('PRODUCTIVE');
    });

    it('keeps authority separate from semantic payload', () => {
      const input = createInput();

      expect(input.authority.tenantId).toBe('tenant-001');
      expect(input.authority.actor.actorId).toBe('actor-001');

      const semantic = JSON.stringify(input.semantic);

      expect(semantic).not.toContain('tenant-001');
      expect(semantic).not.toContain('actor-001');
      expect(input.semantic).not.toHaveProperty('tenantId');
      expect(input.semantic).not.toHaveProperty('actorId');
      expect(input.semantic.payload).not.toHaveProperty(
        'tenantId',
      );
      expect(input.semantic.payload).not.toHaveProperty(
        'actorId',
      );
    });

    it('uses the canonical Growth source and scenario', () => {
      const input = createInput();

      expect(input.execution.source).toBe('AURA_GROWTH');
      expect(input.semantic.scenarioId).toBe(
        'GROWTH_INTELLIGENCE',
      );
      expect(input.semantic.objectiveKey).toBe(
        'ASSESS_GROWTH_INTELLIGENCE',
      );
    });

    it('allows SHADOW_ONLY', () => {
      const input = createInput();

      expect(input.execution.requestedMode).toBe(
        'SHADOW_ONLY',
      );
    });

    it('supports EVALUATION as the only other governed mode', () => {
      const input: GrowthGovernedExecutionInputV1 = {
        ...createInput(),
        execution: {
          ...createInput().execution,
          requestedMode: 'EVALUATION',
        },
      };

      expect(input.execution.requestedMode).toBe(
        'EVALUATION',
      );
    });

    it('does not expose PRODUCTIVE in the Growth governed mode type', () => {
      type RequestedMode =
        GrowthGovernedExecutionInputV1['execution']['requestedMode'];

      const allowed: readonly RequestedMode[] = [
        'SHADOW_ONLY',
        'EVALUATION',
      ];

      expect(allowed).toEqual([
        'SHADOW_ONLY',
        'EVALUATION',
      ]);
    });

    it('defines a sanitized governed result without semantic payload', () => {
      const result: GrowthGovernedExecutionResultV1 = {
        status: 'SUCCEEDED',
        executionId: 'execution-001',
        requestId: 'growth-request-001',
        correlationId: 'growth-correlation-001',
        mode: 'SHADOW_ONLY',
        warnings: [],
      };

      expect(result.status).toBe('SUCCEEDED');
      expect(result.executionId).toBe('execution-001');
      expect(result).not.toHaveProperty('payload');
      expect(result).not.toHaveProperty('semantic');
      expect(result).not.toHaveProperty('authority');
    });

    it('supports sanitized governed failures', () => {
      const result: GrowthGovernedExecutionResultV1 = {
        status: 'REJECTED',
        requestId: 'growth-request-001',
        correlationId: 'growth-correlation-001',
        mode: 'SHADOW_ONLY',
        warnings: [],
        error: {
          code: 'GROWTH_GOVERNED_EXECUTION_REJECTED',
          message: 'Governed execution was rejected',
        },
      };

      expect(result.status).toBe('REJECTED');
      expect(result.error?.code).toBe(
        'GROWTH_GOVERNED_EXECUTION_REJECTED',
      );
      expect(JSON.stringify(result)).not.toContain(
        'tenant-001',
      );
      expect(JSON.stringify(result)).not.toContain(
        'actor-001',
      );
    });

    it('defines an injectable asynchronous execution port', async () => {
      const expected: GrowthGovernedExecutionResultV1 = {
        status: 'SUCCEEDED',
        executionId: 'execution-001',
        requestId: 'growth-request-001',
        correlationId: 'growth-correlation-001',
        mode: 'SHADOW_ONLY',
        warnings: [],
      };

      const port: GrowthGovernedExecutionPortV1 = {
        execute: async (
          _input: GrowthGovernedExecutionInputV1,
        ) => expected,
      };

      await expect(
        port.execute(createInput()),
      ).resolves.toEqual(expected);
    });
  },
);
