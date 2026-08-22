import { describe, expect, it } from 'vitest';

import fs from 'fs';


describe(
  'GROWTH-COMMERCIAL-01 | Persona Audience Matching Content',
  () => {


    const document =
      fs.readFileSync(
        'docs/growth/GROWTH-COMMERCIAL-01-PERSONA-AUDIENCE-MATCHING-MODEL-V1.md',
        'utf8',
      );


    it(
      'contains business persona roles',
      () => {

        expect(document)
          .toContain(
            'Economic Buyer',
          );


        expect(document)
          .toContain(
            'Decision Maker',
          );


        expect(document)
          .toContain(
            'Influencer',
          );


        expect(document)
          .toContain(
            'User',
          );

      },
    );


    it(
      'contains individual persona model',
      () => {

        expect(document)
          .toContain(
            'Individual Persona Model',
          );


        expect(document)
          .toContain(
            'profession',
          );


        expect(document)
          .toContain(
            'needs',
          );


        expect(document)
          .toContain(
            'objectives',
          );


        expect(document)
          .toContain(
            'interests',
          );


        expect(document)
          .toContain(
            'personal intent',
          );

      },
    );


    it(
      'contains persona profile model',
      () => {

        expect(document)
          .toContain(
            'Persona Profile',
          );


        expect(document)
          .toContain(
            'role',
          );


        expect(document)
          .toContain(
            'need',
          );


        expect(document)
          .toContain(
            'objective',
          );


        expect(document)
          .toContain(
            'pain points',
          );


        expect(document)
          .toContain(
            'preferred message',
          );

      },
    );


    it(
      'contains persona matching engine',
      () => {

        expect(document)
          .toContain(
            'Persona Matching Engine',
          );


        expect(document)
          .toContain(
            'Audience Profile',
          );


        expect(document)
          .toContain(
            'Persona Profile',
          );


        expect(document)
          .toContain(
            'Content Asset',
          );


        expect(document)
          .toContain(
            'Business Objective',
          );


        expect(document)
          .toContain(
            'Message Recommendation',
          );

      },
    );


  },
);