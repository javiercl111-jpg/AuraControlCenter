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

        const previewCallableSource =
          fs.readFileSync(
            "functions/src/composition/linkedin/GrowthLinkedInPreviewCallableRuntimeV1.ts",
            "utf8",
          );

        const sharedCallableSource =
          fs.readFileSync(
            "functions/src/composition/linkedin/GrowthLinkedInCallableRuntimeV1.ts",
            "utf8",
          );

        expect(
          previewCallableSource,
        ).toContain(
          "PREVIEW_DISCOVERY_CALLABLE_OPTIONS_V1",
        );

        expect(
          previewCallableSource,
        ).toContain(
          "assertPreviewDiscoveryRuntimeV1",
        );

        expect(
          previewCallableSource,
        ).toContain(
          "GROWTH_SOCIAL_CAPABILITY_PREVIEW_ENVIRONMENT_V1",
        );

        expect(
          previewCallableSource,
        ).toContain(
          "createGrowthLinkedInRuntimeReadinessV1",
        );

        expect(
          sharedCallableSource,
        ).toContain(
          "growthLinkedInAccessTokenSecretV1",
        );

        expect(
          sharedCallableSource,
        ).toContain(
          "secrets:",
        );

        expect(
          sharedCallableSource,
        ).toContain(
          "enforceAppCheck",
        );

        expect(
          sharedCallableSource,
        ).not.toContain(
          "PREVIEW_DISCOVERY_CALLABLE_OPTIONS_V1",
        );

        expect(
          sharedCallableSource,
        ).not.toContain(
          "assertPreviewDiscoveryRuntimeV1",
        );

      },
    );

  },
);