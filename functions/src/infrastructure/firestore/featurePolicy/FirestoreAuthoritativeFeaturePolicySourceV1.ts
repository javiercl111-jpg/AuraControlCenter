import type { Firestore } from 'firebase-admin/firestore';
import {
  validateAuthoritativePolicySnapshotV1,
} from '@aura/intelligence-os/server';
import {
  FirestoreFeaturePolicySourceError,
} from './firestoreFeaturePolicyErrors';
import type {
  AuthoritativeFeaturePolicySourcePortV1,
  AuthoritativePolicySnapshotV1,
} from '@aura/intelligence-os/server';
import { FIRESTORE_INTELLIGENCE_FEATURE_POLICIES_COLLECTION } from './firestoreFeaturePolicyCollections';

export class FirestoreAuthoritativeFeaturePolicySourceV1
  implements AuthoritativeFeaturePolicySourcePortV1
{
  constructor(private readonly db: Firestore) {
    Object.freeze(this);
  }

  public async loadPolicySnapshot(
    tenantId: string
  ): Promise<AuthoritativePolicySnapshotV1 | undefined> {
    if (typeof tenantId !== 'string' || !tenantId.trim()) {
      return undefined;
    }

    let snapshotData: unknown;
    try {
      const doc = await this.db
        .collection(FIRESTORE_INTELLIGENCE_FEATURE_POLICIES_COLLECTION)
        .doc(tenantId)
        .get();

      if (!doc.exists) {
        return undefined;
      }
      snapshotData = doc.data();
    } catch {
      throw new FirestoreFeaturePolicySourceError('SOURCE_UNAVAILABLE');
    }

    let snapshot: AuthoritativePolicySnapshotV1;
    try {
      snapshot = validateAuthoritativePolicySnapshotV1(snapshotData);
    } catch {
      throw new FirestoreFeaturePolicySourceError('MALFORMED_SNAPSHOT');
    }

    const hasCrossTenantEntry = snapshot.entries.some(
      (entry) => entry.tenantId !== tenantId
    );

    if (hasCrossTenantEntry) {
      throw new FirestoreFeaturePolicySourceError(
        'TENANT_INTEGRITY_VIOLATION'
      );
    }

    return snapshot;
  }
}
