import type {
  ExecutiveDiscoveryAuthorization,
  ExecutiveDiscoveryRequestSigner,
} from "../contracts/ExecutiveDiscoveryApiClient";
import type { ExecutiveDiscoveryApiRequest } from "../contracts/ExecutiveDiscoveryApiRequest";

export interface DevelopmentExecutiveDiscoveryRequestSignerOptions {
  /** Must come from controlled server-side configuration; never from frontend code. */
  readonly token: string;
}

/**
 * Supplies the allowlisted credential consumed by Aura Intelligence's
 * DevelopmentServiceIdentityVerifier. It is intentionally invalid for production.
 */
export class DevelopmentExecutiveDiscoveryRequestSigner
  implements ExecutiveDiscoveryRequestSigner
{
  private readonly token: string;

  public constructor(options: DevelopmentExecutiveDiscoveryRequestSignerOptions) {
    if (
      options.token.trim().length === 0 ||
      /[\r\n]/.test(options.token)
    ) {
      throw new Error("Executive Discovery development credential is invalid.");
    }
    this.token = options.token;
  }

  public async sign(
    request: ExecutiveDiscoveryApiRequest,
  ): Promise<ExecutiveDiscoveryAuthorization> {
    void request;
    return { scheme: "Bearer", token: this.token };
  }
}

