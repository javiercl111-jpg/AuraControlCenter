import {
  AUTHORITATIVE_BOUNDARY_POLICY_SCHEMA_VERSION,
} from '../os/boundary/types';
import {
  validateAuthoritativeBoundaryPolicyQueryV1,
} from '../os/boundary/validators';
import {
  TRUSTED_COMPOSITION_REGISTRY_VERSION,
  TRUSTED_CONSUMER_REGISTRY_V1,
  TRUSTED_SOURCE_REGISTRY_V1,
} from '../serverComposition/registry';
import {
  AuthoritativePolicySnapshotContractError,
  type AuthoritativePolicySnapshotContractIssue,
} from './errors';
import {
  createAuthoritativePolicyLookupKeyV1,
} from './helpers';
import {
  AUTHORITATIVE_POLICY_ENTRY_VERSION,
  AUTHORITATIVE_POLICY_MAX_TIMEOUT_MS,
  AUTHORITATIVE_POLICY_PRODUCER_VERSION,
  AUTHORITATIVE_POLICY_SNAPSHOT_SCHEMA_VERSION,
  type AuthoritativePolicyEntryV1,
  type AuthoritativePolicySnapshotV1,
} from './types';

type PlainRecord = Readonly<Record<string, unknown>>;

const SNAPSHOT_KEYS = Object.freeze([
  'schemaVersion',
  'producerVersion',
  'authorizationPolicyVersion',
  'trustedRegistryVersion',
  'entries',
] as const);

const ENTRY_KEYS = Object.freeze([
  'entryVersion',
  'policyId',
  'enabled',
  'tenantId',
  'actorType',
  'actorId',
  'consumerId',
  'source',
  'requestedMode',
  'effectiveExecutionMode',
  'effectiveTimeoutMs',
  'authorizationPolicyVersion',
] as const);

function fail(
  issue: AuthoritativePolicySnapshotContractIssue
): never {
  throw new AuthoritativePolicySnapshotContractError(issue);
}

function getClosedRecord(
  value: unknown,
  requiredKeys: readonly string[],
  optionalKeys: readonly string[] = []
): PlainRecord | undefined {
  try {
    if (
      typeof value !== 'object' ||
      value === null ||
      Array.isArray(value)
    ) {
      return undefined;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      return undefined;
    }
    const allowedKeys = [...requiredKeys, ...optionalKeys];
    const ownKeys = Reflect.ownKeys(value);
    if (
      ownKeys.some(
        (key) =>
          typeof key !== 'string' || !allowedKeys.includes(key)
      ) ||
      requiredKeys.some(
        (key) => !Object.prototype.hasOwnProperty.call(value, key)
      )
    ) {
      return undefined;
    }
    for (const key of ownKeys) {
      if (typeof key !== 'string') {
        return undefined;
      }
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        !descriptor ||
        !descriptor.enumerable ||
        !Object.prototype.hasOwnProperty.call(descriptor, 'value')
      ) {
        return undefined;
      }
    }
    return value as PlainRecord;
  } catch {
    return undefined;
  }
}

function isCanonicalVersion(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length >= 1 &&
    value.length <= 128 &&
    value === value.trim() &&
    /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value) &&
    !value.includes('..')
  );
}

function isCanonicalPolicyId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length >= 3 &&
    value.length <= 128 &&
    value === value.trim() &&
    /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value) &&
    !value.includes('..')
  );
}

function isInternalDescription(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length >= 1 &&
    value.length <= 240 &&
    value === value.trim() &&
    !/[\r\n]/.test(value)
  );
}

