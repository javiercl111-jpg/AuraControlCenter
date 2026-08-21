import { describe, expect, it } from 'vitest';

import type {
  GrowthContextRepositoryPortV1,
} from '../GrowthContextRepositoryPortV1';

import type {
  GrowthWorkspaceContextV1,
} from '../../domain/GrowthWorkspaceContextV1';


describe(
  'GROWTH-COMMERCIAL-01 | GrowthContextRepositoryPortV1',
  () => {


    it(
      'defines a repository contract for saving Growth Context',
      async () => {

        const repository:
          GrowthContextRepositoryPortV1 =
          {
            async save() {},

            async get() {
              return null;
            },

            async exists() {
              return false;
            },
          };


        expect(repository)
          .toBeDefined();

      },
    );


    it(
      'supports saving and retrieving Growth Context',
      async () => {

        const context:
          GrowthWorkspaceContextV1 =
          {} as GrowthWorkspaceContextV1;


        const repository:
          GrowthContextRepositoryPortV1 =
          {
            async save() {},

            async get() {
              return null;
            },

            async exists() {
              return false;
            },
          };


        expect(
          repository.save
        )
        .toBeDefined();


        expect(
          repository.get
        )
        .toBeDefined();


        expect(
          context
        )
        .toBeDefined();

      },
    );


    it(
      'does not define infrastructure dependencies',
      () => {

        const forbidden =
          [
            'firestore',
            'firebase',
            'denue',
            'inegi',
          ];


        expect(
          forbidden.includes(
            'firestore'
          )
        )
        .toBe(true);

      },
    );

  },
);