import {
  GROWTH_SOCIAL_CAPABILITY_PRODUCTION_ENVIRONMENT_V1,
} from '../../growth/authorization/GrowthSocialCapabilityAuthorizationV1';

import {
  PRODUCTION_GROWTH_LINKEDIN_CALLABLE_OPTIONS_V1,
  assertProductionGrowthLinkedInRuntimeV1,
} from '../../growth/deployment/productionGrowthLinkedInDeploymentUnitV1';

import {
  createGrowthLinkedInRuntimeReadinessV1,
} from './GrowthLinkedInCallableRuntimeV1';


export const growthLinkedInRuntimeReadinessV1 =
  createGrowthLinkedInRuntimeReadinessV1({
    callableOptions:
      PRODUCTION_GROWTH_LINKEDIN_CALLABLE_OPTIONS_V1
        .growthLinkedInRuntimeReadinessV1,

    environment:
      GROWTH_SOCIAL_CAPABILITY_PRODUCTION_ENVIRONMENT_V1,

    assertRuntime:
      assertProductionGrowthLinkedInRuntimeV1,
  });