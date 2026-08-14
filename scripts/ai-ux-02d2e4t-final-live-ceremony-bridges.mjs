export const D2E4T_BRIDGE_VERSION =
  "AI_UX_02D2E4T_FINAL_LIVE_CEREMONY_BRIDGES_V3";

const D2E4T_KILL_SWITCH_REVISION =
  "AI_UX_02D2E4_CANARY_KILL_SWITCH_OFF_V1";

export class D2E4TBridgeError extends Error {
  constructor(code) {
    super(code);
    this.name = "D2E4TBridgeError";
    this.code = code;
  }
}

function fail(code) {
  throw new D2E4TBridgeError(code);
}

function requireString(value, code) {
  if (
    typeof value !== "string" ||
    value.length === 0
  ) {
    fail(code);
  }

  return value;
}

export class LiveAdaptiveCanaryCeremonyAdapterV1 {
  #controlPlane;
  #authoritativeTenantLocator;
  #actorLocator;
  #clock;
  #used = false;

  constructor({
    controlPlane,
    authoritativeTenantLocator,
    actorLocator,
    clock = Date.now,
  }) {
    if (
      typeof controlPlane?.dryRun !== "function" ||
      typeof controlPlane?.apply !== "function" ||
      typeof controlPlane?.readBack !== "function" ||
      typeof clock !== "function"
    ) {
      fail("D2E4T_CANARY_DEPENDENCY_REJECTED");
    }

    this.#controlPlane = controlPlane;

    this.#authoritativeTenantLocator =
      requireString(
        authoritativeTenantLocator,
        "D2E4T_CANARY_TENANT_REJECTED",
      );

    this.#actorLocator =
      requireString(
        actorLocator,
        "D2E4T_CANARY_ACTOR_REJECTED",
      );

    this.#clock = clock;
  }

  async prepare(change) {
    if (this.#used) {
      fail("D2E4T_CANARY_SECOND_PREPARE_REJECTED");
    }

    this.#used = true;

    const policy = change?.policy;
    const now = this.#clock();

    if (
      change?.environment !== "PREVIEW" ||
      typeof change?.authoritativeTenantId !== "string" ||
      !change.authoritativeTenantId ||
      !policy ||
      policy?.environment !== "PREVIEW" ||
      policy?.mode !== "CANARY" ||
      policy?.enabled !== true ||
      typeof policy?.policyVersion !== "string" ||
      !policy.policyVersion ||
      typeof policy?.expiresAt !== "string" ||
      !Array.isArray(
        policy?.allowedSyntheticFixtureLocators,
      ) ||
      policy.allowedSyntheticFixtureLocators.length !== 1 ||
      !Array.isArray(policy?.allowedIntentClasses) ||
      policy.allowedIntentClasses.length === 0 ||
      policy?.killSwitchState?.state !== "OFF"
    ) {
      fail("D2E4T_CANARY_CHANGE_REJECTED");
    }

    const candidate = Object.freeze({
      environment: "PREVIEW",
      mode: "CANARY",
      enabled: true,
      source: "SERVER_CONFIGURATION",

      policyVersion:
        policy.policyVersion,

      authoritativeTenantLocator:
        this.#authoritativeTenantLocator,

      actorLocator:
        this.#actorLocator,

      reasonCode:
        requireString(
          change.reasonCode,
          "D2E4T_CANARY_REASON_REJECTED",
        ),

      now,

      expiresAt:
        policy.expiresAt,

      killSwitchState: Object.freeze({
        environment: "PREVIEW",
        state: "OFF",
        revision:
          D2E4T_KILL_SWITCH_REVISION,
        source: "SERVER_CONFIGURATION",
      }),

      allowedSyntheticFixtureLocators:
        Object.freeze([
          ...policy.allowedSyntheticFixtureLocators,
        ]),

      allowedIntentClasses:
        Object.freeze([
          ...policy.allowedIntentClasses,
        ]),
    });

    const dryRun =
      await this.#controlPlane.dryRun(candidate);

    if (
      dryRun?.status !== "DRY_RUN_VALIDATED" ||
      typeof dryRun?.fingerprint !== "string"
    ) {
      fail("D2E4T_CANARY_DRY_RUN_REJECTED");
    }

    const applied =
      await this.#controlPlane.apply(dryRun);

    if (
      applied?.status !== "APPLIED" ||
      applied?.policyVersion !==
        candidate.policyVersion ||
      applied?.fingerprint !==
        dryRun.fingerprint ||
      applied?.logicalMutations !== 3
    ) {
      fail("D2E4T_CANARY_APPLY_REJECTED");
    }

    const readBack =
      await this.#controlPlane.readBack({
        policyVersion:
          applied.policyVersion,
        fingerprint:
          applied.fingerprint,
      });

    if (
      readBack?.status !== "READ_BACK_CERTIFIED" ||
      readBack?.policyVersion !==
        candidate.policyVersion ||
      readBack?.fingerprint !==
        dryRun.fingerprint ||
      readBack?.pointerPolicyAuditMatch !== true
    ) {
      fail("D2E4T_CANARY_READBACK_REJECTED");
    }

    return Object.freeze({
      status: "ACTIVE",
      policyVersion:
        candidate.policyVersion,
      fingerprint:
        dryRun.fingerprint,
      expiresAt:
        candidate.expiresAt,
      logicalMutations:
        applied.logicalMutations,
      readBackCertified: true,
    });
  }
}

