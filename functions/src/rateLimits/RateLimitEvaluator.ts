import { RateLimitError, isRateLimitError } from "./rateLimitErrors";
import {
  createRateLimitKeyFingerprintV1,
} from "./rateLimitKeys";
import type {
  RateLimitClock,
  RateLimitPolicyProvider,
  RateLimitRepository,
} from "./rateLimitPorts";
import {
  RATE_LIMIT_COUNTER_COMMAND_SCHEMA_VERSION,
  RATE_LIMIT_DECISION_SCHEMA_VERSION,
  type RateLimitDecisionV1,
  type RateLimitEvaluationRequestV1,
  type RateLimitMetadataV1,
  type RateLimitPolicyV1,
} from "./rateLimitTypes";
import {
  validateRateLimitEvaluationRequestV1,
  validateRateLimitPolicyV1,
  validateRateLimitRepositoryResultV1,
} from "./rateLimitValidation";

const MILLISECONDS_PER_SECOND = 1_000;

interface RateLimitWindowV1 {
  readonly bucket: string;
  readonly startedAtMs: number;
  readonly endsAtMs: number;
  readonly retryAfterSeconds: number;
}

function readClock(clock: RateLimitClock): number {
  let now: number;
  try {
    now = clock.nowEpochMilliseconds();
  } catch (error: unknown) {
    throw new RateLimitError(
      "CLOCK_ERROR",
      "Rate-limit clock failed.",
      { cause: error },
    );
  }
  if (!Number.isSafeInteger(now) || now < 0) {
    throw new RateLimitError(
      "CLOCK_ERROR",
      "Rate-limit clock returned an invalid value.",
    );
  }
  return now;
}

function buildWindow(
  policy: RateLimitPolicyV1,
  nowMs: number,
): RateLimitWindowV1 {
  const windowMs = policy.windowSeconds * MILLISECONDS_PER_SECOND;
  const startedAtMs = Math.floor(nowMs / windowMs) * windowMs;
  const endsAtMs = startedAtMs + windowMs;
  if (
    !Number.isSafeInteger(windowMs) ||
    !Number.isSafeInteger(startedAtMs) ||
    !Number.isSafeInteger(endsAtMs) ||
    endsAtMs <= nowMs
  ) {
    throw new RateLimitError(
      "CLOCK_ERROR",
      "Rate-limit window cannot be computed safely.",
    );
  }
  return Object.freeze({
    bucket: `b${Math.floor(startedAtMs / MILLISECONDS_PER_SECOND)}`,
    startedAtMs,
    endsAtMs,
    retryAfterSeconds: Math.max(
      1,
      Math.ceil((endsAtMs - nowMs) / MILLISECONDS_PER_SECOND),
    ),
  });
}

function createDecision(input: Readonly<{
  policy: RateLimitPolicyV1;
  request: RateLimitEvaluationRequestV1;
  keyFingerprint: string;
  window: RateLimitWindowV1;
  allowed: boolean;
  code:
    | "RATE_LIMIT_ALLOWED"
    | "RATE_LIMIT_EXCEEDED"
    | "POLICY_DISABLED";
  remaining: number;
}>): RateLimitDecisionV1 {
  const effectiveLimit =
    input.policy.maxRequests + input.policy.burst;
  const metadata = Object.freeze({
    ...(input.request.metadata ?? {}),
  }) as RateLimitMetadataV1;
  return Object.freeze({
    schemaVersion: RATE_LIMIT_DECISION_SCHEMA_VERSION,
    decision: input.allowed ? "ALLOW" : "DENY",
    code: input.code,
    dimension: input.request.dimension,
    key: Object.freeze({
      scheme: input.request.key.scheme,
      version: input.request.key.version,
      fingerprint: input.keyFingerprint,
    }),
    bucket: input.window.bucket,
    quota: Object.freeze({
      maxRequests: input.policy.maxRequests,
      burst: input.policy.burst,
      effectiveLimit,
    }),
    window: Object.freeze({
      seconds: input.policy.windowSeconds,
      startedAtMs: input.window.startedAtMs,
      endsAtMs: input.window.endsAtMs,
    }),
    remaining: input.remaining,
    retryAfterSeconds: input.allowed
      ? 0
      : input.window.retryAfterSeconds,
    policy: Object.freeze({
      version: input.policy.version,
      environment: input.policy.environment,
      reason: input.policy.reason,
      owner: input.policy.owner,
    }),
    metadata,
  });
}

