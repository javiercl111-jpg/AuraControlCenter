export const AUTHORITATIVE_POLICY_SNAPSHOT_CONTRACT_ERROR_VERSION =
  '1' as const;

export const AUTHORITATIVE_POLICY_SNAPSHOT_CONTRACT_ISSUES =
  Object.freeze([
    'INVALID_SNAPSHOT',
    'UNSUPPORTED_VERSION',
    'INVALID_VERSION',
    'REGISTRY_INCOMPATIBLE',
    'INVALID_ENTRY',
    'INVALID_BINDING',
    'MODE_NOT_ALLOWED',
    'INVALID_TIMEOUT',
    'DUPLICATE_ENTRY',
    'UNCLONABLE_INPUT',
  ] as const);

export type AuthoritativePolicySnapshotContractIssue =
  (typeof AUTHORITATIVE_POLICY_SNAPSHOT_CONTRACT_ISSUES)[number];

const ISSUE_MESSAGES: Readonly<
  Record<AuthoritativePolicySnapshotContractIssue, string>
> = Object.freeze({
  INVALID_SNAPSHOT: 'Authoritative policy snapshot is invalid',
  UNSUPPORTED_VERSION:
    'Authoritative policy contract version is unsupported',
  INVALID_VERSION: 'Authoritative policy version is invalid',
  REGISTRY_INCOMPATIBLE:
    'Authoritative policy registry binding is invalid',
  INVALID_ENTRY: 'Authoritative policy entry is invalid',
  INVALID_BINDING: 'Authoritative policy binding is invalid',
  MODE_NOT_ALLOWED: 'Authoritative policy mode is not allowed',
  INVALID_TIMEOUT: 'Authoritative policy timeout is invalid',
  DUPLICATE_ENTRY: 'Authoritative policy entries conflict',
  UNCLONABLE_INPUT: 'Authoritative policy input is invalid',
});

export class AuthoritativePolicySnapshotContractError extends Error {
  public readonly schemaVersion =
    AUTHORITATIVE_POLICY_SNAPSHOT_CONTRACT_ERROR_VERSION;
  public readonly issue: AuthoritativePolicySnapshotContractIssue;

  constructor(issue: AuthoritativePolicySnapshotContractIssue) {
    super(ISSUE_MESSAGES[issue]);
    this.name = 'AuthoritativePolicySnapshotContractError';
    this.issue = issue;
    Object.freeze(this);
  }
}

export const AUTHORITATIVE_FEATURE_POLICY_SOURCE_ERROR_VERSION = '1' as const;

export const AUTHORITATIVE_FEATURE_POLICY_SOURCE_ERROR_CODES = Object.freeze([
  'SOURCE_UNAVAILABLE',
  'MALFORMED_SNAPSHOT',
  'TENANT_INTEGRITY_VIOLATION',
] as const);

export type AuthoritativeFeaturePolicySourceErrorCode =
  (typeof AUTHORITATIVE_FEATURE_POLICY_SOURCE_ERROR_CODES)[number];

const SOURCE_ERROR_MESSAGES: Readonly<
  Record<AuthoritativeFeaturePolicySourceErrorCode, string>
> = Object.freeze({
  SOURCE_UNAVAILABLE: 'Authoritative feature policy source is unavailable',
  MALFORMED_SNAPSHOT: 'Authoritative feature policy snapshot is malformed',
  TENANT_INTEGRITY_VIOLATION: 'Authoritative feature policy snapshot violates tenant integrity',
});

export class AuthoritativeFeaturePolicySourceError extends Error {
  public readonly schemaVersion = AUTHORITATIVE_FEATURE_POLICY_SOURCE_ERROR_VERSION;
  public readonly code: AuthoritativeFeaturePolicySourceErrorCode;

  constructor(code: AuthoritativeFeaturePolicySourceErrorCode) {
    super(SOURCE_ERROR_MESSAGES[code]);
    this.name = 'AuthoritativeFeaturePolicySourceError';
    this.code = code;
    Object.freeze(this);
  }
}
