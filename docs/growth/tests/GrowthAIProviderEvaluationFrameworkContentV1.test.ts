import { describe, expect, it } from 'vitest';

import fs from 'fs';


describe(
  'GROWTH-COMMERCIAL-01 | AI Provider Evaluation Framework Content',
  () => {


    const document =
      fs.readFileSync(
        'docs/growth/GROWTH-COMMERCIAL-01-AI-PROVIDER-EVALUATION-FRAMEWORK-V1.md',
        'utf8',
      );


    it(
      'contains framework identity',
      () => {

        expect(document)
          .toContain(
            'GROWTH-COMMERCIAL-01',
          );


        expect(document)
          .toContain(
            'AI Provider Evaluation Framework v1.0',
          );

      },
    );


    it(
      'contains evaluation principles',
      () => {

        expect(document)
          .toContain(
            'Vendor Independence',
          );


        expect(document)
          .toContain(
            'Capability Based Selection',
          );

      },
    );


    it(
      'contains evaluation criteria',
      () => {

        expect(document)
          .toContain(
            'Intelligence Capability',
          );


        expect(document)
          .toContain(
            'Cost Efficiency',
          );


        expect(document)
          .toContain(
            'Privacy & Security',
          );


        expect(document)
          .toContain(
            'Enterprise Readiness',
          );


        expect(document)
          .toContain(
            'Technical Integration',
          );


        expect(document)
          .toContain(
            'Aura Compatibility',
          );

      },
    );


    it(
      'contains provider governance',
      () => {

        expect(document)
          .toContain(
            'No provider becomes a core dependency',
          );

      },
    );


    it(
      'contains providers under evaluation',
      () => {

        expect(document)
          .toContain(
            'Claude',
          );


        expect(document)
          .toContain(
            'Gemini',
          );


        expect(document)
          .toContain(
            'OpenAI',
          );


        expect(document)
          .toContain(
            'NVIDIA NIM',
          );


        expect(document)
          .toContain(
            'Private / Local Models',
          );

      },
    );


  },
);