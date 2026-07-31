import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import {
  AUTHORITY_APPLICATION_RESULT_STATUSES,
  createAuthorityApplicationServiceV1,
  type AuthorityApplicationExecutionContextV1,
  type AuthorityApplicationResultStatus,
  type AuthorityApplicationServiceRequestV1,
  type AuthorityApplicationServiceResultV1,
  type AuthorityApplicationServiceV1,
  type AuthorityClockPort,
} from "@aura/intelligence-os/server";
import { describe, expect, it } from "vitest";

import {
  AuthorityDarkHandlerCompositionError,
  AuthorityDarkHandlerInvocationError,
  createAuthorityDarkHandlerCompositionV1,
  type AuthorityDarkHandlerCompositionV1,
} from "../src/composition/authorityDarkHandlerComposition";
import {
  createAuthorityDarkHandlerTestCapabilityV1ForInternalTests,
  type AuthorityDarkHandlerTestCapabilityV1,
} from "../src/composition/authorityDarkHandlerComposition/authorityDarkHandlerTestCapability";
import {
  createAuthorityDarkCompositionTestCapabilityForInternalTests,
} from "../src/composition/authorityDarkComposition/authorityDarkCompositionTestCapability";
import {
  applicationRequest,
  authorizationDecision,
  dependencies,
  dependencyState,
  executionContext,
  resolvedScope,
} from "../../src/modules/intelligence/serverAuthorityApplicationService/tests/fixtures";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const FUNCTIONS_ROOT = path.join(ROOT, "functions");
const COMPOSITION_ROOT = path.join(
  FUNCTIONS_ROOT,
  "src",
  "composition",
  "authorityDarkHandlerComposition",
);
const INVOKED_AT = "2026-07-30T12:02:00.000Z";
const METADATA = Object.freeze({
  schemaVersion: "1" as const,
  compositionId: "authority-dark-handler-test-001",
  purpose: "AUTHORITY_DARK_HANDLER_TEST" as const,
});

interface ClockState {
  calls: number;
  value: string;
  abortController?: AbortController;
}

interface ServiceState {
  calls: number;
  request?: AuthorityApplicationServiceRequestV1;
  context?: AuthorityApplicationExecutionContextV1;
  throwValue?: unknown;
}

function fixedClock(
  state: ClockState = { calls: 0, value: INVOKED_AT },
): AuthorityClockPort {
  return {
    nowIso() {
      state.calls += 1;
      state.abortController?.abort();
      return state.value;
    },
  };
}

function applicationResult(
  status: AuthorityApplicationResultStatus = "APPLIED",
): AuthorityApplicationServiceResultV1 {
  return Object.freeze({
    schemaVersion: "1",
    status,
    safeCode: status === "APPLIED"
      ? "AUTHORITY_OPERATION_APPLIED"
      : "AUTHORITY_INTERNAL_FAILURE",
    retryDisposition: "DO_NOT_RETRY",
    stageTrace: Object.freeze([]),
    metadata: Object.freeze({
      operationId: "operation_001",
      correlationId: "correlation_001",
      maskNotFound: false,
    }),
  });
}

function fakeService(
  state: ServiceState,
  result: AuthorityApplicationServiceResultV1 = applicationResult(),
): AuthorityApplicationServiceV1 {
  return Object.freeze({
    version: "1",
    async execute(request, context) {
      state.calls += 1;
      state.request = request;
      state.context = context;
      if (state.throwValue !== undefined) {
        throw state.throwValue;
      }
      return result;
    },
  });
}

function readyComposition(
  service: AuthorityApplicationServiceV1,
  capability: AuthorityDarkHandlerTestCapabilityV1,
  clock: AuthorityClockPort = fixedClock(),
): Extract<
  AuthorityDarkHandlerCompositionV1,
  { mode: "TEST_ONLY" }
> {
  const composition = createAuthorityDarkHandlerCompositionV1({
    mode: "TEST_ONLY",
    capability,
    applicationService: service,
    clock,
    metadata: METADATA,
  });
  if (composition.mode !== "TEST_ONLY") {
    throw new Error("Test composition fixture is invalid.");
  }
  return composition;
}

