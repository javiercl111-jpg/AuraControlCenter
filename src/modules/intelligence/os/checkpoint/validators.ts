import { AuraIntelligenceOSError, ErrorCodes } from '../errors';
import { PIPELINE_STAGE_IDS } from '../types';
import {
  PIPELINE_CHECKPOINT_ARTIFACT_TYPES,
  PRECOMPUTED_ADMISSION_TYPE,
  PRECOMPUTED_CHECKPOINT_VERSION,
  type PipelineEvidenceReference,
  type PipelineStageAdmission,
  type PrecomputedPipelineCheckpoint,
} from './types';
import {
  canonicalizePipelineEvidenceReferences,
  canonicalizePipelineStageAdmission,
  canonicalizePrecomputedPipelineCheckpoint,
  isCheckpointFingerprint,
} from './integrity';

export type CheckpointValidationIssueCode =
  | 'INVALID_CHECKPOINT'
  | 'UNSUPPORTED_CHECKPOINT_VERSION'
  | 'INVALID_STAGE_ADMISSION'
  | 'INVALID_FINGERPRINT'
  | 'DUPLICATE_STAGE_ADMISSION'
  | 'INVALID_EVIDENCE_REFERENCE'
  | 'DUPLICATE_EVIDENCE_REFERENCE';

export interface CheckpointValidationIssue {
  readonly code: CheckpointValidationIssueCode;
  readonly message: string;
}

export type CheckpointValidationResult<T> =
  | {
      readonly valid: true;
      readonly value: T;
    }
  | {
      readonly valid: false;
      readonly errors: readonly CheckpointValidationIssue[];
    };

const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/|-]{0,179}$/;
const REFERENCE_IDENTIFIER_PATTERN =
  /^[A-Za-z0-9][A-Za-z0-9._|-]{0,179}$/;
const VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

const CHECKPOINT_KEYS = [
  'checkpointId',
  'checkpointVersion',
  'tenantId',
  'correlationId',
  'scenarioId',
  'scenarioVersion',
  'producerId',
  'producerVersion',
  'completedAt',
  'admissions',
] as const;

const ADMISSION_KEYS = [
  'stageId',
  'admissionType',
  'artifactSchemaVersion',
  'inputFingerprint',
  'outputFingerprint',
  'evidenceRefs',
] as const;

function invalid<T>(
  code: CheckpointValidationIssueCode,
  message: string
): CheckpointValidationResult<T> {
  return {
    valid: false,
    errors: Object.freeze([Object.freeze({ code, message })]),
  };
}

function valid<T>(value: T): CheckpointValidationResult<T> {
  return { valid: true, value };
}

function getClosedRecord(
  value: unknown,
  allowedKeys: readonly string[]
): Record<string, unknown> | undefined {
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    return undefined;
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return undefined;
  }

  if (Object.getOwnPropertySymbols(value).length > 0) {
    return undefined;
  }

  const keys = Object.getOwnPropertyNames(value);
  if (
    keys.length !== allowedKeys.length ||
    keys.some((key) => {
      if (!allowedKeys.includes(key)) {
        return true;
      }
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      return (
        descriptor === undefined ||
        !descriptor.enumerable ||
        descriptor.get !== undefined ||
        descriptor.set !== undefined
      );
    })
  ) {
    return undefined;
  }

  return value as Record<string, unknown>;
}

function isIdentifier(value: unknown): value is string {
  return typeof value === 'string' && IDENTIFIER_PATTERN.test(value);
}

function isReferenceIdentifier(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    REFERENCE_IDENTIFIER_PATTERN.test(value)
  );
}

function isVersion(value: unknown): value is string {
  return typeof value === 'string' && VERSION_PATTERN.test(value);
}

function isPipelineStageId(
  value: unknown
): value is PipelineStageAdmission['stageId'] {
  return (
    typeof value === 'string' &&
    PIPELINE_STAGE_IDS.some((stageId) => stageId === value)
  );
}

function isPipelineCheckpointArtifactType(
  value: unknown
): value is Extract<
  PipelineEvidenceReference,
  { readonly referenceType: 'ARTIFACT' }
>['artifactType'] {
  return (
    typeof value === 'string' &&
    PIPELINE_CHECKPOINT_ARTIFACT_TYPES.some(
      (artifactType) => artifactType === value
    )
  );
}

function isCanonicalTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }
  const timestamp = Date.parse(value);
  return (
    Number.isFinite(timestamp) &&
    new Date(timestamp).toISOString() === value
  );
}

function evidenceReferenceKey(reference: PipelineEvidenceReference): string {
  switch (reference.referenceType) {
    case 'EVIDENCE':
      return `EVIDENCE:${reference.schemaVersion}:${reference.evidenceId}`;
    case 'FACT':
      return `FACT:${reference.schemaVersion}:${reference.factId}`;
    case 'ARTIFACT':
      return `ARTIFACT:${reference.artifactType}:${reference.schemaVersion}:${reference.artifactId}`;
  }
}

