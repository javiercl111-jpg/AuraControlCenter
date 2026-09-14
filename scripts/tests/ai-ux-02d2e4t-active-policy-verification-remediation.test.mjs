import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const tSource = await readFile(
  new URL(
    "../ai-ux-02d2e4t-final-live-ceremony-bridges.mjs",
    import.meta.url,
  ),
  "utf8",
);

const oSource = await readFile(
  new URL(
    "../ai-ux-02d2e4o-live-adaptive-canary-control-plane.mjs",
    import.meta.url,
  ),
  "utf8",
);

test(
  "active policy verification uses dedicated zero-write path",
  () => {
    assert.match(
      oSource,
      /async verifyActive\(expected\)/u,
    );

    assert.match(
      oSource,
      /status:\s*"ACTIVE_POLICY_VERIFIED"/u,
    );

    assert.match(
      oSource,
      /logicalMutations:\s*0/u,
    );

    assert.match(
      tSource,
      /expectedCurrentPolicyVersion\s*===\s*[\r\n\s]*candidate\.policyVersion/u,
    );

    assert.match(
      tSource,
      /await this\.#controlPlane\.verifyActive\(/u,
    );

    const verifyIndex =
      tSource.indexOf(
        "await this.#controlPlane.verifyActive(",
      );

    const dryRunIndex =
      tSource.indexOf(
        "await this.#controlPlane.dryRun(candidate)",
      );

    assert.notEqual(verifyIndex, -1);
    assert.notEqual(dryRunIndex, -1);
    assert.ok(verifyIndex < dryRunIndex);
  },
);

test(
  "mutative policy path and reuse protection remain intact",
  () => {
    assert.match(
      oSource,
      /D2E4O_CONTROL_PLANE_POLICY_REUSE_REJECTED/u,
    );

    assert.match(
      tSource,
      /await this\.#controlPlane\.dryRun\(candidate\)/u,
    );

    assert.match(
      tSource,
      /await this\.#controlPlane\.apply\(dryRun\)/u,
    );
  },
);
