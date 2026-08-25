import {
  describe,
  expect,
  it,
} from 'vitest';

import fs from 'fs';


describe(
  'GROWTH-CLOSURE-01 | LinkedIn Export Surface V1',
  () => {

    it(
      'requires the LinkedIn callable runtime on the Functions export surface',
      () => {

        const source =
          fs.readFileSync(
            'functions/src/index.ts',
            'utf8',
          );

        expect(
          source,
        ).toContain(
          './composition/linkedin/GrowthLinkedInCallableRuntimeV1',
        );

      },
    );

  },
);