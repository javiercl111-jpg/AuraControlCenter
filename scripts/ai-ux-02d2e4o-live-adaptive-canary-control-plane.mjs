import { createHash } from "node:crypto";

const PROJECT_ID = "aura-intel-preview";

const POLICY_COLLECTION =
  "discoveryAdaptiveCanaryPoliciesV1";

const ACTIVE_COLLECTION =
  "discoveryAdaptiveCanaryActiveV1";

const AUDIT_COLLECTION =
  "discoveryAdaptiveCanaryAuditV1";

const ACTIVE_DOCUMENT_ID =
  "eb6cc289a9a2843c29b47263d321959a95d20d99639704477e78d968c3d42801";

const POINTER_VERSION =
  "DISCOVERY_ADAPTIVE_CANARY_ACTIVE_POINTER_V1";

const POLICY_VERSION =
  "DISCOVERY_ADAPTIVE_CANARY_POLICY_V1";

const ACTIVATION_VERSION =
  "DISCOVERY_ADAPTIVE_ACTIVATION_V1";

const AUDIT_VERSION =
  "DISCOVERY_ADAPTIVE_CANARY_POLICY_AUDIT_V1";

const FIXTURE =
  /^SYNTHETIC_FIXTURE_V1_[A-F0-9]{32}$/u;

const POLICY_NAME =
  /^AI_UX_02D3_PREVIEW_CANARY_[A-Z0-9_]+$/u;

const SHA256 =
  /^[a-f0-9]{64}$/u;

export class D2E4OControlPlaneError extends Error {
  constructor(code) {
    super(code);
    this.name = "D2E4OControlPlaneError";
    this.code = code;
  }
}

function fail(code) {
  throw new D2E4OControlPlaneError(code);
}

function sha256(value) {
  return createHash("sha256")
    .update(value, "utf8")
    .digest("hex");
}

