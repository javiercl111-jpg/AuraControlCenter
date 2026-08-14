import test from "node:test";
import assert from "node:assert/strict";

import {
  LiveAdaptiveCanaryCeremonyAdapterV1,
  LiveRotatedCapabilityCeremonyAdapterV1,
  D2E4TBridgeError,
} from "../ai-ux-02d2e4t-final-live-ceremony-bridges.mjs";

const NOW = 1_800_000_000_000;

const POLICY =
  "AI_UX_02D3_PREVIEW_CANARY_20260813_V4";

const FIXTURE =
  "SYNTHETIC_FIXTURE_V1_8E5D766A3132FF687116E522304115BE";

const TOKEN = "c".repeat(64);

async function expectCode(action, code) {
  await assert.rejects(
    action,
    (error) =>
      error instanceof D2E4TBridgeError &&
      error.code === code,
  );
}

function canaryChange() {
  return {
    environment: "PREVIEW",

    authoritativeTenantId:
      "tenant-authoritative-id",

    reasonCode:
      "AI_UX_02D2E4_FINAL_CEREMONY",

    policy: {
      environment: "PREVIEW",
      mode: "CANARY",
      enabled: true,

      policyVersion:
        POLICY,

      expiresAt:
        new Date(
          NOW + 30 * 60 * 1000,
        ).toISOString(),

      killSwitchState: {
        state: "OFF",
      },

      allowedSyntheticFixtureLocators: [
        FIXTURE,
      ],

      allowedIntentClasses: [
        "CLARIFICATION",
        "DISCOVER_PROBLEM",
      ],
    },
  };
}

function rotatedHandoff({
  generation = 2,
  bearer = TOKEN,
} = {}) {
  const handoff = {
    expiresAt:
      NOW + 5 * 60 * 1000,

    generation,

    linkId:
      "synthetic-link",

    sessionId:
      "synthetic-session",
  };

  Object.defineProperty(
    handoff,
    "bearerToken",
    {
      value: bearer,
      enumerable: false,
      configurable: false,
      writable: false,
    },
  );

  return Object.freeze(handoff);
}

test("Canary bridge translates D2E4D change into dryRun -> apply -> readBack", async () => {
  const calls = [];

  const controlPlane = {
    async dryRun(candidate) {
      calls.push([
        "dryRun",
        candidate,
      ]);

      assert.equal(
        candidate.policyVersion,
        POLICY,
      );

      assert.equal(
        candidate.environment,
        "PREVIEW",
      );

      assert.equal(
        candidate.mode,
        "CANARY",
      );

      assert.equal(
        candidate.enabled,
        true,
      );

      assert.equal(
        candidate.authoritativeTenantLocator,
        "canary-authority",
      );

      assert.deepEqual(
        candidate.allowedSyntheticFixtureLocators,
        [FIXTURE],
      );

      return {
        status:
          "DRY_RUN_VALIDATED",

        fingerprint:
          "a".repeat(64),
      };
    },

    async apply(dryRun) {
      calls.push([
        "apply",
        dryRun,
      ]);

      return {
        status:
          "APPLIED",

        policyVersion:
          POLICY,

        fingerprint:
          "a".repeat(64),

        logicalMutations:
          3,
      };
    },

    async readBack(expected) {
      calls.push([
        "readBack",
        expected,
      ]);

      return {
        status:
          "READ_BACK_CERTIFIED",

        policyVersion:
          POLICY,

        fingerprint:
          "a".repeat(64),

        pointerPolicyAuditMatch:
          true,
      };
    },
  };

  const adapter =
    new LiveAdaptiveCanaryCeremonyAdapterV1({
      controlPlane,

      authoritativeTenantLocator:
        "canary-authority",

      actorLocator:
        "preview-canary-control-plane",

      clock:
        () => NOW,
    });

  const result =
    await adapter.prepare(
      canaryChange(),
    );

  assert.deepEqual(
    calls.map(([name]) => name),
    [
      "dryRun",
      "apply",
      "readBack",
    ],
  );

  assert.equal(
    result.status,
    "ACTIVE",
  );

  assert.equal(
    result.policyVersion,
    POLICY,
  );

  assert.equal(
    result.logicalMutations,
    3,
  );

  assert.equal(
    result.readBackCertified,
    true,
  );
});

test("Canary bridge is single-use", async () => {
  const controlPlane = {
    async dryRun() {
      return {
        status:
          "DRY_RUN_VALIDATED",
        fingerprint:
          "a".repeat(64),
      };
    },

    async apply() {
      return {
        status:
          "APPLIED",
        policyVersion:
          POLICY,
        fingerprint:
          "a".repeat(64),
        logicalMutations:
          3,
      };
    },

    async readBack() {
      return {
        status:
          "READ_BACK_CERTIFIED",
        policyVersion:
          POLICY,
        fingerprint:
          "a".repeat(64),
        pointerPolicyAuditMatch:
          true,
      };
    },
  };

  const adapter =
    new LiveAdaptiveCanaryCeremonyAdapterV1({
      controlPlane,
      authoritativeTenantLocator:
        "canary-authority",
      actorLocator:
        "preview-canary-control-plane",
      clock:
        () => NOW,
    });

  await adapter.prepare(
    canaryChange(),
  );

  await expectCode(
    () =>
      adapter.prepare(
        canaryChange(),
      ),

    "D2E4T_CANARY_SECOND_PREPARE_REJECTED",
  );
});

