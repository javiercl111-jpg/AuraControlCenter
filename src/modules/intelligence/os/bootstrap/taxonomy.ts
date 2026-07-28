import type { PipelineBootstrapPolarity } from './provenance';

export const PIPELINE_BOOTSTRAP_TAXONOMY_VERSION = '1' as const;

export const PIPELINE_BOOTSTRAP_VALUE_TYPES = [
  'STRING',
  'BOOLEAN',
  'ENUM',
  'NUMBER',
  'STRING_LIST',
] as const;

export type PipelineBootstrapValueType =
  (typeof PIPELINE_BOOTSTRAP_VALUE_TYPES)[number];

export const PIPELINE_BOOTSTRAP_TAXONOMY_CATEGORIES = [
  'BUSINESS_INDUSTRY',
  'ORGANIZATION_EMPLOYEE_BAND',
  'OPERATIONS_SCHEDULING_MODE',
  'OPERATIONS_INCIDENT_SIGNAL',
  'EXECUTIVE_NORMALIZED_PRIORITY',
] as const;

export type PipelineBootstrapTaxonomyCategory =
  (typeof PIPELINE_BOOTSTRAP_TAXONOMY_CATEGORIES)[number];

export type PipelineBootstrapNormalizationRule =
  | 'TRIMMED_NON_EMPTY'
  | 'UPPER_SNAKE_CASE'
  | 'FINITE_NUMBER'
  | 'BOOLEAN_EXACT'
  | 'TRIMMED_UNIQUE_STRING_LIST';

export type PipelineBootstrapConflictPolicy =
  | 'REJECT'
  | 'KEEP_HIGHEST_RELIABILITY'
  | 'KEEP_LATEST_CONFIRMED'
  | 'REQUIRE_REVIEW';

export const PIPELINE_BOOTSTRAP_DEFAULT_CONFLICT_POLICY = 'REJECT' as const;

export type PipelineBootstrapTaxonomyAllowedValue =
  | string
  | number
  | boolean;

export interface PipelineBootstrapTaxonomyEntry {
  readonly key: PipelineBootstrapTaxonomyCategory;
  readonly version: typeof PIPELINE_BOOTSTRAP_TAXONOMY_VERSION;
  readonly allowedValueType: PipelineBootstrapValueType;
  readonly allowedValues: readonly PipelineBootstrapTaxonomyAllowedValue[];
  readonly semanticDescription: string;
  readonly normalization: PipelineBootstrapNormalizationRule;
  readonly allowedPolarities: readonly PipelineBootstrapPolarity[];
  readonly allowMultipleFacts: boolean;
  readonly conflictPolicy: typeof PIPELINE_BOOTSTRAP_DEFAULT_CONFLICT_POLICY;
  readonly rejectUnknownValues: true;
}

const BUSINESS_INDUSTRY_VALUES = [
  'HOSPITALITY',
  'MANUFACTURING',
  'RETAIL',
  'PROFESSIONAL_SERVICES',
] as const;

const EMPLOYEE_BAND_VALUES = [
  'UNKNOWN',
  '1_9',
  '10_50',
  '51_250',
  '251_PLUS',
] as const;

const SCHEDULING_MODE_VALUES = [
  'UNKNOWN',
  'MANUAL',
  'LOCAL_SYSTEM',
  'CLOUD_SYSTEM',
  'HYBRID',
] as const;

const NORMALIZED_PRIORITY_VALUES = [
  'UNKNOWN',
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL',
] as const;

const INCIDENT_SIGNAL_VALUES = ['OBSERVED'] as const;

export const PIPELINE_BOOTSTRAP_TAXONOMY: Readonly<
  Record<PipelineBootstrapTaxonomyCategory, PipelineBootstrapTaxonomyEntry>
