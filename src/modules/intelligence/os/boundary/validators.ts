import {
  AUTHORITATIVE_BOUNDARY_EXECUTION_MODES_V1,
  AUTHORITATIVE_BOUNDARY_POLICY_REASON_CODES_V1,
  AUTHORITATIVE_BOUNDARY_POLICY_SCHEMA_VERSION,
  AUTHORITATIVE_EXECUTION_CONTEXT_VERSION,
  BOUNDARY_ACTOR_TYPES_V1,
  BOUNDARY_INVOCATION_CONTEXT_VERSION,
  type AuthoritativeExecutionContextV1,
  type AuthoritativeBoundaryExecutionModeV1,
  type AuthoritativeBoundaryPolicyDecisionV1,
  type AuthoritativeBoundaryPolicyQueryV1,
  type AuthoritativeBoundaryPolicyReasonCodeV1,
  type BoundaryActorReferenceV1,
  type BoundaryActorTypeV1,
  type BoundaryExecutionMode,
  type BoundaryInvocationContextV1,
} from './types';
import type { InternalPayloadValue } from './ports';
import {
  BoundaryContextContractError,
  BoundaryPolicyContractError,
  GovernedBoundaryError,
  type BoundaryContextContractIssue,
  type BoundaryPolicyContractIssue,
  type BoundaryPublicErrorCode,
} from './errors';
import type { GovernedExecutionRequest } from './types';

export const MAX_BOUNDARY_PAYLOAD_DEPTH = 20;
export const MAX_BOUNDARY_AUTHORITY_IDENTIFIER_LENGTH = 180;
export const MAX_BOUNDARY_POLICY_VERSION_LENGTH = 64;
export const MAX_AUTHORITATIVE_BOUNDARY_POLICY_TIMEOUT_MS =
  2_147_483_647;

const SAFE_AUTHORITY_IDENTIFIER_PATTERN =
  /^[A-Za-z0-9][A-Za-z0-9._:/|-]{0,179}$/;
const SAFE_POLICY_VERSION_PATTERN =
  /^[A-Za-z0-9][A-Za-z0-9._:/|-]{0,63}$/;

const ACTOR_REFERENCE_KEYS = ['actorType', 'actorId'] as const;
const INVOCATION_CONTEXT_KEYS = [
  'schemaVersion',
  'tenantId',
  'actor',
  'consumerId',
  'source',
  'requestId',
  'correlationId',
] as const;
const AUTHORITATIVE_CONTEXT_KEYS = [
  ...INVOCATION_CONTEXT_KEYS,
  'executionMode',
  'initiatedAt',
  'authoritativeDeadlineAt',
  'authorizationPolicyVersion',
] as const;
const AUTHORITATIVE_POLICY_QUERY_KEYS = [
  'schemaVersion',
  'tenantId',
  'consumerId',
  'source',
  'requestedMode',
  'actor',
] as const;
const AUTHORITATIVE_POLICY_DECISION_KEYS = [
  'schemaVersion',
  'authorizationPolicyVersion',
  'evaluatedTenantId',
  'evaluatedConsumerId',
  'evaluatedSource',
  'evaluatedActor',
  'requestedMode',
  'decision',
  'reasonCode',
] as const;
const AUTHORITATIVE_POLICY_ALLOWED_DECISION_KEYS = [
  ...AUTHORITATIVE_POLICY_DECISION_KEYS,
  'effectiveExecutionMode',
  'effectiveTimeoutMs',
] as const;

type ClosedRecord = Readonly<Record<string, unknown>>;

function deepFreezeBoundaryContract<T>(
  value: T,
  seen: WeakSet<object> = new WeakSet()
): T {
  if (typeof value !== 'object' || value === null || seen.has(value)) {
    return value;
  }
  seen.add(value);
  for (const nestedValue of Object.values(value)) {
    deepFreezeBoundaryContract(nestedValue, seen);
  }
  return Object.freeze(value);
}

