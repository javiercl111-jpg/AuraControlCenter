import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  executeGrowthSocialProfileManagementRequestV1,
  type GrowthSocialProfileManagementCallableFactoryV1,
} from '../GrowthSocialProfileManagementCallableRuntimeV1';

import {
  type GrowthSocialProfileBindingCollectionReferenceV1,
  type GrowthSocialProfileBindingDocumentSnapshotV1,
  type GrowthSocialProfileBindingFirestoreV1,
  type GrowthSocialProfileBindingQuerySnapshotV1,
  type GrowthSocialProfileBindingQueryV1,
} from '../../../growth/social/profiles/FirestoreGrowthSocialProfileBindingRepositoryV1';

import {
  GROWTH_SOCIAL_MANAGE_CAPABILITY_V1,
  GROWTH_SOCIAL_CAPABILITY_PREVIEW_ENVIRONMENT_V1,
} from '../../../growth/authorization/GrowthSocialCapabilityAuthorizationV1';


const createFakeFirestoreV1 =
  () => {

    const records =
      new Map<
        string,
        Readonly<Record<string, unknown>>
      >();


    const createQuery =
      (
        filters:
          readonly {
            readonly field:
              string;

            readonly value:
              unknown;
          }[],
      ):
        GrowthSocialProfileBindingQueryV1 => ({

        where(
          field,
          _operator,
          value,
        ) {

          return createQuery([
            ...filters,
            {
              field,
              value,
            },
          ]);

        },

        async get():
          Promise<GrowthSocialProfileBindingQuerySnapshotV1> {

          return {
            docs:
              [...records.values()]
                .filter(
                  (record) =>
                    filters.every(
                      (filter) =>
                        record[filter.field] ===
                        filter.value,
                    ),
                )
                .map(
                  (record) => ({
                    data:
                      () => record,
                  }),
                ),
          };

        },

      });


    const collection =
      (
        _name:
          string,
      ):
        GrowthSocialProfileBindingCollectionReferenceV1 => {

        const query =
          createQuery([]);

        return {

          where:
            query.where,

          get:
            query.get,

          doc(documentId) {

            return {

              async get():
                Promise<GrowthSocialProfileBindingDocumentSnapshotV1> {

                const value =
                  records.get(documentId);

                return {
                  exists:
                    typeof value !== 'undefined',

                  data:
                    () => value,
                };

              },

              async set(value) {

                records.set(
                  documentId,
                  value,
                );

              },

            };

          },

        };

      };


    const firestore:
      GrowthSocialProfileBindingFirestoreV1 =
        {
          collection,
        };


    return {
      firestore,
      records,
    };

  };


const createDependenciesV1 =
  (
    authorized:
      boolean =
        true,
  ) => {

    const fake =
      createFakeFirestoreV1();

    let capabilitySeen:
      string | null =
        null;

    let principalResolutionCount =
      0;


    const dependencies:
      GrowthSocialProfileManagementCallableFactoryV1 =
        {
          callableOptions:
            {},

          environment:
            GROWTH_SOCIAL_CAPABILITY_PREVIEW_ENVIRONMENT_V1,

          tenantId:
            'aura-nexus',

          firestore:
            fake.firestore,

          assertRuntime:
            () => undefined,

          async resolvePrincipal() {

            principalResolutionCount++;

            return {
              uid:
                'principal-001',

              role:
                'PLATFORM_OWNER',
            };

          },

          async hasCapability(
            _principalId,
            capability,
          ) {

            capabilitySeen =
              capability;

            return authorized;

          },
        };


    return {
      dependencies,
      fake,

      readCapabilitySeen:
        () => capabilitySeen,

      readPrincipalResolutionCount:
        () => principalResolutionCount,
    };

  };


const baseBindingV1 =
  () => ({
    bindingId:
      'linkedin-aura-nexus',

    provider:
      'LINKEDIN' as const,

    accountType:
      'ORGANIZATION' as const,

    externalAccountId:
      'urn:li:organization:123',

    displayName:
      'Aura Nexus',

    connectionState:
      'CONNECTED' as const,

    isActive:
      true,

    createdAt:
      '2026-09-04T00:00:00.000Z',

    updatedAt:
      '2026-09-04T00:00:00.000Z',
  });


