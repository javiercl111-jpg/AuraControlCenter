import {
  PIPELINE_BOOTSTRAP_ERROR_CODES,
  createPipelineBootstrapError,
  type PipelineBootstrapError,
  type PipelineBootstrapErrorCode,
  type PipelineBootstrapValidationResult,
} from './errors';
import type { EnterpriseEvidence } from '../../enterprise-model/domain/evidence';
import type { EnterpriseMentalModel } from '../../enterprise-model/domain/types';
import type { EnterpriseKnowledgeGraph } from '../../enterprise-model/graph/domain/types';
import { validateGraphIntegrity } from '../../enterprise-model/graph/domain/invariants';
import {
  getPipelineBootstrapTaxonomyEntry,
  isPipelineBootstrapTaxonomyCategory,
  isPipelineBootstrapValueType,
  PIPELINE_BOOTSTRAP_DEFAULT_CONFLICT_POLICY,
  PIPELINE_BOOTSTRAP_TAXONOMY_VERSION,
  type PipelineBootstrapTaxonomyCategory,
  type PipelineBootstrapValueType,
} from './taxonomy';
import {
  getPipelineBootstrapProvenanceMatrixEntry,
  isPipelineBootstrapActorType,
  isPipelineBootstrapCollectionMethod,
  isPipelineBootstrapDirectness,
  isPipelineBootstrapPolarity,
  isPipelineBootstrapReliability,
  isPipelineBootstrapSourceType,
  type PipelineBootstrapDirectness,
  type PipelineBootstrapPolarity,
  type PipelineBootstrapProvenance,
  type PipelineBootstrapReliability,
} from './provenance';
import {
  PIPELINE_BOOTSTRAP_REQUESTABLE_STAGES,
  PIPELINE_BOOTSTRAP_SCENARIO_REGISTRY,
  PIPELINE_BOOTSTRAP_SCENARIO_IDS,
  PIPELINE_BOOTSTRAP_SCENARIO_SOURCES,
  PIPELINE_BOOTSTRAP_SCENARIO_VERSION,
  PIPELINE_BOOTSTRAP_SCHEMA_VERSION,
  PIPELINE_BOOTSTRAP_VERSION,
  type BootstrapAcceptedState,
  type BootstrapRejectedState,
  type PipelineBootstrapContext,
  type PipelineBootstrapFact,
  type PipelineBootstrapInput,
  type PipelineBootstrapPolicy,
  type PipelineBootstrapProvenanceSummary,
  type PipelineBootstrapState,
  type PipelineBootstrapTargetScenario,
  type PipelineInitialDomainState,
  type PipelineInitialEvidence,
  type PipelineScenarioDescriptor,
} from './types';

const SAFE_IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/|-]{0,179}$/;
const ENUM_VALUE_PATTERN = /^[A-Z0-9][A-Z0-9_]{0,63}$/;
const LOCALE_PATTERN = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;
const TIMEZONE_PATTERN =
  /^(?:UTC|[A-Za-z_]+(?:\/[A-Za-z0-9_+.-]+)+)$/;

const FACT_KEYS = [
  'factId',
  'category',
  'value',
  'valueType',
  'provenance',
  'reliability',
  'directness',
  'polarity',
  'observedAt',
  'schemaVersion',
] as const;

const PROVENANCE_KEYS = [
  'sourceType',
  'sourceId',
  'collectionMethod',
  'capturedAt',
  'reliability',
  'directness',
  'actorType',
  'tenantId',
  'correlationId',
  'inferenceRuleId',
] as const;

const SCENARIO_KEYS = [
  'scenarioId',
  'scenarioVersion',
  'objectiveKey',
  'requestedStages',
  'source',
  'explicitSelection',
] as const;

const REQUESTER_KEYS = ['requesterId', 'actorType'] as const;

const CONTEXT_KEYS = [
  'requestedAt',
  'requestedBy',
  'locale',
  'timezone',
  'source',
] as const;

const POLICY_KEYS = [
  'allowedTaxonomyVersion',
  'allowedScenarioVersion',
  'allowUnknownReliability',
  'allowUncertainPolarity',
  'allowInferredDirectness',
  'allowedInferenceRuleIds',
  'maxFacts',
  'maxFactValueSize',
  'maxTotalPayloadSize',
  'duplicateFactPolicy',
  'conflictPolicy',
  'failClosed',
  'requireExplicitScenario',
] as const;

const INPUT_KEYS = [
  'bootstrapId',
  'tenantId',
  'correlationId',
  'targetScenario',
  'facts',
  'context',
  'policy',
  'schemaVersion',
] as const;

const SCENARIO_DESCRIPTOR_KEYS = [
  'scenarioId',
  'scenarioVersion',
  'objectiveKey',
  'requestedStages',
  'allowedStages',
  'requiredStages',
  'stageDependencies',
  'includedDomains',
  'excludedDomains',
  'source',
  'explicitSelection',
] as const;

const INITIAL_EVIDENCE_KEYS = ['sourceFact', 'appliedEvidence'] as const;

const INITIAL_DOMAIN_STATE_KEYS = [
  'mentalModel',
  'knowledgeGraph',
  'evidence',
  'scenario',
  'bootstrapId',
  'tenantId',
  'correlationId',
  'createdAt',
  'schemaVersion',
] as const;

const ACCEPTED_STATE_KEYS = [
  'status',
  'bootstrapId',
  'tenantId',
  'correlationId',
  'initialDomainState',
  'provenanceSummary',
  'bootstrapVersion',
  'createdAt',
] as const;

const REJECTED_STATE_KEYS = [
  'status',
  'bootstrapId',
  'tenantId',
  'correlationId',
  'errors',
  'bootstrapVersion',
  'createdAt',
] as const;

const PROVENANCE_SUMMARY_KEYS = [
  'factCount',
  'sourceTypes',
  'earliestObservedAt',
  'latestObservedAt',
] as const;

const PUBLIC_ERROR_KEYS = ['code', 'message', 'retryable'] as const;

const MENTAL_MODEL_KEYS = [
  'identity',
  'strategicContext',
  'evidences',
  'domains',
  'processes',
  'painPoints',
  'risks',
  'capabilities',
  'objectives',
  'constraints',
  'hypotheses',
  'knowledgeGaps',
  'productApplicability',
] as const;

const IDENTITY_KEYS = [
  'organizationName',
  'industry',
  'subindustry',
  'size',
  'employeeRange',
  'locations',
  'operatingRegions',
  'businessModel',
] as const;

const STRATEGIC_CONTEXT_KEYS = [
  'transformationObjectives',
  'growthObjectives',
  'executivePriorities',
  'constraints',
  'urgency',
  'timeHorizon',
] as const;

const ENTERPRISE_EVIDENCE_KEYS = [
  'evidenceId',
  'sessionId',
  'turnId',
  'source',
  'sourceType',
  'originalText',
  'normalizedStatement',
  'category',
  'entityRefs',
  'capturedAt',
  'reliability',
  'directness',
  'polarity',
  'extractorVersion',
  'metadata',
] as const;

const KNOWLEDGE_GRAPH_KEYS = ['nodes', 'relationships'] as const;

type SafeRecord = Record<string, unknown>;
type PipelineBootstrapFactValue = PipelineBootstrapFact['value'];

function valid<T>(value: T): PipelineBootstrapValidationResult<T> {
  return {
    valid: true,
    value,
    errors: [],
  };
}

function invalid<T>(
  ...errors: readonly PipelineBootstrapError[]
): PipelineBootstrapValidationResult<T> {
  return {
    valid: false,
    errors,
  };
}

