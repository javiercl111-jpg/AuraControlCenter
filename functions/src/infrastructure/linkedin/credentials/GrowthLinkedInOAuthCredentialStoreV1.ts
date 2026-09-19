import type {
  GrowthLinkedInOAuthCredentialGrantV1,
} from './GrowthLinkedInOAuthCredentialGrantV1';

export interface GrowthLinkedInOAuthCredentialKeyV1 {
  readonly tenantId: string;
  readonly bindingId: string;
}

export interface GrowthLinkedInOAuthCredentialStoreV1 {
  readGrant(
    key: GrowthLinkedInOAuthCredentialKeyV1,
  ): Promise<GrowthLinkedInOAuthCredentialGrantV1 | null>;
}

export const assertGrowthLinkedInOAuthCredentialKeyV1 = (
  key: GrowthLinkedInOAuthCredentialKeyV1,
): void => {
  if (
    key === null ||
    typeof key !== 'object'
  ) {
    throw new Error(
      'LINKEDIN_OAUTH_CREDENTIAL_KEY_REQUIRED',
    );
  }

  if (
    typeof key.tenantId !== 'string' ||
    key.tenantId.trim().length === 0
  ) {
    throw new Error(
      'LINKEDIN_OAUTH_CREDENTIAL_TENANT_ID_REQUIRED',
    );
  }

  if (
    typeof key.bindingId !== 'string' ||
    key.bindingId.trim().length === 0
  ) {
    throw new Error(
      'LINKEDIN_OAUTH_CREDENTIAL_BINDING_ID_REQUIRED',
    );
  }
};