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


function createRequest():
  GrowthExternalActionRequestV1 {

  return {
    actionId:
      'action-concurrent-001',

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
        'request-concurrent-001',

      correlationId:
        'correlation-concurrent-001',

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
        'content-concurrent-001',

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
      'tenant-001:linkedin:content-concurrent-001:v1',

    risk:
      'MEDIUM',

    executionState:
      'AUTHORIZED',

    retryPolicy: {
      enabled:
        true,

      maxAttempts:
        3,

      backoffStrategy:
        'EXPONENTIAL',

      initialDelayMs:
        1000,

      maxDelayMs:
        30000,
    },
  };

}


describe(
  'GROWTH-CLOSURE-01 | Concurrent Idempotency Claim Protection V1',
  () => {

    it(
      'prevents duplicate execution while original claim is still in progress',
      async () => {

        const request =
          createRequest();


        const execute =
          vi.fn<
            (
              request:
                GrowthExternalActionRequestV1,
            ) => Promise<GrowthExternalActionResultV1>
          >();


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


        const result =
          await orchestrator.execute(request);


        expect(claim)
          .toHaveBeenCalledTimes(1);

        expect(claim)
          .toHaveBeenCalledWith(
            request.idempotencyKey,
            request.actionId,
          );


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


        expect(result.state)
          .toBe('REJECTED');


        expect(result.failure?.code)
          .toBe('IDEMPOTENCY_IN_PROGRESS');


        expect(result.failure?.retryable)
          .toBe(true);


        expect(result.warnings)
          .toContain(
            'An execution with the same idempotency key is already in progress.',
          );

      },
    );

  },
);