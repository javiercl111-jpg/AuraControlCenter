import type {
  AuthorityAuthorizationDecisionV1,
  AuthorityAuthorizationEvaluationContextV1,
  AuthorityAuthorizationFreshnessV1,
  AuthorityAuthorizationObligationV1,
  AuthorityAuthorizationOperationBindingV1,
  AuthorityAuthorizationPolicyEvidenceV1,
  AuthorityAuthorizationPrincipalBindingV1,
  AuthorityAuthorizationRequestV1,
  AuthorityAuthorizationResourceBindingV1,
  AuthorityAuthorizationResultV1,
  AuthorityAuthorizationScopeBindingV1,
} from './authorityAuthorizationTypes';
import {
  validateAuthorityAuthorizationDecisionV1,
  validateAuthorityAuthorizationEvaluationContextV1,
  validateAuthorityAuthorizationFreshnessV1,
  validateAuthorityAuthorizationObligationV1,
  validateAuthorityAuthorizationOperationBindingV1,
  validateAuthorityAuthorizationPolicyEvidenceV1,
  validateAuthorityAuthorizationPrincipalBindingV1,
  validateAuthorityAuthorizationRequestV1,
  validateAuthorityAuthorizationResourceBindingV1,
  validateAuthorityAuthorizationResultV1,
  validateAuthorityAuthorizationScopeBindingV1,
} from './authorityAuthorizationValidators';

export function createAuthorityAuthorizationPrincipalBindingV1(
  value: unknown,
): AuthorityAuthorizationPrincipalBindingV1 {
  return validateAuthorityAuthorizationPrincipalBindingV1(value);
}

export function createAuthorityAuthorizationScopeBindingV1(
  value: unknown,
): AuthorityAuthorizationScopeBindingV1 {
  return validateAuthorityAuthorizationScopeBindingV1(value);
}

export function createAuthorityAuthorizationResourceBindingV1(
  value: unknown,
): AuthorityAuthorizationResourceBindingV1 {
  return validateAuthorityAuthorizationResourceBindingV1(value);
}

export function createAuthorityAuthorizationOperationBindingV1(
  value: unknown,
): AuthorityAuthorizationOperationBindingV1 {
  return validateAuthorityAuthorizationOperationBindingV1(value);
}

export function createAuthorityAuthorizationPolicyEvidenceV1(
  value: unknown,
): AuthorityAuthorizationPolicyEvidenceV1 {
  return validateAuthorityAuthorizationPolicyEvidenceV1(value);
}

export function createAuthorityAuthorizationObligationV1(
  value: unknown,
): AuthorityAuthorizationObligationV1 {
  return validateAuthorityAuthorizationObligationV1(value);
}

export function createAuthorityAuthorizationFreshnessV1(
  value: unknown,
): AuthorityAuthorizationFreshnessV1 {
  return validateAuthorityAuthorizationFreshnessV1(value);
}

export function createAuthorityAuthorizationDecisionV1(
  value: unknown,
): AuthorityAuthorizationDecisionV1 {
  return validateAuthorityAuthorizationDecisionV1(value);
}

export function createAuthorityAuthorizationRequestV1(
  value: unknown,
): AuthorityAuthorizationRequestV1 {
  return validateAuthorityAuthorizationRequestV1(value);
}

export function createAuthorityAuthorizationEvaluationContextV1(
  value: unknown,
): AuthorityAuthorizationEvaluationContextV1 {
  return validateAuthorityAuthorizationEvaluationContextV1(value);
}

export function createAuthorityAuthorizationResultV1(
  value: unknown,
): AuthorityAuthorizationResultV1 {
  return validateAuthorityAuthorizationResultV1(value);
}
