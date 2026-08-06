import type { BoundaryStatus } from '../boundary/types';

export const PUBLIC_PREVIEW_CAPABILITIES_V1 = Object.freeze([
  'GROWTH_INTELLIGENCE_V1',
] as const);

export type PublicPreviewCapabilityV1 = (typeof PUBLIC_PREVIEW_CAPABILITIES_V1)[number];

export type GrowthPublicOperationV1 =
  | 'ANALYZE_CAMPAIGN'
  | 'PRIORITIZE_OPPORTUNITIES'
  | 'RECOMMEND_ACTIONS'
  | 'ASSESS_GROWTH_CAPABILITY';

export interface PublicPreviewRequestV1 {
  readonly contractVersion: '1.0';
  readonly capability: PublicPreviewCapabilityV1;
  readonly operation: GrowthPublicOperationV1;
  readonly tenantId: string;
  readonly actorId: string;
  readonly requestId: string;
  readonly correlationId: string;
  readonly payload: unknown;
  readonly executionMode: 'EVALUATION';
  /**
   * Idempotency is received and validated by the facade but is NOT currently enforced
   * at the GovernedExecutionBoundary layer. It is reserved for future integration.
   */
  readonly idempotencyKey?: string;
}

export interface PublicPreviewSafeErrorV1 {
  readonly code: string;
  readonly retryable: boolean;
}

export interface PublicPreviewWarningV1 {
  readonly code: string;
  readonly message: string;
}

export interface PublicPreviewResponseV1 {
  readonly contractVersion: '1.0';
  readonly requestId: string;
  readonly correlationId: string;
  readonly status: BoundaryStatus;
  readonly usable: boolean;
  readonly shadowOnly: true;
  readonly output?: unknown;
  readonly warnings: readonly PublicPreviewWarningV1[];
  readonly safeError?: PublicPreviewSafeErrorV1;
}
