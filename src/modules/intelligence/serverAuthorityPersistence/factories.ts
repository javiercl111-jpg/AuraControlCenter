import { failAuthorityPersistenceContract } from './helpers';
import type {
  AuthorityAdministrativeCommandV1,
  AuthorityAuditEventV1,
  AuthorityIdempotencyRecordV1,
  AuthorityMigrationMetadataV1,
  AuthorityOperationBindingRecordV1,
  AuthorityOutboxDeliveryRecordV1,
  AuthorityOutboxEventV1,
  AuthorityRepositoryAuthorizationDecisionV1,
  AuthorityRepositoryInvocationContextV1,
  AuthorityRepositoryResultV1,
  AuthorityWritePreconditionV1,
  CanonicalizeLegacyTenantCommandV1,
  ChangeTenantMembershipStatusCommandV1,
  CreateTenantAuthorityCommandV1,
  CreateTenantMembershipCommandV1,
  LegacyTenantCanonicalizationInputV1,
  PersistedTenantAliasRecordV1,
  PersistedTenantAuthorityRecordV1,
  PersistedTenantMembershipRecordV1,
  ReserveTenantAliasCommandV1,
  TenantActivationPrerequisiteV1,
  TombstoneTenantAliasCommandV1,
  UpdateTenantMembershipRolesCommandV1,
  UpdateTenantStatusCommandV1,
} from './types';
import {
  validateAuthorityAdministrativeCommandV1,
  validateAuthorityAuditEventV1,
  validateAuthorityOperationBindingRecordV1,
  validateAuthorityOutboxDeliveryRecordV1,
  validateAuthorityIdempotencyRecordV1,
  validateAuthorityMigrationMetadataV1,
  validateAuthorityOutboxEventV1,
  validateAuthorityRepositoryResultV1,
  validateAuthorityRepositoryAuthorizationDecisionV1,
  validateAuthorityRepositoryInvocationContextV1,
  validateAuthorityWritePreconditionV1,
  validatePersistedTenantAliasRecordV1,
  validatePersistedTenantAuthorityRecordV1,
  validatePersistedTenantMembershipRecordV1,
  validateLegacyTenantCanonicalizationInputV1,
  validateTenantActivationPrerequisiteV1,
} from './validators';

export function createPersistedTenantAuthorityRecordV1(
  value: unknown,
  documentId: unknown,
): PersistedTenantAuthorityRecordV1 {
  return validatePersistedTenantAuthorityRecordV1(value, documentId);
}

export function createPersistedTenantMembershipRecordV1(
  value: unknown,
  documentId: unknown,
): PersistedTenantMembershipRecordV1 {
  return validatePersistedTenantMembershipRecordV1(value, documentId);
}

export function createPersistedTenantAliasRecordV1(
  value: unknown,
  documentId: unknown,
): PersistedTenantAliasRecordV1 {
  return validatePersistedTenantAliasRecordV1(value, documentId);
}

export function createAuthorityMigrationMetadataV1(
  value: unknown,
): AuthorityMigrationMetadataV1 {
  return validateAuthorityMigrationMetadataV1(value);
}

export function createAuthorityWritePreconditionV1(
  value: unknown,
): AuthorityWritePreconditionV1 {
  return validateAuthorityWritePreconditionV1(value);
}

export function createAuthorityAdministrativeCommandV1(
  value: unknown,
): AuthorityAdministrativeCommandV1 {
  return validateAuthorityAdministrativeCommandV1(value);
}

export function createCreateTenantAuthorityCommandV1(
  value: unknown,
): CreateTenantAuthorityCommandV1 {
  const command = validateAuthorityAdministrativeCommandV1(value);
  if (command.operationType !== 'CREATE_TENANT_AUTHORITY') {
    return failAuthorityPersistenceContract('INVALID_COMMAND');
  }
  return command;
}

export function createUpdateTenantStatusCommandV1(
  value: unknown,
): UpdateTenantStatusCommandV1 {
  const command = validateAuthorityAdministrativeCommandV1(value);
  if (command.operationType !== 'UPDATE_TENANT_STATUS') {
    return failAuthorityPersistenceContract('INVALID_COMMAND');
  }
  return command;
}

