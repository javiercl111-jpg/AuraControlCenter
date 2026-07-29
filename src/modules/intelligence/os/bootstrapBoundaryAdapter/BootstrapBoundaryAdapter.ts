import type {
  BoundaryClockPort,
  BoundaryExecutionPort,
  InternalExecutionInput,
  InternalExecutionResult,
} from '../boundary/ports';
import {
  BoundaryContextContractError,
  GovernedBoundaryError,
} from '../boundary/errors';
import type {
  BootstrapBoundaryBridgeAuthorityV1,
  BootstrapBoundaryBridgeEnvelopeV1,
  BootstrapBoundaryBridgeResultV1,
} from '../bootstrapBoundaryBridge/types';
import {
  createBootstrapBoundaryBridgeAuthorityV1,
  createBootstrapBoundaryBridgeEnvelopeV1,
  createBootstrapBoundaryBridgeResultV1,
} from '../bootstrapBoundaryBridge/validators';
import type { PipelineBootstrapPort } from '../bootstrap/ports';
import type {
  PipelineBootstrapActorType,
} from '../bootstrap/provenance';
import {
  PIPELINE_BOOTSTRAP_SCHEMA_VERSION,
  type PipelineBootstrapInput,
  type PipelineBootstrapPolicy,
  type PipelineBootstrapState,
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

export interface BootstrapBoundaryAdapterDependencies {
  readonly bootstrapper: PipelineBootstrapPort;
  readonly clock: BoundaryClockPort;
}

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

function parseCanonicalTimestamp(value: string): number | undefined {
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
  const fact = getClosedPlainRecord(value, BUSINESS_FACT_KEYS);
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
    payload.schemaVersion !== PIPELINE_BOOTSTRAP_SCHEMA_VERSION ||
    !Array.isArray(payload.facts) ||
    payload.facts.length === 0
  ) {
    invalidBusinessPayload();
  }

  const policyResult = validatePipelineBootstrapPolicy(
    payload.policy
  );
  if (!policyResult.valid) {
    invalidBusinessPayload();
  }
  const policy: PipelineBootstrapPolicy = policyResult.value;
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
        requesterId: envelope.authority.actor.actorId,
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
    schemaVersion: PIPELINE_BOOTSTRAP_SCHEMA_VERSION,
  };
  const inputResult = validatePipelineBootstrapInput(candidate);
  if (!inputResult.valid) {
    invalidBusinessPayload();
  }
  return deepFreeze(inputResult.value);
}

function adaptBridgeResult(
  result: BootstrapBoundaryBridgeResultV1
): InternalExecutionResult {
  if (result.bridgeStatus === 'ACCEPTED') {
    return Object.freeze({
      executionId: result.bootstrapState.bootstrapId,
      sessionId: result.authority.correlationId,
      status: 'SUCCEEDED',
      rawData: result,
    });
  }
  const errors = Object.freeze([
    Object.freeze({
      code: result.publicError.code,
      message: result.publicError.message,
    }),
  ]);
  return Object.freeze({
    executionId: result.bootstrapState.bootstrapId,
    sessionId: result.authority.correlationId,
    status: 'FAILED',
    rawData: result,
    errors,
  });
}

