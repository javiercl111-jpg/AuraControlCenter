import type {
  BoundaryActorTypeV1,
} from '../os/boundary/types';
import type {
  TrustedConsumerId,
  TrustedSourceId,
} from '../serverComposition/types';

export const AUTHORITATIVE_POLICY_SNAPSHOT_SCHEMA_VERSION =
  '1' as const;
export const AUTHORITATIVE_POLICY_ENTRY_VERSION = '1' as const;
export const AUTHORITATIVE_POLICY_PRODUCER_VERSION = '1' as const;
export const AUTHORITATIVE_POLICY_TEST_AUTHORIZATION_VERSION =
  'policy-snapshot-contract-test-1' as const;
export const AUTHORITATIVE_POLICY_MAX_TIMEOUT_MS =
  2_147_483_647;

export const AUTHORITATIVE_POLICY_EXECUTION_MODES_V1 =
  Object.freeze(['SHADOW_ONLY'] as const);

export type AuthoritativePolicyExecutionModeV1 =
  (typeof AUTHORITATIVE_POLICY_EXECUTION_MODES_V1)[number];

export interface AuthoritativePolicyLookupInputV1 {
  readonly tenantId: string;
  readonly actorType: BoundaryActorTypeV1;
  readonly actorId: string;
  readonly consumerId: TrustedConsumerId;
  readonly source: TrustedSourceId;
  readonly requestedMode: AuthoritativePolicyExecutionModeV1;
}

export interface AuthoritativePolicyEntryV1
  extends AuthoritativePolicyLookupInputV1 {
  readonly entryVersion: typeof AUTHORITATIVE_POLICY_ENTRY_VERSION;
  readonly policyId: string;
  readonly enabled: boolean;
  readonly effectiveExecutionMode:
    AuthoritativePolicyExecutionModeV1;
  readonly effectiveTimeoutMs: number;
  readonly authorizationPolicyVersion: string;
  readonly description?: string;
}

export interface AuthoritativePolicySnapshotV1 {
  readonly schemaVersion:
    typeof AUTHORITATIVE_POLICY_SNAPSHOT_SCHEMA_VERSION;
  readonly producerVersion:
    typeof AUTHORITATIVE_POLICY_PRODUCER_VERSION;
  readonly authorizationPolicyVersion: string;
  readonly trustedRegistryVersion: string;
  readonly entries: readonly AuthoritativePolicyEntryV1[];
}
