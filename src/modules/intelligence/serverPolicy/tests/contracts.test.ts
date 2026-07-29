import { describe, expect, it } from 'vitest';
import {
  TRUSTED_COMPOSITION_REGISTRY_VERSION,
} from '../../serverComposition/registry';
import {
  AuthoritativePolicySnapshotContractError,
} from '../errors';
import {
  createAuthoritativePolicySnapshotV1,
} from '../factories';
import {
  createAuthoritativePolicyLookupKeyV1,
} from '../helpers';
import {
  AUTHORITATIVE_POLICY_TEST_SNAPSHOT_V1,
} from '../table';
import {
  AUTHORITATIVE_POLICY_ENTRY_VERSION,
  AUTHORITATIVE_POLICY_MAX_TIMEOUT_MS,
  AUTHORITATIVE_POLICY_PRODUCER_VERSION,
  AUTHORITATIVE_POLICY_SNAPSHOT_SCHEMA_VERSION,
  AUTHORITATIVE_POLICY_TEST_AUTHORIZATION_VERSION,
} from '../types';
import {
  validateAuthoritativePolicyEntryV1,
  validateAuthoritativePolicySnapshotV1,
} from '../validators';

function validEntry(
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
    description: 'Test-only authoritative policy entry',
    ...overrides,
  };
}

function validSnapshot(
  overrides: Readonly<Record<string, unknown>> = {}
): Record<string, unknown> {
  return {
    schemaVersion: AUTHORITATIVE_POLICY_SNAPSHOT_SCHEMA_VERSION,
    producerVersion: AUTHORITATIVE_POLICY_PRODUCER_VERSION,
    authorizationPolicyVersion:
      AUTHORITATIVE_POLICY_TEST_AUTHORIZATION_VERSION,
    trustedRegistryVersion: TRUSTED_COMPOSITION_REGISTRY_VERSION,
    entries: [validEntry()],
    ...overrides,
  };
}

function expectContractError(operation: () => unknown): void {
  expect(operation).toThrow(
    AuthoritativePolicySnapshotContractError
  );
}

