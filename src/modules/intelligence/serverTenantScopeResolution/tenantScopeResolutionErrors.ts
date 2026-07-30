import {
  AUTHORITY_TENANT_SCOPE_ERROR_VERSION,
  type AuthorityTenantScopeRetryDisposition,
} from './tenantScopeResolutionTypes';

export const AUTHORITY_TENANT_SCOPE_CONTRACT_ISSUES = Object.freeze([
  'INVALID_RECORD',
  'UNKNOWN_FIELD',
  'INVALID_LITERAL',
  'INVALID_IDENTIFIER',
  'INVALID_TENANT_ID',
  'INVALID_ALIAS',
  'INVALID_REFERENCE',
  'INVALID_VERSION',
  'INVALID_FINGERPRINT',
  'INVALID_TIMESTAMP',
  'INVALID_TIME_ORDER',
  'INVALID_DURATION',
  'INVALID_SELECTOR',
  'INVALID_MEMBERSHIP_BINDING',
  'INVALID_EVIDENCE',
  'INVALID_FRESHNESS',
  'INVALID_PRINCIPAL_REFERENCE',
  'INVALID_SCOPE',
  'INVALID_REQUEST',
  'INVALID_CONTEXT',
  'INVALID_RESULT',
] as const);

export type AuthorityTenantScopeContractIssue =
  (typeof AUTHORITY_TENANT_SCOPE_CONTRACT_ISSUES)[number];

export const AUTHORITY_TENANT_SCOPE_ERROR_CODES = Object.freeze([
  'AUTHORITY_TENANT_SCOPE_CONTRACT_INVALID',
  'AUTHORITY_TENANT_SCOPE_VALIDATION_FAILED',
  'AUTHORITY_TENANT_SCOPE_RESOLUTION_FAILED',
] as const);

export type AuthorityTenantScopeErrorCode =
  (typeof AUTHORITY_TENANT_SCOPE_ERROR_CODES)[number];

export interface AuthorityTenantScopeSafeErrorV1 {
  readonly version: typeof AUTHORITY_TENANT_SCOPE_ERROR_VERSION;
  readonly code: AuthorityTenantScopeErrorCode;
  readonly safeMessage: string;
  readonly issue?: AuthorityTenantScopeContractIssue;
  readonly field?: string;
  readonly retryDisposition?: AuthorityTenantScopeRetryDisposition;
}

export class AuthorityTenantScopeContractError extends Error {
  readonly version = AUTHORITY_TENANT_SCOPE_ERROR_VERSION;
  readonly code: AuthorityTenantScopeErrorCode;
  readonly safeMessage: string;
  readonly issue?: AuthorityTenantScopeContractIssue;
  readonly field?: string;
  readonly retryDisposition?: AuthorityTenantScopeRetryDisposition;

  constructor(input: {
    readonly code?: AuthorityTenantScopeErrorCode;
    readonly safeMessage?: string;
    readonly issue?: AuthorityTenantScopeContractIssue;
    readonly field?: string;
    readonly retryDisposition?: AuthorityTenantScopeRetryDisposition;
  }) {
    const safeMessage =
      input.safeMessage ?? 'Authority tenant scope contract is invalid.';
    super(safeMessage);
    this.name = 'AuthorityTenantScopeContractError';
    this.code =
      input.code ?? 'AUTHORITY_TENANT_SCOPE_CONTRACT_INVALID';
    this.safeMessage = safeMessage;
    this.issue = input.issue;
    this.field = input.field;
    this.retryDisposition = input.retryDisposition;
    Object.setPrototypeOf(this, new.target.prototype);
    if (new.target === AuthorityTenantScopeContractError) {
      Object.freeze(this);
    }
  }

  toJSON(): AuthorityTenantScopeSafeErrorV1 {
    return Object.freeze({
      version: this.version,
      code: this.code,
      safeMessage: this.safeMessage,
      ...(this.issue === undefined ? {} : { issue: this.issue }),
      ...(this.field === undefined ? {} : { field: this.field }),
      ...(this.retryDisposition === undefined
        ? {}
        : { retryDisposition: this.retryDisposition }),
    });
  }
}

export class AuthorityTenantScopeValidationError
  extends AuthorityTenantScopeContractError {
  constructor(
    issue: AuthorityTenantScopeContractIssue,
    field?: string,
  ) {
    super({
      code: 'AUTHORITY_TENANT_SCOPE_VALIDATION_FAILED',
      safeMessage: 'Authority tenant scope value is invalid.',
      issue,
      ...(field === undefined ? {} : { field }),
      retryDisposition: 'DO_NOT_RETRY',
    });
    this.name = 'AuthorityTenantScopeValidationError';
    Object.freeze(this);
  }
}

export class AuthorityTenantScopeResolutionError
  extends AuthorityTenantScopeContractError {
  constructor(retryDisposition: AuthorityTenantScopeRetryDisposition) {
    super({
      code: 'AUTHORITY_TENANT_SCOPE_RESOLUTION_FAILED',
      safeMessage: 'Authority tenant scope resolution failed.',
      retryDisposition,
    });
    this.name = 'AuthorityTenantScopeResolutionError';
    Object.freeze(this);
  }
}
