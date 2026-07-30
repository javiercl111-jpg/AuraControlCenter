import type {
  AuthorityResolvedPrincipalReferenceV1,
  AuthorityTenantMembershipBindingV1,
  AuthorityTenantScopeResolutionContextV1,
  AuthorityTenantScopeResolutionRequestV1,
  AuthorityTenantScopeResolutionResultV1,
  AuthorityTenantSelectorV1,
  ResolvedLegacyCanonicalizationScopeV1,
  ResolvedMigrationTenantScopeV1,
  ResolvedPlatformAuthorityScopeV1,
  ResolvedSupportTenantScopeV1,
  ResolvedTenantAuthorityScopeV1,
  ResolvedTenantBootstrapScopeV1,
} from './tenantScopeResolutionTypes';
import {
  validateAuthorityResolvedPrincipalReferenceV1,
  validateAuthorityTenantMembershipBindingV1,
  validateAuthorityTenantScopeResolutionContextV1,
  validateAuthorityTenantScopeResolutionRequestV1,
  validateAuthorityTenantScopeResolutionResultV1,
  validateAuthorityTenantSelectorV1,
  validateResolvedLegacyCanonicalizationScopeV1,
  validateResolvedMigrationTenantScopeV1,
  validateResolvedPlatformAuthorityScopeV1,
  validateResolvedSupportTenantScopeV1,
  validateResolvedTenantAuthorityScopeV1,
  validateResolvedTenantBootstrapScopeV1,
} from './tenantScopeResolutionValidators';

export function createAuthorityTenantSelectorV1(
  value: unknown,
): AuthorityTenantSelectorV1 {
  return validateAuthorityTenantSelectorV1(value);
}

export function createAuthorityTenantMembershipBindingV1(
  value: unknown,
): AuthorityTenantMembershipBindingV1 {
  return validateAuthorityTenantMembershipBindingV1(value);
}

export function createAuthorityResolvedPrincipalReferenceV1(
  value: unknown,
): AuthorityResolvedPrincipalReferenceV1 {
  return validateAuthorityResolvedPrincipalReferenceV1(value);
}

export function createResolvedTenantAuthorityScopeV1(
  value: unknown,
): ResolvedTenantAuthorityScopeV1 {
  return validateResolvedTenantAuthorityScopeV1(value);
}

export function createResolvedPlatformAuthorityScopeV1(
  value: unknown,
): ResolvedPlatformAuthorityScopeV1 {
  return validateResolvedPlatformAuthorityScopeV1(value);
}

export function createResolvedTenantBootstrapScopeV1(
  value: unknown,
): ResolvedTenantBootstrapScopeV1 {
  return validateResolvedTenantBootstrapScopeV1(value);
}

export function createResolvedLegacyCanonicalizationScopeV1(
  value: unknown,
): ResolvedLegacyCanonicalizationScopeV1 {
  return validateResolvedLegacyCanonicalizationScopeV1(value);
}

export function createResolvedMigrationTenantScopeV1(
  value: unknown,
): ResolvedMigrationTenantScopeV1 {
  return validateResolvedMigrationTenantScopeV1(value);
}

export function createResolvedSupportTenantScopeV1(
  value: unknown,
): ResolvedSupportTenantScopeV1 {
  return validateResolvedSupportTenantScopeV1(value);
}

export function createAuthorityTenantScopeResolutionRequestV1(
  value: unknown,
): AuthorityTenantScopeResolutionRequestV1 {
  return validateAuthorityTenantScopeResolutionRequestV1(value);
}

export function createAuthorityTenantScopeResolutionContextV1(
  value: unknown,
): AuthorityTenantScopeResolutionContextV1 {
  return validateAuthorityTenantScopeResolutionContextV1(value);
}

export function createAuthorityTenantScopeResolutionResultV1(
  value: unknown,
): AuthorityTenantScopeResolutionResultV1 {
  return validateAuthorityTenantScopeResolutionResultV1(value);
}
