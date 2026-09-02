"use strict";

const fs =
  require("node:fs");

const path =
  require("node:path");

const assert =
  require("node:assert/strict");

const {
  test,
} =
  require("node:test");


const ROOT =
  path.resolve(
    __dirname,
    "../..",
  );


function resolve(relativePath) {
  return path.join(
    ROOT,
    relativePath,
  );
}


function read(relativePath) {
  return fs.readFileSync(
    resolve(relativePath),
    "utf8",
  );
}


function json(relativePath) {
  return JSON.parse(
    read(relativePath),
  );
}


test(
  "existing Preview Firebase packaging remains unchanged",
  () => {

    const firebase =
      json("firebase.json");

    const functionsPackage =
      json("functions/package.json");

    assert.equal(
      Array.isArray(firebase.functions),
      false,
      "PREVIEW_FIREBASE_FUNCTIONS_SHAPE_CHANGED",
    );

    assert.equal(
      firebase.functions.source,
      "functions",
      "PREVIEW_FIREBASE_SOURCE_CHANGED",
    );

    assert.equal(
      firebase.functions.codebase,
      "preview-discovery",
      "PREVIEW_FIREBASE_CODEBASE_CHANGED",
    );

    assert.equal(
      firebase.functions.runtime,
      "nodejs20",
      "PREVIEW_FIREBASE_RUNTIME_CHANGED",
    );

    assert.equal(
      functionsPackage.main,
      "lib/previewDiscoveryIndex.js",
      "PREVIEW_PACKAGE_MAIN_CHANGED",
    );
  },
);


test(
  "Production uses a dedicated Firebase config and codebase",
  () => {

    const configPath =
      "firebase.production-growth-linkedin.json";

    assert.equal(
      fs.existsSync(
        resolve(configPath),
      ),
      true,
      "PRODUCTION_FIREBASE_CONFIG_MISSING",
    );

    const firebase =
      json(configPath);

    assert.equal(
      Array.isArray(firebase.functions),
      false,
      "PRODUCTION_FIREBASE_FUNCTIONS_SHAPE_INVALID",
    );

    assert.equal(
      firebase.functions.source,
      "functions/.generated/production-growth-linkedin",
      "PRODUCTION_FIREBASE_SOURCE_NOT_ISOLATED",
    );

    assert.equal(
      firebase.functions.codebase,
      "production-growth-linkedin",
      "PRODUCTION_FIREBASE_CODEBASE_INVALID",
    );

    assert.equal(
      firebase.functions.runtime,
      "nodejs20",
      "PRODUCTION_FIREBASE_RUNTIME_INVALID",
    );
  },
);