function cloneAuthoritativePolicyEntryV1(
  value: unknown,
  expectedAuthorizationPolicyVersion?: string
): AuthoritativePolicyEntryV1 {
  const record = getClosedRecord(
    value,
    ENTRY_KEYS,
    ['description']
  );
  if (!record) {
    fail('INVALID_ENTRY');
  }
  if (record.entryVersion !== AUTHORITATIVE_POLICY_ENTRY_VERSION) {
    fail('UNSUPPORTED_VERSION');
  }
  if (
    !isCanonicalPolicyId(record.policyId) ||
    typeof record.enabled !== 'boolean'
  ) {
    fail('INVALID_ENTRY');
  }
  if (
    (record.requestedMode !== 'SHADOW_ONLY' && record.requestedMode !== 'EVALUATION') ||
    (record.effectiveExecutionMode !== 'SHADOW_ONLY' && record.effectiveExecutionMode !== 'EVALUATION')
  ) {
    fail('MODE_NOT_ALLOWED');
  }
  if (
    record.effectiveExecutionMode !== record.requestedMode
  ) {
    fail('MODE_NOT_ALLOWED');
  }
  if (
    typeof record.effectiveTimeoutMs !== 'number' ||
    !Number.isInteger(record.effectiveTimeoutMs) ||
    record.effectiveTimeoutMs <= 0 ||
    record.effectiveTimeoutMs >
      AUTHORITATIVE_POLICY_MAX_TIMEOUT_MS
  ) {
    fail('INVALID_TIMEOUT');
  }
  if (
    !isCanonicalVersion(record.authorizationPolicyVersion) ||
    (expectedAuthorizationPolicyVersion !== undefined &&
      record.authorizationPolicyVersion !==
        expectedAuthorizationPolicyVersion)
  ) {
    fail('INVALID_VERSION');
  }
  if (
    record.description !== undefined &&
    !isInternalDescription(record.description)
  ) {
    fail('INVALID_ENTRY');
  }
  if (
    typeof record.tenantId !== 'string' ||
    record.tenantId.toLowerCase() === 'aura_root'
  ) {
    fail('INVALID_BINDING');
  }

  let query: ReturnType<
    typeof validateAuthoritativeBoundaryPolicyQueryV1
  >;
  try {
    query = validateAuthoritativeBoundaryPolicyQueryV1({
      schemaVersion: AUTHORITATIVE_BOUNDARY_POLICY_SCHEMA_VERSION,
      tenantId: record.tenantId,
      consumerId: record.consumerId,
      source: record.source,
      requestedMode: record.requestedMode as 'SHADOW_ONLY' | 'EVALUATION',
      actor: {
        actorType: record.actorType,
        actorId: record.actorId,
      },
    });
  } catch {
    fail('INVALID_BINDING');
  }

  if (
    !Object.prototype.hasOwnProperty.call(
      TRUSTED_CONSUMER_REGISTRY_V1.entries,
      query.consumerId
    ) ||
    !Object.prototype.hasOwnProperty.call(
      TRUSTED_SOURCE_REGISTRY_V1.entries,
      query.source
    )
  ) {
    fail('INVALID_BINDING');
  }

  const consumer =
    TRUSTED_CONSUMER_REGISTRY_V1.entries[
      query.consumerId as keyof typeof TRUSTED_CONSUMER_REGISTRY_V1.entries
    ];

  const source =
    TRUSTED_SOURCE_REGISTRY_V1.entries[
      query.source as keyof typeof TRUSTED_SOURCE_REGISTRY_V1.entries
    ];

  const requestedModeString = query.requestedMode;
  if (
    query.consumerId !== consumer.id ||
    !consumer.enabled ||
    !consumer.allowedExecutionModes.some((mode) => mode === requestedModeString)
  ) {
    fail('INVALID_BINDING');
  }
  if (
    query.source !== source.id ||
    !source.enabled ||
    !source.allowedExecutionModes.some((mode) => mode === requestedModeString)
  ) {
    fail('INVALID_BINDING');
  }
  if (!source.allowedConsumerIds.includes(consumer.id)) {
    fail('INVALID_BINDING');
  }

  return Object.freeze({
    entryVersion: AUTHORITATIVE_POLICY_ENTRY_VERSION,
    policyId: record.policyId,
    enabled: record.enabled,
    tenantId: query.tenantId,
    actorType: query.actor.actorType,
    actorId: query.actor.actorId,
    consumerId: consumer.id,
    source: source.id,
    requestedMode: query.requestedMode as 'SHADOW_ONLY' | 'EVALUATION',
    effectiveExecutionMode: query.requestedMode as 'SHADOW_ONLY' | 'EVALUATION',
    effectiveTimeoutMs: record.effectiveTimeoutMs,
    authorizationPolicyVersion:
      record.authorizationPolicyVersion,
    ...(record.description !== undefined
      ? { description: record.description }
      : {}),
  });
}

