import type { BoundaryExecutionMode } from './types';

export interface BoundaryClockPort {
  now(): string;
}


export interface EffectiveBoundaryPolicy {
  readonly enabled: boolean;
  readonly allowedModes: readonly BoundaryExecutionMode[];
  readonly allowedSources: readonly string[];
  readonly maxPayloadBytes: number;
  readonly maxTimeoutMs: number;
  readonly maxConcurrentExecutions: number;
  readonly killSwitch: boolean;
  readonly shadowOnlyEnforced: boolean;
}

export interface FeaturePolicyPort {
  getEffectivePolicy(tenantId: string, source: string): Promise<EffectiveBoundaryPolicy | undefined>;
}

export interface BoundaryAuditPort {
  logEvent(eventName: string, eventData: Readonly<Record<string, unknown>>): Promise<void>;
}

export type InternalPayloadPrimitive = string | number | boolean | null;

export type InternalPayloadValue =
  | InternalPayloadPrimitive
  | readonly InternalPayloadValue[]
  | { readonly [key: string]: InternalPayloadValue };

export interface InternalExecutionInput {
  readonly sessionId: string;
  readonly executionKey?: string;
  readonly targetScenario?: string;
  readonly objectiveIds?: readonly string[];
  readonly payload: InternalPayloadValue;
  readonly metadata?: Record<string, unknown>;
}

export interface InternalExecutionResult {
  readonly executionId: string;
  readonly sessionId: string;
  readonly status: string;
  readonly stageResults?: Record<string, unknown>;
  readonly rawData?: unknown;
  readonly errors?: readonly { readonly message: string; readonly code?: string }[];
  readonly warnings?: readonly string[];
}

export interface BoundaryExecutionPort {
  execute(input: InternalExecutionInput, signal?: AbortSignal): Promise<InternalExecutionResult>;
}

export interface ShadowComparisonPort {
  compare(legacyResult: unknown, shadowResult: unknown): Promise<Record<string, unknown>>;
}

const DEFAULT_BOUNDARY_PORTS = {};
export default DEFAULT_BOUNDARY_PORTS;
