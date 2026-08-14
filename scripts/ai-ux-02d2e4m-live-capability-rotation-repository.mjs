import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";

import {
  assertAuthorityReceiptV1,
  createRuntimeErrorFieldsV1,
  isRuntimeErrorV1,
} from "./ai-ux-02d2e4x-policy-readiness-contract-v1.mjs";

const requireFromFunctions = createRequire(
  new URL("../functions/package.json", import.meta.url),
);

const admin = requireFromFunctions("firebase-admin");

const FIREBASE_PROJECT_ID = "aura-intel-preview";
const CAPABILITIES_COLLECTION = "discovery_capabilities_v1";

const SHA256 = /^[a-f0-9]{64}$/u;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/u;

export const D2E4M_ROTATION_REPOSITORY_VERSION =
  "AI_UX_02D2E4M_LIVE_CAPABILITY_ROTATION_REPOSITORY_V1";

export class D2E4MRotationRepositoryError extends Error {
  constructor(input) {
    const fields = typeof input === "string" ? null : input;
    const code = fields?.code ?? input;
    super(fields?.message ?? code);
    Object.defineProperty(this, "name", {
      configurable: true,
      enumerable: false,
      writable: true,
      value: "D2E4MRotationRepositoryError",
    });
    if (fields) {
      for (const [field, value] of Object.entries(fields)) {
        Object.defineProperty(this, field, {
          configurable: false,
          enumerable: true,
          writable: false,
          value,
        });
      }
      Object.freeze(this);
    } else {
      this.code = code;
    }
  }
}

function fail(code) {
  throw new D2E4MRotationRepositoryError(code);
}

function failAuthority(code, { traceId, now, errorIdFactory, cause } = {}) {
  if (
    SAFE_ID.test(traceId ?? "") &&
    Number.isSafeInteger(now) &&
    typeof errorIdFactory === "function"
  ) {
    const fields = createRuntimeErrorFieldsV1({
      errorId: errorIdFactory(),
      code,
      stage: "AUTHORITY",
      producer: "D2E4M_CAPABILITY_BOUNDARY",
      severity: "BLOCKING",
      message: code,
      cause: isRuntimeErrorV1(cause) ? cause : null,
      retryable: false,
      partialSideEffects: false,
      details: { observedName: cause?.name ?? "AuthorityReceiptV1" },
      traceId,
      occurredAtMs: now,
    });
    throw new D2E4MRotationRepositoryError(fields);
  }
  fail(code);
}

function millis(value) {
  if (
    value &&
    typeof value === "object" &&
    typeof value.toMillis === "function"
  ) {
    return value.toMillis();
  }

  if (Number.isSafeInteger(value)) return value;

  fail("D2E4M_TIMESTAMP_INVALID");
}

function assertAuthority(authority, now, context) {
  try {
    assertAuthorityReceiptV1(authority, { atMs: now });
    if (authority.projectId !== FIREBASE_PROJECT_ID) {
      throw new TypeError("D2E4M_AUTHORITY_PROJECT_REJECTED");
    }
  } catch (cause) {
    failAuthority("D2E4M_AUTHORITY_REJECTED", {
      ...context,
      now,
      cause,
    });
  }
}

function ensureAdminApp() {
  const existing = admin.apps?.find(
    (app) => app?.options?.projectId === FIREBASE_PROJECT_ID,
  );

  if (existing) return existing;

  return admin.initializeApp(
    {
      projectId: FIREBASE_PROJECT_ID,
    },
    "ai-ux-02d2e4m-preview-readonly",
  );
}

export class FirestoreSyntheticCapabilityRotationRepositoryV1 {
  #db;
  #errorIdFactory;

  constructor({
    db,
    errorIdFactory = () => `rotation-error-${randomUUID()}`,
  } = {}) {
    if (typeof errorIdFactory !== "function") {
      fail("D2E4M_REPOSITORY_CONFIGURATION_REJECTED");
    }
    this.#errorIdFactory = errorIdFactory;
    if (db) {
      this.#db = db;
      return;
    }

    const app = ensureAdminApp();
    this.#db = admin.firestore(app);
  }

