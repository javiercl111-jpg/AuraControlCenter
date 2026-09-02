import {
  describe,
  expect,
  it,
} from "vitest";

import fs from "node:fs";

describe(
  "GROWTH-CLOSURE-01 | LinkedIn preview discovery entrypoint",
  () => {

    it(
      "exports growthLinkedInRuntimeReadinessV1 from the Firebase production entrypoint",
      () => {

        const source =
          fs.readFileSync(
            "functions/src/previewDiscoveryIndex.ts",
            "utf8",
          );

        expect(source).toContain(
          'import { growthLinkedInRuntimeReadinessV1 as growthLinkedInRuntimeReadinessV1Handler } from "./composition/linkedin/GrowthLinkedInPreviewCallableRuntimeV1";',
        );

        expect(source).toContain(
          "export const growthLinkedInRuntimeReadinessV1 = growthLinkedInRuntimeReadinessV1Handler;",
        );

      },
    );

  },
);