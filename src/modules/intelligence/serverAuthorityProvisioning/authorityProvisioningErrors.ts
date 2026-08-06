export const AUTHORITY_PROVISIONING_ERROR_CODES = Object.freeze([
  'INVALID_REQUEST',
  'INVALID_DEPENDENCIES',
  'ENVIRONMENT_NOT_PREVIEW',
  'UID_REQUIRED',
  'SYNTHETIC_LABEL_REQUIRED',
  'CAPABILITY_NOT_ALLOWED',
  'GLOBAL_PRIVILEGE_FORBIDDEN',
  'PRODUCTION_REFERENCE_FORBIDDEN',
  'IDEMPOTENCY_CONFLICT',
  'PRINCIPAL_CONFLICT',
  'TENANT_CONFLICT',
  'MEMBERSHIP_CONFLICT',
  'PARTIAL_STATE_DETECTED',
  'PRINCIPAL_NOT_FOUND',
  'PRINCIPAL_DISABLED',
  'TENANT_NOT_FOUND',
  'TENANT_DISABLED',
  'MEMBERSHIP_NOT_FOUND',
  'MEMBERSHIP_DISABLED',
  'AMBIGUOUS_MEMBERSHIP',
  'CROSS_TENANT_FORBIDDEN',
  'CAPABILITY_MISSING',
  'PERSISTENCE_FAILURE',
  'INVALID_RECORD',
] as const);

export type AuthorityProvisioningErrorCode =
  (typeof AUTHORITY_PROVISIONING_ERROR_CODES)[number];

export class AuthorityProvisioningError extends Error {
  readonly code: AuthorityProvisioningErrorCode;

  constructor(code: AuthorityProvisioningErrorCode) {
    super(code);
    this.name = 'AuthorityProvisioningError';
    this.code = code;
    Object.freeze(this);
  }
}

export function failAuthorityProvisioning(
  code: AuthorityProvisioningErrorCode,
): never {
  throw new AuthorityProvisioningError(code);
}
