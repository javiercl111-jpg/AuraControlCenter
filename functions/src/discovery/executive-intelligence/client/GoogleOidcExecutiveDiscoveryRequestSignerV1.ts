import { GoogleAuth } from "google-auth-library";

import type {
  ExecutiveDiscoveryAuthorization,
  ExecutiveDiscoveryRequestSigner,
} from "../contracts/ExecutiveDiscoveryApiClient";
import type { ExecutiveDiscoveryApiRequest } from "../contracts/ExecutiveDiscoveryApiRequest";

export type GoogleOidcTokenProviderV1 = (
  audience: string,
) => Promise<string>;

export interface GoogleOidcExecutiveDiscoveryRequestSignerV1Options {
  readonly audience: string;
  readonly tokenProvider?: GoogleOidcTokenProviderV1;
}

function normalizeAudience(value: string): string {
  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    throw new Error("Executive Discovery OIDC audience is invalid.");
  }

  if (
    parsed.protocol !== "https:" ||
    parsed.username.length > 0 ||
    parsed.password.length > 0 ||
    parsed.hash.length > 0
  ) {
    throw new Error("Executive Discovery OIDC audience is invalid.");
  }

  return parsed.toString();
}

function validToken(value: string): boolean {
  return value.trim().length > 0 && !/[\r\n]/.test(value);
}

async function defaultGoogleOidcTokenProviderV1(
  audience: string,
): Promise<string> {
  const auth = new GoogleAuth();
  const client = await auth.getIdTokenClient(audience);

  return client.idTokenProvider.fetchIdToken(audience);
}

export class GoogleOidcExecutiveDiscoveryRequestSignerV1
  implements ExecutiveDiscoveryRequestSigner
{
  private readonly audience: string;
  private readonly tokenProvider: GoogleOidcTokenProviderV1;

  public constructor(
    options: GoogleOidcExecutiveDiscoveryRequestSignerV1Options,
  ) {
    this.audience = normalizeAudience(options.audience);
    this.tokenProvider =
      options.tokenProvider ?? defaultGoogleOidcTokenProviderV1;
  }

  public async sign(
    request: ExecutiveDiscoveryApiRequest,
  ): Promise<ExecutiveDiscoveryAuthorization> {
    void request;

    let token: string;

    try {
      token = await this.tokenProvider(this.audience);
    } catch {
      throw new Error(
        "Executive Discovery OIDC service authentication is unavailable.",
      );
    }

    if (!validToken(token)) {
      throw new Error(
        "Executive Discovery OIDC service authentication is unavailable.",
      );
    }

    return Object.freeze({
      scheme: "Bearer",
      token,
    });
  }
}