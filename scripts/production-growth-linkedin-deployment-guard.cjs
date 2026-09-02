"use strict";

const fs =
  require("node:fs");

const path =
  require("node:path");


const ROOT =
  path.resolve(
    __dirname,
    "..",
  );

const PROJECT =
  "aura-control-center-debb3";

const ENVIRONMENT =
  "PRODUCTION";

const CODEBASE =
  "production-growth-linkedin";

const FUNCTION_NAME =
  "growthLinkedInRuntimeReadinessV1";

const SERVICE_ACCOUNT =
  "production-growth-linkedin-rt@aura-control-center-debb3.iam.gserviceaccount.com";

const SECRET_NAME =
  "GROWTH_LINKEDIN_ACCESS_TOKEN";

const GENERATED_SOURCE =
  "functions/.generated/production-growth-linkedin";

const PRODUCTION_MAIN =
  "lib/productionGrowthLinkedInIndex.js";


function fail(code) {
  throw new Error(code);
}


function read(relativePath) {
  return fs.readFileSync(
    path.join(
      ROOT,
      relativePath,
    ),
    "utf8",
  );
}


function json(relativePath) {
  return JSON.parse(
    read(relativePath),
  );
}


function argument(name) {
  const index =
    process.argv.indexOf(name);

  return index >= 0
    ? process.argv[index + 1]
    : undefined;
}


