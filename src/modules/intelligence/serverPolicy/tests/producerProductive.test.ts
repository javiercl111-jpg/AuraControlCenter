import { describe, expect, it } from 'vitest';
import { AuthoritativeFeaturePolicyProducerV1 } from '../AuthoritativeFeaturePolicyProducerV1';
import type { AuthoritativeFeaturePolicySourcePortV1 } from '../ports';
import { AUTHORITATIVE_BOUNDARY_POLICY_SCHEMA_VERSION, type AuthoritativeBoundaryPolicyQueryV1 } from '../../os/boundary/types';
import { AUTHORITATIVE_POLICY_SNAPSHOT_SCHEMA_VERSION, type AuthoritativePolicySnapshotV1 } from '../types';
import { AuthoritativeFeaturePolicySourceError } from '../errors';

function policyQuery(overrides: Partial<AuthoritativeBoundaryPolicyQueryV1>): AuthoritativeBoundaryPolicyQueryV1 {
  return {
    schemaVersion: AUTHORITATIVE_BOUNDARY_POLICY_SCHEMA_VERSION,
    tenantId: 'tenant-123',
    consumerId: 'INTELLIGENCE_OS_CONTRACT_TEST',
    source: 'TRUSTED_COMPOSITION_CONTRACT_TEST',
    requestedMode: 'SHADOW_ONLY',
    actor: { actorType: 'SYSTEM', actorId: 'system-1' },
    ...overrides,
  };
}

const validSnapshotData: AuthoritativePolicySnapshotV1 = Object.freeze({
  schemaVersion: AUTHORITATIVE_POLICY_SNAPSHOT_SCHEMA_VERSION,
  producerVersion: '1',
  authorizationPolicyVersion: 'policy-snapshot-contract-test-1',
  trustedRegistryVersion: '1',
  entries: Object.freeze([
    Object.freeze({
      entryVersion: '1',
      policyId: 'test-policy-1',
      enabled: true,
      tenantId: 'tenant-123',
      actorType: 'SYSTEM',
      actorId: 'system-1',
      consumerId: 'INTELLIGENCE_OS_CONTRACT_TEST',
      source: 'TRUSTED_COMPOSITION_CONTRACT_TEST',
      requestedMode: 'SHADOW_ONLY',
      effectiveExecutionMode: 'SHADOW_ONLY',
      effectiveTimeoutMs: 1000,
      authorizationPolicyVersion: 'policy-snapshot-contract-test-1',
    }),
    Object.freeze({
      entryVersion: '1',
      policyId: 'test-policy-2',
      enabled: true,
      tenantId: 'tenant-123',
      actorType: 'USER',
      actorId: 'user-1',
      consumerId: 'INTELLIGENCE_OS_CONTRACT_TEST',
      source: 'TRUSTED_COMPOSITION_CONTRACT_TEST',
      requestedMode: 'EVALUATION',
      effectiveExecutionMode: 'EVALUATION',
      effectiveTimeoutMs: 1000,
      authorizationPolicyVersion: 'policy-snapshot-contract-test-1',
    }),
  ]),
});

class MockSource implements AuthoritativeFeaturePolicySourcePortV1 {
  private readonly snapshot?: AuthoritativePolicySnapshotV1;
  private readonly error?: Error;

  constructor(snapshot?: AuthoritativePolicySnapshotV1, error?: Error) {
    this.snapshot = snapshot;
    this.error = error;
  }

  async loadPolicySnapshot(tenantId: string): Promise<AuthoritativePolicySnapshotV1 | undefined> {
    if (this.error) throw this.error;
    if (this.snapshot && this.snapshot.entries.some(e => e.tenantId === tenantId)) {
      return this.snapshot;
    }
    return undefined;
  }
}

