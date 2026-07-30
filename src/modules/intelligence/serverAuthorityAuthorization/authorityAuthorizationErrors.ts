import {
  AUTHORITY_AUTHORIZATION_ERROR_VERSION,
  type AuthorityAuthorizationRetryDisposition,
} from './authorityAuthorizationTypes';

export const AUTHORITY_AUTHORIZATION_CONTRACT_ISSUES = Object.freeze([
  'INVALID_RECORD',
  'UNKNOWN_FIELD',
  'INVALID_LITERAL',
  'INVALID_IDENTIFIER',
  'INVALID_REFERENCE',
  'INVALID_VERSION',
  'INVALID_FINGERPRINT',
  'INVALID_TIMESTAMP',
  'INVALID_TIME_ORDER',
  'INVALID_DURATION',
  'INVALID_PERMISSION',
  'INVALID_OPERATION_BINDING',
  'INVALID_PRINCIPAL_BINDING',
  'INVALID_SCOPE_BINDING',
  'INVALID_RESOURCE_BINDING',
  'INVALID_POLICY_EVIDENCE',
  'INVALID_OBLIGATION',
  'INVALID_FRESHNESS',
  'INVALID_DECISION',
  'INVALID_REQUEST',
  'INVALID_CONTEXT',
  'INVALID_RESULT',
] as const);

export type AuthorityAuthorizationContractIssue =
  (typeof AUTHORITY_AUTHORIZATION_CONTRACT_ISSUES)[number];

export const AUTHORITY_AUTHORIZATION_ERROR_CODES = Object.freeze([
  'AUTHORITY_AUTHORIZATION_CONTRACT_INVALID',
  'AUTHORITY_AUTHORIZATION_VALIDATION_FAILED',
  'AUTHORITY_AUTHORIZATION_EVALUATION_FAILED',
] as const);

export type AuthorityAuthorizationErrorCode =
  (typeof AUTHORITY_AUTHORIZATION_ERROR_CODES)[number];

export interface AuthorityAuthorizationSafeErrorV1 {
  readonly version: typeof AUTHORITY_AUTHORIZATION_ERROR_VERSION;
  readonly code: AuthorityAuthorizationErrorCode;
  readonly safeMessage: string;
  readonly issue?: AuthorityAuthorizationContractIssue;
  readonly field?: string;
  readonly retryDisposition?: AuthorityAuthorizationRetryDisposition;
}

export class AuthorityAuthorizationContractError extends Error {
  readonly version = AUTHORITY_AUTHORIZATION_ERROR_VERSION;
  readonly code: AuthorityAuthorizationErrorCode;
  readonly safeMessage: string;
  readonly issue?: AuthorityAuthorizationContractIssue;
  readonly field?: string;
  readonly retryDisposition?: AuthorityAuthorizationRetryDisposition;

  constructor(input: {
    readonly code?: AuthorityAuthorizationErrorCode;
    readonly safeMessage?: string;
    readonly issue?: AuthorityAuthorizationContractIssue;
    readonly field?: string;
    readonly retryDisposition?: AuthorityAuthorizationRetryDisposition;
  }) {
    const safeMessage =
      input.safeMessage ?? 'Authority authorization contract is invalid.';
    super(safeMessage);
    this.name = 'AuthorityAuthorizationContractError';
    this.code =
      input.code ?? 'AUTHORITY_AUTHORIZATION_CONTRACT_INVALID';
    this.safeMessage = safeMessage;
    this.issue = input.issue;
    this.field = input.field;
    this.retryDisposition = input.retryDisposition;
    Object.setPrototypeOf(this, new.target.prototype);
    if (new.target === AuthorityAuthorizationContractError) {
      Object.freeze(this);
    }
  }

  toJSON(): AuthorityAuthorizationSafeErrorV1 {
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

export class AuthorityAuthorizationValidationError
  extends AuthorityAuthorizationContractError {
  constructor(
    issue: AuthorityAuthorizationContractIssue,
    field?: string,
  ) {
    super({
      code: 'AUTHORITY_AUTHORIZATION_VALIDATION_FAILED',
      safeMessage: 'Authority authorization value is invalid.',
      issue,
      ...(field === undefined ? {} : { field }),
      retryDisposition: 'DO_NOT_RETRY',
    });
    this.name = 'AuthorityAuthorizationValidationError';
    Object.freeze(this);
  }
}

export class AuthorityAuthorizationEvaluationError
  extends AuthorityAuthorizationContractError {
  constructor(retryDisposition: AuthorityAuthorizationRetryDisposition) {
    super({
      code: 'AUTHORITY_AUTHORIZATION_EVALUATION_FAILED',
      safeMessage: 'Authority authorization evaluation failed.',
      retryDisposition,
    });
    this.name = 'AuthorityAuthorizationEvaluationError';
    Object.freeze(this);
  }
}
