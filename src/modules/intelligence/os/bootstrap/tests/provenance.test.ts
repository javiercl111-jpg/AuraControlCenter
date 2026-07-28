import { describe, expect, it } from 'vitest';
import type { PipelineBootstrapPolicy } from '../types';
import type { PipelineBootstrapProvenance } from '../provenance';
import { PIPELINE_BOOTSTRAP_PROVENANCE_MATRIX } from '../provenance';
import {
  validatePipelineBootstrapDirectness,
  validatePipelineBootstrapFacts,
  validatePipelineBootstrapPolarity,
  validatePipelineBootstrapProvenance,
  validatePipelineBootstrapReliability,
} from '../validators';

function createPolicy(
  overrides: Partial<PipelineBootstrapPolicy> = {}
): PipelineBootstrapPolicy {
  return {
    allowedTaxonomyVersion: '1',
    allowedScenarioVersion: '1',
    allowUnknownReliability: false,
    allowUncertainPolarity: false,
    allowInferredDirectness: false,
    allowedInferenceRuleIds: [],
    maxFacts: 10,
    maxFactValueSize: 256,
    maxTotalPayloadSize: 4096,
    duplicateFactPolicy: 'REJECT',
    conflictPolicy: 'REJECT',
    failClosed: true,
    requireExplicitScenario: true,
    ...overrides,
  };
}

function createProvenance(
  overrides: Partial<PipelineBootstrapProvenance> = {}
): PipelineBootstrapProvenance {
  return {
    sourceType: 'INTEGRATION',
    sourceId: 'source-event-1',
    collectionMethod: 'SYSTEM_EVENT',
    capturedAt: 200,
    reliability: 'HIGH',
    directness: 'DIRECT',
    actorType: 'SYSTEM',
    tenantId: 'tenant-1',
    correlationId: 'correlation-1',
    ...overrides,
  };
}

function errorCodes(
  result: ReturnType<typeof validatePipelineBootstrapProvenance>
): readonly string[] {
  return result.valid ? [] : result.errors.map((item) => item.code);
}

