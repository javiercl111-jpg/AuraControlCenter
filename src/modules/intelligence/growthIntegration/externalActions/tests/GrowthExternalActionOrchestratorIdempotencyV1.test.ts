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

import type {
  GrowthExternalActionIdempotencyPortV1,
} from '../GrowthExternalActionIdempotencyPortV1';

import {
  GrowthExternalActionOrchestratorV1,
  type GrowthExternalActionExecutorV1,
} from '../GrowthExternalActionOrchestratorV1';


function createRequest(
  overrides: Partial<GrowthExternalActionRequestV1> = {},
): GrowthExternalActionRequestV1 {

  const base:
    GrowthExternalActionRequestV1 = {

      actionId:
        'action-idempotency-001',

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
          'request-idempotency-001',

        correlationId:
          'correlation-idempotency-001',

        source:
          'AURA_GROWTH',
      },

      actionType:
        'SOCIAL_PUBLISH',

      target:
        'LINKEDIN',

      payload: {
        payloadType:
          'APPROVED_SOCIAL_CONTENT',

        referenceId:
          'content-idempotency-001',

        version:
          '1',
      },

      authorization: {
        required:
          true,

        state:
          'AUTHORIZED',

        authorizedBy:
          'user-001',

        authorizedAt:
          '2026-08-24T10:00:00Z',
      },

      schedule: {},

      idempotencyKey:
        'tenant-001:linkedin:content-idempotency-001:v1',

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


  return {
    ...base,
    ...overrides,
  };

}


function createSucceededResult(
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
  'GROWTH-CLOSURE-01 | External Action Orchestrator Idempotency V1',
  () => {

    it(
      'claims key executes once and completes idempotency record',
      async () => {

        const request =
          createRequest();


        const result =
          createSucceededResult(request);


        const execute =
          vi.fn(
            async () =>
              result,
          );


        const executor:
          GrowthExternalActionExecutorV1 = {
            execute,
          };


        const claim =
          vi.fn(
            async () => ({
              key:
                request.idempotencyKey,

              state:
                'CLAIMED' as const,

              ownerActionId:
                request.actionId,
            }),
          );


        const get =
          vi.fn(
            async () =>
              null,
          );


        const complete =
          vi.fn(
            async () =>
              undefined,
          );


        const idempotency:
          GrowthExternalActionIdempotencyPortV1 = {
            claim,
            get,
            complete,
          };


        const orchestrator =
          new GrowthExternalActionOrchestratorV1({
            executor,
            idempotency,
          });


        const actual =
          await orchestrator.execute(request);


        expect(claim)
          .toHaveBeenCalledTimes(1);

        expect(claim)
          .toHaveBeenCalledWith(
            request.idempotencyKey,
            request.actionId,
          );

        expect(execute)
          .toHaveBeenCalledTimes(1);

        expect(complete)
          .toHaveBeenCalledTimes(1);

        expect(complete)
          .toHaveBeenCalledWith(
            request.idempotencyKey,
            request.actionId,
            result,
          );

        expect(actual)
          .toEqual(result);

      },
    );


    it(
      'reuses completed result and does not execute duplicate action',
      async () => {

        const request =
          createRequest();


        const previousResult =
          createSucceededResult(request);


        const execute =
          vi.fn(
            async () =>
              previousResult,
          );


        const executor:
          GrowthExternalActionExecutorV1 = {
            execute,
          };


        const claim =
          vi.fn(
            async () => ({
              key:
                request.idempotencyKey,

              state:
                'ALREADY_CLAIMED' as const,

              ownerActionId:
                request.actionId,
            }),
          );


        const get =
          vi.fn(
            async () => ({
              key:
                request.idempotencyKey,

              actionId:
                request.actionId,

              createdAt:
                '2026-08-24T10:00:00Z',

              completedAt:
                '2026-08-24T10:00:01Z',

              result:
                previousResult,
            }),
          );


        const complete =
          vi.fn(
            async () =>
              undefined,
          );


        const idempotency:
          GrowthExternalActionIdempotencyPortV1 = {
            claim,
            get,
            complete,
          };


        const orchestrator =
          new GrowthExternalActionOrchestratorV1({
            executor,
            idempotency,
          });


        const actual =
          await orchestrator.execute(request);


        expect(claim)
          .toHaveBeenCalledTimes(1);

        expect(get)
          .toHaveBeenCalledTimes(1);

        expect(get)
          .toHaveBeenCalledWith(
            request.idempotencyKey,
          );

        expect(execute)
          .not
          .toHaveBeenCalled();

        expect(complete)
          .not
          .toHaveBeenCalled();

        expect(actual)
          .toEqual(previousResult);

      },
    );


    it(
      'does not claim idempotency key when authorization is rejected first',
      async () => {

        const request =
          createRequest({
            authorization: {
              required:
                true,

              state:
                'PENDING',
            },

            executionState:
              'WAITING_AUTHORIZATION',
          });


        const execute =
          vi.fn();


        const executor:
          GrowthExternalActionExecutorV1 = {
            execute,
          };


        const claim =
          vi.fn();


        const get =
          vi.fn();


        const complete =
          vi.fn();


        const idempotency:
          GrowthExternalActionIdempotencyPortV1 = {
            claim,
            get,
            complete,
          };


        const orchestrator =
          new GrowthExternalActionOrchestratorV1({
            executor,
            idempotency,
          });


        const actual =
          await orchestrator.execute(request);


        expect(actual.state)
          .toBe('REJECTED');

        expect(actual.failure?.code)
          .toBe('AUTHORIZATION_REQUIRED');

        expect(claim)
          .not
          .toHaveBeenCalled();

        expect(get)
          .not
          .toHaveBeenCalled();

        expect(complete)
          .not
          .toHaveBeenCalled();

        expect(execute)
          .not
          .toHaveBeenCalled();

      },
    );

  },
);