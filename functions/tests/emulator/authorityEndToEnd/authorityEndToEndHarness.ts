import {
  createAuthorityApplicationServiceV1,
  type AuthorityAdministrativeCommandV1,
  type AuthorityApplicationExecutionContextV1,
  type AuthorityApplicationServiceRequestV1,
  type AuthorityApplicationServiceResultV1,
  type AuthorityClockPort,
} from "@aura/intelligence-os/server";

import {
  createAuthorityDarkHandlerCompositionV1,
  type AuthorityDarkHandlerCompositionV1,
} from "../../../src/composition/authorityDarkHandlerComposition";
import {
  createAuthorityDarkHandlerTestCapabilityV1ForInternalTests,
  type AuthorityDarkHandlerTestCapabilityV1,
} from "../../../src/composition/authorityDarkHandlerComposition/authorityDarkHandlerTestCapability";
import {
  FirestoreAuthorityMutationRepository,
} from "../../../src/infrastructure/firestore/authorityPersistence/FirestoreAuthorityMutationRepository";
import {
  FIRESTORE_AUTHORITY_COLLECTIONS,
} from "../../../src/infrastructure/firestore/authorityPersistence/firestoreAuthorityCollections";
import type {
  FirestoreAuthorityTransactionRunner,
} from "../../../src/infrastructure/firestore/authorityPersistence/firestoreAuthorityTransaction";
import {
  createEmulatorAuthorityHarness,
  type EmulatorAuthorityHarness,
} from "../authority/emulatorAuthorityHarness";
import {
  END_TO_END_OCCURRED_AT,
  applicationRequestFor,
  testExecutionContext,
} from "./authorityEndToEndFixtures";
import {
  assertAuthorityEndToEndIsolation,
} from "./authorityEndToEndIsolation";
import {
  createAuthorityEndToEndDependencies,
  createAuthorityEndToEndDependencyState,
  type AuthorityEndToEndDependencyState,
} from "./authorityEndToEndResolvers";

export const AUTHORITY_END_TO_END_COLLECTION_ALLOWLIST = Object.freeze(
  Object.values(FIRESTORE_AUTHORITY_COLLECTIONS).sort(),
);

export class StableAuthorityEndToEndClock implements AuthorityClockPort {
  calls = 0;
  readonly #value: string;

  constructor(value = END_TO_END_OCCURRED_AT) {
    this.#value = value;
  }

  nowIso(): string {
    this.calls += 1;
    return this.#value;
  }
}

export interface AuthorityEndToEndCompositionRun {
  readonly capability: AuthorityDarkHandlerTestCapabilityV1;
  readonly composition: Extract<
    AuthorityDarkHandlerCompositionV1,
    { mode: "TEST_ONLY" }
  >;
  readonly context: AuthorityApplicationExecutionContextV1;
  readonly darkClock: StableAuthorityEndToEndClock;
  invoke(
    capability?: AuthorityDarkHandlerTestCapabilityV1,
  ): Promise<AuthorityApplicationServiceResultV1>;
  readonly repositoryClock: StableAuthorityEndToEndClock;
  readonly request: AuthorityApplicationServiceRequestV1;
  readonly state: AuthorityEndToEndDependencyState;
}

export interface AuthorityEndToEndComposeOptions {
  readonly capability?: AuthorityDarkHandlerTestCapabilityV1;
  readonly context?: AuthorityApplicationExecutionContextV1;
  readonly darkClockValue?: string;
  readonly request?: AuthorityApplicationServiceRequestV1;
  readonly state?: AuthorityEndToEndDependencyState;
  readonly transactionRunner?: FirestoreAuthorityTransactionRunner;
}

export interface AuthorityEndToEndHarness {
  readonly emulator: EmulatorAuthorityHarness;
  clear(): Promise<void>;
  close(): Promise<void>;
  collectionCounts(): Promise<Readonly<Record<string, number>>>;
  compose(
    command: AuthorityAdministrativeCommandV1,
    options?: AuthorityEndToEndComposeOptions,
  ): AuthorityEndToEndCompositionRun;
  read(
    collectionPath: string,
    documentId: string,
  ): Promise<Readonly<Record<string, unknown>> | undefined>;
  seed(
    collectionPath: string,
    documentId: string,
    value: unknown,
  ): Promise<void>;
}

export function createAuthorityEndToEndHarness():
  AuthorityEndToEndHarness {
  const isolation = assertAuthorityEndToEndIsolation();
  const emulator = createEmulatorAuthorityHarness(isolation);

  return Object.freeze({
    emulator,
    clear: () => emulator.clear(),
    close: () => emulator.close(),
    async collectionCounts() {
      const entries = await Promise.all(
        AUTHORITY_END_TO_END_COLLECTION_ALLOWLIST.map(
          async (collectionPath) => [
            collectionPath,
            await emulator.count(collectionPath),
          ] as const,
        ),
      );
      return Object.freeze(Object.fromEntries(entries));
    },
    compose(command, options = {}) {
      const state =
        options.state ?? createAuthorityEndToEndDependencyState();
      const repositoryClock = new StableAuthorityEndToEndClock();
      const repository = new FirestoreAuthorityMutationRepository(
        emulator.firestore,
        repositoryClock,
        options.transactionRunner,
      );
      const applicationService = createAuthorityApplicationServiceV1(
        createAuthorityEndToEndDependencies(state, repository),
      );
      const capability =
        options.capability ??
        createAuthorityDarkHandlerTestCapabilityV1ForInternalTests();
      const darkClock = new StableAuthorityEndToEndClock(
        options.darkClockValue,
      );
      const composition = createAuthorityDarkHandlerCompositionV1({
        mode: "TEST_ONLY",
        capability,
        applicationService,
        clock: darkClock,
        metadata: {
          schemaVersion: "1",
          compositionId: `authority-d9-${command.operationId}`,
          purpose: "AUTHORITY_DARK_HANDLER_TEST",
        },
      });
      if (composition.mode !== "TEST_ONLY") {
        throw new Error("D.9 composition did not enter TEST_ONLY.");
      }
      const request =
        options.request ?? applicationRequestFor(command);
      const context = options.context ?? testExecutionContext({
        requestId: command.requestId,
        correlationId: command.correlationId,
      });
      return Object.freeze({
        capability,
        composition,
        context,
        darkClock,
        repositoryClock,
        request,
        state,
        invoke(invocationCapability = capability) {
          return composition.invocation.invokeTestOnly(
            request,
            context,
            invocationCapability,
          );
        },
      });
    },
    read: (collectionPath, documentId) =>
      emulator.read(collectionPath, documentId),
    seed: (collectionPath, documentId, value) =>
      emulator.seed(collectionPath, documentId, value),
  });
}
