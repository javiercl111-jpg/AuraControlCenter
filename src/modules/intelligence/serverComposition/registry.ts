import type {
  TrustedConsumerRegistryV1,
  TrustedSourceRegistryV1,
} from './types';

export const TRUSTED_COMPOSITION_REGISTRY_VERSION = '1' as const;

export const TRUSTED_CONSUMER_REGISTRY_V1: TrustedConsumerRegistryV1 =
  Object.freeze({
    schemaVersion: TRUSTED_COMPOSITION_REGISTRY_VERSION,
    entries: Object.freeze({
      INTELLIGENCE_OS_CONTRACT_TEST: Object.freeze({
        id: 'INTELLIGENCE_OS_CONTRACT_TEST',
        version: '1',
        enabled: true,
        allowedTransports: Object.freeze(['INTERNAL_TEST'] as const),
        allowedExecutionModes: Object.freeze(['SHADOW_ONLY'] as const),
        description:
          'Contract-only consumer for trusted server composition tests',
        contractVersion: '1',
      }),
      AURA_GROWTH: Object.freeze({
        id: 'AURA_GROWTH',
        version: '1',
        enabled: true,
        allowedTransports: Object.freeze(['INTERNAL_TEST'] as const),
        allowedExecutionModes: Object.freeze(['SHADOW_ONLY'] as const),
        description:
          'Aura Growth governed shadow consumer',
        contractVersion: '1',
      }),
    }),
  });

export const TRUSTED_SOURCE_REGISTRY_V1: TrustedSourceRegistryV1 =
  Object.freeze({
    schemaVersion: TRUSTED_COMPOSITION_REGISTRY_VERSION,
    entries: Object.freeze({
      TRUSTED_COMPOSITION_CONTRACT_TEST: Object.freeze({
        id: 'TRUSTED_COMPOSITION_CONTRACT_TEST',
        version: '1',
        enabled: true,
        allowedConsumerIds: Object.freeze([
          'INTELLIGENCE_OS_CONTRACT_TEST',
        ] as const),
        allowedTransports: Object.freeze(['INTERNAL_TEST'] as const),
        allowedExecutionModes: Object.freeze(['SHADOW_ONLY'] as const),
        description:
          'Contract-only source for trusted server composition tests',
        contractVersion: '1',
      }),
      AURA_GROWTH: Object.freeze({
        id: 'AURA_GROWTH',
        version: '1',
        enabled: true,
        allowedConsumerIds: Object.freeze([
          'AURA_GROWTH',
        ] as const),
        allowedTransports: Object.freeze(['INTERNAL_TEST'] as const),
        allowedExecutionModes: Object.freeze(['SHADOW_ONLY'] as const),
        description:
          'Aura Growth governed shadow source',
        contractVersion: '1',
      }),
    }),
  });
