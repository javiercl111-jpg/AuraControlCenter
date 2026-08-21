import { describe, expect, it } from 'vitest';

import {
  addGrowthAudienceV1,
} from '../addGrowthAudienceV1';

import type {
  GrowthWorkspaceContextV1,
  GrowthAudienceV1,
} from '../../domain/GrowthWorkspaceContextV1';


describe(
  'GROWTH-COMMERCIAL-01 | addGrowthAudienceV1',
  () => {


    const workspace:
      GrowthWorkspaceContextV1 =
      {
        workspaceId:
          'workspace-001',

        ownerRef: {
          principalId:
            'professional-001',

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


    const audience:
      GrowthAudienceV1 =
      {
        audienceId:
          'audience-001',

        type:
          'B2B',

        description:
          'Business owners and decision makers',

        characteristics:
          [
            'SMB owners',
            'Growth oriented',
          ],

        locations:
          [
            'Mexico',
          ],

        preferredChannels:
          [
            'LINKEDIN',
          ],
      };


    it(
      'adds a Growth Audience to a workspace',
      () => {

        const result =
          addGrowthAudienceV1(
            workspace,
            audience,
          );


        expect(
          result.audiences
        )
        .toHaveLength(1);


        expect(
          result.audiences[0]
        )
        .toEqual(
          audience,
        );

      },
    );


    it(
      'does not mutate original workspace',
      () => {

        const result =
          addGrowthAudienceV1(
            workspace,
            audience,
          );


        expect(
          workspace.audiences
        )
        .toHaveLength(0);


        expect(result)
        .not
        .toBe(workspace);

      },
    );


    it(
      'rejects invalid audience',
      () => {

        expect(
          () =>
            addGrowthAudienceV1(
              workspace,
              {
                ...audience,

                description:
                  '',
              },
            )
        )
        .toThrow();

      },
    );


  },
);