import {
  describe,
  expect,
  it,
} from 'vitest';

import fs from 'fs';

describe(
  'GROWTH-CLOSURE-01 | LinkedIn Runtime Composition V1',
  () => {

    it(
      'requires the productive LinkedIn runtime composition',
      () => {

        expect(
          fs.existsSync(
            'functions/src/composition/linkedin/GrowthLinkedInRuntimeCompositionV1.ts',
          ),
        ).toBe(true);

      },
    );

  },
);