function getClosedPlainRecord(
  value: unknown,
  allowedKeys: readonly string[]
): ClosedRecord | undefined {
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
    const ownKeys = Reflect.ownKeys(value);
    if (
      ownKeys.length !== allowedKeys.length ||
      ownKeys.some(
        (key) =>
          typeof key !== 'string' || !allowedKeys.includes(key)
      )
    ) {
      return undefined;
    }
    for (const key of allowedKeys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        !descriptor ||
        !descriptor.enumerable ||
        !Object.prototype.hasOwnProperty.call(descriptor, 'value')
      ) {
        return undefined;
      }
    }
    return value as ClosedRecord;
  } catch {
    return undefined;
  }
}

function isSafeAuthorityIdentifier(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= MAX_BOUNDARY_AUTHORITY_IDENTIFIER_LENGTH &&
    SAFE_AUTHORITY_IDENTIFIER_PATTERN.test(value)
  );
}

function isSafePolicyVersion(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= MAX_BOUNDARY_POLICY_VERSION_LENGTH &&
    SAFE_POLICY_VERSION_PATTERN.test(value)
  );
}

function isBoundaryActorTypeV1(
  value: unknown
): value is BoundaryActorTypeV1 {
  return (
    typeof value === 'string' &&
    BOUNDARY_ACTOR_TYPES_V1.some((candidate) => candidate === value)
  );
}

function isAuthoritativeBoundaryExecutionModeV1(
  value: unknown
): value is AuthoritativeBoundaryExecutionModeV1 {
  return (
    typeof value === 'string' &&
    AUTHORITATIVE_BOUNDARY_EXECUTION_MODES_V1.some(
      (mode) => mode === value
    )
  );
}

function isBoundaryExecutionMode(
  value: unknown
): value is BoundaryExecutionMode {
  return (
    value === 'DISABLED' ||
    value === 'SHADOW_ONLY' ||
    value === 'EVALUATION' ||
    value === 'PRODUCTIVE'
  );
}

function isAuthoritativeBoundaryPolicyReasonCodeV1(
  value: unknown
): value is AuthoritativeBoundaryPolicyReasonCodeV1 {
  return (
    typeof value === 'string' &&
    AUTHORITATIVE_BOUNDARY_POLICY_REASON_CODES_V1.some(
      (reasonCode) => reasonCode === value
    )
  );
}

function isCanonicalIsoTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }
  const milliseconds = Date.parse(value);
  return (
    Number.isFinite(milliseconds) &&
    new Date(milliseconds).toISOString() === value
  );
}

function contextContractError(
  issue: BoundaryContextContractIssue,
  publicCode?: BoundaryPublicErrorCode
): never {
  throw new BoundaryContextContractError(issue, publicCode);
}

function cloneActorReference(
  value: unknown,
  issue: BoundaryContextContractIssue
): BoundaryActorReferenceV1 {
  const record = getClosedPlainRecord(value, ACTOR_REFERENCE_KEYS);
  if (
    !record ||
    !isBoundaryActorTypeV1(record.actorType) ||
    !isSafeAuthorityIdentifier(record.actorId)
  ) {
    contextContractError(issue, 'INVALID_ACTOR_CONTEXT');
  }
  return deepFreezeBoundaryContract({
    actorType: record.actorType,
    actorId: record.actorId,
  });
}

function validateAuthorityBase(
  record: ClosedRecord,
  expectedVersion: '1',
  issue: BoundaryContextContractIssue
): {
  readonly tenantId: string;
  readonly actor: BoundaryActorReferenceV1;
  readonly consumerId: string;
  readonly source: string;
  readonly requestId: string;
  readonly correlationId: string;
} {
  if (
    record.schemaVersion !== expectedVersion ||
    !isSafeAuthorityIdentifier(record.tenantId) ||
    !isSafeAuthorityIdentifier(record.consumerId) ||
    !isSafeAuthorityIdentifier(record.source) ||
    !isSafeAuthorityIdentifier(record.requestId) ||
    !isSafeAuthorityIdentifier(record.correlationId)
  ) {
    contextContractError(issue);
  }
  return {
    tenantId: record.tenantId,
    actor: cloneActorReference(record.actor, issue),
    consumerId: record.consumerId,
    source: record.source,
    requestId: record.requestId,
    correlationId: record.correlationId,
  };
}

