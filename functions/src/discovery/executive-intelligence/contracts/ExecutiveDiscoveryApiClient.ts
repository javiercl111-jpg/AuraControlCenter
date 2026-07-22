import type { ExecutiveDiscoveryApiRequest } from "./ExecutiveDiscoveryApiRequest";
import type { ExecutiveDiscoveryApiResponse } from "./ExecutiveDiscoveryApiResponse";

export interface ExecutiveDiscoveryCallOptions {
  readonly signal?: AbortSignal;
}

export interface ExecutiveDiscoveryAuthorization {
  readonly scheme: "Bearer";
  readonly token: string;
}

/** Development credentials and future OIDC token providers share this boundary. */
export interface ExecutiveDiscoveryRequestSigner {
  readonly sign: (
    request: ExecutiveDiscoveryApiRequest,
  ) => Promise<ExecutiveDiscoveryAuthorization>;
}

/**
 * Retry contract reserved for the next infrastructure sprint. Version 1 is
 * intentionally one attempt only; retryable failures are already classified.
 */
export interface ExecutiveDiscoveryRetryPolicy {
  readonly maxAttempts: 1;
  readonly retryableStatusCodes: readonly number[];
}

export interface ExecutiveDiscoveryApiClient {
  readonly evaluate: (
    request: ExecutiveDiscoveryApiRequest,
    options?: ExecutiveDiscoveryCallOptions,
  ) => Promise<ExecutiveDiscoveryApiResponse>;
}

