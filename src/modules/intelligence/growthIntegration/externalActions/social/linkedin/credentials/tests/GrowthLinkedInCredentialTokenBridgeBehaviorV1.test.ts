import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  GrowthLinkedInCredentialTokenBridgeV1,
} from '../GrowthLinkedInCredentialTokenBridgeV1';


describe(
  'GROWTH-CLOSURE-01 | LinkedIn Credential Token Bridge Behavior V1',
  () => {

    it(
      'requests only an ACCESS_TOKEN for the configured tenant',
      async () => {

        const acquire =
          vi.fn()
            .mockResolvedValue({
              credentialKind:
                'ACCESS_TOKEN',

              accessToken:
                'synthetic-bridge-token',

              tokenType:
                'Bearer',

              expiresAt:
                '2099-01-01T00:00:00.000Z',
            });


        const bridge =
          new GrowthLinkedInCredentialTokenBridgeV1({

            tenantId:
              'tenant-aura-001',

            credentialProvider: {
              acquire,
            },

          });


        const result =
          await bridge.getAccessToken();


        expect(acquire)
          .toHaveBeenCalledTimes(1);


        expect(acquire)
          .toHaveBeenCalledWith({
            tenantId:
              'tenant-aura-001',

            credentialKind:
              'ACCESS_TOKEN',
          });


        expect(result)
          .toEqual({
            accessToken:
              'synthetic-bridge-token',

            tokenType:
              'Bearer',

            expiresAt:
              '2099-01-01T00:00:00.000Z',
          });

      },
    );


    it(
      'rejects an empty tenant id before credential acquisition',
      () => {

        const acquire =
          vi.fn();


        expect(
          () =>
            new GrowthLinkedInCredentialTokenBridgeV1({

              tenantId:
                '   ',

              credentialProvider: {
                acquire,
              },

            }),
        )
          .toThrow(
            'LINKEDIN_TENANT_ID_REQUIRED',
          );


        expect(acquire)
          .not
          .toHaveBeenCalled();

      },
    );


    it(
      'rejects an empty credential lease before returning a token',
      async () => {

        const acquire =
          vi.fn()
            .mockResolvedValue({
              credentialKind:
                'ACCESS_TOKEN',

              accessToken:
                '   ',

              tokenType:
                'Bearer',
            });


        const bridge =
          new GrowthLinkedInCredentialTokenBridgeV1({

            tenantId:
              'tenant-aura-001',

            credentialProvider: {
              acquire,
            },

          });


        await expect(
          bridge.getAccessToken(),
        )
          .rejects
          .toThrow(
            'LINKEDIN_ACCESS_TOKEN_REQUIRED',
          );

      },
    );


    it(
      'rejects a non-Bearer credential lease',
      async () => {

        const acquire =
          vi.fn()
            .mockResolvedValue({
              credentialKind:
                'ACCESS_TOKEN',

              accessToken:
                'synthetic-token',

              tokenType:
                'Basic',
            });


        const bridge =
          new GrowthLinkedInCredentialTokenBridgeV1({

            tenantId:
              'tenant-aura-001',

            credentialProvider: {
              acquire,
            },

          });


        await expect(
          bridge.getAccessToken(),
        )
          .rejects
          .toThrow(
            'LINKEDIN_TOKEN_TYPE_INVALID',
          );

      },
    );


    it(
      'does not return tenant authority or provider internals in the token result',
      async () => {

        const acquire =
          vi.fn()
            .mockResolvedValue({
              credentialKind:
                'ACCESS_TOKEN',

              accessToken:
                'synthetic-token',

              tokenType:
                'Bearer',
            });


        const bridge =
          new GrowthLinkedInCredentialTokenBridgeV1({

            tenantId:
              'tenant-sensitive-001',

            credentialProvider: {
              acquire,
            },

          });


        const result =
          await bridge.getAccessToken();


        const serialized =
          JSON.stringify(
            result,
          );


        expect(serialized)
          .not
          .toContain(
            'tenant-sensitive-001',
          );

        expect(serialized)
          .not
          .toContain(
            'credentialKind',
          );

      },
    );

  },
);