export function validateAuthoritativePolicyEntryV1(
  value: unknown
): AuthoritativePolicyEntryV1 {
  return cloneAuthoritativePolicyEntryV1(value);
}

export function validateAuthoritativePolicySnapshotV1(
  value: unknown
): AuthoritativePolicySnapshotV1 {
  const record = getClosedRecord(value, SNAPSHOT_KEYS);
  if (!record) {
    fail('INVALID_SNAPSHOT');
  }
  if (
    record.schemaVersion !==
    AUTHORITATIVE_POLICY_SNAPSHOT_SCHEMA_VERSION
  ) {
    fail('UNSUPPORTED_VERSION');
  }
  if (
    record.producerVersion !==
    AUTHORITATIVE_POLICY_PRODUCER_VERSION
  ) {
    fail('INVALID_VERSION');
  }
  if (!isCanonicalVersion(record.authorizationPolicyVersion)) {
    fail('INVALID_VERSION');
  }
  if (
    record.trustedRegistryVersion !==
      TRUSTED_COMPOSITION_REGISTRY_VERSION ||
    TRUSTED_CONSUMER_REGISTRY_V1.schemaVersion !==
      TRUSTED_COMPOSITION_REGISTRY_VERSION ||
    TRUSTED_SOURCE_REGISTRY_V1.schemaVersion !==
      TRUSTED_COMPOSITION_REGISTRY_VERSION
  ) {
    fail('REGISTRY_INCOMPATIBLE');
  }

  let inputEntries: readonly unknown[];
  try {
    if (!Array.isArray(record.entries) || record.entries.length === 0) {
      fail('INVALID_SNAPSHOT');
    }
    inputEntries = [...record.entries];
  } catch (error) {
    if (
      error instanceof AuthoritativePolicySnapshotContractError
    ) {
      throw error;
    }
    fail('UNCLONABLE_INPUT');
  }

  const entries: AuthoritativePolicyEntryV1[] = [];
  try {
    for (const entry of inputEntries) {
      entries.push(
        cloneAuthoritativePolicyEntryV1(
          entry,
          record.authorizationPolicyVersion
        )
      );
    }
  } catch (error) {
    if (
      error instanceof AuthoritativePolicySnapshotContractError
    ) {
      throw error;
    }
    fail('UNCLONABLE_INPUT');
  }

  const policyIds = new Set<string>();
  const lookupKeys = new Set<string>();
  for (const entry of entries) {
    const lookupKey =
      createAuthoritativePolicyLookupKeyV1(entry);
    if (
      policyIds.has(entry.policyId) ||
      lookupKeys.has(lookupKey)
    ) {
      fail('DUPLICATE_ENTRY');
    }
    policyIds.add(entry.policyId);
    lookupKeys.add(lookupKey);
  }

  entries.sort((left, right) => {
    const leftKey = createAuthoritativePolicyLookupKeyV1(left);
    const rightKey = createAuthoritativePolicyLookupKeyV1(right);
    if (leftKey < rightKey) {
      return -1;
    }
    if (leftKey > rightKey) {
      return 1;
    }
    return left.policyId < right.policyId
      ? -1
      : left.policyId > right.policyId
        ? 1
        : 0;
  });

  return Object.freeze({
    schemaVersion: AUTHORITATIVE_POLICY_SNAPSHOT_SCHEMA_VERSION,
    producerVersion: AUTHORITATIVE_POLICY_PRODUCER_VERSION,
    authorizationPolicyVersion:
      record.authorizationPolicyVersion,
    trustedRegistryVersion: TRUSTED_COMPOSITION_REGISTRY_VERSION,
    entries: Object.freeze(entries),
  });
}
