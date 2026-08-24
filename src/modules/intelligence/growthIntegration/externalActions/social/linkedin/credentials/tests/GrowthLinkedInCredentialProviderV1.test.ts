import {
  describe,
  expect,
  it,
} from 'vitest';

import fs from 'fs';


describe(
  'GROWTH-CLOSURE-01 | LinkedIn Credential Provider V1',
  () => {

    it(
      'requires the productive LinkedIn credential provider contract',
      () => {

        expect(
          fs.existsSync(
            'src/modules/intelligence/growthIntegration/externalActions/social/linkedin/credentials/GrowthLinkedInCredentialProviderV1.ts',
          ),
        ).toBe(true);

      },
    );

  },
);