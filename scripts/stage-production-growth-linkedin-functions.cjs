"use strict";

const fs =
  require("node:fs");

const path =
  require("node:path");

const childProcess =
  require("node:child_process");


const ROOT =
  path.resolve(
    __dirname,
    "..",
  );

const FUNCTIONS_ROOT =
  path.join(
    ROOT,
    "functions",
  );

const GENERATED_RELATIVE =
  "functions/.generated/production-growth-linkedin";

const GENERATED_ROOT =
  path.join(
    ROOT,
    ...GENERATED_RELATIVE.split("/"),
  );

const GENERATED_LIB =
  path.join(
    GENERATED_ROOT,
    "lib",
  );

const PRODUCTION_MAIN =
  "lib/productionGrowthLinkedInIndex.js";

const PRODUCTION_TS_CONFIG =
  path.join(
    FUNCTIONS_ROOT,
    "tsconfig.production-growth-linkedin.json",
  );

const TYPESCRIPT_COMPILER =
  path.join(
    FUNCTIONS_ROOT,
    "node_modules",
    "typescript",
    "bin",
    "tsc",
  );


function fail(code) {
  throw new Error(code);
}


function copyIfPresent(
  source,
  destination,
) {
  if (!fs.existsSync(source)) {
    return false;
  }

  fs.cpSync(
    source,
    destination,
    {
      recursive: true,
    },
  );

  return true;
}


function listFiles(root) {

  if (!fs.existsSync(root)) {
    return [];
  }

  const output =
    [];

  for (
    const entry of
    fs.readdirSync(
      root,
      {
        withFileTypes:
          true,
      },
    )
  ) {

    const absolute =
      path.join(
        root,
        entry.name,
      );

    if (entry.isDirectory()) {
      output.push(
        ...listFiles(
          absolute,
        ),
      );

      continue;
    }

    if (entry.isFile()) {
      output.push(
        absolute,
      );
    }
  }

  return output;
}


function compileDedicatedClosure() {

  if (
    !fs.existsSync(
      PRODUCTION_TS_CONFIG,
    )
  ) {
    fail(
      "PRODUCTION_TS_CONFIG_REQUIRED",
    );
  }

  if (
    !fs.existsSync(
      TYPESCRIPT_COMPILER,
    )
  ) {
    fail(
      "PRODUCTION_TYPESCRIPT_COMPILER_REQUIRED",
    );
  }

  fs.rmSync(
    GENERATED_ROOT,
    {
      recursive:
        true,
      force:
        true,
    },
  );

  fs.mkdirSync(
    GENERATED_ROOT,
    {
      recursive:
        true,
    },
  );

  try {
    childProcess.execFileSync(
      process.execPath,
      [
        TYPESCRIPT_COMPILER,
        "-p",
        PRODUCTION_TS_CONFIG,
      ],
      {
        cwd:
          FUNCTIONS_ROOT,
        stdio:
          "inherit",
      },
    );
  } catch {
    fail(
      "PRODUCTION_DEDICATED_TYPESCRIPT_COMPILE_FAILED",
    );
  }
}


function assertDedicatedClosure() {

  const compiledEntrypoint =
    path.join(
      GENERATED_LIB,
      "productionGrowthLinkedInIndex.js",
    );

  if (
    !fs.existsSync(
      compiledEntrypoint,
    )
  ) {
    fail(
      "PRODUCTION_COMPILED_ENTRYPOINT_MISSING",
    );
  }

  const generatedFiles =
    listFiles(
      GENERATED_LIB,
    );

  const forbiddenFragments =
    [
      "previewDiscoveryIndex",
      "GrowthLinkedInPreviewCallableRuntimeV1",
    ];

  for (
    const filePath of
    generatedFiles
  ) {

    const relative =
      path.relative(
        GENERATED_LIB,
        filePath,
      ).replaceAll(
        "\\",
        "/",
      );

    for (
      const forbidden of
      forbiddenFragments
    ) {
      if (
        relative.includes(
          forbidden,
        )
      ) {
        fail(
          `PRODUCTION_COMPILED_CLOSURE_CONTAMINATION:${forbidden}`,
        );
      }
    }
  }

  return Object.freeze({
    compiledEntrypoint,
    generatedFileCount:
      generatedFiles.length,
  });
}


function stageProductionGrowthLinkedIn() {

  compileDedicatedClosure();

  const closure =
    assertDedicatedClosure();

  const sourcePackagePath =
    path.join(
      FUNCTIONS_ROOT,
      "package.json",
    );

  const sourcePackage =
    JSON.parse(
      fs.readFileSync(
        sourcePackagePath,
        "utf8",
      ),
    );

  const stagedPackage =
    {
      ...sourcePackage,
      main:
        PRODUCTION_MAIN,
    };

  fs.writeFileSync(
    path.join(
      GENERATED_ROOT,
      "package.json",
    ),
    `${JSON.stringify(
      stagedPackage,
      null,
      2,
    )}\n`,
    "utf8",
  );

  fs.writeFileSync(
    path.join(
      GENERATED_ROOT,
      ".env.aura-control-center-debb3",
    ),
    "AURA_RUNTIME_ENVIRONMENT=PRODUCTION\n",
    "utf8",
  );

  const lockSource =
    path.join(
      FUNCTIONS_ROOT,
      "package-lock.json",
    );

  if (
    fs.existsSync(
      lockSource,
    )
  ) {
    fs.copyFileSync(
      lockSource,
      path.join(
        GENERATED_ROOT,
        "package-lock.json",
      ),
    );
  }

  const dependencyGroups =
    [
      sourcePackage.dependencies ?? {},
      sourcePackage.optionalDependencies ?? {},
    ];

  for (
    const group of
    dependencyGroups
  ) {

    for (
      const [
        dependencyName,
        dependencyValue,
      ]
      of Object.entries(
        group,
      )
    ) {

      if (
        typeof dependencyValue !== "string" ||
        !dependencyValue.startsWith(
          "file:",
        )
      ) {
        continue;
      }

      const localRelative =
        dependencyValue.slice(
          "file:".length,
        );

      const localSource =
        path.resolve(
          FUNCTIONS_ROOT,
          localRelative,
        );

      const functionsBoundary =
        `${FUNCTIONS_ROOT}${path.sep}`;

      if (
        localSource !==
          FUNCTIONS_ROOT &&
        !localSource.startsWith(
          functionsBoundary,
        )
      ) {
        fail(
          `PRODUCTION_LOCAL_DEPENDENCY_OUTSIDE_FUNCTIONS:${dependencyName}`,
        );
      }

      const relativeInsideFunctions =
        path.relative(
          FUNCTIONS_ROOT,
          localSource,
        );

      const localDestination =
        path.join(
          GENERATED_ROOT,
          relativeInsideFunctions,
        );

      if (
        !copyIfPresent(
          localSource,
          localDestination,
        )
      ) {
        fail(
          `PRODUCTION_LOCAL_DEPENDENCY_MISSING:${dependencyName}`,
        );
      }
    }
  }

  process.stdout.write(
    `${JSON.stringify({
      status:
        "PASS",
      generatedRoot:
        GENERATED_RELATIVE,
      main:
        PRODUCTION_MAIN,
      generatedFileCount:
        closure.generatedFileCount,
      deploymentExecuted:
        false,
    })}\n`,
  );
}


if (require.main === module) {
  try {
    stageProductionGrowthLinkedIn();
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
  GENERATED_RELATIVE,
  PRODUCTION_MAIN,
  stageProductionGrowthLinkedIn,
};