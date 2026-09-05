import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  createGrowthSocialProfileBindingV1,
  type GrowthSocialProfileBindingV1,
} from '@aura/intelligence-os/server';

import {
  FirestoreGrowthSocialProfileBindingRepositoryV1,
  type GrowthSocialProfileBindingCollectionReferenceV1,
  type GrowthSocialProfileBindingDocumentSnapshotV1,
  type GrowthSocialProfileBindingFirestoreV1,
  type GrowthSocialProfileBindingQuerySnapshotV1,
  type GrowthSocialProfileBindingQueryV1,
} from '../FirestoreGrowthSocialProfileBindingRepositoryV1';


interface FakeQueryStateV1 {

  readonly filters:
    readonly {
      readonly field:
        string;

      readonly value:
        unknown;
    }[];

}


const createBindingV1 =
  (
    overrides:
      Partial<GrowthSocialProfileBindingV1> =
        {},
  ):
    GrowthSocialProfileBindingV1 =>
      createGrowthSocialProfileBindingV1({
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


const createFakeFirestoreV1 =
  () => {

    const records =
      new Map<
        string,
        Readonly<Record<string, unknown>>
      >();

    const collectionNames:
      string[] =
        [];

    const queryStates:
      FakeQueryStateV1[] =
        [];


    const createQuery =
      (
        state:
          FakeQueryStateV1,
      ):
        GrowthSocialProfileBindingQueryV1 => ({

        where(
          field,
          _operator,
          value,
        ) {

          return createQuery({
            filters: [
              ...state.filters,
              {
                field,
                value,
              },
            ],
          });

        },

        async get():
          Promise<GrowthSocialProfileBindingQuerySnapshotV1> {

          queryStates.push(state);

          const docs =
            [...records.values()]
              .filter(
                (record) =>
                  state.filters.every(
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
              );

          return {
            docs,
          };

        },

      });


    const collection =
      (
        name:
          string,
      ):
        GrowthSocialProfileBindingCollectionReferenceV1 => {

        collectionNames.push(name);

        const baseQuery =
          createQuery({
            filters: [],
          });

        return {

          where:
            baseQuery.where,

          get:
            baseQuery.get,

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
      collectionNames,
      queryStates,
    };

  };


describe(
  'FirestoreGrowthSocialProfileBindingRepositoryV1',
  () => {

    it(
      'uses the frozen Growth social profile binding collection',
      async () => {

        const fake =
          createFakeFirestoreV1();

        const repository =
          new FirestoreGrowthSocialProfileBindingRepositoryV1({
            firestore:
              fake.firestore,
          });

        await repository.save(
          createBindingV1(),
        );

        expect(
          fake.collectionNames,
        ).toEqual([
          'growth_social_profile_bindings_v1',
        ]);

      },
    );


    it(
      'saves and reads one tenant-scoped binding by deterministic id',
      async () => {

        const fake =
          createFakeFirestoreV1();

        const repository =
          new FirestoreGrowthSocialProfileBindingRepositoryV1({
            firestore:
              fake.firestore,
          });

        const binding =
          createBindingV1();

        await repository.save(
          binding,
        );

        expect(
          [...fake.records.keys()],
        ).toEqual([
          'aura-nexus__linkedin-aura-nexus',
        ]);

        const loaded =
          await repository.getById({
            tenantId:
              'aura-nexus',

            bindingId:
              'linkedin-aura-nexus',
          });

        expect(loaded)
          .toEqual(binding);

      },
    );


    it(
      'lists only the requested tenant/provider/active scope',
      async () => {

        const fake =
          createFakeFirestoreV1();

        const repository =
          new FirestoreGrowthSocialProfileBindingRepositoryV1({
            firestore:
              fake.firestore,
          });

        await repository.save(
          createBindingV1(),
        );

        await repository.save(
          createBindingV1({
            bindingId:
              'facebook-aura-nexus',

            provider:
              'FACEBOOK',

            externalAccountId:
              'facebook-page-1',
          }),
        );

        await repository.save(
          createBindingV1({
            bindingId:
              'linkedin-disabled',

            isActive:
              false,

            externalAccountId:
              'urn:li:organization:999',
          }),
        );

        await repository.save(
          createBindingV1({
            bindingId:
              'linkedin-other-tenant',

            tenantId:
              'other-tenant',

            externalAccountId:
              'urn:li:organization:555',
          }),
        );

        const result =
          await repository.listByTenant({
            tenantId:
              'aura-nexus',

            provider:
              'LINKEDIN',

            activeOnly:
              true,
          });

        expect(
          result.map(
            (binding) =>
              binding.bindingId,
          ),
        ).toEqual([
          'linkedin-aura-nexus',
        ]);

      },
    );


    it(
      'does not persist credential or authorization material',
      async () => {

        const fake =
          createFakeFirestoreV1();

        const repository =
          new FirestoreGrowthSocialProfileBindingRepositoryV1({
            firestore:
              fake.firestore,
          });

        const unsafe =
          {
            ...createBindingV1(),
            accessToken:
              'forbidden',
          } as GrowthSocialProfileBindingV1 & {
            readonly accessToken:
              string;
          };

        await expect(
          repository.save(
            unsafe,
          ),
        ).rejects.toThrow(
          'GROWTH_SOCIAL_PROFILE_BINDING_CREDENTIAL_FIELD_FORBIDDEN',
        );

        expect(fake.records.size)
          .toBe(0);

      },
    );


    it(
      'rejects a document whose stored identity does not match the requested key',
      async () => {

        const fake =
          createFakeFirestoreV1();

        const repository =
          new FirestoreGrowthSocialProfileBindingRepositoryV1({
            firestore:
              fake.firestore,
          });

        fake.records.set(
          'aura-nexus__expected-binding',
          {
            ...createBindingV1({
              bindingId:
                'different-binding',
            }),
          },
        );

        await expect(
          repository.getById({
            tenantId:
              'aura-nexus',

            bindingId:
              'expected-binding',
          }),
        ).rejects.toThrow(
          'GROWTH_SOCIAL_PROFILE_BINDING_DOCUMENT_IDENTITY_MISMATCH',
        );

      },
    );

  },
);