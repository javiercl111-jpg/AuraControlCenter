import { createHash } from "node:crypto";

import {
  OAuth2Client,
  type LoginTicket,
  type TokenPayload,
} from "google-auth-library";

import {
  createVerifiedAuthenticationSubjectV1,
} from "@aura/intelligence-os/server";

import {
  createDiscoveryOidcProviderSubjectV1,
} from "./FirestoreOidcServiceIdentityBindingResolverV1";

export const DISCOVERY_OIDC_EXPECTED_SERVICE_ACCOUNT_EMAIL_V1 =
  "preview-discovery-complete-rt@aura-intel-preview.iam.gserviceaccount.com" as const;

export const DISCOVERY_OIDC_EXPECTED_PROJECT_ID_V1 =
  "aura-intel-preview" as const;

const GOOGLE_ISSUERS = Object.freeze([
  "accounts.google.com",
  "https://accounts.google.com",
] as const);

const CREDENTIAL_VERSION =
  "google-oidc-service-account-v1" as const;

export type OidcServiceIdentityVerificationErrorCodeV1 =
  | "INVALID_AUTHORIZATION"
  | "INVALID_AUDIENCE"
  | "TOKEN_VERIFICATION_FAILED"
  | "TOKEN_PAYLOAD_MISSING"
  | "TOKEN_AUDIENCE_MISMATCH"
  | "TOKEN_ISSUER_MISMATCH"
  | "TOKEN_SUBJECT_MISSING"
  | "TOKEN_EMAIL_MISMATCH"
  | "TOKEN_EMAIL_NOT_VERIFIED"
  | "TOKEN_TIME_INVALID";

export class OidcServiceIdentityVerificationErrorV1 extends Error {
  readonly code: OidcServiceIdentityVerificationErrorCodeV1;

