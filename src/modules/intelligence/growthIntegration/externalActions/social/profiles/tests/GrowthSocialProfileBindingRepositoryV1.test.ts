import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  createGrowthSocialProfileBindingV1,
  type GrowthSocialProfileBindingV1,
} from '../GrowthSocialProfileBindingV1';

import {
  GROWTH_SOCIAL_PROFILE_BINDING_COLLECTION_V1,
  type GrowthSocialProfileBindingRepositoryV1,
} from '../GrowthSocialProfileBindingRepositoryV1';


describe(
  'GrowthSocialProfileBindingRepositoryV1',
  () => {

    it(
      'freezes the persistence collection name',
      () => {

        expect(
          GROWTH_SOCIAL_PROFILE_BINDING_COLLECTION_V1,
        ).toBe(
          'growth_social_profile_bindings_v1',
        );

      },
    );


    it(
      'supports tenant-scoped save, get and list semantics',
      async () => {

        const records =
          new Map<
            string,
            GrowthSocialProfileBindingV1
          >();

        const repository:
          GrowthSocialProfileBindingRepositoryV1 =
          {
            async getById(key) {

              return (
                records.get(
                  `${key.tenantId}:${key.bindingId}`,
                ) ??
                null
              );

            },

            async listByTenant(query) {

              return [
                ...records.values(),
              ].filter(
                (record) =>
                  record.tenantId === query.tenantId &&
                  (
                    typeof query.provider === 'undefined' ||
                    record.provider === query.provider
                  ) &&
                  (
                    query.activeOnly !== true ||
                    record.isActive === true
                  ),
              );

            },

            async save(binding) {

              records.set(
                `${binding.tenantId}:${binding.bindingId}`,
                binding,
              );

            },
          };

        const binding =
          createGrowthSocialProfileBindingV1({
            bindingId:
              'binding-linkedin-001',

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
          });

        await repository.save(
          binding,
        );

        const loaded =
          await repository.getById({
            tenantId:
              'aura-nexus',

            bindingId:
              'binding-linkedin-001',
          });

        expect(loaded)
          .toEqual(binding);

        const tenantBindings =
          await repository.listByTenant({
            tenantId:
              'aura-nexus',

            provider:
              'LINKEDIN',

            activeOnly:
              true,
          });

        expect(tenantBindings)
          .toEqual([
            binding,
          ]);

        const otherTenantBindings =
          await repository.listByTenant({
            tenantId:
              'another-tenant',
          });

        expect(otherTenantBindings)
          .toEqual([]);

      },
    );

  },
);