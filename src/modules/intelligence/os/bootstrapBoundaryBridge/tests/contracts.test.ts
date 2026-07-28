import { describe, expect, it } from 'vitest';
import { createEmptyEnterpriseKnowledgeGraph } from '../../../enterprise-model/graph/services/operations';
import { createEmptyEnterpriseMentalModel } from '../../../enterprise-model/services/modelUpdater';
import type {
  AuthoritativeExecutionContextV1,
  BoundaryActorTypeV1,
} from '../../boundary/types';
import type {
  BootstrapAcceptedState,
  BootstrapRejectedState,
  PipelineBootstrapFact,
  PipelineBootstrapPolicy,
  PipelineInitialDomainState,
  PipelineInitialEvidence,
  PipelineScenarioDescriptor,
} from '../../bootstrap/types';
import { PIPELINE_BOOTSTRAP_SCENARIO_REGISTRY } from '../../bootstrap/types';
import { BootstrapBoundaryBridgeContractError } from '../errors';
import {
  BOOTSTRAP_BOUNDARY_BRIDGE_ACTOR_TYPES,
  BOOTSTRAP_BOUNDARY_BRIDGE_SCHEMA_VERSION,
  type BootstrapBoundaryBridgeActorType,
  type BootstrapBoundaryBridgeAuthorityV1,
} from '../types';
import {
  createBootstrapBoundaryBridgeAuthorityV1,
  createBootstrapBoundaryBridgeEnvelopeV1,
  createBootstrapBoundaryBridgeResultV1,
  validateBootstrapBoundaryBridgeAuthorityV1,
  validateBootstrapBoundaryBridgeEnvelopeV1,
  validateBootstrapBoundaryBridgeResultV1,
} from '../validators';

const INITIATED_AT = '2026-07-28T12:00:00.000Z';
const DEADLINE_AT = '2026-07-28T12:00:30.000Z';

function createAuthoritativeContext(
  actorType: BoundaryActorTypeV1 = 'USER'
): AuthoritativeExecutionContextV1 {
  return {
    schemaVersion: '1',
    tenantId: 'tenant-1',
    actor: {
      actorType,
      actorId: 'actor-1',
    },
    consumerId: 'consumer-1',
    source: 'trusted-adapter',
    requestId: 'request-1',
    correlationId: 'correlation-1',
    executionMode: 'SHADOW_ONLY',
    authorizationPolicyVersion: 'policy:v1:bridge',
    initiatedAt: INITIATED_AT,
    authoritativeDeadlineAt: DEADLINE_AT,
  };
}

function createBridgeAuthority(
  actorType: BootstrapBoundaryBridgeActorType = 'HUMAN',
  overrides: Partial<BootstrapBoundaryBridgeAuthorityV1> = {}
): BootstrapBoundaryBridgeAuthorityV1 {
  return {
    schemaVersion: BOOTSTRAP_BOUNDARY_BRIDGE_SCHEMA_VERSION,
    tenantId: 'tenant-1',
    actor: {
      actorType,
      actorId: 'actor-1',
    },
    consumerId: 'consumer-1',
    source: 'trusted-adapter',
    requestId: 'request-1',
    correlationId: 'correlation-1',
    executionMode: 'SHADOW_ONLY',
    authorizationPolicyVersion: 'policy:v1:bridge',
    initiatedAt: INITIATED_AT,
    authoritativeDeadlineAt: DEADLINE_AT,
    ...overrides,
  };
}

function createPolicy(): PipelineBootstrapPolicy {
  return {
    allowedTaxonomyVersion: '1',
    allowedScenarioVersion: '1',
    allowUnknownReliability: false,
    allowUncertainPolarity: false,
    allowInferredDirectness: false,
    allowedInferenceRuleIds: [],
    maxFacts: 10,
    maxFactValueSize: 256,
    maxTotalPayloadSize: 8_192,
    duplicateFactPolicy: 'REJECT',
    conflictPolicy: 'REJECT',
    failClosed: true,
    requireExplicitScenario: true,
  };
}

function createFact(): PipelineBootstrapFact {
  return {
    factId: 'fact-industry-1',
    category: 'BUSINESS_INDUSTRY',
    value: 'HOSPITALITY',
    valueType: 'ENUM',
    provenance: {
      sourceType: 'INTEGRATION',
      sourceId: 'source-event-1',
      collectionMethod: 'SYSTEM_EVENT',
      capturedAt: 200,
      reliability: 'HIGH',
      directness: 'DIRECT',
      actorType: 'SYSTEM',
      tenantId: 'tenant-1',
      correlationId: 'correlation-1',
    },
    reliability: 'HIGH',
    directness: 'DIRECT',
    polarity: 'AFFIRMED',
    observedAt: 100,
    schemaVersion: '1',
  };
}

