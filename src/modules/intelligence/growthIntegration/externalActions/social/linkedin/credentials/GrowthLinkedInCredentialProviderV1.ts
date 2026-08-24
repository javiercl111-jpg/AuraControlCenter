export type GrowthLinkedInCredentialKindV1 =
  | 'ACCESS_TOKEN';


export interface GrowthLinkedInCredentialRequestV1 {

  readonly tenantId:
    string;

  readonly credentialKind:
    GrowthLinkedInCredentialKindV1;

}


export interface GrowthLinkedInCredentialLeaseV1 {

  readonly credentialKind:
    GrowthLinkedInCredentialKindV1;

  readonly accessToken:
    string;

  readonly tokenType:
    'Bearer';

  readonly expiresAt?:
    string;

}


export interface GrowthLinkedInCredentialProviderV1 {

  acquire(
    request:
      GrowthLinkedInCredentialRequestV1,
  ): Promise<GrowthLinkedInCredentialLeaseV1>;

}


export const assertGrowthLinkedInCredentialLeaseV1 =
  (
    lease:
      GrowthLinkedInCredentialLeaseV1,
  ): void => {

    if (
      lease.credentialKind !==
      'ACCESS_TOKEN'
    ) {
      throw new Error(
        'LINKEDIN_CREDENTIAL_KIND_INVALID',
      );
    }


    if (
      lease.tokenType !==
      'Bearer'
    ) {
      throw new Error(
        'LINKEDIN_TOKEN_TYPE_INVALID',
      );
    }


    if (
      typeof lease.accessToken !==
        'string' ||
      lease.accessToken.trim().length ===
        0
    ) {
      throw new Error(
        'LINKEDIN_ACCESS_TOKEN_REQUIRED',
      );
    }

  };