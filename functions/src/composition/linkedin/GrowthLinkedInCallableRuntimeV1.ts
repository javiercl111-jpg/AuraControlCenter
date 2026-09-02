import * as admin from 'firebase-admin';

import {
  HttpsError,
  onCall,
  type CallableOptions,
} from 'firebase-functions/v2/https';

import {
  resolveDiscoveryPrincipalV1,
} from '../../discovery/runtimeContracts/resolveDiscoveryPrincipalV1';

import {
  growthLinkedInAccessTokenSecretV1,
} from '../../infrastructure/linkedin/credentials/GrowthLinkedInFirebaseSecretSourceV1';

import {
  GROWTH_SOCIAL_MANAGE_CAPABILITY_V1,
  hasGrowthSocialCapabilityV1,
  type GrowthSocialCapabilityEnvironmentV1,
} from '../../growth/authorization/GrowthSocialCapabilityAuthorizationV1';

import {
  GROWTH_LINKEDIN_INTEGRATION_TENANT_V1,
} from './GrowthLinkedInRuntimeCompositionV1';


export interface GrowthLinkedInRuntimeReadinessFactoryV1 {
  readonly callableOptions:
    Readonly<CallableOptions>;

  readonly environment:
    GrowthSocialCapabilityEnvironmentV1;

  readonly assertRuntime:
    () => void;
}


export const createGrowthLinkedInRuntimeReadinessV1 =
  (
    dependencies:
      GrowthLinkedInRuntimeReadinessFactoryV1,
  ) =>
    onCall(
      {
        ...dependencies.callableOptions,

        enforceAppCheck:
          true,

        secrets: [
          growthLinkedInAccessTokenSecretV1,
        ],
      },

      async (
        request,
      ) => {
        dependencies.assertRuntime();

        if (!request.auth) {
          throw new HttpsError(
            'unauthenticated',
            'AUTHENTICATION_REQUIRED',
          );
        }


        const caller =
          await resolveDiscoveryPrincipalV1(
            admin.firestore(),
            request.auth,
          );


        const capabilityAuthorized =
          await hasGrowthSocialCapabilityV1(
            admin.firestore(),
            caller.uid,
            GROWTH_SOCIAL_MANAGE_CAPABILITY_V1,
            dependencies.environment,
          );

        if (!capabilityAuthorized) {
          throw new HttpsError(
            'permission-denied',
            'LINKEDIN_RUNTIME_NOT_AUTHORIZED',
          );
        }


        return Object.freeze({
          status:
            'AUTHORIZED',

          tenantId:
            GROWTH_LINKEDIN_INTEGRATION_TENANT_V1,

          principalId:
            caller.uid,

          role:
            caller.role,

          secretBinding:
            'DECLARED_NOT_READ',

          linkedInConnection:
            'NOT_EXECUTED',
        });
      },
    );