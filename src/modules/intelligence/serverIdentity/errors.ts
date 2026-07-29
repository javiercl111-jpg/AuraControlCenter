import {
  VERIFIED_IDENTITY_TENANT_BINDING_CONTRACT_ERROR_VERSION,
} from './types';

export const VERIFIED_IDENTITY_TENANT_BINDING_CONTRACT_ISSUES = [
  'INVALID_SUBJECT',
  'INVALID_IDENTITY_BINDING',
  'INVALID_TENANT',
  'INVALID_SELECTOR',
  'INVALID_MEMBERSHIP',
  'DUPLICATE_MEMBERSHIP',
  'PRINCIPAL_MISMATCH',
  'TENANT_MISMATCH',
  'INACTIVE_AUTHORITY',
  'INVALID_RESOLUTION',
  'CLAIMS_NOT_AUTHORITY',
] as const;

export type VerifiedIdentityTenantBindingContractIssue =
  (typeof VERIFIED_IDENTITY_TENANT_BINDING_CONTRACT_ISSUES)[number];

const SAFE_CONTRACT_ERROR_MESSAGE =
  'Verified identity and tenant binding contract is invalid.';

export class VerifiedIdentityTenantBindingContractError extends Error {
  readonly version = VERIFIED_IDENTITY_TENANT_BINDING_CONTRACT_ERROR_VERSION;
  readonly code = 'VERIFIED_IDENTITY_TENANT_BINDING_CONTRACT_INVALID';
  readonly issue: VerifiedIdentityTenantBindingContractIssue;

  constructor(issue: VerifiedIdentityTenantBindingContractIssue) {
    super(SAFE_CONTRACT_ERROR_MESSAGE);
    this.name = 'VerifiedIdentityTenantBindingContractError';
    this.issue = issue;
    Object.setPrototypeOf(this, new.target.prototype);
    Object.freeze(this);
  }
}