  constructor(code: OidcServiceIdentityVerificationErrorCodeV1) {
    super(code);
    this.name = "OidcServiceIdentityVerificationErrorV1";
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export interface VerifyOidcServiceIdentityInputV1 {
  readonly authorizationHeader: string | undefined;
  readonly expectedAudience: string;
  readonly verifiedAt?: string;
}

export interface VerifiedOidcServiceIdentityV1 {
  readonly subject:
    ReturnType<typeof createVerifiedAuthenticationSubjectV1>;
  readonly verifiedGoogleSubject: string;
  readonly serviceAccountEmail:
    typeof DISCOVERY_OIDC_EXPECTED_SERVICE_ACCOUNT_EMAIL_V1;
}

function fail(
  code: OidcServiceIdentityVerificationErrorCodeV1,
): never {
  throw new OidcServiceIdentityVerificationErrorV1(code);
}

function sha256Fingerprint(value: string): string {
  return `sha256:${createHash("sha256")
    .update(value, "utf8")
    .digest("hex")}`;
}

function requireCanonicalInstant(
  seconds: number | undefined,
): string {
  if (
    typeof seconds !== "number" ||
    !Number.isSafeInteger(seconds) ||
    seconds <= 0
  ) {
    return fail("TOKEN_TIME_INVALID");
  }

  const milliseconds = seconds * 1000;

  if (!Number.isSafeInteger(milliseconds)) {
    return fail("TOKEN_TIME_INVALID");
  }

  return new Date(milliseconds).toISOString();
}

function requireVerifiedAt(
  value: string | undefined,
): string {
  const resolved =
    value ?? new Date().toISOString();

  const milliseconds = Date.parse(resolved);

  if (
    !Number.isFinite(milliseconds) ||
    new Date(milliseconds).toISOString() !== resolved
  ) {
    return fail("TOKEN_TIME_INVALID");
  }

  return resolved;
}

function bearerToken(
  authorizationHeader: string | undefined,
): string {
  if (typeof authorizationHeader !== "string") {
    return fail("INVALID_AUTHORIZATION");
  }

  const match =
    /^Bearer ([^\s]+)$/.exec(authorizationHeader);

  if (
    !match ||
    match[1].length === 0 ||
    match[1].includes("\r") ||
    match[1].includes("\n")
  ) {
    return fail("INVALID_AUTHORIZATION");
  }

  return match[1];
}

function audience(value: string): string {
  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    return fail("INVALID_AUDIENCE");
  }

  if (
    parsed.protocol !== "https:" ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.hash !== "" ||
    parsed.search !== ""
  ) {
    return fail("INVALID_AUDIENCE");
  }

  return value;
}

function exactAudience(
  payloadAudience: string | string[] | undefined,
  expectedAudience: string,
): boolean {
  if (typeof payloadAudience === "string") {
    return payloadAudience === expectedAudience;
  }

  if (Array.isArray(payloadAudience)) {
    return (
      payloadAudience.length === 1 &&
      payloadAudience[0] === expectedAudience
    );
  }

  return false;
}

function validatePayload(
  payload: TokenPayload,
  expectedAudience: string,
  verifiedAt: string,
): VerifiedOidcServiceIdentityV1 {
  if (!exactAudience(payload.aud, expectedAudience)) {
    return fail("TOKEN_AUDIENCE_MISMATCH");
  }

  if (
    typeof payload.iss !== "string" ||
    !GOOGLE_ISSUERS.includes(
      payload.iss as (typeof GOOGLE_ISSUERS)[number],
    )
  ) {
    return fail("TOKEN_ISSUER_MISMATCH");
  }

  if (
    typeof payload.sub !== "string" ||
    payload.sub.length === 0
  ) {
    return fail("TOKEN_SUBJECT_MISSING");
  }

  if (
    payload.email !==
    DISCOVERY_OIDC_EXPECTED_SERVICE_ACCOUNT_EMAIL_V1
  ) {
    return fail("TOKEN_EMAIL_MISMATCH");
  }

  if (payload.email_verified !== true) {
    return fail("TOKEN_EMAIL_NOT_VERIFIED");
  }

  const tokenIssuedAt =
    requireCanonicalInstant(payload.iat);

  const tokenExpiresAt =
    requireCanonicalInstant(payload.exp);

  if (
    Date.parse(tokenExpiresAt) <=
      Date.parse(tokenIssuedAt) ||
    Date.parse(verifiedAt) <
      Date.parse(tokenIssuedAt) ||
    Date.parse(verifiedAt) >=
      Date.parse(tokenExpiresAt)
  ) {
    return fail("TOKEN_TIME_INVALID");
  }

  const providerSubjectId =
    createDiscoveryOidcProviderSubjectV1(
      payload.sub,
    );

  const claimsFingerprint =
    sha256Fingerprint(
      JSON.stringify({
        aud: expectedAudience,
        email:
          DISCOVERY_OIDC_EXPECTED_SERVICE_ACCOUNT_EMAIL_V1,
        exp: payload.exp,
        iat: payload.iat,
        iss: payload.iss,
        sub: payload.sub,
      }),
    );

  const subject =
    createVerifiedAuthenticationSubjectV1({
      schemaVersion: "1",
      subjectType: "SERVICE",
      provider: "GOOGLE_CLOUD_IAM",
      providerSubjectId,
      authenticationMethod: "OIDC_SERVICE_ACCOUNT",
      authenticatedAt: tokenIssuedAt,
      tokenIssuedAt,
      tokenExpiresAt,
      revocationCheckedAt: verifiedAt,
      credentialVersion: CREDENTIAL_VERSION,
      claimsFingerprint,
    });

  return Object.freeze({
    subject,
    verifiedGoogleSubject: payload.sub,
    serviceAccountEmail:
      DISCOVERY_OIDC_EXPECTED_SERVICE_ACCOUNT_EMAIL_V1,
  });
}

export class OidcServiceIdentityVerifierV1 {
  readonly #client: OAuth2Client;

  constructor(client: OAuth2Client = new OAuth2Client()) {
    this.#client = client;
  }

  async verify(
    input: VerifyOidcServiceIdentityInputV1,
  ): Promise<VerifiedOidcServiceIdentityV1> {
    const token =
      bearerToken(input.authorizationHeader);

    const expectedAudience =
      audience(input.expectedAudience);

    const verifiedAt =
      requireVerifiedAt(input.verifiedAt);

    let ticket: LoginTicket;

    try {
      ticket = await this.#client.verifyIdToken({
        idToken: token,
        audience: expectedAudience,
      });
    } catch {
      return fail("TOKEN_VERIFICATION_FAILED");
    }

    const payload = ticket.getPayload();

    if (!payload) {
      return fail("TOKEN_PAYLOAD_MISSING");
    }

    return validatePayload(
      payload,
      expectedAudience,
      verifiedAt,
    );
  }
}