function createScenarioDescriptor(): PipelineScenarioDescriptor {
  const registry = PIPELINE_BOOTSTRAP_SCENARIO_REGISTRY.PAYROLL_AUDIT;
  return {
    scenarioId: 'PAYROLL_AUDIT',
    scenarioVersion: '1',
    objectiveKey: 'ASSESS_PAYROLL_AUDIT_READINESS',
    requestedStages: [...registry.requiredStages],
    allowedStages: [...registry.allowedStages],
    requiredStages: [...registry.requiredStages],
    stageDependencies: registry.stageDependencies,
    includedDomains: [...registry.includedDomains],
    excludedDomains: [...registry.excludedDomains],
    source: 'AUTHORIZED_SYSTEM_CONFIGURATION',
    explicitSelection: true,
  };
}

function createInitialEvidence(): PipelineInitialEvidence {
  return {
    sourceFact: createFact(),
    appliedEvidence: {
      evidenceId: 'evidence-industry-1',
      sessionId: 'correlation-1',
      turnId: 'bootstrap-1',
      source: 'governed-bootstrap-contract',
      sourceType: 'INTEGRATION',
      originalText: null,
      normalizedStatement: 'BUSINESS_INDUSTRY=HOSPITALITY',
      category: 'BUSINESS_INDUSTRY',
      entityRefs: [],
      capturedAt: 200,
      reliability: 0.8,
      directness: 1,
      polarity: 'POSITIVE',
      extractorVersion: '1',
      metadata: {},
    },
  };
}

function createInitialDomainState(): PipelineInitialDomainState {
  const initialEvidence = createInitialEvidence();
  const mentalModel = createEmptyEnterpriseMentalModel();
  mentalModel.evidences[initialEvidence.appliedEvidence.evidenceId] =
    initialEvidence.appliedEvidence;
  return {
    mentalModel,
    knowledgeGraph: createEmptyEnterpriseKnowledgeGraph(),
    evidence: [initialEvidence],
    scenario: createScenarioDescriptor(),
    bootstrapId: 'bootstrap-1',
    tenantId: 'tenant-1',
    correlationId: 'correlation-1',
    createdAt: 300,
    schemaVersion: '1',
  };
}

function createAcceptedState(): BootstrapAcceptedState {
  return {
    status: 'ACCEPTED',
    bootstrapId: 'bootstrap-1',
    tenantId: 'tenant-1',
    correlationId: 'correlation-1',
    initialDomainState: createInitialDomainState(),
    provenanceSummary: {
      factCount: 1,
      sourceTypes: ['INTEGRATION'],
      earliestObservedAt: 100,
      latestObservedAt: 100,
    },
    bootstrapVersion: '1',
    createdAt: 300,
  };
}

function createRejectedState(): BootstrapRejectedState {
  return {
    status: 'REJECTED',
    bootstrapId: 'bootstrap-1',
    tenantId: 'tenant-1',
    correlationId: 'correlation-1',
    errors: [
      {
        code: 'INVALID_BOOTSTRAP_INPUT',
        message: 'Pipeline bootstrap input is invalid',
        retryable: false,
      },
    ],
    bootstrapVersion: '1',
    createdAt: 300,
  };
}

function expectBridgeError(
  operation: () => unknown
): BootstrapBoundaryBridgeContractError {
  try {
    operation();
  } catch (error) {
    expect(error).toBeInstanceOf(
      BootstrapBoundaryBridgeContractError
    );
    if (
      error instanceof BootstrapBoundaryBridgeContractError
    ) {
      return error;
    }
    throw error;
  }
  throw new Error('Expected BootstrapBoundaryBridgeContractError');
}

const bridgeSources = import.meta.glob('../*.ts', {
  eager: true,
  query: '?raw',
  import: 'default',
});
const osIndexSources = import.meta.glob('../../index.ts', {
  eager: true,
  query: '?raw',
  import: 'default',
});
const bridgeSourceText = Object.values(bridgeSources).join('\n');
const osIndexSourceText = Object.values(osIndexSources).join('\n');

