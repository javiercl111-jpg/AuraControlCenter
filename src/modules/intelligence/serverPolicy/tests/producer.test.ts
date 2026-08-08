import { describe, expect, it } from 'vitest';
import type {
  AuthoritativeFeaturePolicyPort,
} from '../../os/boundary/ports';
import {
  AUTHORITATIVE_BOUNDARY_POLICY_SCHEMA_VERSION,
  type AuthoritativeBoundaryPolicyDecisionV1,
  type AuthoritativeBoundaryPolicyQueryV1,
} from '../../os/boundary/types';
import {
  BoundaryPolicyContractError,
} from '../../os/boundary/errors';
import {
  TRUSTED_COMPOSITION_REGISTRY_VERSION,
} from '../../serverComposition/registry';
import {
  InMemoryAuthoritativeFeaturePolicyProducer,
} from '../InMemoryAuthoritativeFeaturePolicyProducer';
import {
  AuthoritativePolicySnapshotContractError,
} from '../errors';
import {
  AUTHORITATIVE_POLICY_TEST_SNAPSHOT_V1,
} from '../table';
import {
  AUTHORITATIVE_POLICY_ENTRY_VERSION,
  AUTHORITATIVE_POLICY_PRODUCER_VERSION,
  AUTHORITATIVE_POLICY_SNAPSHOT_SCHEMA_VERSION,
  AUTHORITATIVE_POLICY_TEST_AUTHORIZATION_VERSION,
} from '../types';

function policyEntry(
  overrides: Readonly<Record<string, unknown>> = {}
): Record<string, unknown> {
  return {
    entryVersion: AUTHORITATIVE_POLICY_ENTRY_VERSION,
    policyId: 'policy-contract-test-shadow',
    enabled: true,
    tenantId: 'tenant-policy-contract-test',
    actorType: 'SYSTEM',
    actorId: 'actor-policy-contract-test',
    consumerId: 'INTELLIGENCE_OS_CONTRACT_TEST',
    source: 'TRUSTED_COMPOSITION_CONTRACT_TEST',
    requestedMode: 'SHADOW_ONLY',
    effectiveExecutionMode: 'SHADOW_ONLY',
    effectiveTimeoutMs: 30_000,
    authorizationPolicyVersion:
      AUTHORITATIVE_POLICY_TEST_AUTHORIZATION_VERSION,
    ...overrides,
  };
}

function snapshotInput(
  overrides: Readonly<Record<string, unknown>> = {}
): Record<string, unknown> {
  return {
    schemaVersion: AUTHORITATIVE_POLICY_SNAPSHOT_SCHEMA_VERSION,
    producerVersion: AUTHORITATIVE_POLICY_PRODUCER_VERSION,
    authorizationPolicyVersion:
      AUTHORITATIVE_POLICY_TEST_AUTHORIZATION_VERSION,
    trustedRegistryVersion: TRUSTED_COMPOSITION_REGISTRY_VERSION,
    entries: [policyEntry()],
    ...overrides,
  };
}

function policyQuery(
  overrides: Partial<AuthoritativeBoundaryPolicyQueryV1> = {}
): AuthoritativeBoundaryPolicyQueryV1 {
  return {
    schemaVersion: AUTHORITATIVE_BOUNDARY_POLICY_SCHEMA_VERSION,
    tenantId: 'tenant-policy-contract-test',
    actor: {
      actorType: 'SYSTEM',
      actorId: 'actor-policy-contract-test',
    },
    consumerId: 'INTELLIGENCE_OS_CONTRACT_TEST',
    source: 'TRUSTED_COMPOSITION_CONTRACT_TEST',
    requestedMode: 'SHADOW_ONLY',
    ...overrides,
  };
}

async function decisionFor(
  producer: InMemoryAuthoritativeFeaturePolicyProducer,
  query: AuthoritativeBoundaryPolicyQueryV1
): Promise<AuthoritativeBoundaryPolicyDecisionV1> {
  return producer.evaluateAuthoritativePolicy(query);
}