function stable(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stable).join(",")}]`;
  }

  if (
    value &&
    typeof value === "object"
  ) {
    const keys = Object.keys(value).sort();

    return `{${keys
      .map((key) =>
        `${JSON.stringify(key)}:${stable(value[key])}`,
      )
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function fingerprint(value) {
  return sha256(stable(value));
}

function assertCandidate(candidate) {
  if (
    candidate?.environment !== "PREVIEW" ||
    candidate?.mode !== "CANARY" ||
    candidate?.enabled !== true ||
    candidate?.source !== "SERVER_CONFIGURATION" ||
    !POLICY_NAME.test(candidate?.policyVersion ?? "") ||
    typeof candidate?.authoritativeTenantLocator !== "string" ||
    candidate.authoritativeTenantLocator.length === 0 ||
    typeof candidate?.actorLocator !== "string" ||
    candidate.actorLocator.length === 0 ||
    typeof candidate?.reasonCode !== "string" ||
    candidate.reasonCode.length === 0 ||
    typeof candidate?.expiresAt !== "string" ||
    !Number.isSafeInteger(Date.parse(candidate.expiresAt)) ||
    new Date(Date.parse(candidate.expiresAt)).toISOString() !==
      candidate.expiresAt ||
    Date.parse(candidate.expiresAt) <= candidate.now ||
    !Number.isSafeInteger(candidate?.now) ||
    candidate?.killSwitchState?.environment !== "PREVIEW" ||
    candidate?.killSwitchState?.state !== "OFF" ||
    candidate?.killSwitchState?.source !==
      "SERVER_CONFIGURATION" ||
    typeof candidate?.killSwitchState?.revision !== "string" ||
    candidate.killSwitchState.revision.length === 0 ||
    !Array.isArray(
      candidate?.allowedSyntheticFixtureLocators,
    ) ||
    candidate.allowedSyntheticFixtureLocators.length !== 1 ||
    !FIXTURE.test(
      candidate.allowedSyntheticFixtureLocators[0] ?? "",
    ) ||
    !Array.isArray(candidate?.allowedIntentClasses) ||
    candidate.allowedIntentClasses.length === 0 ||
    candidate.allowedIntentClasses.some(
      (value) =>
        value !== "CLARIFICATION" &&
        value !== "DISCOVER_PROBLEM",
    )
  ) {
    fail("D2E4O_CONTROL_PLANE_CANDIDATE_REJECTED");
  }
}

export class FirestoreAdaptiveCanaryControlPlaneV1 {
  #db;

  constructor({ db }) {
    if (
      !db ||
      typeof db.collection !== "function" ||
      typeof db.runTransaction !== "function"
    ) {
      fail("D2E4O_CONTROL_PLANE_CONFIGURATION_REJECTED");
    }

    this.#db = db;
  }

  async #readCurrent() {
    const activeSnapshot = await this.#db
      .collection(ACTIVE_COLLECTION)
      .doc(ACTIVE_DOCUMENT_ID)
      .get();

    if (!activeSnapshot.exists) {
      fail("D2E4O_CONTROL_PLANE_ACTIVE_POINTER_MISSING");
    }

    const active = activeSnapshot.data();

    if (
      active?.version !== POINTER_VERSION ||
      active?.environment !== "PREVIEW" ||
      typeof active?.policyVersion !== "string" ||
      typeof active?.auditId !== "string" ||
      typeof active?.authoritativeTenantLocator !== "string" ||
      !Number.isSafeInteger(active?.updatedAt)
    ) {
      fail("D2E4O_CONTROL_PLANE_ACTIVE_POINTER_REJECTED");
    }

    const policyQuery = await this.#db
      .collection(POLICY_COLLECTION)
      .where("policyVersion", "==", active.policyVersion)
      .limit(2)
      .get();

    if (policyQuery.size !== 1) {
      fail("D2E4O_CONTROL_PLANE_POLICY_CARDINALITY_REJECTED");
    }

    const auditDocumentId =
      sha256(active.auditId);

    const auditSnapshot = await this.#db
      .collection(AUDIT_COLLECTION)
      .doc(auditDocumentId)
      .get();

    if (!auditSnapshot.exists) {
      fail("D2E4O_CONTROL_PLANE_AUDIT_MISSING");
    }

    const policy = policyQuery.docs[0].data();
    const audit = auditSnapshot.data();

    if (
      policy?.policyVersion !== active.policyVersion ||
      policy?.authoritativeTenantLocator !==
        active.authoritativeTenantLocator ||
      audit?.version !== AUDIT_VERSION ||
      audit?.policyVersion !== active.policyVersion ||
      audit?.authoritativeTenantLocator !==
        active.authoritativeTenantLocator ||
      audit?.activatedAt !== active.updatedAt
    ) {
      fail("D2E4O_CONTROL_PLANE_CURRENT_BINDING_REJECTED");
    }

    return Object.freeze({
      active,
      policy,
      audit,
      auditDocumentId,
    });
  }

  async dryRun(candidate) {
    assertCandidate(candidate);

    const current =
      await this.#readCurrent();

    if (
      current.active.authoritativeTenantLocator !==
      candidate.authoritativeTenantLocator
    ) {
      fail("D2E4O_CONTROL_PLANE_TENANT_REJECTED");
    }

    if (
      candidate.policyVersion ===
      current.active.policyVersion
    ) {
      fail("D2E4O_CONTROL_PLANE_POLICY_REUSE_REJECTED");
    }

    const logicalAuditId = [
      "DISCOVERY_ADAPTIVE_CANARY_AUDIT_V1",
      candidate.policyVersion,
      candidate.authoritativeTenantLocator,
      candidate.actorLocator,
      candidate.reasonCode,
      String(candidate.now),
    ].join("|");

    const auditDocumentId =
      sha256(logicalAuditId);

    const policyDocumentId =
      sha256(candidate.policyVersion);

    const proposed = Object.freeze({
      policyDocumentId,
      auditDocumentId,
      logicalAuditId,

      previousPolicyVersion:
        current.active.policyVersion,

      previousUpdatedAt:
        current.active.updatedAt,

      previousAuditId:
        current.active.auditId,

      authoritativeTenantLocator:
        candidate.authoritativeTenantLocator,

      proposedPolicyVersion:
        candidate.policyVersion,

      activatedAt:
        candidate.now,
    });

    const dryRunFingerprint =
      fingerprint({
        version:
          "AI_UX_02D2E4O_CONTROL_PLANE_DRY_RUN_V1",

        previousPolicyVersion:
          proposed.previousPolicyVersion,

        previousUpdatedAt:
          proposed.previousUpdatedAt,

        previousAuditId:
          proposed.previousAuditId,

        authoritativeTenantLocator:
          proposed.authoritativeTenantLocator,

        proposedPolicyVersion:
          proposed.proposedPolicyVersion,

        policyDocumentId:
          proposed.policyDocumentId,

        auditDocumentId:
          proposed.auditDocumentId,

        activatedAt:
          proposed.activatedAt,

        expiresAt:
          candidate.expiresAt,

        fixture:
          candidate.allowedSyntheticFixtureLocators,

        intents:
          candidate.allowedIntentClasses,

        killSwitchRevision:
          candidate.killSwitchState.revision,
      });

    return Object.freeze({
      status: "DRY_RUN_VALIDATED",
      fingerprint: dryRunFingerprint,
      candidate: Object.freeze({
        ...candidate,
      }),
      cas: Object.freeze({
        ...proposed,
      }),
    });
  }

  async apply(dryRunResult) {
    if (
      dryRunResult?.status !== "DRY_RUN_VALIDATED" ||
      !SHA256.test(dryRunResult?.fingerprint ?? "") ||
      !dryRunResult?.candidate ||
      !dryRunResult?.cas
    ) {
      fail("D2E4O_CONTROL_PLANE_APPLY_INPUT_REJECTED");
    }

    const candidate =
      dryRunResult.candidate;

    const cas =
      dryRunResult.cas;

    assertCandidate(candidate);

    const expectedFingerprint =
      fingerprint({
        version:
          "AI_UX_02D2E4O_CONTROL_PLANE_DRY_RUN_V1",

        previousPolicyVersion:
          cas.previousPolicyVersion,

        previousUpdatedAt:
          cas.previousUpdatedAt,

        previousAuditId:
          cas.previousAuditId,

        authoritativeTenantLocator:
          cas.authoritativeTenantLocator,

        proposedPolicyVersion:
          cas.proposedPolicyVersion,

        policyDocumentId:
          cas.policyDocumentId,

        auditDocumentId:
          cas.auditDocumentId,

        activatedAt:
          cas.activatedAt,

        expiresAt:
          candidate.expiresAt,

        fixture:
          candidate.allowedSyntheticFixtureLocators,

        intents:
          candidate.allowedIntentClasses,

        killSwitchRevision:
          candidate.killSwitchState.revision,
      });

    if (
      expectedFingerprint !==
      dryRunResult.fingerprint
    ) {
      fail("D2E4O_CONTROL_PLANE_FINGERPRINT_MISMATCH");
    }

    const activeRef = this.#db
      .collection(ACTIVE_COLLECTION)
      .doc(ACTIVE_DOCUMENT_ID);

    const policyRef = this.#db
      .collection(POLICY_COLLECTION)
      .doc(cas.policyDocumentId);

    const auditRef = this.#db
      .collection(AUDIT_COLLECTION)
      .doc(cas.auditDocumentId);

    return this.#db.runTransaction(
      async (transaction) => {
        const [
          activeSnapshot,
          policySnapshot,
          auditSnapshot,
        ] = await Promise.all([
          transaction.get(activeRef),
          transaction.get(policyRef),
          transaction.get(auditRef),
        ]);

        if (
          !activeSnapshot.exists ||
          policySnapshot.exists ||
          auditSnapshot.exists
        ) {
          fail("D2E4O_CONTROL_PLANE_CAS_FAILED");
        }

        const active =
          activeSnapshot.data();

        if (
          active?.version !== POINTER_VERSION ||
          active?.environment !== "PREVIEW" ||
          active?.policyVersion !==
            cas.previousPolicyVersion ||
          active?.updatedAt !==
            cas.previousUpdatedAt ||
          active?.auditId !==
            cas.previousAuditId ||
          active?.authoritativeTenantLocator !==
            cas.authoritativeTenantLocator
        ) {
          fail("D2E4O_CONTROL_PLANE_CAS_FAILED");
        }

        const policy = {
          version: POLICY_VERSION,
          activationVersion:
            ACTIVATION_VERSION,

          policyVersion:
            candidate.policyVersion,

          authoritativeTenantLocator:
            candidate.authoritativeTenantLocator,

          environment: "PREVIEW",
          mode: "CANARY",
          enabled: true,

          expiresAt:
            candidate.expiresAt,

          killSwitchState: {
            ...candidate.killSwitchState,
          },

          allowedSyntheticFixtureLocators: [
            ...candidate.allowedSyntheticFixtureLocators,
          ],

          allowedIntentClasses: [
            ...candidate.allowedIntentClasses,
          ],

          source:
            "SERVER_CONFIGURATION",
        };

        const audit = {
          version: AUDIT_VERSION,

          policyVersion:
            candidate.policyVersion,

          previousPolicyVersion:
            cas.previousPolicyVersion,

          authoritativeTenantLocator:
            candidate.authoritativeTenantLocator,

          environment:
            "PREVIEW",

          actorLocator:
            candidate.actorLocator,

          reasonCode:
            candidate.reasonCode,

          activatedAt:
            candidate.now,
        };

        const nextActive = {
          version:
            POINTER_VERSION,

          policyVersion:
            candidate.policyVersion,

          authoritativeTenantLocator:
            candidate.authoritativeTenantLocator,

          environment:
            "PREVIEW",

          auditId:
            cas.logicalAuditId,

          updatedAt:
            candidate.now,
        };

        transaction.create(
          policyRef,
          policy,
        );

        transaction.create(
          auditRef,
          audit,
        );

        transaction.set(
          activeRef,
          nextActive,
        );

        return Object.freeze({
          status: "APPLIED",
          fingerprint:
            dryRunResult.fingerprint,

          policyVersion:
            candidate.policyVersion,

          auditDocumentId:
            cas.auditDocumentId,

          activatedAt:
            candidate.now,

          logicalMutations:
            3,
        });
      },
    );
  }

  async readBack(expected) {
    if (
      typeof expected?.policyVersion !== "string" ||
      !SHA256.test(expected?.fingerprint ?? "")
    ) {
      fail("D2E4O_CONTROL_PLANE_READBACK_INPUT_REJECTED");
    }

    const current =
      await this.#readCurrent();

    if (
      current.active.policyVersion !==
        expected.policyVersion ||
      current.audit.policyVersion !==
        expected.policyVersion ||
      current.policy.policyVersion !==
        expected.policyVersion ||
      current.active.updatedAt !==
        current.audit.activatedAt
    ) {
      fail("D2E4O_CONTROL_PLANE_READBACK_REJECTED");
    }

    return Object.freeze({
      status: "READ_BACK_CERTIFIED",
      policyVersion:
        current.active.policyVersion,

      activatedAt:
        current.active.updatedAt,

      fingerprint:
        expected.fingerprint,

      pointerPolicyAuditMatch:
        true,
    });
  }
}
