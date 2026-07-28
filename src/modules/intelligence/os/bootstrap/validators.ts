import {
  createPipelineBootstrapError,
  type PipelineBootstrapError,
  type PipelineBootstrapErrorCode,
  type PipelineBootstrapValidationResult,
} from './errors';
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
  type PipelineBootstrapContext,
  type PipelineBootstrapFact,
  type PipelineBootstrapInput,
  type PipelineBootstrapPolicy,
  type PipelineBootstrapTargetScenario,
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

export function isPipelineBootstrapValueTypeCompatible(
  category: PipelineBootstrapTaxonomyCategory,
  valueType: PipelineBootstrapValueType
): boolean {
  return (
    getPipelineBootstrapTaxonomyEntry(category).allowedValueType === valueType
  );
}