function validatePipelineEvidenceReference(
  value: unknown
): CheckpointValidationResult<PipelineEvidenceReference> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return invalid(
      'INVALID_EVIDENCE_REFERENCE',
      'Stage admission contains an invalid evidence reference'
    );
  }

  const referenceTypeDescriptor = Object.getOwnPropertyDescriptor(
    value,
    'referenceType'
  );
  if (
    !referenceTypeDescriptor ||
    !referenceTypeDescriptor.enumerable ||
    referenceTypeDescriptor.get !== undefined ||
    referenceTypeDescriptor.set !== undefined
  ) {
    return invalid(
      'INVALID_EVIDENCE_REFERENCE',
      'Stage admission contains an invalid evidence reference'
    );
  }
  const referenceType = referenceTypeDescriptor.value;

  if (referenceType === 'EVIDENCE') {
    const closed = getClosedRecord(value, [
      'referenceType',
      'evidenceId',
      'schemaVersion',
    ]);
    if (
      !closed ||
      !isReferenceIdentifier(closed.evidenceId) ||
      !isVersion(closed.schemaVersion)
    ) {
      return invalid(
        'INVALID_EVIDENCE_REFERENCE',
        'Stage admission contains an invalid evidence reference'
      );
    }
    return valid({
      referenceType: 'EVIDENCE',
      evidenceId: closed.evidenceId,
      schemaVersion: closed.schemaVersion,
    });
  }

  if (referenceType === 'FACT') {
    const closed = getClosedRecord(value, [
      'referenceType',
      'factId',
      'schemaVersion',
    ]);
    if (
      !closed ||
      !isReferenceIdentifier(closed.factId) ||
      !isVersion(closed.schemaVersion)
    ) {
      return invalid(
        'INVALID_EVIDENCE_REFERENCE',
        'Stage admission contains an invalid evidence reference'
      );
    }
    return valid({
      referenceType: 'FACT',
      factId: closed.factId,
      schemaVersion: closed.schemaVersion,
    });
  }

  if (referenceType === 'ARTIFACT') {
    const closed = getClosedRecord(value, [
      'referenceType',
      'artifactId',
      'artifactType',
      'schemaVersion',
    ]);
    if (
      !closed ||
      !isReferenceIdentifier(closed.artifactId) ||
      !isVersion(closed.schemaVersion) ||
      !isPipelineCheckpointArtifactType(closed.artifactType)
    ) {
      return invalid(
        'INVALID_EVIDENCE_REFERENCE',
        'Stage admission contains an invalid artifact reference'
      );
    }
    return valid({
      referenceType: 'ARTIFACT',
      artifactId: closed.artifactId,
      artifactType: closed.artifactType,
      schemaVersion: closed.schemaVersion,
    });
  }

  return invalid(
    'INVALID_EVIDENCE_REFERENCE',
    'Stage admission contains an unknown evidence reference type'
  );
}

export function validatePipelineStageAdmission(
  value: unknown
): CheckpointValidationResult<PipelineStageAdmission> {
  const record = getClosedRecord(value, ADMISSION_KEYS);
  if (!record) {
    return invalid(
      'INVALID_STAGE_ADMISSION',
      'Pipeline stage admission contract is invalid'
    );
  }

  if (record.admissionType !== PRECOMPUTED_ADMISSION_TYPE) {
    return invalid(
      'INVALID_STAGE_ADMISSION',
      'Pipeline stage admission type is invalid'
    );
  }

  if (!isPipelineStageId(record.stageId)) {
    return invalid(
      'INVALID_STAGE_ADMISSION',
      'Pipeline stage admission stage is invalid'
    );
  }

  if (!isVersion(record.artifactSchemaVersion)) {
    return invalid(
      'INVALID_STAGE_ADMISSION',
      'Pipeline stage admission artifact schema version is invalid'
    );
  }

  if (!isCheckpointFingerprint(record.inputFingerprint)) {
    return invalid(
      'INVALID_FINGERPRINT',
      'Pipeline stage admission input fingerprint is invalid'
    );
  }

  if (!isCheckpointFingerprint(record.outputFingerprint)) {
    return invalid(
      'INVALID_FINGERPRINT',
      'Pipeline stage admission output fingerprint is invalid'
    );
  }

  if (!Array.isArray(record.evidenceRefs) || record.evidenceRefs.length === 0) {
    return invalid(
      'INVALID_EVIDENCE_REFERENCE',
      'Pipeline stage admission requires evidence references'
    );
  }

  const evidenceRefs: PipelineEvidenceReference[] = [];
  for (const candidate of record.evidenceRefs) {
    const result = validatePipelineEvidenceReference(candidate);
    if (!result.valid) {
      return result;
    }
    evidenceRefs.push(result.value);
  }

  const evidenceReferenceKeys = evidenceRefs.map(evidenceReferenceKey);
  if (new Set(evidenceReferenceKeys).size !== evidenceReferenceKeys.length) {
    return invalid(
      'DUPLICATE_EVIDENCE_REFERENCE',
      'Pipeline stage admission contains duplicate evidence references'
    );
  }

  return valid(
    canonicalizePipelineStageAdmission({
      stageId: record.stageId,
      admissionType: PRECOMPUTED_ADMISSION_TYPE,
      artifactSchemaVersion: record.artifactSchemaVersion,
      inputFingerprint: record.inputFingerprint,
      outputFingerprint: record.outputFingerprint,
      evidenceRefs: canonicalizePipelineEvidenceReferences(evidenceRefs),
    })
  );
}

