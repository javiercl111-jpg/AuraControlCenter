import type { AuthoritativePolicySnapshotV1 } from './types';

export interface AuthoritativeFeaturePolicySourcePortV1 {
  loadPolicySnapshot(
    tenantId: string
  ): Promise<AuthoritativePolicySnapshotV1 | undefined>;
}
