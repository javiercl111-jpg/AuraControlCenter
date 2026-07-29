import { failAuthorityPersistenceContract } from './helpers';
import type {
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
