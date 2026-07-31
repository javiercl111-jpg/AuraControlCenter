import {
  AUTHORITY_INVOCATION_CONTEXT_ERROR_VERSION,
  type AuthorityInvocationContextReasonCode,
  type AuthorityInvocationContextRetryDisposition,
} from './authorityInvocationContextTypes';

export const AUTHORITY_INVOCATION_CONTEXT_CONTRACT_ISSUES = Object.freeze([
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
  'INVALID_PRINCIPAL_PROJECTION',
  'INVALID_SCOPE_PROJECTION',
  'INVALID_AUTHORIZATION_PROJECTION',
  'INVALID_OPERATION_BINDING',
  'INVALID_OBLIGATION_EVIDENCE',
  'INVALID_OBLIGATION_SUMMARY',
  'INVALID_REQUEST_METADATA',
  'INVALID_IDEMPOTENCY_METADATA',
  'INVALID_FRESHNESS',
  'INVALID_CONTEXT',
  'INVALID_RESULT',
  'BINDING_MISMATCH',
] as const);

export type AuthorityInvocationContextContractIssue =
  (typeof AUTHORITY_INVOCATION_CONTEXT_CONTRACT_ISSUES)[number];

export const AUTHORITY_INVOCATION_CONTEXT_ERROR_CODES = Object.freeze([
  'AUTHORITY_INVOCATION_CONTEXT_CONTRACT_INVALID',
  'AUTHORITY_INVOCATION_CONTEXT_VALIDATION_FAILED',
  'AUTHORITY_INVOCATION_CONTEXT_PROJECTION_FAILED',
] as const);
export type AuthorityInvocationContextErrorCode =
  (typeof AUTHORITY_INVOCATION_CONTEXT_ERROR_CODES)[number];

export interface AuthorityInvocationContextSafeErrorV1 {
  readonly version: typeof AUTHORITY_INVOCATION_CONTEXT_ERROR_VERSION;
  readonly code: AuthorityInvocationContextErrorCode;
  readonly safeMessage: string;
  readonly issue?: AuthorityInvocationContextContractIssue;
  readonly field?: string;
  readonly reasonCode?: AuthorityInvocationContextReasonCode;
  readonly retryDisposition?: AuthorityInvocationContextRetryDisposition;
}

export class AuthorityInvocationContextContractError extends Error {
  readonly version = AUTHORITY_INVOCATION_CONTEXT_ERROR_VERSION;
  readonly code: AuthorityInvocationContextErrorCode;
  readonly safeMessage: string;
  readonly issue?: AuthorityInvocationContextContractIssue;
  readonly field?: string;
  readonly reasonCode?: AuthorityInvocationContextReasonCode;
  readonly retryDisposition?: AuthorityInvocationContextRetryDisposition;

  constructor(input: {
    readonly code?: AuthorityInvocationContextErrorCode;
    readonly safeMessage?: string;
    readonly issue?: AuthorityInvocationContextContractIssue;
    readonly field?: string;
    readonly reasonCode?: AuthorityInvocationContextReasonCode;
    readonly retryDisposition?: AuthorityInvocationContextRetryDisposition;
  } = {}) {
    const safeMessage =
      input.safeMessage ?? 'Authority invocation context is invalid.';
    super(safeMessage);
    this.name = 'AuthorityInvocationContextContractError';
    this.code =
      input.code ?? 'AUTHORITY_INVOCATION_CONTEXT_CONTRACT_INVALID';
    this.safeMessage = safeMessage;
    this.issue = input.issue;
    this.field = input.field;
    this.reasonCode = input.reasonCode;
    this.retryDisposition = input.retryDisposition;
    Object.setPrototypeOf(this, new.target.prototype);
    if (new.target === AuthorityInvocationContextContractError) {
      Object.freeze(this);
    }
  }

  toJSON(): AuthorityInvocationContextSafeErrorV1 {
    return Object.freeze({
      version: this.version,
      code: this.code,
      safeMessage: this.safeMessage,
      ...(this.issue === undefined ? {} : { issue: this.issue }),
      ...(this.field === undefined ? {} : { field: this.field }),
      ...(this.reasonCode === undefined
        ? {}
        : { reasonCode: this.reasonCode }),
      ...(this.retryDisposition === undefined
        ? {}
        : { retryDisposition: this.retryDisposition }),
    });
  }
}

export class AuthorityInvocationContextValidationError extends AuthorityInvocationContextContractError {
  constructor(
    issue: AuthorityInvocationContextContractIssue,
    field?: string,
    reasonCode: AuthorityInvocationContextReasonCode = 'INVALID_INVOCATION_CONTEXT',
  ) {
    super({
      code: 'AUTHORITY_INVOCATION_CONTEXT_VALIDATION_FAILED',
      safeMessage: 'Authority invocation context value is invalid.',
      issue,
      ...(field === undefined ? {} : { field }),
      reasonCode,
      retryDisposition: 'DO_NOT_RETRY',
    });
    this.name = 'AuthorityInvocationContextValidationError';
    Object.freeze(this);
  }
}

export class AuthorityInvocationContextProjectionError extends AuthorityInvocationContextContractError {
  constructor(
    reasonCode: AuthorityInvocationContextReasonCode,
    retryDisposition: AuthorityInvocationContextRetryDisposition =
      'DO_NOT_RETRY',
  ) {
    super({
      code: 'AUTHORITY_INVOCATION_CONTEXT_PROJECTION_FAILED',
      safeMessage: 'Authority invocation context cannot be projected.',
      reasonCode,
      retryDisposition,
    });
    this.name = 'AuthorityInvocationContextProjectionError';
    Object.freeze(this);
  }
}
