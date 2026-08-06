import { failAuthorityProvisioning } from './authorityProvisioningErrors';
import type {
  AuthorityProvisioningDependenciesV1,
  AuthorityProvisioningUnitOfWorkV1,
} from './authorityProvisioningPorts';
import {
  AUTHORITY_PROVISIONING_AUDIT_VERSION,
  AUTHORITY_PROVISIONING_RECORD_VERSION,
  AUTHORITY_PROVISIONING_SERVICE_VERSION,
  CONTROLLED_PREVIEW_HAPPY_PATH,
  type AuthorityProvisioningServiceV1,
  type PlatformPrincipalV1,
  type PlatformTenantV1,
  type ProvisionSyntheticPreviewAuthorityRequestV1,
  type ProvisionSyntheticPreviewAuthorityResponseV1,
  type ResolvedPreviewAuthorityV1,
  type TenantMembershipV1,
} from './authorityProvisioningTypes';
import {
  validateAuthorityFingerprintV1,
  validateAuthorityProvisioningAuditRecordV1,
  validateAuthorityProvisioningTimestampV1,
  validateGeneratedAuthorityIdentifierV1,
  validatePlatformPrincipalV1,
  validatePlatformTenantV1,
  validateProvisionSyntheticPreviewAuthorityRequestV1,
  validateResolvePreviewAuthorityRequestV1,
  validateTenantMembershipV1,
} from './authorityProvisioningValidators';

function locator(identifier: string): string {
  return `${identifier.slice(0, 6)}...${identifier.slice(-4)}`;
}

