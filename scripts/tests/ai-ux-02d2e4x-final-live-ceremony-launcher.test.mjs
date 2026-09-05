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