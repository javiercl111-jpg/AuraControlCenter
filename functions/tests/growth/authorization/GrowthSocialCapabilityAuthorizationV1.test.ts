import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  GROWTH_SOCIAL_CAPABILITY_ENVIRONMENT_V1,
  GROWTH_SOCIAL_CAPABILITY_GRANT_COLLECTION_V1,
  GROWTH_SOCIAL_CAPABILITY_GRANT_SCHEMA_VERSION_V1,
  GROWTH_SOCIAL_MANAGE_CAPABILITY_V1,
  GROWTH_SOCIAL_PUBLISH_CAPABILITY_V1,
  hasGrowthSocialCapabilityV1,
  type GrowthSocialCapabilityFirestorePortV1,
} from '../../../src/growth/authorization/GrowthSocialCapabilityAuthorizationV1';

type DocumentValue =
  Record<string, unknown>;

const createFirestore =
  (
    documents: Readonly<
      Record<string, DocumentValue>
    >,
  ): GrowthSocialCapabilityFirestorePortV1 => ({
    collection: (collectionName: string) => ({
      doc: (id: string) => ({
        get: async () => {
          const key =
            `${collectionName}/${id}`;

          const value =
            documents[key];

          return {
            exists:
              value !== undefined,
            data: () =>
              value,
          };
        },
      }),
    }),
  });

const principal =
  (): DocumentValue => ({
    isActive: true,
    role: 'VIEWER',
  });

const grant =
  (
    capabilities:
      readonly string[],
  ): DocumentValue => ({
    capabilities: [...capabilities],
    environment:
      GROWTH_SOCIAL_CAPABILITY_ENVIRONMENT_V1,
    isActive: true,
    schemaVersion:
      GROWTH_SOCIAL_CAPABILITY_GRANT_SCHEMA_VERSION_V1,
  });

const dbFor =
  (
    capabilityGrant: DocumentValue,
    principalValue:
      DocumentValue = principal(),
  ): GrowthSocialCapabilityFirestorePortV1 =>
    createFirestore({
      'platform_global_admins/admin-1':
        principalValue,

      [`${GROWTH_SOCIAL_CAPABILITY_GRANT_COLLECTION_V1}/admin-1`]:
        capabilityGrant,
    });

describe(
  'GrowthSocialCapabilityAuthorizationV1',
  () => {
    it(
      'authorizes manage for an active canonical principal with an exact Preview grant',
      async () => {
        const allowed =
          await hasGrowthSocialCapabilityV1(
            dbFor(
              grant([
                GROWTH_SOCIAL_MANAGE_CAPABILITY_V1,
              ]),
            ),
            'admin-1',
            GROWTH_SOCIAL_MANAGE_CAPABILITY_V1,
          );

        expect(allowed).toBe(true);
      },
    );

    it(
      'keeps authorization independent from the VIEWER role',
      async () => {
        const allowed =
          await hasGrowthSocialCapabilityV1(
            dbFor(
              grant([
                GROWTH_SOCIAL_MANAGE_CAPABILITY_V1,
              ]),
              {
                isActive: true,
                role: 'VIEWER',
              },
            ),
            'admin-1',
            GROWTH_SOCIAL_MANAGE_CAPABILITY_V1,
          );

        expect(allowed).toBe(true);
      },
    );

    it(
      'does not infer publish from manage',
      async () => {
        const allowed =
          await hasGrowthSocialCapabilityV1(
            dbFor(
              grant([
                GROWTH_SOCIAL_MANAGE_CAPABILITY_V1,
              ]),
            ),
            'admin-1',
            GROWTH_SOCIAL_PUBLISH_CAPABILITY_V1,
          );

        expect(allowed).toBe(false);
      },
    );

    it(
      'allows publish only when publish is explicitly granted',
      async () => {
        const allowed =
          await hasGrowthSocialCapabilityV1(
            dbFor(
              grant([
                GROWTH_SOCIAL_MANAGE_CAPABILITY_V1,
                GROWTH_SOCIAL_PUBLISH_CAPABILITY_V1,
              ]),
            ),
            'admin-1',
            GROWTH_SOCIAL_PUBLISH_CAPABILITY_V1,
          );

        expect(allowed).toBe(true);
      },
    );

    it(
      'fails closed when the principal is inactive',
      async () => {
        const allowed =
          await hasGrowthSocialCapabilityV1(
            dbFor(
              grant([
                GROWTH_SOCIAL_MANAGE_CAPABILITY_V1,
              ]),
              {
                isActive: false,
                role: 'VIEWER',
              },
            ),
            'admin-1',
            GROWTH_SOCIAL_MANAGE_CAPABILITY_V1,
          );

        expect(allowed).toBe(false);
      },
    );

    it(
      'fails closed when the grant is absent',
      async () => {
        const allowed =
          await hasGrowthSocialCapabilityV1(
            createFirestore({
              'platform_global_admins/admin-1':
                principal(),
            }),
            'admin-1',
            GROWTH_SOCIAL_MANAGE_CAPABILITY_V1,
          );

        expect(allowed).toBe(false);
      },
    );

    it(
      'fails closed for the wrong environment',
      async () => {
        const invalidGrant =
          grant([
            GROWTH_SOCIAL_MANAGE_CAPABILITY_V1,
          ]);

        invalidGrant.environment =
          'PRODUCTION';

        const allowed =
          await hasGrowthSocialCapabilityV1(
            dbFor(invalidGrant),
            'admin-1',
            GROWTH_SOCIAL_MANAGE_CAPABILITY_V1,
          );

        expect(allowed).toBe(false);
      },
    );

    it(
      'fails closed for an unknown grant capability',
      async () => {
        const allowed =
          await hasGrowthSocialCapabilityV1(
            dbFor(
              grant([
                'growth.social.unknown',
              ]),
            ),
            'admin-1',
            GROWTH_SOCIAL_MANAGE_CAPABILITY_V1,
          );

        expect(allowed).toBe(false);
      },
    );

    it(
      'fails closed when the grant contains unexpected fields',
      async () => {
        const invalidGrant =
          grant([
            GROWTH_SOCIAL_MANAGE_CAPABILITY_V1,
          ]);

        invalidGrant.extra =
          'not-allowed';

        const allowed =
          await hasGrowthSocialCapabilityV1(
            dbFor(invalidGrant),
            'admin-1',
            GROWTH_SOCIAL_MANAGE_CAPABILITY_V1,
          );

        expect(allowed).toBe(false);
      },
    );

    it(
      'fails closed for a blank uid',
      async () => {
        const allowed =
          await hasGrowthSocialCapabilityV1(
            dbFor(
              grant([
                GROWTH_SOCIAL_MANAGE_CAPABILITY_V1,
              ]),
            ),
            '   ',
            GROWTH_SOCIAL_MANAGE_CAPABILITY_V1,
          );

        expect(allowed).toBe(false);
      },
    );
  },
);