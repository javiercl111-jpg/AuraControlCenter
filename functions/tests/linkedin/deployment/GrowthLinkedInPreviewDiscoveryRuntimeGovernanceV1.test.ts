import {
  describe,
  expect,
  it,
} from "vitest";

import fs from "node:fs";


describe(
  "GROWTH-CLOSURE-01 | LinkedIn preview runtime governance",
  () => {

    it(
      "uses the already-custodied LinkedIn Secret Manager authority",
      () => {

        const secretSource =
          fs.readFileSync(
            "functions/src/infrastructure/linkedin/credentials/GrowthLinkedInFirebaseSecretSourceV1.ts",
            "utf8",
          );

        expect(
          secretSource,
        ).toContain(
          "'GROWTH_LINKEDIN_ACCESS_TOKEN';",
        );

        expect(
          secretSource,
        ).not.toContain(
          "'AURA_GROWTH_LINKEDIN_ACCESS_TOKEN';",
        );

      },
    );


    it(
      "places growthLinkedInRuntimeReadinessV1 under the preview deployment contract",
      () => {

        const deploymentSource =
          fs.readFileSync(
            "functions/src/discovery/deployment/previewDiscoveryDeploymentUnitV1.ts",
            "utf8",
          );

        expect(
          deploymentSource,
        ).toContain(
          '"growthLinkedInRuntimeReadinessV1",',
        );

        expect(
          deploymentSource,
        ).toContain(
          'growthLinkedInRuntimeReadinessV1: serviceAccount("preview-growth-linkedin-rt"),',
        );

        expect(
          deploymentSource,
        ).toContain(
          'secretParamName: "GROWTH_LINKEDIN_ACCESS_TOKEN"',
        );

        expect(
          deploymentSource,
        ).toContain(
          'secretResource: "GROWTH_LINKEDIN_ACCESS_TOKEN"',
        );

        expect(
          deploymentSource,
        ).toContain(
          'growthLinkedInRuntimeReadinessV1: callableOptions("growthLinkedInRuntimeReadinessV1"),',
        );

      },
    );


    it(
      "makes the LinkedIn callable consume governed preview runtime options",
      () => {

        const callableSource =
          fs.readFileSync(
            "functions/src/composition/linkedin/GrowthLinkedInCallableRuntimeV1.ts",
            "utf8",
          );

        expect(
          callableSource,
        ).toContain(
          "PREVIEW_DISCOVERY_CALLABLE_OPTIONS_V1",
        );

        expect(
          callableSource,
        ).toContain(
          "...PREVIEW_DISCOVERY_CALLABLE_OPTIONS_V1.growthLinkedInRuntimeReadinessV1",
        );

        expect(
          callableSource,
        ).toContain(
          "growthLinkedInAccessTokenSecretV1",
        );

        expect(
          callableSource,
        ).toContain(
          "secrets:",
        );

      },
    );

  },
);