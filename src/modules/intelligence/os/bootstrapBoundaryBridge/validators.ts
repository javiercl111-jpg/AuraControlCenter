import type { InternalPayloadValue } from '../boundary/ports';
import {
  BOUNDARY_RESERVED_AUTHORITY_FIELDS,
  type AuthoritativeExecutionContextV1,
  type BoundaryActorTypeV1,
} from '../boundary/types';
import {
  createSafeInternalPayload,
  validateAuthoritativeExecutionContextV1,
  validateBoundaryActorReferenceV1,
} from '../boundary/validators';
import type { PipelineBootstrapPolicy } from '../bootstrap/types';
import {
  validatePipelineBootstrapPolicy,
  validatePipelineBootstrapState,
} from '../bootstrap/validators';
import {
  throwBootstrapBoundaryBridgeContractError,
  type BootstrapBoundaryBridgeContractIssue,
} from './errors';
import {
  BOOTSTRAP_BOUNDARY_BRIDGE_ACTOR_TYPES,
  BOOTSTRAP_BOUNDARY_BRIDGE_SCHEMA_VERSION,
  type BootstrapBoundaryBridgeActorType,
  type BootstrapBoundaryBridgeActorV1,
  type BootstrapBoundaryBridgeAuthorityV1,
  type BootstrapBoundaryBridgeEnvelopeV1,
  type BootstrapBoundaryBridgePublicErrorV1,
  type BootstrapBoundaryBridgeResultV1,
} from './types';

type PlainRecord = Readonly<Record<string, unknown>>;

const ACTOR_KEYS = ['actorType', 'actorId'] as const;
const AUTHORITY_KEYS = [
  'schemaVersion',
  'tenantId',
  'actor',
  'consumerId',
  'source',
  'requestId',
  'correlationId',
  'executionMode',
  'authorizationPolicyVersion',
  'initiatedAt',
  'authoritativeDeadlineAt',
] as const;
const ENVELOPE_REQUIRED_KEYS = [
  'schemaVersion',
  'authority',
  'businessPayload',
] as const;
const ENVELOPE_OPTIONAL_KEYS = ['cancellationSignal'] as const;
const ACCEPTED_RESULT_KEYS = [
  'schemaVersion',
  'bridgeStatus',
  'authority',
  'bootstrapState',
] as const;
const REJECTED_RESULT_KEYS = [
  ...ACCEPTED_RESULT_KEYS,
  'publicError',
] as const;
const PUBLIC_ERROR_KEYS = [
  'code',
  'message',
  'retryable',
] as const;

function getPlainRecord(value: unknown): PlainRecord | undefined {
  try {
    if (
      typeof value !== 'object' ||
      value === null ||
      Array.isArray(value)
    ) {
      return undefined;
    }
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null
      ? value as PlainRecord
      : undefined;
  } catch {
    return undefined;
  }
}

function getClosedPlainRecord(
  value: unknown,
  requiredKeys: readonly string[],
  optionalKeys: readonly string[] = []
): PlainRecord | undefined {
  try {
    const record = getPlainRecord(value);
    if (!record) {
      return undefined;
    }
    const allowedKeys = [...requiredKeys, ...optionalKeys];
    const ownKeys = Reflect.ownKeys(record);
    if (
      ownKeys.some(
        (key) =>
          typeof key !== 'string' || !allowedKeys.includes(key)
      ) ||
      requiredKeys.some(
        (key) =>
          !Object.prototype.hasOwnProperty.call(record, key)
      )
    ) {
      return undefined;
    }
    for (const key of ownKeys) {
      if (typeof key !== 'string') {
        return undefined;
      }
      const descriptor = Object.getOwnPropertyDescriptor(record, key);
      if (
        !descriptor ||
        !descriptor.enumerable ||
        !Object.prototype.hasOwnProperty.call(descriptor, 'value')
      ) {
        return undefined;
      }
    }
    return record;
  } catch {
    return undefined;
  }
}

function bridgeError(
  issue: BootstrapBoundaryBridgeContractIssue
): never {
  return throwBootstrapBoundaryBridgeContractError(issue);
}

