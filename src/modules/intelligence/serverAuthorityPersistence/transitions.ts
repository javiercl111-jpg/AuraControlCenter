import { failAuthorityPersistenceContract } from './helpers';
import type {
  AuthorityEventType,
  TenantAuthorityStatus,
  TenantMembershipAuthorityStatus,
} from './types';

const TENANT_TRANSITIONS: Readonly<
  Record<TenantAuthorityStatus, readonly TenantAuthorityStatus[]>
> = Object.freeze({
  PENDING: Object.freeze(['ACTIVE', 'DEACTIVATED'] as const),
  ACTIVE: Object.freeze(['SUSPENDED', 'DEACTIVATED'] as const),
  SUSPENDED: Object.freeze(['ACTIVE', 'DEACTIVATED'] as const),
  DEACTIVATED: Object.freeze(['DELETED'] as const),
  DELETED: Object.freeze([] as const),
});

const MEMBERSHIP_TRANSITIONS: Readonly<
  Record<
    TenantMembershipAuthorityStatus,
    readonly TenantMembershipAuthorityStatus[]
  >
> = Object.freeze({
  ACTIVE: Object.freeze(['SUSPENDED', 'REVOKED'] as const),
  SUSPENDED: Object.freeze(['ACTIVE', 'REVOKED'] as const),
  REVOKED: Object.freeze(['DELETED'] as const),
  DELETED: Object.freeze([] as const),
});

export function isTenantAuthorityTransitionAllowedV1(
  currentStatus: TenantAuthorityStatus,
  targetStatus: TenantAuthorityStatus,
): boolean {
  return TENANT_TRANSITIONS[currentStatus].includes(targetStatus);
}

export function assertTenantAuthorityTransitionV1(
  currentStatus: TenantAuthorityStatus,
  targetStatus: TenantAuthorityStatus,
): void {
  if (!isTenantAuthorityTransitionAllowedV1(currentStatus, targetStatus)) {
    failAuthorityPersistenceContract('INVALID_TRANSITION');
  }
}

export function isTenantMembershipTransitionAllowedV1(
  currentStatus: TenantMembershipAuthorityStatus,
  targetStatus: TenantMembershipAuthorityStatus,
): boolean {
  return MEMBERSHIP_TRANSITIONS[currentStatus].includes(targetStatus);
}

export function assertTenantMembershipTransitionV1(
  currentStatus: TenantMembershipAuthorityStatus,
  targetStatus: TenantMembershipAuthorityStatus,
): void {
  if (!isTenantMembershipTransitionAllowedV1(currentStatus, targetStatus)) {
    failAuthorityPersistenceContract('INVALID_TRANSITION');
  }
}

export function getTenantAuthorityTransitionEventTypeV1(
  currentStatus: TenantAuthorityStatus,
  targetStatus: TenantAuthorityStatus,
): AuthorityEventType {
  assertTenantAuthorityTransitionV1(currentStatus, targetStatus);
  if (targetStatus === 'ACTIVE') {
    return currentStatus === 'PENDING'
      ? 'TENANT_ACTIVATED'
      : 'TENANT_REACTIVATED';
  }
  if (targetStatus === 'SUSPENDED') {
    return 'TENANT_SUSPENDED';
  }
  if (targetStatus === 'DEACTIVATED') {
    return 'TENANT_DEACTIVATED';
  }
  if (targetStatus === 'DELETED') {
    return 'TENANT_DELETED';
  }
  return failAuthorityPersistenceContract('INVALID_TRANSITION');
}

export function getTenantMembershipTransitionEventTypeV1(
  currentStatus: TenantMembershipAuthorityStatus,
  targetStatus: TenantMembershipAuthorityStatus,
): AuthorityEventType {
  assertTenantMembershipTransitionV1(currentStatus, targetStatus);
  if (targetStatus === 'ACTIVE') {
    return 'MEMBERSHIP_REACTIVATED';
  }
  if (targetStatus === 'SUSPENDED') {
    return 'MEMBERSHIP_SUSPENDED';
  }
  if (targetStatus === 'REVOKED') {
    return 'MEMBERSHIP_REVOKED';
  }
  if (targetStatus === 'DELETED') {
    return 'MEMBERSHIP_DELETED';
  }
  return failAuthorityPersistenceContract('INVALID_TRANSITION');
}
