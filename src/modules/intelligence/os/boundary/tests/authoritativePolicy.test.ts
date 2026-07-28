import { describe, expect, it } from 'vitest';
import { BoundaryPolicyContractError } from '../errors';
import type {
  AuthoritativeFeaturePolicyPort,
  EffectiveBoundaryPolicy,
  FeaturePolicyPort,
} from '../ports';
import {
  AUTHORITATIVE_BOUNDARY_POLICY_SCHEMA_VERSION,
  type BoundaryActorTypeV1,
} from '../types';
import {
  MAX_AUTHORITATIVE_BOUNDARY_POLICY_TIMEOUT_MS,
  validateAuthoritativeBoundaryPolicyDecisionV1,
  validateAuthoritativeBoundaryPolicyQueryV1,
  validateAuthoritativeExecutionContextV1,
} from '../validators';

function createQuery(
  overrides: Readonly<Record<string, unknown>> = {}
): Record<string, unknown> {
  return {
    schemaVersion: AUTHORITATIVE_BOUNDARY_POLICY_SCHEMA_VERSION,
    tenantId: 'tenant-1',
    consumerId: 'consumer-1',
    source: 'trusted-adapter',
    requestedMode: 'SHADOW_ONLY',
    actor: {
      actorType: 'USER',
      actorId: 'actor-1',
    },
    ...overrides,
  };
}

function createAllowedDecision(
  overrides: Readonly<Record<string, unknown>> = {}
): Record<string, unknown> {
  return {
    schemaVersion: AUTHORITATIVE_BOUNDARY_POLICY_SCHEMA_VERSION,
    authorizationPolicyVersion: 'policy:v1:test',
    evaluatedTenantId: 'tenant-1',
    evaluatedConsumerId: 'consumer-1',
    evaluatedSource: 'trusted-adapter',
    evaluatedActor: {
      actorType: 'USER',
      actorId: 'actor-1',
    },
    requestedMode: 'SHADOW_ONLY',
    decision: 'ALLOWED',
    reasonCode: 'POLICY_ALLOWED',
    effectiveExecutionMode: 'SHADOW_ONLY',
    effectiveTimeoutMs: 30_000,
    ...overrides,
  };
}

function createDeniedDecision(
  reasonCode: string = 'CONSUMER_NOT_ALLOWED',
  overrides: Readonly<Record<string, unknown>> = {}
): Record<string, unknown> {
  return {
    schemaVersion: AUTHORITATIVE_BOUNDARY_POLICY_SCHEMA_VERSION,
    authorizationPolicyVersion: 'policy:v1:test',
    evaluatedTenantId: 'tenant-1',
    evaluatedConsumerId: 'consumer-1',
    evaluatedSource: 'trusted-adapter',
    evaluatedActor: {
      actorType: 'USER',
      actorId: 'actor-1',
    },
    requestedMode: 'SHADOW_ONLY',
    decision: 'DENIED',
    reasonCode,
    ...overrides,
  };
}

function createLegacyPolicy(): EffectiveBoundaryPolicy {
  return {
    enabled: true,
    allowedModes: ['SHADOW_ONLY', 'EVALUATION'],
    allowedSources: ['trusted-adapter'],
    maxPayloadBytes: 1024,
    maxTimeoutMs: 30_000,
    maxConcurrentExecutions: 1,
    killSwitch: false,
    shadowOnlyEnforced: true,
  };
}

function expectPolicyError(operation: () => unknown): void {
  expect(operation).toThrow(BoundaryPolicyContractError);
}

const boundaryContractSources = import.meta.glob(
  [
    '../types.ts',
    '../ports.ts',
    '../validators.ts',
    '../errors.ts',
    '../index.ts',
  ],
  {
    eager: true,
    query: '?raw',
    import: 'default',
  }
);
const boundaryRuntimeSources = import.meta.glob(
  '../GovernedExecutionBoundary.ts',
  {
    eager: true,
    query: '?raw',
    import: 'default',
  }
);
const policiesRuntimeSources = import.meta.glob('../policies.ts', {
  eager: true,
  query: '?raw',
  import: 'default',
});

