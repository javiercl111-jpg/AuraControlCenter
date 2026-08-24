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
} from '../GrowthExternalActionOrchestratorV1';

import {
  GrowthExternalActionProviderExecutionBoundaryV1,
  type GrowthExternalActionProviderAdapterV1,
} from '../GrowthExternalActionProviderExecutionBoundaryV1';


function createRequest(
  authorizationState:
    GrowthExternalActionRequestV1['authorization']['state'] =
      'AUTHORIZED',
): GrowthExternalActionRequestV1 {

  return {
    actionId:
      'action-composition-001',

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
        'request-composition-001',

      correlationId:
        'correlation-composition-001',

      source:
        'AURA_GROWTH',

      sourceRecommendationId:
        'recommendation-composition-001',
    },

    actionType:
      'SOCIAL_PUBLISH',

    target:
      'LINKEDIN',

    payload: {
      payloadType:
        'APPROVED_SOCIAL_CONTENT',

      referenceId:
        'content-composition-001',

      version:
        '1',
    },

    authorization: {
      required:
        true,

      state:
        authorizationState,

      authorizedBy:
        authorizationState === 'AUTHORIZED'
          ? 'user-001'
          : undefined,

      authorizedAt:
        authorizationState === 'AUTHORIZED'
          ? '2026-08-24T10:00:00Z'
          : undefined,
    },

    schedule: {},

    idempotencyKey:
      'tenant-001:linkedin:content-composition-001:v1',

    risk:
      'MEDIUM',

    executionState:
      authorizationState === 'AUTHORIZED'
        ? 'AUTHORIZED'
        : 'WAITING_AUTHORIZATION',

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

      providerExecutionId:
        'linkedin-test-provider-execution-001',

      executedAt:
        '2026-08-24T10:00:01Z',

      evidence: [
        {
          evidenceId:
            'evidence-composition-001',

          evidenceType:
            'IN_MEMORY_PROVIDER_RECEIPT',

          recordedAt:
            '2026-08-24T10:00:01Z',

          reference:
            'linkedin-test-provider-execution-001',
        },
      ],
    },
  };

}


describe(
  'GROWTH-CLOSURE-01 | Orchestrator Provider Composition V1',
  () => {

    it(
      'executes authorized action through idempotency boundary and correct provider adapter',
      async () => {

        const request =
          createRequest();


        const adapterExecute =
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
              adapterExecute,
          };


        const providerBoundary =
          new GrowthExternalActionProviderExecutionBoundaryV1({
            adapters: [
              linkedInAdapter,
            ],
          });


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
            executor:
              providerBoundary,

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


        expect(adapterExecute)
          .toHaveBeenCalledTimes(1);

        expect(adapterExecute)
          .toHaveBeenCalledWith(request);


        expect(complete)
          .toHaveBeenCalledTimes(1);

        expect(complete)
          .toHaveBeenCalledWith(
            request.idempotencyKey,
            request.actionId,
            result,
          );


        expect(result.state)
          .toBe('SUCCEEDED');

        expect(result.receipt?.providerExecutionId)
          .toBe(
            'linkedin-test-provider-execution-001',
          );

      },
    );


    it(
      'blocks unauthorized action before idempotency and provider routing',
      async () => {

        const request =
          createRequest('PENDING');


        const adapterExecute =
          vi.fn();


        const linkedInAdapter:
          GrowthExternalActionProviderAdapterV1 = {
            target:
              'LINKEDIN',

            execute:
              adapterExecute,
          };


        const providerBoundary =
          new GrowthExternalActionProviderExecutionBoundaryV1({
            adapters: [
              linkedInAdapter,
            ],
          });


        const boundaryExecute =
          vi.spyOn(
            providerBoundary,
            'execute',
          );


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
            executor:
              providerBoundary,

            idempotency,
          });


        const result =
          await orchestrator.execute(request);


        expect(result.state)
          .toBe('REJECTED');

        expect(result.failure?.code)
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


        expect(boundaryExecute)
          .not
          .toHaveBeenCalled();

        expect(adapterExecute)
          .not
          .toHaveBeenCalled();

      },
    );


    it(
      'preserves tenant actor correlation and payload across complete execution chain',
      async () => {

        const request =
          createRequest();


        const adapterExecute =
          vi.fn(
            async (
              received:
                GrowthExternalActionRequestV1,
            ) => {

              expect(received.authority.tenantId)
                .toBe(request.authority.tenantId);

              expect(received.authority.actor)
                .toEqual(request.authority.actor);

              expect(received.correlation)
                .toEqual(request.correlation);

              expect(received.payload)
                .toEqual(request.payload);

              expect(received.idempotencyKey)
                .toBe(request.idempotencyKey);

              return createSuccess(received);

            },
          );


        const adapter:
          GrowthExternalActionProviderAdapterV1 = {
            target:
              'LINKEDIN',

            execute:
              adapterExecute,
          };


        const providerBoundary =
          new GrowthExternalActionProviderExecutionBoundaryV1({
            adapters: [
              adapter,
            ],
          });


        const idempotency:
          GrowthExternalActionIdempotencyPortV1 = {

            claim:
              async () => ({
                key:
                  request.idempotencyKey,

                state:
                  'CLAIMED',

                ownerActionId:
                  request.actionId,
              }),

            get:
              async () =>
                null,

            complete:
              async () =>
                undefined,
          };


        const orchestrator =
          new GrowthExternalActionOrchestratorV1({
            executor:
              providerBoundary,

            idempotency,
          });


        const result =
          await orchestrator.execute(request);


        expect(adapterExecute)
          .toHaveBeenCalledTimes(1);

        expect(result.correlationId)
          .toBe(
            request.correlation.correlationId,
          );

      },
    );

  },
);