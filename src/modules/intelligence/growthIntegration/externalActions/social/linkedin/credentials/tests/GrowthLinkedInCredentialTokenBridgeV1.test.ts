import {
  describe,
  expect,
  it,
} from 'vitest';

import fs from 'fs';


describe(
  'GROWTH-CLOSURE-01 | LinkedIn Credential Token Bridge V1',
  () => {

    it(
      'requires the productive credential to token-provider bridge',
      () => {

        expect(
          fs.existsSync(
            'src/modules/intelligence/growthIntegration/externalActions/social/linkedin/credentials/GrowthLinkedInCredentialTokenBridgeV1.ts',
          ),
        ).toBe(true);

      },
    );

  },
);