import { describe, expect, it } from 'vitest';
import type { PipelineBootstrapPolicy } from '../types';
import {
  getPipelineBootstrapTaxonomyEntry,
  isPipelineBootstrapTaxonomyCategory,
  isPipelineBootstrapValueType,
  PIPELINE_BOOTSTRAP_DEFAULT_CONFLICT_POLICY,
  PIPELINE_BOOTSTRAP_TAXONOMY,
  PIPELINE_BOOTSTRAP_TAXONOMY_CATEGORIES,
  PIPELINE_BOOTSTRAP_TAXONOMY_VERSION,
  PIPELINE_BOOTSTRAP_VALUE_TYPES,
} from '../taxonomy';
import {
  isPipelineBootstrapValueTypeCompatible,
  validatePipelineBootstrapFactValue,
  validatePipelineBootstrapTaxonomyCategory,
} from '../validators';

function createPolicy(): PipelineBootstrapPolicy {
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
  };
}

describe('Pipeline bootstrap taxonomy', () => {
  it('6. exposes exactly the five canonical categories', () => {
    expect(PIPELINE_BOOTSTRAP_TAXONOMY_CATEGORIES).toEqual([
      'BUSINESS_INDUSTRY',
      'ORGANIZATION_EMPLOYEE_BAND',
      'OPERATIONS_SCHEDULING_MODE',
      'OPERATIONS_INCIDENT_SIGNAL',
      'EXECUTIVE_NORMALIZED_PRIORITY',
    ]);
    expect(Object.keys(PIPELINE_BOOTSTRAP_TAXONOMY)).toHaveLength(5);
  });

  it('7. rejects an unknown taxonomy category', () => {
    const result = validatePipelineBootstrapTaxonomyCategory(
      'UNLISTED_CATEGORY'
    );

    expect(result.valid).toBe(false);
    expect(isPipelineBootstrapTaxonomyCategory('UNLISTED_CATEGORY')).toBe(false);
  });

  it('8. rejects a value type that differs from taxonomy', () => {
    const result = validatePipelineBootstrapFactValue(
      'BOOLEAN',
      true,
      'BUSINESS_INDUSTRY',
      createPolicy()
    );

    expect(result.valid).toBe(false);
    expect(
      isPipelineBootstrapValueTypeCompatible(
        'BUSINESS_INDUSTRY',
        'BOOLEAN'
      )
    ).toBe(false);
  });

  it('9. declares a single supported taxonomy version', () => {
    expect(PIPELINE_BOOTSTRAP_TAXONOMY_VERSION).toBe('1');
    expect(
      Object.values(PIPELINE_BOOTSTRAP_TAXONOMY).every(
        (entry) => entry.version === '1'
      )
    ).toBe(true);
  });

  it('10. category passthrough is unavailable', () => {
    expect(isPipelineBootstrapTaxonomyCategory('business_industry')).toBe(
      false
    );
    expect(isPipelineBootstrapTaxonomyCategory('CUSTOM')).toBe(false);
  });

  it('55. defines all explicit JSON-like value types', () => {
    expect(PIPELINE_BOOTSTRAP_VALUE_TYPES).toEqual([
      'STRING',
      'BOOLEAN',
      'ENUM',
      'NUMBER',
      'STRING_LIST',
    ]);
    expect(isPipelineBootstrapValueType('ENUM')).toBe(true);
    expect(isPipelineBootstrapValueType('OBJECT')).toBe(false);
  });

  it('56. validates each canonical category value', () => {
    const validValues = [
      ['BUSINESS_INDUSTRY', 'ENUM', 'HOSPITALITY'],
      ['ORGANIZATION_EMPLOYEE_BAND', 'ENUM', '10_50'],
      ['OPERATIONS_SCHEDULING_MODE', 'ENUM', 'MANUAL'],
      ['OPERATIONS_INCIDENT_SIGNAL', 'ENUM', 'OBSERVED'],
      ['EXECUTIVE_NORMALIZED_PRIORITY', 'ENUM', 'HIGH'],
    ] as const;

    for (const [category, valueType, value] of validValues) {
      expect(
        validatePipelineBootstrapFactValue(
          valueType,
          value,
          category,
          createPolicy()
        ).valid
      ).toBe(true);
    }
  });

  it('57. rejects normalized enum values outside the closed vocabulary', () => {
    const result = validatePipelineBootstrapFactValue(
      'ENUM',
      'UNLISTED_INDUSTRY',
      'BUSINESS_INDUSTRY',
      createPolicy()
    );

    expect(result.valid).toBe(false);
  });

  it('58. documents whether each category allows multiple facts', () => {
    expect(
      getPipelineBootstrapTaxonomyEntry('OPERATIONS_INCIDENT_SIGNAL')
        .allowMultipleFacts
    ).toBe(true);
    expect(
      getPipelineBootstrapTaxonomyEntry('BUSINESS_INDUSTRY')
        .allowMultipleFacts
    ).toBe(false);
  });

  it('59. requires unknown values to be rejected in every entry', () => {
    expect(
      Object.values(PIPELINE_BOOTSTRAP_TAXONOMY).every(
        (entry) => entry.rejectUnknownValues
      )
    ).toBe(true);
  });

  it('60. fixes taxonomy conflict behavior to rejection', () => {
    expect(PIPELINE_BOOTSTRAP_DEFAULT_CONFLICT_POLICY).toBe('REJECT');
    expect(
      Object.values(PIPELINE_BOOTSTRAP_TAXONOMY).every(
        (entry) => entry.conflictPolicy === 'REJECT'
      )
    ).toBe(true);
  });

  it('81. accepts only the explicit observed incident signal', () => {
    const incident = getPipelineBootstrapTaxonomyEntry(
      'OPERATIONS_INCIDENT_SIGNAL'
    );

    expect(incident.allowedValueType).toBe('ENUM');
    expect(incident.allowedValues).toEqual(['OBSERVED']);
    expect(incident.allowedPolarities).toEqual([
      'AFFIRMED',
      'UNCERTAIN',
    ]);
  });

  it('82. rejects boolean false as an incident value', () => {
    const result = validatePipelineBootstrapFactValue(
      'BOOLEAN',
      false,
      'OPERATIONS_INCIDENT_SIGNAL',
      createPolicy()
    );

    expect(result.valid).toBe(false);
  });
});
