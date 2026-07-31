import type {
  AuthorityInvocationAuthorizationProjectionV1,
  AuthorityInvocationContextResultV1,
  AuthorityInvocationContextV1,
  AuthorityInvocationFreshnessV1,
  AuthorityInvocationIdempotencyV1,
  AuthorityInvocationOperationBindingV1,
  AuthorityInvocationPrincipalProjectionV1,
  AuthorityInvocationRequestMetadataV1,
  AuthorityInvocationScopeProjectionV1,
  AuthorityObligationSatisfactionEvidenceV1,
  AuthorityObligationSatisfactionSummaryV1,
} from './authorityInvocationContextTypes';
import {
  validateAuthorityInvocationAuthorizationProjectionV1,
  validateAuthorityInvocationContextResultV1,
  validateAuthorityInvocationContextV1,
  validateAuthorityInvocationFreshnessV1,
  validateAuthorityInvocationIdempotencyV1,
  validateAuthorityInvocationOperationBindingV1,
  validateAuthorityInvocationPrincipalProjectionV1,
  validateAuthorityInvocationRequestMetadataV1,
  validateAuthorityInvocationScopeProjectionV1,
  validateAuthorityObligationSatisfactionEvidenceV1,
  validateAuthorityObligationSatisfactionSummaryV1,
} from './authorityInvocationContextValidators';

export function createAuthorityInvocationPrincipalProjectionV1(
  value: unknown,
): AuthorityInvocationPrincipalProjectionV1 {
  return validateAuthorityInvocationPrincipalProjectionV1(value);
}

export function createAuthorityInvocationScopeProjectionV1(
  value: unknown,
): AuthorityInvocationScopeProjectionV1 {
  return validateAuthorityInvocationScopeProjectionV1(value);
}

export function createAuthorityInvocationAuthorizationProjectionV1(
  value: unknown,
): AuthorityInvocationAuthorizationProjectionV1 {
  return validateAuthorityInvocationAuthorizationProjectionV1(value);
}

export function createAuthorityInvocationOperationBindingV1(
  value: unknown,
): AuthorityInvocationOperationBindingV1 {
  return validateAuthorityInvocationOperationBindingV1(value);
}

export function createAuthorityObligationSatisfactionEvidenceV1(
  value: unknown,
): AuthorityObligationSatisfactionEvidenceV1 {
  return validateAuthorityObligationSatisfactionEvidenceV1(value);
}

export function createAuthorityObligationSatisfactionSummaryV1(
  value: unknown,
): AuthorityObligationSatisfactionSummaryV1 {
  return validateAuthorityObligationSatisfactionSummaryV1(value);
}

export function createAuthorityInvocationRequestMetadataV1(
  value: unknown,
): AuthorityInvocationRequestMetadataV1 {
  return validateAuthorityInvocationRequestMetadataV1(value);
}

export function createAuthorityInvocationIdempotencyV1(
  value: unknown,
): AuthorityInvocationIdempotencyV1 {
  return validateAuthorityInvocationIdempotencyV1(value);
}

export function createAuthorityInvocationFreshnessV1(
  value: unknown,
): AuthorityInvocationFreshnessV1 {
  return validateAuthorityInvocationFreshnessV1(value);
}

export function createAuthorityInvocationContextV1(
  value: unknown,
): AuthorityInvocationContextV1 {
  return validateAuthorityInvocationContextV1(value);
}

export function createAuthorityInvocationContextResultV1(
  value: unknown,
): AuthorityInvocationContextResultV1 {
  return validateAuthorityInvocationContextResultV1(value);
}
