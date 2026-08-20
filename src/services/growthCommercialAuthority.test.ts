import {
  describe,
  expect,
  it,
} from "vitest";

describe(
  "Aura Growth commercial authority",
  () => {
    it(
      "recognizes Growth as a canonical commercial module",
      async () => {
        const pricingSource =
          await import(
            "./pricingEngineService?raw"
          );

        const text =
          pricingSource.default;

        const growthRules =
          text.match(
            /moduleCode:\s*"AURA_GROWTH"/g,
          ) ?? [];

        expect(growthRules).toHaveLength(1);

        expect(text).toMatch(
          /moduleCode:\s*"AURA_GROWTH"[\s\S]*?label:\s*"Aura Growth"/,
        );

        const clientSource =
          await import(
            "../constants/clientOptions?raw"
          );

        const clientText =
          clientSource.default;

        const clientGrowthEntries =
          clientText.match(
            /value:\s*"AURA_GROWTH"[\s\S]*?label:\s*"Aura Growth"/g,
          ) ?? [];

        expect(clientGrowthEntries).toHaveLength(1);
      },
    );

    it(
      "keeps Growth pricing fail-closed until commercial authorization",
      async () => {
        const source =
          await import(
            "./pricingEngineService?raw"
          );

        const text =
          source.default;

        expect(text).toMatch(
          /moduleCode:\s*"AURA_GROWTH"[\s\S]*?label:\s*"Aura Growth"[\s\S]*?monthlyPrice:\s*0[\s\S]*?includedInBase:\s*false[\s\S]*?active:\s*false/,
        );
      },
    );

    it(
      "keeps provisioning support internal without widening its public API",
      async () => {
        const source =
          await import(
            "./provisioningService?raw"
          );

        const text =
          source.default;

        expect(text).toMatch(
          /case\s+"AURA_GROWTH":\s*return\s+"Aura Growth";/,
        );

        expect(text).toMatch(
          /case\s+"AURA_GROWTH":\s*keyword\s*=\s*"growth";\s*break;/,
        );

        expect(text).not.toMatch(
          /export\s+(?:async\s+)?function\s+getProductName/,
        );

        expect(text).not.toMatch(
          /export\s+(?:async\s+)?function\s+getModuleMonthlyPrice/,
        );
      },
    );

    it(
      "does not widen setup authority to Growth",
      async () => {
        const pricingSource =
          await import(
            "./pricingEngineService?raw"
          );

        const quoteSource =
          await import(
            "../types/quote?raw"
          );

        const text =
          `${pricingSource.default}\n${quoteSource.default}`;

        expect(text).not.toContain(
          'product: "AURA_GROWTH"',
        );

        expect(text).not.toContain(
          "GROWTH_ENTERPRISE",
        );

        expect(text).not.toContain(
          "setupGrowth",
        );
      },
    );

    it(
      "keeps Growth catalog identity explicit and unique",
      async () => {
        const modulesSource =
          await import(
            "../pages/ModulesPage?raw"
          );

        const text =
          modulesSource.default;

        const codeMatches =
          text.match(
            /code:\s*"AURA_GROWTH"/g,
          ) ?? [];

        const nameMatches =
          text.match(
            /name:\s*"Aura Growth"/g,
          ) ?? [];

        expect(codeMatches).toHaveLength(1);
        expect(nameMatches).toHaveLength(1);

        expect(text).toMatch(
          /code:\s*"AURA_GROWTH"[\s\S]*?name:\s*"Aura Growth"[\s\S]*?status:\s*"Pre-lanzamiento"/,
        );
      },
    );
  },
);