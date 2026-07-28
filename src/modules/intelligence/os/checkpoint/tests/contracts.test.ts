import { describe, expect, it } from 'vitest';
import type {
  ExecutionOrigin,
  PipelineStageId,
  PipelineStageResult,
} from '../../types';
import { PIPELINE_STAGE_IDS } from '../../types';
import {
  canonicalizePrecomputedPipelineCheckpoint,
  clonePrecomputedPipelineCheckpoint,
  createDeterministicFingerprint,
  freezePrecomputedPipelineCheckpoint,
  validatePipelineStageAdmission,
  validatePrecomputedPipelineCheckpoint,
  type PipelineEvidenceReference,
  type PipelineStageAdmission,
  type PrecomputedPipelineCheckpoint,
} from '..';

function createEvidenceReference(
  evidenceId = 'evidence-1'
): PipelineEvidenceReference {
  return {
    referenceType: 'EVIDENCE',
    evidenceId,
    schemaVersion: '1',
  };
}

function createAdmission(
  stageId: PipelineStageId = 'EVIDENCE_EXTRACTION',
  evidenceRefs: readonly PipelineEvidenceReference[] = [
    createEvidenceReference(),
  ]
): PipelineStageAdmission {
  return {
    stageId,
    admissionType: 'PRECOMPUTED',
    artifactSchemaVersion: '1',
    inputFingerprint: createDeterministicFingerprint({
      stageId,
      direction: 'input',
    }),
    outputFingerprint: createDeterministicFingerprint({
      stageId,
      direction: 'output',
    }),
    evidenceRefs,
  };
}

function createCheckpoint(
  admissions: readonly PipelineStageAdmission[] = [
    createAdmission('EVIDENCE_EXTRACTION'),
    createAdmission('MENTAL_MODEL', [
      {
        referenceType: 'ARTIFACT',
        artifactId: 'mental-model-1',
        artifactType: 'ENTERPRISE_MENTAL_MODEL',
        schemaVersion: '1',
      },
    ]),
    createAdmission('KNOWLEDGE_GRAPH', [
      {
        referenceType: 'ARTIFACT',
        artifactId: 'knowledge-graph-1',
        artifactType: 'ENTERPRISE_KNOWLEDGE_GRAPH',
        schemaVersion: '1',
      },
    ]),
  ]
): PrecomputedPipelineCheckpoint {
  return {
    checkpointId: 'checkpoint-1',
    checkpointVersion: '1',
    tenantId: 'tenant-1',
    correlationId: 'correlation-1',
    scenarioId: 'PAYROLL_AUDIT',
    scenarioVersion: '1',
    producerId: 'precomputed-domain-producer',
    producerVersion: '1',
    completedAt: '2026-07-28T12:00:00.000Z',
    admissions,
  };
}

function createStageResult(
  executionOrigin?: ExecutionOrigin
): PipelineStageResult<unknown> {
  return {
    stage: 'EVIDENCE_EXTRACTION',
    status: 'SUCCEEDED',
    ...(executionOrigin ? { executionOrigin } : {}),
    startedAt: '2026-07-28T12:00:00.000Z',
    completedAt: '2026-07-28T12:00:00.000Z',
    durationMs: 0,
    errors: [],
    warnings: [],
  };
}

