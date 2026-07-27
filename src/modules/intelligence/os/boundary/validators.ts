import type { GovernedExecutionRequest } from './types';
import { GovernedBoundaryError } from './errors';

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === null || proto === Object.prototype;
}

export function detectCircularOrDangerousKeys(obj: unknown, seen = new WeakSet<object>(), depth = 0): { safe: boolean; reason?: string } {
  if (depth > 20) {
    return { safe: false, reason: 'Exceeds maximum allowed nesting depth' };
  }

  if (typeof obj !== 'object' || obj === null) {
    return { safe: true };
  }

  if (seen.has(obj)) {
    return { safe: false, reason: 'Circular reference detected' };
  }

  seen.add(obj);

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const res = detectCircularOrDangerousKeys(obj[i], seen, depth + 1);
      if (!res.safe) return res;
    }
    return { safe: true };
  }

  const keys = Object.getOwnPropertyNames(obj);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const lowerKey = key.toLowerCase();
    if (lowerKey === '__proto__' || lowerKey === 'constructor' || lowerKey === 'prototype') {
      return { safe: false, reason: `Dangerous property name: ${key}` };
    }
    const val = (obj as Record<string, unknown>)[key];
    if (typeof val === 'function' || typeof val === 'symbol') {
      return { safe: false, reason: `Forbidden value type at key: ${key}` };
    }
    const res = detectCircularOrDangerousKeys(val, seen, depth + 1);
    if (!res.safe) return res;
  }

  return { safe: true };
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
