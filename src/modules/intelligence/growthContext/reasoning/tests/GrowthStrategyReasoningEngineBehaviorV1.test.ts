import { describe, expect, it } from 'vitest';


import {
  GrowthStrategyReasoningEngineV1,
} from '../GrowthStrategyReasoningEngineV1';


import type {
  GrowthIntelligenceContextRequestV1,
} from '../../intelligence/GrowthIntelligenceContextRequestV1';



describe(
  'GROWTH-COMMERCIAL-01 | GrowthStrategyReasoningEngine behavior',
  () => {


    const context:
      GrowthIntelligenceContextRequestV1 =
      {

        workspaceId:
          'workspace-001',

        subject:
          'Example Company',

        offerSummary:
          'Business Consulting',

        audienceSummary:
          'Business owners',

        growthObjective:
          'GET_CUSTOMERS',

      };


    it(
      'generates a valid strategy recommendation',
      () => {


        const result =
          GrowthStrategyReasoningEngineV1.reason(
            context,
          );


        expect(result.strategyId)
          .toBeDefined();


        expect(result.summary)
          .toContain(
            'Example Company',
          );


        expect(result.keyMessages.length)
          .toBeGreaterThan(0);


        expect(result.recommendedChannels.length)
          .toBeGreaterThan(0);


      },
    );


    it(
      'does not expose execution behavior',
      () => {


        const engine =
          GrowthStrategyReasoningEngineV1;


        expect(
          Object.keys(engine),
        )
        .not
        .toContain(
          'execute',
        );


      },
    );


  },
);