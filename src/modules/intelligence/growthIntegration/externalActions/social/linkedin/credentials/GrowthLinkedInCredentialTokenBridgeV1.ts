import type {
  GrowthLinkedInTokenProviderV1,
  GrowthLinkedInAccessTokenV1,
} from '../transport/GrowthLinkedInTransportBoundaryV1';

import {
  assertGrowthLinkedInCredentialLeaseV1,
} from './GrowthLinkedInCredentialProviderV1';

import type {
  GrowthLinkedInCredentialProviderV1,
} from './GrowthLinkedInCredentialProviderV1';


export interface GrowthLinkedInCredentialTokenBridgeDependenciesV1 {

  readonly tenantId:
    string;

  readonly credentialProvider:
    GrowthLinkedInCredentialProviderV1;

}


export class GrowthLinkedInCredentialTokenBridgeV1
implements GrowthLinkedInTokenProviderV1 {

  private readonly tenantId:
    string;

  private readonly credentialProvider:
    GrowthLinkedInCredentialProviderV1;


  constructor(
    dependencies:
      GrowthLinkedInCredentialTokenBridgeDependenciesV1,
  ) {

    if (
      typeof dependencies.tenantId !==
        'string' ||
      dependencies.tenantId.trim().length ===
        0
    ) {
      throw new Error(
        'LINKEDIN_TENANT_ID_REQUIRED',
      );
    }


    this.tenantId =
      dependencies.tenantId;

    this.credentialProvider =
      dependencies.credentialProvider;

  }


  async getAccessToken():
    Promise<GrowthLinkedInAccessTokenV1> {

    const lease =
      await this.credentialProvider.acquire({

        tenantId:
          this.tenantId,

        credentialKind:
          'ACCESS_TOKEN',

      });


    assertGrowthLinkedInCredentialLeaseV1(
      lease,
    );


    return {

      accessToken:
        lease.accessToken,

      tokenType:
        lease.tokenType,

      expiresAt:
        lease.expiresAt,

    };

  }

}