function error(
  code: PipelineBootstrapErrorCode,
  message: string
): PipelineBootstrapError {
  return createPipelineBootstrapError(code, message);
}

function getSafeRecord(
  value: unknown,
  allowedKeys: readonly string[]
): SafeRecord | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined;
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return undefined;
  }

  const ownKeys = Reflect.ownKeys(value);
  for (const ownKey of ownKeys) {
    if (typeof ownKey !== 'string' || !allowedKeys.includes(ownKey)) {
      return undefined;
    }

    const descriptor = Object.getOwnPropertyDescriptor(value, ownKey);
    if (
      !descriptor ||
      !descriptor.enumerable ||
      !Object.prototype.hasOwnProperty.call(descriptor, 'value')
    ) {
      return undefined;
    }
  }

  return value as SafeRecord;
}

function getPlainRecord(value: unknown): SafeRecord | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined;
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return undefined;
  }

  for (const ownKey of Reflect.ownKeys(value)) {
    if (typeof ownKey !== 'string') {
      return undefined;
    }

    const descriptor = Object.getOwnPropertyDescriptor(value, ownKey);
    if (
      !descriptor ||
      !descriptor.enumerable ||
      !Object.prototype.hasOwnProperty.call(descriptor, 'value')
    ) {
      return undefined;
    }
  }

  return value as SafeRecord;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isStringArray(value: unknown): value is readonly string[] {
  return (
    Array.isArray(value) &&
    value.every((item) => typeof item === 'string')
  );
}

function isFiniteUnitInterval(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1
  );
}

function sameOrderedStrings(
  left: readonly string[],
  right: readonly string[]
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function isEnterpriseMentalModelShape(
  value: unknown
): value is EnterpriseMentalModel {
  const record = getSafeRecord(value, MENTAL_MODEL_KEYS);
  if (!record) {
    return false;
  }

  const identity = getSafeRecord(record.identity, IDENTITY_KEYS);
  const strategicContext = getSafeRecord(
    record.strategicContext,
    STRATEGIC_CONTEXT_KEYS
  );
  if (!identity || !strategicContext) {
    return false;
  }

  const identityIsValid =
    isNullableString(identity.organizationName) &&
    isNullableString(identity.industry) &&
    isNullableString(identity.subindustry) &&
    isNullableString(identity.size) &&
    isNullableString(identity.employeeRange) &&
    (identity.locations === null || isStringArray(identity.locations)) &&
    (identity.operatingRegions === null ||
      isStringArray(identity.operatingRegions)) &&
    isNullableString(identity.businessModel);

  const strategicContextIsValid =
    isStringArray(strategicContext.transformationObjectives) &&
    isStringArray(strategicContext.growthObjectives) &&
    isStringArray(strategicContext.executivePriorities) &&
    isStringArray(strategicContext.constraints) &&
    isNullableString(strategicContext.urgency) &&
    isNullableString(strategicContext.timeHorizon);

  const collectionKeys = MENTAL_MODEL_KEYS.filter(
    (key) => key !== 'identity' && key !== 'strategicContext'
  );
  const collectionsAreValid = collectionKeys.every(
    (key) => getPlainRecord(record[key]) !== undefined
  );

  return identityIsValid && strategicContextIsValid && collectionsAreValid;
}

function isEnterpriseKnowledgeGraphShape(
  value: unknown
): value is EnterpriseKnowledgeGraph {
  const record = getSafeRecord(value, KNOWLEDGE_GRAPH_KEYS);
  if (
    !record ||
    !getPlainRecord(record.nodes) ||
    !getPlainRecord(record.relationships)
  ) {
    return false;
  }

  try {
    validateGraphIntegrity(record as unknown as EnterpriseKnowledgeGraph);
    return true;
  } catch {
    return false;
  }
}

function isCanonicalEnterpriseEvidence(
  value: unknown
): value is EnterpriseEvidence {
  const record = getSafeRecord(value, ENTERPRISE_EVIDENCE_KEYS);
  const metadata = record ? getPlainRecord(record.metadata) : undefined;
  if (!record || !metadata || Object.keys(metadata).length > 0) {
    return false;
  }

  return (
    isSafeIdentifier(record.evidenceId) &&
    isSafeIdentifier(record.sessionId) &&
    isSafeIdentifier(record.turnId) &&
    typeof record.source === 'string' &&
    record.source === record.source.trim() &&
    record.source.length > 0 &&
    isPipelineBootstrapSourceType(record.sourceType) &&
    record.originalText === null &&
    typeof record.normalizedStatement === 'string' &&
    record.normalizedStatement === record.normalizedStatement.trim() &&
    record.normalizedStatement.length > 0 &&
    typeof record.category === 'string' &&
    record.category.length > 0 &&
    isStringArray(record.entityRefs) &&
    !containsDuplicateStrings(record.entityRefs) &&
    typeof record.capturedAt === 'number' &&
    Number.isFinite(record.capturedAt) &&
    isFiniteUnitInterval(record.reliability) &&
    isFiniteUnitInterval(record.directness) &&
    (record.polarity === 'POSITIVE' || record.polarity === 'NEGATIVE') &&
    isSafeIdentifier(record.extractorVersion)
  );
}

function sameCanonicalEvidence(
  left: EnterpriseEvidence,
  right: EnterpriseEvidence
): boolean {
  return (
    left.evidenceId === right.evidenceId &&
    left.sessionId === right.sessionId &&
    left.turnId === right.turnId &&
    left.source === right.source &&
    left.sourceType === right.sourceType &&
    left.originalText === right.originalText &&
    left.normalizedStatement === right.normalizedStatement &&
    left.category === right.category &&
    sameOrderedStrings(left.entityRefs, right.entityRefs) &&
    left.capturedAt === right.capturedAt &&
    left.reliability === right.reliability &&
    left.directness === right.directness &&
    left.polarity === right.polarity &&
    left.extractorVersion === right.extractorVersion &&
    Object.keys(left.metadata).length === 0 &&
    Object.keys(right.metadata).length === 0
  );
}

function isSafeIdentifier(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value === value.trim() &&
    SAFE_IDENTIFIER_PATTERN.test(value)
  );
}

function isFinitePositiveInteger(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value > 0
  );
}

function measureJsonBytes(value: unknown): number | undefined {
  try {
    const serialized = JSON.stringify(value);
    if (typeof serialized !== 'string') {
      return undefined;
    }
    return new TextEncoder().encode(serialized).byteLength;
  } catch {
    return undefined;
  }
}

function containsDuplicateStrings(values: readonly string[]): boolean {
  return new Set(values).size !== values.length;
}

function validateSafeIdentifier(
  value: unknown,
  label: string,
  code: PipelineBootstrapErrorCode
): PipelineBootstrapValidationResult<string> {
  if (!isSafeIdentifier(value)) {
    return invalid(error(code, `${label} is invalid`));
  }
  return valid(value);
}

export function validatePipelineBootstrapSchemaVersion(
  value: unknown
): PipelineBootstrapValidationResult<
  typeof PIPELINE_BOOTSTRAP_SCHEMA_VERSION
> {
  if (value !== PIPELINE_BOOTSTRAP_SCHEMA_VERSION) {
    return invalid(
      error(
        'UNSUPPORTED_SCHEMA_VERSION',
        'Pipeline bootstrap schema version is unsupported'
      )
    );
  }
  return valid(PIPELINE_BOOTSTRAP_SCHEMA_VERSION);
}

export function validatePipelineBootstrapTimestamp(
  value: unknown
): PipelineBootstrapValidationResult<number> {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value < 0
  ) {
    return invalid(
      error('INVALID_BOOTSTRAP_INPUT', 'Bootstrap timestamp is invalid')
    );
  }
  return valid(value);
}

