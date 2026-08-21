import { describe, expect, it } from 'vitest';

import {
  GrowthContextMemoryAdapterV1,
} from '../GrowthContextMemoryAdapterV1';

import type {
  GrowthWorkspaceContextV1,
} from '../../../domain/GrowthWorkspaceContextV1';


describe(
  'GROWTH-COMMERCIAL-01 | GrowthContextMemoryAdapterV1',
  () => {

    it(
      'stores and retrieves Growth Context',
      async () => {

        const adapter =
          new GrowthContextMemoryAdapterV1();


        const context:
          GrowthWorkspaceContextV1 =
          {
            workspaceId:
              'workspace-001',

            ownerRef: {
              principalId:
                'person-001',

              principalType:
                'PERSON',

              displayName:
                'Person',
            },

            authorityContext: {},

            offers: [],

            audiences: [],

            objectives: [],

            channels: [],
          };


        await adapter.save(context);


        const result =
          await adapter.get(
            'workspace-001',
          );


        expect(result)
          .toEqual(context);

      },
    );


    it(
      'returns null for unknown workspace',
      async () => {

        const adapter =
          new GrowthContextMemoryAdapterV1();


        const result =
          await adapter.get(
            'missing',
          );


        expect(result)
          .toBeNull();

      },
    );


    it(
      'reports existence',
      async () => {

        const adapter =
          new GrowthContextMemoryAdapterV1();


        expect(
          await adapter.exists(
            'missing',
          )
        )
        .toBe(false);

      },
    );

  },
);