function testContext(
  overrides: Readonly<Record<string, unknown>> = {},
): AuthorityApplicationExecutionContextV1 {
  return executionContext({
    executionMode: "TEST_ONLY",
    ...overrides,
  });
}

function expectCompositionError(
  action: () => unknown,
  code: AuthorityDarkHandlerCompositionError["code"],
): void {
  try {
    action();
    throw new Error("Expected composition rejection.");
  } catch (error) {
    expect(error).toBeInstanceOf(AuthorityDarkHandlerCompositionError);
    expect((error as AuthorityDarkHandlerCompositionError).code).toBe(code);
  }
}

async function expectInvocationError(
  action: () => Promise<unknown>,
  code: AuthorityDarkHandlerInvocationError["code"],
): Promise<AuthorityDarkHandlerInvocationError> {
  try {
    await action();
    throw new Error("Expected invocation rejection.");
  } catch (error) {
    expect(error).toBeInstanceOf(AuthorityDarkHandlerInvocationError);
    const invocationError = error as AuthorityDarkHandlerInvocationError;
    expect(invocationError.code).toBe(code);
    return invocationError;
  }
}

function listTypeScriptFiles(directory: string): readonly string[] {
  return readdirSync(directory).flatMap((entry) => {
    const absolutePath = path.join(directory, entry);
    return statSync(absolutePath).isDirectory()
      ? listTypeScriptFiles(absolutePath)
      : absolutePath.endsWith(".ts")
        ? [absolutePath]
        : [];
  });
}

