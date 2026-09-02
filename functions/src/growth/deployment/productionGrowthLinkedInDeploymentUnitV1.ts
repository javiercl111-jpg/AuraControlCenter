import type {
  CallableOptions,
} from 'firebase-functions/v2/https';

import {
  resolveRuntimeEnvironmentV1,
  type RuntimeEnvironmentSourceV1,
} from '../../discovery/runtimeContracts/runtimeEnvironmentV1';


export const PRODUCTION_GROWTH_LINKEDIN_PROJECT_ID_V1 =
  'aura-control-center-debb3' as const;

export const PRODUCTION_GROWTH_LINKEDIN_ENVIRONMENT_V1 =
  'PRODUCTION' as const;

export const PRODUCTION_GROWTH_LINKEDIN_REGION_V1 =
  'us-central1' as const;

export const PRODUCTION_GROWTH_LINKEDIN_CODEBASE_V1 =
  'production-growth-linkedin' as const;

export const PRODUCTION_GROWTH_LINKEDIN_SERVICE_ACCOUNT_V1 =
  'production-growth-linkedin-rt@aura-control-center-debb3.iam.gserviceaccount.com' as const;

export const PRODUCTION_GROWTH_LINKEDIN_SECRET_NAME_V1 =
  'GROWTH_LINKEDIN_ACCESS_TOKEN' as const;


export const PRODUCTION_GROWTH_LINKEDIN_CALLABLE_OPTIONS_V1 =
  Object.freeze({
    growthLinkedInRuntimeReadinessV1:
      Object.freeze({
        region:
          PRODUCTION_GROWTH_LINKEDIN_REGION_V1,

        serviceAccount:
          PRODUCTION_GROWTH_LINKEDIN_SERVICE_ACCOUNT_V1,

        enforceAppCheck:
          true,
      }) satisfies Readonly<CallableOptions>,
  });


export class ProductionGrowthLinkedInDeploymentUnitErrorV1
extends Error {
  constructor(
    readonly code: string,
  ) {
    super(code);

    this.name =
      'ProductionGrowthLinkedInDeploymentUnitErrorV1';
  }
}


export function assertProductionGrowthLinkedInRuntimeV1(
  source:
    RuntimeEnvironmentSourceV1 =
      process.env,
): 'PRODUCTION' {
  const environment =
    resolveRuntimeEnvironmentV1(
      source,
    );

  if (
    environment !==
    PRODUCTION_GROWTH_LINKEDIN_ENVIRONMENT_V1
  ) {
    throw new ProductionGrowthLinkedInDeploymentUnitErrorV1(
      'PRODUCTION_GROWTH_LINKEDIN_ENVIRONMENT_REQUIRED',
    );
  }

  return environment;
}