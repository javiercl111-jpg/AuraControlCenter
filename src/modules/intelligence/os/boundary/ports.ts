import type {
  AuthoritativeBoundaryPolicyDecisionV1,
  AuthoritativeBoundaryPolicyQueryV1,
  AuthoritativeExecutionContextV1,
  BoundaryExecutionMode,
} from './types';

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
  /**
   * Versioned authoritative contract for H0B. Optional only while legacy
   * callers still use getEffectivePolicy().
   */
  evaluateAuthoritativePolicy?(
    query: AuthoritativeBoundaryPolicyQueryV1
  ): Promise<AuthoritativeBoundaryPolicyDecisionV1>;
}

export interface AuthoritativeFeaturePolicyPort
  extends FeaturePolicyPort {
  evaluateAuthoritativePolicy(
    query: AuthoritativeBoundaryPolicyQueryV1
  ): Promise<AuthoritativeBoundaryPolicyDecisionV1>;
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
  /**
   * Transitional additive contract for H0B. Absence conveys no authority and
   * must never be replaced from payload or metadata.
   */
  readonly authoritativeContext?: AuthoritativeExecutionContextV1;
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

export interface BoundarySemanticProjectionContextV1 {
  readonly requestId: string;
  readonly correlationId: string;
  readonly tenantId: string;
  readonly actorId: string;
  readonly mode: BoundaryExecutionMode;
  readonly source: string;
}

/**
 * BoundarySemanticProjectionPortV1 implementors MUST construct a new,
 * allowlisted public DTO and MUST NOT spread/copy rawData indiscriminately.
 */
export interface BoundarySemanticProjectionPortV1 {
  project(
    rawData: unknown,
    context: BoundarySemanticProjectionContextV1
  ): Readonly<Record<string, unknown>> | undefined;
}

const DEFAULT_BOUNDARY_PORTS = {};
export default DEFAULT_BOUNDARY_PORTS;
