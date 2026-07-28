import type { PipelineStageId } from '../types';

export const PRECOMPUTED_CHECKPOINT_VERSION = '1' as const;
export const PRECOMPUTED_ADMISSION_TYPE = 'PRECOMPUTED' as const;
export const CHECKPOINT_FINGERPRINT_VERSION = 'v1' as const;
export const CHECKPOINT_FINGERPRINT_PREFIX =
  `fp:${CHECKPOINT_FINGERPRINT_VERSION}:` as const;

export type CheckpointFingerprint =
  `${typeof CHECKPOINT_FINGERPRINT_PREFIX}${string}`;

export const PIPELINE_CHECKPOINT_ARTIFACT_TYPES = [
  'EVIDENCE_SET',
  'ENTERPRISE_MENTAL_MODEL',
  'ENTERPRISE_KNOWLEDGE_GRAPH',
  'COVERAGE_REPORT',
  'PLANNING_RESULT',
  'REASONING_REPORT',
  'EXECUTIVE_DOSSIER',
  'TRANSFORMATION_ASSESSMENT',
] as const;

export type PipelineCheckpointArtifactType =
  (typeof PIPELINE_CHECKPOINT_ARTIFACT_TYPES)[number];

export type PipelineEvidenceReference =
  | {
      readonly referenceType: 'EVIDENCE';
      readonly evidenceId: string;
      readonly schemaVersion: string;
    }
  | {
      readonly referenceType: 'FACT';
      readonly factId: string;
      readonly schemaVersion: string;
    }
  | {
      readonly referenceType: 'ARTIFACT';
      readonly artifactId: string;
      readonly artifactType: PipelineCheckpointArtifactType;
      readonly schemaVersion: string;
    };

export interface PipelineStageAdmission {
  readonly stageId: PipelineStageId;
  readonly admissionType: typeof PRECOMPUTED_ADMISSION_TYPE;
  readonly artifactSchemaVersion: string;
  readonly inputFingerprint: CheckpointFingerprint;
  readonly outputFingerprint: CheckpointFingerprint;
  readonly evidenceRefs: readonly PipelineEvidenceReference[];
}

export interface PrecomputedPipelineCheckpoint {
  readonly checkpointId: string;
  readonly checkpointVersion: typeof PRECOMPUTED_CHECKPOINT_VERSION;
  readonly tenantId: string;
  readonly correlationId: string;
  readonly scenarioId: string;
  readonly scenarioVersion: string;
  readonly producerId: string;
  readonly producerVersion: string;
  readonly completedAt: string;
  readonly admissions: readonly PipelineStageAdmission[];
}

export type CheckpointArraySemantics = 'ORDERED' | 'SET';

export interface CheckpointCanonicalizationOptions {
  readonly arraySemantics?: CheckpointArraySemantics;
}
