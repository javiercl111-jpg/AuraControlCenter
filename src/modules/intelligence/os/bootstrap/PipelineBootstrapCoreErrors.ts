import { AuraIntelligenceOSError, ErrorCodes } from '../errors';

export const PIPELINE_BOOTSTRAP_CORE_ISSUES = [
  'BOOTSTRAP_INPUT_INVALID',
  'BOOTSTRAP_FACT_MAPPING_FAILED',
  'BOOTSTRAP_EVIDENCE_DUPLICATE',
  'BOOTSTRAP_MODEL_BUILD_FAILED',
  'BOOTSTRAP_GRAPH_BUILD_FAILED',
  'BOOTSTRAP_STATE_VALIDATION_FAILED',
  'BOOTSTRAP_EXECUTION_COMPOSITION_FAILED',
] as const;

export type PipelineBootstrapCoreIssue =
  (typeof PIPELINE_BOOTSTRAP_CORE_ISSUES)[number];

const ISSUE_MESSAGES: Readonly<
  Record<PipelineBootstrapCoreIssue, string>
> = Object.freeze({
  BOOTSTRAP_INPUT_INVALID: 'Pipeline bootstrap input is invalid',
  BOOTSTRAP_FACT_MAPPING_FAILED:
    'Pipeline bootstrap fact mapping failed',
  BOOTSTRAP_EVIDENCE_DUPLICATE:
    'Pipeline bootstrap evidence identity is duplicated',
  BOOTSTRAP_MODEL_BUILD_FAILED:
    'Pipeline bootstrap mental model construction failed',
  BOOTSTRAP_GRAPH_BUILD_FAILED:
    'Pipeline bootstrap knowledge graph construction failed',
  BOOTSTRAP_STATE_VALIDATION_FAILED:
    'Pipeline bootstrap state validation failed',
  BOOTSTRAP_EXECUTION_COMPOSITION_FAILED:
    'Pipeline bootstrap execution composition failed',
});

export function getPipelineBootstrapCoreIssueMessage(
  issue: PipelineBootstrapCoreIssue
): string {
  return ISSUE_MESSAGES[issue];
}

export class PipelineBootstrapCoreError
  extends AuraIntelligenceOSError {
  public readonly issue: PipelineBootstrapCoreIssue;

  constructor(issue: PipelineBootstrapCoreIssue) {
    super(
      ErrorCodes.INVALID_CONTRACT,
      ISSUE_MESSAGES[issue],
      false,
      undefined,
      { pipelineBootstrapCoreIssue: issue }
    );
    this.name = 'PipelineBootstrapCoreError';
    this.issue = issue;
    Object.setPrototypeOf(this, PipelineBootstrapCoreError.prototype);
  }
}

export function throwPipelineBootstrapCoreError(
  issue: PipelineBootstrapCoreIssue
): never {
  throw new PipelineBootstrapCoreError(issue);
}
