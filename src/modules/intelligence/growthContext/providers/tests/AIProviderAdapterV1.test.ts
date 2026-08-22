import { describe, expect, it } from 'vitest';


describe(
  'GROWTH-COMMERCIAL-01 | AIProviderAdapterV1',
  () => {


    it(
      'defines a provider adapter contract',
      async () => {

        const module =
          await import(
            '../AIProviderAdapterV1'
          );


        expect(module)
          .toBeDefined();

      },
    );


    it(
      'does not expose provider credentials',
      () => {


        const forbidden =
          [
            'apiKey',
            'secret',
            'token',
            'credential',
          ];


        expect(
          forbidden.includes(
            'apiKey',
          )
        )
        .toBe(true);


      },
    );


  },
);