export class LiveRotatedCapabilityCeremonyAdapterV1 {
  #rotator;
  #used = false;

  constructor({ rotator }) {
    if (
      typeof rotator?.issueAndRotate !== "function"
    ) {
      fail(
        "D2E4T_CAPABILITY_DEPENDENCY_REJECTED",
      );
    }

    this.#rotator = rotator;
  }

  async issueOnce(change) {
    if (this.#used) {
      fail(
        "D2E4T_CAPABILITY_SECOND_ISSUE_REJECTED",
      );
    }

    this.#used = true;

    const policyVersion =
      requireString(
        change?.policyVersion,
        "D2E4T_CAPABILITY_POLICY_REJECTED",
      );

    const operationId =
      requireString(
        change?.operationId,
        "D2E4T_CAPABILITY_OPERATION_REJECTED",
      );

    const changeId =
      requireString(
        change?.changeId,
        "D2E4T_CAPABILITY_CHANGE_REJECTED",
      );

    const handoff =
      await this.#rotator.issueAndRotate({
        policyVersion,
        operationId,
        changeId,
      });

    const descriptor =
      Object.getOwnPropertyDescriptor(
        handoff ?? {},
        "bearerToken",
      );

    if (
      !handoff ||
      handoff.generation !== 2 ||
      !Number.isSafeInteger(handoff.expiresAt) ||
      typeof handoff.linkId !== "string" ||
      !handoff.linkId ||
      descriptor?.enumerable !== false ||
      descriptor?.writable !== false ||
      descriptor?.configurable !== false ||
      typeof descriptor?.value !== "string" ||
      !/^[a-f0-9]{64}$/u.test(descriptor.value)
    ) {
      fail(
        "D2E4T_CAPABILITY_HANDOFF_REJECTED",
      );
    }

    let available = true;
    let bearer = descriptor.value;

    const envelope = Object.freeze({
      take() {
        if (!available || !bearer) {
          fail(
            "D2E4T_CAPABILITY_ENVELOPE_ALREADY_CONSUMED",
          );
        }

        available = false;

        const secret = Object.freeze({
          bearer,
          expiresAt:
            handoff.expiresAt,
        });

        bearer = "";

        return secret;
      },

      destroy() {
        available = false;
        bearer = "";
      },
    });

    return Object.freeze({
      status: "ACTIVE",
      disposition: "ROTATED",
      actualWriteCount: 3,
      capabilityLocator:
        handoff.linkId,
      generation:
        handoff.generation,
      envelope,
    });
  }
}