function sameCapabilities(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function assertPrincipal(
  value: PlatformPrincipalV1,
  expected: PlatformPrincipalV1,
): void {
  if (
    value.principalId !== expected.principalId ||
    value.authUid !== expected.authUid ||
    value.environment !== 'PREVIEW' ||
    value.testMetadata.label !== expected.testMetadata.label
  ) {
    failAuthorityProvisioning('PRINCIPAL_CONFLICT');
  }
}

function assertTenant(value: PlatformTenantV1, expected: PlatformTenantV1): void {
  if (
    value.tenantId !== expected.tenantId ||
    value.environment !== 'PREVIEW' ||
    value.tenantType !== 'SYNTHETIC_TEST' ||
    value.testMetadata.label !== expected.testMetadata.label
  ) {
    failAuthorityProvisioning('TENANT_CONFLICT');
  }
}

function assertMembership(
  value: TenantMembershipV1,
  expected: TenantMembershipV1,
): void {
  if (
    value.membershipId !== expected.membershipId ||
    value.principalId !== expected.principalId ||
    value.tenantId !== expected.tenantId ||
    value.environment !== 'PREVIEW' ||
    !sameCapabilities(value.capabilities, expected.capabilities)
  ) {
    failAuthorityProvisioning('MEMBERSHIP_CONFLICT');
  }
}

function response(
  request: ProvisionSyntheticPreviewAuthorityRequestV1,
  principal: PlatformPrincipalV1,
  tenant: PlatformTenantV1,
  membership: TenantMembershipV1,
  fingerprint: string,
  occurredAt: string,
  created: boolean,
): ProvisionSyntheticPreviewAuthorityResponseV1 {
  return Object.freeze({
    version: AUTHORITY_PROVISIONING_SERVICE_VERSION,
    status: created ? 'PROVISIONED' : 'REUSED',
    principalLocator: locator(principal.principalId),
    tenantLocator: locator(tenant.tenantId),
    membershipLocator: locator(membership.membershipId),
    assignedCapabilities: request.requestedCapabilities,
    created: Object.freeze({
      principal: created,
      tenant: created,
      membership: created,
    }),
    idempotencyResult: created ? 'CREATED' : 'REPLAYED',
    auditFingerprint: fingerprint,
    occurredAt,
  });
}

async function loadExpected(
  unit: AuthorityProvisioningUnitOfWorkV1,
  principal: PlatformPrincipalV1,
  tenant: PlatformTenantV1,
  membership: TenantMembershipV1,
): Promise<Readonly<{
  principal: PlatformPrincipalV1 | null;
  tenant: PlatformTenantV1 | null;
  membership: TenantMembershipV1 | null;
}>> {
  const [existingPrincipal, existingTenant, existingMembership] = await Promise.all([
    unit.principals.getByAuthUid(principal.authUid),
    unit.tenants.getByTenantId(tenant.tenantId),
    unit.memberships.getByMembershipId(membership.membershipId),
  ]);
  return Object.freeze({
    principal: existingPrincipal === null
      ? null
      : validatePlatformPrincipalV1(existingPrincipal),
    tenant: existingTenant === null
      ? null
      : validatePlatformTenantV1(existingTenant),
    membership: existingMembership === null
      ? null
      : validateTenantMembershipV1(existingMembership),
  });
}

export function buildAuthorityProvisioningServiceV1(
  dependencies: AuthorityProvisioningDependenciesV1,
): AuthorityProvisioningServiceV1 {
  async function provision(
    rawRequest: unknown,
  ): Promise<ProvisionSyntheticPreviewAuthorityResponseV1> {
    const request = validateProvisionSyntheticPreviewAuthorityRequestV1(rawRequest);
    const occurredAt = validateAuthorityProvisioningTimestampV1(
      dependencies.clock.now(),
    );
    const principalId = validateGeneratedAuthorityIdentifierV1(
      dependencies.ids.principalId({
        authUid: request.authUid,
        identityLabel: request.identityLabel,
      }),
    );
    const tenantId = validateGeneratedAuthorityIdentifierV1(
      dependencies.ids.tenantId({ tenantLabel: request.tenantLabel }),
    );
    const membershipId = validateGeneratedAuthorityIdentifierV1(
      dependencies.ids.membershipId({ principalId, tenantId }),
    );
    const auditId = validateGeneratedAuthorityIdentifierV1(
      dependencies.ids.auditId({ idempotencyKey: request.idempotencyKey }),
    );
    const requestFingerprint = validateAuthorityFingerprintV1(
      dependencies.fingerprints.fingerprint(request),
    );

    const principal = validatePlatformPrincipalV1({
      schemaVersion: AUTHORITY_PROVISIONING_RECORD_VERSION,
      principalId,
      authUid: request.authUid,
      status: 'ACTIVE',
      environment: 'PREVIEW',
      createdAt: occurredAt,
      updatedAt: occurredAt,
      testMetadata: {
        label: request.identityLabel,
        approvedUse: CONTROLLED_PREVIEW_HAPPY_PATH,
        synthetic: true,
      },
    });
    const tenant = validatePlatformTenantV1({
      schemaVersion: AUTHORITY_PROVISIONING_RECORD_VERSION,
      tenantId,
      status: 'ACTIVE',
      environment: 'PREVIEW',
      tenantType: 'SYNTHETIC_TEST',
      createdAt: occurredAt,
      updatedAt: occurredAt,
      testMetadata: {
        label: request.tenantLabel,
        approvedUse: CONTROLLED_PREVIEW_HAPPY_PATH,
        synthetic: true,
      },
    });
    const membership = validateTenantMembershipV1({
      schemaVersion: AUTHORITY_PROVISIONING_RECORD_VERSION,
      membershipId,
      principalId,
      tenantId,
      status: 'ACTIVE',
      environment: 'PREVIEW',
      capabilities: request.requestedCapabilities,
      createdAt: occurredAt,
      updatedAt: occurredAt,
    });
    const audit = validateAuthorityProvisioningAuditRecordV1({
      schemaVersion: AUTHORITY_PROVISIONING_AUDIT_VERSION,
      auditId,
      idempotencyKey: request.idempotencyKey,
      requestFingerprint,
      principalId,
      tenantId,
      membershipId,
      environment: 'PREVIEW',
      occurredAt,
      approvedUse: CONTROLLED_PREVIEW_HAPPY_PATH,
    });

    return dependencies.transaction.run(async (unit) => {
      const rawExistingAudit = await unit.audit.getByAuditId(auditId);
      const existingAudit = rawExistingAudit === null
        ? null
        : validateAuthorityProvisioningAuditRecordV1(rawExistingAudit);
      if (
        existingAudit !== null &&
        existingAudit.requestFingerprint !== requestFingerprint
      ) {
        return failAuthorityProvisioning('IDEMPOTENCY_CONFLICT');
      }
      const existing = await loadExpected(unit, principal, tenant, membership);
      if (existing.principal !== null) assertPrincipal(existing.principal, principal);
      if (existing.tenant !== null) assertTenant(existing.tenant, tenant);
      if (existing.membership !== null) assertMembership(existing.membership, membership);
      const present = [existing.principal, existing.tenant, existing.membership]
        .filter((value) => value !== null).length;
      if (present !== 0 && present !== 3) {
        return failAuthorityProvisioning('PARTIAL_STATE_DETECTED');
      }
      if (existingAudit !== null && present !== 3) {
        return failAuthorityProvisioning('PARTIAL_STATE_DETECTED');
      }
      if (present === 3) {
        if (existingAudit === null) await unit.audit.create(audit);
        return response(
          request,
          existing.principal as PlatformPrincipalV1,
          existing.tenant as PlatformTenantV1,
          existing.membership as TenantMembershipV1,
          requestFingerprint,
          existingAudit?.occurredAt ?? occurredAt,
          false,
        );
      }
      await unit.principals.create(principal);
      await unit.tenants.create(tenant);
      await unit.memberships.create(membership);
      await unit.audit.create(audit);
      return response(
        request,
        principal,
        tenant,
        membership,
        requestFingerprint,
        occurredAt,
        true,
      );
    });
  }

  async function resolve(rawRequest: unknown): Promise<ResolvedPreviewAuthorityV1> {
    const request = validateResolvePreviewAuthorityRequestV1(rawRequest);
    return dependencies.transaction.run(async (unit) => {
      const rawPrincipal = await unit.principals.getByAuthUid(request.authUid);
      if (rawPrincipal === null) return failAuthorityProvisioning('PRINCIPAL_NOT_FOUND');
      const principal = validatePlatformPrincipalV1(rawPrincipal);
      if (principal.status !== 'ACTIVE') {
        return failAuthorityProvisioning('PRINCIPAL_DISABLED');
      }
      const memberships = (await unit.memberships.listByPrincipalId(principal.principalId))
        .map((item) => validateTenantMembershipV1(item));
      if (memberships.length === 0) {
        return failAuthorityProvisioning('MEMBERSHIP_NOT_FOUND');
      }
      const active = memberships.filter((item) => item.status === 'ACTIVE');
      if (active.length === 0) {
        return failAuthorityProvisioning('MEMBERSHIP_DISABLED');
      }
      if (active.length !== 1) {
        return failAuthorityProvisioning('AMBIGUOUS_MEMBERSHIP');
      }
      const membership = active[0];
      if (
        membership.environment !== request.environment ||
        principal.environment !== request.environment
      ) {
        return failAuthorityProvisioning('ENVIRONMENT_NOT_PREVIEW');
      }
      if (
        request.expectedTenantId !== undefined &&
        request.expectedTenantId !== membership.tenantId
      ) {
        return failAuthorityProvisioning('CROSS_TENANT_FORBIDDEN');
      }
      const rawTenant = await unit.tenants.getByTenantId(membership.tenantId);
      if (rawTenant === null) return failAuthorityProvisioning('TENANT_NOT_FOUND');
      const tenant = validatePlatformTenantV1(rawTenant);
      if (tenant.status !== 'ACTIVE') return failAuthorityProvisioning('TENANT_DISABLED');
      if (tenant.environment !== request.environment) {
        return failAuthorityProvisioning('ENVIRONMENT_NOT_PREVIEW');
      }
      return Object.freeze({
        version: AUTHORITY_PROVISIONING_SERVICE_VERSION,
        status: 'ACTIVE',
        environment: 'PREVIEW',
        principalLocator: locator(principal.principalId),
        tenantLocator: locator(tenant.tenantId),
        membershipLocator: locator(membership.membershipId),
        effectiveCapabilities: membership.capabilities,
      });
    });
  }

  return Object.freeze({
    version: AUTHORITY_PROVISIONING_SERVICE_VERSION,
    provisionSyntheticIdentityAuthority: provision,
    resolveAuthority: resolve,
    inspectAuthority: resolve,
  });
}
