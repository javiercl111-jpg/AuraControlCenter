import {
  PREVIEW_DISCOVERY_CALLABLE_OPTIONS_V1,
  assertPreviewDiscoveryRuntimeV1,
} from '../../discovery/deployment/previewDiscoveryDeploymentUnitV1';

import {
  GROWTH_SOCIAL_CAPABILITY_PREVIEW_ENVIRONMENT_V1,
} from '../../growth/authorization/GrowthSocialCapabilityAuthorizationV1';

import {
  createGrowthLinkedInRuntimeReadinessV1,
} from './GrowthLinkedInCallableRuntimeV1';


export const growthLinkedInRuntimeReadinessV1 =
  createGrowthLinkedInRuntimeReadinessV1({
    callableOptions:
      PREVIEW_DISCOVERY_CALLABLE_OPTIONS_V1
        .growthLinkedInRuntimeReadinessV1,

    environment:
      GROWTH_SOCIAL_CAPABILITY_PREVIEW_ENVIRONMENT_V1,

    assertRuntime:
      assertPreviewDiscoveryRuntimeV1,
  });