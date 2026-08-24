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


const createRequest =
  (
    overrides:
      Partial<GrowthExternalActionRequestV1> = {},
  ): GrowthExternalActionRequestV1 => {

    return {
      actionId:
        'action-linkedin-001',

      authority: {
        tenantId:
          'tenant-aura-001',

        actor: {
          actorId:
            'actor-growth-001',

          actorType:
            'USER',
        },
      },

      correlation: {
        requestId:
          'request-001',

        correlationId:
          'correlation-001',

        source:
          'AURA_GROWTH',

        sourceRecommendationId:
          'recommendation-001',
      },

      actionType:
        'SOCIAL_PUBLICATION',

      target:
        'LINKEDIN',

      payload: {
        payloadType:
          'SOCIAL_PUBLICATION_CONTENT',

        referenceId:
          'asset-content-001',

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
        'linkedin-action-001',

      risk:
        'LOW',

      executionState:
        'AUTHORIZED',

      retryPolicy: {
        maxAttempts:
          1,
      },

      ...overrides,
    } as unknown as GrowthExternalActionRequestV1;

  };


describe(
  'GROWTH-CLOSURE-01 | LinkedIn Provider Adapter Behavior V1',
  () => {

    it(
      'resolves the opaque payload reference and publishes LinkedIn content',
      async () => {

        const resolve =
          vi.fn()
            .mockResolvedValue({
              text:
                'Aura Growth LinkedIn publication',

              mediaReferenceIds: [
                'media-001',
                'media-002',
              ],

              linkUrl:
                'https://example.test/growth',
            });


        const publish =
          vi.fn()
            .mockResolvedValue({
              provider:
                'LINKEDIN',

              target:
                'LINKEDIN',

              providerExecutionId:
                'linkedin-execution-001',

              publishedAt:
                '2026-08-24T18:00:00.000Z',

              permalink:
                'https://linkedin.test/posts/001',
            });


        const adapter =
          new GrowthLinkedInProviderAdapterV1({
            contentResolver: {
              resolve,
            },

            publishPort: {
              publish,
            },
          });


        const request =
          createRequest();


        const result =
          await adapter.execute(
            request,
          );


        expect(resolve)
          .toHaveBeenCalledTimes(1);

        expect(resolve)
          .toHaveBeenCalledWith(
            request.payload,
          );


        expect(publish)
          .toHaveBeenCalledTimes(1);


        expect(publish)
          .toHaveBeenCalledWith(
            {
              tenantId:
                'tenant-aura-001',

              actionId:
                'action-linkedin-001',

              correlationId:
                'correlation-001',

              target:
                'LINKEDIN',
            },

            {
              text:
                'Aura Growth LinkedIn publication',

              mediaReferenceIds: [
                'media-001',
                'media-002',
              ],

              linkUrl:
                'https://example.test/growth',
            },
          );


        expect(result.actionId)
          .toBe(
            'action-linkedin-001',
          );

        expect(result.requestId)
          .toBe(
            'request-001',
          );

        expect(result.correlationId)
          .toBe(
            'correlation-001',
          );

        expect(result.state)
          .toBe(
            'SUCCEEDED',
          );

        expect(result.warnings)
          .toEqual([]);


        expect(result.receipt)
          .toEqual({
            receiptId:
              'linkedin:action-linkedin-001:linkedin-execution-001',

            actionId:
              'action-linkedin-001',

            state:
              'SUCCEEDED',

            providerExecutionId:
              'linkedin-execution-001',

            executedAt:
              '2026-08-24T18:00:00.000Z',

            evidence: [],
          });

      },
    );


    it(
      'preserves tenant and correlation authority',
      async () => {

        const resolve =
          vi.fn()
            .mockResolvedValue({
              text:
                'Executive Growth message',

              mediaReferenceIds: [],
            });


        const publish =
          vi.fn()
            .mockResolvedValue({
              provider:
                'LINKEDIN',

              target:
                'LINKEDIN',

              providerExecutionId:
                'linkedin-execution-002',

              publishedAt:
                '2026-08-24T18:01:00.000Z',
            });


        const adapter =
          new GrowthLinkedInProviderAdapterV1({
            contentResolver: {
              resolve,
            },

            publishPort: {
              publish,
            },
          });


        await adapter.execute(
          createRequest(),
        );


        const [
          context,
        ] =
          publish.mock.calls[0];


        expect(context.tenantId)
          .toBe(
            'tenant-aura-001',
          );

        expect(context.actionId)
          .toBe(
            'action-linkedin-001',
          );

        expect(context.correlationId)
          .toBe(
            'correlation-001',
          );

      },
    );


    it(
      'rejects a target that is not LinkedIn before resolving content',
      async () => {

        const resolve =
          vi.fn();


        const publish =
          vi.fn();


        const adapter =
          new GrowthLinkedInProviderAdapterV1({
            contentResolver: {
              resolve,
            },

            publishPort: {
              publish,
            },
          });


        const request =
          createRequest({
            target:
              'FACEBOOK',
          });


        await expect(
          adapter.execute(
            request,
          ),
        )
          .rejects
          .toThrow(
            'LINKEDIN_TARGET_REQUIRED',
          );


        expect(resolve)
          .not
          .toHaveBeenCalled();

        expect(publish)
          .not
          .toHaveBeenCalled();

      },
    );


    it(
      'rejects empty publication text before provider execution',
      async () => {

        const resolve =
          vi.fn()
            .mockResolvedValue({
              text:
                '   ',

              mediaReferenceIds: [],
            });


        const publish =
          vi.fn();


        const adapter =
          new GrowthLinkedInProviderAdapterV1({
            contentResolver: {
              resolve,
            },

            publishPort: {
              publish,
            },
          });


        await expect(
          adapter.execute(
            createRequest(),
          ),
        )
          .rejects
          .toThrow(
            'LINKEDIN_TEXT_REQUIRED',
          );


        expect(resolve)
          .toHaveBeenCalledTimes(1);

        expect(publish)
          .not
          .toHaveBeenCalled();

      },
    );


    it(
      'does not expose provider credentials through the canonical payload',
      async () => {

        const resolve =
          vi.fn()
            .mockResolvedValue({
              text:
                'Governed content',

              mediaReferenceIds: [],
            });


        const publish =
          vi.fn()
            .mockResolvedValue({
              provider:
                'LINKEDIN',

              target:
                'LINKEDIN',

              providerExecutionId:
                'linkedin-execution-003',

              publishedAt:
                '2026-08-24T18:02:00.000Z',
            });


        const adapter =
          new GrowthLinkedInProviderAdapterV1({
            contentResolver: {
              resolve,
            },

            publishPort: {
              publish,
            },
          });


        const request =
          createRequest();


        await adapter.execute(
          request,
        );


        expect(resolve)
          .toHaveBeenCalledWith({
            payloadType:
              'SOCIAL_PUBLICATION_CONTENT',

            referenceId:
              'asset-content-001',

            version:
              '1',
          });


        const serialized =
          JSON.stringify(
            request.payload,
          );


        expect(serialized)
          .not
          .toContain(
            'accessToken',
          );

        expect(serialized)
          .not
          .toContain(
            'clientSecret',
          );

        expect(serialized)
          .not
          .toContain(
            'password',
          );

      },
    );

  },
);