const contractSourceText = Object.values(boundaryContractSources).join(
  '\n'
);
const boundaryRuntimeSourceText = Object.values(
  boundaryRuntimeSources
).join('\n');
const policiesRuntimeSourceText = Object.values(
  policiesRuntimeSources
).join('\n');

describe('AI-02H0A.1 authoritative policy contracts', () => {
  it('1. accepts a USER policy query', () => {
    expect(
      validateAuthoritativeBoundaryPolicyQueryV1(createQuery()).actor
        .actorType
    ).toBe('USER');
  });

  it('2. accepts a SERVICE policy query', () => {
    expect(
      validateAuthoritativeBoundaryPolicyQueryV1(
        createQuery({
          actor: { actorType: 'SERVICE', actorId: 'service-1' },
        })
      ).actor.actorType
    ).toBe('SERVICE');
  });

  it('3. accepts a SYSTEM policy query', () => {
    expect(
      validateAuthoritativeBoundaryPolicyQueryV1(
        createQuery({
          actor: { actorType: 'SYSTEM', actorId: 'system-1' },
        })
      ).actor.actorType
    ).toBe('SYSTEM');
  });

  it('4. accepts requested SHADOW_ONLY', () => {
    expect(
      validateAuthoritativeBoundaryPolicyQueryV1(createQuery())
        .requestedMode
    ).toBe('SHADOW_ONLY');
  });

  it('5. accepts requested EVALUATION', () => {
    expect(
      validateAuthoritativeBoundaryPolicyQueryV1(
        createQuery({ requestedMode: 'EVALUATION' })
      ).requestedMode
    ).toBe('EVALUATION');
  });

  it('6. accepts PRODUCTIVE only as a requested mode', () => {
    expect(
      validateAuthoritativeBoundaryPolicyQueryV1(
        createQuery({ requestedMode: 'PRODUCTIVE' })
      ).requestedMode
    ).toBe('PRODUCTIVE');
  });

  it('7. clones, freezes and deterministically validates a query', () => {
    const input = createQuery();
    const before = structuredClone(input);
    const first =
      validateAuthoritativeBoundaryPolicyQueryV1(input);
    const second = validateAuthoritativeBoundaryPolicyQueryV1(
      createQuery()
    );

    expect(first).not.toBe(input);
    expect(input).toEqual(before);
    expect(Object.isFrozen(first)).toBe(true);
    expect(first).toEqual(second);
    input.tenantId = 'mutated-tenant';
    expect(first.tenantId).toBe('tenant-1');
  });

  it('8. clones and isolates the query actor', () => {
    const input = createQuery();
    const actor = input.actor as Record<string, unknown>;
    const output =
      validateAuthoritativeBoundaryPolicyQueryV1(input);

    expect(output.actor).not.toBe(actor);
    expect(Object.isFrozen(output.actor)).toBe(true);
    actor.actorId = 'mutated-actor';
    expect(output.actor.actorId).toBe('actor-1');
  });

  it('9. rejects an unknown query version', () => {
    expectPolicyError(() =>
      validateAuthoritativeBoundaryPolicyQueryV1(
        createQuery({ schemaVersion: '2' })
      )
    );
  });

  it('10. rejects an empty query tenant', () => {
    expectPolicyError(() =>
      validateAuthoritativeBoundaryPolicyQueryV1(
        createQuery({ tenantId: '' })
      )
    );
  });

  it('11. rejects an empty query consumer', () => {
    expectPolicyError(() =>
      validateAuthoritativeBoundaryPolicyQueryV1(
        createQuery({ consumerId: '' })
      )
    );
  });

  it('12. rejects an empty query source', () => {
    expectPolicyError(() =>
      validateAuthoritativeBoundaryPolicyQueryV1(
        createQuery({ source: '' })
      )
    );
  });

  it('13. rejects an invalid query actor', () => {
    expectPolicyError(() =>
      validateAuthoritativeBoundaryPolicyQueryV1(
        createQuery({
          actor: { actorType: 'ADMIN', actorId: 'actor-1' },
        })
      )
    );
  });

  it('14. rejects an invalid requested mode', () => {
    expectPolicyError(() =>
      validateAuthoritativeBoundaryPolicyQueryV1(
        createQuery({ requestedMode: 'UNKNOWN' })
      )
    );
  });

  it('15. rejects an additional query property', () => {
    expectPolicyError(() =>
      validateAuthoritativeBoundaryPolicyQueryV1(
        createQuery({ payload: {} })
      )
    );
  });

  it('16. rejects null and undefined queries', () => {
    expectPolicyError(() =>
      validateAuthoritativeBoundaryPolicyQueryV1(null)
    );
    expectPolicyError(() =>
      validateAuthoritativeBoundaryPolicyQueryV1(undefined)
    );
  });

  it('17. rejects an array query', () => {
    expectPolicyError(() =>
      validateAuthoritativeBoundaryPolicyQueryV1([])
    );
  });

  it('18. rejects a query with a non-plain prototype', () => {
    const query = Object.assign(
      Object.create({ inherited: true }) as Record<string, unknown>,
      createQuery()
    );

    expectPolicyError(() =>
      validateAuthoritativeBoundaryPolicyQueryV1(query)
    );
  });

  it('19. accepts an ALLOWED SHADOW_ONLY decision', () => {
    const decision =
      validateAuthoritativeBoundaryPolicyDecisionV1(
        createAllowedDecision()
      );

    expect(decision.decision).toBe('ALLOWED');
    if (decision.decision === 'ALLOWED') {
      expect(decision.effectiveExecutionMode).toBe('SHADOW_ONLY');
    }
  });

  it('20. accepts an ALLOWED EVALUATION decision', () => {
    const decision =
      validateAuthoritativeBoundaryPolicyDecisionV1(
        createAllowedDecision({
          requestedMode: 'EVALUATION',
          effectiveExecutionMode: 'EVALUATION',
        })
      );

    expect(decision.decision).toBe('ALLOWED');
    if (decision.decision === 'ALLOWED') {
      expect(decision.effectiveExecutionMode).toBe('EVALUATION');
    }
  });

  it('21. preserves the opaque policy version', () => {
    expect(
      validateAuthoritativeBoundaryPolicyDecisionV1(
        createAllowedDecision()
      ).authorizationPolicyVersion
    ).toBe('policy:v1:test');
  });

  it('22. preserves the complete evaluated context', () => {
    const decision =
      validateAuthoritativeBoundaryPolicyDecisionV1(
        createAllowedDecision()
      );

    expect({
      tenantId: decision.evaluatedTenantId,
      consumerId: decision.evaluatedConsumerId,
      source: decision.evaluatedSource,
    }).toEqual({
      tenantId: 'tenant-1',
      consumerId: 'consumer-1',
      source: 'trusted-adapter',
    });
  });

  it('23. clones the evaluated actor', () => {
    const input = createAllowedDecision();
    const actor = input.evaluatedActor;
    const decision =
      validateAuthoritativeBoundaryPolicyDecisionV1(input);

    expect(decision.evaluatedActor).not.toBe(actor);
    expect(decision.evaluatedActor).toEqual(actor);
  });

  it('24. requires POLICY_ALLOWED for an allowed decision', () => {
    expect(
      validateAuthoritativeBoundaryPolicyDecisionV1(
        createAllowedDecision()
      ).reasonCode
    ).toBe('POLICY_ALLOWED');
  });

  it('25. preserves a valid effective timeout', () => {
    const decision =
      validateAuthoritativeBoundaryPolicyDecisionV1(
        createAllowedDecision({ effectiveTimeoutMs: 45_000 })
      );

    expect(decision.decision).toBe('ALLOWED');
    if (decision.decision === 'ALLOWED') {
      expect(decision.effectiveTimeoutMs).toBe(45_000);
    }
  });

  it('26. clones, freezes and isolates an allowed decision', () => {
    const input = createAllowedDecision();
    const before = structuredClone(input);
    const first =
      validateAuthoritativeBoundaryPolicyDecisionV1(input);
    const second = validateAuthoritativeBoundaryPolicyDecisionV1(
      createAllowedDecision()
    );

    expect(first).not.toBe(input);
    expect(input).toEqual(before);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.evaluatedActor)).toBe(true);
    expect(first).toEqual(second);
    input.evaluatedTenantId = 'mutated-tenant';
    (
      input.evaluatedActor as Record<string, unknown>
    ).actorId = 'mutated-actor';
    expect(first.evaluatedTenantId).toBe('tenant-1');
    expect(first.evaluatedActor.actorId).toBe('actor-1');
  });

  it('27. accepts a consumer-denied decision', () => {
    expect(
      validateAuthoritativeBoundaryPolicyDecisionV1(
        createDeniedDecision('CONSUMER_NOT_ALLOWED')
      ).reasonCode
    ).toBe('CONSUMER_NOT_ALLOWED');
  });

  it('28. accepts a source-denied decision', () => {
    expect(
      validateAuthoritativeBoundaryPolicyDecisionV1(
        createDeniedDecision('SOURCE_NOT_ALLOWED')
      ).reasonCode
    ).toBe('SOURCE_NOT_ALLOWED');
  });

  it('29. accepts an actor-denied decision', () => {
    expect(
      validateAuthoritativeBoundaryPolicyDecisionV1(
        createDeniedDecision('ACTOR_NOT_ALLOWED')
      ).reasonCode
    ).toBe('ACTOR_NOT_ALLOWED');
  });

  it('30. accepts a mode-denied decision', () => {
    expect(
      validateAuthoritativeBoundaryPolicyDecisionV1(
        createDeniedDecision('MODE_NOT_ALLOWED')
      ).reasonCode
    ).toBe('MODE_NOT_ALLOWED');
  });

  it('31. accepts a policy-not-found decision', () => {
    expect(
      validateAuthoritativeBoundaryPolicyDecisionV1(
        createDeniedDecision('POLICY_NOT_FOUND')
      ).reasonCode
    ).toBe('POLICY_NOT_FOUND');
  });

  it('32. omits effective mode and timeout from denied decisions', () => {
    const decision =
      validateAuthoritativeBoundaryPolicyDecisionV1(
        createDeniedDecision()
      );

    expect(decision.decision).toBe('DENIED');
    expect('effectiveExecutionMode' in decision).toBe(false);
    expect('effectiveTimeoutMs' in decision).toBe(false);
  });

  it('33. rejects a denied decision without a reason code', () => {
    const decision = createDeniedDecision();
    delete decision.reasonCode;

    expectPolicyError(() =>
      validateAuthoritativeBoundaryPolicyDecisionV1(decision)
    );
  });

  it('34. rejects an empty policy version', () => {
    expectPolicyError(() =>
      validateAuthoritativeBoundaryPolicyDecisionV1(
        createAllowedDecision({ authorizationPolicyVersion: '' })
      )
    );
  });

  it('35. rejects an unknown decision discriminator', () => {
    expectPolicyError(() =>
      validateAuthoritativeBoundaryPolicyDecisionV1(
        createDeniedDecision('POLICY_NOT_FOUND', {
          decision: 'UNKNOWN',
        })
      )
    );
  });

  it('36. rejects ALLOWED without an effective mode', () => {
    const decision = createAllowedDecision();
    delete decision.effectiveExecutionMode;

    expectPolicyError(() =>
      validateAuthoritativeBoundaryPolicyDecisionV1(decision)
    );
  });

  it('37. rejects PRODUCTIVE as an effective mode', () => {
    expectPolicyError(() =>
      validateAuthoritativeBoundaryPolicyDecisionV1(
        createAllowedDecision({
          effectiveExecutionMode: 'PRODUCTIVE',
        })
      )
    );
  });

  it('38. rejects DISABLED as an effective mode', () => {
    expectPolicyError(() =>
      validateAuthoritativeBoundaryPolicyDecisionV1(
        createAllowedDecision({
          effectiveExecutionMode: 'DISABLED',
        })
      )
    );
  });

  it('39. rejects a denied decision with an effective mode', () => {
    expectPolicyError(() =>
      validateAuthoritativeBoundaryPolicyDecisionV1(
        createDeniedDecision('MODE_NOT_ALLOWED', {
          effectiveExecutionMode: 'SHADOW_ONLY',
        })
      )
    );
  });

  it('40. rejects an empty evaluated tenant', () => {
    expectPolicyError(() =>
      validateAuthoritativeBoundaryPolicyDecisionV1(
        createAllowedDecision({ evaluatedTenantId: '' })
      )
    );
  });

  it('41. rejects an empty evaluated consumer', () => {
    expectPolicyError(() =>
      validateAuthoritativeBoundaryPolicyDecisionV1(
        createAllowedDecision({ evaluatedConsumerId: '' })
      )
    );
  });

  it('42. rejects an empty evaluated source', () => {
    expectPolicyError(() =>
      validateAuthoritativeBoundaryPolicyDecisionV1(
        createAllowedDecision({ evaluatedSource: '' })
      )
    );
  });

  it('43. rejects an invalid evaluated actor', () => {
    expectPolicyError(() =>
      validateAuthoritativeBoundaryPolicyDecisionV1(
        createAllowedDecision({
          evaluatedActor: {
            actorType: 'ADMIN',
            actorId: 'actor-1',
          },
        })
      )
    );
  });

  it('44. rejects an invalid requested mode in a decision', () => {
    expectPolicyError(() =>
      validateAuthoritativeBoundaryPolicyDecisionV1(
        createAllowedDecision({ requestedMode: 'UNKNOWN' })
      )
    );
  });

  it('45. rejects an unknown reason code', () => {
    expectPolicyError(() =>
      validateAuthoritativeBoundaryPolicyDecisionV1(
        createDeniedDecision('ARBITRARY_REASON')
      )
    );
  });

  it('46. rejects additional properties and invalid timeouts', () => {
    expectPolicyError(() =>
      validateAuthoritativeBoundaryPolicyDecisionV1(
        createAllowedDecision({ metadata: {} })
      )
    );
    expectPolicyError(() =>
      validateAuthoritativeBoundaryPolicyDecisionV1(
        createAllowedDecision({ effectiveTimeoutMs: 0 })
      )
    );
    expectPolicyError(() =>
      validateAuthoritativeBoundaryPolicyDecisionV1(
        createAllowedDecision({ effectiveTimeoutMs: 1.5 })
      )
    );
    expectPolicyError(() =>
      validateAuthoritativeBoundaryPolicyDecisionV1(
        createAllowedDecision({
          effectiveTimeoutMs:
            MAX_AUTHORITATIVE_BOUNDARY_POLICY_TIMEOUT_MS + 1,
        })
      )
    );
  });

  it('47. rejects non-plain, null and array decisions', () => {
    const decision = Object.assign(
      Object.create({ inherited: true }) as Record<string, unknown>,
      createAllowedDecision()
    );

    expectPolicyError(() =>
      validateAuthoritativeBoundaryPolicyDecisionV1(decision)
    );
    expectPolicyError(() =>
      validateAuthoritativeBoundaryPolicyDecisionV1(null)
    );
    expectPolicyError(() =>
      validateAuthoritativeBoundaryPolicyDecisionV1([])
    );
  });

  it('48. exposes the authoritative FeaturePolicyPort contract', async () => {
    const port: AuthoritativeFeaturePolicyPort = {
      getEffectivePolicy: async () => createLegacyPolicy(),
      evaluateAuthoritativePolicy: async () =>
        validateAuthoritativeBoundaryPolicyDecisionV1(
          createAllowedDecision()
        ),
    };

    const decision = await port.evaluateAuthoritativePolicy(
      validateAuthoritativeBoundaryPolicyQueryV1(createQuery())
    );
    expect(decision.decision).toBe('ALLOWED');
  });

  it('49. preserves the legacy FeaturePolicyPort contract', async () => {
    const port: FeaturePolicyPort = {
      getEffectivePolicy: async () => createLegacyPolicy(),
    };

    expect(
      await port.getEffectivePolicy(
        'legacy-tenant',
        'legacy-source'
      )
    ).toEqual(createLegacyPolicy());
    expect(port.evaluateAuthoritativePolicy).toBeUndefined();
  });

  it('50. leaves GovernedExecutionBoundary runtime unchanged', () => {
    expect(boundaryRuntimeSourceText).not.toMatch(
      /AuthoritativeBoundaryPolicy|evaluateAuthoritativePolicy/
    );
  });

  it('51. leaves policies runtime unchanged', () => {
    expect(policiesRuntimeSourceText).not.toMatch(
      /AuthoritativeBoundaryPolicy|evaluateAuthoritativePolicy/
    );
  });

  it('52. keeps policy contracts free of Bootstrap imports', () => {
    expect(contractSourceText).not.toMatch(
      /from\s+['"][^'"]*bootstrap/i
    );
  });

  it('53. keeps policy contracts free of Orchestrator imports', () => {
    expect(contractSourceText).not.toMatch(
      /AuraIntelligenceOrchestrator/
    );
  });

  it('54. keeps policy contracts free of Discovery imports', () => {
    const token = ['Dis', 'covery'].join('');
    expect(contractSourceText).not.toMatch(new RegExp(token));
  });

  it('55. keeps policy contracts free of Firebase imports', () => {
    const token = ['fire', 'base'].join('');
    expect(contractSourceText).not.toMatch(new RegExp(token, 'i'));
  });

  it('56. keeps policy contracts free of React and UI imports', () => {
    expect(contractSourceText).not.toMatch(
      /from\s+['"]react|\/components\/|\/ui\//i
    );
  });

  it('57. keeps policy contracts free of persistence and I/O', () => {
    expect(contractSourceText).not.toMatch(
      /from\s+['"](?:node:)?fs|localStorage|indexedDB|fetch\s*\(/
    );
  });

  it('58. contains no hardcoded production policy version', () => {
    expect(contractSourceText).not.toMatch(
      /authorizationPolicyVersion\s*:\s*['"`]/
    );
    expect(contractSourceText).not.toContain('policy:v1:test');
  });

  it('59. contains no allow-all policy implementation', () => {
    expect(contractSourceText).not.toMatch(
      /evaluateAuthoritativePolicy\s*\([^;]*\)\s*\{/
    );
  });

  it('60. structurally supplies AuthoritativeExecutionContextV1 policyVersion', () => {
    const query =
      validateAuthoritativeBoundaryPolicyQueryV1(createQuery());
    const decision =
      validateAuthoritativeBoundaryPolicyDecisionV1(
        createAllowedDecision()
      );
    expect(decision.decision).toBe('ALLOWED');
    if (decision.decision !== 'ALLOWED') {
      throw new Error('Expected an allowed policy decision');
    }

    const context = validateAuthoritativeExecutionContextV1({
      schemaVersion: '1',
      tenantId: decision.evaluatedTenantId,
      actor: decision.evaluatedActor,
      consumerId: decision.evaluatedConsumerId,
      source: decision.evaluatedSource,
      requestId: 'request-1',
      correlationId: 'correlation-1',
      executionMode: decision.effectiveExecutionMode,
      initiatedAt: '2026-07-28T12:00:00.000Z',
      authorizationPolicyVersion:
        decision.authorizationPolicyVersion,
    });

    expect(context.authorizationPolicyVersion).toBe(
      'policy:v1:test'
    );
    expect(
      ['USER', 'SERVICE', 'SYSTEM'] satisfies
        readonly BoundaryActorTypeV1[]
    ).toContain(query.actor.actorType);
  });
});
