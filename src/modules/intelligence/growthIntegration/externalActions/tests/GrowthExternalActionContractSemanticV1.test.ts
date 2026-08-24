import { describe, expect, it } from 'vitest';

import {
  GROWTH_EXTERNAL_ACTION_TARGETS_V1,
  GROWTH_EXTERNAL_ACTION_TYPES_V1,
  type GrowthExternalActionRequestV1,
  type GrowthExternalActionReceiptV1,
} from '../GrowthExternalActionContractV1';


describe(
  'GROWTH-CLOSURE-01 | Growth External Action Contract Semantic V1',
  () => {

    it(
      'defines the canonical external action types',
      () => {

        expect(
          GROWTH_EXTERNAL_ACTION_TYPES_V1,
        ).toEqual([
          'SOCIAL_PUBLISH',
          'SOCIAL_SCHEDULE',
          'EMAIL_SEND',
          'CRM_ACTION',
          'DISCOVERY_ACTION',
          'MULTIMEDIA_RENDER',
          'ASSET_TRANSFORM',
          'CAMPAIGN_ACTION',
        ]);

      },
    );


    it(
      'defines the canonical execution targets',
      () => {

        expect(
          GROWTH_EXTERNAL_ACTION_TARGETS_V1,
        ).toEqual([
          'LINKEDIN',
          'INSTAGRAM',
          'FACEBOOK',
          'YOUTUBE',
          'AURA_MAIL',
          'AURA_CRM',
          'EXECUTIVE_DISCOVERY',
          'MULTIMEDIA_ENGINE',
          'ASSET_LIBRARY',
          'CAMPAIGN_RUNTIME',
        ]);

      },
    );


    it(
      'supports a governed social publication request',
      () => {

        const request:
          GrowthExternalActionRequestV1 = {

            actionId:
              'action-social-001',

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

              policyId:
                'growth-social-publication-policy',

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


        expect(request.actionType)
          .toBe('SOCIAL_PUBLISH');

        expect(request.target)
          .toBe('LINKEDIN');

        expect(request.authorization.required)
          .toBe(true);

        expect(request.authorization.state)
          .toBe('AUTHORIZED');

        expect(request.idempotencyKey)
          .toContain('linkedin');

        expect(request.correlation.source)
          .toBe('AURA_GROWTH');

      },
    );


    it(
      'supports a scheduled governed action',
      () => {

        const request:
          GrowthExternalActionRequestV1 = {

            actionId:
              'action-schedule-001',

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
                'request-002',

              correlationId:
                'correlation-002',

              source:
                'AURA_GROWTH',
            },

            actionType:
              'SOCIAL_SCHEDULE',

            target:
              'INSTAGRAM',

            payload: {
              payloadType:
                'APPROVED_SOCIAL_CONTENT',

              referenceId:
                'content-002',
            },

            authorization: {
              required:
                true,

              state:
                'AUTHORIZED',
            },

            schedule: {
              executeAt:
                '2026-08-25T15:00:00Z',

              timezone:
                'America/Mexico_City',
            },

            idempotencyKey:
              'tenant-001:instagram:content-002',

            risk:
              'MEDIUM',

            executionState:
              'SCHEDULED',

            retryPolicy: {
              enabled:
                true,

              maxAttempts:
                3,

              backoffStrategy:
                'EXPONENTIAL',
            },
          };


        expect(request.executionState)
          .toBe('SCHEDULED');

        expect(request.schedule.executeAt)
          .toBeDefined();

        expect(request.schedule.timezone)
          .toBe('America/Mexico_City');

      },
    );


    it(
      'supports an auditable execution receipt',
      () => {

        const receipt:
          GrowthExternalActionReceiptV1 = {

            receiptId:
              'receipt-001',

            actionId:
              'action-social-001',

            state:
              'SUCCEEDED',

            providerExecutionId:
              'provider-001',

            executedAt:
              '2026-08-24T10:05:00Z',

            evidence: [
              {
                evidenceId:
                  'evidence-001',

                evidenceType:
                  'PROVIDER_RECEIPT',

                recordedAt:
                  '2026-08-24T10:05:01Z',

                reference:
                  'provider-001',
              },
            ],
          };


        expect(receipt.state)
          .toBe('SUCCEEDED');

        expect(receipt.evidence)
          .toHaveLength(1);

        expect(receipt.evidence[0]?.evidenceType)
          .toBe('PROVIDER_RECEIPT');

      },
    );


    it(
      'supports retryable execution failure evidence',
      () => {

        const receipt:
          GrowthExternalActionReceiptV1 = {

            receiptId:
              'receipt-failure-001',

            actionId:
              'action-social-002',

            state:
              'FAILED',

            evidence: [],

            failure: {
              code:
                'PROVIDER_TEMPORARILY_UNAVAILABLE',

              message:
                'Provider temporarily unavailable.',

              retryable:
                true,
            },
          };


        expect(receipt.failure?.retryable)
          .toBe(true);

        expect(receipt.state)
          .toBe('FAILED');

      },
    );

  },
);