  async inspectExpired(authority, now, { traceId } = {}) {
    assertAuthority(authority, now, {
      traceId,
      errorIdFactory: this.#errorIdFactory,
    });

    if (!Number.isSafeInteger(now)) {
      fail("D2E4M_TIME_REJECTED");
    }

    const linkRef = this.#db
      .collection("market_discovery_links")
      .doc(authority.linkId);

    const linkSnapshot = await linkRef.get();

    if (!linkSnapshot.exists) {
      fail("D2E4M_LINK_NOT_FOUND");
    }

    const link = linkSnapshot.data();

    const capabilityHash = link?.sessionCapabilityHash;

    if (
      link?.synthetic !== true ||
      link?.environment !== "PREVIEW" ||
      link?.projectId !== FIREBASE_PROJECT_ID ||
      link?.tenantId !== authority.authoritativeTenantId ||
      link?.fixtureLocator !== authority.syntheticFixtureLocator ||
      link?.requiredCapability !== "EVALUATE_CONVERSATION" ||
      link?.linkId !== authority.linkId ||
      link?.sessionId !== authority.sessionId ||
      typeof capabilityHash !== "string" ||
      !SHA256.test(capabilityHash)
    ) {
      fail("D2E4M_LINK_BINDING_MISMATCH");
    }

    const capabilitySnapshot = await this.#db
      .collection(CAPABILITIES_COLLECTION)
      .doc(capabilityHash)
      .get();

    if (!capabilitySnapshot.exists) {
      fail("D2E4M_CAPABILITY_NOT_FOUND");
    }

    const capability = capabilitySnapshot.data();

    const updatedAt = millis(capability?.updatedAt);
    const expiresAt = millis(capability?.expiresAt);

    if (
      capability?.version !== "DISCOVERY_CAPABILITY_V1" ||
      capability?.type !== "SESSION" ||
      capability?.purpose !== "DISCOVERY_SESSION" ||
      capability?.synthetic !== true ||
      capability?.environment !== "PREVIEW" ||
      capability?.projectId !== FIREBASE_PROJECT_ID ||
      capability?.tenantId !== authority.authoritativeTenantId ||
      capability?.fixtureLocator !== authority.syntheticFixtureLocator ||
      capability?.requiredCapability !== "EVALUATE_CONVERSATION" ||
      capability?.capabilityScope !== "DISCOVERY_SESSION" ||
      capability?.linkId !== authority.linkId ||
      capability?.sessionId !== authority.sessionId ||
      capability?.tokenHash !== capabilityHash ||
      !Number.isSafeInteger(capability?.generation) ||
      capability.generation < 1
    ) {
      fail("D2E4M_CAPABILITY_BINDING_MISMATCH");
    }

    if (expiresAt > now) {
      fail("D2E4M_CAPABILITY_NOT_EXPIRED");
    }

    return Object.freeze({
      capabilityLocator: capabilityHash,
      expectedTokenHash: capabilityHash,
      expectedCapabilityVersion: "DISCOVERY_CAPABILITY_V1",
      expectedUpdatedAt: updatedAt,
      expectedExpiresAt: expiresAt,

      // Generation 1 is the original issuance; therefore rotation 0.
      expectedRotationVersion: capability.generation - 1,
    });
  }