export function validatePrecomputedPipelineCheckpoint(
  value: unknown
): CheckpointValidationResult<PrecomputedPipelineCheckpoint> {
  const record = getClosedRecord(value, CHECKPOINT_KEYS);
  if (!record) {
    return invalid(
      'INVALID_CHECKPOINT',
      'Precomputed pipeline checkpoint contract is invalid'
    );
  }

  if (!isIdentifier(record.checkpointId)) {
    return invalid(
      'INVALID_CHECKPOINT',
      'Precomputed pipeline checkpoint identifier is invalid'
    );
  }

  if (record.checkpointVersion !== PRECOMPUTED_CHECKPOINT_VERSION) {
    return invalid(
      'UNSUPPORTED_CHECKPOINT_VERSION',
      'Precomputed pipeline checkpoint version is unsupported'
    );
  }

  if (!isIdentifier(record.tenantId)) {
    return invalid(
      'INVALID_CHECKPOINT',
      'Precomputed pipeline checkpoint tenant is invalid'
    );
  }

  if (!isIdentifier(record.correlationId)) {
    return invalid(
      'INVALID_CHECKPOINT',
      'Precomputed pipeline checkpoint correlation is invalid'
    );
  }

  if (!isIdentifier(record.scenarioId) || !isVersion(record.scenarioVersion)) {
    return invalid(
      'INVALID_CHECKPOINT',
      'Precomputed pipeline checkpoint scenario is invalid'
    );
  }

  if (!isIdentifier(record.producerId)) {
    return invalid(
      'INVALID_CHECKPOINT',
      'Precomputed pipeline checkpoint producer is invalid'
    );
  }

  if (!isVersion(record.producerVersion)) {
    return invalid(
      'INVALID_CHECKPOINT',
      'Precomputed pipeline checkpoint producer version is invalid'
    );
  }

  if (!isCanonicalTimestamp(record.completedAt)) {
    return invalid(
      'INVALID_CHECKPOINT',
      'Precomputed pipeline checkpoint completion timestamp is invalid'
    );
  }

  if (!Array.isArray(record.admissions) || record.admissions.length === 0) {
    return invalid(
      'INVALID_CHECKPOINT',
      'Precomputed pipeline checkpoint requires stage admissions'
    );
  }

  const admissions: PipelineStageAdmission[] = [];
  for (const candidate of record.admissions) {
    const result = validatePipelineStageAdmission(candidate);
    if (!result.valid) {
      return result;
    }
    admissions.push(result.value);
  }

  const stageIds = admissions.map((admission) => admission.stageId);
  if (new Set(stageIds).size !== stageIds.length) {
    return invalid(
      'DUPLICATE_STAGE_ADMISSION',
      'Precomputed pipeline checkpoint contains duplicate stage admissions'
    );
  }

  return valid(
    canonicalizePrecomputedPipelineCheckpoint({
      checkpointId: record.checkpointId,
      checkpointVersion: PRECOMPUTED_CHECKPOINT_VERSION,
      tenantId: record.tenantId,
      correlationId: record.correlationId,
      scenarioId: record.scenarioId,
      scenarioVersion: record.scenarioVersion,
      producerId: record.producerId,
      producerVersion: record.producerVersion,
      completedAt: record.completedAt,
      admissions,
    })
  );
}

export function assertPipelineStageAdmissionValid(
  value: unknown
): asserts value is PipelineStageAdmission {
  const result = validatePipelineStageAdmission(value);
  if (!result.valid) {
    const issue = result.errors[0];
    throw new AuraIntelligenceOSError(
      ErrorCodes.INVALID_CONTRACT,
      issue.message,
      false,
      undefined,
      { checkpointIssue: issue.code }
    );
  }
}

export function assertPrecomputedPipelineCheckpointValid(
  value: unknown
): asserts value is PrecomputedPipelineCheckpoint {
  const result = validatePrecomputedPipelineCheckpoint(value);
  if (!result.valid) {
    const issue = result.errors[0];
    throw new AuraIntelligenceOSError(
      ErrorCodes.INVALID_CONTRACT,
      issue.message,
      false,
      undefined,
      { checkpointIssue: issue.code }
    );
  }
}
