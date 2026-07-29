import {
  AUTHORITY_PERSISTENCE_CONTRACT_ERROR_VERSION,
} from './types';

export const AUTHORITY_PERSISTENCE_CONTRACT_ISSUES = Object.freeze([
  'INVALID_TENANT_RECORD',
  'TENANT_DOCUMENT_ID_MISMATCH',
  'INVALID_MEMBERSHIP_RECORD',
  'MEMBERSHIP_DOCUMENT_ID_MISMATCH',
  'MEMBERSHIP_KEY_MISMATCH',
  'INVALID_ALIAS_RECORD',
  'ALIAS_DOCUMENT_ID_MISMATCH',
  'ALIAS_KEY_MISMATCH',
  'ALIAS_COLLISION',
  'INVALID_PRECONDITION',
  'BLIND_WRITE_PROHIBITED',
  'INVALID_COMMAND',
  'INVALID_TRANSITION',
  'INVALID_IDEMPOTENCY_RECORD',
  'INVALID_REPOSITORY_RESULT',
  'INVALID_AUDIT_EVENT',
  'INVALID_OUTBOX_EVENT',
  'SENSITIVE_EVENT_DATA',
  'INVALID_MIGRATION_METADATA',
  'MIGRATION_METADATA_NOT_AUTHORITY',
] as const);

export type AuthorityPersistenceContractIssue =
  (typeof AUTHORITY_PERSISTENCE_CONTRACT_ISSUES)[number];

const SAFE_CONTRACT_ERROR_MESSAGE =
  'Authority persistence contract is invalid.';

export class AuthorityPersistenceContractError extends Error {
  readonly version = AUTHORITY_PERSISTENCE_CONTRACT_ERROR_VERSION;
  readonly code = 'AUTHORITY_PERSISTENCE_CONTRACT_INVALID';
  readonly issue: AuthorityPersistenceContractIssue;

  constructor(issue: AuthorityPersistenceContractIssue) {
    super(SAFE_CONTRACT_ERROR_MESSAGE);
    this.name = 'AuthorityPersistenceContractError';
    this.issue = issue;
    Object.setPrototypeOf(this, new.target.prototype);
    Object.freeze(this);
  }
}