test(
  "Production has a minimal dedicated Functions entrypoint",
  () => {

    const entrypointPath =
      "functions/src/productionGrowthLinkedInIndex.ts";

    assert.equal(
      fs.existsSync(
        resolve(entrypointPath),
      ),
      true,
      "PRODUCTION_MINIMAL_ENTRYPOINT_MISSING",
    );

    const source =
      read(entrypointPath);

    assert.match(
      source,
      /GrowthLinkedInProductionCallableRuntimeV1/u,
      "PRODUCTION_ENTRYPOINT_WRAPPER_MISSING",
    );

    assert.match(
      source,
      /growthLinkedInRuntimeReadinessV1/u,
      "PRODUCTION_ENTRYPOINT_EXPORT_MISSING",
    );

    assert.doesNotMatch(
      source,
      /GrowthLinkedInPreviewCallableRuntimeV1|previewDiscoveryIndex|PREVIEW_DISCOVERY/u,
      "PRODUCTION_ENTRYPOINT_PREVIEW_CONTAMINATION",
    );

    const exportMatches =
      source.match(
        /export\s+\{/gu,
      ) ?? [];

    assert.equal(
      exportMatches.length,
      1,
      "PRODUCTION_ENTRYPOINT_NOT_MINIMAL",
    );
  },
);


test(
  "Production staging is generated without mutating Preview package authority",
  () => {

    const stagePath =
      "scripts/stage-production-growth-linkedin-functions.cjs";

    assert.equal(
      fs.existsSync(
        resolve(stagePath),
      ),
      true,
      "PRODUCTION_STAGING_SCRIPT_MISSING",
    );

    const source =
      read(stagePath);

    assert.match(
      source,
      /functions\/\.generated\/production-growth-linkedin/u,
      "PRODUCTION_STAGING_DIRECTORY_NOT_EXACT",
    );

    assert.match(
      source,
      /productionGrowthLinkedInIndex\.js/u,
      "PRODUCTION_STAGED_MAIN_NOT_EXACT",
    );

    assert.match(
      source,
      /cpSync|copyFileSync/u,
      "PRODUCTION_STAGING_COPY_CONTRACT_MISSING",
    );

    assert.doesNotMatch(
      source,
      /lib\/previewDiscoveryIndex\.js/u,
      "PRODUCTION_STAGING_PREVIEW_ENTRYPOINT_FORBIDDEN",
    );

    assert.doesNotMatch(
      source,
      /writeFileSync\([^)]*functions\/package\.json/u,
      "PRODUCTION_STAGING_MUTATES_PREVIEW_PACKAGE",
    );
  },
);


test(
  "Production deployment has an independent safety guard",
  () => {

    const guardPath =
      "scripts/production-growth-linkedin-deployment-guard.cjs";

    assert.equal(
      fs.existsSync(
        resolve(guardPath),
      ),
      true,
      "PRODUCTION_DEPLOYMENT_GUARD_MISSING",
    );

    const source =
      read(guardPath);

    for (
      const marker of
      [
        "aura-control-center-debb3",
        "production-growth-linkedin",
        "growthLinkedInRuntimeReadinessV1",
        "production-growth-linkedin-rt@aura-control-center-debb3.iam.gserviceaccount.com",
        "GROWTH_LINKEDIN_ACCESS_TOKEN",
        "enforceAppCheck",
        "PRODUCTION",
      ]
    ) {
      assert.equal(
        source.includes(marker),
        true,
        `PRODUCTION_GUARD_MARKER_MISSING:${marker}`,
      );
    }

    assert.doesNotMatch(
      source,
      /firebase\s+deploy/u,
      "PRODUCTION_GUARD_MUST_NOT_DEPLOY",
    );
  },
);


test(
  "Functions package exposes exact isolated Production stage guard and selective deploy",
  () => {

    const pkg =
      json("functions/package.json");

    assert.equal(
      pkg.scripts?.["build:production-growth-linkedin"],
      "npm run prebuild && tsc -p tsconfig.production-growth-linkedin.json",
      "PRODUCTION_DEDICATED_BUILD_SCRIPT_NOT_EXACT",
    );
    assert.equal(
      pkg.scripts?.["stage:production-growth-linkedin"],
      "node ../scripts/stage-production-growth-linkedin-functions.cjs",
      "PRODUCTION_STAGE_SCRIPT_NOT_EXACT",
    );

    assert.equal(
      pkg.scripts?.["guard:production-growth-linkedin"],
      "node ../scripts/production-growth-linkedin-deployment-guard.cjs --project aura-control-center-debb3 --environment PRODUCTION",
      "PRODUCTION_GUARD_SCRIPT_NOT_EXACT",
    );

    assert.equal(
      pkg.scripts?.["deploy:production-growth-linkedin"],
      "npm run build:production-growth-linkedin && npm run stage:production-growth-linkedin && npm run guard:production-growth-linkedin && firebase deploy --config ../firebase.production-growth-linkedin.json --project aura-control-center-debb3 --only functions:production-growth-linkedin:growthLinkedInRuntimeReadinessV1 --non-interactive",
      "PRODUCTION_SELECTIVE_DEPLOY_SCRIPT_NOT_EXACT",
    );

    assert.equal(
      pkg.scripts[
        "deploy:production-growth-linkedin"
      ]?.includes("--force"),
      false,
      "PRODUCTION_DEPLOY_FORCE_FORBIDDEN",
    );

    assert.equal(
      pkg.main,
      "lib/previewDiscoveryIndex.js",
      "PREVIEW_PACKAGE_MAIN_MUST_REMAIN_UNCHANGED",
    );
  },
);

test(
  "Production compilation is isolated to the dedicated entrypoint closure",
  () => {

    const tsconfigPath =
      "functions/tsconfig.production-growth-linkedin.json";

    assert.equal(
      fs.existsSync(
        resolve(tsconfigPath),
      ),
      true,
      "PRODUCTION_TS_CONFIG_MISSING",
    );

    const tsconfig =
      json(tsconfigPath);

    assert.equal(
      tsconfig.extends,
      "./tsconfig.json",
      "PRODUCTION_TS_CONFIG_EXTENDS_INVALID",
    );

    assert.equal(
      tsconfig.compilerOptions?.rootDir,
      "src",
      "PRODUCTION_TS_ROOT_DIR_INVALID",
    );

    assert.equal(
      tsconfig.compilerOptions?.outDir,
      ".generated/production-growth-linkedin/lib",
      "PRODUCTION_TS_OUT_DIR_NOT_ISOLATED",
    );

    assert.deepEqual(
      tsconfig.files,
      [
        "src/productionGrowthLinkedInIndex.ts",
      ],
      "PRODUCTION_TS_FILES_NOT_MINIMAL",
    );

    assert.deepEqual(
      tsconfig.include,
      [],
      "PRODUCTION_TS_INCLUDE_MUST_BE_EMPTY",
    );

    const stageSource =
      read(
        "scripts/stage-production-growth-linkedin-functions.cjs",
      );

    assert.equal(
      stageSource.includes(
        "const compiledSource =",
      ),
      false,
      "PRODUCTION_STAGE_FULL_LIB_SOURCE_FORBIDDEN",
    );

    assert.equal(
      (
        stageSource.includes(
          "compiledSource",
        ) &&
        stageSource.includes(
          "GENERATED_LIB",
        )
      ),
      false,
      "PRODUCTION_STAGE_FULL_LIB_RECURSIVE_COPY_FORBIDDEN",
    );

    assert.match(
      stageSource,
      /productionGrowthLinkedInIndex\.js/u,
      "PRODUCTION_STAGE_ENTRYPOINT_VALIDATION_MISSING",
    );
  },
);