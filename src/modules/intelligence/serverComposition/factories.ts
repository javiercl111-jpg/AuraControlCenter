import type {
  TrustedCompositionRootDependencies,
} from './ports';
import type {
  TrustedAuthenticationReferenceV1,
  TrustedPrincipalResolutionInputV1,
  TrustedRequestIdentityV1,
  TrustedResourceScopeV1,
  TrustedSanitizedTransportContextV1,
  TrustedServerExecutionResponseV1,
  TrustedServerLifecycleV1,
  TrustedServerPrincipalV1,
  TrustedServerRequestContextV1,
  TrustedTenantAuthorityResolutionInputV1,
  TrustedTenantMembershipV1,
} from './types';
import {
  sanitizeTrustedServerExecutionResponseV1,
  validateTrustedAuthenticationReferenceV1,
  validateTrustedCompositionRootDependencies,
  validateTrustedPrincipalResolutionInputV1,
  validateTrustedRequestIdentityV1,
  validateTrustedResourceScopeV1,
  validateTrustedSanitizedTransportContextV1,
  validateTrustedServerLifecycleV1,
  validateTrustedServerPrincipalV1,
  validateTrustedServerRequestContextV1,
  validateTrustedTenantAuthorityResolutionInputV1,
  validateTrustedTenantMembershipV1,
} from './validators';

export function createTrustedServerPrincipalV1(
  value: unknown
): TrustedServerPrincipalV1 {
  return validateTrustedServerPrincipalV1(value);
}

export function createTrustedTenantMembershipV1(
  value: unknown
): TrustedTenantMembershipV1 {
  return validateTrustedTenantMembershipV1(value);
}

export function createTrustedRequestIdentityV1(
  value: unknown
): TrustedRequestIdentityV1 {
  return validateTrustedRequestIdentityV1(value);
}

export function createTrustedServerLifecycleV1(
  value: unknown
): TrustedServerLifecycleV1 {
  return validateTrustedServerLifecycleV1(value);
}

export function createTrustedSanitizedTransportContextV1(
  value: unknown
): TrustedSanitizedTransportContextV1 {
  return validateTrustedSanitizedTransportContextV1(value);
}

export function createTrustedServerRequestContextV1(
  value: unknown
): TrustedServerRequestContextV1 {
  return validateTrustedServerRequestContextV1(value);
}

export function createTrustedAuthenticationReferenceV1(
  value: unknown
): TrustedAuthenticationReferenceV1 {
  return validateTrustedAuthenticationReferenceV1(value);
}

export function createTrustedResourceScopeV1(
  value: unknown
): TrustedResourceScopeV1 {
  return validateTrustedResourceScopeV1(value);
}

export function createTrustedPrincipalResolutionInputV1(
  value: unknown
): TrustedPrincipalResolutionInputV1 {
  return validateTrustedPrincipalResolutionInputV1(value);
}

export function createTrustedTenantAuthorityResolutionInputV1(
  value: unknown
): TrustedTenantAuthorityResolutionInputV1 {
  return validateTrustedTenantAuthorityResolutionInputV1(value);
}

export function createTrustedServerExecutionResponseV1(
  value: unknown
): TrustedServerExecutionResponseV1 {
  return sanitizeTrustedServerExecutionResponseV1(value);
}

export function createTrustedCompositionRootDependencies(
  value: unknown
): TrustedCompositionRootDependencies {
  return validateTrustedCompositionRootDependencies(value);
}
