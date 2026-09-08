import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  createGrowthSocialProfileBindingV1,
  type CreateGrowthSocialProfileBindingInputV1,
  type GrowthSocialProfileBindingV1,
} from '../GrowthSocialProfileBindingV1';

import {
  type GrowthSocialProfileBindingKeyV1,
  type GrowthSocialProfileBindingListQueryV1,
  type GrowthSocialProfileBindingRepositoryV1,
} from '../GrowthSocialProfileBindingRepositoryV1';

import {
  GrowthSocialProfileBindingManagementServiceV1,
} from '../GrowthSocialProfileBindingManagementServiceV1';


const createInputV1 =
  (
    overrides:
      Partial<CreateGrowthSocialProfileBindingInputV1> =
        {},
  ):
    CreateGrowthSocialProfileBindingInputV1 => ({
      bindingId:
        'linkedin-aura-nexus',

      tenantId:
        'aura-nexus',

      provider:
        'LINKEDIN',

      accountType:
        'ORGANIZATION',

      externalAccountId:
        'urn:li:organization:123',

      displayName:
        'Aura Nexus',

      connectionState:
        'CONNECTED',

      isActive:
        true,

      createdAt:
        '2026-09-04T00:00:00.000Z',

      updatedAt:
        '2026-09-04T00:00:00.000Z',

      ...overrides,
    });


const createRepositoryHarnessV1 =
  () => {

    let saved:
      GrowthSocialProfileBindingV1 | null =
        null;

    let getResponse:
      GrowthSocialProfileBindingV1 | null =
        null;

    let listResponse:
      readonly GrowthSocialProfileBindingV1[] =
        [];

    let lastGetKey:
      GrowthSocialProfileBindingKeyV1 | null =
        null;

    let lastListQuery:
      GrowthSocialProfileBindingListQueryV1 | null =
        null;


    const repository:
      GrowthSocialProfileBindingRepositoryV1 =
        {

          async getById(key) {

            lastGetKey =
              key;

            return getResponse;

          },

          async listByTenant(query) {

            lastListQuery =
              query;

            return listResponse;

          },

          async save(binding) {

            saved =
              binding;

          },

        };


    return {

      repository,

      readSaved:
        () => saved,

      setGetResponse:
        (
          value:
            GrowthSocialProfileBindingV1 | null,
        ) => {

          getResponse =
            value;

        },

      setListResponse:
        (
          value:
            readonly GrowthSocialProfileBindingV1[],
        ) => {

          listResponse =
            value;

        },

      readLastGetKey:
        () => lastGetKey,

      readLastListQuery:
        () => lastListQuery,

    };

  };


describe(
  'GrowthSocialProfileBindingManagementServiceV1',
  () => {

    it(
      'validates and saves an upserted binding',
      async () => {

        const harness =
          createRepositoryHarnessV1();

        const service =
          new GrowthSocialProfileBindingManagementServiceV1({
            repository:
              harness.repository,
          });

        const binding =
          await service.upsert(
            createInputV1({
              bindingId:
                '  linkedin-aura-nexus  ',
            }),
          );

        expect(binding.bindingId)
          .toBe(
            'linkedin-aura-nexus',
          );

        expect(
          harness.readSaved(),
        ).toEqual(binding);

      },
    );


    it(
      'rejects credential material before repository save',
      async () => {

        const harness =
          createRepositoryHarnessV1();

        const service =
          new GrowthSocialProfileBindingManagementServiceV1({
            repository:
              harness.repository,
          });

        const unsafe =
          {
            ...createInputV1(),
            accessToken:
              'forbidden',
          } as CreateGrowthSocialProfileBindingInputV1 & {
            readonly accessToken:
              string;
          };

        await expect(
          service.upsert(
            unsafe,
          ),
        ).rejects.toThrow(
          'GROWTH_SOCIAL_PROFILE_BINDING_CREDENTIAL_FIELD_FORBIDDEN',
        );

        expect(
          harness.readSaved(),
        ).toBeNull();

      },
    );


    it(
      'gets a binding only through the requested tenant identity',
      async () => {

        const harness =
          createRepositoryHarnessV1();

        const service =
          new GrowthSocialProfileBindingManagementServiceV1({
            repository:
              harness.repository,
          });

        const binding =
          createGrowthSocialProfileBindingV1(
            createInputV1(),
          );

        harness.setGetResponse(
          binding,
        );

        const result =
          await service.getById({
            tenantId:
              '  aura-nexus  ',

            bindingId:
              '  linkedin-aura-nexus  ',
          });

        expect(result)
          .toEqual(binding);

        expect(
          harness.readLastGetKey(),
        ).toEqual({
          tenantId:
            'aura-nexus',

          bindingId:
            'linkedin-aura-nexus',
        });

      },
    );


    it(
      'rejects repository identity mismatch on get',
      async () => {

        const harness =
          createRepositoryHarnessV1();

        const service =
          new GrowthSocialProfileBindingManagementServiceV1({
            repository:
              harness.repository,
          });

        harness.setGetResponse(
          createGrowthSocialProfileBindingV1(
            createInputV1({
              bindingId:
                'different-binding',
            }),
          ),
        );

        await expect(
          service.getById({
            tenantId:
              'aura-nexus',

            bindingId:
              'linkedin-aura-nexus',
          }),
        ).rejects.toThrow(
          'GROWTH_SOCIAL_PROFILE_BINDING_REPOSITORY_IDENTITY_MISMATCH',
        );

      },
    );


    it(
      'preserves tenant provider and active list scope',
      async () => {

        const harness =
          createRepositoryHarnessV1();

        const service =
          new GrowthSocialProfileBindingManagementServiceV1({
            repository:
              harness.repository,
          });

        const binding =
          createGrowthSocialProfileBindingV1(
            createInputV1(),
          );

        harness.setListResponse([
          binding,
        ]);

        const result =
          await service.listByTenant({
            tenantId:
              '  aura-nexus  ',

            provider:
              'LINKEDIN',

            activeOnly:
              true,
          });

        expect(
          harness.readLastListQuery(),
        ).toEqual({
          tenantId:
            'aura-nexus',

          provider:
            'LINKEDIN',

          activeOnly:
            true,
        });

        expect(result)
          .toEqual([
            binding,
          ]);

        expect(
          Object.isFrozen(result),
        ).toBe(true);

      },
    );


    it(
      'rejects a repository result outside the requested tenant',
      async () => {

        const harness =
          createRepositoryHarnessV1();

        const service =
          new GrowthSocialProfileBindingManagementServiceV1({
            repository:
              harness.repository,
          });

        harness.setListResponse([
          createGrowthSocialProfileBindingV1(
            createInputV1({
              tenantId:
                'another-tenant',
            }),
          ),
        ]);

        await expect(
          service.listByTenant({
            tenantId:
              'aura-nexus',
          }),
        ).rejects.toThrow(
          'GROWTH_SOCIAL_PROFILE_BINDING_REPOSITORY_TENANT_SCOPE_MISMATCH',
        );

      },
    );


    it(
      'does not infer publish or manage authority from a binding',
      async () => {

        const harness =
          createRepositoryHarnessV1();

        const service =
          new GrowthSocialProfileBindingManagementServiceV1({
            repository:
              harness.repository,
          });

        const binding =
          await service.upsert(
            createInputV1(),
          );

        expect(binding)
          .not
          .toHaveProperty(
            'publishAuthority',
          );

        expect(binding)
          .not
          .toHaveProperty(
            'manageAuthority',
          );

        expect(binding)
          .not
          .toHaveProperty(
            'permissions',
          );

      },
    );

  },
);