export function validateBoundaryActorReferenceV1(
  value: unknown
): BoundaryActorReferenceV1 {
  return cloneActorReference(
    value,
    'BOUNDARY_INVOCATION_CONTEXT_INVALID'
  );
}

export function validateBoundaryInvocationContextV1(
  value: unknown
): BoundaryInvocationContextV1 {
  const record = getClosedPlainRecord(value, INVOCATION_CONTEXT_KEYS);
  if (!record) {
    contextContractError('BOUNDARY_INVOCATION_CONTEXT_INVALID');
  }
  const base = validateAuthorityBase(
    record,
    BOUNDARY_INVOCATION_CONTEXT_VERSION,
    'BOUNDARY_INVOCATION_CONTEXT_INVALID'
  );
  return deepFreezeBoundaryContract({
    schemaVersion: BOUNDARY_INVOCATION_CONTEXT_VERSION,
    ...base,
  });
}

export function validateAuthoritativeExecutionContextV1(
  value: unknown
): AuthoritativeExecutionContextV1 {
  const record = getClosedPlainRecord(
    value,
    AUTHORITATIVE_CONTEXT_KEYS
  );
  if (!record) {
    contextContractError(
      'BOUNDARY_AUTHORITATIVE_CONTEXT_INVALID'
    );
  }
  const base = validateAuthorityBase(
    record,
    AUTHORITATIVE_EXECUTION_CONTEXT_VERSION,
    'BOUNDARY_AUTHORITATIVE_CONTEXT_INVALID'
  );
  if (
    !isAuthoritativeBoundaryExecutionModeV1(
      record.executionMode
    ) ||
    !isCanonicalIsoTimestamp(record.initiatedAt) ||
    !isCanonicalIsoTimestamp(record.authoritativeDeadlineAt) ||
    !isSafePolicyVersion(record.authorizationPolicyVersion)
  ) {
    contextContractError(
      'BOUNDARY_AUTHORITATIVE_CONTEXT_INVALID'
    );
  }
  const initiatedAtMilliseconds = Date.parse(record.initiatedAt);
  const deadlineAtMilliseconds = Date.parse(
    record.authoritativeDeadlineAt
  );
  if (
    !Number.isSafeInteger(initiatedAtMilliseconds) ||
    !Number.isSafeInteger(deadlineAtMilliseconds) ||
    initiatedAtMilliseconds < 0 ||
    deadlineAtMilliseconds < 0 ||
    deadlineAtMilliseconds < initiatedAtMilliseconds
  ) {
    contextContractError(
      'BOUNDARY_AUTHORITATIVE_CONTEXT_INVALID'
    );
  }
  return deepFreezeBoundaryContract({
    schemaVersion: AUTHORITATIVE_EXECUTION_CONTEXT_VERSION,
    ...base,
    executionMode: record.executionMode,
    initiatedAt: record.initiatedAt,
    authoritativeDeadlineAt: record.authoritativeDeadlineAt,
    authorizationPolicyVersion: record.authorizationPolicyVersion,
  });
}

function policyContractError(
  issue: BoundaryPolicyContractIssue
): never {
  throw new BoundaryPolicyContractError(issue);
}

function clonePolicyActor(
  value: unknown,
  issue: BoundaryPolicyContractIssue
): BoundaryActorReferenceV1 {
  try {
    return validateBoundaryActorReferenceV1(value);
  } catch {
    return policyContractError(issue);
  }
}

export function validateAuthoritativeBoundaryPolicyQueryV1(
  value: unknown
): AuthoritativeBoundaryPolicyQueryV1 {
  const record = getClosedPlainRecord(
    value,
    AUTHORITATIVE_POLICY_QUERY_KEYS
  );
  if (
    !record ||
    record.schemaVersion !==
      AUTHORITATIVE_BOUNDARY_POLICY_SCHEMA_VERSION ||
    !isSafeAuthorityIdentifier(record.tenantId) ||
    !isSafeAuthorityIdentifier(record.consumerId) ||
    !isSafeAuthorityIdentifier(record.source) ||
    !isBoundaryExecutionMode(record.requestedMode)
  ) {
    policyContractError('BOUNDARY_POLICY_QUERY_INVALID');
  }
  return deepFreezeBoundaryContract({
    schemaVersion: AUTHORITATIVE_BOUNDARY_POLICY_SCHEMA_VERSION,
    tenantId: record.tenantId,
    consumerId: record.consumerId,
    source: record.source,
    requestedMode: record.requestedMode,
    actor: clonePolicyActor(
      record.actor,
      'BOUNDARY_POLICY_QUERY_INVALID'
    ),
  });
}