export class RateLimitEvaluator {
  readonly #policyProvider: RateLimitPolicyProvider;
  readonly #repository: RateLimitRepository;
  readonly #clock: RateLimitClock;

  constructor(
    policyProvider: RateLimitPolicyProvider,
    repository: RateLimitRepository,
    clock: RateLimitClock,
  ) {
    this.#policyProvider = policyProvider;
    this.#repository = repository;
    this.#clock = clock;
  }

  async evaluate(
    requestValue: RateLimitEvaluationRequestV1,
  ): Promise<RateLimitDecisionV1> {
    const request =
      validateRateLimitEvaluationRequestV1(requestValue);
    let policyValue: RateLimitPolicyV1 | null;
    try {
      policyValue = await this.#policyProvider.getPolicy({
        dimension: request.dimension,
        environment: request.environment,
      });
    } catch (error: unknown) {
      if (isRateLimitError(error)) throw error;
      throw new RateLimitError(
        "CONFIGURATION_ERROR",
        "Rate-limit policy provider failed.",
        { cause: error },
      );
    }
    if (policyValue === null) {
      throw new RateLimitError(
        "POLICY_NOT_FOUND",
        "Rate-limit policy was not found; request denied.",
      );
    }
    const policy = validateRateLimitPolicyV1(policyValue);
    if (
      policy.dimension !== request.dimension ||
      policy.environment !== request.environment
    ) {
      throw new RateLimitError(
        "CONFIGURATION_ERROR",
        "Rate-limit policy scope does not match the request.",
      );
    }

    const nowMs = readClock(this.#clock);
    const window = buildWindow(policy, nowMs);
    const keyFingerprint = createRateLimitKeyFingerprintV1(
      request.dimension,
      request.key,
    );
    const effectiveLimit = policy.maxRequests + policy.burst;
    if (!policy.enabled) {
      return createDecision({
        policy,
        request,
        keyFingerprint,
        window,
        allowed: false,
        code: "POLICY_DISABLED",
        remaining: 0,
      });
    }

    try {
      const repositoryResult =
        validateRateLimitRepositoryResultV1(
          await this.#repository.consume({
            schemaVersion:
              RATE_LIMIT_COUNTER_COMMAND_SCHEMA_VERSION,
            dimension: request.dimension,
            environment: request.environment,
            key: request.key,
            keyFingerprint,
            policyVersion: policy.version,
            bucket: window.bucket,
            windowStartedAtMs: window.startedAtMs,
            windowEndsAtMs: window.endsAtMs,
            evaluatedAtMs: nowMs,
            windowSeconds: policy.windowSeconds,
            maxRequests: policy.maxRequests,
            burst: policy.burst,
            effectiveLimit,
          }),
          effectiveLimit,
        );
      return createDecision({
        policy,
        request,
        keyFingerprint,
        window,
        allowed: repositoryResult.allowed,
        code: repositoryResult.allowed
          ? "RATE_LIMIT_ALLOWED"
          : "RATE_LIMIT_EXCEEDED",
        remaining: repositoryResult.remaining,
      });
    } catch (error: unknown) {
      if (isRateLimitError(error)) throw error;
      throw new RateLimitError(
        "INTERNAL_RATE_LIMIT_FAILURE",
        "Rate-limit repository failed; request denied.",
        { cause: error },
      );
    }
  }
}
