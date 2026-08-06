import { buildAuthorityProvisioningServiceV1 } from './AuthorityProvisioningService';
import type { AuthorityProvisioningDependenciesV1 } from './authorityProvisioningPorts';
import type { AuthorityProvisioningServiceV1 } from './authorityProvisioningTypes';
import { validateAuthorityProvisioningDependenciesV1 } from './authorityProvisioningValidators';

export function createAuthorityProvisioningServiceV1(
  dependencies: AuthorityProvisioningDependenciesV1,
): AuthorityProvisioningServiceV1 {
  return buildAuthorityProvisioningServiceV1(
    validateAuthorityProvisioningDependenciesV1(dependencies),
  );
}
