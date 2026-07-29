import {
  TRUSTED_COMPOSITION_REGISTRY_VERSION,
} from '../serverComposition/registry';
import {
  createAuthoritativePolicySnapshotV1,
} from './factories';
import {
  AUTHORITATIVE_POLICY_ENTRY_VERSION,
  AUTHORITATIVE_POLICY_PRODUCER_VERSION,
  AUTHORITATIVE_POLICY_SNAPSHOT_SCHEMA_VERSION,
  AUTHORITATIVE_POLICY_TEST_AUTHORIZATION_VERSION,
} from './types';

export const AUTHORITATIVE_POLICY_TEST_SNAPSHOT_V1 =
  createAuthoritativePolicySnapshotV1({
    schemaVersion: AUTHORITATIVE_POLICY_SNAPSHOT_SCHEMA_VERSION,
    producerVersion: AUTHORITATIVE_POLICY_PRODUCER_VERSION,
    authorizationPolicyVersion:
      AUTHORITATIVE_POLICY_TEST_AUTHORIZATION_VERSION,
    trustedRegistryVersion: TRUSTED_COMPOSITION_REGISTRY_VERSION,
    entries: [
      {
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
        description:
          'Test-only shadow authorization for policy contracts',
      },
    ],
  });
