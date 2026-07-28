import type { BoundaryPublicError } from './types';

export type BoundaryPublicErrorCode =
  | 'BOUNDARY_DISABLED'
  | 'MODE_NOT_ALLOWED'
  | 'INVALID_REQUEST'
  | 'INVALID_TENANT_CONTEXT'
  | 'INVALID_ACTOR_CONTEXT'
  | 'SOURCE_NOT_ALLOWED'
  | 'PAYLOAD_TOO_LARGE'
  | 'DUPLICATE_REQUEST'
  | 'CONCURRENCY_LIMIT'
  | 'TIMEOUT'
  | 'CANCELLED'
  | 'EXECUTION_FAILED'
  | 'OUTPUT_SANITIZATION_FAILED';

export type BoundaryContextContractIssue =
  | 'BOUNDARY_CONTEXT_MISSING'
  | 'BOUNDARY_INVOCATION_CONTEXT_INVALID'
  | 'BOUNDARY_AUTHORITATIVE_CONTEXT_INVALID'
  | 'BOUNDARY_TENANT_MISMATCH'
  | 'BOUNDARY_ACTOR_MISMATCH'
  | 'BOUNDARY_MODE_ESCALATION'
  | 'BOUNDARY_REQUEST_CONTEXT_MISMATCH'
  | 'BOUNDARY_CONSUMER_UNAUTHORIZED'
  | 'BOUNDARY_SOURCE_INVALID';

export type BoundaryPolicyContractIssue =
  | 'BOUNDARY_POLICY_QUERY_INVALID'
  | 'BOUNDARY_POLICY_DECISION_INVALID'
  | 'BOUNDARY_POLICY_VERSION_MISSING'
  | 'BOUNDARY_POLICY_MODE_INVALID'
  | 'BOUNDARY_POLICY_CONTEXT_INVALID';

const BOUNDARY_CONTEXT_ISSUE_MESSAGES: Readonly<
  Record<BoundaryContextContractIssue, string>
> = Object.freeze({
  BOUNDARY_CONTEXT_MISSING:
    'Authoritative boundary context is required',
  BOUNDARY_INVOCATION_CONTEXT_INVALID:
    'Boundary invocation context is invalid',
  BOUNDARY_AUTHORITATIVE_CONTEXT_INVALID:
    'Authoritative boundary context is invalid',
  BOUNDARY_TENANT_MISMATCH:
    'Boundary tenant context does not match',
  BOUNDARY_ACTOR_MISMATCH:
    'Boundary actor context does not match',
  BOUNDARY_MODE_ESCALATION:
    'Boundary execution mode is not allowed',
  BOUNDARY_REQUEST_CONTEXT_MISMATCH:
    'Boundary request context does not match',
  BOUNDARY_CONSUMER_UNAUTHORIZED:
    'Boundary consumer is not authorized',
  BOUNDARY_SOURCE_INVALID:
    'Boundary source is not allowed',
});

const BOUNDARY_CONTEXT_PUBLIC_CODES: Readonly<
  Record<BoundaryContextContractIssue, BoundaryPublicErrorCode>
> = Object.freeze({
  BOUNDARY_CONTEXT_MISSING: 'INVALID_REQUEST',
  BOUNDARY_INVOCATION_CONTEXT_INVALID: 'INVALID_REQUEST',
  BOUNDARY_AUTHORITATIVE_CONTEXT_INVALID: 'INVALID_REQUEST',
  BOUNDARY_TENANT_MISMATCH: 'INVALID_TENANT_CONTEXT',
  BOUNDARY_ACTOR_MISMATCH: 'INVALID_ACTOR_CONTEXT',
  BOUNDARY_MODE_ESCALATION: 'MODE_NOT_ALLOWED',
  BOUNDARY_REQUEST_CONTEXT_MISMATCH: 'INVALID_REQUEST',
  BOUNDARY_CONSUMER_UNAUTHORIZED: 'SOURCE_NOT_ALLOWED',
  BOUNDARY_SOURCE_INVALID: 'SOURCE_NOT_ALLOWED',
});

const BOUNDARY_POLICY_ISSUE_MESSAGES: Readonly<
  Record<BoundaryPolicyContractIssue, string>
> = Object.freeze({
  BOUNDARY_POLICY_QUERY_INVALID:
    'Authoritative boundary policy query is invalid',
  BOUNDARY_POLICY_DECISION_INVALID:
    'Authoritative boundary policy decision is invalid',
  BOUNDARY_POLICY_VERSION_MISSING:
    'Authoritative boundary policy version is invalid',
  BOUNDARY_POLICY_MODE_INVALID:
    'Authoritative boundary policy mode is invalid',
  BOUNDARY_POLICY_CONTEXT_INVALID:
    'Authoritative boundary policy context is invalid',
});

const BOUNDARY_POLICY_PUBLIC_CODES: Readonly<
  Record<BoundaryPolicyContractIssue, BoundaryPublicErrorCode>
> = Object.freeze({
  BOUNDARY_POLICY_QUERY_INVALID: 'INVALID_REQUEST',
  BOUNDARY_POLICY_DECISION_INVALID: 'BOUNDARY_DISABLED',
  BOUNDARY_POLICY_VERSION_MISSING: 'BOUNDARY_DISABLED',
  BOUNDARY_POLICY_MODE_INVALID: 'MODE_NOT_ALLOWED',
  BOUNDARY_POLICY_CONTEXT_INVALID: 'BOUNDARY_DISABLED',
});

export class GovernedBoundaryError extends Error {
  public readonly code: BoundaryPublicErrorCode;
  public readonly retryable: boolean;
  public readonly details?: Readonly<Record<string, string | number | boolean>>;

  constructor(
    code: BoundaryPublicErrorCode,
    message: string,
    retryable: boolean = false,
    details?: Readonly<Record<string, string | number | boolean>>
  ) {
    super(message);
    this.name = 'GovernedBoundaryError';
    this.code = code;
    this.retryable = retryable;
    this.details = details;
  }
}

export class BoundaryContextContractError
  extends GovernedBoundaryError {
  public readonly issue: BoundaryContextContractIssue;

  constructor(
    issue: BoundaryContextContractIssue,
    publicCode: BoundaryPublicErrorCode =
      BOUNDARY_CONTEXT_PUBLIC_CODES[issue]
  ) {
    super(
      publicCode,
      BOUNDARY_CONTEXT_ISSUE_MESSAGES[issue],
      false
    );
    this.name = 'BoundaryContextContractError';
    this.issue = issue;
    Object.setPrototypeOf(
      this,
      BoundaryContextContractError.prototype
    );
  }
}

export class BoundaryPolicyContractError
  extends GovernedBoundaryError {
  public readonly issue: BoundaryPolicyContractIssue;

  constructor(issue: BoundaryPolicyContractIssue) {
    super(
      BOUNDARY_POLICY_PUBLIC_CODES[issue],
      BOUNDARY_POLICY_ISSUE_MESSAGES[issue],
      false
    );
    this.name = 'BoundaryPolicyContractError';
    this.issue = issue;
    Object.setPrototypeOf(
      this,
      BoundaryPolicyContractError.prototype
    );
  }
}

export function createPublicError(
  code: BoundaryPublicErrorCode,
  message: string,
  retryable: boolean = false,
  details?: Readonly<Record<string, string | number | boolean>>
): BoundaryPublicError {
  return {
    code,
    message,
    retryable,
    ...(details ? { details } : {}),
  };
}

export default GovernedBoundaryError;