function isBridgeActorType(
  value: unknown
): value is BootstrapBoundaryBridgeActorType {
  return (
    typeof value === 'string' &&
    BOOTSTRAP_BOUNDARY_BRIDGE_ACTOR_TYPES.some(
      (candidate) => candidate === value
    )
  );
}

function toBoundaryActorType(
  actorType: BootstrapBoundaryBridgeActorType
): BoundaryActorTypeV1 {
  if (actorType === 'HUMAN') {
    return 'USER';
  }
  return actorType;
}

function toBridgeActorType(
  actorType: BoundaryActorTypeV1
): BootstrapBoundaryBridgeActorType {
  if (actorType === 'USER') {
    return 'HUMAN';
  }
  return actorType;
}

function createFrozenBridgeActor(
  actorType: BootstrapBoundaryBridgeActorType,
  actorId: string
): BootstrapBoundaryBridgeActorV1 {
  if (actorType === 'HUMAN') {
    return Object.freeze({
      actorType: 'HUMAN',
      actorId,
    });
  }
  if (actorType === 'SERVICE') {
    return Object.freeze({
      actorType: 'SERVICE',
      actorId,
    });
  }
  return Object.freeze({
    actorType: 'SYSTEM',
    actorId,
  });
}

function validateBridgeActor(
  value: unknown
): BootstrapBoundaryBridgeActorV1 {
  const record = getClosedPlainRecord(value, ACTOR_KEYS);
  if (
    !record ||
    !isBridgeActorType(record.actorType) ||
    typeof record.actorId !== 'string'
  ) {
    bridgeError('BRIDGE_AUTHORITY_INVALID');
  }
  try {
    const boundaryActor = validateBoundaryActorReferenceV1({
      actorType: toBoundaryActorType(record.actorType),
      actorId: record.actorId,
    });
    return createFrozenBridgeActor(
      record.actorType,
      boundaryActor.actorId
    );
  } catch {
    bridgeError('BRIDGE_AUTHORITY_INVALID');
  }
}

function validateBoundaryAuthority(
  value: unknown
): AuthoritativeExecutionContextV1 {
  try {
    return validateAuthoritativeExecutionContextV1(value);
  } catch {
    bridgeError('BRIDGE_AUTHORITY_INVALID');
  }
}

function createBridgeAuthorityFromValidatedContext(
  context: AuthoritativeExecutionContextV1
): BootstrapBoundaryBridgeAuthorityV1 {
  const actor = createFrozenBridgeActor(
    toBridgeActorType(context.actor.actorType),
    context.actor.actorId
  );
  return Object.freeze({
    schemaVersion: BOOTSTRAP_BOUNDARY_BRIDGE_SCHEMA_VERSION,
    tenantId: context.tenantId,
    actor,
    consumerId: context.consumerId,
    source: context.source,
    requestId: context.requestId,
    correlationId: context.correlationId,
    executionMode: context.executionMode,
    authorizationPolicyVersion:
      context.authorizationPolicyVersion,
    initiatedAt: context.initiatedAt,
    authoritativeDeadlineAt:
      context.authoritativeDeadlineAt,
  });
}

export function createBootstrapBoundaryBridgeAuthorityV1(
  authoritativeContext: unknown
): BootstrapBoundaryBridgeAuthorityV1 {
  return createBridgeAuthorityFromValidatedContext(
    validateBoundaryAuthority(authoritativeContext)
  );
}

export function validateBootstrapBoundaryBridgeAuthorityV1(
  value: unknown
): BootstrapBoundaryBridgeAuthorityV1 {
  const record = getClosedPlainRecord(value, AUTHORITY_KEYS);
  if (!record) {
    bridgeError('BRIDGE_AUTHORITY_INVALID');
  }
  const actor = validateBridgeActor(record.actor);
  const boundaryContext = validateBoundaryAuthority({
    schemaVersion: record.schemaVersion,
    tenantId: record.tenantId,
    actor: {
      actorType: toBoundaryActorType(actor.actorType),
      actorId: actor.actorId,
    },
    consumerId: record.consumerId,
    source: record.source,
    requestId: record.requestId,
    correlationId: record.correlationId,
    executionMode: record.executionMode,
    authorizationPolicyVersion:
      record.authorizationPolicyVersion,
    initiatedAt: record.initiatedAt,
    authoritativeDeadlineAt:
      record.authoritativeDeadlineAt,
  });
  return Object.freeze({
    schemaVersion: BOOTSTRAP_BOUNDARY_BRIDGE_SCHEMA_VERSION,
    tenantId: boundaryContext.tenantId,
    actor,
    consumerId: boundaryContext.consumerId,
    source: boundaryContext.source,
    requestId: boundaryContext.requestId,
    correlationId: boundaryContext.correlationId,
    executionMode: boundaryContext.executionMode,
    authorizationPolicyVersion:
      boundaryContext.authorizationPolicyVersion,
    initiatedAt: boundaryContext.initiatedAt,
    authoritativeDeadlineAt:
      boundaryContext.authoritativeDeadlineAt,
  });
}

