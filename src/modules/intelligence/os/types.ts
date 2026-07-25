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

export type PipelineStageId =
  | 'EVIDENCE_EXTRACTION'
  | 'MENTAL_MODEL'
  | 'KNOWLEDGE_GRAPH'
  | 'KNOWLEDGE_COVERAGE'
  | 'ADAPTIVE_PLANNING'
  | 'EXECUTIVE_REASONING'
  | 'EXECUTIVE_DOSSIER'
  | 'TRANSFORMATION_ASSESSMENT';

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
  targetScenario?: string;
  objectiveIds?: readonly string[];
  metadata?: PipelineExecutionMetadata;
}
