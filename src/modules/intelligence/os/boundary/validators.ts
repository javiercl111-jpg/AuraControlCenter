import type { GovernedExecutionRequest } from './types';
import type { InternalPayloadValue } from './ports';
import { GovernedBoundaryError } from './errors';

export const MAX_BOUNDARY_PAYLOAD_DEPTH = 20;

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
  return result.value;
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

  const validModes = ['DISABLED', 'SHADOW_ONLY', 'EVALUATION', 'PRODUCTIVE'];
  if (typeof req.requestedMode !== 'string' || !validModes.includes(req.requestedMode)) {
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

  if (req.metadata !== undefined) {
    if (!isPlainObject(req.metadata)) {
      throw new GovernedBoundaryError('INVALID_REQUEST', 'metadata must be a plain object', false);
    }
    const metaCheck = detectCircularOrDangerousKeys(req.metadata);
    if (!metaCheck.safe) {
      throw new GovernedBoundaryError('INVALID_REQUEST', `Invalid metadata: ${metaCheck.reason}`, false);
    }
  }

  return request as unknown as GovernedExecutionRequest;
}

export default validateGovernedRequest;
