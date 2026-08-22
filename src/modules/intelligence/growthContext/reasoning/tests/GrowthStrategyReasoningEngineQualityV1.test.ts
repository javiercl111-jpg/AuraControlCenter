import { describe, expect, it } from 'vitest';


import {
  GrowthStrategyReasoningEngineV1,
} from '../GrowthStrategyReasoningEngineV1';


import type {
  GrowthIntelligenceContextRequestV1,
} from '../../intelligence/GrowthIntelligenceContextRequestV1';



describe(
  'GROWTH-COMMERCIAL-01 | GrowthStrategyReasoningEngine quality',
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
      'preserves commercial identity',
      () => {

        const result =
          GrowthStrategyReasoningEngineV1.reason(
            context,
          );


        expect(result.summary)
          .toContain(
            'Example Company',
          );

      },
    );


    it(
      'preserves growth objective traceability',
      () => {

        const result =
          GrowthStrategyReasoningEngineV1.reason(
            context,
          );


        expect(
          result.successMetrics,
        )
        .toContain(
          'GET_CUSTOMERS',
        );

      },
    );


    it(
      'does not generate operational authority',
      () => {

        const result =
          GrowthStrategyReasoningEngineV1.reason(
            context,
          );


        const output =
          JSON.stringify(
            result,
          )
          .toLowerCase();


        expect(output)
          .not
          .toContain(
            'execute',
          );


        expect(output)
          .not
          .toContain(
            'deploy',
          );


        expect(output)
          .not
          .toContain(
            'firestore',
          );


      },
    );


  },
);