export function validatePipelineBootstrapId(
  value: unknown
): PipelineBootstrapValidationResult<string> {
  return validateSafeIdentifier(
    value,
    'Bootstrap identifier',
    'INVALID_BOOTSTRAP_INPUT'
  );
}

export function validatePipelineBootstrapTenantId(
  value: unknown
): PipelineBootstrapValidationResult<string> {
  return validateSafeIdentifier(
    value,
    'Tenant identifier',
    'INVALID_BOOTSTRAP_INPUT'
  );
}

export function validatePipelineBootstrapCorrelationId(
  value: unknown
): PipelineBootstrapValidationResult<string> {
  return validateSafeIdentifier(
    value,
    'Correlation identifier',
    'INVALID_BOOTSTRAP_INPUT'
  );
}

export function validatePipelineBootstrapFactId(
  value: unknown
): PipelineBootstrapValidationResult<string> {
  return validateSafeIdentifier(
    value,
    'Fact identifier',
    'INVALID_BOOTSTRAP_INPUT'
  );
}

export function validatePipelineBootstrapTaxonomyCategory(
  value: unknown
): PipelineBootstrapValidationResult<PipelineBootstrapTaxonomyCategory> {
  if (!isPipelineBootstrapTaxonomyCategory(value)) {
    return invalid(
      error(
        'UNKNOWN_TAXONOMY_CATEGORY',
        'Bootstrap fact taxonomy category is unknown'
      )
    );
  }
  return valid(value);
}

export function validatePipelineBootstrapReliability(
  value: unknown,
  allowUnknown: boolean
): PipelineBootstrapValidationResult<PipelineBootstrapReliability> {
  if (!isPipelineBootstrapReliability(value)) {
    return invalid(
      error('INVALID_PROVENANCE', 'Bootstrap reliability is invalid')
    );
  }
  if (value === 'UNKNOWN' && !allowUnknown) {
    return invalid(
      error(
        'INVALID_PROVENANCE',
        'Unknown bootstrap reliability is not allowed'
      )
    );
  }
  return valid(value);
}

export function validatePipelineBootstrapDirectness(
  value: unknown,
  allowInferred: boolean
): PipelineBootstrapValidationResult<PipelineBootstrapDirectness> {
  if (!isPipelineBootstrapDirectness(value)) {
    return invalid(
      error('INVALID_PROVENANCE', 'Bootstrap directness is invalid')
    );
  }
  if (value === 'INFERRED' && !allowInferred) {
    return invalid(
      error(
        'INVALID_PROVENANCE',
        'Inferred bootstrap evidence is not allowed'
      )
    );
  }
  return valid(value);
}

export function validatePipelineBootstrapPolarity(
  value: unknown,
  allowUncertain: boolean
): PipelineBootstrapValidationResult<PipelineBootstrapPolarity> {
  if (!isPipelineBootstrapPolarity(value)) {
    return invalid(
      error('INVALID_FACT_VALUE', 'Bootstrap fact polarity is invalid')
    );
  }
  if (value === 'UNCERTAIN' && !allowUncertain) {
    return invalid(
      error(
        'INVALID_FACT_VALUE',
        'Uncertain bootstrap fact polarity is not allowed'
      )
    );
  }
  return valid(value);
}

export function validatePipelineBootstrapPolicy(
  value: unknown
): PipelineBootstrapValidationResult<PipelineBootstrapPolicy> {
  const record = getSafeRecord(value, POLICY_KEYS);
  if (!record) {
    return invalid(
      error('INVALID_BOOTSTRAP_INPUT', 'Bootstrap policy is invalid')
    );
  }

  const errors: PipelineBootstrapError[] = [];

  if (
    record.allowedTaxonomyVersion !== PIPELINE_BOOTSTRAP_TAXONOMY_VERSION
  ) {
    errors.push(
      error(
        'UNSUPPORTED_SCHEMA_VERSION',
        'Bootstrap taxonomy version is unsupported'
      )
    );
  }

  if (
    record.allowedScenarioVersion !==
    PIPELINE_BOOTSTRAP_SCENARIO_VERSION
  ) {
    errors.push(
      error(
        'INVALID_TARGET_SCENARIO',
        'Allowed scenario version is invalid'
      )
    );
  }

  if (typeof record.allowUnknownReliability !== 'boolean') {
    errors.push(
      error(
        'INVALID_BOOTSTRAP_INPUT',
        'Unknown reliability policy is invalid'
      )
    );
  }
  if (typeof record.allowUncertainPolarity !== 'boolean') {
    errors.push(
      error(
        'INVALID_BOOTSTRAP_INPUT',
        'Uncertain polarity policy is invalid'
      )
    );
  }
  if (typeof record.allowInferredDirectness !== 'boolean') {
    errors.push(
      error(
        'INVALID_BOOTSTRAP_INPUT',
        'Inferred directness policy is invalid'
      )
    );
  }

  if (
    !Array.isArray(record.allowedInferenceRuleIds) ||
    !record.allowedInferenceRuleIds.every(isSafeIdentifier) ||
    containsDuplicateStrings(
      record.allowedInferenceRuleIds.filter(
        (ruleId): ruleId is string => typeof ruleId === 'string'
      )
    )
  ) {
    errors.push(
      error(
        'INVALID_BOOTSTRAP_INPUT',
        'Allowed inference rule identifiers are invalid'
      )
    );
  } else if (
    record.allowInferredDirectness === true &&
    record.allowedInferenceRuleIds.length === 0
  ) {
    errors.push(
      error(
        'INVALID_BOOTSTRAP_INPUT',
        'Inferred directness requires an explicit inference rule'
      )
    );
  } else if (
    record.allowInferredDirectness === false &&
    record.allowedInferenceRuleIds.length > 0
  ) {
    errors.push(
      error(
        'INVALID_BOOTSTRAP_INPUT',
        'Inference rules require inferred directness to be enabled'
      )
    );
  }

  if (!isFinitePositiveInteger(record.maxFacts)) {
    errors.push(
      error('INVALID_BOOTSTRAP_INPUT', 'Maximum fact count is invalid')
    );
  }
  if (!isFinitePositiveInteger(record.maxFactValueSize)) {
    errors.push(
      error('INVALID_BOOTSTRAP_INPUT', 'Maximum fact value size is invalid')
    );
  }
  if (!isFinitePositiveInteger(record.maxTotalPayloadSize)) {
    errors.push(
      error('INVALID_BOOTSTRAP_INPUT', 'Maximum payload size is invalid')
    );
  }
  if (record.duplicateFactPolicy !== 'REJECT') {
    errors.push(
      error(
        'INVALID_BOOTSTRAP_INPUT',
        'Duplicate fact policy must reject duplicates'
      )
    );
  }
  if (record.conflictPolicy !== PIPELINE_BOOTSTRAP_DEFAULT_CONFLICT_POLICY) {
    errors.push(
      error(
        'INVALID_BOOTSTRAP_INPUT',
        'Bootstrap conflict policy must reject conflicts'
      )
    );
  }
  if (record.failClosed !== true) {
    errors.push(
      error('INVALID_BOOTSTRAP_INPUT', 'Bootstrap policy must fail closed')
    );
  }
  if (record.requireExplicitScenario !== true) {
    errors.push(
      error(
        'INVALID_BOOTSTRAP_INPUT',
        'Bootstrap policy must require an explicit scenario'
      )
    );
  }

  if (errors.length > 0) {
    return invalid(...errors);
  }

  return valid(record as unknown as PipelineBootstrapPolicy);
}

