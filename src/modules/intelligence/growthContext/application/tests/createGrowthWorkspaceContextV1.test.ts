import { describe, expect, it } from 'vitest';

import {
  createGrowthWorkspaceContextV1,
} from '../createGrowthWorkspaceContextV1';

describe(
  'GROWTH-COMMERCIAL-01 | createGrowthWorkspaceContextV1',
  () => {

    it(
      'creates a valid professional growth workspace',
      () => {

        const workspace =
          createGrowthWorkspaceContextV1({
            workspaceId:
              'workspace-001',

            ownerRef: {
              principalId:
                'person-001',

              principalType:
                'PROFESSIONAL',

              displayName:
                'Business Consultant',
            },

            authorityContext: {},

            offers: [],

            audiences: [],

            objectives: [],

            channels: [],
          });


        expect(
          workspace.workspaceId
        )
        .toBe(
          'workspace-001'
        );

      },
    );


    it(
      'rejects invalid organization authority',
      () => {

        expect(
          () =>
            createGrowthWorkspaceContextV1({

              workspaceId:
                'workspace-001',

              ownerRef: {

                principalId:
                  'org-001',

                principalType:
                  'ORGANIZATION',

                displayName:
                  'Organization',

              },

              authorityContext: {},

              offers: [],

              audiences: [],

              objectives: [],

              channels: [],

            }),
        )
        .toThrow();

      },
    );


    it(
      'returns validated domain context',
      () => {

        const result =
          createGrowthWorkspaceContextV1({

            workspaceId:
              'workspace-002',

            ownerRef: {

              principalId:
                'creator-001',

              principalType:
                'CREATOR',

              displayName:
                'Creator',

            },

            authorityContext: {},

            offers: [],

            audiences: [],

            objectives: [],

            channels: [],

          });


        expect(result)
        .toBeDefined();

      },
    );

  },
);