describe('AI-02H1D.3 in-memory authoritative policy producer', () => {
  it('1. constructs from a valid certified snapshot and implements the port', () => {
    const producer = new InMemoryAuthoritativeFeaturePolicyProducer(
      AUTHORITATIVE_POLICY_TEST_SNAPSHOT_V1
    );
    const port: AuthoritativeFeaturePolicyPort = producer;

    expect(port).toBe(producer);
    expect(Object.isFrozen(producer)).toBe(true);
  });

  it('2. rejects an invalid snapshot during construction', () => {
    expect(
      () =>
        new InMemoryAuthoritativeFeaturePolicyProducer(
          snapshotInput({ schemaVersion: '2' })
        )
    ).toThrow(AuthoritativePolicySnapshotContractError);
  });

  it('3. isolates the producer from later caller mutation', async () => {
    const entry = policyEntry();
    const snapshot = snapshotInput({ entries: [entry] });
    const producer =
      new InMemoryAuthoritativeFeaturePolicyProducer(snapshot);

    entry.tenantId = 'mutated-tenant';
    snapshot.authorizationPolicyVersion = 'mutated-version';

    expect(await decisionFor(producer, policyQuery())).toMatchObject({
      decision: 'ALLOWED',
      authorizationPolicyVersion:
        AUTHORITATIVE_POLICY_TEST_AUTHORIZATION_VERSION,
    });
  });

  it('4. allows an exact valid query', async () => {
    const decision = await decisionFor(
      new InMemoryAuthoritativeFeaturePolicyProducer(
        AUTHORITATIVE_POLICY_TEST_SNAPSHOT_V1
      ),
      policyQuery()
    );

    expect(decision).toMatchObject({
      decision: 'ALLOWED',
      reasonCode: 'POLICY_ALLOWED',
    });
  });

  it('5. denies an unknown tenant', async () => {
    const decision = await decisionFor(
      new InMemoryAuthoritativeFeaturePolicyProducer(
        AUTHORITATIVE_POLICY_TEST_SNAPSHOT_V1
      ),
      policyQuery({ tenantId: 'unknown-tenant' })
    );

    expect(decision).toMatchObject({
      decision: 'DENIED',
      reasonCode: 'TENANT_NOT_ALLOWED',
    });
  });

  it('6. denies an unmatched valid actor type', async () => {
    const decision = await decisionFor(
      new InMemoryAuthoritativeFeaturePolicyProducer(
        AUTHORITATIVE_POLICY_TEST_SNAPSHOT_V1
      ),
      policyQuery({
        actor: {
          actorType: 'USER',
          actorId: 'actor-policy-contract-test',
        },
      })
    );

    expect(decision).toMatchObject({
      decision: 'DENIED',
      reasonCode: 'ACTOR_NOT_ALLOWED',
    });
  });

  it('7. denies an unknown actor identifier', async () => {
    const decision = await decisionFor(
      new InMemoryAuthoritativeFeaturePolicyProducer(
        AUTHORITATIVE_POLICY_TEST_SNAPSHOT_V1
      ),
      policyQuery({
        actor: {
          actorType: 'SYSTEM',
          actorId: 'unknown-actor',
        },
      })
    );

    expect(decision).toMatchObject({
      decision: 'DENIED',
      reasonCode: 'ACTOR_NOT_ALLOWED',
    });
  });

  it('8. denies an unknown consumer', async () => {
    const decision = await decisionFor(
      new InMemoryAuthoritativeFeaturePolicyProducer(
        AUTHORITATIVE_POLICY_TEST_SNAPSHOT_V1
      ),
      policyQuery({ consumerId: 'UNKNOWN_CONSUMER' })
    );

    expect(decision).toMatchObject({
      decision: 'DENIED',
      reasonCode: 'CONSUMER_NOT_ALLOWED',
    });
  });

  it('9. denies an unknown source', async () => {
    const decision = await decisionFor(
      new InMemoryAuthoritativeFeaturePolicyProducer(
        AUTHORITATIVE_POLICY_TEST_SNAPSHOT_V1
      ),
      policyQuery({ source: 'UNKNOWN_SOURCE' })
    );

    expect(decision).toMatchObject({
      decision: 'DENIED',
      reasonCode: 'SOURCE_NOT_ALLOWED',
    });
  });

  for (const requestedMode of [
    'PRODUCTIVE',
    'DISABLED',
  ] as const) {
    it(`denies ${requestedMode} before authority lookup`, async () => {
      const decision = await decisionFor(
        new InMemoryAuthoritativeFeaturePolicyProducer(
          AUTHORITATIVE_POLICY_TEST_SNAPSHOT_V1
        ),
        policyQuery({
          tenantId: 'unknown-tenant',
          requestedMode,
        })
      );

      expect(decision).toMatchObject({
        decision: 'DENIED',
        reasonCode: 'MODE_NOT_ALLOWED',
      });
    });
  }

  it('13. denies a missing exact policy after known dimensions', async () => {
    const entries = [
      policyEntry({
        policyId: 'policy-tenant-a',
        tenantId: 'tenant-a',
        actorId: 'actor-a',
      }),
      policyEntry({
        policyId: 'policy-tenant-b',
        tenantId: 'tenant-b',
        actorId: 'actor-b',
      }),
    ];
    const producer = new InMemoryAuthoritativeFeaturePolicyProducer(
      snapshotInput({ entries })
    );
    const decision = await decisionFor(
      producer,
      policyQuery({
        tenantId: 'tenant-a',
        actor: { actorType: 'SYSTEM', actorId: 'actor-b' },
      })
    );

    expect(decision).toMatchObject({
      decision: 'DENIED',
      reasonCode: 'POLICY_NOT_FOUND',
    });
  });

  it('14. denies a disabled exact policy', async () => {
    const producer = new InMemoryAuthoritativeFeaturePolicyProducer(
      snapshotInput({
        entries: [policyEntry({ enabled: false })],
      })
    );

    expect(await decisionFor(producer, policyQuery())).toMatchObject({
      decision: 'DENIED',
      reasonCode: 'POLICY_DISABLED',
    });
  });

  it('15. denies a structurally valid but unsupported authorization version', async () => {
    const futureVersion = 'policy-snapshot-contract-test-2';
    const producer = new InMemoryAuthoritativeFeaturePolicyProducer(
      snapshotInput({
        authorizationPolicyVersion: futureVersion,
        entries: [
          policyEntry({
            authorizationPolicyVersion: futureVersion,
          }),
        ],
      })
    );

    expect(await decisionFor(producer, policyQuery())).toMatchObject({
      decision: 'DENIED',
      reasonCode: 'POLICY_VERSION_UNSUPPORTED',
      authorizationPolicyVersion: futureVersion,
    });
  });

  it('16. preserves the exact query context in an allowed decision', async () => {
    const query = policyQuery();
    const decision = await decisionFor(
      new InMemoryAuthoritativeFeaturePolicyProducer(
        AUTHORITATIVE_POLICY_TEST_SNAPSHOT_V1
      ),
      query
    );

    expect(decision).toMatchObject({
      evaluatedTenantId: query.tenantId,
      evaluatedActor: query.actor,
      evaluatedConsumerId: query.consumerId,
      evaluatedSource: query.source,
      requestedMode: query.requestedMode,
    });
    expect(decision.evaluatedActor).not.toBe(query.actor);
  });

  it('17. preserves the exact query context in a denied decision', async () => {
    const query = policyQuery({ tenantId: 'unknown-tenant' });
    const decision = await decisionFor(
      new InMemoryAuthoritativeFeaturePolicyProducer(
        AUTHORITATIVE_POLICY_TEST_SNAPSHOT_V1
      ),
      query
    );

    expect(decision).toMatchObject({
      evaluatedTenantId: query.tenantId,
      evaluatedActor: query.actor,
      evaluatedConsumerId: query.consumerId,
      evaluatedSource: query.source,
      requestedMode: query.requestedMode,
    });
  });

  it('18. returns SHADOW_ONLY as the exact effective mode', async () => {
    const decision = await decisionFor(
      new InMemoryAuthoritativeFeaturePolicyProducer(
        AUTHORITATIVE_POLICY_TEST_SNAPSHOT_V1
      ),
      policyQuery()
    );

    expect(decision.decision).toBe('ALLOWED');
    if (decision.decision === 'ALLOWED') {
      expect(decision.effectiveExecutionMode).toBe('SHADOW_ONLY');
    }
  });

  it('19. returns the explicit entry timeout', async () => {
    const decision = await decisionFor(
      new InMemoryAuthoritativeFeaturePolicyProducer(
        AUTHORITATIVE_POLICY_TEST_SNAPSHOT_V1
      ),
      policyQuery()
    );

    expect(decision.decision).toBe('ALLOWED');
    if (decision.decision === 'ALLOWED') {
      expect(decision.effectiveTimeoutMs).toBe(30_000);
    }
  });

  it('20. returns the certified authorization policy version', async () => {
    expect(
      (
        await decisionFor(
          new InMemoryAuthoritativeFeaturePolicyProducer(
            AUTHORITATIVE_POLICY_TEST_SNAPSHOT_V1
          ),
          policyQuery()
        )
      ).authorizationPolicyVersion
    ).toBe(AUTHORITATIVE_POLICY_TEST_AUTHORIZATION_VERSION);
  });

  it('21. always returns undefined from the legacy method', async () => {
    const producer = new InMemoryAuthoritativeFeaturePolicyProducer(
      AUTHORITATIVE_POLICY_TEST_SNAPSHOT_V1
    );

    await expect(
      producer.getEffectivePolicy(
        'tenant-policy-contract-test',
        'TRUSTED_COMPOSITION_CONTRACT_TEST'
      )
    ).resolves.toBeUndefined();
  });

  it('22. legacy evaluation remains unaffected by caller snapshot mutation', async () => {
    const entry = policyEntry();
    const snapshot = snapshotInput({ entries: [entry] });
    const producer =
      new InMemoryAuthoritativeFeaturePolicyProducer(snapshot);

    entry.enabled = false;
    snapshot.entries = [];

    await expect(
      producer.getEffectivePolicy('arbitrary-tenant', 'arbitrary-source')
    ).resolves.toBeUndefined();
  });

  it('23. never falls back from an unknown binding', async () => {
    const decision = await decisionFor(
      new InMemoryAuthoritativeFeaturePolicyProducer(
        AUTHORITATIVE_POLICY_TEST_SNAPSHOT_V1
      ),
      policyQuery({ tenantId: 'fallback-tenant' })
    );

    expect(decision.decision).toBe('DENIED');
  });

  it('24. rejects wildcard authority through query validation', async () => {
    const producer = new InMemoryAuthoritativeFeaturePolicyProducer(
      AUTHORITATIVE_POLICY_TEST_SNAPSHOT_V1
    );

    await expect(
      decisionFor(producer, policyQuery({ tenantId: '*' }))
    ).rejects.toBeInstanceOf(BoundaryPolicyContractError);
  });

  it('25. returns deeply frozen decisions', async () => {
    const decision = await decisionFor(
      new InMemoryAuthoritativeFeaturePolicyProducer(
        AUTHORITATIVE_POLICY_TEST_SNAPSHOT_V1
      ),
      policyQuery()
    );

    expect(Object.isFrozen(decision)).toBe(true);
    expect(Object.isFrozen(decision.evaluatedActor)).toBe(true);
  });

  it('26. prevents decision mutation', async () => {
    const decision = await decisionFor(
      new InMemoryAuthoritativeFeaturePolicyProducer(
        AUTHORITATIVE_POLICY_TEST_SNAPSHOT_V1
      ),
      policyQuery()
    );

    expect(
      Reflect.set(decision, 'reasonCode', 'POLICY_DISABLED')
    ).toBe(false);
    expect(decision.reasonCode).toBe('POLICY_ALLOWED');
  });

  it('27. returns deterministic results across repeated calls', async () => {
    const producer = new InMemoryAuthoritativeFeaturePolicyProducer(
      AUTHORITATIVE_POLICY_TEST_SNAPSHOT_V1
    );

    expect(await decisionFor(producer, policyQuery())).toEqual(
      await decisionFor(producer, policyQuery())
    );
  });

  it('28. returns identical results from equivalent producers', async () => {
    const first = new InMemoryAuthoritativeFeaturePolicyProducer(
      AUTHORITATIVE_POLICY_TEST_SNAPSHOT_V1
    );
    const second = new InMemoryAuthoritativeFeaturePolicyProducer(
      AUTHORITATIVE_POLICY_TEST_SNAPSHOT_V1
    );

    expect(await decisionFor(first, policyQuery())).toEqual(
      await decisionFor(second, policyQuery())
    );
  });

  it('29. remains independent of caller entry order', async () => {
    const firstEntry = policyEntry({
      policyId: 'policy-first',
      tenantId: 'tenant-first',
      actorId: 'actor-first',
    });
    const targetEntry = policyEntry({
      policyId: 'policy-target',
      tenantId: 'tenant-target',
      actorId: 'actor-target',
    });
    const forward = new InMemoryAuthoritativeFeaturePolicyProducer(
      snapshotInput({ entries: [firstEntry, targetEntry] })
    );
    const reverse = new InMemoryAuthoritativeFeaturePolicyProducer(
      snapshotInput({ entries: [targetEntry, firstEntry] })
    );
    const query = policyQuery({
      tenantId: 'tenant-target',
      actor: { actorType: 'SYSTEM', actorId: 'actor-target' },
    });

    expect(await decisionFor(forward, query)).toEqual(
      await decisionFor(reverse, query)
    );
  });

  it('30. rejects an invalid query with the Boundary contract error', async () => {
    const producer = new InMemoryAuthoritativeFeaturePolicyProducer(
      AUTHORITATIVE_POLICY_TEST_SNAPSHOT_V1
    );
    const evaluate = producer.evaluateAuthoritativePolicy.bind(
      producer
    ) as (
      value: unknown
    ) => Promise<AuthoritativeBoundaryPolicyDecisionV1>;

    await expect(evaluate(null)).rejects.toBeInstanceOf(
      BoundaryPolicyContractError
    );
  });

  it('31. gives disabled policy precedence over unsupported version', async () => {
    const futureVersion = 'policy-snapshot-contract-test-2';
    const producer = new InMemoryAuthoritativeFeaturePolicyProducer(
      snapshotInput({
        authorizationPolicyVersion: futureVersion,
        entries: [
          policyEntry({
            enabled: false,
            authorizationPolicyVersion: futureVersion,
          }),
        ],
      })
    );

    expect(await decisionFor(producer, policyQuery())).toMatchObject({
      reasonCode: 'POLICY_DISABLED',
    });
  });

  it('32. gives actor denial precedence over unknown consumer and source', async () => {
    const producer = new InMemoryAuthoritativeFeaturePolicyProducer(
      AUTHORITATIVE_POLICY_TEST_SNAPSHOT_V1
    );
    const decision = await decisionFor(
      producer,
      policyQuery({
        actor: { actorType: 'SERVICE', actorId: 'unknown-actor' },
        consumerId: 'UNKNOWN_CONSUMER',
        source: 'UNKNOWN_SOURCE',
      })
    );

    expect(decision.reasonCode).toBe('ACTOR_NOT_ALLOWED');
  });

  it('33. gives consumer denial precedence over unknown source', async () => {
    const producer = new InMemoryAuthoritativeFeaturePolicyProducer(
      AUTHORITATIVE_POLICY_TEST_SNAPSHOT_V1
    );
    const decision = await decisionFor(
      producer,
      policyQuery({
        consumerId: 'UNKNOWN_CONSUMER',
        source: 'UNKNOWN_SOURCE',
      })
    );

    expect(decision.reasonCode).toBe('CONSUMER_NOT_ALLOWED');
  });
});
