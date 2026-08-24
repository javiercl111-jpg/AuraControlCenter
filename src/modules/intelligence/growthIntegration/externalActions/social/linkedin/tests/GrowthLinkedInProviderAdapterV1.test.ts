import {
  describe,
  expect,
  it,
} from 'vitest';

import fs from 'fs';


describe(
  'GROWTH-CLOSURE-01 | LinkedIn Provider Adapter V1',
  () => {

    it(
      'requires the productive LinkedIn provider adapter',
      () => {

        expect(
          fs.existsSync(
            'src/modules/intelligence/growthIntegration/externalActions/social/linkedin/GrowthLinkedInProviderAdapterV1.ts',
          ),
        ).toBe(true);

      },
    );

  },
);