describe('Pipeline bootstrap provenance', () => {
  it('11. accepts complete provenance with canonical source semantics', () => {
    const provenance = createProvenance();
    const result = validatePipelineBootstrapProvenance(
      provenance,
      createPolicy()
    );

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.value).toBe(provenance);
    }
  });

  it('12. rejects an empty source identifier', () => {
    const result = validatePipelineBootstrapProvenance(
      { ...createProvenance(), sourceId: '' },
      createPolicy()
    );

    expect(errorCodes(result)).toContain('INVALID_PROVENANCE');
  });

  it('13. rejects an empty provenance tenant', () => {
    const result = validatePipelineBootstrapProvenance(
      { ...createProvenance(), tenantId: '' },
      createPolicy()
    );

    expect(errorCodes(result)).toContain('INVALID_PROVENANCE');
  });

  it('14. rejects an empty provenance correlation identifier', () => {
    const result = validatePipelineBootstrapProvenance(
      { ...createProvenance(), correlationId: '' },
      createPolicy()
    );

    expect(errorCodes(result)).toContain('INVALID_PROVENANCE');
  });

  it('15. rejects a non-finite capture timestamp', () => {
    const result = validatePipelineBootstrapProvenance(
      { ...createProvenance(), capturedAt: Number.POSITIVE_INFINITY },
      createPolicy()
    );

    expect(errorCodes(result)).toContain('INVALID_PROVENANCE');
  });

  it('16. rejects reliability outside the closed scale', () => {
    const result = validatePipelineBootstrapReliability(
      'UNLISTED_RELIABILITY',
      false
    );

    expect(result.valid).toBe(false);
  });

  it('17. rejects directness outside the closed scale', () => {
    const result = validatePipelineBootstrapDirectness(
      'UNLISTED_DIRECTNESS',
      false
    );

    expect(result.valid).toBe(false);
  });

  it('18. rejects polarity outside the closed scale', () => {
    const result = validatePipelineBootstrapPolarity(
      'UNLISTED_POLARITY',
      false
    );

    expect(result.valid).toBe(false);
  });

  it('19. rejects inferred provenance without explicit policy', () => {
    const result = validatePipelineBootstrapProvenance(
      {
        ...createProvenance(),
        sourceType: 'DERIVED_INFERENCE',
        directness: 'INFERRED',
        inferenceRuleId: 'rule-1',
      },
      createPolicy()
    );

    expect(errorCodes(result)).toContain('INVALID_PROVENANCE');
  });

  it('20. detects a tenant mismatch against the bootstrap envelope', () => {
    const result = validatePipelineBootstrapFacts(
      [
        {
          factId: 'fact-1',
          category: 'BUSINESS_INDUSTRY',
          value: 'HOSPITALITY',
          valueType: 'ENUM',
          provenance: createProvenance({ tenantId: 'tenant-2' }),
          reliability: 'HIGH',
          directness: 'DIRECT',
          polarity: 'AFFIRMED',
          observedAt: 100,
          schemaVersion: '1',
        },
      ],
      createPolicy(),
      'tenant-1',
      'correlation-1'
    );

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.map((item) => item.code)).toContain(
        'TENANT_CONTEXT_MISMATCH'
      );
    }
  });

  it('61. allows unknown reliability only when policy opts in', () => {
    expect(
      validatePipelineBootstrapReliability('UNKNOWN', false).valid
    ).toBe(false);
    expect(
      validatePipelineBootstrapReliability('UNKNOWN', true).valid
    ).toBe(true);
  });

  it('62. allows uncertain polarity only when policy opts in', () => {
    expect(
      validatePipelineBootstrapPolarity('UNCERTAIN', false).valid
    ).toBe(false);
    expect(
      validatePipelineBootstrapPolarity('UNCERTAIN', true).valid
    ).toBe(true);
  });

  it('63. accepts inferred provenance only with an allowlisted rule', () => {
    const policy = createPolicy({
      allowInferredDirectness: true,
      allowedInferenceRuleIds: ['rule-1'],
    });
    const result = validatePipelineBootstrapProvenance(
      {
        ...createProvenance(),
        sourceType: 'DERIVED_INFERENCE',
        directness: 'INFERRED',
        inferenceRuleId: 'rule-1',
      },
      policy
    );

    expect(result.valid).toBe(true);
  });

  it('64. rejects an inference rule on direct provenance', () => {
    const result = validatePipelineBootstrapProvenance(
      { ...createProvenance(), inferenceRuleId: 'rule-1' },
      createPolicy()
    );

    expect(errorCodes(result)).toContain('INVALID_PROVENANCE');
  });

  it('65. rejects a derived source that is not marked inferred', () => {
    const result = validatePipelineBootstrapProvenance(
      { ...createProvenance(), sourceType: 'DERIVED_INFERENCE' },
      createPolicy()
    );

    expect(errorCodes(result)).toContain('INVALID_PROVENANCE');
  });

  it('83. registers all canonical provenance source combinations', () => {
    expect(Object.keys(PIPELINE_BOOTSTRAP_PROVENANCE_MATRIX)).toEqual([
      'USER_STATEMENT',
      'USER_CONFIRMATION',
      'USER_CORRECTION',
      'SYSTEM_OBSERVATION',
      'DOCUMENT',
      'INTEGRATION',
      'DERIVED_INFERENCE',
    ]);
  });

  it.each([
    [
      'USER_STATEMENT',
      'FORM_RESPONSE',
      'USER',
      'DIRECT',
    ],
    [
      'USER_CONFIRMATION',
      'CONVERSATION_RESPONSE',
      'USER',
      'DIRECT',
    ],
    [
      'USER_CORRECTION',
      'MANUAL_ENTRY',
      'USER',
      'DIRECT',
    ],
    [
      'SYSTEM_OBSERVATION',
      'SYSTEM_EVENT',
      'SYSTEM',
      'DERIVED',
    ],
    ['DOCUMENT', 'FILE_IMPORT', 'ADMIN', 'DIRECT'],
    ['INTEGRATION', 'API_IMPORT', 'EXTERNAL_SYSTEM', 'DIRECT'],
  ] as const)(
    '84. accepts registered provenance combination %s/%s/%s/%s',
    (sourceType, collectionMethod, actorType, directness) => {
      const result = validatePipelineBootstrapProvenance(
        createProvenance({
          sourceType,
          collectionMethod,
          actorType,
          directness,
        }),
        createPolicy()
      );

      expect(result.valid).toBe(true);
    }
  );

  it('85. rejects USER_STATEMENT collected as SYSTEM_EVENT', () => {
    const result = validatePipelineBootstrapProvenance(
      createProvenance({
        sourceType: 'USER_STATEMENT',
        collectionMethod: 'SYSTEM_EVENT',
        actorType: 'USER',
      }),
      createPolicy()
    );

    expect(errorCodes(result)).toContain('INVALID_PROVENANCE');
  });

  it('86. rejects a source and actor combination outside the matrix', () => {
    const result = validatePipelineBootstrapProvenance(
      createProvenance({
        sourceType: 'SYSTEM_OBSERVATION',
        collectionMethod: 'SYSTEM_EVENT',
        actorType: 'USER',
      }),
      createPolicy()
    );

    expect(errorCodes(result)).toContain('INVALID_PROVENANCE');
  });

  it('87. rejects provenance without the matrix-required actor', () => {
    const { actorType: omittedActor, ...provenance } =
      createProvenance();
    expect(omittedActor).toBe('SYSTEM');

    const result = validatePipelineBootstrapProvenance(
      provenance,
      createPolicy()
    );

    expect(errorCodes(result)).toContain('INVALID_PROVENANCE');
  });
});
