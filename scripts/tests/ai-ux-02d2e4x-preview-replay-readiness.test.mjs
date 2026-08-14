import test from "node:test";
import assert from "node:assert/strict";

import {
  CertifiedPreviewSingleTurnReplayReadinessV1,
} from "../ai-ux-02d2e4x-preview-replay-readiness.mjs";

const BINDING = Object.freeze({
  environment: "PREVIEW",

  authoritativeTenantId:
    `tenant-${"ab".repeat(32)}`,

  syntheticFixtureLocator:
    "SYNTHETIC_FIXTURE_V1_8E5D766A3132FF687116E522304115BE",

  linkId:
    "ai-ux-02d3-preview-synthetic-discovery-link-v1",

  sessionId:
    "ai-ux-02d3-preview-synthetic-discovery-session-v1",

  turnId:
    "AI_UX_02D2E4_FINAL_TURN_0001",
});

function repository() {
  return new CertifiedPreviewSingleTurnReplayReadinessV1({
    expectedBinding: BINDING,
  });
}

test(
  "exact certified Preview single-turn binding is READY",
  async () => {
    const result =
      await repository().readReadiness({
        environment: "PREVIEW",
        binding: BINDING,
      });

    assert.equal(result.status, "READY");
    assert.equal(
      result.readinessBasis,
      "CERTIFIED_SINGLE_TURN_BINDING",
    );
    assert.equal(
      result.replayPersistenceClaimed,
      false,
    );
    assert.equal(
      result.externalReplayArtifactAccepted,
      false,
    );
  },
);

for (const [name, mutate] of [
  [
    "environment",
    (binding) => ({
      ...binding,
      environment: "PRODUCTION",
    }),
  ],
  [
    "tenant",
    (binding) => ({
      ...binding,
      authoritativeTenantId:
        "tenant-different",
    }),
  ],
  [
    "fixture",
    (binding) => ({
      ...binding,
      syntheticFixtureLocator:
        "SYNTHETIC_FIXTURE_V1_DIFFERENT",
    }),
  ],
  [
    "link",
    (binding) => ({
      ...binding,
      linkId: "different-link",
    }),
  ],
  [
    "session",
    (binding) => ({
      ...binding,
      sessionId: "different-session",
    }),
  ],
  [
    "turn",
    (binding) => ({
      ...binding,
      turnId: "different-turn",
    }),
  ],
]) {
  test(`fails closed on ${name} mismatch`, async () => {
    const result =
      await repository().readReadiness({
        environment: "PREVIEW",
        binding: mutate(BINDING),
      });

    assert.deepEqual(
      result,
      { status: "BLOCKED" },
    );
  });
}

test(
  "fails closed when outer environment is not Preview",
  async () => {
    const result =
      await repository().readReadiness({
        environment: "PRODUCTION",
        binding: BINDING,
      });

    assert.deepEqual(
      result,
      { status: "BLOCKED" },
    );
  },
);
