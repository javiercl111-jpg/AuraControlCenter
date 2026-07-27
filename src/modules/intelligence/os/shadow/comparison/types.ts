import type { PipelineStatus, SerializableAuraOSError, PipelineStageId, StageStatus } from '../../types';
import type { ShadowExecutionResult, ShadowExecutionKey, ShadowSessionKey } from '../types';

export interface LegacyComparisonInput {
  sessionKey: ShadowSessionKey;
  executionKey: ShadowExecutionKey;
  completionStatus?: string;
  closed?: boolean;
  nextObjective?: string;
  coverageScore?: number;
  findingsCount?: number;
  diagnosticStatus?: string;
  assessmentStatus?: string;
  safeMetadata?: Record<string, string | number | boolean>;
  stageStatusMap?: Record<string, string>;
}

export interface OSComparisonInput {
  pipelineStatus: PipelineStatus;
  durationMs?: number;
  coverageScore?: number;
  planningObjective?: string;
  findingsCount?: number;
  dossierStatus?: StageStatus;
  assessmentStatus?: StageStatus;
  skippedStages: PipelineStageId[];
  stageStatuses: Partial<Record<PipelineStageId, StageStatus>>;
  errors: SerializableAuraOSError[];
}

export type ShadowDifferenceType =
  | 'VALUE_MISMATCH'
  | 'STATUS_MISMATCH'
  | 'MISSING_IN_LEGACY'
  | 'MISSING_IN_OS'
  | 'STAGE_MISMATCH'
  | 'ERROR_CODE_MISMATCH'
  | 'COVERAGE_DELTA'
  | 'DURATION_DELTA'
  | 'COMPLETION_MISMATCH'
  | 'OBJECTIVE_MISMATCH'
  | 'FINDINGS_COUNT_DELTA'
  | 'DIAGNOSTIC_STATUS_MISMATCH'
  | 'ASSESSMENT_STATUS_MISMATCH'
  | 'NOT_COMPARABLE';

export type ShadowDifferenceSeverity = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface ShadowDifference {
  type: ShadowDifferenceType;
  field: string;
  legacyValue?: unknown;
  osValue?: unknown;
  severity: ShadowDifferenceSeverity;
  message: string;
  delta?: number;
}

export interface ShadowComparisonPolicy {
  coverageDeltaThreshold: number;
  durationDeltaThresholdMs: number;
  findingsCountDeltaThreshold: number;
  criticalStatusPairs: Record<string, string>; // e.g., 'SUCCESS:FAILED'
  ignoredDifferenceTypes: ShadowDifferenceType[];
  treatMissingAsDifference: boolean;
  compareSkippedStages: boolean;
  compareErrorCodes: boolean;
  maxDifferences: number;
  includeSafeMetadata: boolean;
}

export interface ShadowComparisonMetrics {
  totalFieldsCompared: number;
  totalDifferences: number;
  differencesByType: Partial<Record<ShadowDifferenceType, number>>;
  differencesBySeverity: Partial<Record<ShadowDifferenceSeverity, number>>;
  comparableRatio: number;
  coverageDelta?: number;
  durationDeltaMs?: number;
  findingsCountDelta?: number;
  statusMatch: boolean;
  objectiveMatch: boolean;
}

export type ShadowComparisonStatus = 
  | 'COMPLETED' 
  | 'COMPLETED_WITH_DIFFERENCES' 
  | 'NOT_COMPARABLE' 
  | 'INVALID_INPUT' 
  | 'FAILED' 
  | 'CANCELLED' 
  | 'TIMED_OUT';

export interface ShadowComparisonResult {
  comparisonId: string;
  executionKey: ShadowExecutionKey;
  sessionKey: ShadowSessionKey;
  status: ShadowComparisonStatus;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  summary: string;
  differences: ShadowDifference[];
  metrics: ShadowComparisonMetrics;
  comparableFields: string[];
  nonComparableFields: string[];
  legacySnapshot?: Partial<LegacyComparisonInput>;
  osSnapshot?: Partial<OSComparisonInput>;
  sanitizedMetadata?: Record<string, string | number | boolean>;
  warnings: string[];
  normalizedError?: SerializableAuraOSError;
}

export interface ShadowComparisonRequest {
  comparisonId?: string;
  legacyInput: LegacyComparisonInput;
  osResult: ShadowExecutionResult;
  policy: ShadowComparisonPolicy;
}

export interface CaptureRecord {
  comparisonResult: ShadowComparisonResult;
  shadowResultReference?: {
    shadowExecutionId: string;
    status: string;
    durationMs?: number;
  };
  capturedAtMs: number;
  expiresAtMs: number;
}

export interface CaptureAdapterPolicy {
  enabled: boolean;
  maxRecords: number;
  ttlMs: number;
  maxRecordsPerSession: number;
  captureSuccessfulComparisons: boolean;
  captureFailedComparisons: boolean;
  captureNotComparable: boolean;
  retainPipelineResultReference: boolean;
  redactMetadata: boolean;
  maxDifferencesPerRecord: number;
}

export interface CaptureAdapterMetrics {
  currentRecords: number;
  currentSessions: number;
  capturedCount: number;
  evictedCount: number;
  expiredCount: number;
  rejectedCount: number;
}