function validateAuthoritativePolicyDecisionBase(
  record: ClosedRecord
): {
  readonly authorizationPolicyVersion: string;
  readonly evaluatedTenantId: string;
  readonly evaluatedConsumerId: string;
  readonly evaluatedSource: string;
  readonly evaluatedActor: BoundaryActorReferenceV1;
  readonly requestedMode: BoundaryExecutionMode;
} {
  if (
    record.schemaVersion !==
      AUTHORITATIVE_BOUNDARY_POLICY_SCHEMA_VERSION ||
    !isSafeAuthorityIdentifier(record.evaluatedTenantId) ||
    !isSafeAuthorityIdentifier(record.evaluatedConsumerId) ||
    !isSafeAuthorityIdentifier(record.evaluatedSource) ||
    !isBoundaryExecutionMode(record.requestedMode)
  ) {
    policyContractError('BOUNDARY_POLICY_CONTEXT_INVALID');
  }
  if (!isSafePolicyVersion(record.authorizationPolicyVersion)) {
    policyContractError('BOUNDARY_POLICY_VERSION_MISSING');
  }
  return {
    authorizationPolicyVersion:
      record.authorizationPolicyVersion,
    evaluatedTenantId: record.evaluatedTenantId,
    evaluatedConsumerId: record.evaluatedConsumerId,
    evaluatedSource: record.evaluatedSource,
    evaluatedActor: clonePolicyActor(
      record.evaluatedActor,
      'BOUNDARY_POLICY_CONTEXT_INVALID'
    ),
    requestedMode: record.requestedMode,
  };
}

export function validateAuthoritativeBoundaryPolicyDecisionV1(
  value: unknown
): AuthoritativeBoundaryPolicyDecisionV1 {
  const allowedRecord = getClosedPlainRecord(
    value,
    AUTHORITATIVE_POLICY_ALLOWED_DECISION_KEYS
  );
  if (allowedRecord) {
    const base = validateAuthoritativePolicyDecisionBase(
      allowedRecord
    );
    if (
      allowedRecord.decision !== 'ALLOWED' ||
      allowedRecord.reasonCode !== 'POLICY_ALLOWED'
    ) {
      policyContractError('BOUNDARY_POLICY_DECISION_INVALID');
    }
    if (
      !isAuthoritativeBoundaryExecutionModeV1(
        allowedRecord.effectiveExecutionMode
      )
    ) {
      policyContractError('BOUNDARY_POLICY_MODE_INVALID');
    }
    if (
      typeof allowedRecord.effectiveTimeoutMs !== 'number' ||
      !Number.isInteger(allowedRecord.effectiveTimeoutMs) ||
      allowedRecord.effectiveTimeoutMs <= 0 ||
      allowedRecord.effectiveTimeoutMs >
        MAX_AUTHORITATIVE_BOUNDARY_POLICY_TIMEOUT_MS
    ) {
      policyContractError('BOUNDARY_POLICY_DECISION_INVALID');
    }
    return deepFreezeBoundaryContract({
      schemaVersion:
        AUTHORITATIVE_BOUNDARY_POLICY_SCHEMA_VERSION,
      ...base,
      decision: 'ALLOWED',
      reasonCode: 'POLICY_ALLOWED',
      effectiveExecutionMode:
        allowedRecord.effectiveExecutionMode,
      effectiveTimeoutMs: allowedRecord.effectiveTimeoutMs,
    });
  }

  const deniedRecord = getClosedPlainRecord(
    value,
    AUTHORITATIVE_POLICY_DECISION_KEYS
  );
  if (!deniedRecord) {
    policyContractError('BOUNDARY_POLICY_DECISION_INVALID');
  }
  const base = validateAuthoritativePolicyDecisionBase(deniedRecord);
  if (
    deniedRecord.decision !== 'DENIED' ||
    !isAuthoritativeBoundaryPolicyReasonCodeV1(
      deniedRecord.reasonCode
    ) ||
    deniedRecord.reasonCode === 'POLICY_ALLOWED'
  ) {
    policyContractError('BOUNDARY_POLICY_DECISION_INVALID');
  }
  return deepFreezeBoundaryContract({
    schemaVersion: AUTHORITATIVE_BOUNDARY_POLICY_SCHEMA_VERSION,
    ...base,
    decision: 'DENIED',
    reasonCode: deniedRecord.reasonCode,
  });
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === null || proto === Object.prototype;
}