function validateProductionGrowthLinkedInDeployment(
  input,
) {

  if (input.projectId !== PROJECT) {
    fail(
      "PRODUCTION_GROWTH_LINKEDIN_PROJECT_MISMATCH",
    );
  }

  if (input.environment !== ENVIRONMENT) {
    fail(
      "PRODUCTION_GROWTH_LINKEDIN_ENVIRONMENT_MISMATCH",
    );
  }

  const previewFirebase =
    json("firebase.json");

  const previewPackage =
    json("functions/package.json");

  if (
    previewFirebase.functions?.source !==
      "functions" ||
    previewFirebase.functions?.codebase !==
      "preview-discovery" ||
    previewFirebase.functions?.runtime !==
      "nodejs20" ||
    previewPackage.main !==
      "lib/previewDiscoveryIndex.js"
  ) {
    fail(
      "PREVIEW_PACKAGING_AUTHORITY_CHANGED",
    );
  }

  const productionFirebase =
    json(
      "firebase.production-growth-linkedin.json",
    );

  if (
    productionFirebase.functions?.source !==
      GENERATED_SOURCE ||
    productionFirebase.functions?.codebase !==
      CODEBASE ||
    productionFirebase.functions?.runtime !==
      "nodejs20"
  ) {
    fail(
      "PRODUCTION_FIREBASE_PACKAGING_MISMATCH",
    );
  }

  const deploymentUnit =
    read(
      "functions/src/growth/deployment/productionGrowthLinkedInDeploymentUnitV1.ts",
    );

  const productionWrapper =
    read(
      "functions/src/composition/linkedin/GrowthLinkedInProductionCallableRuntimeV1.ts",
    );

  const sharedCallable =
    read(
      "functions/src/composition/linkedin/GrowthLinkedInCallableRuntimeV1.ts",
    );

  for (
    const marker of
    [
      PROJECT,
      CODEBASE,
      SERVICE_ACCOUNT,
      SECRET_NAME,
      "enforceAppCheck",
      ENVIRONMENT,
    ]
  ) {
    if (
      !deploymentUnit.includes(marker) &&
      !productionWrapper.includes(marker)
    ) {
      fail(
        `PRODUCTION_GUARD_MARKER_MISSING:${marker}`,
      );
    }
  }

  if (
    !productionWrapper.includes(
      "export const growthLinkedInRuntimeReadinessV1 =",
    ) ||
    !productionWrapper.includes(
      "createGrowthLinkedInRuntimeReadinessV1",
    )
  ) {
    fail(
      "PRODUCTION_CALLABLE_EXPORT_BINDING_MISSING",
    );
  }

  if (
    !sharedCallable.includes(
      "createGrowthLinkedInRuntimeReadinessV1",
    ) ||
    !sharedCallable.includes(
      "DECLARED_NOT_READ",
    ) ||
    !sharedCallable.includes(
      "NOT_EXECUTED",
    )
  ) {
    fail(
      "PRODUCTION_READINESS_CONTRACT_MISSING",
    );
  }

  if (
    sharedCallable.includes(".acquire(") ||
    sharedCallable.includes(".value()") ||
    sharedCallable.includes("fetch(") ||
    sharedCallable.includes("api.linkedin.com")
  ) {
    fail(
      "PRODUCTION_NETWORK_OR_SECRET_READ_FORBIDDEN",
    );
  }

  const stagedPackagePath =
    path.join(
      ROOT,
      GENERATED_SOURCE,
      "package.json",
    );

  const stagedEntrypointPath =
    path.join(
      ROOT,
      GENERATED_SOURCE,
      PRODUCTION_MAIN,
    );

  if (
    !fs.existsSync(stagedPackagePath) ||
    !fs.existsSync(stagedEntrypointPath)
  ) {
    fail(
      "PRODUCTION_STAGED_PACKAGE_REQUIRED",
    );
  }

  const stagedLibRoot =
    path.join(
      ROOT,
      GENERATED_SOURCE,
      "lib",
    );

  const stagedLibFiles =
    [];

  function collectStagedFiles(
    directory,
  ) {

    for (
      const entry of
      fs.readdirSync(
        directory,
        {
          withFileTypes:
            true,
        },
      )
    ) {

      const absolute =
        path.join(
          directory,
          entry.name,
        );

      if (
        entry.isDirectory()
      ) {
        collectStagedFiles(
          absolute,
        );

        continue;
      }

      if (
        entry.isFile()
      ) {
        stagedLibFiles.push(
          absolute,
        );
      }
    }
  }

  collectStagedFiles(
    stagedLibRoot,
  );

  for (
    const stagedFile of
    stagedLibFiles
  ) {

    const relative =
      path.relative(
        stagedLibRoot,
        stagedFile,
      ).replaceAll(
        "\\",
        "/",
      );

    if (
      relative.includes(
        "previewDiscoveryIndex",
      ) ||
      relative.includes(
        "GrowthLinkedInPreviewCallableRuntimeV1",
      )
    ) {
      fail(
        "PRODUCTION_STAGED_CLOSURE_PREVIEW_CONTAMINATION",
      );
    }
  }
  const stagedPackage =
    JSON.parse(
      fs.readFileSync(
        stagedPackagePath,
        "utf8",
      ),
    );

  if (
    stagedPackage.main !==
      PRODUCTION_MAIN
  ) {
    fail(
      "PRODUCTION_STAGED_MAIN_MISMATCH",
    );
  }

  const stagedEntrypoint =
    fs.readFileSync(
      stagedEntrypointPath,
      "utf8",
    );

  if (
    !stagedEntrypoint.includes(
      "GrowthLinkedInProductionCallableRuntimeV1",
    ) ||
    stagedEntrypoint.includes(
      "GrowthLinkedInPreviewCallableRuntimeV1",
    ) ||
    stagedEntrypoint.includes(
      "previewDiscoveryIndex",
    )
  ) {
    fail(
      "PRODUCTION_STAGED_ENTRYPOINT_CONTAMINATION",
    );
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
    serviceAccount:
      SERVICE_ACCOUNT,
    secretName:
      SECRET_NAME,
    enforceAppCheck:
      true,
    deploymentExecuted:
      false,
  });
}


if (require.main === module) {
  try {
    const result =
      validateProductionGrowthLinkedInDeployment({
        projectId:
          argument("--project"),
        environment:
          argument("--environment"),
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
  ENVIRONMENT,
  FUNCTION_NAME,
  PROJECT,
  SECRET_NAME,
  SERVICE_ACCOUNT,
  validateProductionGrowthLinkedInDeployment,
};