describe("Authority dark handler composition factory", () => {
  it("creates the closed immutable DISABLED / INERT form", () => {
    const composition = createAuthorityDarkHandlerCompositionV1({
      mode: "DISABLED",
    });
    expect(composition).toEqual({
      version: "1",
      mode: "DISABLED",
      status: "INERT",
    });
    expect(Object.isFrozen(composition)).toBe(true);
    expect("execute" in composition).toBe(false);
    expect("invocation" in composition).toBe(false);
  });

  it.each(["applicationService", "capability", "clock", "metadata"])(
    "rejects ambiguous DISABLED dependency %s",
    (field) => {
      expectCompositionError(
        () => createAuthorityDarkHandlerCompositionV1({
          mode: "DISABLED",
          [field]: {},
        }),
        "AUTHORITY_DARK_HANDLER_AMBIGUOUS_DISABLED_INPUT",
      );
    },
  );

  it("creates the closed immutable TEST_ONLY / READY_FOR_TEST form", () => {
    const state = { calls: 0 };
    const capability =
      createAuthorityDarkHandlerTestCapabilityV1ForInternalTests();
    const composition = readyComposition(fakeService(state), capability);
    expect(composition.version).toBe("1");
    expect(composition.status).toBe("READY_FOR_TEST");
    expect(Object.keys(composition)).toEqual([
      "version",
      "mode",
      "status",
      "metadata",
      "invocation",
    ]);
    expect(Object.keys(composition.invocation)).toEqual([
      "invokeTestOnly",
    ]);
    expect(Object.isFrozen(composition)).toBe(true);
    expect(Object.isFrozen(composition.metadata)).toBe(true);
    expect(Object.isFrozen(composition.invocation)).toBe(true);
  });

  it.each([
    undefined,
    false,
    "test",
    {},
    { version: "1", assertInternalTestIntent: () => undefined },
    createAuthorityDarkCompositionTestCapabilityForInternalTests(),
  ])("rejects absent or forged capability %#", (capability) => {
    expectCompositionError(
      () => createAuthorityDarkHandlerCompositionV1({
        mode: "TEST_ONLY",
        capability,
        applicationService: fakeService({ calls: 0 }),
        clock: fixedClock(),
        metadata: METADATA,
      }),
      "AUTHORITY_DARK_HANDLER_TEST_CAPABILITY_REQUIRED",
    );
  });

  it("rejects cloned and serialized capability shapes", () => {
    const capability =
      createAuthorityDarkHandlerTestCapabilityV1ForInternalTests();
    const cloned = { ...capability };
    const serialized = JSON.stringify(capability);
    const reconstructed: unknown = JSON.parse(serialized);
    expect(serialized).not.toContain("assertInternalTestIntent");
    for (const candidate of [cloned, reconstructed]) {
      expectCompositionError(
        () => createAuthorityDarkHandlerCompositionV1({
          mode: "TEST_ONLY",
          capability: candidate,
          applicationService: fakeService({ calls: 0 }),
          clock: fixedClock(),
          metadata: METADATA,
        }),
        "AUTHORITY_DARK_HANDLER_TEST_CAPABILITY_REQUIRED",
      );
    }
  });

  it.each(["ENABLED", "PRODUCTION", "LIVE", "SHADOW_PRODUCTION"])(
    "rejects unknown mode %s",
    (mode) => {
      expectCompositionError(
        () => createAuthorityDarkHandlerCompositionV1({ mode }),
        "AUTHORITY_DARK_HANDLER_UNKNOWN_MODE",
      );
    },
  );

  it("rejects unknown TEST_ONLY input fields", () => {
    const capability =
      createAuthorityDarkHandlerTestCapabilityV1ForInternalTests();
    expectCompositionError(
      () => createAuthorityDarkHandlerCompositionV1({
        mode: "TEST_ONLY",
        capability,
        applicationService: fakeService({ calls: 0 }),
        clock: fixedClock(),
        metadata: METADATA,
        enabled: true,
      }),
      "AUTHORITY_DARK_HANDLER_INVALID_INPUT",
    );
  });

  it.each([
    undefined,
    {},
    { version: "2", execute: () => undefined },
    { version: "1", execute: "not-a-function" },
  ])("rejects invalid Application Service %#", (applicationService) => {
    expectCompositionError(
      () => createAuthorityDarkHandlerCompositionV1({
        mode: "TEST_ONLY",
        capability:
          createAuthorityDarkHandlerTestCapabilityV1ForInternalTests(),
        applicationService,
        clock: fixedClock(),
        metadata: METADATA,
      }),
      "AUTHORITY_DARK_HANDLER_APPLICATION_SERVICE_REQUIRED",
    );
  });

  it("rejects invalid clocks and metadata", () => {
    const capability =
      createAuthorityDarkHandlerTestCapabilityV1ForInternalTests();
    const service = fakeService({ calls: 0 });
    expectCompositionError(
      () => createAuthorityDarkHandlerCompositionV1({
        mode: "TEST_ONLY",
        capability,
        applicationService: service,
        clock: {},
        metadata: METADATA,
      }),
      "AUTHORITY_DARK_HANDLER_CLOCK_REQUIRED",
    );
    expectCompositionError(
      () => createAuthorityDarkHandlerCompositionV1({
        mode: "TEST_ONLY",
        capability,
        applicationService: service,
        clock: fixedClock(),
        metadata: { ...METADATA, unexpected: true },
      }),
      "AUTHORITY_DARK_HANDLER_METADATA_INVALID",
    );
  });

  it("does not call service or clock during deterministic construction", () => {
    const serviceState = { calls: 0 };
    const clockState = { calls: 0, value: INVOKED_AT };
    const capability =
      createAuthorityDarkHandlerTestCapabilityV1ForInternalTests();
    const first = readyComposition(
      fakeService(serviceState),
      capability,
      fixedClock(clockState),
    );
    const second = readyComposition(
      fakeService(serviceState),
      capability,
      fixedClock(clockState),
    );
    expect(serviceState.calls).toBe(0);
    expect(clockState.calls).toBe(0);
    expect([
      first.version,
      first.mode,
      first.status,
      first.metadata,
    ]).toEqual([
      second.version,
      second.mode,
      second.status,
      second.metadata,
    ]);
  });
});

