import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  GrowthLinkedInTransportBoundaryV1,
} from '../GrowthLinkedInTransportBoundaryV1';


describe(
  'GROWTH-CLOSURE-01 | LinkedIn Transport Boundary Behavior V1',
  () => {

    it(
      'obtains an access token and executes an injected HTTP request',
      async () => {

        const getAccessToken =
          vi.fn()
            .mockResolvedValue({
              accessToken:
                'test-linkedin-token',

              tokenType:
                'Bearer',
            });


        const execute =
          vi.fn()
            .mockResolvedValue({
              status:
                201,

              headers: {
                'x-test':
                  'ok',
              },

              body: {
                id:
                  'linkedin-publication-001',
              },
            });


        const transport =
          new GrowthLinkedInTransportBoundaryV1({
            tokenProvider: {
              getAccessToken,
            },

            httpPort: {
              execute,
            },
          });


        const result =
          await transport.execute({
            endpoint:
              'https://provider.invalid/linkedin/publications',

            body: {
              commentary:
                'Aura Growth publication',
            },

            idempotencyKey:
              'growth-linkedin-action-001',
          });


        expect(getAccessToken)
          .toHaveBeenCalledTimes(1);


        expect(execute)
          .toHaveBeenCalledTimes(1);


        expect(execute)
          .toHaveBeenCalledWith({
            method:
              'POST',

            url:
              'https://provider.invalid/linkedin/publications',

            headers: {
              Authorization:
                'Bearer test-linkedin-token',

              'Content-Type':
                'application/json',

              'Idempotency-Key':
                'growth-linkedin-action-001',
            },

            body: {
              commentary:
                'Aura Growth publication',
            },
          });


        expect(result)
          .toEqual({
            status:
              201,

            body: {
              id:
                'linkedin-publication-001',
            },
          });

      },
    );


    it(
      'does not send an idempotency header when no key is provided',
      async () => {

        const getAccessToken =
          vi.fn()
            .mockResolvedValue({
              accessToken:
                'second-test-token',

              tokenType:
                'Bearer',
            });


        const execute =
          vi.fn()
            .mockResolvedValue({
              status:
                200,

              headers: {},

              body: {
                ok:
                  true,
              },
            });


        const transport =
          new GrowthLinkedInTransportBoundaryV1({
            tokenProvider: {
              getAccessToken,
            },

            httpPort: {
              execute,
            },
          });


        await transport.execute({
          endpoint:
            'https://provider.invalid/linkedin/publications',

          body: {
            commentary:
              'Publication without idempotency header',
          },
        });


        const [
          request,
        ] =
          execute.mock.calls[0];


        expect(request.headers)
          .toEqual({
            Authorization:
              'Bearer second-test-token',

            'Content-Type':
              'application/json',
          });


        expect(
          request.headers[
            'Idempotency-Key'
          ],
        )
          .toBeUndefined();

      },
    );


    it(
      'does not expose the access token in the transport result',
      async () => {

        const token =
          'confidential-test-token';


        const getAccessToken =
          vi.fn()
            .mockResolvedValue({
              accessToken:
                token,

              tokenType:
                'Bearer',
            });


        const execute =
          vi.fn()
            .mockResolvedValue({
              status:
                201,

              headers: {},

              body: {
                providerExecutionId:
                  'provider-001',
              },
            });


        const transport =
          new GrowthLinkedInTransportBoundaryV1({
            tokenProvider: {
              getAccessToken,
            },

            httpPort: {
              execute,
            },
          });


        const result =
          await transport.execute({
            endpoint:
              'https://provider.invalid/linkedin/publications',

            body: {
              commentary:
                'Governed publication',
            },
          });


        expect(
          JSON.stringify(
            result,
          ),
        )
          .not
          .toContain(
            token,
          );

      },
    );


    it(
      'propagates provider status and body without inventing success semantics',
      async () => {

        const getAccessToken =
          vi.fn()
            .mockResolvedValue({
              accessToken:
                'test-token',

              tokenType:
                'Bearer',
            });


        const execute =
          vi.fn()
            .mockResolvedValue({
              status:
                429,

              headers: {
                'retry-after':
                  '60',
              },

              body: {
                error:
                  'rate_limited',
              },
            });


        const transport =
          new GrowthLinkedInTransportBoundaryV1({
            tokenProvider: {
              getAccessToken,
            },

            httpPort: {
              execute,
            },
          });


        const result =
          await transport.execute({
            endpoint:
              'https://provider.invalid/linkedin/publications',

            body: {
              commentary:
                'Rate limited publication',
            },
          });


        expect(result)
          .toEqual({
            status:
              429,

            body: {
              error:
                'rate_limited',
            },
          });

      },
    );


    it(
      'contains no built-in network implementation',
      () => {

        const source =
          GrowthLinkedInTransportBoundaryV1
            .toString();


        expect(source)
          .not
          .toContain(
            'fetch(',
          );

        expect(source)
          .not
          .toContain(
            'axios',
          );

      },
    );

  },
);