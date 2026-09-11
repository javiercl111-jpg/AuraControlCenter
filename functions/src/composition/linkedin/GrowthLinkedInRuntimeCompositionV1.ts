import {
  GrowthLinkedInFirebaseSecretSourceV1,
} from '../../infrastructure/linkedin/credentials/GrowthLinkedInFirebaseSecretSourceV1';

import {
  GrowthLinkedInServerCredentialBoundaryV1,
  type GrowthLinkedInServerCredentialSourceV1,
} from '../../infrastructure/linkedin/credentials/GrowthLinkedInServerCredentialBoundaryV1';


export const GROWTH_LINKEDIN_INTEGRATION_TENANT_V1 =
  'aura_root';


export interface GrowthLinkedInCredentialBoundaryFactoryDependenciesV1 {
  readonly source?: GrowthLinkedInServerCredentialSourceV1;
}
export const createGrowthLinkedInCredentialBoundaryV1 =
  (
    dependencies: GrowthLinkedInCredentialBoundaryFactoryDependenciesV1 = {},
  ): GrowthLinkedInServerCredentialBoundaryV1 => {

    const source =
      dependencies.source ??
    new GrowthLinkedInFirebaseSecretSourceV1({
        authorizedTenantId:
          GROWTH_LINKEDIN_INTEGRATION_TENANT_V1,
      });

    return new GrowthLinkedInServerCredentialBoundaryV1(
      source,
    );
  };