import fs from "node:fs";
import path from "node:path";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  FirestoreRateLimitRepository,
} from "../../../src/infrastructure/firestore/rateLimits/FirestoreRateLimitRepository";
import {
  FIRESTORE_RATE_LIMIT_COLLECTION,
} from "../../../src/infrastructure/firestore/rateLimits/firestoreRateLimitCollections";
import type {
  FirestoreRateLimitTransactionRunner,
} from "../../../src/infrastructure/firestore/rateLimits/firestoreRateLimitTransaction";
import {
  RateLimitEvaluator,
} from "../../../src/rateLimits/RateLimitEvaluator";
import {
  RateLimitError,
} from "../../../src/rateLimits/rateLimitErrors";
import {
  createRateLimitKeyFingerprintV1,
  deriveRateLimitHmacKeyV1,
  rateLimitKeysEqualV1,
} from "../../../src/rateLimits/rateLimitKeys";
import type {
  RateLimitPolicyProvider,
  RateLimitRepository,
} from "../../../src/rateLimits/rateLimitPorts";
import {
  StaticRateLimitPolicyProvider,
} from "../../../src/rateLimits/StaticRateLimitPolicyProvider";
import {
  RATE_LIMIT_DIMENSIONS,
  type RateLimitDecisionV1,
  type RateLimitDimension,
  type RateLimitEvaluationRequestV1,
  type RateLimitKeyV1,
  type RateLimitPolicyV1,
} from "../../../src/rateLimits/rateLimitTypes";
import {
  validateRateLimitKeyV1,
} from "../../../src/rateLimits/rateLimitValidation";
import {
  InstrumentedFirestoreRateLimitTransactionRunner,
  createEmulatorRateLimitHarness,
  type EmulatorRateLimitHarness,
} from "./emulatorRateLimitHarness";
import {
  MutableRateLimitClock,
  TEST_ENVIRONMENT,
  TEST_HMAC_SECRET,
  TEST_KEY_VERSION,
  TEST_NOW_MS,
  TEST_WINDOW_SECONDS,
  hmacKey,
  policy,
  request,
} from "./rateLimitFixtures";

let harness: EmulatorRateLimitHarness;

function evaluator(input: Readonly<{
  policies?: readonly RateLimitPolicyV1[];
  clock?: MutableRateLimitClock;
  repository?: RateLimitRepository;
  policyProvider?: RateLimitPolicyProvider;
  transactionRunner?: FirestoreRateLimitTransactionRunner;
}> = {}): RateLimitEvaluator {
  const repository =
    input.repository ??
    new FirestoreRateLimitRepository(
      harness.firestore,
      input.transactionRunner,
    );
  return new RateLimitEvaluator(
    input.policyProvider ??
      new StaticRateLimitPolicyProvider(
        input.policies ?? [policy()],
      ),
    repository,
    input.clock ?? new MutableRateLimitClock(),
  );
}

async function counterDocuments() {
  return harness.firestore
    .collection(FIRESTORE_RATE_LIMIT_COLLECTION)
    .get();
}

function decisionCounts(
  decisions: readonly RateLimitDecisionV1[],
): Readonly<Record<string, number>> {
  return Object.freeze({
    allowed: decisions.filter(
      (decision) => decision.decision === "ALLOW",
    ).length,
    denied: decisions.filter(
      (decision) => decision.decision === "DENY",
    ).length,
  });
}

beforeAll(() => {
  harness = createEmulatorRateLimitHarness();
});

beforeEach(async () => {
  await harness.clear();
});

afterAll(async () => {
  await harness.close();
});

