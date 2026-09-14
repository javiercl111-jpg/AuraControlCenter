import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const launcherUrl =
  new URL("../ai-ux-02d2e4x-final-live-ceremony-launcher.mjs", import.meta.url);

test("final live launcher owns custody across deploy alias and D2E4J", async () => {
  const source =
    await readFile(launcherUrl, "utf8");

  assert.match(
    source,
    /browserProofCustody\s*\?\?\s*createBrowserProofCustodyV1\(\)/u,
  );

  assert.match(
    source,
    /proofCustody\.deriveDigest\(\)/u,
  );

  assert.match(
    source,
    /await livePreviewAdapter\.deployOnce\(\)/u,
  );

  assert.match(
    source,
    /"alias",\s*"set"/u,
  );

  assert.match(
    source,
    /deploymentId:\s*deployment\.deploymentId/u,
  );

  assert.match(
    source,
    /deploymentUrl:\s*deployment\.previewUrl/u,
  );

  assert.match(
    source,
    /previewUrl:\s*DISC_INT_03_CANONICAL_PREVIEW_URL/u,
  );

  assert.match(
    source,
    /browserProofCustody:\s*proofCustody/u,
  );

  assert.match(
    source,
    /finally\s*\{[\s\S]*proofCustody\.destroy\(\)/u,
  );

  assert.doesNotMatch(
    source,
    /DISC_INT_03_PREVIEW_TARGET/u,
  );
});
// DISC-INT-03Q-R33-A7 POLICY VERSION REMEDIATION CONTRACT
const { test: r33PolicyVersionTest } = await import("node:test");
const r33PolicyAssert = (await import("node:assert/strict")).default;
const { readFile: r33ReadFile } = await import("node:fs/promises");
const { dirname: r33Dirname, resolve: r33Resolve } = await import("node:path");
const { fileURLToPath: r33FileURLToPath } = await import("node:url");

r33PolicyVersionTest("launcher binds rotating canary policy before deploy", async () => {
  const testDir = r33Dirname(r33FileURLToPath(import.meta.url));
  const launcherSource = await r33ReadFile(
    r33Resolve(testDir, "../ai-ux-02d2e4x-final-live-ceremony-launcher.mjs"),
    "utf8",
  );

  r33PolicyAssert.doesNotMatch(
    launcherSource,
    /const POLICY_VERSION\s*=/u,
  );

  r33PolicyAssert.doesNotMatch(
    launcherSource,
    /AI_UX_02D3_PREVIEW_CANARY_20260813_V4/u,
  );

  r33PolicyAssert.match(
    launcherSource,
    /explicitPolicyVersion \?\? environment\?\.AURA_DISCOVERY_CANARY_POLICY_VERSION/u,
  );

  r33PolicyAssert.match(
    launcherSource,
    /typeof resolvedPolicyVersion !== "string"/u,
  );

  r33PolicyAssert.match(
    launcherSource,
    /resolvedPolicyVersion\.length === 0/u,
  );

  r33PolicyAssert.match(
    launcherSource,
    /resolvedPolicyVersion !== resolvedPolicyVersion\.trim\(\)/u,
  );

  r33PolicyAssert.match(
    launcherSource,
    /!SAFE_ID\.test\(resolvedPolicyVersion\)/u,
  );

  r33PolicyAssert.match(
    launcherSource,
    /policyVersion:\s*resolvedPolicyVersion/u,
  );

  r33PolicyAssert.match(
    launcherSource,
    /await runFinalLiveCeremonyLauncherV1\(\);/u,
  );

  const validationIndex = launcherSource.indexOf(
    "resolveDiscoveryCanaryPolicyVersionV1(policyVersion)",
  );

  const deployIndex = launcherSource.indexOf(
    "await livePreviewAdapter.deployOnce()",
  );

  r33PolicyAssert.notEqual(validationIndex, -1);
  r33PolicyAssert.notEqual(deployIndex, -1);
  r33PolicyAssert.ok(validationIndex < deployIndex);
});

import { test as c104Test } from "node:test";
import * as c104Assert from "node:assert/strict";
import * as c104Fs from "node:fs";

c104Test(
  "C104 post-deploy preparation runs before alias and D2E4J composition",
  () => {
    const source =
      c104Fs.readFileSync(
        new URL(
          "../ai-ux-02d2e4x-final-live-ceremony-launcher.mjs",
          import.meta.url,
        ),
        "utf8",
      );

    const deploy =
      source.indexOf(
        "await livePreviewAdapter.deployOnce();",
      );

    const preparation =
      source.indexOf(
        "await postDeployRuntimePreparation(",
      );

    const alias =
      source.indexOf(
        '"alias"',
        deploy,
      );

    const composition =
      source.indexOf(
        "handle = await createOperationalD2E4JPreviewCeremonyCompositionV1({",
        deploy,
      );

    c104Assert.ok(
      deploy >= 0,
    );

    c104Assert.ok(
      preparation > deploy,
    );

    c104Assert.ok(
      alias > preparation,
    );

    c104Assert.ok(
      composition > preparation,
    );

    c104Assert.match(
      source,
      /typeof postDeployRuntimePreparation !== "function"/u,
    );

    c104Assert.match(
      source,
      /D2E4X_RUNTIME_PREPARATION_REJECTED/u,
    );
  },
);
import { readFile as c110r12bIdentityReadFile } from "node:fs/promises";
import { test as c110r12bIdentityTest } from "node:test";
import c110r12bIdentityAssert from "node:assert/strict";

c110r12bIdentityTest("C110-R12B project identity semantics", async () => {
  const source = await c110r12bIdentityReadFile(
    new URL(
      "../ai-ux-02d2e4x-final-live-ceremony-launcher.mjs",
      import.meta.url,
    ),
    "utf8",
  );

  c110r12bIdentityAssert.match(
    source,
    /const DISC_INT_03_PROJECT_NAME =\s*"aura-control-center-preview";/u,
  );

  c110r12bIdentityAssert.match(
    source,
    /const DISC_INT_03_VERCEL_PROJECT_ID =\s*"prj_oFCa4FIUHNGyIn5JH7QMDWoDGhp0";/u,
  );

  c110r12bIdentityAssert.match(
    source,
    /projectName:\s*DISC_INT_03_PROJECT_NAME,/u,
  );

  c110r12bIdentityAssert.match(
    source,
    /projectId:\s*DISC_INT_03_VERCEL_PROJECT_ID,/u,
  );

  c110r12bIdentityAssert.doesNotMatch(
    source,
    /\bDISC_INT_03_PROJECT_ID\b/u,
  );
});
c110r12bIdentityTest("C110-R12C dual project identity previewTarget semantics", async () => {
  const source = await c110r12bIdentityReadFile(
    new URL(
      "../ai-ux-02d2e4x-final-live-ceremony-launcher.mjs",
      import.meta.url,
    ),
    "utf8",
  );

  c110r12bIdentityAssert.match(
    source,
    /const previewTarget =\s*Object\.freeze\(\{[\s\S]*?projectName:\s*DISC_INT_03_PROJECT_NAME,[\s\S]*?projectId:\s*DISC_INT_03_VERCEL_PROJECT_ID,/u,
  );
});
