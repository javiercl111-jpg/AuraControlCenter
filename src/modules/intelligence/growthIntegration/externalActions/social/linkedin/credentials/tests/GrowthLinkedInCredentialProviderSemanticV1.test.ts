import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  assertGrowthLinkedInCredentialLeaseV1,
} from '../GrowthLinkedInCredentialProviderV1';

import type {
  GrowthLinkedInCredentialLeaseV1,
  GrowthLinkedInCredentialProviderV1,
  GrowthLinkedInCredentialRequestV1,
} from '../GrowthLinkedInCredentialProviderV1';


describe(
  'GROWTH-CLOSURE-01 | LinkedIn Credential Provider Semantic V1',
  () => {

    it(
      'accepts a valid synthetic Bearer access-token lease',
      () => {

        const lease:
          GrowthLinkedInCredentialLeaseV1 = {

            credentialKind:
              'ACCESS_TOKEN',

            accessToken:
              'synthetic-access-token',

            tokenType:
              'Bearer',

            expiresAt:
              '2099-01-01T00:00:00.000Z',

          };


        expect(
          () =>
            assertGrowthLinkedInCredentialLeaseV1(
              lease,
            ),
        ).not.toThrow();

      },
    );


    it(
      'rejects an empty access token',
      () => {

        const lease = {

          credentialKind:
            'ACCESS_TOKEN',

          accessToken:
            '   ',

          tokenType:
            'Bearer',

        } as GrowthLinkedInCredentialLeaseV1;


        expect(
          () =>
            assertGrowthLinkedInCredentialLeaseV1(
              lease,
            ),
        ).toThrow(
          'LINKEDIN_ACCESS_TOKEN_REQUIRED',
        );

      },
    );


    it(
      'rejects an invalid credential kind',
      () => {

        const lease = {

          credentialKind:
            'CLIENT_SECRET',

          accessToken:
            'synthetic-token',

          tokenType:
            'Bearer',

        } as unknown as GrowthLinkedInCredentialLeaseV1;


        expect(
          () =>
            assertGrowthLinkedInCredentialLeaseV1(
              lease,
            ),
        ).toThrow(
          'LINKEDIN_CREDENTIAL_KIND_INVALID',
        );

      },
    );


    it(
      'rejects a token type other than Bearer',
      () => {

        const lease = {

          credentialKind:
            'ACCESS_TOKEN',

          accessToken:
            'synthetic-token',

          tokenType:
            'Basic',

        } as unknown as GrowthLinkedInCredentialLeaseV1;


        expect(
          () =>
            assertGrowthLinkedInCredentialLeaseV1(
              lease,
            ),
        ).toThrow(
          'LINKEDIN_TOKEN_TYPE_INVALID',
        );

      },
    );


    it(
      'preserves tenant authority when requesting a credential',
      async () => {

        const acquire =
          vi.fn(
            async (
              request:
                GrowthLinkedInCredentialRequestV1,
            ): Promise<GrowthLinkedInCredentialLeaseV1> => {

              expect(request)
                .toEqual({
                  tenantId:
                    'tenant-aura-001',

                  credentialKind:
                    'ACCESS_TOKEN',
                });


              return {
                credentialKind:
                  'ACCESS_TOKEN',

                accessToken:
                  'synthetic-tenant-token',

                tokenType:
                  'Bearer',
              };

            },
          );


        const provider:
          GrowthLinkedInCredentialProviderV1 = {
            acquire,
          };


        const request:
          GrowthLinkedInCredentialRequestV1 = {

            tenantId:
              'tenant-aura-001',

            credentialKind:
              'ACCESS_TOKEN',

          };


        const lease =
          await provider.acquire(
            request,
          );


        expect(acquire)
          .toHaveBeenCalledTimes(1);

        expect(lease.credentialKind)
          .toBe(
            'ACCESS_TOKEN',
          );

        expect(lease.tokenType)
          .toBe(
            'Bearer',
          );

      },
    );

  },
);