export function validatePipelineBootstrapProvenance(
  value: unknown,
  policy: PipelineBootstrapPolicy
): PipelineBootstrapValidationResult<PipelineBootstrapProvenance> {
  const record = getSafeRecord(value, PROVENANCE_KEYS);
  if (!record) {
    return invalid(
      error('INVALID_PROVENANCE', 'Bootstrap provenance is invalid')
    );
  }

  const errors: PipelineBootstrapError[] = [];

  if (!isPipelineBootstrapSourceType(record.sourceType)) {
    errors.push(
      error('INVALID_PROVENANCE', 'Bootstrap provenance source type is invalid')
    );
  }
  if (!isSafeIdentifier(record.sourceId)) {
    errors.push(
      error('INVALID_PROVENANCE', 'Bootstrap provenance source is invalid')
    );
  }
  if (!isPipelineBootstrapCollectionMethod(record.collectionMethod)) {
    errors.push(
      error('INVALID_PROVENANCE', 'Bootstrap collection method is invalid')
    );
  }

  const capturedAtResult = validatePipelineBootstrapTimestamp(
    record.capturedAt
  );
  if (!capturedAtResult.valid) {
    errors.push(
      error('INVALID_PROVENANCE', 'Bootstrap capture timestamp is invalid')
    );
  }

  const reliabilityResult = validatePipelineBootstrapReliability(
    record.reliability,
    policy.allowUnknownReliability
  );
  if (!reliabilityResult.valid) {
    errors.push(...reliabilityResult.errors);
  }

  const directnessResult = validatePipelineBootstrapDirectness(
    record.directness,
    policy.allowInferredDirectness
  );
  if (!directnessResult.valid) {
    errors.push(...directnessResult.errors);
  }

  if (!isPipelineBootstrapActorType(record.actorType)) {
    errors.push(
      error('INVALID_PROVENANCE', 'Bootstrap actor type is invalid')
    );
  }
  if (!isSafeIdentifier(record.tenantId)) {
    errors.push(
      error('INVALID_PROVENANCE', 'Bootstrap provenance tenant is invalid')
    );
  }
  if (!isSafeIdentifier(record.correlationId)) {
    errors.push(
      error(
        'INVALID_PROVENANCE',
        'Bootstrap provenance correlation is invalid'
      )
    );
  }

  const isInferred = record.directness === 'INFERRED';
  if (isInferred) {
    if (
      !isSafeIdentifier(record.inferenceRuleId) ||
      !policy.allowedInferenceRuleIds.includes(record.inferenceRuleId)
    ) {
      errors.push(
        error(
          'INVALID_PROVENANCE',
          'Inferred provenance requires an allowed inference rule'
        )
      );
    }
    if (record.sourceType !== 'DERIVED_INFERENCE') {
      errors.push(
        error(
          'INVALID_PROVENANCE',
          'Inferred provenance requires the canonical derived source type'
        )
      );
    }
  } else {
    if (record.inferenceRuleId !== undefined) {
      errors.push(
        error(
          'INVALID_PROVENANCE',
          'Inference rule is not allowed for non-inferred provenance'
        )
      );
    }
    if (record.sourceType === 'DERIVED_INFERENCE') {
      errors.push(
        error(
          'INVALID_PROVENANCE',
          'Derived source type requires inferred directness'
        )
      );
    }
  }

  if (isPipelineBootstrapSourceType(record.sourceType)) {
    const matrixEntry = getPipelineBootstrapProvenanceMatrixEntry(
      record.sourceType
    );
    if (
      !isPipelineBootstrapCollectionMethod(record.collectionMethod) ||
      !matrixEntry.collectionMethods.includes(record.collectionMethod)
    ) {
      errors.push(
        error(
          'INVALID_PROVENANCE',
          'Bootstrap source and collection method combination is invalid'
        )
      );
    }
    if (
      !isPipelineBootstrapActorType(record.actorType) ||
      !matrixEntry.actorTypes.includes(record.actorType)
    ) {
      errors.push(
        error(
          'INVALID_PROVENANCE',
          'Bootstrap source and actor combination is invalid'
        )
      );
    }
    if (
      !isPipelineBootstrapDirectness(record.directness) ||
      !matrixEntry.directnessLevels.includes(record.directness)
    ) {
      errors.push(
        error(
          'INVALID_PROVENANCE',
          'Bootstrap source and directness combination is invalid'
        )
      );
    }
  }

  if (errors.length > 0) {
    return invalid(...errors);
  }

  return valid(record as unknown as PipelineBootstrapProvenance);
}

export function validatePipelineBootstrapTargetScenario(
  value: unknown,
  policy: PipelineBootstrapPolicy
): PipelineBootstrapValidationResult<PipelineBootstrapTargetScenario> {
  if (value === undefined || value === null) {
    return invalid(
      error('TARGET_SCENARIO_REQUIRED', 'Bootstrap target scenario is required')
    );
  }

  const record = getSafeRecord(value, SCENARIO_KEYS);
  if (!record) {
    return invalid(
      error('INVALID_TARGET_SCENARIO', 'Bootstrap target scenario is invalid')
    );
  }

  const errors: PipelineBootstrapError[] = [];

  const scenarioId =
    typeof record.scenarioId !== 'string' ||
    !PIPELINE_BOOTSTRAP_SCENARIO_IDS.some(
      (candidate) => candidate === record.scenarioId
    )
      ? undefined
      : PIPELINE_BOOTSTRAP_SCENARIO_IDS.find(
          (candidate) => candidate === record.scenarioId
        );

  if (!scenarioId) {
    errors.push(
      error('INVALID_TARGET_SCENARIO', 'Bootstrap scenario is unknown')
    );
  }

  const registryEntry = scenarioId
    ? PIPELINE_BOOTSTRAP_SCENARIO_REGISTRY[scenarioId]
    : undefined;

  if (
    record.scenarioVersion !== PIPELINE_BOOTSTRAP_SCENARIO_VERSION ||
    record.scenarioVersion !== policy.allowedScenarioVersion ||
    (registryEntry !== undefined &&
      record.scenarioVersion !== registryEntry.version)
  ) {
    errors.push(
      error('INVALID_TARGET_SCENARIO', 'Bootstrap scenario version is invalid')
    );
  }
  if (
    !registryEntry ||
    record.objectiveKey !== registryEntry.objectiveKey
  ) {
    errors.push(
      error(
        'INVALID_TARGET_SCENARIO',
        'Bootstrap scenario objective key is invalid'
      )
    );
  }
  if (
    typeof record.source !== 'string' ||
    !PIPELINE_BOOTSTRAP_SCENARIO_SOURCES.some(
      (source) => source === record.source
    )
  ) {
    errors.push(
      error('INVALID_TARGET_SCENARIO', 'Bootstrap scenario source is invalid')
    );
  }
  if (record.explicitSelection !== true) {
    errors.push(
      error(
        'TARGET_SCENARIO_REQUIRED',
        'Bootstrap scenario must be selected explicitly'
      )
    );
  }

  if (record.requestedStages !== undefined) {
    const requestedStagesInvalid =
      !Array.isArray(record.requestedStages) ||
      record.requestedStages.length === 0 ||
      !record.requestedStages.every(
        (stage) =>
          typeof stage === 'string' &&
          PIPELINE_BOOTSTRAP_REQUESTABLE_STAGES.some(
            (candidate) => candidate === stage
          )
      ) ||
      containsDuplicateStrings(
        record.requestedStages.filter(
          (stage): stage is string => typeof stage === 'string'
        )
      );

    if (requestedStagesInvalid) {
      errors.push(
        error(
          'INVALID_TARGET_SCENARIO',
          'Bootstrap requested stages are invalid'
        )
      );
    } else if (
      registryEntry &&
      Array.isArray(record.requestedStages)
    ) {
      const requestedStageCandidates: readonly unknown[] =
        record.requestedStages;
      const requestedStages = requestedStageCandidates.filter(
        (stage): stage is (typeof PIPELINE_BOOTSTRAP_REQUESTABLE_STAGES)[number] =>
          typeof stage === 'string' &&
          PIPELINE_BOOTSTRAP_REQUESTABLE_STAGES.some(
            (candidate) => candidate === stage
          )
      );

      if (
        requestedStages.some(
          (stage) => !registryEntry.allowedStages.includes(stage)
        ) ||
        registryEntry.requiredStages.some(
          (stage) => !requestedStages.includes(stage)
        )
      ) {
        errors.push(
          error(
            'INVALID_TARGET_SCENARIO',
            'Bootstrap requested stages violate the scenario registry'
          )
        );
      }

      for (const stage of requestedStages) {
        const missingDependency =
          registryEntry.stageDependencies[stage].some(
            (dependency) => !requestedStages.includes(dependency)
          );
        if (missingDependency) {
          errors.push(
            error(
              'INVALID_TARGET_SCENARIO',
              'Bootstrap requested stage dependency is missing'
            )
          );
          break;
        }
      }
    }
  }

  if (errors.length > 0) {
    return invalid(...errors);
  }

  return valid(record as unknown as PipelineBootstrapTargetScenario);
}

