import type {
  AuthorityApplicationServiceResultV1,
} from "@aura/intelligence-os/server";
import {
  createAuthorityMembershipKeyV1,
  validateAuthorityApplicationExecutionContextV1,
  validateAuthorityApplicationServiceRequestV1,
} from "@aura/intelligence-os/server";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  AuthorityDarkHandlerInvocationError,
} from "../../../src/composition/authorityDarkHandlerComposition";
import type {
  AuthorityDarkHandlerTestCapabilityV1,
} from "../../../src/composition/authorityDarkHandlerComposition/authorityDarkHandlerTestCapability";
import {
  FIRESTORE_AUTHORITY_COLLECTIONS,
} from "../../../src/infrastructure/firestore/authorityPersistence/firestoreAuthorityCollections";
import type {
  FirestoreAuthorityTransactionRunner,
} from "../../../src/infrastructure/firestore/authorityPersistence/firestoreAuthorityTransaction";
import {
  resolvedScope,
  verificationResult,
} from "../../../../src/modules/intelligence/serverAuthorityApplicationService/tests/fixtures";
import {
  InstrumentedFirestoreAuthorityTransactionRunner,
} from "../authority/emulatorAuthorityHarness";
import {
  END_TO_END_LEGACY_DOCUMENT_ID,
  TENANT_ID,
  activationPrerequisite,
  aliasKey,
  aliasRecord,
  applicationRequestFor,
  changeMembershipStatusCommand,
  createMembershipCommand,
  createTenantCommand,
  legacyCanonicalizationCommand,
  legacySource,
  membershipKey,
  membershipRecord,
  reserveAliasCommand,
  tenantRecord,
  testExecutionContext,
  tombstoneAliasCommand,
  updateMembershipRolesCommand,
  updateTenantStatusCommand,
} from "./authorityEndToEndFixtures";
import {
  createAuthorityEndToEndHarness,
  type AuthorityEndToEndCompositionRun,
  type AuthorityEndToEndHarness,
} from "./authorityEndToEndHarness";
import {
  AUTHORITY_END_TO_END_EMULATOR_HOST,
  AUTHORITY_END_TO_END_PROJECT_ID,
  assertAuthorityEndToEndIsolation,
} from "./authorityEndToEndIsolation";
import {
  createAuthorityEndToEndDependencyState,
  principalFailure,
  scopeFailure,
} from "./authorityEndToEndResolvers";

const PHYSICAL_PERSISTENCE_TERMS = Object.freeze([
  "platform_tenants",
  "authority_tenants",
  "authority_memberships",
  "authority_aliases",
  "authority_idempotency",
  "authority_operation_bindings",
  "authority_audit",
  "authority_outbox",
  "authority_outbox_delivery",
  "Firestore",
  "firestore",
]);

let harness: AuthorityEndToEndHarness;

function expectSafeResult(
  result: AuthorityApplicationServiceResultV1,
): void {
  expect(result.metadata).not.toHaveProperty("resourceReference");
  const serialized = JSON.stringify(result);
  for (const forbidden of PHYSICAL_PERSISTENCE_TERMS) {
    expect(serialized).not.toContain(forbidden);
  }
}

async function invokeSafe(
  run: AuthorityEndToEndCompositionRun,
): Promise<AuthorityApplicationServiceResultV1> {
  const result = await run.invoke();
  expectSafeResult(result);
  return result;
}

async function expectNoDocuments(): Promise<void> {
  expect(await harness.emulator.collectionIds()).toEqual([]);
}

beforeAll(() => {
  harness = createAuthorityEndToEndHarness();
});

beforeEach(async () => {
  await harness.clear();
});

afterAll(async () => {
  await harness.clear();
  await harness.close();
});

describe("Authority D.9 emulator isolation", () => {
  it("uses only the closed D.9 loopback demo project", () => {
    expect(assertAuthorityEndToEndIsolation()).toEqual({
      projectId: AUTHORITY_END_TO_END_PROJECT_ID,
      emulatorHost: AUTHORITY_END_TO_END_EMULATOR_HOST,
    });
  });
});

