import {
  describe,
  expect,
  it,
} from 'vitest';

import fs from 'fs';

import {
  GROWTH_LINKEDIN_AUTHORIZED_ROLES_V1,
  isGrowthLinkedInAuthorizedRoleV1,
} from '../../../src/composition/linkedin/GrowthLinkedInCallableRuntimeV1';


describe(
  'GROWTH-CLOSURE-01 | LinkedIn Callable Runtime Behavior V1',
  () => {

    it(
      'declares the governed administrative role set',
      () => {

        expect(
          GROWTH_LINKEDIN_AUTHORIZED_ROLES_V1,
        ).toContain(
          'PLATFORM_OWNER',
        );

        expect(
          GROWTH_LINKEDIN_AUTHORIZED_ROLES_V1,
        ).toContain(
          'SALES_DIRECTOR',
        );

      },
    );


    it(
      'authorizes a governed platform owner',
      () => {

        expect(
          isGrowthLinkedInAuthorizedRoleV1(
            'PLATFORM_OWNER',
          ),
        ).toBe(
          true,
        );

      },
    );


    it(
      'rejects a non-authorized viewer role',
      () => {

        expect(
          isGrowthLinkedInAuthorizedRoleV1(
            'VIEWER',
          ),
        ).toBe(
          false,
        );

      },
    );


    it(
      'declares App Check and the LinkedIn secret binding without secret acquisition',
      () => {

        const source =
          fs.readFileSync(
            'functions/src/composition/linkedin/GrowthLinkedInCallableRuntimeV1.ts',
            'utf8',
          );

        expect(
          source,
        ).toContain(
          'enforceAppCheck',
        );

        expect(
          source,
        ).toContain(
          'growthLinkedInAccessTokenSecretV1',
        );

        expect(
          source,
        ).toContain(
          'secrets:',
        );

        expect(
          source,
        ).toContain(
          'request.auth',
        );

        expect(
          source,
        ).toContain(
          'resolvePlatformPrincipal',
        );

        expect(
          source,
        ).not.toContain(
          '.acquire(',
        );

        expect(
          source,
        ).not.toContain(
          '.value()',
        );

        expect(
          source,
        ).not.toContain(
          'fetch(',
        );

      },
    );

  },
);