import {
  readFileSync,
} from 'node:fs';

import {
  describe,
  expect,
  it,
} from 'vitest';

const CALLABLE_PATH =
  'functions/src/composition/linkedin/GrowthLinkedInCallableRuntimeV1.ts';

const PREVIEW_CALLABLE_PATH =
  'functions/src/composition/linkedin/GrowthLinkedInPreviewCallableRuntimeV1.ts';

const callableSource =
  readFileSync(
    CALLABLE_PATH,
    'utf8',
  );

const previewCallableSource =
  readFileSync(
    PREVIEW_CALLABLE_PATH,
    'utf8',
  );

describe(
  'GROWTH-CLOSURE-01 | LinkedIn Callable Runtime Behavior V1',
  () => {
    it(
      'authorizes readiness through growth.social.manage instead of LinkedIn role allowlists',
      () => {
        expect(
          callableSource,
        ).toContain(
          'GROWTH_SOCIAL_MANAGE_CAPABILITY_V1',
        );

        expect(
          callableSource,
        ).toContain(
          'hasGrowthSocialCapabilityV1',
        );

        expect(
          callableSource,
        ).toContain(
          '../../growth/authorization/GrowthSocialCapabilityAuthorizationV1',
        );

        expect(
          callableSource,
        ).toContain(
          'await hasGrowthSocialCapabilityV1(',
        );

        expect(
          callableSource,
        ).not.toContain(
          'GROWTH_LINKEDIN_AUTHORIZED_ROLES_V1',
        );

        expect(
          callableSource,
        ).not.toContain(
          'isGrowthLinkedInAuthorizedRoleV1',
        );
      },
    );

    it(
      'keeps Preview assertion and canonical read-only principal resolution',
      () => {
        expect(
          previewCallableSource,
        ).toContain(
          'assertPreviewDiscoveryRuntimeV1',
        );

        expect(
          callableSource,
        ).toContain(
          'resolveDiscoveryPrincipalV1',
        );

        expect(
          callableSource,
        ).toContain(
          'caller.uid',
        );

        expect(
          callableSource,
        ).not.toContain(
          'resolvePlatformPrincipal',
        );

        expect(
          callableSource,
        ).not.toContain(
          'caller.id',
        );
      },
    );

    it(
      'preserves App Check and secret declaration without secret or LinkedIn execution',
      () => {
        expect(
          previewCallableSource,
        ).toContain(
          'PREVIEW_DISCOVERY_CALLABLE_OPTIONS_V1',
        );

        expect(
          callableSource,
        ).toContain(
          'enforceAppCheck',
        );

        expect(
          callableSource,
        ).toContain(
          'growthLinkedInAccessTokenSecretV1',
        );

        expect(
          callableSource,
        ).toContain(
          "'DECLARED_NOT_READ'",
        );

        expect(
          callableSource,
        ).toContain(
          "'NOT_EXECUTED'",
        );

        expect(
          callableSource,
        ).not.toMatch(
          /\.acquire\s*\(/,
        );

        expect(
          callableSource,
        ).not.toMatch(
          /\.value\s*\(/,
        );

        expect(
          callableSource,
        ).not.toMatch(
          /\bfetch\s*\(/,
        );

        expect(
          callableSource,
        ).not.toContain(
          'api.linkedin.com',
        );
      },
    );
  },
);