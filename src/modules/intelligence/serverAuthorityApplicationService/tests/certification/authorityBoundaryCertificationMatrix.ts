import type {
  AuthorityApplicationResultStatus,
  AuthorityApplicationSafeCode,
  AuthorityApplicationStage,
} from '../../authorityApplicationServiceTypes';

export const PRINCIPAL_FAILURE_MATRIX = Object.freeze([
  ['NOT_FOUND', 'NOT_FOUND'],
  ['REJECTED', 'REJECTED'],
  ['STALE', 'STALE'],
  ['REVOKED', 'STALE'],
  ['CONFLICT', 'CONFLICT'],
  ['INTERNAL_ERROR', 'INTERNAL_ERROR'],
] as const);

export const SCOPE_FAILURE_MATRIX = Object.freeze([
  ['NOT_FOUND', 'NOT_FOUND'],
  ['REJECTED', 'REJECTED'],
  ['STALE', 'STALE'],
  ['REVOKED', 'STALE'],
  ['CONFLICT', 'CONFLICT'],
  ['AMBIGUOUS', 'CONFLICT'],
  ['INTERNAL_ERROR', 'INTERNAL_ERROR'],
] as const);

export const AUTHORIZATION_DECISION_MATRIX = Object.freeze([
  ['ALLOW', 'APPLIED'],
  ['DENY', 'NOT_AUTHORIZED'],
  ['INDETERMINATE', 'REJECTED'],
  ['NOT_APPLICABLE', 'REJECTED'],
] as const);

export const AUTHORIZATION_FAILURE_MATRIX = Object.freeze([
  ['REJECTED', 'REJECTED'],
  ['STALE', 'STALE'],
  ['CONFLICT', 'CONFLICT'],
  ['INTERNAL_ERROR', 'INTERNAL_ERROR'],
] as const);

export const OBLIGATION_TYPE_MATRIX = Object.freeze([
  'REQUIRE_FRESH_AUTHENTICATION',
  'REQUIRE_APP_CHECK',
  'REQUIRE_MFA',
  'REQUIRE_IDEMPOTENCY_KEY',
  'REQUIRE_EXPECTED_VERSION',
  'REQUIRE_AUDIT_REASON',
  'REQUIRE_CHANGE_TICKET',
  'REQUIRE_SUPPORT_SESSION',
  'REQUIRE_MIGRATION_MANIFEST',
  'MASK_NOT_FOUND',
  'LIMIT_TO_TEST_ONLY',
] as const);

export const REPOSITORY_RESULT_MATRIX = Object.freeze([
  ['APPLIED', 'APPLIED', 'AUTHORITY_OPERATION_APPLIED'],
  ['NO_OP', 'REPLAYED', 'AUTHORITY_OPERATION_REPLAYED'],
  ['REJECTED', 'REJECTED', 'AUTHORITY_OPERATION_REJECTED'],
  ['CONFLICT', 'CONFLICT', 'AUTHORITY_OPERATION_CONFLICT'],
  ['NOT_FOUND', 'NOT_FOUND', 'AUTHORITY_RESOURCE_NOT_AVAILABLE'],
  ['INTERNAL_ERROR', 'INTERNAL_ERROR', 'AUTHORITY_INTERNAL_FAILURE'],
] as const satisfies readonly (readonly [
  string,
  AuthorityApplicationResultStatus,
  AuthorityApplicationSafeCode,
])[]);

export const CANCELLATION_MATRIX = Object.freeze([
  [3, 'PRINCIPAL_RESOLUTION'],
  [5, 'PRINCIPAL_RESOLUTION'],
  [6, 'TENANT_SCOPE_RESOLUTION'],
  [8, 'TENANT_SCOPE_RESOLUTION'],
  [9, 'AUTHORIZATION_EVALUATION'],
  [11, 'AUTHORIZATION_EVALUATION'],
  [12, 'OBLIGATION_VERIFICATION'],
  [14, 'OBLIGATION_VERIFICATION'],
  [15, 'CONTEXT_CONSTRUCTION'],
  [17, 'CONTEXT_FINGERPRINT'],
  [18, 'CONTEXT_FINGERPRINT'],
  [20, 'CONTEXT_FINGERPRINT'],
  [21, 'PERSISTENCE_PROJECTION'],
  [23, 'REPOSITORY_EXECUTION'],
  [24, 'REPOSITORY_EXECUTION'],
] as const satisfies readonly (readonly [number, AuthorityApplicationStage])[]);

export const SENSITIVE_TERMS = Object.freeze([
  'token',
  'claims',
  'password',
  'email',
  'firebaseUid',
  'membershipBinding',
  'policySource',
  'firestore',
  'stack',
  'secret',
  'payload',
  'documentPath',
] as const);
