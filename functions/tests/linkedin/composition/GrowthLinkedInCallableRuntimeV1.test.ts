import {
  describe,
  expect,
  it,
} from 'vitest';

import fs from 'fs';


describe(
  'GROWTH-CLOSURE-01 | LinkedIn Callable Runtime V1',
  () => {

    it(
      'requires the productive LinkedIn callable runtime',
      () => {

        expect(
          fs.existsSync(
            'functions/src/composition/linkedin/GrowthLinkedInCallableRuntimeV1.ts',
          ),
        ).toBe(true);

      },
    );

  },
);