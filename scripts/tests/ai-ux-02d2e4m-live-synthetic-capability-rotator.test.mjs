import test from "node:test";
import assert from "node:assert/strict";

import {
  LiveSyntheticCapabilityRotatorV1,
  D2E4MRotatorError,
} from "../ai-ux-02d2e4m-live-synthetic-capability-rotator.mjs";

const NOW = 1_800_000_000_000;
const TOKEN = "c".repeat(64);
const TRACE = "trace-d2e4m-rotator-test";

const authority = Object.freeze({
  linkId: "link",
  sessionId: "session",
});

function setup(overrides = {}) {
  const events = [];

  const expectation = Object.freeze({
    capabilityLocator: "a".repeat(64),
    expectedTokenHash: "a".repeat(64),
    expectedCapabilityVersion: "DISCOVERY_CAPABILITY_V1",
    expectedUpdatedAt: NOW - 10_000,
    expectedExpiresAt: NOW - 1,
    expectedRotationVersion: 0,
  });

  const rotationRepository = {
    async inspectExpired(received, now, context) {
      events.push("inspectExpired");
      assert.equal(received, authority);
      assert.equal(now, NOW);
      assert.deepEqual(context, { traceId: TRACE });
      return expectation;
    },

    async rotateExpired(input) {
      events.push("rotateExpired");

      assert.equal(input.expectation, expectation);
      assert.equal(input.now, NOW);
      assert.equal(input.traceId, TRACE);
      assert.match(input.nextTokenHash, /^[a-f0-9]{64}$/u);

      return Object.freeze({
        status: "ROTATED",
        generation: 2,
        expiresAt: NOW + 5 * 60 * 1_000,
      });
    },
  };

  const consumerBoundary = {
    async assertReady(received, now, context) {
      events.push("consumerReady");
      assert.equal(received, authority);
      assert.equal(now, NOW);
      assert.deepEqual(context, { traceId: TRACE });
    },
  };

  const rotationAuthority = {
    async revalidate(input) {
      events.push("rotationAuthority");
      assert.equal(input.authority, authority);
      assert.equal(input.traceId, TRACE);
    },
  };

  const canaryRevalidation = {
    async revalidate(input) {
      events.push("canary");
      assert.equal(input.authority, authority);
      assert.equal(input.traceId, TRACE);
    },
  };

  return {
    events,
    rotator: new LiveSyntheticCapabilityRotatorV1(
      authority,
      overrides.rotationRepository ?? rotationRepository,
      overrides.consumerBoundary ?? consumerBoundary,
      overrides.rotationAuthority ?? rotationAuthority,
      overrides.canaryRevalidation ?? canaryRevalidation,
      () => NOW,
      overrides.tokenFactory ?? (() => TOKEN),
      TRACE,
    ),
  };
}

test("rotates expired capability exactly once and returns non-enumerable bearer", async () => {
  const { rotator, events } = setup();

  const result = await rotator.issueAndRotate({
    operationId: "AI_UX_OPERATION_0001",
    changeId: "AI_UX_CHANGE_0001",
    policyVersion: "AI_UX_POLICY_0001",
  });

  assert.deepEqual(events, [
    "inspectExpired",
    "consumerReady",
    "rotationAuthority",
    "canary",
    "rotateExpired",
  ]);

  assert.equal(result.generation, 2);

  const descriptor =
    Object.getOwnPropertyDescriptor(result, "bearerToken");

  assert.ok(descriptor);
  assert.equal(descriptor.enumerable, false);
  assert.equal(descriptor.value, TOKEN);

  assert.equal(JSON.stringify(result).includes(TOKEN), false);
});

test("rejects invalid bearer before rotateExpired", async () => {
  const { rotator, events } = setup({
    tokenFactory: () => "invalid",
  });

  await assert.rejects(
    () =>
      rotator.issueAndRotate({
        operationId: "AI_UX_OPERATION_0001",
        changeId: "AI_UX_CHANGE_0001",
        policyVersion: "AI_UX_POLICY_0001",
      }),
    (error) =>
      error instanceof D2E4MRotatorError &&
      error.code === "D2E4M_ROTATOR_BEARER_REJECTED",
  );

  assert.deepEqual(events, [
    "inspectExpired",
    "consumerReady",
    "rotationAuthority",
    "canary",
  ]);
});