describe("atomic public rate-limit contracts", () => {
  it("derives stable purpose-separated HMAC keys without exposing raw subjects", () => {
    const rawSubject = "synthetic-ip-or-email-value";
    const first = deriveRateLimitHmacKeyV1({
      dimension: "IP_HASH",
      canonicalValue: rawSubject,
      secret: TEST_HMAC_SECRET,
      keyVersion: TEST_KEY_VERSION,
    });
    const retry = deriveRateLimitHmacKeyV1({
      dimension: "IP_HASH",
      canonicalValue: rawSubject,
      secret: TEST_HMAC_SECRET,
      keyVersion: TEST_KEY_VERSION,
    });
    const anotherDimension = deriveRateLimitHmacKeyV1({
      dimension: "EMAIL_HASH",
      canonicalValue: rawSubject,
      secret: TEST_HMAC_SECRET,
      keyVersion: TEST_KEY_VERSION,
    });
    const anotherSubject = deriveRateLimitHmacKeyV1({
      dimension: "IP_HASH",
      canonicalValue: `${rawSubject}-different`,
      secret: TEST_HMAC_SECRET,
      keyVersion: TEST_KEY_VERSION,
    });

    expect(first).toEqual(retry);
    expect(rateLimitKeysEqualV1(first, retry)).toBe(true);
    expect(first.value).toHaveLength(64);
    expect(first.value).not.toContain(rawSubject);
    expect(anotherDimension.value).not.toBe(first.value);
    expect(anotherSubject.value).not.toBe(first.value);
    expect(
      createRateLimitKeyFingerprintV1("IP_HASH", first),
    ).toBe(
      createRateLimitKeyFingerprintV1("IP_HASH", retry),
    );
  });

  it("requires HMAC keys for every sensitive dimension", () => {
    const opaqueKey: RateLimitKeyV1 = {
      scheme: "OPAQUE_V1",
      version: TEST_KEY_VERSION,
      value: "raw-sensitive-identifier",
    };
    for (const dimension of [
      "EMAIL_HASH",
      "IP_HASH",
      "COMMERCIAL_CODE_HASH",
      "SESSION_HASH",
      "LINK_HASH",
    ] as const) {
      expect(() =>
        validateRateLimitKeyV1(opaqueKey, dimension),
      ).toThrowError(
        expect.objectContaining({ code: "CONFIGURATION_ERROR" }),
      );
    }
  });

  it("supports all certified dimensions without sharing counters", async () => {
    const policies = RATE_LIMIT_DIMENSIONS.map((dimension) =>
      policy({ dimension }),
    );
    const rateLimitEvaluator = evaluator({ policies });
    const keys = new Map<RateLimitDimension, RateLimitKeyV1>();
    for (const dimension of RATE_LIMIT_DIMENSIONS) {
      if (dimension === "GLOBAL") {
        keys.set(dimension, {
          scheme: "OPAQUE_V1",
          version: TEST_KEY_VERSION,
          value: "global",
        });
      } else if (dimension === "CUSTOM") {
        keys.set(dimension, {
          scheme: "OPAQUE_V1",
          version: TEST_KEY_VERSION,
          value: "custom.synthetic",
        });
      } else {
        keys.set(dimension, hmacKey(dimension));
      }
    }

    const decisions = await Promise.all(
      RATE_LIMIT_DIMENSIONS.map((dimension) =>
        rateLimitEvaluator.evaluate(
          request(dimension, keys.get(dimension)),
        ),
      ),
    );

    expect(
      decisions.every(
        (decision) => decision.code === "RATE_LIMIT_ALLOWED",
      ),
    ).toBe(true);
    expect(
      await harness.count(FIRESTORE_RATE_LIMIT_COLLECTION),
    ).toBe(RATE_LIMIT_DIMENSIONS.length);
  });

  it("allows exactly one of two simultaneous requests at quota one", async () => {
    const rateLimitEvaluator = evaluator({
      policies: [policy({ maxRequests: 1 })],
    });
    const [first, second] = await Promise.all([
      rateLimitEvaluator.evaluate(request()),
      rateLimitEvaluator.evaluate(request()),
    ]);

    expect(decisionCounts([first, second])).toEqual({
      allowed: 1,
      denied: 1,
    });
    const counters = await counterDocuments();
    expect(counters.size).toBe(1);
    expect(counters.docs[0].data()).toMatchObject({ count: 1 });
  });

  it("holds the exact quota under one hundred parallel requests", async () => {
    const maxRequests = 20;
    const burst = 5;
    const effectiveLimit = maxRequests + burst;
    const parallelRepositoryCount = 10;
    const rateLimitEvaluators = Array.from(
      { length: parallelRepositoryCount },
      () =>
        evaluator({
          policies: [policy({ maxRequests, burst })],
        }),
    );
    const decisions = await Promise.all(
      Array.from({ length: 100 }, (_, index) =>
        rateLimitEvaluators[
          index % parallelRepositoryCount
        ].evaluate(request()),
      ),
    );

    expect(decisionCounts(decisions)).toEqual({
      allowed: effectiveLimit,
      denied: 100 - effectiveLimit,
    });
    const counters = await counterDocuments();
    expect(counters.size).toBe(1);
    expect(counters.docs[0].data()).toMatchObject({
      count: effectiveLimit,
      maxRequests,
      burst,
      effectiveLimit,
    });
  });

  it("rolls over deterministically into a new fixed window", async () => {
    const clock = new MutableRateLimitClock(TEST_NOW_MS);
    const rateLimitEvaluator = evaluator({
      clock,
      policies: [policy({ maxRequests: 1 })],
    });
    const first = await rateLimitEvaluator.evaluate(request());
    const denied = await rateLimitEvaluator.evaluate(request());
    clock.nowMs =
      Math.floor(TEST_NOW_MS / (TEST_WINDOW_SECONDS * 1_000)) *
        TEST_WINDOW_SECONDS *
        1_000 +
      TEST_WINDOW_SECONDS * 1_000;
    const nextWindow = await rateLimitEvaluator.evaluate(request());

    expect(first.decision).toBe("ALLOW");
    expect(denied.code).toBe("RATE_LIMIT_EXCEEDED");
    expect(nextWindow.decision).toBe("ALLOW");
    expect(nextWindow.bucket).not.toBe(first.bucket);
    expect(
      await harness.count(FIRESTORE_RATE_LIMIT_COLLECTION),
    ).toBe(2);
  });

  it("applies burst, remaining and retryAfter at the exact boundary", async () => {
    const maxRequests = 2;
    const burst = 3;
    const rateLimitEvaluator = evaluator({
      policies: [policy({ maxRequests, burst })],
    });
    const decisions: RateLimitDecisionV1[] = [];
    for (let index = 0; index < maxRequests + burst + 1; index += 1) {
      decisions.push(await rateLimitEvaluator.evaluate(request()));
    }
    const lastAllowed = decisions[maxRequests + burst - 1];
    const denied = decisions[maxRequests + burst];

    expect(lastAllowed).toMatchObject({
      decision: "ALLOW",
      remaining: 0,
      retryAfterSeconds: 0,
      quota: { maxRequests, burst, effectiveLimit: 5 },
    });
    expect(denied).toMatchObject({
      decision: "DENY",
      code: "RATE_LIMIT_EXCEEDED",
      remaining: 0,
      retryAfterSeconds: 60,
    });
  });

  it("fails closed without writes when a policy is disabled", async () => {
    const decision = await evaluator({
      policies: [policy({ enabled: false })],
    }).evaluate(request());

    expect(decision).toMatchObject({
      decision: "DENY",
      code: "POLICY_DISABLED",
      remaining: 0,
    });
    expect(await harness.collectionIds()).toEqual([]);
  });

  it("fails closed with POLICY_NOT_FOUND when no policy exists", async () => {
    await expect(
      evaluator({ policies: [] }).evaluate(request()),
    ).rejects.toMatchObject({ code: "POLICY_NOT_FOUND" });
    expect(await harness.collectionIds()).toEqual([]);
  });

  it("normalizes invalid clocks and policy configuration", async () => {
    const clock = new MutableRateLimitClock(Number.NaN);
    await expect(
      evaluator({ clock }).evaluate(request()),
    ).rejects.toMatchObject({ code: "CLOCK_ERROR" });
    expect(() =>
      new StaticRateLimitPolicyProvider([
        policy({ maxRequests: 0 }),
      ]),
    ).toThrowError(
      expect.objectContaining({ code: "CONFIGURATION_ERROR" }),
    );
    expect(await harness.collectionIds()).toEqual([]);
  });

  it("fails closed when the clock moves backwards inside a window", async () => {
    const clock = new MutableRateLimitClock(TEST_NOW_MS);
    const rateLimitEvaluator = evaluator({ clock });
    await rateLimitEvaluator.evaluate(request());
    clock.nowMs = TEST_NOW_MS - 1;

    await expect(
      rateLimitEvaluator.evaluate(request()),
    ).rejects.toMatchObject({ code: "CLOCK_ERROR" });
    const counters = await counterDocuments();
    expect(counters.docs[0].data()).toMatchObject({ count: 1 });
  });

  it("fails closed when a persisted counter is corrupted", async () => {
    const rateLimitEvaluator = evaluator();
    await rateLimitEvaluator.evaluate(request());
    const counters = await counterDocuments();
    await counters.docs[0].ref.update({ count: "corrupted" });

    await expect(
      rateLimitEvaluator.evaluate(request()),
    ).rejects.toMatchObject({ code: "COUNTER_CORRUPTED" });
  });

  it("survives a real Firestore transaction conflict deterministically", async () => {
    const transactionRunner =
      new InstrumentedFirestoreRateLimitTransactionRunner(
        harness.firestore,
        { abortFirstCallback: true },
      );
    const decision = await evaluator({ transactionRunner }).evaluate(
      request(),
    );

    expect(decision).toMatchObject({
      decision: "ALLOW",
      remaining: 9,
    });
    expect(transactionRunner.callbackCount).toBeGreaterThan(1);
    const counters = await counterDocuments();
    expect(counters.docs[0].data()).toMatchObject({ count: 1 });
  });

  it("normalizes unknown provider and repository failures", async () => {
    const failedProvider: RateLimitPolicyProvider = {
      async getPolicy() {
        throw new Error("controlled provider failure");
      },
    };
    const failedRepository: RateLimitRepository = {
      async consume() {
        throw new Error("controlled repository failure");
      },
    };

    await expect(
      evaluator({ policyProvider: failedProvider }).evaluate(request()),
    ).rejects.toMatchObject({ code: "CONFIGURATION_ERROR" });
    await expect(
      evaluator({ repository: failedRepository }).evaluate(request()),
    ).rejects.toMatchObject({
      code: "INTERNAL_RATE_LIMIT_FAILURE",
    });
  });
});

