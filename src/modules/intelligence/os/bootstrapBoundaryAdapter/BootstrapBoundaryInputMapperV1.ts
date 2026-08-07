import {
  BoundaryContextContractError,
  GovernedBoundaryError,
} from '../boundary/errors';
import type {
  BootstrapBoundaryBridgeAuthorityV1,
  BootstrapBoundaryBridgeEnvelopeV1,
} from '../bootstrapBoundaryBridge/types';
import type { PipelineBootstrapActorType } from '../bootstrap/provenance';
import {
  PIPELINE_BOOTSTRAP_SCHEMA_VERSION,
  type PipelineBootstrapInput,
  type PipelineBootstrapPolicy,
} from '../bootstrap/types';
import {
  validatePipelineBootstrapInput,
  validatePipelineBootstrapPolicy,
  validatePipelineBootstrapTargetScenario,
} from '../bootstrap/validators';

type PlainRecord = Readonly<Record<string, unknown>>;

const BUSINESS_PAYLOAD_REQUIRED_KEYS = [
  'schemaVersion',
  'targetScenario',
  'facts',
  'policy',
] as const;

const BUSINESS_PAYLOAD_OPTIONAL_KEYS = [
  'locale',
  'timezone',
] as const;

const BUSINESS_FACT_KEYS = [
  'factId',
  'category',
  'value',
  'valueType',
  'provenance',
  'reliability',
  'directness',
  'polarity',
  'observedAt',
  'schemaVersion',
] as const;

const BUSINESS_PROVENANCE_REQUIRED_KEYS = [
  'sourceType',
  'sourceId',
  'collectionMethod',
  'capturedAt',
  'reliability',
  'directness',
  'actorType',
] as const;

const BUSINESS_PROVENANCE_OPTIONAL_KEYS = [
  'inferenceRuleId',
] as const;

function isPlainRecord(value: unknown): value is PlainRecord {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value)
  ) {
    return false;
  }

  try {
    const prototype = Object.getPrototypeOf(value);
    return (
      prototype === Object.prototype ||
      prototype === null
    );
  } catch {
    return false;
  }
}

function getClosedPlainRecord(
  value: unknown,
  requiredKeys: readonly string[],
  optionalKeys: readonly string[] = []
): PlainRecord | undefined {
  if (!isPlainRecord(value)) {
    return undefined;
  }

  try {
    const allowedKeys = [...requiredKeys, ...optionalKeys];
    const ownKeys = Reflect.ownKeys(value);

    if (
      ownKeys.some(
        (key) =>
          typeof key !== 'string' ||
          !allowedKeys.includes(key)
      ) ||
      requiredKeys.some(
        (key) =>
          !Object.prototype.hasOwnProperty.call(value, key)
      )
    ) {
      return undefined;
    }

    for (const key of ownKeys) {
      if (typeof key !== 'string') {
        return undefined;
      }

      const descriptor = Object.getOwnPropertyDescriptor(
        value,
        key
      );

      if (
        !descriptor ||
        !descriptor.enumerable ||
        !Object.prototype.hasOwnProperty.call(
          descriptor,
          'value'
        )
      ) {
        return undefined;
      }
    }

    return value;
  } catch {
    return undefined;
  }
}

function deepFreeze<T>(value: T): T {
  if (
    value !== null &&
    typeof value === 'object' &&
    !Object.isFrozen(value)
  ) {
    for (const nested of Object.values(value)) {
      deepFreeze(nested);
    }

    Object.freeze(value);
  }

  return value;
}

function invalidBusinessPayload(): never {
  throw new GovernedBoundaryError(
    'INVALID_REQUEST',
    'Bootstrap business payload is invalid',
    false
  );
}

function parseCanonicalTimestamp(
  value: string
): number | undefined {
  const milliseconds = Date.parse(value);

  if (
    !Number.isSafeInteger(milliseconds) ||
    milliseconds < 0
  ) {
    return undefined;
  }

  try {
    return new Date(milliseconds).toISOString() === value
      ? milliseconds
      : undefined;
  } catch {
    return undefined;
  }
}

function translateBootstrapActor(
  authority: BootstrapBoundaryBridgeAuthorityV1
): PipelineBootstrapActorType {
  if (authority.actor.actorType === 'HUMAN') {
    return 'USER';
  }

  if (authority.actor.actorType === 'SYSTEM') {
    return 'SYSTEM';
  }

  throw new GovernedBoundaryError(
    'INVALID_ACTOR_CONTEXT',
    'Authoritative actor is not supported by Pipeline Bootstrap',
    false
  );
}

