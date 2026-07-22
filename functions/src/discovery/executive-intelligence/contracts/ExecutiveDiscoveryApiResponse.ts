import type { ExecutiveDiagnosis } from "./ExecutiveDiagnosis";

export type ExecutiveDiscoverySafeDetailValue =
  | string
  | number
  | boolean
  | null
  | readonly string[];

export interface ExecutiveDiscoveryApiSuccessEnvelope {
  readonly success: true;
  readonly data: ExecutiveDiagnosis;
  readonly meta: {
    readonly correlationId: string;
    readonly warnings: readonly string[];
  };
}

export interface ExecutiveDiscoveryApiErrorEnvelope {
  readonly success: false;
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly details?: Readonly<Record<string, ExecutiveDiscoverySafeDetailValue>>;
  };
  readonly correlationId?: string;
}

export type ExecutiveDiscoveryApiEnvelope =
  | ExecutiveDiscoveryApiSuccessEnvelope
  | ExecutiveDiscoveryApiErrorEnvelope;

/** HTTP status plus the validated Aura Intelligence response envelope. */
export interface ExecutiveDiscoveryApiResponse {
  readonly status: number;
  readonly body: ExecutiveDiscoveryApiEnvelope;
}