describe("Authority dark handler test-only invocation", () => {
  it("delegates exactly once with identical request, context and command", async () => {
    const result = applicationResult("APPLIED");
    const serviceState = { calls: 0 };
    const capability =
      createAuthorityDarkHandlerTestCapabilityV1ForInternalTests();
    const composition = readyComposition(
      fakeService(serviceState, result),
      capability,
    );
    const request = applicationRequest();
    const context = testContext();
    const observed = await composition.invocation.invokeTestOnly(
      request,
      context,
      capability,
    );
    expect(serviceState.calls).toBe(1);
    expect(serviceState.request).toBe(request);
    expect(serviceState.context).toBe(context);
    expect(serviceState.request?.command).toBe(request.command);
    expect(observed).toBe(result);
  });

  it.each(AUTHORITY_APPLICATION_RESULT_STATUSES)(
    "preserves the exact %s result",
    async (status) => {
      const result = applicationResult(status);
      const capability =
        createAuthorityDarkHandlerTestCapabilityV1ForInternalTests();
      const composition = readyComposition(
        fakeService({ calls: 0 }, result),
        capability,
      );
      await expect(
        composition.invocation.invokeTestOnly(
          applicationRequest(),
          testContext(),
          capability,
        ),
      ).resolves.toBe(result);
    },
  );

  it("rejects another authentic capability instance", async () => {
    const serviceState = { calls: 0 };
    const configured =
      createAuthorityDarkHandlerTestCapabilityV1ForInternalTests();
    const other =
      createAuthorityDarkHandlerTestCapabilityV1ForInternalTests();
    const composition = readyComposition(
      fakeService(serviceState),
      configured,
    );
    await expectInvocationError(
      () => composition.invocation.invokeTestOnly(
        applicationRequest(),
        testContext(),
        other,
      ),
      "AUTHORITY_DARK_HANDLER_INVOCATION_CAPABILITY_INVALID",
    );
    expect(serviceState.calls).toBe(0);
  });

  it.each([false, "test", {}, { version: "1" }])(
    "rejects forged invocation capability %#",
    async (candidate) => {
      const serviceState = { calls: 0 };
      const capability =
        createAuthorityDarkHandlerTestCapabilityV1ForInternalTests();
      const composition = readyComposition(
        fakeService(serviceState),
        capability,
      );
      await expectInvocationError(
        () => composition.invocation.invokeTestOnly(
          applicationRequest(),
          testContext(),
          candidate as AuthorityDarkHandlerTestCapabilityV1,
        ),
        "AUTHORITY_DARK_HANDLER_INVOCATION_CAPABILITY_INVALID",
      );
      expect(serviceState.calls).toBe(0);
    },
  );

  it("rejects invalid request before service", async () => {
    const serviceState = { calls: 0 };
    const capability =
      createAuthorityDarkHandlerTestCapabilityV1ForInternalTests();
    const composition = readyComposition(
      fakeService(serviceState),
      capability,
    );
    await expectInvocationError(
      () => composition.invocation.invokeTestOnly(
        {} as AuthorityApplicationServiceRequestV1,
        testContext(),
        capability,
      ),
      "AUTHORITY_DARK_HANDLER_INVOCATION_REQUEST_INVALID",
    );
    expect(serviceState.calls).toBe(0);
  });

  it("rejects invalid, missing-mode and non-test contexts", async () => {
    const cases = [
      [{}, "AUTHORITY_DARK_HANDLER_INVOCATION_CONTEXT_INVALID"],
      [
        { ...testContext(), executionMode: undefined },
        "AUTHORITY_DARK_HANDLER_INVOCATION_CONTEXT_INVALID",
      ],
      [
        executionContext({ executionMode: "INTERNAL_NON_PRODUCTIVE" }),
        "AUTHORITY_DARK_HANDLER_INVOCATION_MODE_FORBIDDEN",
      ],
      [
        { ...testContext(), executionMode: "PRODUCTION" },
        "AUTHORITY_DARK_HANDLER_INVOCATION_CONTEXT_INVALID",
      ],
    ] as const;
    for (const [context, code] of cases) {
      const serviceState = { calls: 0 };
      const capability =
        createAuthorityDarkHandlerTestCapabilityV1ForInternalTests();
      const composition = readyComposition(
        fakeService(serviceState),
        capability,
      );
      await expectInvocationError(
        () => composition.invocation.invokeTestOnly(
          applicationRequest(),
          context as AuthorityApplicationExecutionContextV1,
          capability,
        ),
        code,
      );
      expect(serviceState.calls).toBe(0);
    }
  });

  it("rejects cancellation before and during clock evaluation", async () => {
    for (const abortDuringClock of [false, true]) {
      const controller = new AbortController();
      if (!abortDuringClock) {
        controller.abort();
      }
      const clockState: ClockState = {
        calls: 0,
        value: INVOKED_AT,
        ...(abortDuringClock ? { abortController: controller } : {}),
      };
      const serviceState = { calls: 0 };
      const capability =
        createAuthorityDarkHandlerTestCapabilityV1ForInternalTests();
      const composition = readyComposition(
        fakeService(serviceState),
        capability,
        fixedClock(clockState),
      );
      await expectInvocationError(
        () => composition.invocation.invokeTestOnly(
          applicationRequest(),
          testContext({ cancellationSignal: controller.signal }),
          capability,
        ),
        "AUTHORITY_DARK_HANDLER_INVOCATION_CANCELLED",
      );
      expect(serviceState.calls).toBe(0);
    }
  });

  it("rejects expired deadlines and invalid clock output", async () => {
    for (const [clockValue, code] of [
      [
        "2026-07-30T12:04:00.000Z",
        "AUTHORITY_DARK_HANDLER_INVOCATION_DEADLINE_EXPIRED",
      ],
      [
        "invalid-time",
        "AUTHORITY_DARK_HANDLER_INVOCATION_CLOCK_INVALID",
      ],
    ] as const) {
      const serviceState = { calls: 0 };
      const capability =
        createAuthorityDarkHandlerTestCapabilityV1ForInternalTests();
      const composition = readyComposition(
        fakeService(serviceState),
        capability,
        fixedClock({ calls: 0, value: clockValue }),
      );
      await expectInvocationError(
        () => composition.invocation.invokeTestOnly(
          applicationRequest(),
          testContext(),
          capability,
        ),
        code,
      );
      expect(serviceState.calls).toBe(0);
    }
  });

  it("maps service throws to a constant safe error without sensitive data", async () => {
    const sensitive = [
      "raw-payload-secret",
      "principal-sensitive",
      "tenant-sensitive",
      "command-sensitive",
    ];
    const capability =
      createAuthorityDarkHandlerTestCapabilityV1ForInternalTests();
    const error = await expectInvocationError(
      () => readyComposition(
        fakeService({ calls: 0, throwValue: new Error(sensitive.join(" ")) }),
        capability,
      ).invocation.invokeTestOnly(
        applicationRequest(),
        testContext(),
        capability,
      ),
      "AUTHORITY_DARK_HANDLER_INVOCATION_SERVICE_FAILED",
    );
    const serialized = JSON.stringify(error);
    for (const term of sensitive) {
      expect(serialized).not.toContain(term);
    }
    expect(serialized).not.toContain("stack");
    expect(error.message).toBe(
      "Authority dark handler invocation rejected.",
    );
  });

  it("does not turn a capability into authorization", async () => {
    const result = applicationResult("NOT_AUTHORIZED");
    const capability =
      createAuthorityDarkHandlerTestCapabilityV1ForInternalTests();
    const observed = await readyComposition(
      fakeService({ calls: 0 }, result),
      capability,
    ).invocation.invokeTestOnly(
      applicationRequest(),
      testContext(),
      capability,
    );
    expect(observed).toBe(result);
    expect(observed.status).toBe("NOT_AUTHORIZED");
  });
});

