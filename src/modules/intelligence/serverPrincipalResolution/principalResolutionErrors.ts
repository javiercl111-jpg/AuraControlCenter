import {
  AUTHORITY_PRINCIPAL_CONTRACT_ERROR_VERSION,
  type AuthorityPrincipalRetryDisposition,
} from './principalResolutionTypes';

export const AUTHORITY_PRINCIPAL_CONTRACT_ISSUES = Object.freeze([
  'INVALID_RECORD',
  'UNKNOWN_FIELD',
  'INVALID_LITERAL',
  'INVALID_IDENTIFIER',
  'INVALID_PRINCIPAL_ID',
  'INVALID_FIREBASE_UID',
  'INVALID_PLATFORM_USER_ID',
  'INVALID_SERVICE_PRINCIPAL',
  'INVALID_REFERENCE',
  'INVALID_VERSION',
  'INVALID_FINGERPRINT',
  'INVALID_TIMESTAMP',
  'INVALID_TIME_ORDER',
  'INVALID_DURATION',
  'INVALID_APP_CHECK_EVIDENCE',
  'INVALID_ASSURANCE',
  'INVALID_CLAIMS_SNAPSHOT',
  'INVALID_AUTHENTICATION_BINDING',
  'INVALID_PRINCIPAL_BINDING',
  'INVALID_RESOLUTION_EVIDENCE',
  'INVALID_FRESHNESS',
  'INVALID_RESOLVED_PRINCIPAL',
  'INVALID_RESOLUTION_REQUEST',
  'INVALID_RESOLUTION_CONTEXT',
  'INVALID_RESOLUTION_RESULT',
] as const);

export type AuthorityPrincipalContractIssue =
  (typeof AUTHORITY_PRINCIPAL_CONTRACT_ISSUES)[number];

export const AUTHORITY_PRINCIPAL_ERROR_CODES = Object.freeze([
  'AUTHORITY_PRINCIPAL_CONTRACT_INVALID',
  'AUTHORITY_PRINCIPAL_VALIDATION_FAILED',
  'AUTHORITY_PRINCIPAL_RESOLUTION_FAILED',
] as const);

export type AuthorityPrincipalErrorCode =
  (typeof AUTHORITY_PRINCIPAL_ERROR_CODES)[number];

export interface AuthorityPrincipalSafeErrorV1 {
  readonly version: typeof AUTHORITY_PRINCIPAL_CONTRACT_ERROR_VERSION;
  readonly code: AuthorityPrincipalErrorCode;
  readonly safeMessage: string;
  readonly issue?: AuthorityPrincipalContractIssue;
  readonly field?: string;
  readonly retryDisposition?: AuthorityPrincipalRetryDisposition;
}

export class AuthorityPrincipalContractError extends Error {
  readonly version = AUTHORITY_PRINCIPAL_CONTRACT_ERROR_VERSION;
  readonly code: AuthorityPrincipalErrorCode;
  readonly safeMessage: string;
  readonly issue?: AuthorityPrincipalContractIssue;
  readonly field?: string;
  readonly retryDisposition?: AuthorityPrincipalRetryDisposition;

  constructor(input: {
    readonly code?: AuthorityPrincipalErrorCode;
    readonly safeMessage?: string;
    readonly issue?: AuthorityPrincipalContractIssue;
    readonly field?: string;
    readonly retryDisposition?: AuthorityPrincipalRetryDisposition;
  }) {
    const safeMessage =
      input.safeMessage ?? 'Authority principal contract is invalid.';
    super(safeMessage);
    this.name = 'AuthorityPrincipalContractError';
    this.code =
      input.code ?? 'AUTHORITY_PRINCIPAL_CONTRACT_INVALID';
    this.safeMessage = safeMessage;
    this.issue = input.issue;
    this.field = input.field;
    this.retryDisposition = input.retryDisposition;
    Object.setPrototypeOf(this, new.target.prototype);
    if (new.target === AuthorityPrincipalContractError) {
      Object.freeze(this);
    }
  }

  toJSON(): AuthorityPrincipalSafeErrorV1 {
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

export class AuthorityPrincipalValidationError
  extends AuthorityPrincipalContractError {
  constructor(
    issue: AuthorityPrincipalContractIssue,
    field?: string,
  ) {
    super({
      code: 'AUTHORITY_PRINCIPAL_VALIDATION_FAILED',
      safeMessage: 'Authority principal value is invalid.',
      issue,
      ...(field === undefined ? {} : { field }),
      retryDisposition: 'DO_NOT_RETRY',
    });
    this.name = 'AuthorityPrincipalValidationError';
    Object.freeze(this);
  }
}

export class AuthorityPrincipalResolutionError
  extends AuthorityPrincipalContractError {
  constructor(
    retryDisposition: AuthorityPrincipalRetryDisposition,
  ) {
    super({
      code: 'AUTHORITY_PRINCIPAL_RESOLUTION_FAILED',
      safeMessage: 'Authority principal resolution failed.',
      retryDisposition,
    });
    this.name = 'AuthorityPrincipalResolutionError';
    Object.freeze(this);
  }
}
