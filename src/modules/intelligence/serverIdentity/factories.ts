import type { BoundaryActorReferenceV1 } from '../os/boundary/types';
import {
  TRUSTED_SERVER_PRINCIPAL_TYPES,
  TRUSTED_SERVER_PRINCIPAL_VERSION,
  TRUSTED_TENANT_MEMBERSHIP_VERSION,
  type TrustedServerPrincipalV1,
  type TrustedTenantMembershipV1,
} from '../serverComposition/types';
import {
  createTrustedServerPrincipalV1,
  createTrustedTenantMembershipV1,
} from '../serverComposition/factories';
import {
  validateTrustedServerPrincipalV1,
} from '../serverComposition/validators';
import {
  TENANT_MEMBERSHIP_KEY_VERSION,
  type CanonicalTenantAuthorityV1,
  type IdentityClaimsProjectionV1,
  type NeutralAuthenticationContextV1,
  type PrincipalResolutionInputV1,
  type PrincipalResolutionResultV1,
  type ResolverInvocationIdentityV1,
  type ServerOwnedTenantMembershipRecordV1,
  type TenantMembershipResolutionInputV1,
  type TenantMembershipResolutionResultV1,
  type TenantSelectorHintV1,
  type VerifiedAuthenticationSubjectV1,
  type VerifiedIdentityBindingV1,
  type VerifiedServiceIdentityBindingV1,
  type VerifiedSystemIdentityBindingV1,
  type VerifiedUserIdentityBindingV1,
} from './types';
import {
  failContract,
  getClosedRecord,
  requireCanonicalIdentifier,
  requireCanonicalTimestamp,
  requireEnumValue,
  requireNonEmptyVersion,
  requireTimestampOrder,
} from './helpers';
import {
  validateCanonicalTenantAuthorityV1,
  validateIdentityClaimsProjectionV1,
  validateNeutralAuthenticationContextV1,
  validatePrincipalResolutionInputV1,
  validatePrincipalResolutionResultV1,
  validateResolverInvocationIdentityV1,
  validateServerOwnedTenantMembershipRecordV1,
  validateTenantMembershipResolutionInputV1,
  validateTenantMembershipResolutionResultV1,
  validateTenantSelectorHintV1,
  validateVerifiedAuthenticationSubjectV1,
  validateVerifiedIdentityBindingV1,
  validateVerifiedServiceIdentityBindingV1,
  validateVerifiedSystemIdentityBindingV1,
  validateVerifiedUserIdentityBindingV1,
} from './validators';

export function createVerifiedAuthenticationSubjectV1(
  value: unknown,
): VerifiedAuthenticationSubjectV1 {
  return validateVerifiedAuthenticationSubjectV1(value);
}

export function createVerifiedUserIdentityBindingV1(
  value: unknown,
): VerifiedUserIdentityBindingV1 {
  return validateVerifiedUserIdentityBindingV1(value);
}

export function createVerifiedServiceIdentityBindingV1(
  value: unknown,
): VerifiedServiceIdentityBindingV1 {
  return validateVerifiedServiceIdentityBindingV1(value);
}

export function createVerifiedSystemIdentityBindingV1(
  value: unknown,
): VerifiedSystemIdentityBindingV1 {
  return validateVerifiedSystemIdentityBindingV1(value);
}

export function createVerifiedIdentityBindingV1(
  value: unknown,
): VerifiedIdentityBindingV1 {
  return validateVerifiedIdentityBindingV1(value);
}

export function createCanonicalTenantAuthorityV1(
  value: unknown,
): CanonicalTenantAuthorityV1 {
  return validateCanonicalTenantAuthorityV1(value);
}

export function createTenantSelectorHintV1(
  value: unknown,
): TenantSelectorHintV1 {
  return validateTenantSelectorHintV1(value);
}

export function createServerOwnedTenantMembershipRecordV1(
  value: unknown,
): ServerOwnedTenantMembershipRecordV1 {
  return validateServerOwnedTenantMembershipRecordV1(value);
}