test("Capability bridge returns D2E4D ACTIVE envelope contract", async () => {
  const calls = [];

  const rotator = {
    async issueAndRotate(input) {
      calls.push(input);

      return rotatedHandoff();
    },
  };

  const adapter =
    new LiveRotatedCapabilityCeremonyAdapterV1({
      rotator,
    });

  const result =
    await adapter.issueOnce({
      policyVersion:
        POLICY,

      operationId:
        "AI_UX_OPERATION_0001",

      changeId:
        "AI_UX_CHANGE_0001",
    });

  assert.equal(
    calls.length,
    1,
  );

  assert.equal(
    result.status,
    "ACTIVE",
  );

  assert.equal(
    result.disposition,
    "ROTATED",
  );

  assert.equal(
    result.actualWriteCount,
    3,
  );

  assert.equal(
    result.generation,
    2,
  );

  assert.equal(
    result.capabilityLocator,
    "synthetic-link",
  );

  assert.equal(
    typeof result.envelope?.take,
    "function",
  );

  assert.equal(
    typeof result.envelope?.destroy,
    "function",
  );

  assert.equal(
    JSON.stringify(result).includes(TOKEN),
    false,
  );

  const secret =
    result.envelope.take();

  assert.equal(
    secret.bearer,
    TOKEN,
  );

  assert.equal(
    secret.expiresAt,
    NOW + 5 * 60 * 1000,
  );

  assert.equal(
    JSON.stringify(result).includes(TOKEN),
    false,
  );

  await expectCode(
    async () =>
      result.envelope.take(),

    "D2E4T_CAPABILITY_ENVELOPE_ALREADY_CONSUMED",
  );
});

test("Capability envelope destroy prevents later take", async () => {
  const adapter =
    new LiveRotatedCapabilityCeremonyAdapterV1({
      rotator: {
        async issueAndRotate() {
          return rotatedHandoff();
        },
      },
    });

  const result =
    await adapter.issueOnce({
      policyVersion:
        POLICY,

      operationId:
        "AI_UX_OPERATION_0001",

      changeId:
        "AI_UX_CHANGE_0001",
    });

  result.envelope.destroy();

  await expectCode(
    async () =>
      result.envelope.take(),

    "D2E4T_CAPABILITY_ENVELOPE_ALREADY_CONSUMED",
  );
});

test("Capability bridge is single-use", async () => {
  const adapter =
    new LiveRotatedCapabilityCeremonyAdapterV1({
      rotator: {
        async issueAndRotate() {
          return rotatedHandoff();
        },
      },
    });

  await adapter.issueOnce({
    policyVersion:
      POLICY,

    operationId:
      "AI_UX_OPERATION_0001",

    changeId:
      "AI_UX_CHANGE_0001",
  });

  await expectCode(
    () =>
      adapter.issueOnce({
        policyVersion:
          POLICY,

        operationId:
          "AI_UX_OPERATION_0001",

        changeId:
          "AI_UX_CHANGE_0001",
      }),

    "D2E4T_CAPABILITY_SECOND_ISSUE_REJECTED",
  );
});

test("Capability bridge rejects generation other than 2", async () => {
  const adapter =
    new LiveRotatedCapabilityCeremonyAdapterV1({
      rotator: {
        async issueAndRotate() {
          return rotatedHandoff({
            generation: 1,
          });
        },
      },
    });

  await expectCode(
    () =>
      adapter.issueOnce({
        policyVersion:
          POLICY,

        operationId:
          "AI_UX_OPERATION_0001",

        changeId:
          "AI_UX_CHANGE_0001",
      }),

    "D2E4T_CAPABILITY_HANDOFF_REJECTED",
  );
});

test("Capability bridge rejects enumerable bearer handoff", async () => {
  const adapter =
    new LiveRotatedCapabilityCeremonyAdapterV1({
      rotator: {
        async issueAndRotate() {
          return Object.freeze({
            expiresAt:
              NOW + 300_000,

            generation: 2,

            linkId:
              "synthetic-link",

            sessionId:
              "synthetic-session",

            bearerToken:
              TOKEN,
          });
        },
      },
    });

  await expectCode(
    () =>
      adapter.issueOnce({
        policyVersion:
          POLICY,

        operationId:
          "AI_UX_OPERATION_0001",

        changeId:
          "AI_UX_CHANGE_0001",
      }),

    "D2E4T_CAPABILITY_HANDOFF_REJECTED",
  );
});