export function createCreateTenantMembershipCommandV1(
  value: unknown,
): CreateTenantMembershipCommandV1 {
  const command = validateAuthorityAdministrativeCommandV1(value);
  if (command.operationType !== 'CREATE_TENANT_MEMBERSHIP') {
    return failAuthorityPersistenceContract('INVALID_COMMAND');
  }
  return command;
}

export function createUpdateTenantMembershipRolesCommandV1(
  value: unknown,
): UpdateTenantMembershipRolesCommandV1 {
  const command = validateAuthorityAdministrativeCommandV1(value);
  if (command.operationType !== 'UPDATE_TENANT_MEMBERSHIP_ROLES') {
    return failAuthorityPersistenceContract('INVALID_COMMAND');
  }
  return command;
}

export function createChangeTenantMembershipStatusCommandV1(
  value: unknown,
): ChangeTenantMembershipStatusCommandV1 {
  const command = validateAuthorityAdministrativeCommandV1(value);
  if (command.operationType !== 'CHANGE_TENANT_MEMBERSHIP_STATUS') {
    return failAuthorityPersistenceContract('INVALID_COMMAND');
  }
  return command;
}

export function createReserveTenantAliasCommandV1(
  value: unknown,
): ReserveTenantAliasCommandV1 {
  const command = validateAuthorityAdministrativeCommandV1(value);
  if (command.operationType !== 'RESERVE_TENANT_ALIAS') {
    return failAuthorityPersistenceContract('INVALID_COMMAND');
  }
  return command;
}

export function createTombstoneTenantAliasCommandV1(
  value: unknown,
): TombstoneTenantAliasCommandV1 {
  const command = validateAuthorityAdministrativeCommandV1(value);
  if (command.operationType !== 'TOMBSTONE_TENANT_ALIAS') {
    return failAuthorityPersistenceContract('INVALID_COMMAND');
  }
  return command;
}

export function createCanonicalizeLegacyTenantCommandV1(
  value: unknown,
): CanonicalizeLegacyTenantCommandV1 {
  const command = validateAuthorityAdministrativeCommandV1(value);
  if (command.operationType !== 'CANONICALIZE_LEGACY_TENANT') {
    return failAuthorityPersistenceContract('INVALID_COMMAND');
  }
  return command;
}

export function createAuthorityIdempotencyRecordV1(
  value: unknown,
): AuthorityIdempotencyRecordV1 {
  return validateAuthorityIdempotencyRecordV1(value);
}

export function createAuthorityRepositoryResultV1(
  value: unknown,
): AuthorityRepositoryResultV1 {
  return validateAuthorityRepositoryResultV1(value);
}

export function createAuthorityAuditEventV1(
  value: unknown,
): AuthorityAuditEventV1 {
  return validateAuthorityAuditEventV1(value);
}

export function createAuthorityOutboxEventV1(
  value: unknown,
): AuthorityOutboxEventV1 {
  return validateAuthorityOutboxEventV1(value);
}

export function createAuthorityRepositoryAuthorizationDecisionV1(
  value: unknown,
): AuthorityRepositoryAuthorizationDecisionV1 {
  return validateAuthorityRepositoryAuthorizationDecisionV1(value);
}

export function createAuthorityRepositoryInvocationContextV1(
  value: unknown,
  command: unknown,
): AuthorityRepositoryInvocationContextV1 {
  return validateAuthorityRepositoryInvocationContextV1(value, command);
}

export function createAuthorityOperationBindingRecordV1(
  value: unknown,
): AuthorityOperationBindingRecordV1 {
  return validateAuthorityOperationBindingRecordV1(value);
}

export function createAuthorityOutboxDeliveryRecordV1(
  value: unknown,
): AuthorityOutboxDeliveryRecordV1 {
  return validateAuthorityOutboxDeliveryRecordV1(value);
}

export function createTenantActivationPrerequisiteV1(
  value: unknown,
): TenantActivationPrerequisiteV1 {
  return validateTenantActivationPrerequisiteV1(value);
}

export function createLegacyTenantCanonicalizationInputV1(
  value: unknown,
): LegacyTenantCanonicalizationInputV1 {
  return validateLegacyTenantCanonicalizationInputV1(value);
}
