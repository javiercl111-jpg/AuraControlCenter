import {
  describe,
  expect,
  it,
} from 'vitest';

import fs from 'fs';


describe(
  'GROWTH-CLOSURE-01 | Social Provider Adapter Contract Semantic V1',
  () => {

    const contract =
      fs.readFileSync(
        'src/modules/intelligence/growthIntegration/externalActions/social/GrowthSocialProviderAdapterContractV1.ts',
        'utf8',
      );


    it(
      'defines supported social targets',
      () => {

        expect(contract)
          .toContain(
            "'LINKEDIN' | 'INSTAGRAM' | 'FACEBOOK' | 'YOUTUBE'",
          );

      },
    );


    it(
      'defines publication content',
      () => {

        expect(contract)
          .toContain(
            'GrowthSocialPublicationContentV1',
          );

        expect(contract)
          .toContain(
            'readonly text:',
          );

        expect(contract)
          .toContain(
            'readonly mediaReferenceIds:',
          );

        expect(contract)
          .toContain(
            'readonly linkUrl?:',
          );

      },
    );


    it(
      'defines governed publication context',
      () => {

        expect(contract)
          .toContain(
            'GrowthSocialPublicationContextV1',
          );

        expect(contract)
          .toContain(
            'readonly tenantId:',
          );

        expect(contract)
          .toContain(
            'readonly actionId:',
          );

        expect(contract)
          .toContain(
            'readonly correlationId:',
          );

        expect(contract)
          .toContain(
            'readonly target:',
          );

      },
    );


    it(
      'defines provider execution receipt',
      () => {

        expect(contract)
          .toContain(
            'GrowthSocialProviderExecutionReceiptV1',
          );

        expect(contract)
          .toContain(
            'readonly provider:',
          );

        expect(contract)
          .toContain(
            'readonly providerExecutionId:',
          );

        expect(contract)
          .toContain(
            'readonly publishedAt:',
          );

        expect(contract)
          .toContain(
            'readonly permalink?:',
          );

      },
    );


    it(
      'defines adapter execution contract',
      () => {

        expect(contract)
          .toContain(
            'GrowthSocialProviderAdapterV1',
          );

        expect(contract)
          .toContain(
            'execute(',
          );

        expect(contract)
          .toContain(
            'GrowthExternalActionRequestV1',
          );

        expect(contract)
          .toContain(
            'Promise<GrowthExternalActionResultV1>',
          );

      },
    );


    it(
      'defines provider publish port',
      () => {

        expect(contract)
          .toContain(
            'GrowthSocialProviderPublishPortV1',
          );

        expect(contract)
          .toContain(
            'publish(',
          );

        expect(contract)
          .toContain(
            'GrowthSocialPublicationContextV1',
          );

        expect(contract)
          .toContain(
            'GrowthSocialPublicationContentV1',
          );

        expect(contract)
          .toContain(
            'Promise<GrowthSocialProviderExecutionReceiptV1>',
          );

      },
    );

  },
);