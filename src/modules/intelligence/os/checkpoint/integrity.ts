import { PIPELINE_STAGE_IDS } from '../types';
import type {
  CheckpointCanonicalizationOptions,
  CheckpointFingerprint,
  PipelineEvidenceReference,
  PipelineStageAdmission,
  PrecomputedPipelineCheckpoint,
} from './types';
import {
  CHECKPOINT_FINGERPRINT_PREFIX,
  CHECKPOINT_FINGERPRINT_VERSION,
} from './types';

export type FingerprintCanonicalizationIssue =
  | 'UNDEFINED_VALUE'
  | 'NON_FINITE_NUMBER'
  | 'UNSUPPORTED_VALUE'
  | 'NON_PLAIN_OBJECT'
  | 'CYCLIC_VALUE';

export class FingerprintCanonicalizationError extends Error {
  public readonly code = 'INVALID_FINGERPRINT_INPUT';
  public readonly issue: FingerprintCanonicalizationIssue;

  constructor(issue: FingerprintCanonicalizationIssue) {
    super(`Fingerprint input is not canonicalizable: ${issue}`);
    this.name = 'FingerprintCanonicalizationError';
    this.issue = issue;
    Object.setPrototypeOf(this, FingerprintCanonicalizationError.prototype);
  }
}

function canonicalizeValue(
  value: unknown,
  arraySemantics: 'ORDERED' | 'SET',
  activeObjects: WeakSet<object>
): string {
  if (value === null) {
    return 'null';
  }

  if (value === undefined) {
    throw new FingerprintCanonicalizationError('UNDEFINED_VALUE');
  }

  if (typeof value === 'string') {
    return JSON.stringify(value);
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new FingerprintCanonicalizationError('NON_FINITE_NUMBER');
    }
    return Object.is(value, -0) ? '0' : String(value);
  }

  if (
    typeof value === 'bigint' ||
    typeof value === 'function' ||
    typeof value === 'symbol'
  ) {
    throw new FingerprintCanonicalizationError('UNSUPPORTED_VALUE');
  }

  if (typeof value !== 'object') {
    throw new FingerprintCanonicalizationError('UNSUPPORTED_VALUE');
  }

  if (activeObjects.has(value)) {
    throw new FingerprintCanonicalizationError('CYCLIC_VALUE');
  }

  activeObjects.add(value);
  try {
    if (Array.isArray(value)) {
      const entries = value.map((entry) =>
        canonicalizeValue(entry, arraySemantics, activeObjects)
      );
      if (arraySemantics === 'SET') {
        entries.sort();
      }
      return `[${entries.join(',')}]`;
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new FingerprintCanonicalizationError('NON_PLAIN_OBJECT');
    }

    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (Object.getOwnPropertySymbols(value).length > 0) {
      throw new FingerprintCanonicalizationError('UNSUPPORTED_VALUE');
    }

    const keys = Object.keys(descriptors).sort();
    const entries = keys.map((key) => {
      const descriptor = descriptors[key];
      if (
        !descriptor.enumerable ||
        descriptor.get !== undefined ||
        descriptor.set !== undefined
      ) {
        throw new FingerprintCanonicalizationError('UNSUPPORTED_VALUE');
      }
      return `${JSON.stringify(key)}:${canonicalizeValue(
        descriptor.value,
        arraySemantics,
        activeObjects
      )}`;
    });
    return `{${entries.join(',')}}`;
  } finally {
    activeObjects.delete(value);
  }
}

export function canonicalizeFingerprintInput(
  value: unknown,
  options: CheckpointCanonicalizationOptions = {}
): string {
  return canonicalizeValue(
    value,
    options.arraySemantics ?? 'ORDERED',
    new WeakSet<object>()
  );
}

function hashCanonicalString(value: string, seed: number): string {
  let hash = (0x811c9dc5 ^ seed) >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b) >>> 0;
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35) >>> 0;
  hash ^= hash >>> 16;
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Produces a deterministic, versioned integrity fingerprint. The digest is a
 * browser-compatible non-cryptographic hash and must not be treated as a
 * signature, secret, or proof of authenticity.
 */
