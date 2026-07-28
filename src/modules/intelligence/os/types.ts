import type { CoverageDomain } from '../enterprise-model/coverage/domain/types';

export const OS_CONTRACT_VERSION = '1';
export const OS_PIPELINE_VERSION = '1';

export type PipelineExecutionId = string;
export type PipelineSessionId = string;
export type PipelineExecutionKey = string;

export type PipelineStatus =
  | 'CREATED'
  | 'CONTEXT_READY'
  | 'RUNNING'
  | 'PARTIAL_SUCCESS'
  | 'SUCCESS'
  | 'FAILED'
  | 'CANCELLED'
  | 'TIMED_OUT';

export type StageStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'PARTIAL'
  | 'FAILED'
  | 'SKIPPED'
  | 'CANCELLED'
  | 'TIMED_OUT';

export const PIPELINE_STAGE_IDS = [
  'EVIDENCE_EXTRACTION',
  'MENTAL_MODEL',
  'KNOWLEDGE_GRAPH',
  'KNOWLEDGE_COVERAGE',
  'ADAPTIVE_PLANNING',
  'EXECUTIVE_REASONING',
  'EXECUTIVE_DOSSIER',
  'TRANSFORMATION_ASSESSMENT',
] as const;

export type PipelineStageId = (typeof PIPELINE_STAGE_IDS)[number];

export const EXECUTION_ORIGINS = [
  'CURRENT_EXECUTION',
  'PRECOMPUTED',
] as const;

export type ExecutionOrigin = (typeof EXECUTION_ORIGINS)[number];

export interface PipelineStageAdmissionReference {
  readonly checkpointId: string;
  readonly stageId: PipelineStageId;
}

/**
 * Nominal scenario contract carried by Aura Intelligence OS during execution.
 *
 * This contract is intentionally owned by the OS core instead of importing the
 * bootstrap-specific PipelineScenarioDescriptor. The two contracts are
 * structurally compatible for these execution fields, while bootstrap remains
 * free to add admission metadata such as source and explicitSelection.
 */
export interface PipelineExecutionScenario {
  readonly scenarioId: string;
  readonly scenarioVersion: string;
  readonly objectiveKey: string;
  readonly requestedStages: readonly PipelineStageId[];
  readonly allowedStages: readonly PipelineStageId[];
  readonly requiredStages: readonly PipelineStageId[];
  readonly stageDependencies: Readonly<
    Record<PipelineStageId, readonly PipelineStageId[]>
  >;
  readonly includedDomains: readonly CoverageDomain[];
  readonly excludedDomains: readonly CoverageDomain[];
}

export interface OSErrorsMetadata {
  [key: string]: string | number | boolean | null | undefined;
}

export interface SerializableAuraOSError {
  name: string;
  message: string;
  code: string;
  retryable: boolean;
  stage?: PipelineStageId;
  metadata?: OSErrorsMetadata;
  cause?: unknown;
}

export interface PipelineStageResult<T> {
  stage: PipelineStageId;
  status: StageStatus;
  /**
   * Additive provenance discriminator. An absent value is interpreted as
   * CURRENT_EXECUTION for compatibility with existing producers.
   */
  executionOrigin?: ExecutionOrigin;
  admissionReference?: PipelineStageAdmissionReference;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  output?: T;
  errors: SerializableAuraOSError[];
  warnings: string[];
  skippedReason?: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface PipelineExecutionMetadata {
  [key: string]: string | number | boolean | null | undefined;
}

export interface PipelineResult {
  contractVersion: string;
  pipelineVersion: string;
  executionId: PipelineExecutionId;
  sessionId: PipelineSessionId;
  status: PipelineStatus;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  stageResults: Partial<Record<PipelineStageId, PipelineStageResult<unknown>>>;
  partialFailures: boolean;
  skippedStages: PipelineStageId[];
  errors: SerializableAuraOSError[];
  warnings: string[];
  auditTrail: string[];
}

export interface PipelineInput {
  sessionId: PipelineSessionId;
  executionKey?: PipelineExecutionKey;
  executionScenario?: PipelineExecutionScenario;
  targetScenario?: string;
  objectiveIds?: readonly string[];
  metadata?: PipelineExecutionMetadata;
}
