import { describe, expect, it } from 'vitest';

import {
  addGrowthObjectiveV1,
} from '../addGrowthObjectiveV1';

import type {
  GrowthWorkspaceContextV1,
  GrowthObjectiveV1,
} from '../../domain/GrowthWorkspaceContextV1';


describe(
  'GROWTH-COMMERCIAL-01 | addGrowthObjectiveV1',
  () => {


    const workspace:
      GrowthWorkspaceContextV1 =
      {
        workspaceId:
          'workspace-001',

        ownerRef: {
          principalId:
            'organization-001',

          principalType:
            'ORGANIZATION',

          displayName:
            'Example Organization',
        },

        authorityContext: {
          organizationId:
            'organization-001',
        },

        offers: [],

        audiences: [],

        objectives: [],

        channels: [],
      };


    const objective:
      GrowthObjectiveV1 =
      {
        objectiveId:
          'objective-001',

        type:
          'GET_CUSTOMERS',

        description:
          'Generate qualified commercial opportunities',

        targetMetric:
          'qualified_leads',

        targetValue:
          20,
      };


    it(
      'adds a Growth Objective to a workspace',
      () => {

        const result =
          addGrowthObjectiveV1(
            workspace,
            objective,
          );


        expect(
          result.objectives
        )
        .toHaveLength(1);


        expect(
          result.objectives[0]
        )
        .toEqual(
          objective,
        );

      },
    );


    it(
      'does not mutate original workspace',
      () => {

        const result =
          addGrowthObjectiveV1(
            workspace,
            objective,
          );


        expect(
          workspace.objectives
        )
        .toHaveLength(0);


        expect(result)
        .not
        .toBe(workspace);

      },
    );


    it(
      'rejects invalid objective',
      () => {

        expect(
          () =>
            addGrowthObjectiveV1(
              workspace,
              {
                ...objective,

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