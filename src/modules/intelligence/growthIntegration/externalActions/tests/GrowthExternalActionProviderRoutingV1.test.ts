import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type {
  GrowthExternalActionRequestV1,
  GrowthExternalActionResultV1,
} from '../GrowthExternalActionContractV1';

import {
  GrowthExternalActionProviderExecutionBoundaryV1,
  type GrowthExternalActionProviderAdapterV1,
} from '../GrowthExternalActionProviderExecutionBoundaryV1';


function createRequest(
  target:
    GrowthExternalActionRequestV1['target'],
): GrowthExternalActionRequestV1 {

  return {
    actionId:
      `action-${target.toLowerCase()}`,

    authority: {
      tenantId:
        'tenant-001',

      actor: {
        actorId:
          'user-001',

        actorType:
          'USER',
      },
    },

    correlation: {
      requestId:
        `request-${target.toLowerCase()}`,

      correlationId:
        `correlation-${target.toLowerCase()}`,

      source:
        'AURA_GROWTH',
    },

    actionType:
      'SOCIAL_PUBLISH',

    target,

    payload: {
      payloadType:
        'APPROVED_SOCIAL_CONTENT',

      referenceId:
        `content-${target.toLowerCase()}`,
    },

    authorization: {
      required:
        true,

      state:
        'AUTHORIZED',
    },

    schedule: {},

    idempotencyKey:
      `tenant-001:${target.toLowerCase()}:content-001`,

    risk:
      'MEDIUM',

    executionState:
      'AUTHORIZED',

    retryPolicy: {
      enabled:
        false,

      maxAttempts:
        1,

      backoffStrategy:
        'NONE',
    },
  };

}


function createSuccess(
  request:
    GrowthExternalActionRequestV1,
): GrowthExternalActionResultV1 {

  return {
    actionId:
      request.actionId,

    requestId:
      request.correlation.requestId,

    correlationId:
      request.correlation.correlationId,

    state:
      'SUCCEEDED',

    warnings: [],

    receipt: {
      receiptId:
        `receipt-${request.actionId}`,

      actionId:
        request.actionId,

      state:
        'SUCCEEDED',

      evidence: [],
    },
  };

}


describe(
  'GROWTH-CLOSURE-01 | Provider Routing Behavior V1',
  () => {

    it(
      'routes LINKEDIN request only to LINKEDIN adapter',
      async () => {

        const request =
          createRequest('LINKEDIN');


        const linkedInExecute =
          vi.fn(
            async (
              received:
                GrowthExternalActionRequestV1,
            ) =>
              createSuccess(received),
          );


        const instagramExecute =
          vi.fn(
            async (
              received:
                GrowthExternalActionRequestV1,
            ) =>
              createSuccess(received),
          );


        const linkedInAdapter:
          GrowthExternalActionProviderAdapterV1 = {
            target:
              'LINKEDIN',

            execute:
              linkedInExecute,
          };


        const instagramAdapter:
          GrowthExternalActionProviderAdapterV1 = {
            target:
              'INSTAGRAM',

            execute:
              instagramExecute,
          };


        const boundary =
          new GrowthExternalActionProviderExecutionBoundaryV1({
            adapters: [
              linkedInAdapter,
              instagramAdapter,
            ],
          });


        const result =
          await boundary.execute(request);


        expect(linkedInExecute)
          .toHaveBeenCalledTimes(1);

        expect(linkedInExecute)
          .toHaveBeenCalledWith(request);

        expect(instagramExecute)
          .not
          .toHaveBeenCalled();

        expect(result.state)
          .toBe('SUCCEEDED');

      },
    );


    it(
      'rejects request when no adapter exists for target',
      async () => {

        const request =
          createRequest('YOUTUBE');


        const linkedInExecute =
          vi.fn();


        const linkedInAdapter:
          GrowthExternalActionProviderAdapterV1 = {
            target:
              'LINKEDIN',

            execute:
              linkedInExecute,
          };


        const boundary =
          new GrowthExternalActionProviderExecutionBoundaryV1({
            adapters: [
              linkedInAdapter,
            ],
          });


        const result =
          await boundary.execute(request);


        expect(linkedInExecute)
          .not
          .toHaveBeenCalled();

        expect(result.state)
          .toBe('REJECTED');

        expect(result.failure?.code)
          .toBe('PROVIDER_ADAPTER_UNAVAILABLE');

        expect(result.failure?.retryable)
          .toBe(false);

      },
    );


    it(
      'preserves authority correlation payload and target when routing',
      async () => {

        const request =
          createRequest('LINKEDIN');


        const execute =
          vi.fn(
            async (
              received:
                GrowthExternalActionRequestV1,
            ) => {

              expect(received.authority)
                .toEqual(request.authority);

              expect(received.correlation)
                .toEqual(request.correlation);

              expect(received.payload)
                .toEqual(request.payload);

              expect(received.target)
                .toBe('LINKEDIN');

              return createSuccess(received);

            },
          );


        const adapter:
          GrowthExternalActionProviderAdapterV1 = {
            target:
              'LINKEDIN',

            execute,
          };


        const boundary =
          new GrowthExternalActionProviderExecutionBoundaryV1({
            adapters: [
              adapter,
            ],
          });


        const result =
          await boundary.execute(request);


        expect(execute)
          .toHaveBeenCalledTimes(1);

        expect(result.actionId)
          .toBe(request.actionId);

        expect(result.correlationId)
          .toBe(request.correlation.correlationId);

      },
    );

  },
);