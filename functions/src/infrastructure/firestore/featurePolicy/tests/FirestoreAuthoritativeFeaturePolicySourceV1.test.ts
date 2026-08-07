import { describe, expect, it } from 'vitest';
import type { Firestore, DocumentSnapshot } from 'firebase-admin/firestore';
import { FirestoreAuthoritativeFeaturePolicySourceV1 } from '../FirestoreAuthoritativeFeaturePolicySourceV1';
import {
  AUTHORITATIVE_POLICY_SNAPSHOT_SCHEMA_VERSION,
} from '@aura/intelligence-os/server';
import {
  FirestoreFeaturePolicySourceError,
} from '../firestoreFeaturePolicyErrors';

function createFakeFirestore(docSnapshot: Partial<DocumentSnapshot> | Error): Firestore {
  return {
    collection: () => ({
      doc: () => ({
        get: async () => {
          if (docSnapshot instanceof Error) {
            throw docSnapshot;
          }
          return docSnapshot as DocumentSnapshot;
        },
      }),
    }),
  } as unknown as Firestore;
}

const validSnapshotData = {
  schemaVersion: AUTHORITATIVE_POLICY_SNAPSHOT_SCHEMA_VERSION,
  producerVersion: '1',
  authorizationPolicyVersion: 'policy-snapshot-contract-test-1',
  trustedRegistryVersion: '1',
  entries: [
    {
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
    },
  ],
};

describe('FirestoreAuthoritativeFeaturePolicySourceV1', () => {
  it('15. document exists -> snapshot vÃƒÂ¡lido', async () => {
    const firestore = createFakeFirestore({
      exists: true,
      data: () => validSnapshotData,
    });
    const source = new FirestoreAuthoritativeFeaturePolicySourceV1(firestore);

    const snapshot = await source.loadPolicySnapshot('tenant-123');

    expect(snapshot).toBeDefined();
    expect(snapshot?.schemaVersion).toBe(AUTHORITATIVE_POLICY_SNAPSHOT_SCHEMA_VERSION);
    expect(snapshot?.entries[0].policyId).toBe('test-policy-1');
  });

  it('16. missing doc -> undefined', async () => {
    const firestore = createFakeFirestore({
      exists: false,
      data: () => undefined,
    });
    const source = new FirestoreAuthoritativeFeaturePolicySourceV1(firestore);

    const snapshot = await source.loadPolicySnapshot('tenant-123');

    expect(snapshot).toBeUndefined();
  });

  it('17. malformed top-level -> source error', async () => {
    const firestore = createFakeFirestore({
      exists: true,
      data: () => ({ ...validSnapshotData, schemaVersion: 'invalid' }),
    });
    const source = new FirestoreAuthoritativeFeaturePolicySourceV1(firestore);

    await expect(source.loadPolicySnapshot('tenant-123')).rejects.toThrow(
      FirestoreFeaturePolicySourceError
    );
    await expect(source.loadPolicySnapshot('tenant-123')).rejects.toMatchObject({
      code: 'MALFORMED_SNAPSHOT',
    });
  });

  it('18. malformed entry -> source error', async () => {
    const firestore = createFakeFirestore({
      exists: true,
      data: () => ({
        ...validSnapshotData,
        entries: [{ ...validSnapshotData.entries[0], requestedMode: 'INVALID' }],
      }),
    });
    const source = new FirestoreAuthoritativeFeaturePolicySourceV1(firestore);

    await expect(source.loadPolicySnapshot('tenant-123')).rejects.toMatchObject({
      code: 'MALFORMED_SNAPSHOT',
    });
  });

  it('19. cross-tenant entry -> source error', async () => {
    const firestore = createFakeFirestore({
      exists: true,
      data: () => ({
        ...validSnapshotData,
        entries: [{ ...validSnapshotData.entries[0], tenantId: 'tenant-456' }],
      }),
    });
    const source = new FirestoreAuthoritativeFeaturePolicySourceV1(firestore);

    // If we request 'tenant-123' but the entry has 'tenant-456', it throws TENANT_INTEGRITY_VIOLATION
    await expect(source.loadPolicySnapshot('tenant-123')).rejects.toMatchObject({
      code: 'TENANT_INTEGRITY_VIOLATION',
    });
  });

  it('20. Firestore throw -> SOURCE_UNAVAILABLE', async () => {
    const firestore = createFakeFirestore(new Error('Firestore network error'));
    const source = new FirestoreAuthoritativeFeaturePolicySourceV1(firestore);

    await expect(source.loadPolicySnapshot('tenant-123')).rejects.toMatchObject({
      code: 'SOURCE_UNAVAILABLE',
    });
  });

  it('21. no raw Firestore error leak', async () => {
    const firestore = createFakeFirestore(new Error('Firestore network error'));
    const source = new FirestoreAuthoritativeFeaturePolicySourceV1(firestore);

    try {
      await source.loadPolicySnapshot('tenant-123');
      expect.fail('Should have thrown');
    } catch (e: unknown) {
      expect(e).toBeInstanceOf(FirestoreFeaturePolicySourceError);

      if (!(e instanceof Error)) {
        expect.fail('Expected Error instance');
      }

      expect(e.message).not.toContain('Firestore network error');
    }
  });

  it('22. tenantId usado como document ID', async () => {
    let requestedDocId = '';
    const firestore = {
      collection: () => ({
        doc: (id: string) => {
          requestedDocId = id;
          return {
            get: async () => ({ exists: false }),
          };
        },
      }),
    } as unknown as Firestore;
    const source = new FirestoreAuthoritativeFeaturePolicySourceV1(firestore);

    await source.loadPolicySnapshot('tenant-999');

    expect(requestedDocId).toBe('tenant-999');
  });

  it('23/24. no query cross-tenant / no composite query', async () => {
    let collectionCalled = false;
    let whereCalled = false;
    const firestore = {
      collection: () => {
        collectionCalled = true;
        return {
          doc: () => ({
            get: async () => ({ exists: false }),
          }),
          where: () => {
            whereCalled = true;
            return this;
          },
        };
      },
    } as unknown as Firestore;
    const source = new FirestoreAuthoritativeFeaturePolicySourceV1(firestore);

    await source.loadPolicySnapshot('tenant-999');

    expect(collectionCalled).toBe(true);
    expect(whereCalled).toBe(false);
  });
});
