export const D2E4X_REPLAY_READINESS_VERSION =
  "AI_UX_02D2E4X_PREVIEW_REPLAY_READINESS_V1";

function blocked() {
  return Object.freeze({
    status: "BLOCKED",
  });
}

export class CertifiedPreviewSingleTurnReplayReadinessV1 {
  #expectedBinding;

  constructor({ expectedBinding }) {
    if (
      expectedBinding?.environment !== "PREVIEW" ||
      typeof expectedBinding?.authoritativeTenantId !== "string" ||
      !expectedBinding.authoritativeTenantId ||
      typeof expectedBinding?.syntheticFixtureLocator !== "string" ||
      !expectedBinding.syntheticFixtureLocator ||
      typeof expectedBinding?.linkId !== "string" ||
      !expectedBinding.linkId ||
      typeof expectedBinding?.sessionId !== "string" ||
      !expectedBinding.sessionId ||
      typeof expectedBinding?.turnId !== "string" ||
      !expectedBinding.turnId
    ) {
      throw new Error(
        "D2E4X_REPLAY_EXPECTED_BINDING_REJECTED",
      );
    }

    this.#expectedBinding =
      Object.freeze({
        environment:
          expectedBinding.environment,

        authoritativeTenantId:
          expectedBinding.authoritativeTenantId,

        syntheticFixtureLocator:
          expectedBinding.syntheticFixtureLocator,

        linkId:
          expectedBinding.linkId,

        sessionId:
          expectedBinding.sessionId,

        turnId:
          expectedBinding.turnId,
      });
  }

  async readReadiness(input) {
    if (
      input?.environment !== "PREVIEW" ||
      input?.binding?.environment !==
        this.#expectedBinding.environment ||
      input?.binding?.authoritativeTenantId !==
        this.#expectedBinding.authoritativeTenantId ||
      input?.binding?.syntheticFixtureLocator !==
        this.#expectedBinding.syntheticFixtureLocator ||
      input?.binding?.linkId !==
        this.#expectedBinding.linkId ||
      input?.binding?.sessionId !==
        this.#expectedBinding.sessionId ||
      input?.binding?.turnId !==
        this.#expectedBinding.turnId
    ) {
      return blocked();
    }

    return Object.freeze({
      status: "READY",

      readinessBasis:
        "CERTIFIED_SINGLE_TURN_BINDING",

      environment:
        "PREVIEW",

      replayPersistenceClaimed:
        false,

      externalReplayArtifactAccepted:
        false,
    });
  }
}
