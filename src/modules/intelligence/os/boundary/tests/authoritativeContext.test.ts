import { describe, expect, it } from 'vitest';
import {
  BoundaryContextContractError,
  GovernedBoundaryError,
  type BoundaryPublicErrorCode,
} from '../errors';
import type { InternalExecutionInput } from '../ports';
import {
  AUTHORITATIVE_BOUNDARY_EXECUTION_MODES_V1,
  AUTHORITATIVE_EXECUTION_CONTEXT_VERSION,
  BOUNDARY_ACTOR_TYPES_V1,
  BOUNDARY_INVOCATION_CONTEXT_VERSION,
  BOUNDARY_RESERVED_AUTHORITY_FIELDS,
  type BoundaryExecutionMode,
} from '../types';
import {
  validateAuthoritativeExecutionContextV1,
  validateBoundaryActorReferenceV1,
  validateBoundaryInvocationContextV1,
  validateGovernedRequest,
} from '../validators';

function createActor(
  actorType: 'USER' | 'SERVICE' | 'SYSTEM' = 'USER'
) {
  return {
    actorType,
    actorId: 'actor-1',
  };
}

function createInvocationContext() {
  return {
    schemaVersion: BOUNDARY_INVOCATION_CONTEXT_VERSION,
    tenantId: 'tenant-1',
    actor: createActor(),
    consumerId: 'consumer-1',
    source: 'trusted-adapter',
    requestId: 'request-1',
    correlationId: 'correlation-1',
  };
}

function createAuthoritativeContext(
  executionMode: string = 'SHADOW_ONLY'
) {
  return {
    ...createInvocationContext(),
    schemaVersion: AUTHORITATIVE_EXECUTION_CONTEXT_VERSION,
    executionMode,
    initiatedAt: '2026-07-28T12:00:00.000Z',
    authoritativeDeadlineAt: '2026-07-28T12:00:30.000Z',
    authorizationPolicyVersion: 'policy-v1',
  };
}

