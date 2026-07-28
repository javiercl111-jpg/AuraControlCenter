import {
  EvidenceSourceType,
  type EvidenceSourceType as CanonicalEvidenceSourceType,
} from '../../enterprise-model/domain/evidence';

export const PIPELINE_BOOTSTRAP_SOURCE_TYPES = [
  EvidenceSourceType.USER_STATEMENT,
  EvidenceSourceType.USER_CONFIRMATION,
  EvidenceSourceType.USER_CORRECTION,
  EvidenceSourceType.SYSTEM_OBSERVATION,
  EvidenceSourceType.DOCUMENT,
  EvidenceSourceType.INTEGRATION,
  EvidenceSourceType.DERIVED_INFERENCE,
] as const;

export type PipelineBootstrapSourceType =
  (typeof PIPELINE_BOOTSTRAP_SOURCE_TYPES)[number] &
    CanonicalEvidenceSourceType;

export const PIPELINE_BOOTSTRAP_COLLECTION_METHODS = [
  'FORM_RESPONSE',
  'CONVERSATION_RESPONSE',
  'SYSTEM_EVENT',
  'FILE_IMPORT',
  'MANUAL_ENTRY',
  'API_IMPORT',
] as const;

export type PipelineBootstrapCollectionMethod =
  (typeof PIPELINE_BOOTSTRAP_COLLECTION_METHODS)[number];

export const PIPELINE_BOOTSTRAP_ACTOR_TYPES = [
  'USER',
  'SYSTEM',
  'ADMIN',
  'EXTERNAL_SYSTEM',
] as const;

export type PipelineBootstrapActorType =
  (typeof PIPELINE_BOOTSTRAP_ACTOR_TYPES)[number];

export const PIPELINE_BOOTSTRAP_RELIABILITY_LEVELS = [
  'CONFIRMED',
  'HIGH',
  'MEDIUM',
  'LOW',
  'UNKNOWN',
] as const;

export type PipelineBootstrapReliability =
  (typeof PIPELINE_BOOTSTRAP_RELIABILITY_LEVELS)[number];

export const PIPELINE_BOOTSTRAP_DIRECTNESS_LEVELS = [
  'DIRECT',
  'DERIVED',
  'INFERRED',
] as const;

export type PipelineBootstrapDirectness =
  (typeof PIPELINE_BOOTSTRAP_DIRECTNESS_LEVELS)[number];

export const PIPELINE_BOOTSTRAP_POLARITIES = [
  'AFFIRMED',
  'NEGATED',
  'UNCERTAIN',
] as const;

export type PipelineBootstrapPolarity =
  (typeof PIPELINE_BOOTSTRAP_POLARITIES)[number];

export interface PipelineBootstrapProvenanceMatrixEntry {
  readonly sourceType: PipelineBootstrapSourceType;
  readonly collectionMethods: readonly PipelineBootstrapCollectionMethod[];
  readonly actorTypes: readonly PipelineBootstrapActorType[];
  readonly directnessLevels: readonly PipelineBootstrapDirectness[];
}

export const PIPELINE_BOOTSTRAP_PROVENANCE_MATRIX: Readonly<
  Record<
    PipelineBootstrapSourceType,
    PipelineBootstrapProvenanceMatrixEntry
  >
