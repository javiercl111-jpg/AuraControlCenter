import {
  AuthorityPersistenceContractError,
} from './errors';
import {
  createAuthorityRepositoryResultV1,
} from './factories';
import {
  applyAuthorityMutationPlanV1,
} from './applyMutationPlan';
import {
  createAuthorityCancellationResultV1,
  planAuthorityMutationV1,
} from './planner';
import type {
  AuthorityClockPort,
  AuthorityMutationRepositoryPort,
} from './ports';
import type {
  AuthorityRepositorySnapshotV1,
} from './runtimeTypes';
import {
  cloneAuthorityRepositorySnapshotV1,
  validateAuthorityRepositorySnapshotV1,
} from './snapshot';
import {
  AUTHORITY_REPOSITORY_RESULT_VERSION,
  type AuthorityAdministrativeCommandV1,
  type AuthorityRepositoryInvocationContextV1,
  type AuthorityRepositoryResultV1,
} from './types';
import {
  validateAuthorityAdministrativeCommandV1,
  validateAuthorityClockOutputV1,
  validateAuthorityRepositoryInvocationContextV1,
  validateAuthorityRepositoryResultV1,
} from './validators';

function internalErrorResult(
  command: AuthorityAdministrativeCommandV1,
  completedAt: string,
): AuthorityRepositoryResultV1 {
  return createAuthorityRepositoryResultV1({
    schemaVersion: AUTHORITY_REPOSITORY_RESULT_VERSION,
    operationId: command.operationId,
    correlationId: command.correlationId,
    status: 'INTERNAL_ERROR',
    safeCode: 'AUTHORITY_REPOSITORY_INTERNAL_ERROR',
    completedAt,
    retryDisposition: 'SAFE_TO_RETRY_WITH_SAME_IDEMPOTENCY_KEY',
  });
}

function isCancellationRequested(
  context: AuthorityRepositoryInvocationContextV1,
): boolean {
  return context.cancellationSignal?.aborted === true;
}

export class InMemoryAuthorityMutationRepository
  implements AuthorityMutationRepositoryPort
{
  readonly #clock: AuthorityClockPort;
  #snapshot: AuthorityRepositorySnapshotV1;

  constructor(initialSnapshot: unknown, clock: AuthorityClockPort) {
    this.#snapshot = validateAuthorityRepositorySnapshotV1(initialSnapshot);
    this.#clock = clock;
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
    try {
      const occurredAt = validateAuthorityClockOutputV1(
        this.#clock.nowIso(),
      );
      if (isCancellationRequested(context)) {
        return createAuthorityCancellationResultV1(command, occurredAt);
      }
      const plan = planAuthorityMutationV1(
        command,
        context,
        this.#snapshot,
        occurredAt,
      );
      if (isCancellationRequested(context)) {
        return createAuthorityCancellationResultV1(command, occurredAt);
      }
      const nextSnapshot =
        plan.resourceWrites.length === 0 &&
        plan.idempotencyWrite === undefined &&
        plan.operationBindingWrite === undefined &&
        plan.auditEvents.length === 0 &&
        plan.outboxEvents.length === 0 &&
        plan.outboxDeliveryRecords.length === 0
          ? this.#snapshot
          : applyAuthorityMutationPlanV1(this.#snapshot, plan);
      this.#snapshot = nextSnapshot;
      return validateAuthorityRepositoryResultV1(plan.repositoryResult);
    } catch (error: unknown) {
      if (error instanceof AuthorityPersistenceContractError) {
        throw error;
      }
      return internalErrorResult(command, command.requestedAt);
    }
  }

  getSnapshotForTesting(): AuthorityRepositorySnapshotV1 {
    return cloneAuthorityRepositorySnapshotV1(this.#snapshot);
  }
}