describe('AI-02H0C.0 bootstrap boundary bridge contracts', () => {
  it('1. accepts valid bridge authority', () => {
    expect(
      validateBootstrapBoundaryBridgeAuthorityV1(
        createBridgeAuthority()
      )
    ).toEqual(createBridgeAuthority());
  });

  it('2. rejects missing authority', () => {
    expectBridgeError(() =>
      validateBootstrapBoundaryBridgeEnvelopeV1({
        schemaVersion: '1',
        businessPayload: { fact: 'value' },
      })
    );
  });

  it('3. rejects an invalid tenant', () => {
    expectBridgeError(() =>
      validateBootstrapBoundaryBridgeAuthorityV1(
        createBridgeAuthority('HUMAN', { tenantId: '' })
      )
    );
  });

  it('4. accepts HUMAN as the canonical human actor', () => {
    const authority =
      createBootstrapBoundaryBridgeAuthorityV1(
        createAuthoritativeContext('USER')
      );

    expect(authority.actor.actorType).toBe('HUMAN');
  });

  it('5. preserves SERVICE without translating it', () => {
    const authority =
      createBootstrapBoundaryBridgeAuthorityV1(
        createAuthoritativeContext('SERVICE')
      );

    expect(authority.actor.actorType).toBe('SERVICE');
  });

  it('6. rejects an arbitrary actor type', () => {
    expectBridgeError(() =>
      validateBootstrapBoundaryBridgeAuthorityV1({
        ...createBridgeAuthority(),
        actor: {
          actorType: 'ARBITRARY',
          actorId: 'actor-1',
        },
      })
    );
  });

  it('7. preserves consumerId', () => {
    expect(
      validateBootstrapBoundaryBridgeAuthorityV1(
        createBridgeAuthority()
      ).consumerId
    ).toBe('consumer-1');
  });

  it('8. preserves source', () => {
    expect(
      validateBootstrapBoundaryBridgeAuthorityV1(
        createBridgeAuthority()
      ).source
    ).toBe('trusted-adapter');
  });

  it('9. preserves requestId', () => {
    expect(
      validateBootstrapBoundaryBridgeAuthorityV1(
        createBridgeAuthority()
      ).requestId
    ).toBe('request-1');
  });

  it('10. preserves correlationId', () => {
    expect(
      validateBootstrapBoundaryBridgeAuthorityV1(
        createBridgeAuthority()
      ).correlationId
    ).toBe('correlation-1');
  });

  it('11. preserves executionMode', () => {
    expect(
      validateBootstrapBoundaryBridgeAuthorityV1(
        createBridgeAuthority()
      ).executionMode
    ).toBe('SHADOW_ONLY');
  });

  it('12. preserves authorizationPolicyVersion', () => {
    expect(
      validateBootstrapBoundaryBridgeAuthorityV1(
        createBridgeAuthority()
      ).authorizationPolicyVersion
    ).toBe('policy:v1:bridge');
  });

  it('13. preserves initiatedAt', () => {
    expect(
      validateBootstrapBoundaryBridgeAuthorityV1(
        createBridgeAuthority()
      ).initiatedAt
    ).toBe(INITIATED_AT);
  });

  it('14. preserves authoritativeDeadlineAt', () => {
    expect(
      validateBootstrapBoundaryBridgeAuthorityV1(
        createBridgeAuthority()
      ).authoritativeDeadlineAt
    ).toBe(DEADLINE_AT);
  });

  it('15. rejects a deadline before initiatedAt', () => {
    expectBridgeError(() =>
      validateBootstrapBoundaryBridgeAuthorityV1(
        createBridgeAuthority('HUMAN', {
          authoritativeDeadlineAt:
            '2026-07-28T11:59:59.999Z',
        })
      )
    );
  });

  it('16. clones authority', () => {
    const input = createBridgeAuthority();
    const output =
      validateBootstrapBoundaryBridgeAuthorityV1(input);

    expect(output).not.toBe(input);
    expect(output.actor).not.toBe(input.actor);
  });

  it('17. freezes authority and actor', () => {
    const authority =
      validateBootstrapBoundaryBridgeAuthorityV1(
        createBridgeAuthority()
      );

    expect(Object.isFrozen(authority)).toBe(true);
    expect(Object.isFrozen(authority.actor)).toBe(true);
  });

  it('18. isolates authority from later caller mutation', () => {
    const input = {
      ...createBridgeAuthority(),
      actor: { actorType: 'HUMAN' as const, actorId: 'actor-1' },
    };
    const authority =
      validateBootstrapBoundaryBridgeAuthorityV1(input);

    input.tenantId = 'mutated-tenant';
    input.actor.actorId = 'mutated-actor';

    expect(authority.tenantId).toBe('tenant-1');
    expect(authority.actor.actorId).toBe('actor-1');
  });

  it('19. keeps business payload separate from authority', () => {
    const envelope = createBootstrapBoundaryBridgeEnvelopeV1(
      createBridgeAuthority(),
      { fact: { value: 'HOSPITALITY' } }
    );

    expect(envelope.authority.tenantId).toBe('tenant-1');
    expect(envelope.businessPayload).toEqual({
      fact: { value: 'HOSPITALITY' },
    });
    expect(envelope.businessPayload).not.toBe(envelope.authority);
  });

  it('20. rejects payload authority instead of replacing tenant', () => {
    expectBridgeError(() =>
      createBootstrapBoundaryBridgeEnvelopeV1(
        createBridgeAuthority(),
        { tenantId: 'payload-tenant', fact: 'value' }
      )
    );
  });

  it('21. rejects metadata as an alternate authority channel', () => {
    expectBridgeError(() =>
      validateBootstrapBoundaryBridgeEnvelopeV1({
        schemaVersion: '1',
        authority: createBridgeAuthority(),
        businessPayload: { fact: 'value' },
        metadata: { tenantId: 'metadata-tenant' },
      })
    );
  });

  it('22. preserves AbortSignal identity', () => {
    const controller = new AbortController();
    const envelope = createBootstrapBoundaryBridgeEnvelopeV1(
      createBridgeAuthority(),
      { fact: 'value' },
      controller.signal
    );

    expect(envelope.cancellationSignal).toBe(controller.signal);
  });

  it('23. never freezes the native AbortSignal', () => {
    const controller = new AbortController();
    const envelope = createBootstrapBoundaryBridgeEnvelopeV1(
      createBridgeAuthority(),
      { fact: 'value' },
      controller.signal
    );

    expect(Object.isFrozen(envelope)).toBe(true);
    expect(Object.isFrozen(envelope.cancellationSignal)).toBe(false);
  });

  it('24. accepted result preserves the accepted Bootstrap state', () => {
    const state = createAcceptedState();
    const result = createBootstrapBoundaryBridgeResultV1(
      createBridgeAuthority(),
      state,
      createPolicy()
    );

    expect(result.bridgeStatus).toBe('ACCEPTED');
    expect(result.bootstrapState).toEqual(state);
  });

  it('25. rejected result preserves the rejected Bootstrap state', () => {
    const state = createRejectedState();
    const result = createBootstrapBoundaryBridgeResultV1(
      createBridgeAuthority(),
      state,
      createPolicy()
    );

    expect(result.bridgeStatus).toBe('REJECTED');
    expect(result.bootstrapState).toEqual(state);
  });

  it('26. rejects a bridge status that contradicts Bootstrap state', () => {
    expectBridgeError(() =>
      validateBootstrapBoundaryBridgeResultV1(
        {
          schemaVersion: '1',
          bridgeStatus: 'ACCEPTED',
          authority: createBridgeAuthority(),
          bootstrapState: createRejectedState(),
        },
        createPolicy()
      )
    );
  });

  it('27. contains no cast to InternalExecutionResult', () => {
    expect(bridgeSourceText).not.toMatch(
      /as\s+(?:unknown\s+as\s+)?InternalExecutionResult/
    );
    expect(bridgeSourceText).not.toContain(
      'implements BoundaryExecutionPort'
    );
  });

  it('28. never imports or executes PipelineBootstrapper', () => {
    expect(bridgeSourceText).not.toContain(
      'PipelineBootstrapper'
    );
    expect(bridgeSourceText).not.toMatch(/\.bootstrap\s*\(/);
  });

  it('29. never imports or calls Orchestrator', () => {
    expect(bridgeSourceText).not.toContain(
      'AuraIntelligenceOrchestrator'
    );
    expect(bridgeSourceText).not.toContain('executePipeline');
  });

  it('30. never imports or constructs checkpoints', () => {
    expect(bridgeSourceText).not.toMatch(
      /Checkpoint|checkpointMapper|precomputedCheckpoint/
    );
  });

  it('31. has no Firebase imports', () => {
    const token = ['fire', 'base'].join('');
    expect(bridgeSourceText).not.toMatch(
      new RegExp(`from\\s+['"][^'"]*${token}`, 'i')
    );
  });

  it('32. has no React imports', () => {
    expect(bridgeSourceText).not.toMatch(
      /from\s+['"]react|\/components\/|\/ui\//
    );
  });

  it('33. uses no ambient IDs, timestamps or randomness', () => {
    expect(bridgeSourceText).not.toMatch(/Date\.now\s*\(/);
    expect(bridgeSourceText).not.toMatch(/new Date\s*\(\s*\)/);
    expect(bridgeSourceText).not.toMatch(/Math\.random\s*\(/);
    expect(bridgeSourceText).not.toMatch(/randomUUID\s*\(/);
  });

  it('34. exposes only the bridge module through the OS barrel', () => {
    expect(osIndexSourceText).toContain(
      "export * from './bootstrapBoundaryBridge';"
    );
    expect(bridgeSourceText).toContain(
      "export * from './types';"
    );
    expect(bridgeSourceText).toContain(
      "export * from './errors';"
    );
    expect(bridgeSourceText).toContain(
      "export * from './validators';"
    );
  });

  it('35. rejects a non-AbortSignal cancellation value', () => {
    expectBridgeError(() =>
      createBootstrapBoundaryBridgeEnvelopeV1(
        createBridgeAuthority(),
        { fact: 'value' },
        { aborted: false }
      )
    );
  });

  it('36. rejects payloads that cannot be safely cloned', () => {
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;

    expectBridgeError(() =>
      createBootstrapBoundaryBridgeEnvelopeV1(
        createBridgeAuthority(),
        cyclic
      )
    );
  });

  it('37. rejects an invalid accepted Bootstrap state', () => {
    expectBridgeError(() =>
      createBootstrapBoundaryBridgeResultV1(
        createBridgeAuthority(),
        {
          ...createAcceptedState(),
          initialDomainState: undefined,
        },
        createPolicy()
      )
    );
  });

  it('38. rejects Bootstrap state from another tenant', () => {
    expectBridgeError(() =>
      createBootstrapBoundaryBridgeResultV1(
        createBridgeAuthority(),
        {
          ...createRejectedState(),
          tenantId: 'other-tenant',
        },
        createPolicy()
      )
    );
  });

  it('39. preserves SYSTEM because Boundary defines it canonically', () => {
    const authority =
      createBootstrapBoundaryBridgeAuthorityV1(
        createAuthoritativeContext('SYSTEM')
      );

    expect(authority.actor.actorType).toBe('SYSTEM');
    expect(BOOTSTRAP_BOUNDARY_BRIDGE_ACTOR_TYPES).toEqual([
      'HUMAN',
      'SERVICE',
      'SYSTEM',
    ]);
  });

  it('40. preserves the exact authoritative deadline from H0B.1', () => {
    const context = createAuthoritativeContext();
    const authority =
      createBootstrapBoundaryBridgeAuthorityV1(context);

    expect(authority.authoritativeDeadlineAt).toBe(
      context.authoritativeDeadlineAt
    );
  });

  it('41. exposes a stable safe rejected public error', () => {
    const result = createBootstrapBoundaryBridgeResultV1(
      createBridgeAuthority(),
      createRejectedState(),
      createPolicy()
    );

    expect(result).toMatchObject({
      bridgeStatus: 'REJECTED',
      publicError: {
        code: 'BOOTSTRAP_REJECTED',
        message: 'Bootstrap request was rejected',
        retryable: false,
      },
    });
  });

  it('42. clones and freezes Bootstrap state in the result', () => {
    const state = createRejectedState();
    const result = createBootstrapBoundaryBridgeResultV1(
      createBridgeAuthority(),
      state,
      createPolicy()
    );

    expect(result.bootstrapState).not.toBe(state);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.bootstrapState)).toBe(true);
  });

  it('43. defines no metadata field in the bridge envelope', () => {
    const envelope = createBootstrapBoundaryBridgeEnvelopeV1(
      createBridgeAuthority(),
      { fact: 'value' }
    );

    expect('metadata' in envelope).toBe(false);
  });

  it('44. keeps bridge errors free of authority details', () => {
    const error = expectBridgeError(() =>
      validateBootstrapBoundaryBridgeAuthorityV1(
        createBridgeAuthority('HUMAN', {
          tenantId: 'tenant-secret-value!',
        })
      )
    );

    expect(error.message).not.toContain('tenant-secret-value');
    expect(error.metadata).toEqual({
      bootstrapBoundaryBridgeIssue:
        'BRIDGE_AUTHORITY_INVALID',
    });
  });
});
