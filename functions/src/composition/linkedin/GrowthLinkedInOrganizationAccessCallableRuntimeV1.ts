import {
  growthLinkedInAccessTokenSecretV1,
} from '../../infrastructure/linkedin/credentials/GrowthLinkedInFirebaseSecretSourceV1';

import {
  GROWTH_LINKEDIN_INTEGRATION_TENANT_V1,
  createGrowthLinkedInCredentialBoundaryV1,
} from './GrowthLinkedInRuntimeCompositionV1';
import {
  getFirestore,
} from 'firebase-admin/firestore';

import {
  HttpsError,
  onCall,
  type CallableOptions,
} from 'firebase-functions/v2/https';

import {
  hasGrowthSocialCapabilityV1,
} from '../../growth/authorization/GrowthSocialCapabilityAuthorizationV1';

import {
  GrowthLinkedInOrganizationAccessReaderErrorV1,
  readGrowthLinkedInOrganizationAccessV1,
} from '../../infrastructure/linkedin/read/GrowthLinkedInOrganizationAccessReaderV1';

export type GrowthLinkedInOrganizationAccessEnvironmentV1 =
  | 'PREVIEW'
  | 'PRODUCTION';

export function createGrowthLinkedInOrganizationAccessCallableRuntimeV1(
  callableOptions: Readonly<CallableOptions>,
  expectedEnvironment:
    GrowthLinkedInOrganizationAccessEnvironmentV1,
  assertRuntime?: () => unknown,
) {
  return onCall(
    {
      ...callableOptions,
      secrets: [
        growthLinkedInAccessTokenSecretV1,
      ],
    },
    async (request) => {
      assertRuntime?.();

      if (!request.auth) {
        throw new HttpsError(
          'unauthenticated',
          'AUTHENTICATED_USER_REQUIRED',
        );
      }

      const uid =
        request.auth.uid.trim();

      if (!uid) {
        throw new HttpsError(
          'unauthenticated',
          'AUTHENTICATED_USER_REQUIRED',
        );
      }

      const capabilityAuthorized =
        await hasGrowthSocialCapabilityV1(
          getFirestore(),
          uid,
          'growth.social.manage',
          expectedEnvironment,
        );

      if (!capabilityAuthorized) {
        throw new HttpsError(
          'permission-denied',
          'GROWTH_SOCIAL_MANAGE_REQUIRED',
        );
      }

      const accessToken =
        (
          await createGrowthLinkedInCredentialBoundaryV1()
            .acquire({
              tenantId:
                GROWTH_LINKEDIN_INTEGRATION_TENANT_V1,
              credentialKind:
                'ACCESS_TOKEN',
            })
        ).accessToken;

      if (!accessToken.trim()) {
        throw new HttpsError(
          'failed-precondition',
          'LINKEDIN_ACCESS_TOKEN_REQUIRED',
        );
      }

      try {
        const result =
          await readGrowthLinkedInOrganizationAccessV1(
            accessToken,
          );

        return Object.freeze({
          status:
            result.status,
          tenantId:
            'aura_root',
          principalId:
            uid,
          httpStatus:
            result.httpStatus,
          organizationCount:
            result.organizationCount,
          organizations:
            result.organizations,
          linkedInConnection:
            'READ_ONLY_ACCESS_VALIDATED',
          publication:
            'NOT_EXECUTED',
        });
      } catch (candidateError) {
        if (
          candidateError instanceof
          GrowthLinkedInOrganizationAccessReaderErrorV1
        ) {
          if (candidateError.httpStatus === 401) {
            throw new HttpsError(
              'unauthenticated',
              candidateError.code,
            );
          }

          if (candidateError.httpStatus === 403) {
            throw new HttpsError(
              'permission-denied',
              candidateError.code,
            );
          }

          throw new HttpsError(
            'failed-precondition',
            candidateError.code,
          );
        }

        throw new HttpsError(
          'internal',
          'LINKEDIN_ORGANIZATION_ACCESS_READ_FAILED',
        );
      }
    },
  );
}