function mapBusinessFact(
  value: unknown,
  authority: BootstrapBoundaryBridgeAuthorityV1
): unknown {
  const fact = getClosedPlainRecord(
    value,
    BUSINESS_FACT_KEYS
  );

  if (!fact) {
    invalidBusinessPayload();
  }

  const provenance = getClosedPlainRecord(
    fact.provenance,
    BUSINESS_PROVENANCE_REQUIRED_KEYS,
    BUSINESS_PROVENANCE_OPTIONAL_KEYS
  );

  if (!provenance) {
    invalidBusinessPayload();
  }

  return {
    factId: fact.factId,
    category: fact.category,
    value: fact.value,
    valueType: fact.valueType,
    provenance: {
      sourceType: provenance.sourceType,
      sourceId: provenance.sourceId,
      collectionMethod: provenance.collectionMethod,
      capturedAt: provenance.capturedAt,
      reliability: provenance.reliability,
      directness: provenance.directness,
      actorType: provenance.actorType,
      tenantId: authority.tenantId,
      correlationId: authority.correlationId,
      ...(provenance.inferenceRuleId !== undefined
        ? { inferenceRuleId: provenance.inferenceRuleId }
        : {}),
    },
    reliability: fact.reliability,
    directness: fact.directness,
    polarity: fact.polarity,
    observedAt: fact.observedAt,
    schemaVersion: fact.schemaVersion,
  };
}

function parseBusinessPayload(
  envelope: BootstrapBoundaryBridgeEnvelopeV1,
  bootstrapActor: PipelineBootstrapActorType
): PipelineBootstrapInput {
  const payload = getClosedPlainRecord(
    envelope.businessPayload,
    BUSINESS_PAYLOAD_REQUIRED_KEYS,
    BUSINESS_PAYLOAD_OPTIONAL_KEYS
  );

  if (
    !payload ||
    payload.schemaVersion !==
      PIPELINE_BOOTSTRAP_SCHEMA_VERSION ||
    !Array.isArray(payload.facts) ||
    payload.facts.length === 0
  ) {
    invalidBusinessPayload();
  }

  const policyResult =
    validatePipelineBootstrapPolicy(payload.policy);

  if (!policyResult.valid) {
    invalidBusinessPayload();
  }

  const policy: PipelineBootstrapPolicy =
    policyResult.value;

  const scenarioResult =
    validatePipelineBootstrapTargetScenario(
      payload.targetScenario,
      policy
    );

  if (!scenarioResult.valid) {
    invalidBusinessPayload();
  }

  const requestedAt = parseCanonicalTimestamp(
    envelope.authority.initiatedAt
  );

  if (requestedAt === undefined) {
    throw new BoundaryContextContractError(
      'BOUNDARY_AUTHORITATIVE_CONTEXT_INVALID'
    );
  }

  const candidate: unknown = {
    bootstrapId: envelope.authority.requestId,
    tenantId: envelope.authority.tenantId,
    correlationId: envelope.authority.correlationId,
    targetScenario: scenarioResult.value,
    facts: payload.facts.map((fact) =>
      mapBusinessFact(fact, envelope.authority)
    ),
    context: {
      requestedAt,
      requestedBy: {
        requesterId:
          envelope.authority.actor.actorId,
        actorType: bootstrapActor,
      },
      ...(payload.locale !== undefined
        ? { locale: payload.locale }
        : {}),
      ...(payload.timezone !== undefined
        ? { timezone: payload.timezone }
        : {}),
      source: envelope.authority.source,
    },
    policy,
    schemaVersion:
      PIPELINE_BOOTSTRAP_SCHEMA_VERSION,
  };

  const inputResult =
    validatePipelineBootstrapInput(candidate);

  if (!inputResult.valid) {
    invalidBusinessPayload();
  }

  return deepFreeze(inputResult.value);
}

export function mapBootstrapBoundaryEnvelopeToPipelineInputV1(
  envelope: BootstrapBoundaryBridgeEnvelopeV1
): PipelineBootstrapInput {
  const bootstrapActor =
    translateBootstrapActor(envelope.authority);

  return parseBusinessPayload(
    envelope,
    bootstrapActor
  );
}
