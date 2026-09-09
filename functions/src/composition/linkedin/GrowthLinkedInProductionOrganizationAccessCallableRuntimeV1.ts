import {
  createGrowthLinkedInOrganizationAccessCallableRuntimeV1,
} from './GrowthLinkedInOrganizationAccessCallableRuntimeV1';

import {
  PRODUCTION_GROWTH_LINKEDIN_CALLABLE_OPTIONS_V1,
} from '../../growth/deployment/productionGrowthLinkedInDeploymentUnitV1';

export const growthLinkedInOrganizationAccessV1 =
  createGrowthLinkedInOrganizationAccessCallableRuntimeV1(
    PRODUCTION_GROWTH_LINKEDIN_CALLABLE_OPTIONS_V1
      .growthLinkedInOrganizationAccessV1,
    'PRODUCTION',
  );