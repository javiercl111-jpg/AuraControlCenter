import { describe, expect, it, vi } from 'vitest';

import type {
  BoundaryClockPort,
  BoundaryExecutionPort,
  FeaturePolicyPort,
} from '../../../os/boundary/ports';


import {
  createTrustedRequestIdentityV1,
  createTrustedServerLifecycleV1,
  createTrustedServerPrincipalV1,
  createTrustedServerRequestContextV1,
  createTrustedTenantMembershipV1,
} from '../../../server';

import {
  createGovernedGrowthRuntimeCompositionV1,
} from '../createGovernedGrowthRuntimeCompositionV1';

function createTrustedContext() {
  const principal = createTrustedServerPrincipalV1({
    schemaVersion: '1',
    principalId: 'trusted-growth-actor-001',
    principalType: 'USER',
    authenticationMethod: 'INTERNAL_TEST_ASSERTION',
    provider: 'AURA_INTERNAL_TEST',
    authenticatedAt: '2026-08-17T20:00:00.000Z',
  });

  const membership = createTrustedTenantMembershipV1({
    schemaVersion: '1',
    tenantId: 'trusted-growth-tenant-001',
    principalId: 'trusted-growth-actor-001',
    membershipId: 'membership-growth-001',
    roles: ['TENANT_MEMBER'],
    status: 'ACTIVE',
    resolvedAt: '2026-08-17T20:00:00.000Z',
    resolverVersion: 'resolver:test:v1',
  });

  const requestIdentity = createTrustedRequestIdentityV1({
    schemaVersion: '1',
    requestId: 'growth-runtime-request-001',
    correlationId: 'growth-runtime-correlation-001',
    generationStrategy: 'DETERMINISTIC_TEST',
    generatedAt: '2026-08-17T20:00:00.000Z',
    generatorVersion: 'generator:test:v1',
  });

  const cancellation = createTrustedServerLifecycleV1({
    schemaVersion: '1',
    transportAborted: false,
  });

  return createTrustedServerRequestContextV1({
    schemaVersion: '1',
    transport: 'INTERNAL_TEST',
    authenticatedPrincipal: principal,
    tenantMembership: membership,
    consumer: 'AURA_GROWTH',
    source: 'AURA_GROWTH',
    requestIdentity,
    initiatedAt: '2026-08-17T20:00:00.000Z',
    requestedExecutionMode: 'SHADOW_ONLY',
    cancellation,
  });
}

function createClock(): BoundaryClockPort {
  return {
    now: () => '2026-08-17T20:00:00.000Z',
  };
}

function createPolicyPort(): FeaturePolicyPort {
  return {
    getEffectivePolicy: async () => undefined,
    evaluateAuthoritativePolicy: async (query) => ({
      schemaVersion: '1',
      authorizationPolicyVersion:
        'growth-runtime-test-policy-v1',
      evaluatedTenantId: query.tenantId,
      evaluatedConsumerId: query.consumerId,
      evaluatedSource: query.source,
      evaluatedActor: query.actor,
      requestedMode: query.requestedMode,
      decision: 'ALLOWED',
      reasonCode: 'POLICY_ALLOWED',
      effectiveExecutionMode:
        query.requestedMode === 'EVALUATION'
          ? 'EVALUATION'
          : 'SHADOW_ONLY',
      effectiveTimeoutMs: 5000,
    }),
  };
}

function createExecutionPort(): BoundaryExecutionPort {
  return {
    execute: vi.fn(async (input) => ({
      executionId: 'growth-runtime-execution-001',
      sessionId: input.sessionId,
      status: 'SUCCEEDED',
    })),
  };
}

