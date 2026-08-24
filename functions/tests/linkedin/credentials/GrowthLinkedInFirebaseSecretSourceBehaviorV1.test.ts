import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  GrowthLinkedInFirebaseSecretSourceV1,
  GROWTH_LINKEDIN_ACCESS_TOKEN_SECRET_NAME_V1,
} from '../../../src/infrastructure/linkedin/credentials/GrowthLinkedInFirebaseSecretSourceV1';


describe(
  'GROWTH-CLOSURE-01 | LinkedIn Firebase Secret Source Behavior V1',
  () => {

    it(
      'declares the governed LinkedIn secret name',
      () => {

        expect(
          GROWTH_LINKEDIN_ACCESS_TOKEN_SECRET_NAME_V1,
        ).toBe(
          'AURA_GROWTH_LINKEDIN_ACCESS_TOKEN',
        );

      },
    );


    it(
      'reads the injected secret only for the authorized tenant',
      async () => {

        const value =
          vi.fn()
            .mockReturnValue(
              'synthetic-firebase-token',
            );


        const source =
          new GrowthLinkedInFirebaseSecretSourceV1({

            authorizedTenantId:
              'tenant-aura-001',

            secretReader: {
              value,
            },

          });


        const lease =
          await source.acquire({

            tenantId:
              'tenant-aura-001',

            credentialKind:
              'ACCESS_TOKEN',

          });


        expect(value)
          .toHaveBeenCalledTimes(1);


        expect(lease)
          .toEqual({

            credentialKind:
              'ACCESS_TOKEN',

            accessToken:
              'synthetic-firebase-token',

            tokenType:
              'Bearer',

          });

      },
    );


    it(
      'rejects another tenant before reading the secret',
      async () => {

        const value =
          vi.fn()
            .mockReturnValue(
              'synthetic-token',
            );


        const source =
          new GrowthLinkedInFirebaseSecretSourceV1({

            authorizedTenantId:
              'tenant-aura-001',

            secretReader: {
              value,
            },

          });


        await expect(
          source.acquire({

            tenantId:
              'tenant-other-999',

            credentialKind:
              'ACCESS_TOKEN',

          }),
        )
          .rejects
          .toThrow(
            'LINKEDIN_SERVER_TENANT_NOT_AUTHORIZED',
          );


        expect(value)
          .not
          .toHaveBeenCalled();

      },
    );


    it(
      'rejects an empty authorized tenant at composition time',
      () => {

        expect(
          () =>
            new GrowthLinkedInFirebaseSecretSourceV1({

              authorizedTenantId:
                '   ',

              secretReader: {
                value:
                  vi.fn(),
              },

            }),
        )
          .toThrow(
            'LINKEDIN_SERVER_AUTHORIZED_TENANT_REQUIRED',
          );

      },
    );


    it(
      'rejects an empty secret value',
      async () => {

        const source =
          new GrowthLinkedInFirebaseSecretSourceV1({

            authorizedTenantId:
              'tenant-aura-001',

            secretReader: {
              value:
                vi.fn()
                  .mockReturnValue(
                    '   ',
                  ),
            },

          });


        await expect(
          source.acquire({

            tenantId:
              'tenant-aura-001',

            credentialKind:
              'ACCESS_TOKEN',

          }),
        )
          .rejects
          .toThrow(
            'LINKEDIN_SERVER_ACCESS_TOKEN_REQUIRED',
          );

      },
    );

  },
);