import * as admin from 'firebase-admin';

import {
  resolveDiscoveryPrincipalV1,
  type DiscoveryAuthContextV1,
} from '../../discovery/runtimeContracts/resolveDiscoveryPrincipalV1';

import {
  GROWTH_SOCIAL_MANAGE_CAPABILITY_V1,
  hasGrowthSocialCapabilityV1,
} from '../../growth/authorization/GrowthSocialCapabilityAuthorizationV1';

import {
  GROWTH_LINKEDIN_INTEGRATION_TENANT_V1,
} from '../linkedin/GrowthLinkedInRuntimeCompositionV1';

import {
  type GrowthSocialProfileManagementCallableFactoryV1,
} from './GrowthSocialProfileManagementCallableRuntimeV1';


export type GrowthSocialProfileManagementFirebaseCompositionV1 =
  Pick<
    GrowthSocialProfileManagementCallableFactoryV1,
    | 'tenantId'
    | 'firestore'
    | 'resolvePrincipal'
    | 'hasCapability'
  >;


export const createGrowthSocialProfileManagementFirebaseCompositionV1 =
  ():
    GrowthSocialProfileManagementFirebaseCompositionV1 => {

    const resolveFirestoreV1 =
      () =>
        admin.firestore();

    const firestore =
      Object.freeze({
        collection(
          name:
            string,
        ) {

          return resolveFirestoreV1()
            .collection(
              name,
            ) as unknown as ReturnType<
              GrowthSocialProfileManagementCallableFactoryV1[
                'firestore'
              ]['collection']
            >;

        },
      }) satisfies GrowthSocialProfileManagementCallableFactoryV1[
        'firestore'
      ];

    return Object.freeze({
      tenantId:
        GROWTH_LINKEDIN_INTEGRATION_TENANT_V1,

      firestore,

      resolvePrincipal:
        async (
          auth:
            unknown,
        ) =>
          resolveDiscoveryPrincipalV1(
            resolveFirestoreV1(),
            auth as DiscoveryAuthContextV1,
          ),

      hasCapability:
        async (
          principalId,
          capability,
          environment,
        ) => {

          if (
            capability !==
            GROWTH_SOCIAL_MANAGE_CAPABILITY_V1
          ) {
            return false;
          }

          return hasGrowthSocialCapabilityV1(
            resolveFirestoreV1(),
            principalId,
            capability,
            environment,
          );

        },
    });

  };