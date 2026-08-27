import {
  defineSecret,
} from 'firebase-functions/params';

import {
  assertGrowthLinkedInServerCredentialRequestV1,
} from './GrowthLinkedInServerCredentialBoundaryV1';

import type {
  GrowthLinkedInServerCredentialLeaseV1,
  GrowthLinkedInServerCredentialRequestV1,
  GrowthLinkedInServerCredentialSourceV1,
} from './GrowthLinkedInServerCredentialBoundaryV1';


export const GROWTH_LINKEDIN_ACCESS_TOKEN_SECRET_NAME_V1 =
  'GROWTH_LINKEDIN_ACCESS_TOKEN';


export const growthLinkedInAccessTokenSecretV1 =
  defineSecret(
    GROWTH_LINKEDIN_ACCESS_TOKEN_SECRET_NAME_V1,
  );


export interface GrowthLinkedInSecretValueReaderV1 {

  value():
    string;

}


export interface GrowthLinkedInFirebaseSecretSourceDependenciesV1 {

  readonly authorizedTenantId:
    string;

  readonly secretReader?:
    GrowthLinkedInSecretValueReaderV1;

}


export class GrowthLinkedInFirebaseSecretSourceV1
implements GrowthLinkedInServerCredentialSourceV1 {

  private readonly authorizedTenantId:
    string;

  private readonly secretReader:
    GrowthLinkedInSecretValueReaderV1;


  constructor(
    dependencies:
      GrowthLinkedInFirebaseSecretSourceDependenciesV1,
  ) {

    if (
      typeof dependencies.authorizedTenantId !==
        'string' ||
      dependencies.authorizedTenantId.trim().length ===
        0
    ) {
      throw new Error(
        'LINKEDIN_SERVER_AUTHORIZED_TENANT_REQUIRED',
      );
    }


    this.authorizedTenantId =
      dependencies.authorizedTenantId;


    this.secretReader =
      dependencies.secretReader ??
      growthLinkedInAccessTokenSecretV1;

  }


  async acquire(
    request:
      GrowthLinkedInServerCredentialRequestV1,
  ): Promise<GrowthLinkedInServerCredentialLeaseV1> {

    assertGrowthLinkedInServerCredentialRequestV1(
      request,
    );


    if (
      request.tenantId !==
      this.authorizedTenantId
    ) {
      throw new Error(
        'LINKEDIN_SERVER_TENANT_NOT_AUTHORIZED',
      );
    }


    const accessToken =
      this.secretReader.value();


    if (
      typeof accessToken !==
        'string' ||
      accessToken.trim().length ===
        0
    ) {
      throw new Error(
        'LINKEDIN_SERVER_ACCESS_TOKEN_REQUIRED',
      );
    }


    return {
      credentialKind:
        'ACCESS_TOKEN',

      accessToken,

      tokenType:
        'Bearer',
    };

  }

}