describe('AuthoritativeFeaturePolicyProducerV1', () => {
  it('25. source snapshot -> evaluator decision', async () => {
    const producer = new AuthoritativeFeaturePolicyProducerV1(new MockSource(validSnapshotData));
    const query = policyQuery({ tenantId: 'tenant-123', requestedMode: 'SHADOW_ONLY' });
    const decision = await producer.evaluateAuthoritativePolicy(query);

    expect(decision.decision).toBe('ALLOWED');
    expect(decision.reasonCode).toBe('POLICY_ALLOWED');
  });

  it('26. missing snapshot -> POLICY_NOT_FOUND', async () => {
    const producer = new AuthoritativeFeaturePolicyProducerV1(new MockSource(undefined));
    const query = policyQuery({ tenantId: 'unknown', requestedMode: 'SHADOW_ONLY' });
    const decision = await producer.evaluateAuthoritativePolicy(query);

    expect(decision.decision).toBe('DENIED');
    expect(decision.reasonCode).toBe('POLICY_NOT_FOUND');
  });

  it('27. source unavailable -> throw/fail-safe', async () => {
    const producer = new AuthoritativeFeaturePolicyProducerV1(
      new MockSource(undefined, new AuthoritativeFeaturePolicySourceError('SOURCE_UNAVAILABLE'))
    );
    const query = policyQuery({ tenantId: 'tenant-123', requestedMode: 'SHADOW_ONLY' });

    await expect(producer.evaluateAuthoritativePolicy(query)).rejects.toMatchObject({ code: 'SOURCE_UNAVAILABLE' });
  });

  it('28. malformed snapshot -> throw/fail-safe', async () => {
    const producer = new AuthoritativeFeaturePolicyProducerV1(
      new MockSource(undefined, new AuthoritativeFeaturePolicySourceError('MALFORMED_SNAPSHOT'))
    );
    const query = policyQuery({ tenantId: 'tenant-123', requestedMode: 'SHADOW_ONLY' });

    await expect(producer.evaluateAuthoritativePolicy(query)).rejects.toMatchObject({ code: 'MALFORMED_SNAPSHOT' });
  });

  it('29. EVALUATION allowed con policy vÃ¡lida', async () => {
    const producer = new AuthoritativeFeaturePolicyProducerV1(new MockSource(validSnapshotData));
    const query = policyQuery({
      tenantId: 'tenant-123',
      requestedMode: 'EVALUATION',
      actor: { actorType: 'USER', actorId: 'user-1' }
    });
    const decision = await producer.evaluateAuthoritativePolicy(query);

    expect(decision.decision).toBe('ALLOWED');
    expect(decision.reasonCode).toBe('POLICY_ALLOWED');
    if (decision.decision === 'ALLOWED') {
      expect(decision.effectiveExecutionMode).toBe('EVALUATION');
    }
  });

  it('30. SHADOW_ONLY allowed con policy vÃ¡lida', async () => {
    const producer = new AuthoritativeFeaturePolicyProducerV1(new MockSource(validSnapshotData));
    const query = policyQuery({ tenantId: 'tenant-123', requestedMode: 'SHADOW_ONLY' });
    const decision = await producer.evaluateAuthoritativePolicy(query);

    expect(decision.decision).toBe('ALLOWED');
    expect(decision.reasonCode).toBe('POLICY_ALLOWED');
    if (decision.decision === 'ALLOWED') {
      expect(decision.effectiveExecutionMode).toBe('SHADOW_ONLY');
    }
  });

  it('31. PRODUCTIVE no promovido', async () => {
    const producer = new AuthoritativeFeaturePolicyProducerV1(new MockSource(validSnapshotData));
    const query = policyQuery({ tenantId: 'tenant-123', requestedMode: 'PRODUCTIVE' });
    const decision = await producer.evaluateAuthoritativePolicy(query);

    expect(decision.decision).toBe('DENIED');
    expect(decision.reasonCode).toBe('MODE_NOT_ALLOWED');
  });

  it('32. tenant mismatch denied', async () => {
    const producer = new AuthoritativeFeaturePolicyProducerV1(new MockSource(validSnapshotData));
    const query = policyQuery({ tenantId: 'tenant-999', requestedMode: 'SHADOW_ONLY' });
    const decision = await producer.evaluateAuthoritativePolicy(query);

    expect(decision.decision).toBe('DENIED');
    expect(decision.reasonCode).toBe('POLICY_NOT_FOUND'); // missing snapshot for tenant-999
  });

  it('33. actor mismatch denied', async () => {
    const producer = new AuthoritativeFeaturePolicyProducerV1(new MockSource(validSnapshotData));
    const query = policyQuery({
      tenantId: 'tenant-123',
      requestedMode: 'SHADOW_ONLY',
      actor: { actorType: 'SYSTEM', actorId: 'wrong-actor' }
    });
    const decision = await producer.evaluateAuthoritativePolicy(query);

    expect(decision.decision).toBe('DENIED');
    expect(decision.reasonCode).toBe('ACTOR_NOT_ALLOWED');
  });

  it('34. consumer mismatch denied', async () => {
    const producer = new AuthoritativeFeaturePolicyProducerV1(new MockSource(validSnapshotData));
    const query = policyQuery({ tenantId: 'tenant-123', requestedMode: 'SHADOW_ONLY', consumerId: 'WRONG' });
    const decision = await producer.evaluateAuthoritativePolicy(query);

    expect(decision.decision).toBe('DENIED');
    expect(decision.reasonCode).toBe('CONSUMER_NOT_ALLOWED');
  });

  it('35. source mismatch denied', async () => {
    const producer = new AuthoritativeFeaturePolicyProducerV1(new MockSource(validSnapshotData));
    const query = policyQuery({ tenantId: 'tenant-123', requestedMode: 'SHADOW_ONLY', source: 'WRONG' });
    const decision = await producer.evaluateAuthoritativePolicy(query);

    expect(decision.decision).toBe('DENIED');
    expect(decision.reasonCode).toBe('SOURCE_NOT_ALLOWED');
  });

  it('36. disabled denied', async () => {
    const disabledSnapshot = { ...validSnapshotData, entries: [{ ...validSnapshotData.entries[0], enabled: false }] };
    const producer = new AuthoritativeFeaturePolicyProducerV1(new MockSource(disabledSnapshot));
    const query = policyQuery({ tenantId: 'tenant-123', requestedMode: 'SHADOW_ONLY' });
    const decision = await producer.evaluateAuthoritativePolicy(query);

    expect(decision.decision).toBe('DENIED');
    expect(decision.reasonCode).toBe('POLICY_DISABLED');
  });

  it('37. version mismatch denied', async () => {
    const versionMismatchSnapshot = { ...validSnapshotData, entries: [{ ...validSnapshotData.entries[0], authorizationPolicyVersion: 'wrong-version' }] };
    const producer = new AuthoritativeFeaturePolicyProducerV1(new MockSource(versionMismatchSnapshot));
    const query = policyQuery({ tenantId: 'tenant-123', requestedMode: 'SHADOW_ONLY' });
    const decision = await producer.evaluateAuthoritativePolicy(query);

    expect(decision.decision).toBe('DENIED');
    expect(decision.reasonCode).toBe('POLICY_VERSION_UNSUPPORTED');
  });

  it('38. same input -> same decision', async () => {
    const producer = new AuthoritativeFeaturePolicyProducerV1(new MockSource(validSnapshotData));
    const query = policyQuery({ tenantId: 'tenant-123', requestedMode: 'SHADOW_ONLY' });

    const decision1 = await producer.evaluateAuthoritativePolicy(query);
    const decision2 = await producer.evaluateAuthoritativePolicy(query);

    expect(decision1).toEqual(decision2);
  });
});