export function validatePipelineScenarioDescriptor(
  value: unknown,
  policy: PipelineBootstrapPolicy
): PipelineBootstrapValidationResult<PipelineScenarioDescriptor> {
  const record = getSafeRecord(value, SCENARIO_DESCRIPTOR_KEYS);
  if (!record) {
    return invalid(
      error('INVALID_SCENARIO_DESCRIPTOR', 'Pipeline scenario descriptor is invalid')
    );
  }

  const targetResult = validatePipelineBootstrapTargetScenario(
    {
      scenarioId: record.scenarioId,
      scenarioVersion: record.scenarioVersion,
      objectiveKey: record.objectiveKey,
      requestedStages: record.requestedStages,
      source: record.source,
      explicitSelection: record.explicitSelection,
    },
    policy
  );
  if (!targetResult.valid || !Array.isArray(record.requestedStages)) {
    return invalid(
      error('INVALID_SCENARIO_DESCRIPTOR', 'Pipeline scenario descriptor is invalid')
    );
  }

  const registryEntry =
    PIPELINE_BOOTSTRAP_SCENARIO_REGISTRY[targetResult.value.scenarioId];
  const allowedStages = isStringArray(record.allowedStages)
    ? record.allowedStages
    : undefined;
  const requiredStages = isStringArray(record.requiredStages)
    ? record.requiredStages
    : undefined;
  const requestedStages = isStringArray(record.requestedStages)
    ? record.requestedStages
    : undefined;
  const includedDomains = isStringArray(record.includedDomains)
    ? record.includedDomains
    : undefined;
  const excludedDomains = isStringArray(record.excludedDomains)
    ? record.excludedDomains
    : undefined;
  const stageDependencies = getSafeRecord(
    record.stageDependencies,
    PIPELINE_BOOTSTRAP_REQUESTABLE_STAGES
  );

  const dependenciesMatch =
    stageDependencies !== undefined &&
    PIPELINE_BOOTSTRAP_REQUESTABLE_STAGES.every((stage) => {
      const dependencies = stageDependencies[stage];
      return (
        isStringArray(dependencies) &&
        sameOrderedStrings(
          dependencies,
          registryEntry.stageDependencies[stage]
        )
      );
    });

  if (
    !allowedStages ||
    !requiredStages ||
    !requestedStages ||
    !includedDomains ||
    !excludedDomains ||
    !sameOrderedStrings(allowedStages, registryEntry.allowedStages) ||
    !sameOrderedStrings(requiredStages, registryEntry.requiredStages) ||
    !sameOrderedStrings(requestedStages, targetResult.value.requestedStages ?? []) ||
    !sameOrderedStrings(includedDomains, registryEntry.includedDomains) ||
    !sameOrderedStrings(excludedDomains, registryEntry.excludedDomains) ||
    !dependenciesMatch
  ) {
    return invalid(
      error(
        'INVALID_SCENARIO_DESCRIPTOR',
        'Pipeline scenario descriptor diverges from the v1 registry'
      )
    );
  }

  return valid(record as unknown as PipelineScenarioDescriptor);
}

export function validatePipelineBootstrapContext(
  value: unknown
): PipelineBootstrapValidationResult<PipelineBootstrapContext> {
  const record = getSafeRecord(value, CONTEXT_KEYS);
  if (!record) {
    return invalid(
      error('INVALID_BOOTSTRAP_INPUT', 'Bootstrap context is invalid')
    );
  }

  const errors: PipelineBootstrapError[] = [];
  const requestedAtResult = validatePipelineBootstrapTimestamp(
    record.requestedAt
  );
  if (!requestedAtResult.valid) {
    errors.push(...requestedAtResult.errors);
  }

  const requester = getSafeRecord(record.requestedBy, REQUESTER_KEYS);
  if (
    !requester ||
    !isSafeIdentifier(requester.requesterId) ||
    !isPipelineBootstrapActorType(requester.actorType)
  ) {
    errors.push(
      error('INVALID_BOOTSTRAP_INPUT', 'Bootstrap requester is invalid')
    );
  }

  if (!isSafeIdentifier(record.source)) {
    errors.push(
      error('INVALID_BOOTSTRAP_INPUT', 'Bootstrap context source is invalid')
    );
  }
  if (
    record.locale !== undefined &&
    (typeof record.locale !== 'string' ||
      !LOCALE_PATTERN.test(record.locale))
  ) {
    errors.push(
      error('INVALID_BOOTSTRAP_INPUT', 'Bootstrap locale is invalid')
    );
  }
  if (
    record.timezone !== undefined &&
    (typeof record.timezone !== 'string' ||
      !TIMEZONE_PATTERN.test(record.timezone))
  ) {
    errors.push(
      error('INVALID_BOOTSTRAP_INPUT', 'Bootstrap timezone is invalid')
    );
  }

  if (errors.length > 0) {
    return invalid(...errors);
  }

  return valid(record as unknown as PipelineBootstrapContext);
}

