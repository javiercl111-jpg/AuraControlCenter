import {
  GROWTH_SOCIAL_CAPABILITY_PRODUCTION_ENVIRONMENT_V1,
} from '../../growth/authorization/GrowthSocialCapabilityAuthorizationV1';

import {
  PRODUCTION_GROWTH_LINKEDIN_CALLABLE_OPTIONS_V1,
  assertProductionGrowthLinkedInRuntimeV1,
} from '../../growth/deployment/productionGrowthLinkedInDeploymentUnitV1';

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
      PRODUCTION_GROWTH_LINKEDIN_CALLABLE_OPTIONS_V1
        .growthSocialProfileManagementV1,

    environment:
      GROWTH_SOCIAL_CAPABILITY_PRODUCTION_ENVIRONMENT_V1,

    assertRuntime:
      assertProductionGrowthLinkedInRuntimeV1,
  });