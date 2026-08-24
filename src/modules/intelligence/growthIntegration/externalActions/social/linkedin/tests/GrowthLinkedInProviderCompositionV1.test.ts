import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type {
  GrowthExternalActionRequestV1,
} from '../../../GrowthExternalActionContractV1';

import {
  GrowthLinkedInProviderAdapterV1,
} from '../GrowthLinkedInProviderAdapterV1';

import {
  GrowthLinkedInTransportBoundaryV1,
} from '../transport/GrowthLinkedInTransportBoundaryV1';


describe(
  'GROWTH-CLOSURE-01 | LinkedIn Provider Composition V1',
  () => {

    it(
      'executes the governed LinkedIn provider chain entirely in memory',
      async () => {

        const getAccessToken =
          vi.fn()
            .mockResolvedValue({
              accessToken:
                'composition-test-token',

              tokenType:
                'Bearer',
            });


        const httpExecute =
          vi.fn()
            .mockResolvedValue({
              status:
                201,

              headers: {},

              body: {
                id:
                  'urn:li:share:composition-001',
              },
            });


        const transport =
          new GrowthLinkedInTransportBoundaryV1({
            tokenProvider: {
              getAccessToken,
            },

            httpPort: {
              execute:
                httpExecute,
            },
          });


        const contentResolver = {

          resolve:
            vi.fn()
              .mockResolvedValue({
                text:
                  'Aura Growth governed LinkedIn publication',

                mediaReferenceIds: [
                  'asset-001',
                ],

                linkUrl:
                  'https://example.test/aura-growth',
              }),

        };


        const publishPort = {

          publish:
            vi.fn(
              async (
                context,
                content,
              ) => {

                const transportResult =
                  await transport.execute({
                    endpoint:
                      'https://provider.invalid/linkedin/publications',

                    idempotencyKey:
                      context.actionId,

                    body: {
                      commentary:
                        content.text,

                      mediaReferenceIds:
                        content.mediaReferenceIds,

                      linkUrl:
                        content.linkUrl,
                    },
                  });


                if (
                  transportResult.status < 200 ||
                  transportResult.status >= 300
                ) {
                  throw new Error(
                    'LINKEDIN_PROVIDER_EXECUTION_FAILED',
                  );
                }


                const body =
                  transportResult.body as {
                    readonly id:
                      string;
                  };


                return {
                  provider:
                    'LINKEDIN',

                  target:
                    'LINKEDIN' as const,

                  providerExecutionId:
                    body.id,

                  publishedAt:
                    '2026-08-24T18:15:00.000Z',

                  permalink:
                    'https://linkedin.test/posts/composition-001',
                };

              },
            ),

        };


        const adapter =
          new GrowthLinkedInProviderAdapterV1({
            contentResolver,
            publishPort,
          });


        const request =
          {

            actionId:
              'growth-linkedin-composition-001',

            authority: {
              tenantId:
                'tenant-aura-001',

              actor: {
                actorId:
                  'growth-agent',

                actorType:
                  'SYSTEM',
              },
            },

            correlation: {
              requestId:
                'request-composition-001',

              correlationId:
                'correlation-composition-001',

              source:
                'AURA_GROWTH',

              sourceRecommendationId:
                'recommendation-composition-001',
            },

            actionType:
              'SOCIAL_PUBLICATION',

            target:
              'LINKEDIN',

            payload: {
              payloadType:
                'SOCIAL_PUBLICATION_CONTENT',

              referenceId:
                'growth-content-composition-001',

              version:
                '1',
            },

            authorization: {
              state:
                'AUTHORIZED',
            },

            schedule: {
              mode:
                'IMMEDIATE',
            },

            idempotencyKey:
              'growth-linkedin-composition-001',

            risk:
              'LOW',

            executionState:
              'AUTHORIZED',

            retryPolicy: {
              maxAttempts:
                1,
            },

          } as unknown as GrowthExternalActionRequestV1;


        const result =
          await adapter.execute(
            request,
          );


        expect(contentResolver.resolve)
          .toHaveBeenCalledTimes(1);

        expect(contentResolver.resolve)
          .toHaveBeenCalledWith(
            request.payload,
          );


        expect(publishPort.publish)
          .toHaveBeenCalledTimes(1);


        expect(getAccessToken)
          .toHaveBeenCalledTimes(1);


        expect(httpExecute)
          .toHaveBeenCalledTimes(1);


        expect(httpExecute)
          .toHaveBeenCalledWith({
            method:
              'POST',

            url:
              'https://provider.invalid/linkedin/publications',

            headers: {
              Authorization:
                'Bearer composition-test-token',

              'Content-Type':
                'application/json',

              'Idempotency-Key':
                'growth-linkedin-composition-001',
            },

            body: {
              commentary:
                'Aura Growth governed LinkedIn publication',

              mediaReferenceIds: [
                'asset-001',
              ],

              linkUrl:
                'https://example.test/aura-growth',
            },
          });


        expect(result.actionId)
          .toBe(
            'growth-linkedin-composition-001',
          );

        expect(result.requestId)
          .toBe(
            'request-composition-001',
          );

        expect(result.correlationId)
          .toBe(
            'correlation-composition-001',
          );

        expect(result.state)
          .toBe(
            'SUCCEEDED',
          );


        expect(result.receipt)
          .toEqual({
            receiptId:
              'linkedin:growth-linkedin-composition-001:urn:li:share:composition-001',

            actionId:
              'growth-linkedin-composition-001',

            state:
              'SUCCEEDED',

            providerExecutionId:
              'urn:li:share:composition-001',

            executedAt:
              '2026-08-24T18:15:00.000Z',

            evidence: [],
          });


        expect(
          JSON.stringify(
            result,
          ),
        )
          .not
          .toContain(
            'composition-test-token',
          );

      },
    );


    it(
      'does not report canonical success when provider execution fails',
      async () => {

        const transport =
          new GrowthLinkedInTransportBoundaryV1({
            tokenProvider: {
              getAccessToken:
                vi.fn()
                  .mockResolvedValue({
                    accessToken:
                      'failure-test-token',

                    tokenType:
                      'Bearer',
                  }),
            },

            httpPort: {
              execute:
                vi.fn()
                  .mockResolvedValue({
                    status:
                      429,

                    headers: {},

                    body: {
                      error:
                        'rate_limited',
                    },
                  }),
            },
          });


        const adapter =
          new GrowthLinkedInProviderAdapterV1({

            contentResolver: {
              resolve:
                vi.fn()
                  .mockResolvedValue({
                    text:
                      'Rate limited publication',

                    mediaReferenceIds: [],
                  }),
            },


            publishPort: {

              publish:
                async (
                  context,
                  content,
                ) => {

                  const response =
                    await transport.execute({
                      endpoint:
                        'https://provider.invalid/linkedin/publications',

                      idempotencyKey:
                        context.actionId,

                      body: {
                        commentary:
                          content.text,
                      },
                    });


                  if (
                    response.status < 200 ||
                    response.status >= 300
                  ) {
                    throw new Error(
                      'LINKEDIN_PROVIDER_EXECUTION_FAILED',
                    );
                  }


                  throw new Error(
                    'UNEXPECTED_PROVIDER_SUCCESS',
                  );

                },

            },

          });


        const request =
          {

            actionId:
              'growth-linkedin-failure-001',

            authority: {
              tenantId:
                'tenant-aura-001',
            },

            correlation: {
              requestId:
                'request-failure-001',

              correlationId:
                'correlation-failure-001',

              source:
                'AURA_GROWTH',
            },

            target:
              'LINKEDIN',

            payload: {
              payloadType:
                'SOCIAL_PUBLICATION_CONTENT',

              referenceId:
                'failure-content-001',
            },

          } as unknown as GrowthExternalActionRequestV1;


        await expect(
          adapter.execute(
            request,
          ),
        )
          .rejects
          .toThrow(
            'LINKEDIN_PROVIDER_EXECUTION_FAILED',
          );

      },
    );

  },
);