export function createResolverInvocationIdentityV1(
  value: unknown,
): ResolverInvocationIdentityV1 {
  return validateResolverInvocationIdentityV1(value);
}

export function createNeutralAuthenticationContextV1(
  value: unknown,
): NeutralAuthenticationContextV1 {
  return validateNeutralAuthenticationContextV1(value);
}

export function createPrincipalResolutionInputV1(
  value: unknown,
): PrincipalResolutionInputV1 {
  return validatePrincipalResolutionInputV1(value);
}

export function createTenantMembershipResolutionInputV1(
  value: unknown,
): TenantMembershipResolutionInputV1 {
  return validateTenantMembershipResolutionInputV1(value);
}

export function createPrincipalResolutionResultV1(
  value: unknown,
): PrincipalResolutionResultV1 {
  return validatePrincipalResolutionResultV1(value);
}

export function createTenantMembershipResolutionResultV1(
  value: unknown,
): TenantMembershipResolutionResultV1 {
  return validateTenantMembershipResolutionResultV1(value);
}

export function createIdentityClaimsProjectionV1(
  value: unknown,
): IdentityClaimsProjectionV1 {
  return validateIdentityClaimsProjectionV1(value);
}

export function createTrustedServerPrincipalFromVerifiedBindingV1(
  value: unknown,
): TrustedServerPrincipalV1 {
  const record = getClosedRecord(
    value,
    ['subject', 'binding'],
    'INVALID_IDENTITY_BINDING',
  );
  const subject = validateVerifiedAuthenticationSubjectV1(record.subject);
  const binding = validateVerifiedIdentityBindingV1(record.binding);
  if (
    subject.subjectType !== binding.principalType ||
    subject.provider !== binding.provider ||
    subject.providerSubjectId !== binding.providerSubjectId
  ) {
    return failContract('INVALID_IDENTITY_BINDING');
  }
  requireTimestampOrder(
    binding.verifiedAt,
    subject.revocationCheckedAt,
    true,
    'INVALID_IDENTITY_BINDING',
  );
  return createTrustedServerPrincipalV1({
    schemaVersion: TRUSTED_SERVER_PRINCIPAL_VERSION,
    principalId: binding.canonicalPrincipalId,
    principalType: binding.principalType,
    authenticationMethod: subject.authenticationMethod,
    provider: subject.provider,
    authenticatedAt: subject.authenticatedAt,
    ...(subject.claimsFingerprint === undefined
      ? {}
      : { claimsFingerprint: subject.claimsFingerprint }),
  });
}

export function createTrustedTenantMembershipFromAuthorityV1(
  value: unknown,
): TrustedTenantMembershipV1 {
  const record = getClosedRecord(
    value,
    ['principal', 'tenant', 'membership', 'resolvedAt', 'resolverVersion'],
    'INVALID_MEMBERSHIP',
  );
  let principal: TrustedServerPrincipalV1;
  try {
    principal = validateTrustedServerPrincipalV1(record.principal);
  } catch {
    return failContract('INVALID_MEMBERSHIP');
  }
  const tenant = validateCanonicalTenantAuthorityV1(record.tenant);
  const membership = validateServerOwnedTenantMembershipRecordV1(
    record.membership,
  );
  if (
    membership.status !== 'ACTIVE' ||
    tenant.status !== 'ACTIVE'
  ) {
    return failContract('INACTIVE_AUTHORITY');
  }
  if (
    membership.principalId !== principal.principalId ||
    membership.principalType !== principal.principalType
  ) {
    return failContract('PRINCIPAL_MISMATCH');
  }
  if (membership.tenantId !== tenant.tenantId) {
    return failContract('TENANT_MISMATCH');
  }
  const resolvedAt = requireCanonicalTimestamp(
    record.resolvedAt,
    'INVALID_MEMBERSHIP',
  );
  const resolverVersion = requireNonEmptyVersion(
    record.resolverVersion,
    'INVALID_MEMBERSHIP',
  );
  requireTimestampOrder(
    principal.authenticatedAt,
    resolvedAt,
    true,
    'INVALID_MEMBERSHIP',
  );
  requireTimestampOrder(
    tenant.resolvedAt,
    resolvedAt,
    true,
    'INVALID_MEMBERSHIP',
  );
  requireTimestampOrder(
    membership.updatedAt,
    resolvedAt,
    true,
    'INVALID_MEMBERSHIP',
  );
  return createTrustedTenantMembershipV1({
    schemaVersion: TRUSTED_TENANT_MEMBERSHIP_VERSION,
    tenantId: tenant.tenantId,
    principalId: principal.principalId,
    membershipId: membership.membershipId,
    roles: membership.roles,
    status: 'ACTIVE',
    resolvedAt,
    resolverVersion,
  });
}