describe("Authority dark handler full application composition", () => {
  it("runs the deterministic happy path and preserves the repository command", async () => {
    const state = dependencyState();
    const service = createAuthorityApplicationServiceV1(
      dependencies(state),
    );
    const capability =
      createAuthorityDarkHandlerTestCapabilityV1ForInternalTests();
    const request = applicationRequest();
    const context = testContext();
    const result = await readyComposition(
      service,
      capability,
    ).invocation.invokeTestOnly(request, context, capability);
    expect(result.status).toBe("APPLIED");
    expect(result.stageTrace.at(-1)?.stage).toBe("RESULT_MAPPING");
    expect(state.repositoryCalls).toBe(1);
    expect(state.repositoryCommand).toBe(request.command);
  });

  it("keeps DENY away from the repository", async () => {
    const state = dependencyState();
    state.authorizationResult = {
      schemaVersion: "1",
      status: "DECIDED",
      decision: authorizationDecision("DENY"),
    };
    const capability =
      createAuthorityDarkHandlerTestCapabilityV1ForInternalTests();
    const result = await readyComposition(
      createAuthorityApplicationServiceV1(dependencies(state)),
      capability,
    ).invocation.invokeTestOnly(
      applicationRequest(),
      testContext(),
      capability,
    );
    expect(result.status).toBe("NOT_AUTHORIZED");
    expect(state.repositoryCalls).toBe(0);
  });

  it("keeps an inactive membership away from authorization and repository", async () => {
    const state = dependencyState();
    const scope = resolvedScope();
    state.scopeResult = {
      schemaVersion: "1",
      status: "RESOLVED",
      scope: {
        ...scope,
        membershipBinding: {
          ...scope.membershipBinding,
          membershipStatus: "INACTIVE",
        },
      },
    };
    const capability =
      createAuthorityDarkHandlerTestCapabilityV1ForInternalTests();
    const result = await readyComposition(
      createAuthorityApplicationServiceV1(dependencies(state)),
      capability,
    ).invocation.invokeTestOnly(
      applicationRequest(),
      testContext(),
      capability,
    );
    expect(result.status).not.toBe("APPLIED");
    expect(state.authorizationCalls).toBe(0);
    expect(state.repositoryCalls).toBe(0);
  });

  it("keeps principal authorization binding drift away from repository", async () => {
    const state = dependencyState();
    const decision = authorizationDecision();
    state.authorizationResult = {
      schemaVersion: "1",
      status: "DECIDED",
      decision: authorizationDecision("ALLOW", [
        "REQUIRE_IDEMPOTENCY_KEY",
      ], {
        principalBinding: {
          ...decision.principalBinding,
          principalId: "apr_v1_human_binding_other_001",
        },
      }),
    };
    const capability =
      createAuthorityDarkHandlerTestCapabilityV1ForInternalTests();
    const result = await readyComposition(
      createAuthorityApplicationServiceV1(dependencies(state)),
      capability,
    ).invocation.invokeTestOnly(
      applicationRequest(),
      testContext(),
      capability,
    );
    expect(result.status).not.toBe("APPLIED");
    expect(state.repositoryCalls).toBe(0);
  });

  it("keeps pre-invocation cancellation away from every service dependency", async () => {
    const state = dependencyState();
    const controller = new AbortController();
    controller.abort();
    const capability =
      createAuthorityDarkHandlerTestCapabilityV1ForInternalTests();
    const composition = readyComposition(
      createAuthorityApplicationServiceV1(dependencies(state)),
      capability,
    );
    await expectInvocationError(
      () => composition.invocation.invokeTestOnly(
        applicationRequest(),
        testContext({ cancellationSignal: controller.signal }),
        capability,
      ),
      "AUTHORITY_DARK_HANDLER_INVOCATION_CANCELLED",
    );
    expect(state.principalCalls).toBe(0);
    expect(state.repositoryCalls).toBe(0);
  });
});

