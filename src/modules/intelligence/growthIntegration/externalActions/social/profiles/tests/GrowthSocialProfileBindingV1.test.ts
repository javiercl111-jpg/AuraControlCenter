import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  GROWTH_SOCIAL_PROFILE_BINDING_SCHEMA_VERSION_V1,
  createGrowthSocialProfileBindingV1,
  type CreateGrowthSocialProfileBindingInputV1,
  type GrowthSocialProviderV1,
} from '../GrowthSocialProfileBindingV1';


const createInput =
  (
    provider:
      GrowthSocialProviderV1 =
        'LINKEDIN',
  ):
    CreateGrowthSocialProfileBindingInputV1 => ({
      bindingId:
        'binding-001',

      tenantId:
        'aura-nexus',

      provider,

      accountType:
        'ORGANIZATION',

      externalAccountId:
        'urn:li:organization:123',

      displayName:
        'Aura Nexus',

      handle:
        'auranexus',

      profileUrl:
        'https://www.linkedin.com/company/auranexus',

      connectionState:
        'CONNECTED',

      isActive:
        true,

      createdAt:
        '2026-09-04T00:00:00.000Z',

      updatedAt:
        '2026-09-04T00:00:00.000Z',

      connectedAt:
        '2026-09-04T00:00:00.000Z',

      lastVerifiedAt:
        '2026-09-04T00:00:00.000Z',
    });


describe(
  'GrowthSocialProfileBindingV1',
  () => {

    it(
      'exposes the frozen V1 schema identity',
      () => {

        expect(
          GROWTH_SOCIAL_PROFILE_BINDING_SCHEMA_VERSION_V1,
        ).toBe(
          'GROWTH_SOCIAL_PROFILE_BINDING_V1',
        );

      },
    );


    it.each(
      [
        'LINKEDIN',
        'INSTAGRAM',
        'FACEBOOK',
        'YOUTUBE',
      ] as const,
    )(
      'accepts canonical provider %s',
      (provider) => {

        const binding =
          createGrowthSocialProfileBindingV1(
            createInput(provider),
          );

        expect(binding.provider)
          .toBe(provider);

      },
    );


    it(
      'preserves tenant and external account identity',
      () => {

        const binding =
          createGrowthSocialProfileBindingV1(
            createInput(),
          );

        expect(binding.tenantId)
          .toBe('aura-nexus');

        expect(binding.externalAccountId)
          .toBe('urn:li:organization:123');

        expect(binding.connectionState)
          .toBe('CONNECTED');

        expect(binding.isActive)
          .toBe(true);

      },
    );


    it(
      'rejects an unknown provider',
      () => {

        const input =
          {
            ...createInput(),
            provider:
              'TIKTOK',
          } as unknown as
            CreateGrowthSocialProfileBindingInputV1;

        expect(
          () =>
            createGrowthSocialProfileBindingV1(
              input,
            ),
        ).toThrow(
          'GROWTH_SOCIAL_PROFILE_BINDING_PROVIDER_INVALID',
        );

      },
    );


    it(
      'rejects empty tenant authority',
      () => {

        expect(
          () =>
            createGrowthSocialProfileBindingV1({
              ...createInput(),
              tenantId:
                '   ',
            }),
        ).toThrow(
          'GROWTH_SOCIAL_PROFILE_BINDING_TENANT_ID_REQUIRED',
        );

      },
    );


    it(
      'rejects credential material in the profile binding',
      () => {

        const input =
          {
            ...createInput(),
            accessToken:
              'must-never-be-stored-here',
          } as CreateGrowthSocialProfileBindingInputV1 & {
            readonly accessToken:
              string;
          };

        expect(
          () =>
            createGrowthSocialProfileBindingV1(
              input,
            ),
        ).toThrow(
          'GROWTH_SOCIAL_PROFILE_BINDING_CREDENTIAL_FIELD_FORBIDDEN',
        );

      },
    );


    it(
      'does not infer authorization from a connected binding',
      () => {

        const binding =
          createGrowthSocialProfileBindingV1(
            createInput(),
          );

        expect(binding)
          .not
          .toHaveProperty(
            'manageAuthority',
          );

        expect(binding)
          .not
          .toHaveProperty(
            'publishAuthority',
          );

        expect(binding)
          .not
          .toHaveProperty(
            'permissions',
          );

      },
    );

  },
);