describe(
  'INTEL-GROWTH-01 — createGovernedGrowthRuntimeCompositionV1',
  () => {
    it('creates a Growth core facade backed by the governed Boundary', () => {
      const composition =
        createGovernedGrowthRuntimeCompositionV1({
          trustedContext: createTrustedContext(),
          featurePolicyPort: createPolicyPort(),
          executionPort: createExecutionPort(),
          clockPort: createClock(),
        });

      expect(composition.growthCore).toBeDefined();
      expect(
        composition.growthCore.analyzeCampaign,
      ).toBeTypeOf('function');



    });

    it('returns the assembled Boundary for controlled runtime inspection', () => {
      const composition =
        createGovernedGrowthRuntimeCompositionV1({
          trustedContext: createTrustedContext(),
          featurePolicyPort: createPolicyPort(),
          executionPort: createExecutionPort(),
          clockPort: createClock(),
        });

      expect(composition.boundary).toBeDefined();
      expect(composition.boundary.execute).toBeTypeOf(
        'function',
      );
    });

    it('does not require Growth payload authority to construct runtime authority', () => {
      const composition =
        createGovernedGrowthRuntimeCompositionV1({
          trustedContext: createTrustedContext(),
          featurePolicyPort: createPolicyPort(),
          executionPort: createExecutionPort(),
          clockPort: createClock(),
        });

      expect(composition.invocationContextProvider).toBeDefined();

      expect(
        composition.invocationContextProvider.create(),
      ).toEqual({
        schemaVersion: '1',
        tenantId: 'trusted-growth-tenant-001',
        actor: {
          actorType: 'USER',
          actorId: 'trusted-growth-actor-001',
        },
        consumerId: 'AURA_GROWTH',
        source: 'AURA_GROWTH',
        requestId: 'growth-runtime-request-001',
        correlationId: 'growth-runtime-correlation-001',
      });
    });

    it('uses the exact caller-supplied policy, execution and clock ports', () => {
      const featurePolicyPort = createPolicyPort();
      const executionPort = createExecutionPort();
      const clockPort = createClock();

      const composition =
        createGovernedGrowthRuntimeCompositionV1({
          trustedContext: createTrustedContext(),
          featurePolicyPort,
          executionPort,
          clockPort,
        });

      expect(composition.dependencies.featurePolicyPort).toBe(
        featurePolicyPort,
      );

      expect(composition.dependencies.executionPort).toBe(
        executionPort,
      );

      expect(composition.dependencies.clockPort).toBe(
        clockPort,
      );
    });

    it('does not expose a productive-mode switch', () => {
      const composition =
        createGovernedGrowthRuntimeCompositionV1({
          trustedContext: createTrustedContext(),
          featurePolicyPort: createPolicyPort(),
          executionPort: createExecutionPort(),
          clockPort: createClock(),
        });

      expect(composition).not.toHaveProperty('productive');
      expect(composition).not.toHaveProperty('mode');
      expect(composition).not.toHaveProperty(
        'requestedExecutionMode',
      );

      expect(
        JSON.stringify(Object.keys(composition)),
      ).not.toContain('PRODUCTIVE');
    });

    it('creates a fresh invocation provider for each composition', () => {
      const dependencies = {
        trustedContext: createTrustedContext(),
        featurePolicyPort: createPolicyPort(),
        executionPort: createExecutionPort(),
        clockPort: createClock(),
      };

      const first =
        createGovernedGrowthRuntimeCompositionV1(
          dependencies,
        );

      const second =
        createGovernedGrowthRuntimeCompositionV1(
          dependencies,
        );

      expect(first.invocationContextProvider).not.toBe(
        second.invocationContextProvider,
      );

      expect(first.boundary).not.toBe(second.boundary);
      expect(first.growthCore).not.toBe(second.growthCore);
    });

    it('executes analyzeCampaign through the full governed runtime path', async () => {
      const executionPort = createExecutionPort();

      const composition =
        createGovernedGrowthRuntimeCompositionV1({
          trustedContext: createTrustedContext(),
          featurePolicyPort: createPolicyPort(),
          executionPort,
          clockPort: createClock(),
        });

      const result = await composition.growthCore.analyzeCampaign(
        {
          context: {
            contractVersion: '1.0',
            requestId: 'growth-runtime-request-001',
            correlationId: 'growth-runtime-correlation-001',
            tenantId: 'trusted-growth-tenant-001',
            actorId: 'trusted-growth-actor-001',
            requestedAt: '2026-08-17T23:00:00.000Z',
            mode: 'SHADOW',
          },
          campaign: {
            campaignId: 'campaign-001',
            objective: 'Increase qualified enterprise demand',
            audienceSummary: 'Mid-market operations leaders',
            valueProposition: 'Governed enterprise intelligence',
            channels: ['LINKEDIN', 'EMAIL'],
            keyMessages: ['Improve decision quality'],
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
        },
        {
          actorType: 'USER',
          requestedMode: 'SHADOW_ONLY',
        },
      );

      expect(result.status).toBe('SUCCEEDED');
      expect(executionPort.execute).toHaveBeenCalledTimes(1);

      const [executionInput] =
        vi.mocked(executionPort.execute).mock.calls[0];

      expect(executionInput.payload).toMatchObject({
        operation: 'ANALYZE_CAMPAIGN',
        scenarioId: 'GROWTH_INTELLIGENCE',
        objectiveKey: 'ASSESS_GROWTH_INTELLIGENCE',
      });

      expect(
        executionInput.authoritativeContext?.tenantId,
      ).toBe('trusted-growth-tenant-001');

      expect(
        executionInput.authoritativeContext?.actor.actorId,
      ).toBe('trusted-growth-actor-001');

      expect(
        executionInput.authoritativeContext?.requestId,
      ).toBe('growth-runtime-request-001');

      expect(
        executionInput.authoritativeContext?.correlationId,
      ).toBe('growth-runtime-correlation-001');

      expect(
        executionInput.authoritativeContext?.consumerId,
      ).toBe('AURA_GROWTH');

      const serialized = JSON.stringify(executionInput);

      expect(serialized).not.toContain('PRODUCTIVE');
    });
  },
);
