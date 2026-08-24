export type GrowthLinkedInServerCredentialKindV1 =
  | 'ACCESS_TOKEN';

export interface GrowthLinkedInServerCredentialRequestV1 {
  readonly tenantId: string;
  readonly credentialKind: GrowthLinkedInServerCredentialKindV1;
}

export interface GrowthLinkedInServerCredentialLeaseV1 {
  readonly credentialKind: GrowthLinkedInServerCredentialKindV1;
  readonly accessToken: string;
  readonly tokenType: 'Bearer';
  readonly expiresAt?: string;
}

export interface GrowthLinkedInServerCredentialSourceV1 {
  acquire(
    request: GrowthLinkedInServerCredentialRequestV1,
  ): Promise<GrowthLinkedInServerCredentialLeaseV1>;
}

export const assertGrowthLinkedInServerCredentialRequestV1 = (
  request: GrowthLinkedInServerCredentialRequestV1,
): void => {
  if (
    typeof request.tenantId !== 'string' ||
    request.tenantId.trim().length === 0
  ) {
    throw new Error('LINKEDIN_SERVER_TENANT_ID_REQUIRED');
  }

  if (request.credentialKind !== 'ACCESS_TOKEN') {
    throw new Error('LINKEDIN_SERVER_CREDENTIAL_KIND_INVALID');
  }
};

export const assertGrowthLinkedInServerCredentialLeaseV1 = (
  lease: GrowthLinkedInServerCredentialLeaseV1,
): void => {
  if (lease.credentialKind !== 'ACCESS_TOKEN') {
    throw new Error('LINKEDIN_SERVER_CREDENTIAL_KIND_INVALID');
  }

  if (lease.tokenType !== 'Bearer') {
    throw new Error('LINKEDIN_SERVER_TOKEN_TYPE_INVALID');
  }

  if (
    typeof lease.accessToken !== 'string' ||
    lease.accessToken.trim().length === 0
  ) {
    throw new Error('LINKEDIN_SERVER_ACCESS_TOKEN_REQUIRED');
  }
};

export class GrowthLinkedInServerCredentialBoundaryV1 {
  constructor(
    private readonly source: GrowthLinkedInServerCredentialSourceV1,
  ) {}

  async acquire(
    request: GrowthLinkedInServerCredentialRequestV1,
  ): Promise<GrowthLinkedInServerCredentialLeaseV1> {
    assertGrowthLinkedInServerCredentialRequestV1(request);

    const lease =
      await this.source.acquire(request);

    assertGrowthLinkedInServerCredentialLeaseV1(lease);

    return {
      credentialKind: lease.credentialKind,
      accessToken: lease.accessToken,
      tokenType: lease.tokenType,
      expiresAt: lease.expiresAt,
    };
  }
}