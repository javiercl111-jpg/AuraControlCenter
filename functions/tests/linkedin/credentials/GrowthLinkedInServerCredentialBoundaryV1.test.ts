import {
  describe,
  expect,
  it,
} from 'vitest';

import fs from 'fs';


describe(
  'GROWTH-CLOSURE-01 | LinkedIn Server Credential Boundary V1',
  () => {

    it(
      'requires the productive server-side LinkedIn credential boundary',
      () => {

        expect(
          fs.existsSync(
            'functions/src/infrastructure/linkedin/credentials/GrowthLinkedInServerCredentialBoundaryV1.ts',
          ),
        ).toBe(true);

      },
    );

  },
);