> = Object.freeze({
  USER_STATEMENT: Object.freeze({
    sourceType: EvidenceSourceType.USER_STATEMENT,
    collectionMethods: [
      'FORM_RESPONSE',
      'CONVERSATION_RESPONSE',
      'MANUAL_ENTRY',
    ] as const,
    actorTypes: ['USER'] as const,
    directnessLevels: ['DIRECT'] as const,
  }),
  USER_CONFIRMATION: Object.freeze({
    sourceType: EvidenceSourceType.USER_CONFIRMATION,
    collectionMethods: [
      'FORM_RESPONSE',
      'CONVERSATION_RESPONSE',
      'MANUAL_ENTRY',
    ] as const,
    actorTypes: ['USER'] as const,
    directnessLevels: ['DIRECT'] as const,
  }),
  USER_CORRECTION: Object.freeze({
    sourceType: EvidenceSourceType.USER_CORRECTION,
    collectionMethods: [
      'FORM_RESPONSE',
      'CONVERSATION_RESPONSE',
      'MANUAL_ENTRY',
    ] as const,
    actorTypes: ['USER'] as const,
    directnessLevels: ['DIRECT'] as const,
  }),
  SYSTEM_OBSERVATION: Object.freeze({
    sourceType: EvidenceSourceType.SYSTEM_OBSERVATION,
    collectionMethods: ['SYSTEM_EVENT'] as const,
    actorTypes: ['SYSTEM'] as const,
    directnessLevels: ['DIRECT', 'DERIVED'] as const,
  }),
  DOCUMENT: Object.freeze({
    sourceType: EvidenceSourceType.DOCUMENT,
    collectionMethods: ['FILE_IMPORT'] as const,
    actorTypes: ['USER', 'ADMIN', 'EXTERNAL_SYSTEM'] as const,
    directnessLevels: ['DIRECT'] as const,
  }),
  INTEGRATION: Object.freeze({
    sourceType: EvidenceSourceType.INTEGRATION,
    collectionMethods: ['SYSTEM_EVENT', 'API_IMPORT'] as const,
    actorTypes: ['SYSTEM', 'EXTERNAL_SYSTEM'] as const,
    directnessLevels: ['DIRECT', 'DERIVED'] as const,
  }),
  DERIVED_INFERENCE: Object.freeze({
    sourceType: EvidenceSourceType.DERIVED_INFERENCE,
    collectionMethods: ['SYSTEM_EVENT'] as const,
    actorTypes: ['SYSTEM'] as const,
    directnessLevels: ['INFERRED'] as const,
  }),
});

export interface PipelineBootstrapProvenance {
  readonly sourceType: PipelineBootstrapSourceType;
  readonly sourceId: string;
  readonly collectionMethod: PipelineBootstrapCollectionMethod;
  readonly capturedAt: number;
  readonly reliability: PipelineBootstrapReliability;
  readonly directness: PipelineBootstrapDirectness;
  readonly actorType: PipelineBootstrapActorType;
  readonly tenantId: string;
  readonly correlationId: string;
  readonly inferenceRuleId?: string;
}

export function getPipelineBootstrapProvenanceMatrixEntry(
  sourceType: PipelineBootstrapSourceType
): PipelineBootstrapProvenanceMatrixEntry {
  return PIPELINE_BOOTSTRAP_PROVENANCE_MATRIX[sourceType];
}

export function isPipelineBootstrapSourceType(
  value: unknown
): value is PipelineBootstrapSourceType {
  return (
    typeof value === 'string' &&
    PIPELINE_BOOTSTRAP_SOURCE_TYPES.some((candidate) => candidate === value)
  );
}

export function isPipelineBootstrapCollectionMethod(
  value: unknown
): value is PipelineBootstrapCollectionMethod {
  return (
    typeof value === 'string' &&
    PIPELINE_BOOTSTRAP_COLLECTION_METHODS.some(
      (candidate) => candidate === value
    )
  );
}

export function isPipelineBootstrapActorType(
  value: unknown
): value is PipelineBootstrapActorType {
  return (
    typeof value === 'string' &&
    PIPELINE_BOOTSTRAP_ACTOR_TYPES.some((candidate) => candidate === value)
  );
}

export function isPipelineBootstrapReliability(
  value: unknown
): value is PipelineBootstrapReliability {
  return (
    typeof value === 'string' &&
    PIPELINE_BOOTSTRAP_RELIABILITY_LEVELS.some(
      (candidate) => candidate === value
    )
  );
}

export function isPipelineBootstrapDirectness(
  value: unknown
): value is PipelineBootstrapDirectness {
  return (
    typeof value === 'string' &&
    PIPELINE_BOOTSTRAP_DIRECTNESS_LEVELS.some(
      (candidate) => candidate === value
    )
  );
}

export function isPipelineBootstrapPolarity(
  value: unknown
): value is PipelineBootstrapPolarity {
  return (
    typeof value === 'string' &&
    PIPELINE_BOOTSTRAP_POLARITIES.some((candidate) => candidate === value)
  );
}
