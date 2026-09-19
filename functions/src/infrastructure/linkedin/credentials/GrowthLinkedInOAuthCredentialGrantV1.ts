export const GROWTH_LINKEDIN_OAUTH_GRANT_SCHEMA_VERSION_V1 =
  '1' as const;

export interface GrowthLinkedInOAuthCredentialGrantV1 {
  readonly schemaVersion:
    typeof GROWTH_LINKEDIN_OAUTH_GRANT_SCHEMA_VERSION_V1;
  readonly tenantId: string;
  readonly bindingId: string;
  readonly accessToken: string;
  readonly tokenType: 'Bearer';
  readonly expiresAt?: string;
  readonly refreshToken?: string;
  readonly grantedScopes?: readonly string[];
}

const requireNonEmptyStringV1 = (
  value: unknown,
  errorCode: string,
): string => {
  if (
    typeof value !== 'string' ||
    value.trim().length === 0
  ) {
    throw new Error(errorCode);
  }

  return value.trim();
};

export const assertGrowthLinkedInOAuthCredentialGrantV1 = (
  grant: GrowthLinkedInOAuthCredentialGrantV1,
): void => {
  if (
    grant === null ||
    typeof grant !== 'object'
  ) {
    throw new Error(
      'LINKEDIN_OAUTH_GRANT_REQUIRED',
    );
  }

  if (
    grant.schemaVersion !==
    GROWTH_LINKEDIN_OAUTH_GRANT_SCHEMA_VERSION_V1
  ) {
    throw new Error(
      'LINKEDIN_OAUTH_GRANT_SCHEMA_VERSION_INVALID',
    );
  }

  requireNonEmptyStringV1(
    grant.tenantId,
    'LINKEDIN_OAUTH_GRANT_TENANT_ID_REQUIRED',
  );

  requireNonEmptyStringV1(
    grant.bindingId,
    'LINKEDIN_OAUTH_GRANT_BINDING_ID_REQUIRED',
  );

  requireNonEmptyStringV1(
    grant.accessToken,
    'LINKEDIN_OAUTH_GRANT_ACCESS_TOKEN_REQUIRED',
  );

  if (grant.tokenType !== 'Bearer') {
    throw new Error(
      'LINKEDIN_OAUTH_GRANT_TOKEN_TYPE_INVALID',
    );
  }

  if (typeof grant.expiresAt !== 'undefined') {
    const expiresAt =
      requireNonEmptyStringV1(
        grant.expiresAt,
        'LINKEDIN_OAUTH_GRANT_EXPIRES_AT_INVALID',
      );

    if (Number.isNaN(Date.parse(expiresAt))) {
      throw new Error(
        'LINKEDIN_OAUTH_GRANT_EXPIRES_AT_INVALID',
      );
    }
  }

  if (typeof grant.refreshToken !== 'undefined') {
    requireNonEmptyStringV1(
      grant.refreshToken,
      'LINKEDIN_OAUTH_GRANT_REFRESH_TOKEN_INVALID',
    );
  }

  if (typeof grant.grantedScopes !== 'undefined') {
    if (!Array.isArray(grant.grantedScopes)) {
      throw new Error(
        'LINKEDIN_OAUTH_GRANT_SCOPES_INVALID',
      );
    }

    for (const scope of grant.grantedScopes) {
      requireNonEmptyStringV1(
        scope,
        'LINKEDIN_OAUTH_GRANT_SCOPE_INVALID',
      );
    }
  }
};