> = Object.freeze({
  BUSINESS_INDUSTRY: Object.freeze({
    key: 'BUSINESS_INDUSTRY',
    version: PIPELINE_BOOTSTRAP_TAXONOMY_VERSION,
    allowedValueType: 'ENUM',
    allowedValues: BUSINESS_INDUSTRY_VALUES,
    semanticDescription:
      'Normalized business industry key with no organization identity.',
    normalization: 'UPPER_SNAKE_CASE',
    allowedPolarities: ['AFFIRMED', 'NEGATED', 'UNCERTAIN'] as const,
    allowMultipleFacts: false,
    conflictPolicy: PIPELINE_BOOTSTRAP_DEFAULT_CONFLICT_POLICY,
    rejectUnknownValues: true,
  }),
  ORGANIZATION_EMPLOYEE_BAND: Object.freeze({
    key: 'ORGANIZATION_EMPLOYEE_BAND',
    version: PIPELINE_BOOTSTRAP_TAXONOMY_VERSION,
    allowedValueType: 'ENUM',
    allowedValues: EMPLOYEE_BAND_VALUES,
    semanticDescription:
      'Normalized employee-count band without an exact headcount.',
    normalization: 'UPPER_SNAKE_CASE',
    allowedPolarities: ['AFFIRMED', 'NEGATED', 'UNCERTAIN'] as const,
    allowMultipleFacts: false,
    conflictPolicy: PIPELINE_BOOTSTRAP_DEFAULT_CONFLICT_POLICY,
    rejectUnknownValues: true,
  }),
  OPERATIONS_SCHEDULING_MODE: Object.freeze({
    key: 'OPERATIONS_SCHEDULING_MODE',
    version: PIPELINE_BOOTSTRAP_TAXONOMY_VERSION,
    allowedValueType: 'ENUM',
    allowedValues: SCHEDULING_MODE_VALUES,
    semanticDescription:
      'Normalized operating mode for workforce scheduling.',
    normalization: 'UPPER_SNAKE_CASE',
    allowedPolarities: ['AFFIRMED', 'NEGATED', 'UNCERTAIN'] as const,
    allowMultipleFacts: false,
    conflictPolicy: PIPELINE_BOOTSTRAP_DEFAULT_CONFLICT_POLICY,
    rejectUnknownValues: true,
  }),
  OPERATIONS_INCIDENT_SIGNAL: Object.freeze({
    key: 'OPERATIONS_INCIDENT_SIGNAL',
    version: PIPELINE_BOOTSTRAP_TAXONOMY_VERSION,
    allowedValueType: 'ENUM',
    allowedValues: INCIDENT_SIGNAL_VALUES,
    semanticDescription:
      'Explicit positive signal that an operational incident was observed.',
    normalization: 'UPPER_SNAKE_CASE',
    allowedPolarities: ['AFFIRMED', 'UNCERTAIN'] as const,
    allowMultipleFacts: true,
    conflictPolicy: PIPELINE_BOOTSTRAP_DEFAULT_CONFLICT_POLICY,
    rejectUnknownValues: true,
  }),
  EXECUTIVE_NORMALIZED_PRIORITY: Object.freeze({
    key: 'EXECUTIVE_NORMALIZED_PRIORITY',
    version: PIPELINE_BOOTSTRAP_TAXONOMY_VERSION,
    allowedValueType: 'ENUM',
    allowedValues: NORMALIZED_PRIORITY_VALUES,
    semanticDescription:
      'Normalized priority band without narrative or recommendation.',
    normalization: 'UPPER_SNAKE_CASE',
    allowedPolarities: ['AFFIRMED', 'NEGATED', 'UNCERTAIN'] as const,
    allowMultipleFacts: false,
    conflictPolicy: PIPELINE_BOOTSTRAP_DEFAULT_CONFLICT_POLICY,
    rejectUnknownValues: true,
  }),
});

export function isPipelineBootstrapValueType(
  value: unknown
): value is PipelineBootstrapValueType {
  return (
    typeof value === 'string' &&
    PIPELINE_BOOTSTRAP_VALUE_TYPES.some((candidate) => candidate === value)
  );
}

export function isPipelineBootstrapTaxonomyCategory(
  value: unknown
): value is PipelineBootstrapTaxonomyCategory {
  return (
    typeof value === 'string' &&
    PIPELINE_BOOTSTRAP_TAXONOMY_CATEGORIES.some(
      (candidate) => candidate === value
    )
  );
}

export function getPipelineBootstrapTaxonomyEntry(
  category: PipelineBootstrapTaxonomyCategory
): PipelineBootstrapTaxonomyEntry {
  return PIPELINE_BOOTSTRAP_TAXONOMY[category];
}
