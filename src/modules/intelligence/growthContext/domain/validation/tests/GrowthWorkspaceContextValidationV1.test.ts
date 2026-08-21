import { describe, expect, it } from 'vitest';

import {
  validateGrowthWorkspaceContextV1,
} from '../validateGrowthWorkspaceContextV1';

import type {
  GrowthWorkspaceContextV1,
} from '../../GrowthWorkspaceContextV1';

describe(
  'GROWTH-COMMERCIAL-01 | GrowthWorkspaceContextV1 validation',
  () => {

    it(
      'accepts a valid organization growth workspace',
      () => {

        const context: GrowthWorkspaceContextV1 = {
          workspaceId: 'workspace-001',

          ownerRef: {
            principalId: 'org-001',
            principalType: 'ORGANIZATION',
            displayName: 'Example Organization',
          },

          authorityContext: {
            organizationId: 'org-001',
          },

          offers: [],

          audiences: [],

          objectives: [],

          channels: [],
        };

        expect(
          validateGrowthWorkspaceContextV1(context)
        ).toBe(true);

      },
    );


    it(
      'rejects organization without authority reference',
      () => {

        const context = {
          workspaceId: 'workspace-001',

          ownerRef: {
            principalId: 'org-001',
            principalType: 'ORGANIZATION',
            displayName: 'Example Organization',
          },

          authorityContext: {},

          offers: [],

          audiences: [],

          objectives: [],

          channels: [],

        } as GrowthWorkspaceContextV1;


        expect(
          () =>
            validateGrowthWorkspaceContextV1(context)
        ).toThrow();

      },
    );


    it(
      'rejects offer without value proposition',
      () => {

        const context = {
          workspaceId: 'workspace-001',

          ownerRef: {
            principalId: 'person-001',
            principalType: 'PERSON',
            displayName: 'Person',
          },

          authorityContext: {},

          offers: [
            {
              offerId: 'offer-001',
              type: 'SERVICE',
              name: 'Service',
              description: 'Description',
              valueProposition: '',
              benefits: [],
              differentiators: [],
              targetAudienceSummary: 'Audience',
            },
          ],

          audiences: [],
          objectives: [],
          channels: [],

        } as GrowthWorkspaceContextV1;


        expect(
          () =>
            validateGrowthWorkspaceContextV1(context)
        ).toThrow();

      },
    );


    it(
      'rejects growth context containing external authority leakage',
      () => {

        const context = {
          workspaceId: 'workspace-001',

          ownerRef: {
            principalId: 'person-001',
            principalType: 'PERSON',
            displayName: 'Person',
          },

          authorityContext: {},

          offers: [],

          audiences: [],

          objectives: [],

          channels: [],

          denueSource: 'INEGI',

        } as unknown as GrowthWorkspaceContextV1;


        expect(
          () =>
            validateGrowthWorkspaceContextV1(context)
        ).toThrow();

      },
    );

  },
);