describe(
  'GrowthSocialProfileManagementCallableRuntimeV1',
  () => {

    it(
      'requires authentication before principal resolution',
      async () => {

        const harness =
          createDependenciesV1();

        await expect(
          executeGrowthSocialProfileManagementRequestV1(
            harness.dependencies,
            {
              data: {
                operation:
                  'LIST_BY_TENANT',
              },
            },
          ),
        ).rejects.toThrow(
          'AUTHENTICATION_REQUIRED',
        );

        expect(
          harness.readPrincipalResolutionCount(),
        ).toBe(0);

      },
    );


    it(
      'requires explicit growth.social.manage capability',
      async () => {

        const harness =
          createDependenciesV1(
            false,
          );

        await expect(
          executeGrowthSocialProfileManagementRequestV1(
            harness.dependencies,
            {
              auth: {
                uid:
                  'firebase-user',
              },

              data: {
                operation:
                  'LIST_BY_TENANT',
              },
            },
          ),
        ).rejects.toThrow(
          'SOCIAL_PROFILE_MANAGEMENT_NOT_AUTHORIZED',
        );

        expect(
          harness.readCapabilitySeen(),
        ).toBe(
          GROWTH_SOCIAL_MANAGE_CAPABILITY_V1,
        );

      },
    );


    it(
      'upserts using only the server-managed tenant',
      async () => {

        const harness =
          createDependenciesV1();

        const result =
          await executeGrowthSocialProfileManagementRequestV1(
            harness.dependencies,
            {
              auth: {
                uid:
                  'firebase-user',
              },

              data: {
                operation:
                  'UPSERT',

                binding:
                  baseBindingV1(),
              },
            },
          );

        expect(result.operation)
          .toBe('UPSERT');

        if (result.operation !== 'UPSERT') {
          throw new Error(
            'EXPECTED_UPSERT_RESULT',
          );
        }

        expect(result.binding.tenantId)
          .toBe('aura-nexus');

        expect(result.binding)
          .not
          .toHaveProperty(
            'publishAuthority',
          );

        expect(result.binding)
          .not
          .toHaveProperty(
            'manageAuthority',
          );

      },
    );


    it(
      'rejects client-controlled tenantId on upsert',
      async () => {

        const harness =
          createDependenciesV1();

        await expect(
          executeGrowthSocialProfileManagementRequestV1(
            harness.dependencies,
            {
              auth: {
                uid:
                  'firebase-user',
              },

              data: {
                operation:
                  'UPSERT',

                binding: {
                  ...baseBindingV1(),

                  tenantId:
                    'other-tenant',
                },
              },
            },
          ),
        ).rejects.toThrow(
          'SOCIAL_PROFILE_MANAGEMENT_TENANT_IS_SERVER_MANAGED',
        );

      },
    );


    it(
      'rejects credential material through domain validation',
      async () => {

        const harness =
          createDependenciesV1();

        await expect(
          executeGrowthSocialProfileManagementRequestV1(
            harness.dependencies,
            {
              auth: {
                uid:
                  'firebase-user',
              },

              data: {
                operation:
                  'UPSERT',

                binding: {
                  ...baseBindingV1(),

                  accessToken:
                    'forbidden',
                },
              },
            },
          ),
        ).rejects.toThrow(
          'GROWTH_SOCIAL_PROFILE_BINDING_CREDENTIAL_FIELD_FORBIDDEN',
        );

        expect(
          harness.fake.records.size,
        ).toBe(0);

      },
    );


    it(
      'gets a binding only from the configured tenant',
      async () => {

        const harness =
          createDependenciesV1();

        await executeGrowthSocialProfileManagementRequestV1(
          harness.dependencies,
          {
            auth: {
              uid:
                'firebase-user',
            },

            data: {
              operation:
                'UPSERT',

              binding:
                baseBindingV1(),
            },
          },
        );

        const result =
          await executeGrowthSocialProfileManagementRequestV1(
            harness.dependencies,
            {
              auth: {
                uid:
                  'firebase-user',
              },

              data: {
                operation:
                  'GET_BY_ID',

                bindingId:
                  'linkedin-aura-nexus',
              },
            },
          );

        expect(result.operation)
          .toBe('GET_BY_ID');

        if (result.operation !== 'GET_BY_ID') {
          throw new Error(
            'EXPECTED_GET_RESULT',
          );
        }

        expect(result.binding?.tenantId)
          .toBe('aura-nexus');

      },
    );


    it(
      'lists tenant provider and active scope without publish authority',
      async () => {

        const harness =
          createDependenciesV1();

        await executeGrowthSocialProfileManagementRequestV1(
          harness.dependencies,
          {
            auth: {
              uid:
                'firebase-user',
            },

            data: {
              operation:
                'UPSERT',

              binding:
                baseBindingV1(),
            },
          },
        );

        const result =
          await executeGrowthSocialProfileManagementRequestV1(
            harness.dependencies,
            {
              auth: {
                uid:
                  'firebase-user',
              },

              data: {
                operation:
                  'LIST_BY_TENANT',

                provider:
                  'LINKEDIN',

                activeOnly:
                  true,
              },
            },
          );

        expect(result.operation)
          .toBe('LIST_BY_TENANT');

        if (result.operation !== 'LIST_BY_TENANT') {
          throw new Error(
            'EXPECTED_LIST_RESULT',
          );
        }

        expect(result.bindings)
          .toHaveLength(1);

        expect(result.bindings[0]?.tenantId)
          .toBe('aura-nexus');

        expect(result.bindings[0])
          .not
          .toHaveProperty(
            'publishAuthority',
          );

      },
    );


    it(
      'rejects unsupported operations',
      async () => {

        const harness =
          createDependenciesV1();

        await expect(
          executeGrowthSocialProfileManagementRequestV1(
            harness.dependencies,
            {
              auth: {
                uid:
                  'firebase-user',
              },

              data: {
                operation:
                  'PUBLISH',
              },
            },
          ),
        ).rejects.toThrow(
          'SOCIAL_PROFILE_MANAGEMENT_OPERATION_INVALID',
        );

      },
    );

  },
);