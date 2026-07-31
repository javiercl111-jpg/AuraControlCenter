import {
  AUTHORITY_APPLICATION_SERVICE_ERROR_VERSION,
  type AuthorityApplicationRetryDisposition,
  type AuthorityApplicationSafeCode,
} from './authorityApplicationServiceTypes';

export const AUTHORITY_APPLICATION_SERVICE_CONTRACT_ISSUES =
  Object.freeze([
    'INVALID_RECORD',
    'UNKNOWN_FIELD',
    'INVALID_DEPENDENCY',
    'INVALID_REQUEST',
    'INVALID_EXECUTION_CONTEXT',
    'INVALID_IDEMPOTENCY',
    'INVALID_OBLIGATION_INPUT',
    'INVALID_OBLIGATION_RESULT',
    'INVALID_STAGE_TRACE',
    'INVALID_RESULT',
    'COMMAND_BINDING_MISMATCH',
  ] as const);
export type AuthorityApplicationServiceContractIssue =
  (typeof AUTHORITY_APPLICATION_SERVICE_CONTRACT_ISSUES)[number];

export const AUTHORITY_APPLICATION_SERVICE_ERROR_CODES = Object.freeze([
  'AUTHORITY_APPLICATION_SERVICE_CONTRACT_INVALID',
  'AUTHORITY_APPLICATION_SERVICE_VALIDATION_FAILED',
  'AUTHORITY_APPLICATION_SERVICE_EXECUTION_FAILED',
] as const);
export type AuthorityApplicationServiceErrorCode =
  (typeof AUTHORITY_APPLICATION_SERVICE_ERROR_CODES)[number];

export interface AuthorityApplicationServiceSafeErrorV1 {
  readonly version: typeof AUTHORITY_APPLICATION_SERVICE_ERROR_VERSION;
  readonly code: AuthorityApplicationServiceErrorCode;
  readonly safeMessage: string;
  readonly issue?: AuthorityApplicationServiceContractIssue;
  readonly field?: string;
  readonly safeCode?: AuthorityApplicationSafeCode;
  readonly retryDisposition?: AuthorityApplicationRetryDisposition;
}

export class AuthorityApplicationServiceContractError extends Error {
  readonly version = AUTHORITY_APPLICATION_SERVICE_ERROR_VERSION;
  readonly code: AuthorityApplicationServiceErrorCode;
  readonly safeMessage: string;
  readonly issue?: AuthorityApplicationServiceContractIssue;
  readonly field?: string;
  readonly safeCode?: AuthorityApplicationSafeCode;
  readonly retryDisposition?: AuthorityApplicationRetryDisposition;

  constructor(input: {
    readonly code?: AuthorityApplicationServiceErrorCode;
    readonly safeMessage?: string;
    readonly issue?: AuthorityApplicationServiceContractIssue;
    readonly field?: string;
    readonly safeCode?: AuthorityApplicationSafeCode;
    readonly retryDisposition?: AuthorityApplicationRetryDisposition;
  } = {}) {
    const safeMessage =
      input.safeMessage ?? 'Authority application service is invalid.';
    super(safeMessage);
    this.name = 'AuthorityApplicationServiceContractError';
    this.code =
      input.code ?? 'AUTHORITY_APPLICATION_SERVICE_CONTRACT_INVALID';
    this.safeMessage = safeMessage;
    this.issue = input.issue;
    this.field = input.field;
    this.safeCode = input.safeCode;
    this.retryDisposition = input.retryDisposition;
    Object.setPrototypeOf(this, new.target.prototype);
    if (new.target === AuthorityApplicationServiceContractError) {
      Object.freeze(this);
    }
  }

  toJSON(): AuthorityApplicationServiceSafeErrorV1 {
    return Object.freeze({
      version: this.version,
      code: this.code,
      safeMessage: this.safeMessage,
      ...(this.issue === undefined ? {} : { issue: this.issue }),
      ...(this.field === undefined ? {} : { field: this.field }),
      ...(this.safeCode === undefined ? {} : { safeCode: this.safeCode }),
      ...(this.retryDisposition === undefined
        ? {}
        : { retryDisposition: this.retryDisposition }),
    });
  }
}

export class AuthorityApplicationServiceValidationError extends AuthorityApplicationServiceContractError {
  constructor(
    issue: AuthorityApplicationServiceContractIssue,
    field?: string,
  ) {
    super({
      code: 'AUTHORITY_APPLICATION_SERVICE_VALIDATION_FAILED',
      safeMessage: 'Authority application service value is invalid.',
      issue,
      ...(field === undefined ? {} : { field }),
      safeCode: 'AUTHORITY_REQUEST_INVALID',
      retryDisposition: 'DO_NOT_RETRY',
    });
    this.name = 'AuthorityApplicationServiceValidationError';
    Object.freeze(this);
  }
}

export class AuthorityApplicationServiceExecutionError extends AuthorityApplicationServiceContractError {
  constructor(
    safeCode: AuthorityApplicationSafeCode,
    retryDisposition: AuthorityApplicationRetryDisposition,
  ) {
    super({
      code: 'AUTHORITY_APPLICATION_SERVICE_EXECUTION_FAILED',
      safeMessage: 'Authority application service execution failed.',
      safeCode,
      retryDisposition,
    });
    this.name = 'AuthorityApplicationServiceExecutionError';
    Object.freeze(this);
  }
}
