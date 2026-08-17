import { describe, expect, it } from 'vitest';

import {
  createTrustedRequestIdentityV1,
  createTrustedServerLifecycleV1,
  createTrustedServerPrincipalV1,
  createTrustedServerRequestContextV1,
  createTrustedTenantMembershipV1,
} from '../../../server';

import {
  TrustedGrowthBoundaryInvocationContextProviderV1,
} from '../TrustedGrowthBoundaryInvocationContextProviderV1';

function createTrustedContext() {
  const principal = createTrustedServerPrincipalV1({
    schemaVersion: '1',
    principalId: 'trusted-actor-001',
    principalType: 'USER',
    authenticationMethod: 'INTERNAL_TEST_ASSERTION',
    provider: 'AURA_INTERNAL_TEST',
    authenticatedAt: '2026-08-17T20:00:00.000Z',
  });

  const membership = createTrustedTenantMembershipV1({
    schemaVersion: '1',
    tenantId: 'trusted-tenant-001',
    principalId: 'trusted-actor-001',
    membershipId: 'membership-001',
    roles: ['TENANT_MEMBER'],
    status: 'ACTIVE',
    resolvedAt: '2026-08-17T20:00:00.000Z',
    resolverVersion: 'resolver:test:v1',
  });

  const requestIdentity = createTrustedRequestIdentityV1({
    schemaVersion: '1',
    requestId: 'trusted-request-001',
    correlationId: 'trusted-correlation-001',
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
    consumer: 'INTELLIGENCE_OS_CONTRACT_TEST',
    source: 'TRUSTED_COMPOSITION_CONTRACT_TEST',
    requestIdentity,
    initiatedAt: '2026-08-17T20:00:00.000Z',
    requestedExecutionMode: 'SHADOW_ONLY',
    cancellation,
  });
}

describe(
  'INTEL-GROWTH-01 — TrustedGrowthBoundaryInvocationContextProviderV1',
  () => {
    it('projects tenant authority only from trusted tenant membership', () => {
      const provider =
        new TrustedGrowthBoundaryInvocationContextProviderV1(
          createTrustedContext(),
        );

      const context = provider.create();

      expect(context.tenantId).toBe('trusted-tenant-001');
    });

    it('projects actor authority only from the trusted principal', () => {
      const provider =
        new TrustedGrowthBoundaryInvocationContextProviderV1(
          createTrustedContext(),
        );

      const context = provider.create();

      expect(context.actor).toEqual({
        actorType: 'USER',
        actorId: 'trusted-actor-001',
      });
    });

    it('projects trusted consumer and source', () => {
      const provider =
        new TrustedGrowthBoundaryInvocationContextProviderV1(
          createTrustedContext(),
        );

      const context = provider.create();

      expect(context.consumerId).toBe(
        'INTELLIGENCE_OS_CONTRACT_TEST',
      );

      expect(context.source).toBe(
        'TRUSTED_COMPOSITION_CONTRACT_TEST',
      );
    });

    it('projects trusted request and correlation identifiers', () => {
      const provider =
        new TrustedGrowthBoundaryInvocationContextProviderV1(
          createTrustedContext(),
        );

      const context = provider.create();

      expect(context.requestId).toBe(
        'trusted-request-001',
      );

      expect(context.correlationId).toBe(
        'trusted-correlation-001',
      );
    });

    it('returns the canonical Boundary invocation schema', () => {
      const provider =
        new TrustedGrowthBoundaryInvocationContextProviderV1(
          createTrustedContext(),
        );

      expect(provider.create()).toEqual({
        schemaVersion: '1',
        tenantId: 'trusted-tenant-001',
        actor: {
          actorType: 'USER',
          actorId: 'trusted-actor-001',
        },
        consumerId: 'INTELLIGENCE_OS_CONTRACT_TEST',
        source: 'TRUSTED_COMPOSITION_CONTRACT_TEST',
        requestId: 'trusted-request-001',
        correlationId: 'trusted-correlation-001',
      });
    });

    it('returns a detached invocation context on each call', () => {
      const provider =
        new TrustedGrowthBoundaryInvocationContextProviderV1(
          createTrustedContext(),
        );

      const first = provider.create();
      const second = provider.create();

      expect(first).not.toBe(second);
      expect(first.actor).not.toBe(second.actor);
      expect(first).toEqual(second);
    });

    it('does not project transport or execution-mode metadata', () => {
      const provider =
        new TrustedGrowthBoundaryInvocationContextProviderV1(
          createTrustedContext(),
        );

      const serialized =
        JSON.stringify(provider.create());

      expect(serialized).not.toContain('transport');
      expect(serialized).not.toContain(
        'requestedExecutionMode',
      );
      expect(serialized).not.toContain('SHADOW_ONLY');
      expect(serialized).not.toContain('cancellation');
    });
  },
);
