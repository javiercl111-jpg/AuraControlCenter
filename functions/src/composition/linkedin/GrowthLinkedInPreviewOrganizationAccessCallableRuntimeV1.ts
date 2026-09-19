import {
  PREVIEW_DISCOVERY_CALLABLE_OPTIONS_V1,
  assertPreviewDiscoveryRuntimeV1,
} from '../../discovery/deployment/previewDiscoveryDeploymentUnitV1';

import {
  GROWTH_SOCIAL_CAPABILITY_PREVIEW_ENVIRONMENT_V1,
} from '../../growth/authorization/GrowthSocialCapabilityAuthorizationV1';

import {
  createGrowthLinkedInOrganizationAccessCallableRuntimeV1,
} from './GrowthLinkedInOrganizationAccessCallableRuntimeV1';


export const growthLinkedInOrganizationAccessV1 =
  createGrowthLinkedInOrganizationAccessCallableRuntimeV1(
    PREVIEW_DISCOVERY_CALLABLE_OPTIONS_V1
      .growthLinkedInOrganizationAccessV1,
    GROWTH_SOCIAL_CAPABILITY_PREVIEW_ENVIRONMENT_V1,
    assertPreviewDiscoveryRuntimeV1,
  );