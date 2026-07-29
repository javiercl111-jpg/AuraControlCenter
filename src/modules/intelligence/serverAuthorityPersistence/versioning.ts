import {
  AUTHORITY_OPERATION_TYPES,
  AUTHORITY_REPOSITORY_RESULT_STATUSES,
  type AuthorityOperationType,
  type AuthorityRepositoryResultStatus,
} from './types';
import {
  failAuthorityPersistenceContract,
  requireEnumValue,
  requirePositiveInteger,
} from './helpers';

export type AuthorityVersionOutcomeV1 =
  | AuthorityRepositoryResultStatus
  | 'REPLAY';

const AUTHORITY_CREATION_OPERATION_TYPES: readonly AuthorityOperationType[] =
  Object.freeze([
    'CREATE_TENANT_AUTHORITY',
    'CREATE_TENANT_MEMBERSHIP',
    'RESERVE_TENANT_ALIAS',
    'CANONICALIZE_LEGACY_TENANT',
  ]);

export function shouldIncrementAuthorityVersionV1(
  operationType: AuthorityOperationType,
  before: number | undefined,
  after: number | undefined,
): boolean {
  requireEnumValue(
    operationType,
    AUTHORITY_OPERATION_TYPES,
    'INVALID_AUTHORITY_VERSION',
  );
  if (before === undefined) {
    if (
      !AUTHORITY_CREATION_OPERATION_TYPES.includes(operationType) ||
      after !== 1
    ) {
      return failAuthorityPersistenceContract(
        'INVALID_AUTHORITY_VERSION',
      );
    }
    return true;
  }
  if (AUTHORITY_CREATION_OPERATION_TYPES.includes(operationType)) {
    return failAuthorityPersistenceContract('INVALID_AUTHORITY_VERSION');
  }
  const validatedBefore = requirePositiveInteger(
    before,
    'INVALID_AUTHORITY_VERSION',
  );
  const validatedAfter = requirePositiveInteger(
    after,
    'INVALID_AUTHORITY_VERSION',
  );
  if (validatedAfter === validatedBefore) {
    return false;
  }
  if (validatedAfter !== validatedBefore + 1) {
    return failAuthorityPersistenceContract('INVALID_AUTHORITY_VERSION');
  }
  return true;
}

export function assertAuthorityVersionOutcomeV1(
  operationType: AuthorityOperationType,
  outcome: AuthorityVersionOutcomeV1,
  before: number | undefined,
  after: number | undefined,
): void {
  if (
    outcome !== 'REPLAY' &&
    !AUTHORITY_REPOSITORY_RESULT_STATUSES.includes(outcome)
  ) {
    failAuthorityPersistenceContract('INVALID_AUTHORITY_VERSION');
  }
  if (outcome === 'APPLIED') {
    if (
      !shouldIncrementAuthorityVersionV1(operationType, before, after)
    ) {
      failAuthorityPersistenceContract('INVALID_AUTHORITY_VERSION');
    }
    return;
  }
  requireEnumValue(
    operationType,
    AUTHORITY_OPERATION_TYPES,
    'INVALID_AUTHORITY_VERSION',
  );
  if (before === undefined || after === undefined) {
    if (before !== after) {
      failAuthorityPersistenceContract('INVALID_AUTHORITY_VERSION');
    }
    return;
  }
  if (
    requirePositiveInteger(before, 'INVALID_AUTHORITY_VERSION') !==
    requirePositiveInteger(after, 'INVALID_AUTHORITY_VERSION')
  ) {
    failAuthorityPersistenceContract('INVALID_AUTHORITY_VERSION');
  }
}
