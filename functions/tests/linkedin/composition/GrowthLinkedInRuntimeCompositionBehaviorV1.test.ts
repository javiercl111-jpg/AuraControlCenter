import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  GROWTH_LINKEDIN_INTEGRATION_TENANT_V1,
  createGrowthLinkedInCredentialBoundaryV1,
} from '../../../src/composition/linkedin/GrowthLinkedInRuntimeCompositionV1';


describe(
  'GROWTH-CLOSURE-01 | LinkedIn Runtime Composition Behavior V1',
  () => {

    it(
      'binds LinkedIn integration to the canonical Aura tenant',
      () => {

        expect(
          GROWTH_LINKEDIN_INTEGRATION_TENANT_V1,
        ).toBe(
          'aura_root',
        );

      },
    );


    it(
      'creates the governed credential boundary without reading the secret',
      () => {

        const boundary =
          createGrowthLinkedInCredentialBoundaryV1();

        expect(
          boundary,
        ).toBeDefined();

      },
    );

  },
);