export function createDeterministicFingerprint(
  value: unknown,
  options: CheckpointCanonicalizationOptions = {}
): CheckpointFingerprint {
  const canonicalValue = canonicalizeFingerprintInput(value, options);
  const digest = [0, 0x9e3779b9, 0x85ebca6b, 0xc2b2ae35]
    .map((seed) => hashCanonicalString(canonicalValue, seed))
    .join('');
  return `${CHECKPOINT_FINGERPRINT_PREFIX}${digest}`;
}

export function isCheckpointFingerprint(
  value: unknown
): value is CheckpointFingerprint {
  return (
    typeof value === 'string' &&
    new RegExp(
      `^fp:${CHECKPOINT_FINGERPRINT_VERSION}:[0-9a-f]{32}$`
    ).test(value)
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

export function clonePipelineEvidenceReference(
  reference: PipelineEvidenceReference
): PipelineEvidenceReference {
  switch (reference.referenceType) {
    case 'EVIDENCE':
      return { ...reference };
    case 'FACT':
      return { ...reference };
    case 'ARTIFACT':
      return { ...reference };
  }
}

export function canonicalizePipelineEvidenceReferences(
  references: readonly PipelineEvidenceReference[]
): PipelineEvidenceReference[] {
  return references
    .map(clonePipelineEvidenceReference)
    .sort((left, right) =>
      evidenceReferenceKey(left).localeCompare(evidenceReferenceKey(right))
    );
}

export function clonePipelineStageAdmission(
  admission: PipelineStageAdmission
): PipelineStageAdmission {
  return {
    ...admission,
    evidenceRefs: admission.evidenceRefs.map(clonePipelineEvidenceReference),
  };
}

export function canonicalizePipelineStageAdmission(
  admission: PipelineStageAdmission
): PipelineStageAdmission {
  return {
    ...admission,
    evidenceRefs: canonicalizePipelineEvidenceReferences(
      admission.evidenceRefs
    ),
  };
}

export function clonePrecomputedPipelineCheckpoint(
  checkpoint: PrecomputedPipelineCheckpoint
): PrecomputedPipelineCheckpoint {
  return {
    ...checkpoint,
    admissions: checkpoint.admissions.map(clonePipelineStageAdmission),
  };
}

export function canonicalizePrecomputedPipelineCheckpoint(
  checkpoint: PrecomputedPipelineCheckpoint
): PrecomputedPipelineCheckpoint {
  const stageOrder = new Map(
    PIPELINE_STAGE_IDS.map((stageId, index) => [stageId, index])
  );
  return {
    ...checkpoint,
    admissions: checkpoint.admissions
      .map(canonicalizePipelineStageAdmission)
      .sort(
        (left, right) =>
          (stageOrder.get(left.stageId) ?? Number.MAX_SAFE_INTEGER) -
          (stageOrder.get(right.stageId) ?? Number.MAX_SAFE_INTEGER)
      ),
  };
}

function freezeEvidenceReference(
  reference: PipelineEvidenceReference
): PipelineEvidenceReference {
  return Object.freeze(clonePipelineEvidenceReference(reference));
}

export function freezePipelineStageAdmission(
  admission: PipelineStageAdmission
): PipelineStageAdmission {
  const canonicalAdmission =
    canonicalizePipelineStageAdmission(admission);
  return Object.freeze({
    ...canonicalAdmission,
    evidenceRefs: Object.freeze(
      canonicalAdmission.evidenceRefs.map(freezeEvidenceReference)
    ),
  });
}

export function freezePrecomputedPipelineCheckpoint(
  checkpoint: PrecomputedPipelineCheckpoint
): PrecomputedPipelineCheckpoint {
  const canonicalCheckpoint =
    canonicalizePrecomputedPipelineCheckpoint(checkpoint);
  return Object.freeze({
    ...canonicalCheckpoint,
    admissions: Object.freeze(
      canonicalCheckpoint.admissions.map(freezePipelineStageAdmission)
    ),
  });
}