import { GovernedExecutionBoundary } from '../../os/boundary/GovernedExecutionBoundary';
import type { BoundaryExecutionPort, InternalExecutionInput, InternalExecutionResult } from '../../os/boundary/ports';
import type { BoundaryClockPort } from '../../os/boundary/ports';
import type { BoundaryInvocationContextV1, GovernedExecutionRequest } from '../../os/boundary/types';

describe('Boundary Compatibility', () => {
  const dummyRequest: GovernedExecutionRequest = {
    requestId: 'req-1',
    correlationId: 'cor-1',
    tenant: { tenantId: 'tenant-123' },
    actor: { actorType: 'SYSTEM', actorId: 'system-1' },
    source: 'TRUSTED_COMPOSITION_CONTRACT_TEST',
    requestedMode: 'SHADOW_ONLY',
    payload: {},
  };
  const evaluationRequest: GovernedExecutionRequest = { ...dummyRequest, requestedMode: 'EVALUATION', actor: { actorType: 'USER', actorId: 'user-1' } };
  const productiveRequest: GovernedExecutionRequest = { ...dummyRequest, requestedMode: 'PRODUCTIVE' };

  const fixedNow = Date.now();
  const fixedIso = new Date(fixedNow).toISOString();
  const dummyClock: BoundaryClockPort = {
    now: () => fixedIso,
  };

  const dummyContext: BoundaryInvocationContextV1 = {
    schemaVersion: '1',
    tenantId: 'tenant-123',
    actor: { actorType: 'SYSTEM', actorId: 'system-1' },
    consumerId: 'INTELLIGENCE_OS_CONTRACT_TEST',
    source: 'TRUSTED_COMPOSITION_CONTRACT_TEST',
    requestId: 'req-1',
    correlationId: 'cor-1',
  };
  const successfulExecutionResult = (): InternalExecutionResult => ({
    executionId: 'execution-1',
    sessionId: 'req-1',
    status: 'SUCCESS',
  });

  it('39. policy allow -> execution port llamado', async () => {
    let executed = false;
    const executionPort: BoundaryExecutionPort = {
      execute: async () => {
        executed = true;
        return successfulExecutionResult();
      },
    };
    const producer = new AuthoritativeFeaturePolicyProducerV1(new MockSource(validSnapshotData));
    const boundary = new GovernedExecutionBoundary({
      featurePolicyPort: producer,
      executionPort,
      clockPort: dummyClock,
    });

    const result = await boundary.execute(dummyRequest, dummyContext);
    expect(executed).toBe(true);
    expect(result.status).toBe('COMPLETED');
  });

  it('40. policy deny -> 0 execution calls', async () => {
    let executed = false;
    const executionPort: BoundaryExecutionPort = {
      execute: async () => {
        executed = true;
        return successfulExecutionResult();
      },
    };
    const disabledSnapshot = { ...validSnapshotData, entries: [{ ...validSnapshotData.entries[0], enabled: false }] };
    const producer = new AuthoritativeFeaturePolicyProducerV1(new MockSource(disabledSnapshot));
    const boundary = new GovernedExecutionBoundary({
      featurePolicyPort: producer,
      executionPort,
      clockPort: dummyClock,
    });

    const result = await boundary.execute(dummyRequest, dummyContext);
    expect(result.status).toBe('REJECTED');
    expect(result.errors?.[0].code).toBe('BOUNDARY_DISABLED');
    expect(executed).toBe(false);
  });

  it('41. missing policy -> fail closed', async () => {
    const executionPort: BoundaryExecutionPort = { execute: async () => successfulExecutionResult() };
    const producer = new AuthoritativeFeaturePolicyProducerV1(new MockSource(undefined));
    const boundary = new GovernedExecutionBoundary({
      featurePolicyPort: producer,
      executionPort,
      clockPort: dummyClock,
    });

    const result = await boundary.execute(dummyRequest, dummyContext);
    expect(result.status).toBe('REJECTED');
    expect(result.errors?.[0].code).toBe('BOUNDARY_DISABLED');
  });

  it('42. source unavailable -> boundary no ejecuta', async () => {
    let executed = false;
    const executionPort: BoundaryExecutionPort = {
      execute: async () => {
        executed = true;
        return successfulExecutionResult();
      },
    };
    const producer = new AuthoritativeFeaturePolicyProducerV1(
      new MockSource(undefined, new AuthoritativeFeaturePolicySourceError('SOURCE_UNAVAILABLE'))
    );
    const boundary = new GovernedExecutionBoundary({
      featurePolicyPort: producer,
      executionPort,
      clockPort: dummyClock,
    });

    const result = await boundary.execute(dummyRequest, dummyContext);
    expect(result.status).toBe('REJECTED');
    expect(executed).toBe(false);
  });

  it('43. EVALUATION effective mode correcto', async () => {
    let modeSeen = '';
    const executionPort: BoundaryExecutionPort = {
      execute: async (input: InternalExecutionInput) => {
        modeSeen = input.authoritativeContext?.executionMode ?? '';
        return successfulExecutionResult();
      },
    };
    const producer = new AuthoritativeFeaturePolicyProducerV1(new MockSource(validSnapshotData));
    const boundary = new GovernedExecutionBoundary({
      featurePolicyPort: producer,
      executionPort,
      clockPort: dummyClock,
    });

    const evaluationContext: BoundaryInvocationContextV1 = { ...dummyContext, actor: { actorType: 'USER', actorId: 'user-1' } };
    await boundary.execute(evaluationRequest, evaluationContext);
    expect(modeSeen).toBe('EVALUATION');
  });

  it('44. PRODUCTIVE sigue bloqueado', async () => {
    let executed = false;
    const executionPort: BoundaryExecutionPort = {
      execute: async () => {
        executed = true;
        return successfulExecutionResult();
      },
    };
    const producer = new AuthoritativeFeaturePolicyProducerV1(new MockSource(validSnapshotData));
    const boundary = new GovernedExecutionBoundary({
      featurePolicyPort: producer,
      executionPort,
      clockPort: dummyClock,
    });

    const result = await boundary.execute(productiveRequest, dummyContext);
    expect(result.status).toBe('REJECTED');
    expect(result.errors?.[0].code).toBe('MODE_NOT_ALLOWED');
    expect(executed).toBe(false);
  });
});