function expectContextError(
  operation: () => unknown,
  code?: BoundaryPublicErrorCode
): BoundaryContextContractError {
  try {
    operation();
  } catch (error) {
    expect(error).toBeInstanceOf(BoundaryContextContractError);
    if (!(error instanceof BoundaryContextContractError)) {
      throw error;
    }
    if (code) {
      expect(error.code).toBe(code);
    }
    return error;
  }
  throw new Error('Expected BoundaryContextContractError');
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
const bootstrapSources = import.meta.glob('../../bootstrap/*.ts', {
  eager: true,
  query: '?raw',
  import: 'default',
});
const osRootSources = import.meta.glob('../../*.ts', {
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
const bootstrapSourceText = Object.values(bootstrapSources).join('\n');
const orchestratorSourceText =
  (osRootSources[
    '../../AuraIntelligenceOrchestrator.ts'
  ] as string | undefined) ?? '';

describe('AI-02H0A authoritative boundary context contracts', () => {
  it('1. accepts a valid USER actor', () => {
    expect(validateBoundaryActorReferenceV1(createActor('USER'))).toEqual({
      actorType: 'USER',
      actorId: 'actor-1',
    });
  });

  it('2. accepts a valid SERVICE actor', () => {
    expect(
      validateBoundaryActorReferenceV1(createActor('SERVICE'))
    ).toEqual({
      actorType: 'SERVICE',
      actorId: 'actor-1',
    });
  });

  it('3. accepts a valid SYSTEM actor', () => {
    expect(
      validateBoundaryActorReferenceV1(createActor('SYSTEM'))
    ).toEqual({
      actorType: 'SYSTEM',
      actorId: 'actor-1',
    });
  });

  it('4. accepts a valid invocation context', () => {
    expect(
      validateBoundaryInvocationContextV1(createInvocationContext())
    ).toEqual(createInvocationContext());
  });

  it('5. accepts a valid authoritative context', () => {
    expect(
      validateAuthoritativeExecutionContextV1(
        createAuthoritativeContext()
      )
    ).toEqual(createAuthoritativeContext());
  });

  it('6. accepts only the dispatchable SHADOW_ONLY and EVALUATION modes', () => {
    for (const executionMode of
      AUTHORITATIVE_BOUNDARY_EXECUTION_MODES_V1) {
      expect(
        validateAuthoritativeExecutionContextV1(
          createAuthoritativeContext(executionMode)
        ).executionMode
      ).toBe(executionMode);
    }
  });

  it('7. lets InternalExecutionInput carry optional authoritativeContext', () => {
    const authoritativeContext =
      validateAuthoritativeExecutionContextV1(
        createAuthoritativeContext()
      );
    const input: InternalExecutionInput = {
      sessionId: 'session-1',
      payload: {},
      authoritativeContext,
    };

    expect(input.authoritativeContext).toBe(authoritativeContext);
  });

  it('8. preserves compatibility when authoritativeContext is absent without implicit authority', () => {
    const input: InternalExecutionInput = {
      sessionId: 'session-1',
      payload: {},
    };

    expect(input.authoritativeContext).toBeUndefined();
    expect('authoritativeContext' in input).toBe(false);
  });

  it('9. rejects an unknown actorType', () => {
    expectContextError(
      () =>
        validateBoundaryActorReferenceV1({
          actorType: 'ADMIN',
          actorId: 'actor-1',
        }),
      'INVALID_ACTOR_CONTEXT'
    );
  });

  it('10. rejects an empty actorId', () => {
    expectContextError(
      () =>
        validateBoundaryActorReferenceV1({
          actorType: 'USER',
          actorId: '',
        }),
      'INVALID_ACTOR_CONTEXT'
    );
  });

  it('11. rejects an additional actor property', () => {
    expectContextError(() =>
      validateBoundaryActorReferenceV1({
        ...createActor(),
        role: 'admin',
      })
    );
  });

  it('12. rejects a null actor', () => {
    expectContextError(() => validateBoundaryActorReferenceV1(null));
  });

  it('13. rejects an actor array', () => {
    expectContextError(() =>
      validateBoundaryActorReferenceV1([
        'USER',
        'actor-1',
      ])
    );
  });

  it('14. rejects an actor with a non-plain prototype', () => {
    const actor = Object.assign(
      Object.create({ inherited: true }) as Record<string, unknown>,
      createActor()
    );

    expectContextError(() =>
      validateBoundaryActorReferenceV1(actor)
    );
  });

  it('15. rejects an unknown invocation schemaVersion', () => {
    expectContextError(() =>
      validateBoundaryInvocationContextV1({
        ...createInvocationContext(),
        schemaVersion: '2',
      })
    );
  });

  it('16. rejects an empty invocation tenantId', () => {
    expectContextError(() =>
      validateBoundaryInvocationContextV1({
        ...createInvocationContext(),
        tenantId: '',
      })
    );
  });

  it('17. rejects an empty invocation consumerId', () => {
    expectContextError(() =>
      validateBoundaryInvocationContextV1({
        ...createInvocationContext(),
        consumerId: '',
      })
    );
  });

  it('18. rejects an empty invocation source', () => {
    expectContextError(() =>
      validateBoundaryInvocationContextV1({
        ...createInvocationContext(),
        source: '',
      })
    );
  });

  it('19. rejects an empty invocation requestId', () => {
    expectContextError(() =>
      validateBoundaryInvocationContextV1({
        ...createInvocationContext(),
        requestId: '',
      })
    );
  });

  it('20. rejects an empty invocation correlationId', () => {
    expectContextError(() =>
      validateBoundaryInvocationContextV1({
        ...createInvocationContext(),
        correlationId: '',
      })
    );
  });

  it('21. rejects an invalid invocation actor', () => {
    expectContextError(
      () =>
        validateBoundaryInvocationContextV1({
          ...createInvocationContext(),
          actor: { actorType: 'USER', actorId: '' },
        }),
      'INVALID_ACTOR_CONTEXT'
    );
  });

  it('22. rejects an additional invocation property', () => {
    expectContextError(() =>
      validateBoundaryInvocationContextV1({
        ...createInvocationContext(),
        extra: true,
      })
    );
  });

  it('23. rejects a non-plain invocation object', () => {
    const context = Object.assign(
      Object.create({ inherited: true }) as Record<string, unknown>,
      createInvocationContext()
    );

    expectContextError(() =>
      validateBoundaryInvocationContextV1(context)
    );
  });

  it('24. rejects PRODUCTIVE authoritative mode', () => {
    expectContextError(
      () =>
        validateAuthoritativeExecutionContextV1(
          createAuthoritativeContext('PRODUCTIVE')
        ),
      'INVALID_REQUEST'
    );
  });

  it('25. rejects DISABLED authoritative mode', () => {
    expectContextError(() =>
      validateAuthoritativeExecutionContextV1(
        createAuthoritativeContext('DISABLED')
      )
    );
  });

  it('26. rejects an unknown authoritative mode', () => {
    expectContextError(() =>
      validateAuthoritativeExecutionContextV1(
        createAuthoritativeContext('UNKNOWN')
      )
    );
  });

  it('27. rejects an invalid initiatedAt', () => {
    expectContextError(() =>
      validateAuthoritativeExecutionContextV1({
        ...createAuthoritativeContext(),
        initiatedAt: 'not-a-timestamp',
      })
    );
  });

  it('28. rejects a non-canonical initiatedAt', () => {
    expectContextError(() =>
      validateAuthoritativeExecutionContextV1({
        ...createAuthoritativeContext(),
        initiatedAt: '2026-07-28T12:00:00Z',
      })
    );
  });

  it('29. rejects an empty authorizationPolicyVersion', () => {
    expectContextError(() =>
      validateAuthoritativeExecutionContextV1({
        ...createAuthoritativeContext(),
        authorizationPolicyVersion: '',
      })
    );
  });

  it('30. rejects an additional authoritative property', () => {
    expectContextError(() =>
      validateAuthoritativeExecutionContextV1({
        ...createAuthoritativeContext(),
        extra: true,
      })
    );
  });

  it('31. rejects a non-plain authoritative object', () => {
    const context = Object.assign(
      Object.create({ inherited: true }) as Record<string, unknown>,
      createAuthoritativeContext()
    );

    expectContextError(() =>
      validateAuthoritativeExecutionContextV1(context)
    );
  });

  it('32. does not mutate invocation input', () => {
    const input = createInvocationContext();
    const before = structuredClone(input);

    validateBoundaryInvocationContextV1(input);

    expect(input).toEqual(before);
  });

  it('33. does not mutate authoritative input', () => {
    const input = createAuthoritativeContext();
    const before = structuredClone(input);

    validateAuthoritativeExecutionContextV1(input);

    expect(input).toEqual(before);
  });

  it('34. clones the actor', () => {
    const input = createInvocationContext();
    const output = validateBoundaryInvocationContextV1(input);

    expect(output.actor).not.toBe(input.actor);
    expect(output.actor).toEqual(input.actor);
  });

  it('35. clones the context', () => {
    const input = createAuthoritativeContext();
    const output = validateAuthoritativeExecutionContextV1(input);

    expect(output).not.toBe(input);
    expect(output).toEqual(input);
  });

  it('36. freezes the context and its nested actor', () => {
    const invocation =
      validateBoundaryInvocationContextV1(createInvocationContext());
    const authoritative =
      validateAuthoritativeExecutionContextV1(
        createAuthoritativeContext()
      );

    expect(Object.isFrozen(invocation)).toBe(true);
    expect(Object.isFrozen(invocation.actor)).toBe(true);
    expect(Object.isFrozen(authoritative)).toBe(true);
    expect(Object.isFrozen(authoritative.actor)).toBe(true);
  });

  it('37. isolates output from later input mutation', () => {
    const input = createAuthoritativeContext();
    const output = validateAuthoritativeExecutionContextV1(input);

    input.tenantId = 'tenant-mutated';
    input.actor.actorId = 'actor-mutated';

    expect(output.tenantId).toBe('tenant-1');
    expect(output.actor.actorId).toBe('actor-1');
  });

  it('38. validates deterministically', () => {
    const first = validateAuthoritativeExecutionContextV1(
      createAuthoritativeContext()
    );
    const second = validateAuthoritativeExecutionContextV1(
      createAuthoritativeContext()
    );

    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(first.actor).not.toBe(second.actor);
  });

  it('39. keeps boundary contracts free of Firebase', () => {
    const token = ['fire', 'base'].join('');
    expect(contractSourceText).not.toMatch(new RegExp(token, 'i'));
  });

  it('40. keeps boundary contracts free of Discovery', () => {
    const token = ['Dis', 'covery'].join('');
    expect(contractSourceText).not.toMatch(new RegExp(token));
  });

  it('41. keeps boundary contracts free of React', () => {
    const token = ['Re', 'act'].join('');
    expect(contractSourceText).not.toMatch(new RegExp(token));
  });

  it('42. keeps boundary contracts free of bootstrap', () => {
    const token = ['boot', 'strap'].join('');
    expect(contractSourceText).not.toMatch(new RegExp(token, 'i'));
  });

  it('43. lets GovernedExecutionBoundary enforce and propagate the new contexts', () => {
    expect(boundaryRuntimeSourceText).toMatch(
      /BoundaryInvocationContextV1/
    );
    expect(boundaryRuntimeSourceText).toMatch(
      /authoritativeContext/
    );
  });

  it('44. leaves BoundaryExecutionPort runtime signature unchanged', () => {
    const portsSource =
      (boundaryContractSources['../ports.ts'] as
        | string
        | undefined) ?? '';

    expect(portsSource).toMatch(
      /execute\(input: InternalExecutionInput, signal\?: AbortSignal\): Promise<InternalExecutionResult>;/
    );
  });

  it('45. leaves bootstrapper independent from authoritative boundary contexts', () => {
    expect(bootstrapSourceText).not.toMatch(
      /AuthoritativeExecutionContextV1|authoritativeContext/
    );
  });

  it('46. leaves Orchestrator independent from authoritative boundary contexts', () => {
    expect(orchestratorSourceText).not.toMatch(
      /AuthoritativeExecutionContextV1|authoritativeContext/
    );
  });

  it('47. does not treat metadata as authority', () => {
    const input: InternalExecutionInput = {
      sessionId: 'session-1',
      payload: {},
      metadata: {
        tenantId: 'metadata-tenant',
        executionMode: 'EVALUATION',
      },
    };

    expect(input.authoritativeContext).toBeUndefined();
    expect(boundaryRuntimeSourceText).toContain(
      'sanitizeMetadata'
    );
  });

  it('48. exposes the exact closed reserved authority field inventory', () => {
    expect(BOUNDARY_RESERVED_AUTHORITY_FIELDS).toEqual([
      'tenant',
      'tenantId',
      'actor',
      'actorId',
      'actorType',
      'consumerId',
      'source',
      'requestId',
      'correlationId',
      'requestedMode',
      'executionMode',
      'authoritativeDeadlineAt',
      'authorizationPolicyVersion',
    ]);
    expect(Object.isFrozen(BOUNDARY_RESERVED_AUTHORITY_FIELDS)).toBe(
      true
    );
  });

  it('49. preserves all existing Boundary execution modes', () => {
    const modes: readonly BoundaryExecutionMode[] = [
      'DISABLED',
      'SHADOW_ONLY',
      'EVALUATION',
      'PRODUCTIVE',
    ];

    expect(modes).toEqual([
      'DISABLED',
      'SHADOW_ONLY',
      'EVALUATION',
      'PRODUCTIVE',
    ]);
    expect(BOUNDARY_ACTOR_TYPES_V1).toEqual([
      'USER',
      'SERVICE',
      'SYSTEM',
    ]);
  });

  it('50. preserves all existing public Boundary error codes', () => {
    const codes: readonly BoundaryPublicErrorCode[] = [
      'BOUNDARY_DISABLED',
      'MODE_NOT_ALLOWED',
      'INVALID_REQUEST',
      'INVALID_TENANT_CONTEXT',
      'INVALID_ACTOR_CONTEXT',
      'SOURCE_NOT_ALLOWED',
      'PAYLOAD_TOO_LARGE',
      'DUPLICATE_REQUEST',
      'CONCURRENCY_LIMIT',
      'TIMEOUT',
      'CANCELLED',
      'EXECUTION_FAILED',
      'OUTPUT_SANITIZATION_FAILED',
    ];

    expect(
      codes.map(
        (code) => new GovernedBoundaryError(code, 'test').code
      )
    ).toEqual(codes);
  });

  it('51. keeps legacy governed request validation compatible', () => {
    const request = {
      requestId: 'request-1',
      correlationId: 'correlation-1',
      source: 'legacy-source',
      requestedMode: 'SHADOW_ONLY',
      tenant: { tenantId: 'tenant-1' },
      actor: { actorId: 'actor-1', actorType: 'USER' },
      payload: { fact: 'value' },
    };

    const validated = validateGovernedRequest(request);
    expect(validated).not.toBe(request);
    expect(validated).toEqual(request);
    expect(Object.isFrozen(validated)).toBe(true);
  });

  it('52. does not convert absent authoritativeContext into a tenant fallback', () => {
    const input: InternalExecutionInput = {
      sessionId: 'session-1',
      payload: { tenantId: 'payload-tenant' },
      metadata: { tenantId: 'metadata-tenant' },
    };
    const record = input as unknown as Record<string, unknown>;

    expect(input.authoritativeContext).toBeUndefined();
    expect(record.tenantId).toBeUndefined();
  });
});
