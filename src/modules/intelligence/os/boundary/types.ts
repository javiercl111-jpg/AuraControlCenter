export type BoundaryExecutionMode = 'DISABLED' | 'SHADOW_ONLY' | 'EVALUATION' | 'PRODUCTIVE';

export type BoundaryStatus =
  | 'REJECTED'
  | 'ACCEPTED'
  | 'COMPLETED'
  | 'PARTIAL'
  | 'FAILED'
  | 'CANCELLED'
  | 'TIMED_OUT';

export interface BoundaryTenantContext {
  readonly tenantId: string;
  readonly companyId?: string;
}

export interface BoundaryActorContext {
  readonly actorId: string;
  readonly actorType: string;
  readonly roles?: readonly string[];
}

export interface GovernedExecutionRequest {
  readonly requestId: string;
  readonly correlationId: string;
  readonly tenant: BoundaryTenantContext;
  readonly actor: BoundaryActorContext;
  readonly source: string;
  readonly requestedMode: BoundaryExecutionMode;
  readonly payload: unknown;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly timeoutMs?: number;
  readonly cancellationSignal?: AbortSignal;
}

export interface BoundaryPublicWarning {
  readonly code: string;
  readonly message: string;
}

export interface BoundaryPublicError {
  readonly code: string;
  readonly message: string;
  readonly retryable: boolean;
  readonly details?: Readonly<Record<string, string | number | boolean>>;
}

export interface GovernedExecutionResponse {
  readonly requestId: string;
  readonly correlationId: string;
  readonly mode: BoundaryExecutionMode;
  readonly status: BoundaryStatus;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly durationMs: number;
  readonly resultSummary?: Readonly<Record<string, unknown>>;
  readonly comparisonSummary?: Readonly<Record<string, unknown>>;
  readonly warnings: readonly BoundaryPublicWarning[];
  readonly errors: readonly BoundaryPublicError[];
}

const DEFAULT_BOUNDARY_TYPES = {};
export default DEFAULT_BOUNDARY_TYPES;