describe('AI-02H1D.2 authoritative policy snapshot contracts', () => {
  it('1. accepts a valid snapshot', () => {
    expect(
      validateAuthoritativePolicySnapshotV1(validSnapshot())
        .schemaVersion
    ).toBe('1');
  });

  it('2. rejects an unsupported snapshot schema', () => {
    expectContractError(() =>
      validateAuthoritativePolicySnapshotV1(
        validSnapshot({ schemaVersion: '2' })
      )
    );
  });

  it('3. rejects an invalid producer version', () => {
    expectContractError(() =>
      validateAuthoritativePolicySnapshotV1(
        validSnapshot({ producerVersion: '2' })
      )
    );
  });

  it('4. rejects an empty authorization policy version', () => {
    expectContractError(() =>
      validateAuthoritativePolicySnapshotV1(
        validSnapshot({ authorizationPolicyVersion: '' })
      )
    );
  });

  it('5. rejects an incompatible trusted registry version', () => {
    expectContractError(() =>
      validateAuthoritativePolicySnapshotV1(
        validSnapshot({ trustedRegistryVersion: '2' })
      )
    );
  });

  it('6. rejects an empty policy table', () => {
    expectContractError(() =>
      validateAuthoritativePolicySnapshotV1(
        validSnapshot({ entries: [] })
      )
    );
  });

  it('7. accepts a valid policy entry', () => {
    expect(
      validateAuthoritativePolicyEntryV1(validEntry()).policyId
    ).toBe('policy-contract-test-shadow');
  });

  it('8. preserves an exact tenant binding', () => {
    expect(
      validateAuthoritativePolicyEntryV1(validEntry()).tenantId
    ).toBe('tenant-policy-contract-test');
  });

  it('9. rejects aura_root regardless of casing', () => {
    expectContractError(() =>
      validateAuthoritativePolicyEntryV1(
        validEntry({ tenantId: 'AuRa_RoOt' })
      )
    );
  });

  it('10. preserves the exact Boundary actor type', () => {
    expect(
      validateAuthoritativePolicyEntryV1(validEntry()).actorType
    ).toBe('SYSTEM');
  });

  it('11. preserves the exact actor identifier', () => {
    expect(
      validateAuthoritativePolicyEntryV1(validEntry()).actorId
    ).toBe('actor-policy-contract-test');
  });

  it('12. accepts only the registered test consumer', () => {
    expect(
      validateAuthoritativePolicyEntryV1(validEntry()).consumerId
    ).toBe('INTELLIGENCE_OS_CONTRACT_TEST');
  });

  it('13. rejects an unknown consumer', () => {
    expectContractError(() =>
      validateAuthoritativePolicyEntryV1(
        validEntry({ consumerId: 'UNKNOWN_CONSUMER' })
      )
    );
  });

  it('14. accepts only the registered test source', () => {
    expect(
      validateAuthoritativePolicyEntryV1(validEntry()).source
    ).toBe('TRUSTED_COMPOSITION_CONTRACT_TEST');
  });

  it('15. rejects an unknown source', () => {
    expectContractError(() =>
      validateAuthoritativePolicyEntryV1(
        validEntry({ source: 'UNKNOWN_SOURCE' })
      )
    );
  });

  it('16. rejects a source and consumer combination outside the registry binding', () => {
    expectContractError(() =>
      validateAuthoritativePolicyEntryV1(
        validEntry({
          consumerId: 'OTHER_CONTRACT_TEST',
          source: 'TRUSTED_COMPOSITION_CONTRACT_TEST',
        })
      )
    );
  });

  it('17. accepts SHADOW_ONLY as the sole requested mode', () => {
    expect(
      validateAuthoritativePolicyEntryV1(validEntry())
        .requestedMode
    ).toBe('SHADOW_ONLY');
  });

  it('18. rejects EVALUATION', () => {
    expectContractError(() =>
      validateAuthoritativePolicyEntryV1(
        validEntry({
          requestedMode: 'EVALUATION',
          effectiveExecutionMode: 'EVALUATION',
        })
      )
    );
  });

  it('19. rejects PRODUCTIVE', () => {
    expectContractError(() =>
      validateAuthoritativePolicyEntryV1(
        validEntry({
          requestedMode: 'PRODUCTIVE',
          effectiveExecutionMode: 'PRODUCTIVE',
        })
      )
    );
  });

  it('20. rejects DISABLED', () => {
    expectContractError(() =>
      validateAuthoritativePolicyEntryV1(
        validEntry({
          requestedMode: 'DISABLED',
          effectiveExecutionMode: 'DISABLED',
        })
      )
    );
  });

  it('21. rejects an effective mode mismatch', () => {
    expectContractError(() =>
      validateAuthoritativePolicyEntryV1(
        validEntry({ effectiveExecutionMode: 'EVALUATION' })
      )
    );
  });

  it('22. preserves a valid explicit timeout', () => {
    expect(
      validateAuthoritativePolicyEntryV1(
        validEntry({ effectiveTimeoutMs: 45_000 })
      ).effectiveTimeoutMs
    ).toBe(45_000);
  });

  it('23. rejects a zero timeout', () => {
    expectContractError(() =>
      validateAuthoritativePolicyEntryV1(
        validEntry({ effectiveTimeoutMs: 0 })
      )
    );
  });

  it('24. rejects a negative timeout', () => {
    expectContractError(() =>
      validateAuthoritativePolicyEntryV1(
        validEntry({ effectiveTimeoutMs: -1 })
      )
    );
  });

  it('25. rejects a non-integer timeout', () => {
    expectContractError(() =>
      validateAuthoritativePolicyEntryV1(
        validEntry({ effectiveTimeoutMs: 1.5 })
      )
    );
  });

  it('26. rejects a timeout above the Boundary maximum', () => {
    expectContractError(() =>
      validateAuthoritativePolicyEntryV1(
        validEntry({
          effectiveTimeoutMs:
            AUTHORITATIVE_POLICY_MAX_TIMEOUT_MS + 1,
        })
      )
    );
  });

  it('27. rejects duplicate policy identifiers', () => {
    expectContractError(() =>
      createAuthoritativePolicySnapshotV1(
        validSnapshot({
          entries: [
            validEntry(),
            validEntry({ actorId: 'second-policy-actor' }),
          ],
        })
      )
    );
  });

  it('28. rejects duplicate lookup keys', () => {
    expectContractError(() =>
      createAuthoritativePolicySnapshotV1(
        validSnapshot({
          entries: [
            validEntry(),
            validEntry({ policyId: 'second-policy-id' }),
          ],
        })
      )
    );
  });

  it('29. rejects unknown snapshot and entry fields', () => {
    expectContractError(() =>
      validateAuthoritativePolicySnapshotV1(
        validSnapshot({ transport: 'INTERNAL_TEST' })
      )
    );
    expectContractError(() =>
      validateAuthoritativePolicyEntryV1(
        validEntry({ metadata: {} })
      )
    );
  });

  it('30. produces a deterministic framed lookup key', () => {
    const input = {
      tenantId: 'tenant-policy-contract-test',
      actorType: 'SYSTEM',
      actorId: 'actor-policy-contract-test',
      consumerId: 'INTELLIGENCE_OS_CONTRACT_TEST',
      source: 'TRUSTED_COMPOSITION_CONTRACT_TEST',
      requestedMode: 'SHADOW_ONLY',
    } as const;

    expect(createAuthoritativePolicyLookupKeyV1(input)).toBe(
      createAuthoritativePolicyLookupKeyV1({ ...input })
    );
  });

  it('31. prevents ambiguous collisions when identifiers contain separators', () => {
    const base = {
      actorType: 'SYSTEM',
      consumerId: 'INTELLIGENCE_OS_CONTRACT_TEST',
      source: 'TRUSTED_COMPOSITION_CONTRACT_TEST',
      requestedMode: 'SHADOW_ONLY',
    } as const;
    const first = createAuthoritativePolicyLookupKeyV1({
      ...base,
      tenantId: 'tenant|actorId:7:subject',
      actorId: 'actor',
    });
    const second = createAuthoritativePolicyLookupKeyV1({
      ...base,
      tenantId: 'tenant',
      actorId: 'actor|actorId:7:subject',
    });

    expect(first).not.toBe(second);
  });

  it('32. clones the snapshot and its entries', () => {
    const input = validSnapshot();
    const inputEntries = input.entries as Record<string, unknown>[];
    const output = createAuthoritativePolicySnapshotV1(input);

    expect(output).not.toBe(input);
    expect(output.entries).not.toBe(inputEntries);
    expect(output.entries[0]).not.toBe(inputEntries[0]);
  });

  it('33. freezes the snapshot', () => {
    expect(
      Object.isFrozen(AUTHORITATIVE_POLICY_TEST_SNAPSHOT_V1)
    ).toBe(true);
  });

  it('34. freezes the entries array and each entry', () => {
    expect(
      Object.isFrozen(
        AUTHORITATIVE_POLICY_TEST_SNAPSHOT_V1.entries
      )
    ).toBe(true);
    expect(
      Object.isFrozen(
        AUTHORITATIVE_POLICY_TEST_SNAPSHOT_V1.entries[0]
      )
    ).toBe(true);
  });

  it('35. isolates the result from later input mutation', () => {
    const inputEntry = validEntry();
    const input = validSnapshot({ entries: [inputEntry] });
    const output = createAuthoritativePolicySnapshotV1(input);

    input.authorizationPolicyVersion = 'mutated-version';
    inputEntry.tenantId = 'mutated-tenant';
    expect(output.authorizationPolicyVersion).toBe(
      AUTHORITATIVE_POLICY_TEST_AUTHORIZATION_VERSION
    );
    expect(output.entries[0]?.tenantId).toBe(
      'tenant-policy-contract-test'
    );
  });

  it('36. canonicalizes entry order independently of input order', () => {
    const firstEntry = validEntry({
      policyId: 'policy-a',
      tenantId: 'tenant-a',
    });
    const secondEntry = validEntry({
      policyId: 'policy-z',
      tenantId: 'tenant-z',
    });
    const forward = createAuthoritativePolicySnapshotV1(
      validSnapshot({ entries: [firstEntry, secondEntry] })
    );
    const reverse = createAuthoritativePolicySnapshotV1(
      validSnapshot({ entries: [secondEntry, firstEntry] })
    );

    expect(forward).toEqual(reverse);
    expect(forward.entries.map((entry) => entry.policyId)).toEqual([
      'policy-a',
      'policy-z',
    ]);
  });

  it('37. exposes one enabled test-only initial entry', () => {
    expect(AUTHORITATIVE_POLICY_TEST_SNAPSHOT_V1.entries).toHaveLength(
      1
    );
    expect(
      AUTHORITATIVE_POLICY_TEST_SNAPSHOT_V1.entries[0]
    ).toMatchObject({
      enabled: true,
      consumerId: 'INTELLIGENCE_OS_CONTRACT_TEST',
      source: 'TRUSTED_COMPOSITION_CONTRACT_TEST',
      requestedMode: 'SHADOW_ONLY',
      effectiveExecutionMode: 'SHADOW_ONLY',
    });
  });

  it('38. rejects an unsupported entry version', () => {
    expectContractError(() =>
      validateAuthoritativePolicyEntryV1(
        validEntry({ entryVersion: '2' })
      )
    );
  });

  it('39. rejects invalid policy identifiers and enabled states', () => {
    expectContractError(() =>
      validateAuthoritativePolicyEntryV1(
        validEntry({ policyId: '*' })
      )
    );
    expectContractError(() =>
      validateAuthoritativePolicyEntryV1(
        validEntry({ enabled: 'true' })
      )
    );
  });

  it('40. rejects an entry authorization version inconsistent with its snapshot', () => {
    expectContractError(() =>
      validateAuthoritativePolicySnapshotV1(
        validSnapshot({
          entries: [
            validEntry({
              authorizationPolicyVersion:
                'different-policy-version',
            }),
          ],
        })
      )
    );
  });

  it('41. rejects missing entries and uncloneable arrays', () => {
    const withoutEntries = validSnapshot();
    delete withoutEntries.entries;
    expectContractError(() =>
      validateAuthoritativePolicySnapshotV1(withoutEntries)
    );

    const uncloneableEntries = new Proxy([validEntry()], {
      get() {
        throw new Error('unavailable');
      },
    });
    expectContractError(() =>
      validateAuthoritativePolicySnapshotV1(
        validSnapshot({ entries: uncloneableEntries })
      )
    );
  });

  it('42. returns generic contract errors without authority identifiers', () => {
    try {
      validateAuthoritativePolicyEntryV1(
        validEntry({ tenantId: 'sensitive-tenant-id', actorType: 'ADMIN' })
      );
      throw new Error('Expected validation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(
        AuthoritativePolicySnapshotContractError
      );
      if (
        !(error instanceof AuthoritativePolicySnapshotContractError)
      ) {
        throw error;
      }
      expect(error.message).not.toMatch(
        /sensitive-tenant-id|ADMIN|policy-contract-test-shadow/
      );
    }
  });

  it('43. keeps transport outside the snapshot and lookup contracts', () => {
    const snapshot =
      createAuthoritativePolicySnapshotV1(validSnapshot());
    const entry = snapshot.entries[0];

    expect('transport' in snapshot).toBe(false);
    expect(entry && 'transport' in entry).toBe(false);
    expect(
      createAuthoritativePolicyLookupKeyV1(entry!)
    ).not.toContain('transport');
  });
});
