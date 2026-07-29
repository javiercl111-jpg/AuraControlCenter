export const TRUSTED_COMPOSITION_CONTRACT_ERROR_VERSION = '1' as const;

export const TRUSTED_COMPOSITION_CONTRACT_ISSUES = Object.freeze([
  'INVALID_CONTRACT',
  'UNTRUSTED_AUTHORITY',
  'REGISTRY_DENIED',
  'INVALID_LIFECYCLE',
  'INVALID_RESPONSE',
  'INVALID_DEPENDENCIES',
] as const);

export type TrustedCompositionContractIssue =
  (typeof TRUSTED_COMPOSITION_CONTRACT_ISSUES)[number];

const ISSUE_MESSAGES: Readonly<
  Record<TrustedCompositionContractIssue, string>
> = Object.freeze({
  INVALID_CONTRACT: 'Trusted server contract is invalid',
  UNTRUSTED_AUTHORITY: 'Trusted server authority is invalid',
  REGISTRY_DENIED: 'Trusted server invocation is not authorized',
  INVALID_LIFECYCLE: 'Trusted server lifecycle is invalid',
  INVALID_RESPONSE: 'Trusted server response is invalid',
  INVALID_DEPENDENCIES: 'Trusted composition dependencies are invalid',
});

export class TrustedCompositionContractError extends Error {
  public readonly schemaVersion =
    TRUSTED_COMPOSITION_CONTRACT_ERROR_VERSION;
  public readonly issue: TrustedCompositionContractIssue;

  constructor(issue: TrustedCompositionContractIssue) {
    super(ISSUE_MESSAGES[issue]);
    this.name = 'TrustedCompositionContractError';
    this.issue = issue;
    Object.freeze(this);
  }
}