type PayloadTraversalResult =
  | { readonly safe: false; readonly reason: string }
  | { readonly safe: true; readonly cloned: false }
  | { readonly safe: true; readonly cloned: true; readonly value: InternalPayloadValue };

function acceptedPayloadValue(value: InternalPayloadValue): PayloadTraversalResult {
  return { safe: true, cloned: true, value };
}

function acceptedPayloadInspection(): PayloadTraversalResult {
  return { safe: true, cloned: false };
}

function rejectedPayloadValue(reason: string): PayloadTraversalResult {
  return { safe: false, reason };
}

function traverseJsonLikePayload(
  value: unknown,
  seen: WeakSet<object>,
  depth: number,
  shouldClone: boolean
): PayloadTraversalResult {
  if (depth > MAX_BOUNDARY_PAYLOAD_DEPTH) {
    return rejectedPayloadValue('Exceeds maximum allowed nesting depth');
  }

  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return shouldClone ? acceptedPayloadValue(value) : acceptedPayloadInspection();
  }

  if (typeof value === 'number') {
    return Number.isFinite(value)
      ? shouldClone
        ? acceptedPayloadValue(value)
        : acceptedPayloadInspection()
      : rejectedPayloadValue('Non-finite numbers are forbidden');
  }

  if (typeof value !== 'object') {
    return rejectedPayloadValue('Only JSON-like payload values are allowed');
  }

  if (seen.has(value)) {
    return rejectedPayloadValue('Circular reference detected');
  }
  seen.add(value);

  if (Array.isArray(value)) {
    if (Object.getOwnPropertySymbols(value).length > 0) {
      return rejectedPayloadValue('Symbol properties are forbidden');
    }

    const enumerableKeys = Object.keys(value);
    for (let i = 0; i < enumerableKeys.length; i++) {
      const key = enumerableKeys[i];
      const numericKey = Number(key);
      if (!Number.isInteger(numericKey) || numericKey < 0 || numericKey >= value.length || String(numericKey) !== key) {
        return rejectedPayloadValue('Custom array properties are forbidden');
      }
    }

    const clonedItems: InternalPayloadValue[] | undefined = shouldClone ? [] : undefined;
    for (let i = 0; i < value.length; i++) {
      if (!Object.prototype.hasOwnProperty.call(value, i)) {
        return rejectedPayloadValue('Sparse arrays are forbidden');
      }
      const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
      if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
        return rejectedPayloadValue('Array accessors are forbidden');
      }
      const childResult = traverseJsonLikePayload(descriptor.value, seen, depth + 1, shouldClone);
      if (!childResult.safe) {
        return childResult;
      }
      if (clonedItems && childResult.cloned) {
        clonedItems.push(childResult.value);
      }
    }
    seen.delete(value);
    return shouldClone
      ? acceptedPayloadValue(clonedItems ?? [])
      : acceptedPayloadInspection();
  }

  if (!isPlainObject(value)) {
    return rejectedPayloadValue('Class instances are forbidden');
  }

  if (Object.getOwnPropertySymbols(value).length > 0) {
    return rejectedPayloadValue('Symbol properties are forbidden');
  }

  const clonedObject: { [key: string]: InternalPayloadValue } | undefined = shouldClone ? {} : undefined;
  const keys = Object.getOwnPropertyNames(value);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const lowerKey = key.toLowerCase();
    if (lowerKey === '__proto__' || lowerKey === 'constructor' || lowerKey === 'prototype') {
      return rejectedPayloadValue('Dangerous property name');
    }

    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
      return rejectedPayloadValue('Object accessors and non-enumerable properties are forbidden');
    }

    const childResult = traverseJsonLikePayload(descriptor.value, seen, depth + 1, shouldClone);
    if (!childResult.safe) {
      return childResult;
    }
    if (clonedObject && childResult.cloned) {
      clonedObject[key] = childResult.value;
    }
  }
  seen.delete(value);
  return shouldClone
    ? acceptedPayloadValue(clonedObject ?? {})
    : acceptedPayloadInspection();
}