export function validatePipelineBootstrapFactValue(
  valueType: unknown,
  value: unknown,
  category: unknown,
  policy: PipelineBootstrapPolicy
): PipelineBootstrapValidationResult<PipelineBootstrapFactValue> {
  if (!isPipelineBootstrapValueType(valueType)) {
    return invalid(
      error('INVALID_FACT_VALUE', 'Bootstrap fact value type is invalid')
    );
  }
  if (!isPipelineBootstrapTaxonomyCategory(category)) {
    return invalid(
      error(
        'UNKNOWN_TAXONOMY_CATEGORY',
        'Bootstrap fact taxonomy category is unknown'
      )
    );
  }

  const entry = getPipelineBootstrapTaxonomyEntry(category);
  if (entry.allowedValueType !== valueType) {
    return invalid(
      error(
        'INVALID_FACT_VALUE',
        'Bootstrap fact value type does not match its taxonomy'
      )
    );
  }

  let typeMatches = false;
  if (valueType === 'STRING') {
    typeMatches =
      typeof value === 'string' &&
      value === value.trim() &&
      value.length > 0;
  } else if (valueType === 'ENUM') {
    typeMatches =
      typeof value === 'string' &&
      ENUM_VALUE_PATTERN.test(value) &&
      entry.allowedValues.some((allowedValue) => allowedValue === value);
  } else if (valueType === 'BOOLEAN') {
    typeMatches =
      typeof value === 'boolean' &&
      entry.allowedValues.some((allowedValue) => allowedValue === value);
  } else if (valueType === 'NUMBER') {
    typeMatches = typeof value === 'number' && Number.isFinite(value);
  } else if (valueType === 'STRING_LIST') {
    typeMatches =
      Array.isArray(value) &&
      value.length > 0 &&
      value.every(
        (item) =>
          typeof item === 'string' &&
          item === item.trim() &&
          item.length > 0
      ) &&
      !containsDuplicateStrings(
        value.filter((item): item is string => typeof item === 'string')
      );
  }

  if (!typeMatches) {
    return invalid(
      error('INVALID_FACT_VALUE', 'Bootstrap fact value is invalid')
    );
  }

  const valueSize = measureJsonBytes(value);
  if (
    valueSize === undefined ||
    valueSize > policy.maxFactValueSize
  ) {
    return invalid(
      error('PAYLOAD_TOO_LARGE', 'Bootstrap fact value exceeds its limit')
    );
  }

  return valid(value as PipelineBootstrapFactValue);
}

export function validatePipelineBootstrapFact(
  value: unknown,
  policy: PipelineBootstrapPolicy
): PipelineBootstrapValidationResult<PipelineBootstrapFact> {
  const record = getSafeRecord(value, FACT_KEYS);
  if (!record) {
    return invalid(
      error('INVALID_BOOTSTRAP_INPUT', 'Bootstrap fact is invalid')
    );
  }

  const errors: PipelineBootstrapError[] = [];
  const factIdResult = validatePipelineBootstrapFactId(record.factId);
  const categoryResult = validatePipelineBootstrapTaxonomyCategory(
    record.category
  );
  const schemaResult = validatePipelineBootstrapSchemaVersion(
    record.schemaVersion
  );
  const provenanceResult = validatePipelineBootstrapProvenance(
    record.provenance,
    policy
  );
  const reliabilityResult = validatePipelineBootstrapReliability(
    record.reliability,
    policy.allowUnknownReliability
  );
  const directnessResult = validatePipelineBootstrapDirectness(
    record.directness,
    policy.allowInferredDirectness
  );
  const polarityResult = validatePipelineBootstrapPolarity(
    record.polarity,
    policy.allowUncertainPolarity
  );
  const observedAtResult = validatePipelineBootstrapTimestamp(
    record.observedAt
  );

  for (const result of [
    factIdResult,
    categoryResult,
    schemaResult,
    provenanceResult,
    reliabilityResult,
    directnessResult,
    polarityResult,
    observedAtResult,
  ]) {
    if (!result.valid) {
      errors.push(...result.errors);
    }
  }

  if (categoryResult.valid) {
    const taxonomyEntry = getPipelineBootstrapTaxonomyEntry(
      categoryResult.value
    );
    const valueResult = validatePipelineBootstrapFactValue(
      record.valueType,
      record.value,
      categoryResult.value,
      policy
    );
    if (!valueResult.valid) {
      errors.push(...valueResult.errors);
    }
    if (
      polarityResult.valid &&
      !taxonomyEntry.allowedPolarities.includes(polarityResult.value)
    ) {
      errors.push(
        error(
          'INVALID_FACT_VALUE',
          'Bootstrap fact polarity is not allowed by its taxonomy'
        )
      );
    }
  }

  if (provenanceResult.valid) {
    if (record.reliability !== provenanceResult.value.reliability) {
      errors.push(
        error(
          'INVALID_PROVENANCE',
          'Fact reliability must match provenance reliability'
        )
      );
    }
    if (record.directness !== provenanceResult.value.directness) {
      errors.push(
        error(
          'INVALID_PROVENANCE',
          'Fact directness must match provenance directness'
        )
      );
    }
    if (
      observedAtResult.valid &&
      observedAtResult.value > provenanceResult.value.capturedAt
    ) {
      errors.push(
        error(
          'INVALID_PROVENANCE',
          'Fact observation cannot occur after provenance capture'
        )
      );
    }
  }

  if (errors.length > 0) {
    return invalid(...errors);
  }

  return valid(record as unknown as PipelineBootstrapFact);
}

function canonicalFactMeaning(fact: PipelineBootstrapFact): string {
  return JSON.stringify([fact.value, fact.polarity]);
}

export function validatePipelineBootstrapFacts(
  value: unknown,
  policy: PipelineBootstrapPolicy,
  tenantId: string,
  correlationId: string
): PipelineBootstrapValidationResult<readonly PipelineBootstrapFact[]> {
  if (!Array.isArray(value) || value.length === 0) {
    return invalid(error('EMPTY_FACT_SET', 'Bootstrap facts are required'));
  }
  if (value.length > policy.maxFacts) {
    return invalid(
      error('TOO_MANY_FACTS', 'Bootstrap fact count exceeds its limit')
    );
  }

  const errors: PipelineBootstrapError[] = [];
  const facts: PipelineBootstrapFact[] = [];

  for (const candidate of value) {
    const factResult = validatePipelineBootstrapFact(candidate, policy);
    if (!factResult.valid) {
      errors.push(...factResult.errors);
      continue;
    }

    const fact = factResult.value;
    if (fact.provenance.tenantId !== tenantId) {
      errors.push(
        error(
          'TENANT_CONTEXT_MISMATCH',
          'Fact provenance tenant does not match bootstrap tenant'
        )
      );
    }
    if (fact.provenance.correlationId !== correlationId) {
      errors.push(
        error(
          'CORRELATION_CONTEXT_MISMATCH',
          'Fact provenance correlation does not match bootstrap correlation'
        )
      );
    }
    facts.push(fact);
  }

  const seenFactIds = new Set<string>();
  for (const fact of facts) {
    if (seenFactIds.has(fact.factId)) {
      errors.push(
        error('DUPLICATE_FACT_ID', 'Bootstrap fact identifier is duplicated')
      );
    }
    seenFactIds.add(fact.factId);
  }

  const factsByCategory = new Map<
    PipelineBootstrapTaxonomyCategory,
    PipelineBootstrapFact[]
  >();
  for (const fact of facts) {
    const categoryFacts = factsByCategory.get(fact.category) ?? [];
    categoryFacts.push(fact);
    factsByCategory.set(fact.category, categoryFacts);
  }

  for (const [category, categoryFacts] of factsByCategory.entries()) {
    if (categoryFacts.length <= 1) {
      continue;
    }

    const taxonomyEntry = getPipelineBootstrapTaxonomyEntry(category);
    if (!taxonomyEntry.allowMultipleFacts) {
      errors.push(
        error(
          'DUPLICATE_FACT_CONFLICT',
          'Bootstrap taxonomy does not allow multiple facts for this category'
        )
      );
      continue;
    }

    const distinctMeanings = new Set(
      categoryFacts.map(canonicalFactMeaning)
    );
    if (distinctMeanings.size > 1) {
      errors.push(
        error(
          'UNRESOLVED_FACT_CONFLICT',
          'Bootstrap facts contain an unresolved category conflict'
        )
      );
    }
  }

  if (errors.length > 0) {
    return invalid(...errors);
  }

  return valid(facts);
}

