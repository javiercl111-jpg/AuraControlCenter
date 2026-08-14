import { createHash, randomBytes } from "node:crypto";

const SHA256 = /^[a-f0-9]{64}$/u;
const TRACE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/u;

export const D2E4M_ROTATOR_VERSION =
  "AI_UX_02D2E4M_LIVE_SYNTHETIC_CAPABILITY_ROTATOR_V1";

export class D2E4MRotatorError extends Error {
  constructor(code) {
    super(code);
    this.name = "D2E4MRotatorError";
    this.code = code;
  }
}

function fail(code) {
  throw new D2E4MRotatorError(code);
}

function hash(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function defaultTokenFactory() {
  return randomBytes(32).toString("hex");
}

export class LiveSyntheticCapabilityRotatorV1 {
  #authority;
  #rotationRepository;
  #consumerBoundary;
  #rotationAuthority;
  #canaryRevalidation;
  #clock;
  #tokenFactory;
  #traceId;

  constructor(
    authority,
    rotationRepository,
    consumerBoundary,
    rotationAuthority,
    canaryRevalidation,
    clock = Date.now,
    tokenFactory = defaultTokenFactory,
    traceId,
  ) {
    if (
      typeof rotationRepository?.inspectExpired !== "function" ||
      typeof rotationRepository?.rotateExpired !== "function" ||
      typeof consumerBoundary?.assertReady !== "function" ||
      typeof rotationAuthority?.revalidate !== "function" ||
      typeof canaryRevalidation?.revalidate !== "function" ||
      typeof clock !== "function" ||
      typeof tokenFactory !== "function" ||
      (traceId !== undefined && !TRACE_ID.test(traceId))
    ) {
      fail("D2E4M_ROTATOR_CONTRACT_REJECTED");
    }

    this.#authority = authority;
    this.#rotationRepository = rotationRepository;
    this.#consumerBoundary = consumerBoundary;
    this.#rotationAuthority = rotationAuthority;
    this.#canaryRevalidation = canaryRevalidation;
    this.#clock = clock;
    this.#tokenFactory = tokenFactory;
    this.#traceId = traceId;
  }

  async issueAndRotate(input) {
    const now = this.#clock();

    const expectation =
      await this.#rotationRepository.inspectExpired(
        this.#authority,
        now,
        { traceId: this.#traceId },
      );

    await this.#consumerBoundary.assertReady(
      this.#authority,
      now,
      { traceId: this.#traceId },
    );

    await this.#rotationAuthority.revalidate({
      authority: this.#authority,
      operationId: input.operationId,
      changeId: input.changeId,
      now,
      traceId: this.#traceId,
    });

    await this.#canaryRevalidation.revalidate({
      authority: this.#authority,
      policyVersion: input.policyVersion,
      now,
      traceId: this.#traceId,
    });

    const bearerToken = this.#tokenFactory();

    if (!/^[a-f0-9]{64}$/u.test(bearerToken)) {
      fail("D2E4M_ROTATOR_BEARER_REJECTED");
    }

    const nextTokenHash = hash(bearerToken);

    if (!SHA256.test(nextTokenHash)) {
      fail("D2E4M_ROTATOR_HASH_REJECTED");
    }

    const rotated =
      await this.#rotationRepository.rotateExpired({
        authority: this.#authority,
        expectation,
        nextTokenHash,
        now,
        traceId: this.#traceId,
      });

    if (
      rotated?.status !== "ROTATED" ||
      rotated?.generation !==
        expectation.expectedRotationVersion + 2
    ) {
      fail("D2E4M_ROTATOR_RESULT_REJECTED");
    }

    const handoff = {
      expiresAt: rotated.expiresAt,
      linkId: this.#authority.linkId,
      sessionId: this.#authority.sessionId,
      generation: rotated.generation,
      handoffBoundary: "AUTHORIZED_IN_MEMORY_CALLER",
      requestBoundary: "EVALUATE_CONVERSATION_CALLABLE_BODY",
    };

    Object.defineProperty(handoff, "bearerToken", {
      value: bearerToken,
      enumerable: false,
      configurable: false,
      writable: false,
    });

    return Object.freeze(handoff);
  }
}