describe("Authority dark handler architecture", () => {
  const sourceFiles = listTypeScriptFiles(COMPOSITION_ROOT);
  const productionSource = sourceFiles
    .map((file) => readFileSync(file, "utf8"))
    .join("\n");

  it.each([
    "Date.now",
    "Math.random",
    "randomUUID",
    "process.env",
  ])("contains no nondeterministic or environment activation: %s", (forbidden) => {
    expect(productionSource).not.toContain(forbidden);
  });

  it.each([
    "firebase-admin",
    "firebase-functions",
    "FirestoreAuthorityMutationRepository",
    "onCall(",
    "onRequest(",
    "CallableRequest",
    "HttpsError",
    "express",
    "Request, Response",
    "statusCode",
    "middleware",
  ])("contains no Firebase, Firestore, handler, HTTP or transport token: %s", (forbidden) => {
    expect(productionSource).not.toContain(forbidden);
  });

  it.each([
    "AuthorityMutationRepositoryPort",
    "authorityPersistence",
    "serverAuthorityPersistence",
    "planAuthorityMutation",
    "PrincipalResolverAdapter",
    "TenantScopeResolverAdapter",
    "AuthorizationEvaluatorAdapter",
    "verifyIdToken",
  ])("does not own repository, adapter, planner, resolver or evaluator runtime: %s", (forbidden) => {
    expect(productionSource).not.toContain(forbidden);
  });

  it("is absent from the productive Functions entrypoint", () => {
    const entrypoint = readFileSync(
      path.join(FUNCTIONS_ROOT, "src", "index.ts"),
      "utf8",
    );
    expect(entrypoint).not.toContain("authorityDarkHandlerComposition");
    expect(entrypoint).not.toContain("createAuthorityDarkHandler");
  });

  it("is absent from the public package server export", () => {
    const serverEntrypoint = readFileSync(
      path.join(ROOT, "src", "modules", "intelligence", "server.ts"),
      "utf8",
    );
    expect(serverEntrypoint).not.toContain(
      "AuthorityDarkHandlerComposition",
    );
    expect(serverEntrypoint).not.toContain(
      "createAuthorityDarkHandlerCompositionV1",
    );
  });

  it("limits the capability issuer to its definition and this test consumer", () => {
    const symbol =
      "createAuthorityDarkHandlerTestCapabilityV1ForInternalTests";
    const consumers = [
      ...listTypeScriptFiles(path.join(FUNCTIONS_ROOT, "src")),
      ...listTypeScriptFiles(path.join(FUNCTIONS_ROOT, "tests")),
    ].filter((file) => readFileSync(file, "utf8").includes(symbol));
    expect(consumers.map((file) => path.basename(file)).sort()).toEqual([
      "authorityDarkHandlerComposition.test.ts",
      "authorityDarkHandlerTestCapability.ts",
    ]);
  });

  it("uses only exact certified package imports in the two exact source paths", () => {
    const packageConsumers = sourceFiles.filter((file) =>
      readFileSync(file, "utf8").includes("@aura/intelligence-os"),
    );
    expect(packageConsumers.map((file) => path.basename(file)).sort())
      .toEqual([
        "authorityDarkHandlerCompositionFactory.ts",
        "authorityDarkHandlerCompositionTypes.ts",
      ]);
    for (const file of packageConsumers) {
      const source = readFileSync(file, "utf8");
      const specifiers = [
        ...source.matchAll(/from\s+"([^"]+)"/g),
      ].map((match) => match[1]).filter((specifier) =>
        specifier.startsWith("@aura/intelligence-os")
      );
      expect(specifiers).toEqual(["@aura/intelligence-os/server"]);
    }
  });

  it("keeps the consumption allowlist exact and path-normalized", () => {
    const gate = readFileSync(
      path.join(FUNCTIONS_ROOT, "tests", "intelligenceOsConsumption.cjs"),
      "utf8",
    );
    for (const exactPath of [
      "composition/authorityDarkHandlerComposition/authorityDarkHandlerCompositionFactory.ts",
      "composition/authorityDarkHandlerComposition/authorityDarkHandlerCompositionTypes.ts",
    ]) {
      expect(gate).toContain(`"${exactPath}"`);
    }
    expect(gate).toContain('file.replaceAll("/", "\\\\")');
    expect(gate).toContain('file.replaceAll("\\\\", "/")');
    expect(gate).not.toContain(
      '"composition/authorityDarkHandlerComposition/";',
    );
  });

  it("documents the non-production verdict and next slice", () => {
    const readme = readFileSync(
      path.join(COMPOSITION_ROOT, "README.md"),
      "utf8",
    );
    expect(readme).toContain(
      "READY FOR END-TO-END EMULATOR CERTIFICATION",
    );
    expect(readme).not.toContain("READY FOR PRODUCTION");
    expect(readme).toContain("Production remains unauthorized");
  });
});
