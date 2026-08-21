import { describe, expect, it } from 'vitest';

import {
  addGrowthOfferV1,
} from '../addGrowthOfferV1';

import type {
  GrowthWorkspaceContextV1,
  GrowthOfferV1,
} from '../../domain/GrowthWorkspaceContextV1';


describe(
  'GROWTH-COMMERCIAL-01 | addGrowthOfferV1',
  () => {


    const workspace:
      GrowthWorkspaceContextV1 =
      {
        workspaceId:
          'workspace-001',

        ownerRef: {
          principalId:
            'person-001',

          principalType:
            'PROFESSIONAL',

          displayName:
            'Consultant',
        },

        authorityContext: {},

        offers: [],

        audiences: [],

        objectives: [],

        channels: [],
      };


    const offer:
      GrowthOfferV1 =
      {
        offerId:
          'offer-001',

        type:
          'SERVICE',

        name:
          'Business Consulting',

        description:
          'Strategic consulting service',

        valueProposition:
          'Help companies grow with structured strategy',

        benefits:
          [
            'Clarity',
            'Prioritized actions',
          ],

        differentiators:
          [
            'AI assisted strategy',
          ],

        targetAudienceSummary:
          'Business owners',

        geography:
          [
            'Mexico',
          ],
      };


    it(
      'adds a Growth Offer to a workspace',
      () => {

        const result =
          addGrowthOfferV1(
            workspace,
            offer,
          );


        expect(
          result.offers
        )
        .toHaveLength(1);


        expect(
          result.offers[0]
        )
        .toEqual(
          offer,
        );

      },
    );


    it(
      'does not mutate original workspace',
      () => {

        const result =
          addGrowthOfferV1(
            workspace,
            offer,
          );


        expect(
          workspace.offers
        )
        .toHaveLength(0);


        expect(result)
        .not
        .toBe(workspace);

      },
    );


    it(
      'rejects invalid offer',
      () => {

        expect(
          () =>
            addGrowthOfferV1(
              workspace,
              {
                ...offer,
                valueProposition:
                  '',
              },
            )
        )
        .toThrow();

      },
    );


  },
);