describe("atomic public rate-limit architecture", () => {
  it("keeps the core Firestore-free and the adapter handler-free", () => {
    const repositoryRoot = path.resolve(
      __dirname,
      "..",
      "..",
      "..",
      "..",
    );
    const coreDirectory = path.join(
      repositoryRoot,
      "functions",
      "src",
      "rateLimits",
    );
    const adapterDirectory = path.join(
      repositoryRoot,
      "functions",
      "src",
      "infrastructure",
      "firestore",
      "rateLimits",
    );
    const sourceText = (directory: string) =>
      fs
        .readdirSync(directory)
        .filter((file) => file.endsWith(".ts"))
        .map((file) =>
          fs.readFileSync(path.join(directory, file), "utf8"),
        )
        .join("\n");
    const coreSources = sourceText(coreDirectory);
    const adapterSources = sourceText(adapterDirectory);
    const functionsIndex = fs.readFileSync(
      path.join(repositoryRoot, "functions", "src", "index.ts"),
      "utf8",
    );

    expect(coreSources).not.toMatch(/firebase-admin|\.collection\s*\(/);
    expect(adapterSources).toContain("runTransaction");
    expect(adapterSources).toContain(FIRESTORE_RATE_LIMIT_COLLECTION);
    expect(adapterSources).not.toContain('"platform_rate_limits"');
    expect(functionsIndex).not.toContain("RateLimitEvaluator");
    expect(functionsIndex).not.toContain(
      "FirestoreRateLimitRepository",
    );
  });

  it("does not wire infrastructure into the prohibited public handlers", () => {
    const repositoryRoot = path.resolve(
      __dirname,
      "..",
      "..",
      "..",
      "..",
    );
    const prohibitedHandlers = [
      "functions/src/discovery/createDiscoveryLead.ts",
      "functions/src/intelligence/evaluateConversation.ts",
      "functions/src/discovery/reports/requestExecutiveDocument.ts",
      "functions/src/discovery/completeDiscoverySession.ts",
    ];
    for (const relativePath of prohibitedHandlers) {
      const source = fs.readFileSync(
        path.join(repositoryRoot, relativePath),
        "utf8",
      );
      expect(source).not.toMatch(
        /from\s+["'][^"']*rateLimits|RateLimitEvaluator/,
      );
    }
  });

  it("uses only test Firebase configuration with no deploy or production project", () => {
    const emulatorRoot = path.resolve(__dirname, "..");
    const config = fs.readFileSync(
      path.join(emulatorRoot, "firebase.rateLimits.json"),
      "utf8",
    );
    const runner = fs.readFileSync(
      path.join(
        emulatorRoot,
        "runFirestoreRateLimitEmulator.cjs",
      ),
      "utf8",
    );

    expect(config).toContain("firestore.emulator.rules");
    expect(config).not.toContain("firestore.rules");
    expect(config).not.toContain("firestore.indexes.json");
    expect(runner).not.toMatch(/\bdeploy\b|firebase\s+use/);
    expect(runner).not.toMatch(/aura-control-center-[a-z0-9]+/);
  });
});
