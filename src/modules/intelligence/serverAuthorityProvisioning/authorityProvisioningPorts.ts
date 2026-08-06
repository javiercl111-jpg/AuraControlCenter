import type {
  AuthorityProvisioningAuditRecordV1,
  PlatformPrincipalV1,
  PlatformTenantV1,
  TenantMembershipV1,
} from './authorityProvisioningTypes';

export interface PlatformPrincipalRepositoryV1 {
  getByAuthUid(authUid: string): Promise<PlatformPrincipalV1 | null>;
  create(record: PlatformPrincipalV1): Promise<void>;
}

export interface PlatformTenantRepositoryV1 {
  getByTenantId(tenantId: string): Promise<PlatformTenantV1 | null>;
  create(record: PlatformTenantV1): Promise<void>;
}

export interface TenantMembershipRepositoryV1 {
  getByMembershipId(
    membershipId: string,
  ): Promise<TenantMembershipV1 | null>;
  listByPrincipalId(principalId: string): Promise<readonly TenantMembershipV1[]>;
  create(record: TenantMembershipV1): Promise<void>;
}

export interface AuthorityAuditRepositoryV1 {
  getByAuditId(
    auditId: string,
  ): Promise<AuthorityProvisioningAuditRecordV1 | null>;
  create(record: AuthorityProvisioningAuditRecordV1): Promise<void>;
}

export interface AuthorityProvisioningUnitOfWorkV1 {
  readonly principals: PlatformPrincipalRepositoryV1;
  readonly tenants: PlatformTenantRepositoryV1;
  readonly memberships: TenantMembershipRepositoryV1;
  readonly audit: AuthorityAuditRepositoryV1;
}

export interface AuthorityTransactionPortV1 {
  run<T>(
    operation: (unit: AuthorityProvisioningUnitOfWorkV1) => Promise<T>,
  ): Promise<T>;
}

export interface AuthorityClockV1 {
  now(): string;
}

export interface AuthorityIdProviderV1 {
  principalId(input: Readonly<{ authUid: string; identityLabel: string }>): string;
  tenantId(input: Readonly<{ tenantLabel: string }>): string;
  membershipId(
    input: Readonly<{ principalId: string; tenantId: string }>,
  ): string;
  auditId(input: Readonly<{ idempotencyKey: string }>): string;
}

export interface AuthorityFingerprintProviderV1 {
  fingerprint(value: unknown): string;
}

export interface AuthorityProvisioningDependenciesV1 {
  readonly transaction: AuthorityTransactionPortV1;
  readonly clock: AuthorityClockV1;
  readonly ids: AuthorityIdProviderV1;
  readonly fingerprints: AuthorityFingerprintProviderV1;
}
