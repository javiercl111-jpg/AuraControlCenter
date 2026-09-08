import {
  PREVIEW_DISCOVERY_CALLABLE_OPTIONS_V1,
  assertPreviewDiscoveryRuntimeV1,
} from '../../discovery/deployment/previewDiscoveryDeploymentUnitV1';

import {
  GROWTH_SOCIAL_CAPABILITY_PREVIEW_ENVIRONMENT_V1,
} from '../../growth/authorization/GrowthSocialCapabilityAuthorizationV1';

import {
  createGrowthSocialProfileManagementFirebaseCompositionV1,
} from './GrowthSocialProfileManagementFirebaseCompositionV1';

import {
  createGrowthSocialProfileManagementCallableRuntimeV1,
} from './GrowthSocialProfileManagementCallableRuntimeV1';


const firebaseComposition =
  createGrowthSocialProfileManagementFirebaseCompositionV1();


export const growthSocialProfileManagementV1 =
  createGrowthSocialProfileManagementCallableRuntimeV1({
    ...firebaseComposition,

    callableOptions:
      PREVIEW_DISCOVERY_CALLABLE_OPTIONS_V1
        .growthSocialProfileManagementV1,

    environment:
      GROWTH_SOCIAL_CAPABILITY_PREVIEW_ENVIRONMENT_V1,

    assertRuntime:
      assertPreviewDiscoveryRuntimeV1,
  });