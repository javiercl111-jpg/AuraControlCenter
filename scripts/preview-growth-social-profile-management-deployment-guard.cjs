"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const FUNCTIONS_ROOT = path.join(ROOT, "functions");

const PROJECT = "aura-intel-preview";
const ENVIRONMENT = "PREVIEW";
const CODEBASE = "preview-discovery";
const FUNCTION_NAME = "growthSocialProfileManagementV1";
const DEPLOY_TARGET = `functions:${CODEBASE}:${FUNCTION_NAME}`;

const SERVICE_ACCOUNT =
  "preview-growth-social-rt@aura-intel-preview.iam.gserviceaccount.com";

const EXPECTED_GUARD_COMMAND =
  "node ../scripts/preview-growth-social-profile-management-deployment-guard.cjs --project aura-intel-preview --environment PREVIEW";

const EXPECTED_DEPLOY_COMMAND =
  "npm run build && npm run guard:preview-growth-social-profile-management && firebase deploy --project aura-intel-preview --only functions:preview-discovery:growthSocialProfileManagementV1 --non-interactive";


function fail(code) {
  throw new Error(code);
}


function read(relativePath) {
  return fs.readFileSync(
    path.join(ROOT, relativePath),
    "utf8",
  );
}


function json(relativePath) {
  return JSON.parse(
    read(relativePath),
  );
}


