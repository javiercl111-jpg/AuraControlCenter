import type { BoundaryPublicError } from './types';
import { GovernedBoundaryError } from './errors';

const SENSITIVE_KEYS = new Set([
  'authorization',
  'cookie',
  'token',
  'accesstoken',
  'refreshtoken',
  'password',
  'secret',
  'apikey',
  'stack',
  'cause',
  'prompt',
  'reasoning',
  'headers',
]);

export function sanitizeMetadata(
  metadata: Readonly<Record<string, unknown>> | undefined
): Record<string, unknown> | undefined {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return undefined;
  }

  const result: Record<string, unknown> = {};
  const keys = Object.keys(metadata);

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const lowerKey = key.toLowerCase();

    if (SENSITIVE_KEYS.has(lowerKey)) {
      continue;
    }

    const value = metadata[key];
    if (typeof value === 'string') {
      result[key] = value.length > 1024 ? value.slice(0, 1024) : value;
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      result[key] = value;
    } else if (value === null) {
      result[key] = null;
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

export function sanitizePublicError(error: unknown): BoundaryPublicError {
  if (error instanceof GovernedBoundaryError) {
    const detailsClean: Record<string, string | number | boolean> = {};
    if (error.details) {
      for (const [k, v] of Object.entries(error.details)) {
        if (!SENSITIVE_KEYS.has(k.toLowerCase()) && (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')) {
          detailsClean[k] = v;
        }
      }
    }

    return {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
      ...(Object.keys(detailsClean).length > 0 ? { details: detailsClean } : {}),
    };
  }

  return {
    code: 'EXECUTION_FAILED',
    message: 'An internal execution error occurred',
    retryable: false,
  };
}

export function sanitizeResultSummary(
  internalResult: unknown
): Record<string, unknown> | undefined {
  if (typeof internalResult !== 'object' || internalResult === null) {
    return undefined;
  }

  const res = internalResult as Record<string, unknown>;
  const allowedKeys = ['executionId', 'sessionId', 'status', 'startedAt', 'completedAt', 'durationMs'];
  const summary: Record<string, unknown> = {};

  for (let i = 0; i < allowedKeys.length; i++) {
    const key = allowedKeys[i];
    if (key in res) {
      const val = res[key];
      if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
        summary[key] = val;
      }
    }
  }

  return Object.keys(summary).length > 0 ? summary : undefined;
}

export function sanitizeComparisonSummary(
  comparisonResult: unknown
): Record<string, unknown> | undefined {
  if (typeof comparisonResult !== 'object' || comparisonResult === null) {
    return undefined;
  }

  const res = comparisonResult as Record<string, unknown>;
  const allowedKeys = ['match', 'divergenceCount', 'divergences', 'summary', 'timestamp'];
  const summary: Record<string, unknown> = {};

  for (let i = 0; i < allowedKeys.length; i++) {
    const key = allowedKeys[i];
    if (key in res) {
      const val = res[key];
      if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean' || Array.isArray(val)) {
        summary[key] = val;
      }
    }
  }

  return Object.keys(summary).length > 0 ? summary : undefined;
}

export default sanitizeMetadata;