export function validatePipelineBootstrapInput(
  value: unknown
): PipelineBootstrapValidationResult<PipelineBootstrapInput> {
  const record = getSafeRecord(value, INPUT_KEYS);
  if (!record) {
    return invalid(
      error('INVALID_BOOTSTRAP_INPUT', 'Pipeline bootstrap input is invalid')
    );
  }

  const errors: PipelineBootstrapError[] = [];
  const bootstrapIdResult = validatePipelineBootstrapId(record.bootstrapId);
  const tenantIdResult = validatePipelineBootstrapTenantId(record.tenantId);
  const correlationIdResult = validatePipelineBootstrapCorrelationId(
    record.correlationId
  );
  const schemaResult = validatePipelineBootstrapSchemaVersion(
    record.schemaVersion
  );
  const policyResult = validatePipelineBootstrapPolicy(record.policy);
  const contextResult = validatePipelineBootstrapContext(record.context);

  for (const result of [
    bootstrapIdResult,
    tenantIdResult,
    correlationIdResult,
    schemaResult,
    policyResult,
    contextResult,
  ]) {
    if (!result.valid) {
      errors.push(...result.errors);
    }
  }

  if (
    policyResult.valid &&
    tenantIdResult.valid &&
    correlationIdResult.valid
  ) {
    const scenarioResult = validatePipelineBootstrapTargetScenario(
      record.targetScenario,
      policyResult.value
    );
    if (!scenarioResult.valid) {
      errors.push(...scenarioResult.errors);
    }

    const factsResult = validatePipelineBootstrapFacts(
      record.facts,
      policyResult.value,
      tenantIdResult.value,
      correlationIdResult.value
    );
    if (!factsResult.valid) {
      errors.push(...factsResult.errors);
    }
  }

  if (policyResult.valid && errors.length === 0) {
    const payloadSize = measureJsonBytes(value);
    if (
      payloadSize === undefined ||
      payloadSize > policyResult.value.maxTotalPayloadSize
    ) {
      errors.push(
        error(
          'PAYLOAD_TOO_LARGE',
          'Pipeline bootstrap input exceeds its payload limit'
        )
      );
    }
  }

  if (errors.length > 0) {
    return invalid(...errors);
  }

  return valid(record as unknown as PipelineBootstrapInput);
}

export function validatePipelineInitialEvidence(
  value: unknown,
  policy: PipelineBootstrapPolicy,
  tenantId: string,
  correlationId: string
): PipelineBootstrapValidationResult<PipelineInitialEvidence> {
  const record = getSafeRecord(value, INITIAL_EVIDENCE_KEYS);
  if (!record) {
    return invalid(
      error('INVALID_INITIAL_DOMAIN_STATE', 'Initial evidence envelope is invalid')
    );
  }

  const sourceFactResult = validatePipelineBootstrapFact(
    record.sourceFact,
    policy
  );
  if (!sourceFactResult.valid) {
    return invalid(...sourceFactResult.errors);
  }
  if (!isCanonicalEnterpriseEvidence(record.appliedEvidence)) {
    return invalid(
      error(
        'INVALID_INITIAL_DOMAIN_STATE',
        'Applied enterprise evidence is invalid'
      )
    );
  }

  const sourceFact = sourceFactResult.value;
  const appliedEvidence = record.appliedEvidence;
  const expectedPolarity =
    sourceFact.polarity === 'AFFIRMED'
      ? 'POSITIVE'
      : sourceFact.polarity === 'NEGATED'
        ? 'NEGATIVE'
        : undefined;

  if (
    sourceFact.provenance.tenantId !== tenantId ||
    sourceFact.provenance.correlationId !== correlationId
  ) {
    return invalid(
      error(
        'INITIAL_DOMAIN_CONTEXT_MISMATCH',
        'Initial evidence context does not match the domain state'
      )
    );
  }
  if (
    expectedPolarity === undefined ||
    appliedEvidence.polarity !== expectedPolarity ||
    appliedEvidence.sourceType !== sourceFact.provenance.sourceType ||
    appliedEvidence.capturedAt !== sourceFact.provenance.capturedAt ||
    appliedEvidence.category !== sourceFact.category
  ) {
    return invalid(
      error(
        'INVALID_INITIAL_DOMAIN_STATE',
        'Applied evidence diverges from its source fact'
      )
    );
  }

  return valid(record as unknown as PipelineInitialEvidence);
}

function validateProvenanceSummary(
  value: unknown,
  evidence: readonly PipelineInitialEvidence[]
): PipelineBootstrapValidationResult<PipelineBootstrapProvenanceSummary> {
  const record = getSafeRecord(value, PROVENANCE_SUMMARY_KEYS);
  if (!record || !Array.isArray(record.sourceTypes)) {
    return invalid(
      error('INVALID_INITIAL_DOMAIN_STATE', 'Provenance summary is invalid')
    );
  }

  const sourceTypes = record.sourceTypes.filter(isPipelineBootstrapSourceType);
  const expectedSourceTypes = Array.from(
    new Set(evidence.map((item) => item.sourceFact.provenance.sourceType))
  );
  const observedTimes = evidence.map((item) => item.sourceFact.observedAt);
  const expectedEarliest = Math.min(...observedTimes);
  const expectedLatest = Math.max(...observedTimes);

  if (
    sourceTypes.length !== record.sourceTypes.length ||
    containsDuplicateStrings(sourceTypes) ||
    record.factCount !== evidence.length ||
    !sameOrderedStrings(sourceTypes, expectedSourceTypes) ||
    record.earliestObservedAt !== expectedEarliest ||
    record.latestObservedAt !== expectedLatest
  ) {
    return invalid(
      error(
        'INVALID_INITIAL_DOMAIN_STATE',
        'Provenance summary diverges from initial evidence'
      )
    );
  }

  return valid(record as unknown as PipelineBootstrapProvenanceSummary);
}

