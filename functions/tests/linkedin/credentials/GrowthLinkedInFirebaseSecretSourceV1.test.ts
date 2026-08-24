import {
  describe,
  expect,
  it,
} from 'vitest';

import fs from 'fs';


describe(
  'GROWTH-CLOSURE-01 | LinkedIn Firebase Secret Source V1',
  () => {

    it(
      'requires the Firebase-backed LinkedIn secret source',
      () => {

        expect(
          fs.existsSync(
            'functions/src/infrastructure/linkedin/credentials/GrowthLinkedInFirebaseSecretSourceV1.ts',
          ),
        ).toBe(true);

      },
    );

  },
);