import type { EffectiveBoundaryPolicy } from './ports';
import type { BoundaryExecutionMode } from './types';
import { GovernedBoundaryError } from './errors';

export interface PolicyEvaluationResult {
  readonly allowed: boolean;
  readonly error?: GovernedBoundaryError;
  readonly effectiveTimeoutMs: number;
}

export function evaluateBoundaryPolicy(
  policy: EffectiveBoundaryPolicy | undefined,
  requestedMode: BoundaryExecutionMode,
  source: string,
  requestedTimeoutMs?: number,
  payloadSizeBytes?: number
): PolicyEvaluationResult {
  if (!policy || typeof policy !== 'object') {
    return {
      allowed: false,
      error: new GovernedBoundaryError('BOUNDARY_DISABLED', 'Boundary policy is not defined', false),
      effectiveTimeoutMs: 0,
    };
  }

  if (typeof policy.maxPayloadBytes !== 'number' || Number.isNaN(policy.maxPayloadBytes)) {
    return {
      allowed: false,
      error: new GovernedBoundaryError('BOUNDARY_DISABLED', 'Invalid policy: maxPayloadBytes is invalid', false),
      effectiveTimeoutMs: 0,
    };
  }

  if (typeof policy.maxTimeoutMs !== 'number' || Number.isNaN(policy.maxTimeoutMs) || !Number.isFinite(policy.maxTimeoutMs)) {
    return {
      allowed: false,
      error: new GovernedBoundaryError('BOUNDARY_DISABLED', 'Invalid policy: maxTimeoutMs is invalid', false),
      effectiveTimeoutMs: 0,
    };
  }

  if (policy.killSwitch || !policy.enabled) {
    return {
      allowed: false,
      error: new GovernedBoundaryError('BOUNDARY_DISABLED', 'Boundary is disabled or kill switch active', false),
      effectiveTimeoutMs: 0,
    };
  }

  if (requestedMode === 'PRODUCTIVE') {
    return {
      allowed: false,
      error: new GovernedBoundaryError('MODE_NOT_ALLOWED', 'PRODUCTIVE mode is strictly prohibited in AI-02G', false),
      effectiveTimeoutMs: 0,
    };
  }

  if (requestedMode === 'DISABLED') {
    return {
      allowed: false,
      error: new GovernedBoundaryError('BOUNDARY_DISABLED', 'Requested mode is DISABLED', false),
      effectiveTimeoutMs: 0,
    };
  }

  if (!Array.isArray(policy.allowedSources) || !policy.allowedSources.includes(source)) {
    return {
      allowed: false,
      error: new GovernedBoundaryError('SOURCE_NOT_ALLOWED', `Source '${source}' is not allowed`, false),
      effectiveTimeoutMs: 0,
    };
  }

  if (!Array.isArray(policy.allowedModes) || !policy.allowedModes.includes(requestedMode)) {
    return {
      allowed: false,
      error: new GovernedBoundaryError('MODE_NOT_ALLOWED', `Mode '${requestedMode}' is not in policy allowed modes`, false),
      effectiveTimeoutMs: 0,
    };
  }

  if (policy.shadowOnlyEnforced && requestedMode !== 'SHADOW_ONLY' && requestedMode !== 'EVALUATION') {
    return {
      allowed: false,
      error: new GovernedBoundaryError('MODE_NOT_ALLOWED', 'Shadow-only execution is enforced', false),
      effectiveTimeoutMs: 0,
    };
  }

  if (typeof payloadSizeBytes === 'number' && policy.maxPayloadBytes > 0 && payloadSizeBytes > policy.maxPayloadBytes) {
    return {
      allowed: false,
      error: new GovernedBoundaryError('PAYLOAD_TOO_LARGE', `Payload size exceeds limit of ${policy.maxPayloadBytes} bytes`, false),
      effectiveTimeoutMs: 0,
    };
  }

  let effectiveTimeoutMs = policy.maxTimeoutMs > 0 ? policy.maxTimeoutMs : 30000;
  if (typeof requestedTimeoutMs === 'number' && requestedTimeoutMs > 0) {
    if (policy.maxTimeoutMs > 0 && requestedTimeoutMs > policy.maxTimeoutMs) {
      return {
        allowed: false,
        error: new GovernedBoundaryError('TIMEOUT', `Requested timeout exceeds maximum allowed of ${policy.maxTimeoutMs}ms`, false),
        effectiveTimeoutMs: 0,
      };
    }
    effectiveTimeoutMs = requestedTimeoutMs;
  }

  return {
    allowed: true,
    effectiveTimeoutMs,
  };
}

export default evaluateBoundaryPolicy;