  async rotateExpired({
    authority,
    expectation,
    nextTokenHash,
    now,
    traceId,
  }) {
    assertAuthority(authority, now, {
      traceId,
      errorIdFactory: this.#errorIdFactory,
    });

    if (
      !expectation ||
      typeof expectation !== "object" ||
      !SHA256.test(expectation.capabilityLocator ?? "") ||
      !SHA256.test(expectation.expectedTokenHash ?? "") ||
      expectation.capabilityLocator !== expectation.expectedTokenHash ||
      expectation.expectedCapabilityVersion !== "DISCOVERY_CAPABILITY_V1" ||
      !Number.isSafeInteger(expectation.expectedUpdatedAt) ||
      !Number.isSafeInteger(expectation.expectedExpiresAt) ||
      !Number.isSafeInteger(expectation.expectedRotationVersion) ||
      expectation.expectedRotationVersion < 0 ||
      !SHA256.test(nextTokenHash ?? "") ||
      !Number.isSafeInteger(now)
    ) {
      fail("D2E4M_ROTATION_INPUT_REJECTED");
    }

    if (
      expectation.expectedExpiresAt > now ||
      nextTokenHash === expectation.expectedTokenHash
    ) {
      fail("D2E4M_ROTATION_PRECONDITION_REJECTED");
    }

    const currentRef = this.#db
      .collection(CAPABILITIES_COLLECTION)
      .doc(expectation.capabilityLocator);

    const nextRef = this.#db
      .collection(CAPABILITIES_COLLECTION)
      .doc(nextTokenHash);

    const linkRef = this.#db
      .collection("market_discovery_links")
      .doc(authority.linkId);

    const nextGeneration =
      expectation.expectedRotationVersion + 2;

    const nextExpiresAt = now + 5 * 60 * 1_000;

    try {
      return await this.#db.runTransaction(async (transaction) => {
        const [currentSnap, nextSnap, linkSnap] =
          await Promise.all([
            transaction.get(currentRef),
            transaction.get(nextRef),
            transaction.get(linkRef),
          ]);

        if (
          !currentSnap.exists ||
          nextSnap.exists ||
          !linkSnap.exists
        ) {
          fail("D2E4M_ROTATION_CAS_FAILED");
        }

        const current = currentSnap.data();
        const link = linkSnap.data();

        const currentUpdatedAt = millis(current?.updatedAt);
        const currentExpiresAt = millis(current?.expiresAt);
        const currentIssuedAt = millis(current?.issuedAt);
        const currentCreatedAt = millis(current?.createdAt);
        const currentConsumedAt =
          current?.consumedAt == null
            ? null
            : millis(current.consumedAt);
        const currentCompletedAt =
          current?.completedAt == null
            ? null
            : millis(current.completedAt);

        if (
          current?.version !== "DISCOVERY_CAPABILITY_V1" ||
          current?.type !== "SESSION" ||
          current?.purpose !== "DISCOVERY_SESSION" ||
          current?.synthetic !== true ||
          current?.environment !== "PREVIEW" ||
          current?.projectId !== FIREBASE_PROJECT_ID ||
          current?.tenantId !== authority.authoritativeTenantId ||
          current?.fixtureLocator !== authority.syntheticFixtureLocator ||
          current?.requiredCapability !== "EVALUATE_CONVERSATION" ||
          current?.capabilityScope !== "DISCOVERY_SESSION" ||
          current?.linkId !== authority.linkId ||
          current?.sessionId !== authority.sessionId ||
          current?.tokenHash !== expectation.expectedTokenHash ||
          current?.generation !== nextGeneration - 1 ||
          currentUpdatedAt !== expectation.expectedUpdatedAt ||
          currentExpiresAt !== expectation.expectedExpiresAt ||
          currentExpiresAt > now ||
          current?.revokedAt != null ||
          current?.completedAt != null ||
          link?.sessionCapabilityHash !== expectation.expectedTokenHash ||
          link?.sessionCapabilityGeneration !== current.generation ||
          link?.tenantId !== authority.authoritativeTenantId ||
          link?.fixtureLocator !== authority.syntheticFixtureLocator ||
          link?.linkId !== authority.linkId ||
          link?.sessionId !== authority.sessionId
        ) {
          fail("D2E4M_ROTATION_CAS_FAILED");
        }

        const revokedCurrent = {
          ...current,
          revokedAt: now,
          revocationReason: "AI_UX_02D2E4M_ROTATION",
          updatedAt: now,
        };

        const nextCapability = {
          ...current,
          generation: nextGeneration,
          tokenHash: nextTokenHash,
          issuedAt: now,
          expiresAt: nextExpiresAt,
          consumedAt: null,
          completedAt: null,
          revokedAt: null,
          revocationReason: null,
          createdAt: now,
          updatedAt: now,
        };

        transaction.set(currentRef, {
          ...revokedCurrent,
          issuedAt: admin.firestore.Timestamp.fromMillis(
            currentIssuedAt,
          ),
          expiresAt: admin.firestore.Timestamp.fromMillis(
            currentExpiresAt,
          ),
          consumedAt: currentConsumedAt === null
            ? null
            : admin.firestore.Timestamp.fromMillis(
                currentConsumedAt,
              ),
          completedAt: currentCompletedAt === null
            ? null
            : admin.firestore.Timestamp.fromMillis(
                currentCompletedAt,
              ),
          revokedAt: admin.firestore.Timestamp.fromMillis(now),
          createdAt: admin.firestore.Timestamp.fromMillis(
            currentCreatedAt,
          ),
          updatedAt: admin.firestore.Timestamp.fromMillis(now),
        });

        transaction.create(nextRef, {
          ...nextCapability,
          issuedAt: admin.firestore.Timestamp.fromMillis(now),
          expiresAt: admin.firestore.Timestamp.fromMillis(
            nextExpiresAt,
          ),
          consumedAt: null,
          completedAt: null,
          revokedAt: null,
          createdAt: admin.firestore.Timestamp.fromMillis(now),
          updatedAt: admin.firestore.Timestamp.fromMillis(now),
        });

        transaction.update(linkRef, {
          sessionCapabilityHash: nextTokenHash,
          sessionCapabilityGeneration: nextGeneration,
          updatedAt: admin.firestore.Timestamp.fromMillis(now),
        });

        return Object.freeze({
          status: "ROTATED",
          generation: nextGeneration,
          expiresAt: nextExpiresAt,
        });
      });
    } catch (error) {
      if (error instanceof D2E4MRotationRepositoryError) {
        throw error;
      }

      fail("D2E4M_ROTATION_TRANSACTION_FAILED");
    }
  }
}