export function detectCircularOrDangerousKeys(
  obj: unknown,
  seen = new WeakSet<object>(),
  depth = 0
): { safe: boolean; reason?: string } {
  const result = traverseJsonLikePayload(obj, seen, depth, false);
  return result.safe
    ? { safe: true }
    : { safe: false, reason: result.reason };
}

export function createSafeInternalPayload(payload: unknown): InternalPayloadValue {
  const result = traverseJsonLikePayload(payload, new WeakSet<object>(), 0, true);
  if (!result.safe || !result.cloned) {
    throw new GovernedBoundaryError(
      'INVALID_REQUEST',
      `Invalid payload: ${result.safe ? 'Unable to create a safe payload copy' : result.reason}`,
      false
    );
  }
  return deepFreezeBoundaryContract(result.value);
}

export function estimateSizeInBytes(obj: unknown): number {
  try {
    const str = JSON.stringify(obj);
    return str ? str.length * 2 : 0;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

export function validateGovernedRequest(request: unknown): GovernedExecutionRequest {
  if (!isPlainObject(request)) {
    throw new GovernedBoundaryError('INVALID_REQUEST', 'Request must be a non-null plain object', false);
  }

  const req = request as Record<string, unknown>;

  if (typeof req.requestId !== 'string' || req.requestId.trim() === '') {
    throw new GovernedBoundaryError('INVALID_REQUEST', 'requestId must be a non-empty string', false);
  }

  if (typeof req.correlationId !== 'string' || req.correlationId.trim() === '') {
    throw new GovernedBoundaryError('INVALID_REQUEST', 'correlationId must be a non-empty string', false);
  }

  if (typeof req.source !== 'string' || req.source.trim() === '') {
    throw new GovernedBoundaryError('SOURCE_NOT_ALLOWED', 'source must be a non-empty string', false);
  }

  const requestedMode = req.requestedMode;
  if (!isBoundaryExecutionMode(requestedMode)) {
    throw new GovernedBoundaryError('MODE_NOT_ALLOWED', 'requestedMode is invalid', false);
  }

  if (!isPlainObject(req.tenant)) {
    throw new GovernedBoundaryError('INVALID_TENANT_CONTEXT', 'tenant must be a valid object', false);
  }
  const tenant = req.tenant as Record<string, unknown>;
  if (typeof tenant.tenantId !== 'string' || tenant.tenantId.trim() === '') {
    throw new GovernedBoundaryError('INVALID_TENANT_CONTEXT', 'tenantId must be a non-empty string', false);
  }

  if (!isPlainObject(req.actor)) {
    throw new GovernedBoundaryError('INVALID_ACTOR_CONTEXT', 'actor must be a valid object', false);
  }
  const actor = req.actor as Record<string, unknown>;
  if (typeof actor.actorId !== 'string' || actor.actorId.trim() === '') {
    throw new GovernedBoundaryError('INVALID_ACTOR_CONTEXT', 'actorId must be a non-empty string', false);
  }
  if (typeof actor.actorType !== 'string' || actor.actorType.trim() === '') {
    throw new GovernedBoundaryError('INVALID_ACTOR_CONTEXT', 'actorType must be a non-empty string', false);
  }

  if (req.timeoutMs !== undefined && (typeof req.timeoutMs !== 'number' || Number.isNaN(req.timeoutMs) || !Number.isFinite(req.timeoutMs) || req.timeoutMs <= 0)) {
    throw new GovernedBoundaryError('INVALID_REQUEST', 'timeoutMs must be a positive finite number', false);
  }

  const payloadCheck = detectCircularOrDangerousKeys(req.payload);
  if (!payloadCheck.safe) {
    throw new GovernedBoundaryError('INVALID_REQUEST', `Invalid payload: ${payloadCheck.reason}`, false);
  }

  if (req.capability !== undefined && typeof req.capability !== 'string') {
    throw new GovernedBoundaryError('INVALID_REQUEST', 'capability must be a string if provided', false);
  }

  if (req.operation !== undefined && typeof req.operation !== 'string') {
    throw new GovernedBoundaryError('INVALID_REQUEST', 'operation must be a string if provided', false);
  }

  if (req.metadata !== undefined) {
    if (!isPlainObject(req.metadata)) {
      throw new GovernedBoundaryError('INVALID_REQUEST', 'metadata must be a plain object', false);
    }
    const metaCheck = detectCircularOrDangerousKeys(req.metadata);
    if (!metaCheck.safe) {
      throw new GovernedBoundaryError('INVALID_REQUEST', `Invalid metadata: ${metaCheck.reason}`, false);
    }
  }

  if (
    req.cancellationSignal !== undefined &&
    (
      typeof req.cancellationSignal !== 'object' ||
      req.cancellationSignal === null ||
      typeof (req.cancellationSignal as { aborted?: unknown })
        .aborted !== 'boolean' ||
      typeof (
        req.cancellationSignal as {
          addEventListener?: unknown;
        }
      ).addEventListener !== 'function' ||
      typeof (
        req.cancellationSignal as {
          removeEventListener?: unknown;
        }
      ).removeEventListener !== 'function'
    )
  ) {
    throw new GovernedBoundaryError(
      'INVALID_REQUEST',
      'cancellationSignal is invalid',
      false
    );
  }

  if (
    tenant.companyId !== undefined &&
    (
      typeof tenant.companyId !== 'string' ||
      tenant.companyId.trim() === ''
    )
  ) {
    throw new GovernedBoundaryError(
      'INVALID_TENANT_CONTEXT',
      'companyId must be a non-empty string',
      false
    );
  }

  if (
    actor.roles !== undefined &&
    (
      !Array.isArray(actor.roles) ||
      actor.roles.some(
        (role) => typeof role !== 'string' || role.trim() === ''
      )
    )
  ) {
    throw new GovernedBoundaryError(
      'INVALID_ACTOR_CONTEXT',
      'roles must contain non-empty strings',
      false
    );
  }

  const tenantSnapshot = deepFreezeBoundaryContract({
    tenantId: tenant.tenantId,
    ...(tenant.companyId !== undefined
      ? { companyId: tenant.companyId }
      : {}),
  });
  const actorSnapshot = deepFreezeBoundaryContract({
    actorId: actor.actorId,
    actorType: actor.actorType,
    ...(actor.roles !== undefined
      ? { roles: [...actor.roles] as string[] }
      : {}),
  });
  const payloadSnapshot = createSafeInternalPayload(req.payload);
  const metadataSnapshot =
    req.metadata === undefined
      ? undefined
      : (createSafeInternalPayload(req.metadata) as Readonly<
          Record<string, unknown>
        >);

  return Object.freeze({
    requestId: req.requestId,
    correlationId: req.correlationId,
    tenant: tenantSnapshot,
    actor: actorSnapshot,
    source: req.source,
    requestedMode,
    payload: payloadSnapshot,
    ...(metadataSnapshot !== undefined
      ? { metadata: metadataSnapshot }
      : {}),
    ...(req.timeoutMs !== undefined
      ? { timeoutMs: req.timeoutMs }
      : {}),
    ...(req.capability !== undefined
      ? { capability: req.capability as string }
      : {}),
    ...(req.operation !== undefined
      ? { operation: req.operation as string }
      : {}),
    ...(req.cancellationSignal !== undefined
      ? {
          cancellationSignal:
            req.cancellationSignal as AbortSignal,
        }
      : {}),
  });
}

export default validateGovernedRequest;
