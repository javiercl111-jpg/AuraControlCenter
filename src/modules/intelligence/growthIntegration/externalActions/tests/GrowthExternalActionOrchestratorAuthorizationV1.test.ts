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
  GrowthExternalActionOrchestratorV1,
  type GrowthExternalActionExecutorV1,
} from '../GrowthExternalActionOrchestratorV1';


function createRequest(
  overrides: Partial<GrowthExternalActionRequestV1> = {},
): GrowthExternalActionRequestV1 {

  const base:
    GrowthExternalActionRequestV1 = {

      actionId:
        'action-001',

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
          'request-001',

        correlationId:
          'correlation-001',

        source:
          'AURA_GROWTH',

        sourceRecommendationId:
          'recommendation-001',
      },

      actionType:
        'SOCIAL_PUBLISH',

      target:
        'LINKEDIN',

      payload: {
        payloadType:
          'APPROVED_SOCIAL_CONTENT',

        referenceId:
          'content-001',

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
        'tenant-001:linkedin:content-001:v1',

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
  'GROWTH-CLOSURE-01 | External Action Authorization Enforcement V1',
  () => {

    it(
      'rejects an action waiting for required authorization without invoking executor',
      async () => {

        const execute =
          vi.fn(
            async (
              request:
                GrowthExternalActionRequestV1,
            ) =>
              createSucceededResult(request),
          );


        const executor:
          GrowthExternalActionExecutorV1 = {
            execute,
          };


        const orchestrator =
          new GrowthExternalActionOrchestratorV1({
            executor,
          });


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


        const result =
          await orchestrator.execute(request);


        expect(result.state)
          .toBe('REJECTED');

        expect(result.failure?.code)
          .toBe('AUTHORIZATION_REQUIRED');

        expect(result.failure?.retryable)
          .toBe(false);

        expect(execute)
          .not
          .toHaveBeenCalled();

      },
    );


    it(
      'rejects a cancelled action without invoking executor',
      async () => {

        const execute =
          vi.fn(
            async (
              request:
                GrowthExternalActionRequestV1,
            ) =>
              createSucceededResult(request),
          );


        const executor:
          GrowthExternalActionExecutorV1 = {
            execute,
          };


        const orchestrator =
          new GrowthExternalActionOrchestratorV1({
            executor,
          });


        const request =
          createRequest({
            executionState:
              'CANCELLED',
          });


        const result =
          await orchestrator.execute(request);


        expect(result.state)
          .toBe('REJECTED');

        expect(result.failure?.code)
          .toBe('INVALID_EXECUTION_STATE');

        expect(execute)
          .not
          .toHaveBeenCalled();

      },
    );


    it(
      'invokes executor exactly once for an authorized executable action',
      async () => {

        const execute =
          vi.fn(
            async (
              request:
                GrowthExternalActionRequestV1,
            ) =>
              createSucceededResult(request),
          );


        const executor:
          GrowthExternalActionExecutorV1 = {
            execute,
          };


        const orchestrator =
          new GrowthExternalActionOrchestratorV1({
            executor,
          });


        const request =
          createRequest();


        const result =
          await orchestrator.execute(request);


        expect(execute)
          .toHaveBeenCalledTimes(1);

        expect(execute)
          .toHaveBeenCalledWith(request);

        expect(result.state)
          .toBe('SUCCEEDED');

        expect(result.actionId)
          .toBe(request.actionId);

      },
    );


    it(
      'allows an action whose policy does not require authorization',
      async () => {

        const execute =
          vi.fn(
            async (
              request:
                GrowthExternalActionRequestV1,
            ) =>
              createSucceededResult(request),
          );


        const executor:
          GrowthExternalActionExecutorV1 = {
            execute,
          };


        const orchestrator =
          new GrowthExternalActionOrchestratorV1({
            executor,
          });


        const request =
          createRequest({
            authorization: {
              required:
                false,

              state:
                'NOT_REQUIRED',
            },

            executionState:
              'PROPOSED',
          });


        const result =
          await orchestrator.execute(request);


        expect(execute)
          .toHaveBeenCalledTimes(1);

        expect(result.state)
          .toBe('SUCCEEDED');

      },
    );

  },
);