export function deriveBoundaryActorFromTrustedPrincipalV1(
  value: unknown,
): BoundaryActorReferenceV1 {
  let principal: TrustedServerPrincipalV1;
  try {
    principal = validateTrustedServerPrincipalV1(value);
  } catch {
    return failContract('INVALID_RESOLUTION');
  }
  return Object.freeze({
    actorType: principal.principalType,
    actorId: principal.principalId,
  });
}

function frameMembershipKeyPart(value: string): string {
  return `${value.length}:${value}`;
}

export function createCanonicalTenantMembershipKeyV1(
  value: unknown,
): string {
  const record = getClosedRecord(
    value,
    ['principalType', 'principalId', 'tenantId'],
    'INVALID_MEMBERSHIP',
  );
  const principalType = requireEnumValue(
    record.principalType,
    TRUSTED_SERVER_PRINCIPAL_TYPES,
    'INVALID_MEMBERSHIP',
  );
  const principalId = requireCanonicalIdentifier(
    record.principalId,
    'INVALID_MEMBERSHIP',
  );
  const tenantId = requireCanonicalIdentifier(
    record.tenantId,
    'INVALID_MEMBERSHIP',
  );
  if (tenantId.toLowerCase() === 'aura_root') {
    return failContract('INVALID_MEMBERSHIP');
  }
  return [
    `v${TENANT_MEMBERSHIP_KEY_VERSION}`,
    frameMembershipKeyPart(principalType),
    frameMembershipKeyPart(principalId),
    frameMembershipKeyPart(tenantId),
  ].join('|');
}

export function assertUniqueTenantMembershipRecordsV1(
  values: readonly unknown[],
): readonly ServerOwnedTenantMembershipRecordV1[] {
  if (!Array.isArray(values)) {
    return failContract('INVALID_MEMBERSHIP');
  }
  const memberships = values.map((value) =>
    validateServerOwnedTenantMembershipRecordV1(value),
  );
  const logicalKeys = memberships.map((membership) =>
    createCanonicalTenantMembershipKeyV1({
      principalType: membership.principalType,
      principalId: membership.principalId,
      tenantId: membership.tenantId,
    }),
  );
  const membershipIds = memberships.map(
    (membership) => membership.membershipId,
  );
  if (
    new Set(logicalKeys).size !== logicalKeys.length ||
    new Set(membershipIds).size !== membershipIds.length
  ) {
    return failContract('DUPLICATE_MEMBERSHIP');
  }
  return Object.freeze(memberships);
}

export function requireExplicitTenantSelectorV1(
  selector: unknown,
  memberships: readonly unknown[],
): TenantSelectorHintV1 {
  const validatedMemberships =
    assertUniqueTenantMembershipRecordsV1(memberships);
  if (selector === undefined || validatedMemberships.length === 0) {
    return failContract('INVALID_SELECTOR');
  }
  const validatedSelector = validateTenantSelectorHintV1(selector);
  if (validatedSelector.selectionStrategy === 'EXPLICIT_CANONICAL_ID') {
    const matches = validatedMemberships.filter(
      (membership) =>
        membership.tenantId ===
        validatedSelector.canonicalTenantIdCandidate,
    );
    if (matches.length !== 1) {
      return failContract('INVALID_SELECTOR');
    }
  }
  return validatedSelector;
}