export function validatePipelineInitialDomainState(
  value: unknown,
  policy: PipelineBootstrapPolicy
): PipelineBootstrapValidationResult<PipelineInitialDomainState> {
  const record = getSafeRecord(value, INITIAL_DOMAIN_STATE_KEYS);
  if (!record) {
    return invalid(
      error('INVALID_INITIAL_DOMAIN_STATE', 'Initial domain state is invalid')
    );
  }

  const errors: PipelineBootstrapError[] = [];
  const bootstrapIdResult = validatePipelineBootstrapId(record.bootstrapId);
  const tenantIdResult = validatePipelineBootstrapTenantId(record.tenantId);
  const correlationIdResult = validatePipelineBootstrapCorrelationId(
    record.correlationId
  );
  const createdAtResult = validatePipelineBootstrapTimestamp(record.createdAt);
  const schemaResult = validatePipelineBootstrapSchemaVersion(
    record.schemaVersion
  );
  const scenarioResult = validatePipelineScenarioDescriptor(
    record.scenario,
    policy
  );

  for (const result of [
    bootstrapIdResult,
    tenantIdResult,
    correlationIdResult,
    createdAtResult,
    schemaResult,
    scenarioResult,
  ]) {
    if (!result.valid) {
      errors.push(...result.errors);
    }
  }

  if (record.mentalModel === undefined) {
    errors.push(
      error(
        'MISSING_INITIAL_MENTAL_MODEL',
        'Initial domain state requires a mental model'
      )
    );
  } else if (!isEnterpriseMentalModelShape(record.mentalModel)) {
    errors.push(
      error('INVALID_INITIAL_DOMAIN_STATE', 'Initial mental model is invalid')
    );
  }

  if (record.knowledgeGraph === undefined) {
    errors.push(
      error(
        'MISSING_INITIAL_KNOWLEDGE_GRAPH',
        'Initial domain state requires a knowledge graph'
      )
    );
  } else if (!isEnterpriseKnowledgeGraphShape(record.knowledgeGraph)) {
    errors.push(
      error('INVALID_INITIAL_DOMAIN_STATE', 'Initial knowledge graph is invalid')
    );
  }

  const evidence: PipelineInitialEvidence[] = [];
  if (!Array.isArray(record.evidence) || record.evidence.length === 0) {
    errors.push(
      error('EMPTY_INITIAL_EVIDENCE', 'Initial domain evidence is required')
    );
  } else if (tenantIdResult.valid && correlationIdResult.valid) {
    for (const candidate of record.evidence) {
      const evidenceResult = validatePipelineInitialEvidence(
        candidate,
        policy,
        tenantIdResult.value,
        correlationIdResult.value
      );
      if (!evidenceResult.valid) {
        errors.push(...evidenceResult.errors);
      } else {
        evidence.push(evidenceResult.value);
      }
    }
  }

  if (evidence.length > 0) {
    const factIds = evidence.map((item) => item.sourceFact.factId);
    const evidenceIds = evidence.map(
      (item) => item.appliedEvidence.evidenceId
    );
    if (
      containsDuplicateStrings(factIds) ||
      containsDuplicateStrings(evidenceIds)
    ) {
      errors.push(
        error(
          'INVALID_INITIAL_DOMAIN_STATE',
          'Initial domain evidence identifiers must be unique'
        )
      );
    }
  }

  if (
    isEnterpriseMentalModelShape(record.mentalModel) &&
    evidence.length > 0
  ) {
    const mentalModel = record.mentalModel;
    const modelEvidenceIds = Object.keys(mentalModel.evidences);
    const appliedEvidenceIds = evidence.map(
      (item) => item.appliedEvidence.evidenceId
    );
    const modelEvidenceMatches =
      modelEvidenceIds.length === appliedEvidenceIds.length &&
      evidence.every((item) => {
        const modelEvidence =
          mentalModel.evidences[item.appliedEvidence.evidenceId];
        return (
          modelEvidence !== undefined &&
          isCanonicalEnterpriseEvidence(modelEvidence) &&
          sameCanonicalEvidence(modelEvidence, item.appliedEvidence)
        );
      });
    if (!modelEvidenceMatches) {
      errors.push(
        error(
          'INVALID_INITIAL_DOMAIN_STATE',
          'Mental model evidence diverges from initial evidence'
        )
      );
    }
  }

  if (errors.length > 0) {
    return invalid(...errors);
  }

  return valid(record as unknown as PipelineInitialDomainState);
}

export function validateBootstrapAcceptedState(
  value: unknown,
  policy: PipelineBootstrapPolicy
): PipelineBootstrapValidationResult<BootstrapAcceptedState> {
  const record = getSafeRecord(value, ACCEPTED_STATE_KEYS);
  if (!record || record.status !== 'ACCEPTED') {
    return invalid(
      error('INVALID_INITIAL_DOMAIN_STATE', 'Accepted bootstrap state is invalid')
    );
  }

  const errors: PipelineBootstrapError[] = [];
  const bootstrapIdResult = validatePipelineBootstrapId(record.bootstrapId);
  const tenantIdResult = validatePipelineBootstrapTenantId(record.tenantId);
  const correlationIdResult = validatePipelineBootstrapCorrelationId(
    record.correlationId
  );
  const createdAtResult = validatePipelineBootstrapTimestamp(record.createdAt);
  const initialDomainResult = validatePipelineInitialDomainState(
    record.initialDomainState,
    policy
  );

  for (const result of [
    bootstrapIdResult,
    tenantIdResult,
    correlationIdResult,
    createdAtResult,
    initialDomainResult,
  ]) {
    if (!result.valid) {
      errors.push(...result.errors);
    }
  }

  if (record.bootstrapVersion !== PIPELINE_BOOTSTRAP_VERSION) {
    errors.push(
      error(
        'UNSUPPORTED_SCHEMA_VERSION',
        'Accepted bootstrap state version is unsupported'
      )
    );
  }

  if (
    initialDomainResult.valid &&
    bootstrapIdResult.valid &&
    tenantIdResult.valid &&
    correlationIdResult.valid &&
    createdAtResult.valid
  ) {
    const initialDomainState = initialDomainResult.value;
    if (
      initialDomainState.bootstrapId !== bootstrapIdResult.value ||
      initialDomainState.tenantId !== tenantIdResult.value ||
      initialDomainState.correlationId !== correlationIdResult.value ||
      initialDomainState.createdAt !== createdAtResult.value
    ) {
      errors.push(
        error(
          'INITIAL_DOMAIN_CONTEXT_MISMATCH',
          'Accepted state context does not match its initial domain state'
        )
      );
    }

    const summaryResult = validateProvenanceSummary(
      record.provenanceSummary,
      initialDomainState.evidence
    );
    if (!summaryResult.valid) {
      errors.push(...summaryResult.errors);
    }
  }

  if (errors.length > 0) {
    return invalid(...errors);
  }

  return valid(record as unknown as BootstrapAcceptedState);
}

export function validateBootstrapRejectedState(
  value: unknown
): PipelineBootstrapValidationResult<BootstrapRejectedState> {
  const record = getSafeRecord(value, REJECTED_STATE_KEYS);
  if (!record || record.status !== 'REJECTED') {
    return invalid(
      error('INVALID_BOOTSTRAP_INPUT', 'Rejected bootstrap state is invalid')
    );
  }

  const bootstrapIdResult = validatePipelineBootstrapId(record.bootstrapId);
  const createdAtResult = validatePipelineBootstrapTimestamp(record.createdAt);
  const tenantIsValid =
    record.tenantId === undefined || isSafeIdentifier(record.tenantId);
  const correlationIsValid =
    record.correlationId === undefined ||
    isSafeIdentifier(record.correlationId);
  const errorsAreValid =
    Array.isArray(record.errors) &&
    record.errors.length > 0 &&
    record.errors.every((candidate) => {
      const publicError = getSafeRecord(candidate, PUBLIC_ERROR_KEYS);
      return (
        publicError !== undefined &&
        typeof publicError.code === 'string' &&
        PIPELINE_BOOTSTRAP_ERROR_CODES.some(
          (code) => code === publicError.code
        ) &&
        typeof publicError.message === 'string' &&
        publicError.message === publicError.message.trim() &&
        publicError.message.length > 0 &&
        typeof publicError.retryable === 'boolean'
      );
    });

  if (
    !bootstrapIdResult.valid ||
    !createdAtResult.valid ||
    !tenantIsValid ||
    !correlationIsValid ||
    !errorsAreValid ||
    record.bootstrapVersion !== PIPELINE_BOOTSTRAP_VERSION
  ) {
    return invalid(
      error('INVALID_BOOTSTRAP_INPUT', 'Rejected bootstrap state is invalid')
    );
  }

  return valid(record as unknown as BootstrapRejectedState);
}

export function validatePipelineBootstrapState(
  value: unknown,
  policy: PipelineBootstrapPolicy
): PipelineBootstrapValidationResult<PipelineBootstrapState> {
  const record = getPlainRecord(value);
  if (record?.status === 'ACCEPTED') {
    return validateBootstrapAcceptedState(value, policy);
  }
  if (record?.status === 'REJECTED') {
    return validateBootstrapRejectedState(value);
  }
  return invalid(
    error('INVALID_BOOTSTRAP_INPUT', 'Pipeline bootstrap state is invalid')
  );
}

export function isPipelineBootstrapValueTypeCompatible(
  category: PipelineBootstrapTaxonomyCategory,
  valueType: PipelineBootstrapValueType
): boolean {
  return (
    getPipelineBootstrapTaxonomyEntry(category).allowedValueType === valueType
  );
}
