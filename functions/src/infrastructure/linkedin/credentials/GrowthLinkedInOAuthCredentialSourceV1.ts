import {
  assertGrowthLinkedInServerCredentialRequestV1,
  type GrowthLinkedInServerCredentialLeaseV1,
  type GrowthLinkedInServerCredentialRequestV1,
  type GrowthLinkedInServerCredentialSourceV1,
} from './GrowthLinkedInServerCredentialBoundaryV1';

import {
  assertGrowthLinkedInOAuthCredentialGrantV1,
} from './GrowthLinkedInOAuthCredentialGrantV1';

import type {
  GrowthLinkedInOAuthCredentialStoreV1,
} from './GrowthLinkedInOAuthCredentialStoreV1';

export interface GrowthLinkedInOAuthCredentialSourceDependenciesV1 {
  readonly store:
    GrowthLinkedInOAuthCredentialStoreV1;
}

export class GrowthLinkedInOAuthCredentialSourceV1
implements GrowthLinkedInServerCredentialSourceV1 {
  private readonly store:
    GrowthLinkedInOAuthCredentialStoreV1;

  constructor(
    dependencies:
      GrowthLinkedInOAuthCredentialSourceDependenciesV1,
  ) {
    if (
      dependencies === null ||
      typeof dependencies !== 'object' ||
      dependencies.store === null ||
      typeof dependencies.store !== 'object'
    ) {
      throw new Error(
        'LINKEDIN_OAUTH_CREDENTIAL_STORE_REQUIRED',
      );
    }

    this.store =
      dependencies.store;
  }

  async acquire(
    request:
      GrowthLinkedInServerCredentialRequestV1,
  ): Promise<GrowthLinkedInServerCredentialLeaseV1> {
    assertGrowthLinkedInServerCredentialRequestV1(
      request,
    );

    if (
      typeof request.bindingId !== 'string' ||
      request.bindingId.trim().length === 0
    ) {
      throw new Error(
        'LINKEDIN_OAUTH_CREDENTIAL_BINDING_ID_REQUIRED',
      );
    }

    const grant =
      await this.store.readGrant({
        tenantId:
          request.tenantId.trim(),
        bindingId:
          request.bindingId.trim(),
      });

    if (grant === null) {
      throw new Error(
        'LINKEDIN_OAUTH_CREDENTIAL_GRANT_NOT_FOUND',
      );
    }

    assertGrowthLinkedInOAuthCredentialGrantV1(
      grant,
    );

    if (
      grant.tenantId !== request.tenantId.trim() ||
      grant.bindingId !== request.bindingId.trim()
    ) {
      throw new Error(
        'LINKEDIN_OAUTH_CREDENTIAL_GRANT_IDENTITY_MISMATCH',
      );
    }

    return {
      credentialKind:
        'ACCESS_TOKEN',
      accessToken:
        grant.accessToken,
      tokenType:
        grant.tokenType,
      ...(typeof grant.expiresAt !== 'undefined'
        ? {
            expiresAt:
              grant.expiresAt,
          }
        : {}),
    };
  }
}