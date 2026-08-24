import * as admin from 'firebase-admin';

import {
  HttpsError,
  onCall,
} from 'firebase-functions/v2/https';

import {
  resolvePlatformPrincipal,
} from '../../auth/resolvePlatformPrincipal';

import {
  growthLinkedInAccessTokenSecretV1,
} from '../../infrastructure/linkedin/credentials/GrowthLinkedInFirebaseSecretSourceV1';

import {
  GROWTH_LINKEDIN_INTEGRATION_TENANT_V1,
} from './GrowthLinkedInRuntimeCompositionV1';


export const GROWTH_LINKEDIN_AUTHORIZED_ROLES_V1 =
  Object.freeze([
    'SUPER_ADMIN',
    'FOUNDER',
    'SALES_DIRECTOR',
    'PLATFORM_OWNER',
    'PLATFORM_PARTNER',
    'PARTNER',
  ] as const);


export const isGrowthLinkedInAuthorizedRoleV1 =
  (
    role:
      string,
  ): boolean => {

    return (
      GROWTH_LINKEDIN_AUTHORIZED_ROLES_V1 as
        readonly string[]
    ).includes(
      role,
    );
  };


export const growthLinkedInRuntimeReadinessV1 =
  onCall(
    {
      enforceAppCheck:
        true,

      secrets: [
        growthLinkedInAccessTokenSecretV1,
      ],
    },

    async (
      request,
    ) => {

      if (!request.auth) {
        throw new HttpsError(
          'unauthenticated',
          'AUTHENTICATION_REQUIRED',
        );
      }


      const caller =
        await resolvePlatformPrincipal(
          admin.firestore(),
          request.auth,
        );


      if (
        !isGrowthLinkedInAuthorizedRoleV1(
          caller.role,
        )
      ) {
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
          caller.id,

        role:
          caller.role,

        secretBinding:
          'DECLARED_NOT_READ',

        linkedInConnection:
          'NOT_EXECUTED',
      });
    },
  );