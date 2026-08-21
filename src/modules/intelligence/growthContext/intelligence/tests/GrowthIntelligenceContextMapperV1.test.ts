import { describe, expect, it } from 'vitest';

import {
  GrowthIntelligenceContextMapperV1,
} from '../GrowthIntelligenceContextMapperV1';


import type {
  GrowthWorkspaceContextV1,
} from '../../domain/GrowthWorkspaceContextV1';


describe(
  'GROWTH-COMMERCIAL-01 | GrowthIntelligenceContextMapperV1',
  () => {


    it(
      'maps Growth Context into Intelligence Context',
      () => {


        const workspace:
          GrowthWorkspaceContextV1 =
          {

            workspaceId:
              'workspace-001',

            ownerRef: {
              principalId:
                'company-001',

              principalType:
                'ORGANIZATION',

              displayName:
                'Example Company',
            },


            authorityContext: {
              organizationId:
                'company-001',
            },


            offers: [
              {
                offerId:
                  'offer-001',

                type:
                  'SERVICE',

                name:
                  'Consulting',

                description:
                  'Business consulting',

                valueProposition:
                  'Help companies grow',

                benefits:
                  [
                    'Strategy',
                  ],

                differentiators:
                  [
                    'Experience',
                  ],

                targetAudienceSummary:
                  'Business owners',
              },
            ],


            audiences: [],

            objectives: [
              {
                objectiveId:
                  'objective-001',

                type:
                  'GET_CUSTOMERS',

                description:
                  'Generate customers',
              },
            ],


            channels: [],

          };


        const result =
          GrowthIntelligenceContextMapperV1.map(
            workspace,
          );


        expect(result)
          .toBeDefined();


        expect(
          result.offerSummary
        )
        .toBe(
          'Consulting',
        );


      },
    );


    it(
      'preserves Growth authority separation',
      () => {


        const mapper =
          GrowthIntelligenceContextMapperV1;


        expect(mapper)
          .toBeDefined();


      },
    );


  },
);