function validatePreviewGrowthSocialProfileManagementDeployment(input) {

  if (input.projectId !== PROJECT) {
    fail("SOCIAL_PROFILE_DEPLOY_PROJECT_MISMATCH");
  }

  if (input.environment !== ENVIRONMENT) {
    fail("SOCIAL_PROFILE_DEPLOY_ENVIRONMENT_MISMATCH");
  }

  const firebase =
    json("firebase.json");

  const functionsPackage =
    json("functions/package.json");

  if (firebase.functions?.codebase !== CODEBASE) {
    fail("SOCIAL_PROFILE_DEPLOY_CODEBASE_MISMATCH");
  }

  if (
    functionsPackage.main !==
    "lib/previewDiscoveryIndex.js"
  ) {
    fail("SOCIAL_PROFILE_DEPLOY_ENTRYPOINT_MISMATCH");
  }

  const guard =
    functionsPackage.scripts?.[
      "guard:preview-growth-social-profile-management"
    ];

  if (guard !== EXPECTED_GUARD_COMMAND) {
    fail("SOCIAL_PROFILE_DEPLOY_GUARD_COMMAND_NOT_EXACT");
  }

  const deploy =
    functionsPackage.scripts?.[
      "deploy:preview-growth-social-profile-management"
    ];

  if (
    deploy !== EXPECTED_DEPLOY_COMMAND ||
    deploy.includes("--force")
  ) {
    fail("SOCIAL_PROFILE_DEPLOY_COMMAND_NOT_EXACT");
  }

  const callableSource =
    read(
      "functions/src/composition/socialProfiles/GrowthSocialProfileManagementCallableRuntimeV1.ts",
    );

  const firebaseComposition =
    read(
      "functions/src/composition/socialProfiles/GrowthSocialProfileManagementFirebaseCompositionV1.ts",
    );

  const previewWrapper =
    read(
      "functions/src/composition/socialProfiles/GrowthSocialProfileManagementPreviewCallableRuntimeV1.ts",
    );

  const index =
    read(
      "functions/src/previewDiscoveryIndex.ts",
    );

  const contract =
    read(
      "functions/src/discovery/deployment/previewDiscoveryDeploymentUnitV1.ts",
    );

  if (
    !previewWrapper.includes(
      "createGrowthSocialProfileManagementCallableRuntimeV1",
    ) ||
    !previewWrapper.includes(
      "PREVIEW_DISCOVERY_CALLABLE_OPTIONS_V1",
    ) ||
    !previewWrapper.includes(
      "growthSocialProfileManagementV1",
    ) ||
    !previewWrapper.includes(
      "GROWTH_SOCIAL_CAPABILITY_PREVIEW_ENVIRONMENT_V1",
    ) ||
    !previewWrapper.includes(
      "assertPreviewDiscoveryRuntimeV1",
    )
  ) {
    fail("SOCIAL_PROFILE_DEPLOY_PREVIEW_WRAPPER_CONTRACT_MISSING");
  }

  if (
    !callableSource.includes(
      "AUTHENTICATION_REQUIRED",
    ) ||
    !callableSource.includes(
      "GROWTH_SOCIAL_MANAGE_CAPABILITY_V1",
    ) ||
    !callableSource.includes(
      "enforceAppCheck",
    ) ||
    !callableSource.includes(
      "UPSERT",
    ) ||
    !callableSource.includes(
      "GET_BY_ID",
    ) ||
    !callableSource.includes(
      "LIST_BY_TENANT",
    )
  ) {
    fail("SOCIAL_PROFILE_DEPLOY_CALLABLE_GUARDS_MISSING");
  }

  if (
    callableSource.includes(
      "GROWTH_SOCIAL_PUBLISH_CAPABILITY",
    ) ||
    callableSource.includes(
      "growth.social.publish",
    ) ||
    firebaseComposition.includes(
      "GROWTH_SOCIAL_PUBLISH_CAPABILITY",
    ) ||
    firebaseComposition.includes(
      "growth.social.publish",
    )
  ) {
    fail("SOCIAL_PROFILE_DEPLOY_PUBLISH_AUTHORITY_FORBIDDEN");
  }

  if (
    !firebaseComposition.includes(
      "resolveDiscoveryPrincipalV1",
    ) ||
    !firebaseComposition.includes(
      "hasGrowthSocialCapabilityV1",
    ) ||
    !firebaseComposition.includes(
      "GROWTH_SOCIAL_MANAGE_CAPABILITY_V1",
    ) ||
    !firebaseComposition.includes(
      "GROWTH_LINKEDIN_INTEGRATION_TENANT_V1",
    )
  ) {
    fail("SOCIAL_PROFILE_DEPLOY_FIREBASE_COMPOSITION_CONTRACT_MISSING");
  }

  const executionSource =
    [
      callableSource,
      firebaseComposition,
      previewWrapper,
    ].join("\n");

  if (
    /\bfetch\s*\(/.test(executionSource) ||
    /\baxios\b/.test(executionSource) ||
    /api\.linkedin\.com/i.test(executionSource) ||
    /graph\.facebook\.com/i.test(executionSource) ||
    /youtube\.googleapis\.com/i.test(executionSource)
  ) {
    fail("SOCIAL_PROFILE_DEPLOY_SOCIAL_NETWORK_EXECUTION_FORBIDDEN");
  }

  if (
    !index.includes(
      "GrowthSocialProfileManagementPreviewCallableRuntimeV1",
    ) ||
    !index.includes(
      "export const growthSocialProfileManagementV1 = growthSocialProfileManagementV1Handler",
    )
  ) {
    fail("SOCIAL_PROFILE_DEPLOY_EXPORT_MISSING");
  }

  if (
    !contract.includes(
      `"growthSocialProfileManagementV1"`,
    ) ||
    !contract.includes(
      `growthSocialProfileManagementV1: serviceAccount("preview-growth-social-rt")`,
    ) ||
    !contract.includes(
      "growthSocialProfileManagementV1: Object.freeze([])",
    ) ||
    !contract.includes(
      'growthSocialProfileManagementV1: callableOptions("growthSocialProfileManagementV1")',
    )
  ) {
    fail("SOCIAL_PROFILE_DEPLOY_RUNTIME_CONTRACT_MISSING");
  }

  if (input.requireBuilt === true) {

    const contractPath =
      path.join(
        FUNCTIONS_ROOT,
        "lib/discovery/deployment/previewDiscoveryDeploymentUnitV1.js",
      );

    const entrypointPath =
      path.join(
        FUNCTIONS_ROOT,
        "lib/previewDiscoveryIndex.js",
      );

    const wrapperPath =
      path.join(
        FUNCTIONS_ROOT,
        "lib/composition/socialProfiles/GrowthSocialProfileManagementPreviewCallableRuntimeV1.js",
      );

    if (
      !fs.existsSync(contractPath) ||
      !fs.existsSync(entrypointPath) ||
      !fs.existsSync(wrapperPath)
    ) {
      fail("SOCIAL_PROFILE_DEPLOY_BUILD_REQUIRED");
    }

    delete require.cache[
      require.resolve(contractPath)
    ];

    delete require.cache[
      require.resolve(entrypointPath)
    ];

    const runtimeContract =
      require(contractPath);

    const entrypoint =
      require(entrypointPath);

    const endpoint =
      entrypoint
        .growthSocialProfileManagementV1
        ?.__endpoint;

    if (!endpoint) {
      fail("SOCIAL_PROFILE_DEPLOY_ENDPOINT_METADATA_MISSING");
    }

    const region =
      Array.isArray(endpoint.region)
        ? endpoint.region[0]
        : endpoint.region;

    const secrets =
      endpoint.secretEnvironmentVariables || [];

    if (
      region !== "us-central1" ||
      endpoint.serviceAccountEmail !==
        SERVICE_ACCOUNT ||
      runtimeContract
        .PREVIEW_DISCOVERY_CALLABLE_OPTIONS_V1
        .growthSocialProfileManagementV1
        .enforceAppCheck !== true ||
      secrets.length !== 0
    ) {
      fail("SOCIAL_PROFILE_DEPLOY_ENDPOINT_METADATA_MISMATCH");
    }
  }

  return Object.freeze({
    status:
      "PASS",

    projectId:
      PROJECT,

    environment:
      ENVIRONMENT,

    codebase:
      CODEBASE,

    functionName:
      FUNCTION_NAME,

    deployTarget:
      DEPLOY_TARGET,

    serviceAccount:
      SERVICE_ACCOUNT,

    appCheckRequired:
      true,

    secretBindingCount:
      0,

    requiredCapability:
      "growth.social.manage",

    publishCapabilityRequired:
      false,

    deploymentExecuted:
      false,
  });

}


function argument(name) {

  const index =
    process.argv.indexOf(name);

  return index >= 0
    ? process.argv[index + 1]
    : undefined;

}


if (require.main === module) {

  try {

    const result =
      validatePreviewGrowthSocialProfileManagementDeployment({
        projectId:
          argument("--project"),

        environment:
          argument("--environment"),

        requireBuilt:
          !process.argv.includes("--source-only"),
      });

    process.stdout.write(
      `${JSON.stringify(result)}\n`,
    );

  } catch (error) {

    process.stderr.write(
      `${JSON.stringify({
        status:
          "FAILED",

        safeErrorCode:
          error instanceof Error
            ? error.message
            : "UNKNOWN_FAILURE",
      })}\n`,
    );

    process.exitCode =
      1;
  }
}


module.exports = {
  CODEBASE,
  DEPLOY_TARGET,
  ENVIRONMENT,
  FUNCTION_NAME,
  PROJECT,
  SERVICE_ACCOUNT,
  validatePreviewGrowthSocialProfileManagementDeployment,
};