export class BootstrapBoundaryAdapter
  implements BoundaryExecutionPort {
  private readonly bootstrapper: PipelineBootstrapPort;
  private readonly clock: BoundaryClockPort;

  constructor(
    dependencies: BootstrapBoundaryAdapterDependencies
  ) {
    this.bootstrapper = dependencies.bootstrapper;
    this.clock = dependencies.clock;
  }

  public async execute(
    input: InternalExecutionInput,
    signal?: AbortSignal
  ): Promise<InternalExecutionResult> {
    this.assertNotCancelled(signal);
    const authority = this.createAuthority(input);
    this.assertCanProceed(authority, signal);
    if (input.sessionId !== authority.correlationId) {
      throw new BoundaryContextContractError(
        'BOUNDARY_REQUEST_CONTEXT_MISMATCH'
      );
    }

    const envelope = this.createEnvelope(
      authority,
      input.payload,
      signal
    );
    const bootstrapActor = translateBootstrapActor(authority);
    const bootstrapInput = parseBusinessPayload(
      envelope,
      bootstrapActor
    );

    this.assertCanProceed(authority, signal);
    let bootstrapState: PipelineBootstrapState;
    try {
      bootstrapState = await this.bootstrapper.bootstrap(
        bootstrapInput,
        envelope.cancellationSignal
      );
    } catch {
      this.assertCanProceed(authority, signal);
      throw new GovernedBoundaryError(
        'EXECUTION_FAILED',
        'Pipeline Bootstrap execution failed',
        false
      );
    }
    this.assertCanProceed(authority, signal);
    const bridgeResult = this.createBridgeResult(
      authority,
      bootstrapState,
      bootstrapInput.policy
    );
    if (
      bridgeResult.bootstrapState.bootstrapId !==
      bootstrapInput.bootstrapId
    ) {
      throw new GovernedBoundaryError(
        'EXECUTION_FAILED',
        'Pipeline Bootstrap returned an invalid execution identity',
        false
      );
    }
    this.assertCanProceed(authority, signal);
    return adaptBridgeResult(bridgeResult);
  }

  private createAuthority(
    input: InternalExecutionInput
  ): BootstrapBoundaryBridgeAuthorityV1 {
    if (input.authoritativeContext === undefined) {
      throw new BoundaryContextContractError(
        'BOUNDARY_CONTEXT_MISSING'
      );
    }
    try {
      return createBootstrapBoundaryBridgeAuthorityV1(
        input.authoritativeContext
      );
    } catch {
      throw new BoundaryContextContractError(
        'BOUNDARY_AUTHORITATIVE_CONTEXT_INVALID'
      );
    }
  }

  private createEnvelope(
    authority: BootstrapBoundaryBridgeAuthorityV1,
    payload: unknown,
    signal: AbortSignal | undefined
  ): BootstrapBoundaryBridgeEnvelopeV1 {
    try {
      return createBootstrapBoundaryBridgeEnvelopeV1(
        authority,
        payload,
        signal
      );
    } catch {
      invalidBusinessPayload();
    }
  }

  private createBridgeResult(
    authority: BootstrapBoundaryBridgeAuthorityV1,
    bootstrapState: unknown,
    policy: PipelineBootstrapPolicy
  ): BootstrapBoundaryBridgeResultV1 {
    try {
      return createBootstrapBoundaryBridgeResultV1(
        authority,
        bootstrapState,
        policy
      );
    } catch {
      throw new GovernedBoundaryError(
        'EXECUTION_FAILED',
        'Pipeline Bootstrap returned an invalid result',
        false
      );
    }
  }

  private assertCanProceed(
    authority: BootstrapBoundaryBridgeAuthorityV1,
    signal: AbortSignal | undefined
  ): void {
    this.assertNotCancelled(signal);
    let currentTime: string;
    try {
      currentTime = this.clock.now();
    } catch {
      throw new BoundaryContextContractError(
        'BOUNDARY_AUTHORITATIVE_CONTEXT_INVALID'
      );
    }
    const currentMilliseconds =
      parseCanonicalTimestamp(currentTime);
    const deadlineMilliseconds = parseCanonicalTimestamp(
      authority.authoritativeDeadlineAt
    );
    if (
      currentMilliseconds === undefined ||
      deadlineMilliseconds === undefined
    ) {
      throw new BoundaryContextContractError(
        'BOUNDARY_AUTHORITATIVE_CONTEXT_INVALID'
      );
    }
    if (currentMilliseconds >= deadlineMilliseconds) {
      throw new GovernedBoundaryError(
        'TIMEOUT',
        'Authoritative execution deadline has expired',
        false
      );
    }
  }

  private assertNotCancelled(
    signal: AbortSignal | undefined
  ): void {
    if (signal?.aborted) {
      throw new GovernedBoundaryError(
        'CANCELLED',
        'Bootstrap boundary execution was cancelled',
        false
      );
    }
  }
}
