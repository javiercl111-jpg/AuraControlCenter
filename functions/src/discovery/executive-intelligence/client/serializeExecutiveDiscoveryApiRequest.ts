import type { ExecutiveDiscoveryApiRequest } from "../contracts/ExecutiveDiscoveryApiRequest";

export function serializeExecutiveDiscoveryApiRequest(
  request: ExecutiveDiscoveryApiRequest,
): string {
  return JSON.stringify(request);
}

