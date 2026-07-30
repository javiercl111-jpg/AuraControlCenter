import type {
  AuthorityAuthenticationClaimsSnapshotV1,
  AuthorityCanonicalPrincipalIdBindingV1,
  AuthorityPrincipalResolutionContextV1,
  AuthorityPrincipalResolutionRequestV1,
  AuthorityPrincipalResolutionResultV1,
  ResolvedHumanAuthorityPrincipalV1,
  ResolvedInternalServicePrincipalV1,
  ResolvedMigrationActorPrincipalV1,
  ResolvedSupportOperatorPrincipalV1,
  ResolvedSystemActorPrincipalV1,
} from './principalResolutionTypes';
import {
  validateAuthorityAuthenticationClaimsSnapshotV1,
  validateAuthorityCanonicalPrincipalIdBindingV1,
  validateAuthorityPrincipalResolutionContextV1,
  validateAuthorityPrincipalResolutionRequestV1,
  validateAuthorityPrincipalResolutionResultV1,
  validateResolvedHumanAuthorityPrincipalV1,
  validateResolvedInternalServicePrincipalV1,
  validateResolvedMigrationActorPrincipalV1,
  validateResolvedSupportOperatorPrincipalV1,
  validateResolvedSystemActorPrincipalV1,
} from './principalResolutionValidators';

export function createAuthorityAuthenticationClaimsSnapshotV1(
  value: unknown,
): AuthorityAuthenticationClaimsSnapshotV1 {
  return validateAuthorityAuthenticationClaimsSnapshotV1(value);
}

export function createAuthorityPrincipalIdV1(
  bindingValue: unknown,
): string {
  const binding: AuthorityCanonicalPrincipalIdBindingV1 =
    validateAuthorityCanonicalPrincipalIdBindingV1(bindingValue);
  return binding.canonicalPrincipalId;
}

export function createResolvedHumanAuthorityPrincipalV1(
  value: unknown,
): ResolvedHumanAuthorityPrincipalV1 {
  return validateResolvedHumanAuthorityPrincipalV1(value);
}

export function createResolvedInternalServicePrincipalV1(
  value: unknown,
): ResolvedInternalServicePrincipalV1 {
  return validateResolvedInternalServicePrincipalV1(value);
}

export function createResolvedSystemActorPrincipalV1(
  value: unknown,
): ResolvedSystemActorPrincipalV1 {
  return validateResolvedSystemActorPrincipalV1(value);
}

export function createResolvedMigrationActorPrincipalV1(
  value: unknown,
): ResolvedMigrationActorPrincipalV1 {
  return validateResolvedMigrationActorPrincipalV1(value);
}

export function createResolvedSupportOperatorPrincipalV1(
  value: unknown,
): ResolvedSupportOperatorPrincipalV1 {
  return validateResolvedSupportOperatorPrincipalV1(value);
}

export function createAuthorityPrincipalResolutionRequestV1(
  value: unknown,
): AuthorityPrincipalResolutionRequestV1 {
  return validateAuthorityPrincipalResolutionRequestV1(value);
}

export function createAuthorityPrincipalResolutionContextV1(
  value: unknown,
): AuthorityPrincipalResolutionContextV1 {
  return validateAuthorityPrincipalResolutionContextV1(value);
}

export function createAuthorityPrincipalResolutionResultV1(
  value: unknown,
): AuthorityPrincipalResolutionResultV1 {
  return validateAuthorityPrincipalResolutionResultV1(value);
}