describe('AI-02C.3B checkpoint contracts and validators', () => {
  it('1. accepts a valid checkpoint', () => {
    const checkpoint = createCheckpoint();
    const result = validatePrecomputedPipelineCheckpoint(checkpoint);

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.value).toEqual(checkpoint);
      expect(result.value).not.toBe(checkpoint);
    }
  });

  it('2. accepts a valid stage admission', () => {
    const admission = createAdmission();
    const result = validatePipelineStageAdmission(admission);

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.value).toEqual(admission);
      expect(result.value).not.toBe(admission);
    }
  });

  it('3. accepts every PipelineStageId in an admission', () => {
    for (const stageId of PIPELINE_STAGE_IDS) {
      expect(validatePipelineStageAdmission(createAdmission(stageId)).valid)
        .toBe(true);
    }
  });

  it('4. represents CURRENT_EXECUTION as an execution origin', () => {
    const result = createStageResult('CURRENT_EXECUTION');
    expect(result.executionOrigin).toBe('CURRENT_EXECUTION');
  });

  it('5. represents PRECOMPUTED with a typed admission reference', () => {
    const result: PipelineStageResult<unknown> = {
      ...createStageResult('PRECOMPUTED'),
      admissionReference: {
        checkpointId: 'checkpoint-1',
        stageId: 'EVIDENCE_EXTRACTION',
      },
    };

    expect(result.executionOrigin).toBe('PRECOMPUTED');
    expect(result.admissionReference?.stageId).toBe('EVIDENCE_EXTRACTION');
  });

  it('6. keeps an absent executionOrigin compatible with current execution', () => {
    const result = createStageResult();
    expect(result.executionOrigin).toBeUndefined();
    expect(result.executionOrigin ?? 'CURRENT_EXECUTION')
      .toBe('CURRENT_EXECUTION');
  });

  it('7. rejects an empty checkpointId', () => {
    const result = validatePrecomputedPipelineCheckpoint({
      ...createCheckpoint(),
      checkpointId: '',
    });

    expect(result).toMatchObject({
      valid: false,
      errors: [{ code: 'INVALID_CHECKPOINT' }],
    });
  });

  it('8. rejects an unsupported checkpoint version', () => {
    const result = validatePrecomputedPipelineCheckpoint({
      ...createCheckpoint(),
      checkpointVersion: '2',
    });

    expect(result).toMatchObject({
      valid: false,
      errors: [{ code: 'UNSUPPORTED_CHECKPOINT_VERSION' }],
    });
  });

  it('9. rejects an empty tenantId', () => {
    const result = validatePrecomputedPipelineCheckpoint({
      ...createCheckpoint(),
      tenantId: '',
    });
    expect(result.valid).toBe(false);
  });

  it('10. rejects an empty correlationId', () => {
    const result = validatePrecomputedPipelineCheckpoint({
      ...createCheckpoint(),
      correlationId: '',
    });
    expect(result.valid).toBe(false);
  });

  it('11. rejects an empty scenarioId', () => {
    const result = validatePrecomputedPipelineCheckpoint({
      ...createCheckpoint(),
      scenarioId: '',
    });
    expect(result.valid).toBe(false);
  });

  it('12. rejects an empty producerId', () => {
    const result = validatePrecomputedPipelineCheckpoint({
      ...createCheckpoint(),
      producerId: '',
    });
    expect(result.valid).toBe(false);
  });

  it('13. rejects an empty producerVersion', () => {
    const result = validatePrecomputedPipelineCheckpoint({
      ...createCheckpoint(),
      producerVersion: '',
    });
    expect(result.valid).toBe(false);
  });

  it('14. rejects a non-canonical completedAt timestamp', () => {
    const result = validatePrecomputedPipelineCheckpoint({
      ...createCheckpoint(),
      completedAt: '2026-07-28',
    });
    expect(result.valid).toBe(false);
  });

  it('15. rejects an empty admission set', () => {
    const result = validatePrecomputedPipelineCheckpoint(
      createCheckpoint([])
    );
    expect(result.valid).toBe(false);
  });

  it('16. rejects duplicate admissions by stageId', () => {
    const result = validatePrecomputedPipelineCheckpoint(
      createCheckpoint([
        createAdmission('MENTAL_MODEL'),
        createAdmission('MENTAL_MODEL'),
      ])
    );

    expect(result).toMatchObject({
      valid: false,
      errors: [{ code: 'DUPLICATE_STAGE_ADMISSION' }],
    });
  });

  it('17. rejects an admissionType other than PRECOMPUTED', () => {
    const result = validatePipelineStageAdmission({
      ...createAdmission(),
      admissionType: 'CURRENT_EXECUTION',
    });
    expect(result.valid).toBe(false);
  });

  it('18. rejects an unknown stageId', () => {
    const result = validatePipelineStageAdmission({
      ...createAdmission(),
      stageId: 'UNKNOWN_STAGE',
    });
    expect(result.valid).toBe(false);
  });

  it('19. rejects an invalid artifactSchemaVersion', () => {
    const result = validatePipelineStageAdmission({
      ...createAdmission(),
      artifactSchemaVersion: '',
    });
    expect(result.valid).toBe(false);
  });

  it('20. rejects an invalid input fingerprint', () => {
    const result = validatePipelineStageAdmission({
      ...createAdmission(),
      inputFingerprint: 'fp:v1:bad',
    });
    expect(result).toMatchObject({
      valid: false,
      errors: [{ code: 'INVALID_FINGERPRINT' }],
    });
  });

  it('21. rejects an invalid output fingerprint', () => {
    const result = validatePipelineStageAdmission({
      ...createAdmission(),
      outputFingerprint: '',
    });
    expect(result).toMatchObject({
      valid: false,
      errors: [{ code: 'INVALID_FINGERPRINT' }],
    });
  });

  it('22. rejects empty evidenceRefs for an admitted stage', () => {
    const result = validatePipelineStageAdmission(
      createAdmission('EVIDENCE_EXTRACTION', [])
    );
    expect(result.valid).toBe(false);
  });

  it('23. rejects duplicate evidence references', () => {
    const evidenceRef = createEvidenceReference();
    const result = validatePipelineStageAdmission(
      createAdmission('EVIDENCE_EXTRACTION', [evidenceRef, evidenceRef])
    );

    expect(result).toMatchObject({
      valid: false,
      errors: [{ code: 'DUPLICATE_EVIDENCE_REFERENCE' }],
    });
  });

  it('24. rejects an invalid or URL-shaped evidence reference', () => {
    const result = validatePipelineStageAdmission({
      ...createAdmission(),
      evidenceRefs: [
        {
          referenceType: 'EVIDENCE',
          evidenceId: 'https://example.test/evidence/1',
          schemaVersion: '1',
        },
      ],
    });

    expect(result).toMatchObject({
      valid: false,
      errors: [{ code: 'INVALID_EVIDENCE_REFERENCE' }],
    });
  });

  it('36. creates an independent checkpoint clone', () => {
    const checkpoint = createCheckpoint();
    const clone = clonePrecomputedPipelineCheckpoint(checkpoint);

    expect(clone).toEqual(checkpoint);
    expect(clone).not.toBe(checkpoint);
    expect(clone.admissions[0]).not.toBe(checkpoint.admissions[0]);
  });

  it('37. creates independent admission and evidence reference arrays', () => {
    const checkpoint = createCheckpoint();
    const clone = clonePrecomputedPipelineCheckpoint(checkpoint);

    expect(clone.admissions).not.toBe(checkpoint.admissions);
    expect(clone.admissions[0].evidenceRefs)
      .not.toBe(checkpoint.admissions[0].evidenceRefs);
    expect(clone.admissions[0].evidenceRefs[0])
      .not.toBe(checkpoint.admissions[0].evidenceRefs[0]);
  });

  it('38. freezes the checkpoint, admissions and nested references', () => {
    const frozen = freezePrecomputedPipelineCheckpoint(createCheckpoint());

    expect(Object.isFrozen(frozen)).toBe(true);
    expect(Object.isFrozen(frozen.admissions)).toBe(true);
    expect(Object.isFrozen(frozen.admissions[0])).toBe(true);
    expect(Object.isFrozen(frozen.admissions[0].evidenceRefs)).toBe(true);
    expect(Object.isFrozen(frozen.admissions[0].evidenceRefs[0])).toBe(true);
  });

  it('39. validators never mutate caller input', () => {
    const checkpoint = createCheckpoint([
      createAdmission('KNOWLEDGE_GRAPH', [
        createEvidenceReference('evidence-z'),
        createEvidenceReference('evidence-a'),
      ]),
      createAdmission('EVIDENCE_EXTRACTION'),
    ]);
    const before = JSON.stringify(checkpoint);

    const result = validatePrecomputedPipelineCheckpoint(checkpoint);

    expect(result.valid).toBe(true);
    expect(JSON.stringify(checkpoint)).toBe(before);
    expect(checkpoint.admissions[0].stageId).toBe('KNOWLEDGE_GRAPH');
  });

  it('40. canonicalizes admission and evidence set order stably', () => {
    const evidenceA = createEvidenceReference('evidence-a');
    const evidenceB = createEvidenceReference('evidence-b');
    const left = createCheckpoint([
      createAdmission('KNOWLEDGE_GRAPH', [evidenceB, evidenceA]),
      createAdmission('EVIDENCE_EXTRACTION'),
    ]);
    const right = createCheckpoint([
      createAdmission('EVIDENCE_EXTRACTION'),
      createAdmission('KNOWLEDGE_GRAPH', [evidenceA, evidenceB]),
    ]);

    expect(canonicalizePrecomputedPipelineCheckpoint(left))
      .toEqual(canonicalizePrecomputedPipelineCheckpoint(right));
  });
});
