import type { Firestore } from "firebase-admin/firestore";
import {
  AuthorityPersistenceContractError,
  planAuthorityMutationV1,
  validateAuthorityAdministrativeCommandV1,
  validateAuthorityClockOutputV1,
  validateAuthorityRepositoryInvocationContextV1,
  validateAuthorityRepositoryResultV1,
  type AuthorityAdministrativeCommandV1,
  type AuthorityClockPort,
  type AuthorityMutationRepositoryPort,
  type AuthorityRepositoryInvocationContextV1,
  type AuthorityRepositoryResultV1,
} from "@aura/intelligence-os/server";

import {
  createFirestoreAuthorityCancellationResult,
  FirestoreAuthorityCancellationError,
  mapFirestoreAuthorityError,
} from "./firestoreAuthorityErrors";
import {
  revalidateFirestoreAuthorityExpectedReads,
} from "./firestoreAuthorityExpectedReads";
import {
  createFirestoreAuthorityReadSet,
} from "./firestoreAuthorityReadSet";
import {
  assembleFirestoreAuthorityReadSnapshot,
  readFirestoreAuthorityDocuments,
} from "./firestoreAuthoritySnapshot";
import {
  FirestoreAdminAuthorityTransactionRunner,
  type FirestoreAuthorityTransactionRunner,
} from "./firestoreAuthorityTransaction";
import {
  applyFirestoreAuthorityMutationPlan,
} from "./firestoreAuthorityWritePlan";

function isCancellationRequested(
  context: AuthorityRepositoryInvocationContextV1,
): boolean {
  return context.cancellationSignal?.aborted === true;
}

function assertNotCancelled(
  context: AuthorityRepositoryInvocationContextV1,
): void {
  if (isCancellationRequested(context)) {
    throw new FirestoreAuthorityCancellationError();
  }
}

export class FirestoreAuthorityMutationRepository
  implements AuthorityMutationRepositoryPort
{
  readonly #clock: AuthorityClockPort;
  readonly #transactionRunner: FirestoreAuthorityTransactionRunner;

  constructor(
    firestore: Firestore,
    clock: AuthorityClockPort,
    transactionRunner?: FirestoreAuthorityTransactionRunner,
  ) {
    this.#clock = clock;
    this.#transactionRunner =
      transactionRunner ??
      new FirestoreAdminAuthorityTransactionRunner(firestore);
  }

  async execute(
    commandValue: AuthorityAdministrativeCommandV1,
    contextValue: AuthorityRepositoryInvocationContextV1,
  ): Promise<AuthorityRepositoryResultV1> {
    const command =
      validateAuthorityAdministrativeCommandV1(commandValue);
    const context = validateAuthorityRepositoryInvocationContextV1(
      contextValue,
      command,
    );
    if (isCancellationRequested(context)) {
      return createFirestoreAuthorityCancellationResult(
        command,
        command.requestedAt,
      );
    }

    let occurredAt: string;
    try {
      occurredAt = validateAuthorityClockOutputV1(
        this.#clock.nowIso(),
      );
    } catch (error: unknown) {
      if (error instanceof AuthorityPersistenceContractError) {
        throw error;
      }
      return mapFirestoreAuthorityError(
        error,
        command,
        command.requestedAt,
      );
    }

    if (isCancellationRequested(context)) {
      return createFirestoreAuthorityCancellationResult(
        command,
        occurredAt,
      );
    }

    const readSet = createFirestoreAuthorityReadSet(command);
    try {
      return await this.#transactionRunner.runTransaction(
        async (transaction) => {
          assertNotCancelled(context);
          const observations =
            await readFirestoreAuthorityDocuments(
              transaction,
              readSet,
            );
          assertNotCancelled(context);
          const assembly =
            assembleFirestoreAuthorityReadSnapshot(observations);
          const plan = planAuthorityMutationV1(
            command,
            context,
            assembly.snapshot,
            occurredAt,
            assembly.readRegistry,
          );
          if (
            plan.planStatus !== "CONFLICT" &&
            plan.planStatus !== "NOT_FOUND"
          ) {
            revalidateFirestoreAuthorityExpectedReads(
              plan.expectedReads,
              assembly.observations,
              assembly.readRegistry,
            );
          }
          assertNotCancelled(context);
          applyFirestoreAuthorityMutationPlan(transaction, plan);
          return validateAuthorityRepositoryResultV1(
            plan.repositoryResult,
          );
        },
      );
    } catch (error: unknown) {
      if (error instanceof AuthorityPersistenceContractError) {
        throw error;
      }
      return mapFirestoreAuthorityError(error, command, occurredAt);
    }
  }
}
