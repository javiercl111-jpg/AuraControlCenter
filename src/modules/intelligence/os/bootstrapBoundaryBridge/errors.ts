import {
  AuraIntelligenceOSError,
  ErrorCodes,
} from '../errors';

export const BOOTSTRAP_BOUNDARY_BRIDGE_CONTRACT_ISSUES =
  Object.freeze([
    'BRIDGE_AUTHORITY_INVALID',
    'BRIDGE_PAYLOAD_INVALID',
    'BRIDGE_CANCELLATION_SIGNAL_INVALID',
    'BRIDGE_BOOTSTRAP_STATE_INVALID',
    'BRIDGE_BOOTSTRAP_STATE_CONTRADICTION',
    'BRIDGE_RESULT_CONTEXT_MISMATCH',
  ] as const);

export type BootstrapBoundaryBridgeContractIssue =
  (typeof BOOTSTRAP_BOUNDARY_BRIDGE_CONTRACT_ISSUES)[number];

const ISSUE_MESSAGES: Readonly<
  Record<BootstrapBoundaryBridgeContractIssue, string>
> = Object.freeze({
  BRIDGE_AUTHORITY_INVALID:
    'Bootstrap boundary bridge authority is invalid',
  BRIDGE_PAYLOAD_INVALID:
    'Bootstrap boundary bridge payload is invalid',
  BRIDGE_CANCELLATION_SIGNAL_INVALID:
    'Bootstrap boundary bridge cancellation signal is invalid',
  BRIDGE_BOOTSTRAP_STATE_INVALID:
    'Bootstrap boundary bridge state is invalid',
  BRIDGE_BOOTSTRAP_STATE_CONTRADICTION:
    'Bootstrap boundary bridge result contradicts its state',
  BRIDGE_RESULT_CONTEXT_MISMATCH:
    'Bootstrap boundary bridge result context does not match',
});

export class BootstrapBoundaryBridgeContractError
  extends AuraIntelligenceOSError {
  public readonly issue: BootstrapBoundaryBridgeContractIssue;

  constructor(issue: BootstrapBoundaryBridgeContractIssue) {
    super(
      ErrorCodes.INVALID_CONTRACT,
      ISSUE_MESSAGES[issue],
      false,
      undefined,
      { bootstrapBoundaryBridgeIssue: issue }
    );
    this.name = 'BootstrapBoundaryBridgeContractError';
    this.issue = issue;
    Object.setPrototypeOf(
      this,
      BootstrapBoundaryBridgeContractError.prototype
    );
  }
}

export function throwBootstrapBoundaryBridgeContractError(
  issue: BootstrapBoundaryBridgeContractIssue
): never {
  throw new BootstrapBoundaryBridgeContractError(issue);
}