function cloneBusinessPayload(
  value: unknown
): InternalPayloadValue {
  const rootRecord = getPlainRecord(value);
  if (
    rootRecord &&
    BOUNDARY_RESERVED_AUTHORITY_FIELDS.some((field) =>
      Object.prototype.hasOwnProperty.call(rootRecord, field)
    )
  ) {
    bridgeError('BRIDGE_PAYLOAD_INVALID');
  }
  try {
    return createSafeInternalPayload(value);
  } catch {
    bridgeError('BRIDGE_PAYLOAD_INVALID');
  }
}

function isNativeAbortSignal(
  value: unknown
): value is AbortSignal {
  return (
    typeof AbortSignal !== 'undefined' &&
    value instanceof AbortSignal
  );
}

export function createBootstrapBoundaryBridgeEnvelopeV1(
  authority: unknown,
  businessPayload: unknown,
  cancellationSignal?: unknown
): BootstrapBoundaryBridgeEnvelopeV1 {
  return validateBootstrapBoundaryBridgeEnvelopeV1({
    schemaVersion: BOOTSTRAP_BOUNDARY_BRIDGE_SCHEMA_VERSION,
    authority,
    businessPayload,
    ...(cancellationSignal !== undefined
      ? { cancellationSignal }
      : {}),
  });
}

export function validateBootstrapBoundaryBridgeEnvelopeV1(
  value: unknown
): BootstrapBoundaryBridgeEnvelopeV1 {
  const record = getClosedPlainRecord(
    value,
    ENVELOPE_REQUIRED_KEYS,
    ENVELOPE_OPTIONAL_KEYS
  );
  if (
    !record ||
    record.schemaVersion !==
      BOOTSTRAP_BOUNDARY_BRIDGE_SCHEMA_VERSION
  ) {
    bridgeError('BRIDGE_PAYLOAD_INVALID');
  }
  if (
    record.cancellationSignal !== undefined &&
    !isNativeAbortSignal(record.cancellationSignal)
  ) {
    bridgeError('BRIDGE_CANCELLATION_SIGNAL_INVALID');
  }
  const authority =
    validateBootstrapBoundaryBridgeAuthorityV1(record.authority);
  const businessPayload = cloneBusinessPayload(
    record.businessPayload
  );
  return Object.freeze({
    schemaVersion: BOOTSTRAP_BOUNDARY_BRIDGE_SCHEMA_VERSION,
    authority,
    businessPayload,
    ...(record.cancellationSignal !== undefined
      ? { cancellationSignal: record.cancellationSignal }
      : {}),
  });
}

function cloneBootstrapState(value: unknown): unknown {
  try {
    return createSafeInternalPayload(value);
  } catch {
    bridgeError('BRIDGE_BOOTSTRAP_STATE_INVALID');
  }
}

function validatePolicy(
  value: unknown
): PipelineBootstrapPolicy {
  const result = validatePipelineBootstrapPolicy(value);
  if (!result.valid) {
    bridgeError('BRIDGE_BOOTSTRAP_STATE_INVALID');
  }
  return result.value;
}

function createRejectedPublicError():
  BootstrapBoundaryBridgePublicErrorV1 {
  return Object.freeze({
    code: 'BOOTSTRAP_REJECTED',
    message: 'Bootstrap request was rejected',
    retryable: false,
  });
}