describe("Authority D.9 full dark chain", () => {
  it("01 creates a tenant and every atomic ledger through D.8", async () => {
    const command = createTenantCommand();
    const run = harness.compose(command);
    expect(
      validateAuthorityApplicationServiceRequestV1(run.request),
    ).toBeDefined();
    expect(
      validateAuthorityApplicationExecutionContextV1(run.context),
    ).toBeDefined();
    const result = await invokeSafe(run);

    expect(result.status).toBe("APPLIED");
    expect(result.safeCode).toBe("AUTHORITY_OPERATION_APPLIED");
    expect(run.state).toMatchObject({
      principalCalls: 1,
      scopeCalls: 1,
      authorizationCalls: 1,
      obligationCalls: 1,
      fingerprintCalls: 1,
      repositoryCalls: 1,
      repositoryCommand: command,
    });
    expect(run.repositoryClock.calls).toBe(1);
    expect(await harness.collectionCounts()).toEqual({
      [FIRESTORE_AUTHORITY_COLLECTIONS.ALIASES]: 0,
      [FIRESTORE_AUTHORITY_COLLECTIONS.AUDIT]: 1,
      [FIRESTORE_AUTHORITY_COLLECTIONS.IDEMPOTENCY]: 1,
      [FIRESTORE_AUTHORITY_COLLECTIONS.MEMBERSHIPS]: 0,
      [FIRESTORE_AUTHORITY_COLLECTIONS.OPERATION_BINDINGS]: 1,
      [FIRESTORE_AUTHORITY_COLLECTIONS.OUTBOX]: 1,
      [FIRESTORE_AUTHORITY_COLLECTIONS.OUTBOX_DELIVERY]: 1,
      [FIRESTORE_AUTHORITY_COLLECTIONS.TENANTS]: 1,
    });
    expect(
      await harness.read(
        FIRESTORE_AUTHORITY_COLLECTIONS.TENANTS,
        TENANT_ID,
      ),
    ).toMatchObject({ tenantId: TENANT_ID, recordVersion: 1 });
    expect(result.stageTrace).toHaveLength(10);
  });

  it("02 returns an exact safe replay without extra writes", async () => {
    const run = harness.compose(createTenantCommand("exact-replay"));
    const first = await invokeSafe(run);
    const counts = await harness.collectionCounts();
    const second = await invokeSafe(run);

    expect(second).toEqual(first);
    expect(await harness.collectionCounts()).toEqual(counts);
    expect(
      await harness.read(
        FIRESTORE_AUTHORITY_COLLECTIONS.TENANTS,
        TENANT_ID,
      ),
    ).toMatchObject({ recordVersion: 1 });
  });

  it("03 closes an authorization DENY before persistence", async () => {
    const state = createAuthorityEndToEndDependencyState();
    state.authorizationMode = "DENY";
    const result = await invokeSafe(
      harness.compose(createTenantCommand("deny"), { state }),
    );

    expect(result.status).toBe("NOT_AUTHORIZED");
    expect(state.obligationCalls).toBe(0);
    expect(state.repositoryCalls).toBe(0);
    await expectNoDocuments();
  });

  it("04 closes a principal NOT_FOUND without enumeration", async () => {
    const state = createAuthorityEndToEndDependencyState();
    state.principalResult = principalFailure("NOT_FOUND");
    const result = await invokeSafe(
      harness.compose(createTenantCommand("principal-not-found"), {
        state,
      }),
    );

    expect(result.status).toBe("NOT_FOUND");
    expect(state.scopeCalls).toBe(0);
    expect(state.repositoryCalls).toBe(0);
    await expectNoDocuments();
  });

  it("05 closes principal binding drift before obligations", async () => {
    const state = createAuthorityEndToEndDependencyState();
    state.decisionPrincipalIdOverride =
      "apr_v1_human_binding_other_001";
    const result = await invokeSafe(
      harness.compose(createTenantCommand("principal-drift"), {
        state,
      }),
    );

    expect(result.status).not.toBe("APPLIED");
    expect(state.obligationCalls).toBe(0);
    expect(state.repositoryCalls).toBe(0);
    await expectNoDocuments();
  });

  it("06 rejects a SUSPENDED membership scope", async () => {
    const state = createAuthorityEndToEndDependencyState();
    const base = resolvedScope();
    if (base.scopeType !== "TENANT") {
      throw new Error("D.9 tenant scope fixture is invalid.");
    }
    state.scopeResult = {
      schemaVersion: "1",
      status: "RESOLVED",
      scope: resolvedScope({
        membershipBinding: {
          ...base.membershipBinding,
          membershipStatus: "SUSPENDED",
        },
      }),
    };
    const result = await invokeSafe(
      harness.compose(createTenantCommand("membership-suspended"), {
        state,
      }),
    );

    expect(result.status).toBe("REJECTED");
    expect(state.authorizationCalls).toBe(0);
    expect(state.repositoryCalls).toBe(0);
    await expectNoDocuments();
  });

  it("07 closes a resolved scope tenant mismatch", async () => {
    const state = createAuthorityEndToEndDependencyState();
    const base = resolvedScope();
    if (base.scopeType !== "TENANT") {
      throw new Error("D.9 tenant scope fixture is invalid.");
    }
    state.scopeResult = {
      schemaVersion: "1",
      status: "RESOLVED",
      scope: resolvedScope({
        tenantId: "tenant_other_001",
        membershipBinding: {
          ...base.membershipBinding,
          tenantId: "tenant_other_001",
        },
        requestedTenantSelector: {
          schemaVersion: "1",
          selectorType: "TENANT_ID",
          requestedTenantId: "tenant_other_001",
        },
      }),
    };
    const result = await invokeSafe(
      harness.compose(createTenantCommand("scope-mismatch"), { state }),
    );

    expect(result.status).not.toBe("APPLIED");
    expect(state.authorizationCalls).toBe(1);
    expect(state.repositoryCalls).toBe(0);
    await expectNoDocuments();
  });

  it("08 closes a cross-tenant authorization decision", async () => {
    const state = createAuthorityEndToEndDependencyState();
    state.decisionResourceOverride = {
      schemaVersion: "1",
      resourceType: "TENANT",
      tenantId: "tenant_other_001",
    };
    const result = await invokeSafe(
      harness.compose(createTenantCommand("authorization-cross-tenant"), {
        state,
      }),
    );

    expect(result.status).not.toBe("APPLIED");
    expect(state.obligationCalls).toBe(0);
    expect(state.repositoryCalls).toBe(0);
    await expectNoDocuments();
  });

  it("09 stops an INCOMPLETE obligation result", async () => {
    const state = createAuthorityEndToEndDependencyState();
    state.obligationMode = "INCOMPLETE";
    const result = await invokeSafe(
      harness.compose(createTenantCommand("obligation-incomplete"), {
        state,
      }),
    );

    expect(result.status).toBe("REJECTED");
    expect(state.fingerprintCalls).toBe(0);
    expect(state.repositoryCalls).toBe(0);
    await expectNoDocuments();
  });

  it("10 rejects missing idempotency obligation evidence", async () => {
    const state = createAuthorityEndToEndDependencyState();
    state.obligationResultOverride = verificationResult([]);
    const result = await invokeSafe(
      harness.compose(createTenantCommand("missing-idempotency"), {
        state,
      }),
    );

    expect(result.status).toBe("REJECTED");
    expect(state.repositoryCalls).toBe(0);
    await expectNoDocuments();
  });

  it("11 rejects a missing expected-version precondition", async () => {
    const command = createTenantCommand("missing-expected-version");
    const state = createAuthorityEndToEndDependencyState();
    state.obligationTypes = ["REQUIRE_EXPECTED_VERSION"];
    const result = await invokeSafe(harness.compose(command, {
      state,
      request: applicationRequestFor(command, {
        evidenceTypes: ["REQUIRE_EXPECTED_VERSION"],
      }),
    }));

    expect(result.status).toBe("REJECTED");
    expect(state.repositoryCalls).toBe(0);
    await expectNoDocuments();
  });

  it("12 permits LIMIT_TO_TEST_ONLY only in the D.8 test path", async () => {
    const command = createTenantCommand("limit-test-only");
    const state = createAuthorityEndToEndDependencyState();
    state.obligationTypes = ["LIMIT_TO_TEST_ONLY"];
    const result = await invokeSafe(harness.compose(command, {
      state,
      request: applicationRequestFor(command, {
        evidenceTypes: ["LIMIT_TO_TEST_ONLY"],
      }),
    }));

    expect(result.status).toBe("APPLIED");
    expect(state.repositoryCalls).toBe(1);
  });

  it("13 carries MASK_NOT_FOUND without physical locators", async () => {
    const command = legacyCanonicalizationCommand(
      legacySource(),
      "mask-not-found",
    );
    const state = createAuthorityEndToEndDependencyState();
    state.obligationTypes = ["MASK_NOT_FOUND"];
    const result = await invokeSafe(harness.compose(command, {
      state,
      request: applicationRequestFor(command, {
        evidenceTypes: ["MASK_NOT_FOUND"],
      }),
    }));

    expect(result.status).toBe("NOT_FOUND");
    expect(result.metadata.maskNotFound).toBe(true);
    await expectNoDocuments();
  });

  it("14 stops a stale principal before scope resolution", async () => {
    const state = createAuthorityEndToEndDependencyState();
    state.principalResult = principalFailure("STALE");
    const result = await invokeSafe(
      harness.compose(createTenantCommand("stale-principal"), { state }),
    );

    expect(result.status).toBe("STALE");
    expect(state.scopeCalls).toBe(0);
    await expectNoDocuments();
  });

  it("15 stops a stale tenant scope before authorization", async () => {
    const state = createAuthorityEndToEndDependencyState();
    state.scopeResult = scopeFailure("STALE");
    const result = await invokeSafe(
      harness.compose(createTenantCommand("stale-scope"), { state }),
    );

    expect(result.status).toBe("STALE");
    expect(state.authorizationCalls).toBe(0);
    await expectNoDocuments();
  });

  it("16 stops stale authorization before obligations", async () => {
    const state = createAuthorityEndToEndDependencyState();
    state.authorizationMode = "STALE";
    const result = await invokeSafe(
      harness.compose(createTenantCommand("stale-authorization"), {
        state,
      }),
    );

    expect(result.status).toBe("STALE");
    expect(state.obligationCalls).toBe(0);
    await expectNoDocuments();
  });

  it("17 rejects cancellation before D.8 invocation", async () => {
    const command = createTenantCommand("cancel-before-invocation");
    const controller = new AbortController();
    controller.abort();
    const run = harness.compose(command, {
      context: testExecutionContext({
        requestId: command.requestId,
        correlationId: command.correlationId,
        cancellationSignal: controller.signal,
      }),
    });

    await expect(run.invoke()).rejects.toMatchObject({
      code: "AUTHORITY_DARK_HANDLER_INVOCATION_CANCELLED",
    });
    expect(run.state.principalCalls).toBe(0);
    await expectNoDocuments();
  });

  it("18 observes cancellation immediately before repository execution", async () => {
    const command = createTenantCommand("cancel-before-repository");
    const controller = new AbortController();
    const state = createAuthorityEndToEndDependencyState();
    state.abortBeforeRepository = controller;
    const result = await invokeSafe(harness.compose(command, {
      state,
      context: testExecutionContext({
        requestId: command.requestId,
        correlationId: command.correlationId,
        cancellationSignal: controller.signal,
      }),
    }));

    expect(result.status).toBe("CANCELLED");
    expect(state.repositoryCalls).toBe(1);
    await expectNoDocuments();
  });

  it("19 maps an Application Service deadline expiry to TIMED_OUT", async () => {
    const command = createTenantCommand("deadline-expired");
    const result = await invokeSafe(harness.compose(command, {
      darkClockValue: "2026-07-30T12:01:10.000Z",
      context: testExecutionContext({
        requestId: command.requestId,
        correlationId: command.correlationId,
        deadlineAt: "2026-07-30T12:01:20.000Z",
      }),
    }));

    expect(result.status).toBe("TIMED_OUT");
    expect(result.stageTrace).toHaveLength(2);
    await expectNoDocuments();
  });

  it("20 rejects duplicate tenant creation with new identity", async () => {
    await harness.seed(
      FIRESTORE_AUTHORITY_COLLECTIONS.TENANTS,
      TENANT_ID,
      tenantRecord(),
    );
    const result = await invokeSafe(
      harness.compose(createTenantCommand("duplicate-tenant")),
    );

    expect(result.status).toBe("CONFLICT");
    expect(
      await harness.read(
        FIRESTORE_AUTHORITY_COLLECTIONS.TENANTS,
        TENANT_ID,
      ),
    ).toMatchObject({ recordVersion: 1 });
  });

  it("21 rejects a stale tenant record version", async () => {
    await harness.seed(
      FIRESTORE_AUTHORITY_COLLECTIONS.TENANTS,
      TENANT_ID,
      tenantRecord("ACTIVE", 2),
    );
    const result = await invokeSafe(harness.compose(
      updateTenantStatusCommand(
        "ACTIVE",
        "SUSPENDED",
        "stale-tenant-version",
      ),
    ));

    expect(result.status).toBe("CONFLICT");
    expect(
      await harness.read(
        FIRESTORE_AUTHORITY_COLLECTIONS.TENANTS,
        TENANT_ID,
      ),
    ).toMatchObject({ status: "ACTIVE", recordVersion: 2 });
  });

  it("22 creates a tenant membership atomically", async () => {
    await harness.seed(
      FIRESTORE_AUTHORITY_COLLECTIONS.TENANTS,
      TENANT_ID,
      tenantRecord("ACTIVE"),
    );
    const command = createMembershipCommand();
    const run = harness.compose(command);
    const result = await invokeSafe(run);

    expect(result.status).toBe("APPLIED");
    if (run.state.scopeResult.status !== "RESOLVED") {
      throw new Error("D.9 scope did not resolve.");
    }
    expect(run.state.scopeResult.scope).toMatchObject({
      membershipBinding: { membershipId: membershipKey() },
    });
    expect(run.request.authorizationResource).toMatchObject({
      resourceType: "MEMBERSHIP",
      membershipId: membershipKey(),
    });
    expect(run.state.authorizationRequest?.resourceBinding).toMatchObject({
      resourceType: "MEMBERSHIP",
      membershipId: membershipKey(),
    });
    expect(run.state.repositoryCommand).toBe(command);
    expect(run.state.repositoryContext).toMatchObject({
      requestId: command.requestId,
      correlationId: command.correlationId,
    });
    expect(
      await harness.read(
        FIRESTORE_AUTHORITY_COLLECTIONS.MEMBERSHIPS,
        membershipKey(),
      ),
    ).toMatchObject({
      membershipKey: membershipKey(),
      membershipVersion: 1,
    });
  });

  it("23 applies a membership role update", async () => {
    await harness.seed(
      FIRESTORE_AUTHORITY_COLLECTIONS.TENANTS,
      TENANT_ID,
      tenantRecord("ACTIVE"),
    );
    await harness.seed(
      FIRESTORE_AUTHORITY_COLLECTIONS.MEMBERSHIPS,
      membershipKey(),
      membershipRecord(),
    );
    const result = await invokeSafe(harness.compose(
      updateMembershipRolesCommand(
        ["TENANT_ADMIN", "TENANT_OPERATOR"],
        "roles-applied",
      ),
    ));

    expect(result.status).toBe("APPLIED");
    expect(
      await harness.read(
        FIRESTORE_AUTHORITY_COLLECTIONS.MEMBERSHIPS,
        membershipKey(),
      ),
    ).toMatchObject({
      roles: ["TENANT_ADMIN", "TENANT_OPERATOR"],
      membershipVersion: 2,
    });
  });

  it("24 maps an unchanged membership role update to REPLAYED", async () => {
    await harness.seed(
      FIRESTORE_AUTHORITY_COLLECTIONS.TENANTS,
      TENANT_ID,
      tenantRecord("ACTIVE"),
    );
    await harness.seed(
      FIRESTORE_AUTHORITY_COLLECTIONS.MEMBERSHIPS,
      membershipKey(),
      membershipRecord(),
    );
    const result = await invokeSafe(harness.compose(
      updateMembershipRolesCommand(["TENANT_ADMIN"], "roles-no-op"),
    ));

    expect(result.status).toBe("REPLAYED");
    expect(
      await harness.read(
        FIRESTORE_AUTHORITY_COLLECTIONS.MEMBERSHIPS,
        membershipKey(),
      ),
    ).toMatchObject({ membershipVersion: 1 });
  });

  it("25 applies a valid membership status transition", async () => {
    await harness.seed(
      FIRESTORE_AUTHORITY_COLLECTIONS.TENANTS,
      TENANT_ID,
      tenantRecord("ACTIVE"),
    );
    await harness.seed(
      FIRESTORE_AUTHORITY_COLLECTIONS.MEMBERSHIPS,
      membershipKey(),
      membershipRecord(),
    );
    const result = await invokeSafe(harness.compose(
      changeMembershipStatusCommand(
        "ACTIVE",
        "SUSPENDED",
        "membership-status",
      ),
    ));

    expect(result.status).toBe("APPLIED");
    expect(
      await harness.read(
        FIRESTORE_AUTHORITY_COLLECTIONS.MEMBERSHIPS,
        membershipKey(),
      ),
    ).toMatchObject({
      status: "SUSPENDED",
      membershipVersion: 2,
    });
  });

  it("26 rejects a cross-membership authorization binding", async () => {
    await harness.seed(
      FIRESTORE_AUTHORITY_COLLECTIONS.TENANTS,
      TENANT_ID,
      tenantRecord("ACTIVE"),
    );
    await harness.seed(
      FIRESTORE_AUTHORITY_COLLECTIONS.MEMBERSHIPS,
      membershipKey(),
      membershipRecord(),
    );
    const otherMembershipId = createAuthorityMembershipKeyV1({
      principalType: "USER",
      principalId: "apr_v1_human_binding_other_001",
      tenantId: TENANT_ID,
    });
    const state = createAuthorityEndToEndDependencyState();
    state.decisionResourceOverride = {
      schemaVersion: "1",
      resourceType: "MEMBERSHIP",
      tenantId: TENANT_ID,
      membershipId: otherMembershipId,
      targetPrincipalId: "apr_v1_human_binding_other_001",
    };
    state.decisionOperationResourceIdOverride = otherMembershipId;
    const result = await invokeSafe(harness.compose(
      updateMembershipRolesCommand(
        ["TENANT_ADMIN", "TENANT_OPERATOR"],
        "cross-membership",
      ),
      { state },
    ));

    expect(result.status).toBe("REJECTED");
    expect(state.repositoryCalls).toBe(0);
    expect(
      await harness.read(
        FIRESTORE_AUTHORITY_COLLECTIONS.MEMBERSHIPS,
        membershipKey(),
      ),
    ).toMatchObject({ membershipVersion: 1 });
  });

  it("25 enforces and applies the tenant activation prerequisite", async () => {
    await harness.seed(
      FIRESTORE_AUTHORITY_COLLECTIONS.TENANTS,
      TENANT_ID,
      tenantRecord(),
    );
    await harness.seed(
      FIRESTORE_AUTHORITY_COLLECTIONS.MEMBERSHIPS,
      membershipKey(),
      membershipRecord(),
    );
    const result = await invokeSafe(harness.compose(
      updateTenantStatusCommand(
        "PENDING",
        "ACTIVE",
        "activation-prerequisite",
        activationPrerequisite(),
      ),
    ));

    expect(result.status).toBe("APPLIED");
    expect(
      await harness.read(
        FIRESTORE_AUTHORITY_COLLECTIONS.TENANTS,
        TENANT_ID,
      ),
    ).toMatchObject({ status: "ACTIVE", recordVersion: 2 });
  });

  it("26 reserves a tenant alias", async () => {
    await harness.seed(
      FIRESTORE_AUTHORITY_COLLECTIONS.TENANTS,
      TENANT_ID,
      tenantRecord(),
    );
    const result = await invokeSafe(
      harness.compose(reserveAliasCommand()),
    );

    expect(result.status).toBe("APPLIED");
    expect(
      await harness.read(
        FIRESTORE_AUTHORITY_COLLECTIONS.ALIASES,
        aliasKey(),
      ),
    ).toMatchObject({ aliasKey: aliasKey(), status: "ACTIVE" });
  });

  it("27 rejects an alias collision", async () => {
    await harness.seed(
      FIRESTORE_AUTHORITY_COLLECTIONS.TENANTS,
      TENANT_ID,
      tenantRecord(),
    );
    await harness.seed(
      FIRESTORE_AUTHORITY_COLLECTIONS.ALIASES,
      aliasKey(),
      aliasRecord(),
    );
    const result = await invokeSafe(
      harness.compose(reserveAliasCommand("alias-collision")),
    );

    expect(result.status).toBe("CONFLICT");
    expect(
      await harness.read(
        FIRESTORE_AUTHORITY_COLLECTIONS.ALIASES,
        aliasKey(),
      ),
    ).toMatchObject({ status: "ACTIVE", aliasVersion: 1 });
  });

  it("28 tombstones an active alias", async () => {
    await harness.seed(
      FIRESTORE_AUTHORITY_COLLECTIONS.ALIASES,
      aliasKey(),
      aliasRecord(),
    );
    const result = await invokeSafe(
      harness.compose(tombstoneAliasCommand()),
    );

    expect(result.status).toBe("APPLIED");
    expect(
      await harness.read(
        FIRESTORE_AUTHORITY_COLLECTIONS.ALIASES,
        aliasKey(),
      ),
    ).toMatchObject({ status: "TOMBSTONED", aliasVersion: 2 });
  });

  it("29 canonicalizes a PRESENT legacy tenant source", async () => {
    const source = legacySource();
    await harness.seed(
      FIRESTORE_AUTHORITY_COLLECTIONS.TENANTS,
      END_TO_END_LEGACY_DOCUMENT_ID,
      source.normalizedRawRecord,
    );
    const result = await invokeSafe(
      harness.compose(legacyCanonicalizationCommand(source)),
    );

    expect(result.status).toBe("APPLIED");
    expect(
      await harness.read(
        FIRESTORE_AUTHORITY_COLLECTIONS.TENANTS,
        TENANT_ID,
      ),
    ).toMatchObject({
      tenantId: TENANT_ID,
      migrationState: {
        sourceRecordFingerprint: source.sourceRecordFingerprint,
      },
    });
  });

  it("30 returns NOT_FOUND for an ABSENT legacy tenant source", async () => {
    const result = await invokeSafe(harness.compose(
      legacyCanonicalizationCommand(legacySource(), "legacy-absent"),
    ));

    expect(result.status).toBe("NOT_FOUND");
    await expectNoDocuments();
  });

  it("31 revalidates the legacy fingerprint on a real retry", async () => {
    const expected = legacySource();
    const changed = legacySource({ status: "ACTIVE" });
    await harness.seed(
      FIRESTORE_AUTHORITY_COLLECTIONS.TENANTS,
      END_TO_END_LEGACY_DOCUMENT_ID,
      expected.normalizedRawRecord,
    );
    const runner = new InstrumentedFirestoreAuthorityTransactionRunner(
      harness.emulator.firestore,
      {},
      {
        abortFirstCallback: true,
        async betweenFirstCallbackAndRetry() {
          await harness.emulator.firestore
            .collection(FIRESTORE_AUTHORITY_COLLECTIONS.TENANTS)
            .doc(END_TO_END_LEGACY_DOCUMENT_ID)
            .update({ ...changed.normalizedRawRecord });
        },
      },
    );
    const result = await invokeSafe(harness.compose(
      legacyCanonicalizationCommand(expected, "legacy-mismatch"),
      { transactionRunner: runner },
    ));

    expect(runner.callbackCount).toBeGreaterThan(1);
    expect(result.status).toBe("CONFLICT");
    expect(result.safeCode).toBe("AUTHORITY_OPERATION_CONFLICT");
    expect(await harness.emulator.collectionIds()).toEqual([
      FIRESTORE_AUTHORITY_COLLECTIONS.TENANTS,
    ]);
  });

  it("32 converges concurrent identical commands to exact replay", async () => {
    const command = createTenantCommand("concurrent-identical");
    const firstRun = harness.compose(command);
    const secondRun = harness.compose(command);
    const [first, second] = await Promise.all([
      invokeSafe(firstRun),
      invokeSafe(secondRun),
    ]);

    expect(first).toEqual(second);
    expect(first.status).toBe("APPLIED");
    expect(
      await harness.emulator.count(
        FIRESTORE_AUTHORITY_COLLECTIONS.TENANTS,
      ),
    ).toBe(1);
    expect(
      await harness.emulator.count(
        FIRESTORE_AUTHORITY_COLLECTIONS.AUDIT,
      ),
    ).toBe(1);
  });

  it("33 converges concurrent conflicting identities without corruption", async () => {
    const sharedIdempotencyKey = "idempotency_d9_concurrent_conflict";
    const first = createTenantCommand(
      "concurrent-conflict-a",
      TENANT_ID,
      { idempotencyKey: sharedIdempotencyKey },
    );
    const second = createTenantCommand(
      "concurrent-conflict-b",
      TENANT_ID,
      { idempotencyKey: sharedIdempotencyKey },
    );
    const results = await Promise.all([
      invokeSafe(harness.compose(first)),
      invokeSafe(harness.compose(second)),
    ]);

    expect(results.map(({ status }) => status).sort()).toEqual([
      "APPLIED",
      "CONFLICT",
    ]);
    expect(
      await harness.emulator.count(
        FIRESTORE_AUTHORITY_COLLECTIONS.TENANTS,
      ),
    ).toBe(1);
    expect(
      await harness.emulator.count(
        FIRESTORE_AUTHORITY_COLLECTIONS.AUDIT,
      ),
    ).toBe(1);
  });

  it("34 retries a real transaction with stable IDs and clock", async () => {
    const writeIdsByAttempt = new Map<number, string[]>();
    const runner = new InstrumentedFirestoreAuthorityTransactionRunner(
      harness.emulator.firestore,
      {
        beforeWrite(locator, _writeNumber, callbackAttempt) {
          const writeIds = writeIdsByAttempt.get(callbackAttempt) ?? [];
          writeIds.push(`${locator.collectionPath}/${locator.documentId}`);
          writeIdsByAttempt.set(callbackAttempt, writeIds);
        },
      },
      { abortFirstCallback: true },
    );
    const run = harness.compose(createTenantCommand("transaction-retry"), {
      transactionRunner: runner,
    });
    const result = await invokeSafe(run);

    expect(result.status).toBe("APPLIED");
    expect(runner.callbackCount).toBeGreaterThan(1);
    expect(run.repositoryClock.calls).toBe(1);
    expect(writeIdsByAttempt.get(2)).toEqual(writeIdsByAttempt.get(1));
  });

  it("35 rolls back every write after a controlled transaction failure", async () => {
    const runner = new InstrumentedFirestoreAuthorityTransactionRunner(
      harness.emulator.firestore,
      {
        beforeWrite(locator) {
          if (
            locator.collectionPath ===
            FIRESTORE_AUTHORITY_COLLECTIONS.OUTBOX_DELIVERY
          ) {
            throw new Error("controlled D.9 write failure");
          }
        },
      },
    );
    const result = await invokeSafe(harness.compose(
      createTenantCommand("atomic-rollback"),
      { transactionRunner: runner },
    ));

    expect(result.status).toBe("INTERNAL_ERROR");
    await expectNoDocuments();
  });

  it("36 maps an internal adapter failure without raw details", async () => {
    const failingRunner: FirestoreAuthorityTransactionRunner =
      Object.freeze({
        async runTransaction<T>(): Promise<T> {
          throw new Error("sensitive internal adapter detail");
        },
      });
    const result = await invokeSafe(harness.compose(
      createTenantCommand("internal-adapter-error"),
      { transactionRunner: failingRunner },
    ));

    expect(result.status).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(result)).not.toContain("sensitive");
    await expectNoDocuments();
  });

  it("37 rejects a forged D.8 capability before service execution", async () => {
    const run = harness.compose(createTenantCommand("forged-capability"));
    const forged = Object.freeze({ version: "1" }) as
      AuthorityDarkHandlerTestCapabilityV1;

    await expect(run.invoke(forged)).rejects.toEqual(
      new AuthorityDarkHandlerInvocationError(
        "AUTHORITY_DARK_HANDLER_INVOCATION_CAPABILITY_INVALID",
      ),
    );
    expect(run.state.principalCalls).toBe(0);
    expect(run.state.repositoryCalls).toBe(0);
    await expectNoDocuments();
  });
});