function validateRejectedPublicError(
  value: unknown
): BootstrapBoundaryBridgePublicErrorV1 {
  const record = getClosedPlainRecord(value, PUBLIC_ERROR_KEYS);
  if (
    !record ||
    record.code !== 'BOOTSTRAP_REJECTED' ||
    record.message !== 'Bootstrap request was rejected' ||
    record.retryable !== false
  ) {
    bridgeError('BRIDGE_BOOTSTRAP_STATE_INVALID');
  }
  return createRejectedPublicError();
}

function assertStateContextMatches(
  authority: BootstrapBoundaryBridgeAuthorityV1,
  state: BootstrapBoundaryBridgeResultV1['bootstrapState']
): void {
  if (
    state.tenantId !== undefined &&
    state.tenantId !== authority.tenantId
  ) {
    bridgeError('BRIDGE_RESULT_CONTEXT_MISMATCH');
  }
  if (
    state.correlationId !== undefined &&
    state.correlationId !== authority.correlationId
  ) {
    bridgeError('BRIDGE_RESULT_CONTEXT_MISMATCH');
  }
}

export function createBootstrapBoundaryBridgeResultV1(
  authority: unknown,
  bootstrapState: unknown,
  policy: PipelineBootstrapPolicy
): BootstrapBoundaryBridgeResultV1 {
  const stateRecord = getClosedPlainRecord(
    bootstrapState,
    ['status'],
    [
      'bootstrapId',
      'tenantId',
      'correlationId',
      'initialDomainState',
      'provenanceSummary',
      'errors',
      'bootstrapVersion',
      'createdAt',
    ]
  );
  if (!stateRecord) {
    bridgeError('BRIDGE_BOOTSTRAP_STATE_INVALID');
  }
  return validateBootstrapBoundaryBridgeResultV1(
    {
      schemaVersion:
        BOOTSTRAP_BOUNDARY_BRIDGE_SCHEMA_VERSION,
      bridgeStatus: stateRecord.status,
      authority,
      bootstrapState,
      ...(stateRecord.status === 'REJECTED'
        ? { publicError: createRejectedPublicError() }
        : {}),
    },
    policy
  );
}

export function validateBootstrapBoundaryBridgeResultV1(
  value: unknown,
  policy: PipelineBootstrapPolicy
): BootstrapBoundaryBridgeResultV1 {
  const candidate = getClosedPlainRecord(
    value,
    value !== null &&
      typeof value === 'object' &&
      Object.prototype.hasOwnProperty.call(value, 'bridgeStatus') &&
      Object.getOwnPropertyDescriptor(value, 'bridgeStatus')
        ?.value === 'REJECTED'
      ? REJECTED_RESULT_KEYS
      : ACCEPTED_RESULT_KEYS
  );
  if (
    !candidate ||
    candidate.schemaVersion !==
      BOOTSTRAP_BOUNDARY_BRIDGE_SCHEMA_VERSION ||
    (
      candidate.bridgeStatus !== 'ACCEPTED' &&
      candidate.bridgeStatus !== 'REJECTED'
    )
  ) {
    bridgeError('BRIDGE_BOOTSTRAP_STATE_INVALID');
  }

  const authority =
    validateBootstrapBoundaryBridgeAuthorityV1(
      candidate.authority
    );
  const stateSnapshot = cloneBootstrapState(
    candidate.bootstrapState
  );
  const stateResult = validatePipelineBootstrapState(
    stateSnapshot,
    validatePolicy(policy)
  );
  if (!stateResult.valid) {
    bridgeError('BRIDGE_BOOTSTRAP_STATE_INVALID');
  }
  const bootstrapState = stateResult.value;
  if (candidate.bridgeStatus !== bootstrapState.status) {
    bridgeError('BRIDGE_BOOTSTRAP_STATE_CONTRADICTION');
  }
  assertStateContextMatches(authority, bootstrapState);

  if (bootstrapState.status === 'ACCEPTED') {
    return Object.freeze({
      schemaVersion:
        BOOTSTRAP_BOUNDARY_BRIDGE_SCHEMA_VERSION,
      bridgeStatus: 'ACCEPTED',
      authority,
      bootstrapState,
    });
  }

  return Object.freeze({
    schemaVersion: BOOTSTRAP_BOUNDARY_BRIDGE_SCHEMA_VERSION,
    bridgeStatus: 'REJECTED',
    authority,
    bootstrapState,
    publicError: validateRejectedPublicError(
      candidate.publicError
    ),
  });
}
