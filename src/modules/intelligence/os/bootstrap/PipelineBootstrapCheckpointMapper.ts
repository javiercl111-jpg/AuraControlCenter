import type { EnterpriseEvidence } from '../../enterprise-model/domain/types';
import type { PipelineAggregatedState } from '../contextTypes';
import {
  PRECOMPUTED_ADMISSIBLE_STAGE_IDS,
  PRECOMPUTED_EVIDENCE_SCHEMA_VERSION,
  PRECOMPUTED_STAGE_ARTIFACT_SCHEMA_VERSIONS,
  calculateCheckpointStageFingerprints,
} from '../checkpoint/admission';
import {
  canonicalizePipelineEvidenceReferences,
  freezePrecomputedPipelineCheckpoint,
} from '../checkpoint/integrity';
import {
  PRECOMPUTED_ADMISSION_TYPE,
  PRECOMPUTED_CHECKPOINT_VERSION,
  type PipelineEvidenceReference,
  type PipelineStageAdmission,
  type PrecomputedPipelineCheckpoint,
} from '../checkpoint/types';
import { validatePrecomputedPipelineCheckpoint } from '../checkpoint/validators';
import { AuraIntelligenceOSError, ErrorCodes } from '../errors';
import {
  cloneAndFreezePipelineExecutionScenario,
} from '../scenarioContract';
import type {
  PipelineExecutionScenario,
  PipelineInput,
} from '../types';
import type {
  BootstrapAcceptedState,
  PipelineBootstrapPolicy,
} from './types';
import {
  validateBootstrapAcceptedState,
  validatePipelineBootstrapPolicy,
} from './validators';

const SAFE_IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/|-]{0,179}$/;
const PRODUCER_VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

export interface PipelineBootstrapCheckpointProducerIdentity {
  readonly producerId: string;
  readonly producerVersion: string;
}

export interface PipelineBootstrapCheckpointMapperOptions {
  readonly policy: PipelineBootstrapPolicy;
  readonly producer: PipelineBootstrapCheckpointProducerIdentity;
}

export interface PipelineBootstrapExecutionHandoff {
  readonly aggregatedState: Readonly<PipelineAggregatedState>;
  readonly pipelineInput: Readonly<PipelineInput>;
  readonly precomputedCheckpoint: PrecomputedPipelineCheckpoint;
  readonly tenantId: string;
  readonly correlationId: string;
}

export type PipelineBootstrapCheckpointMappingIssue =
  | 'BOOTSTRAP_STATE_NOT_ACCEPTED'
  | 'BOOTSTRAP_INITIAL_STATE_MISSING'
  | 'BOOTSTRAP_EVIDENCE_IDENTITY_INVALID'
  | 'BOOTSTRAP_SCENARIO_MISMATCH'
  | 'BOOTSTRAP_CHECKPOINT_MAPPING_FAILED'
  | 'BOOTSTRAP_PRODUCER_IDENTITY_INVALID';

const MAPPING_MESSAGES: Readonly<
  Record<PipelineBootstrapCheckpointMappingIssue, string>
> = Object.freeze({
  BOOTSTRAP_STATE_NOT_ACCEPTED:
    'Bootstrap state is not accepted for checkpoint mapping',
  BOOTSTRAP_INITIAL_STATE_MISSING:
    'Accepted bootstrap state has no initial domain state',
  BOOTSTRAP_EVIDENCE_IDENTITY_INVALID:
    'Bootstrap applied evidence identity is invalid',
  BOOTSTRAP_SCENARIO_MISMATCH:
    'Bootstrap scenario is not compatible with checkpoint mapping',
  BOOTSTRAP_CHECKPOINT_MAPPING_FAILED:
    'Bootstrap checkpoint mapping failed',
  BOOTSTRAP_PRODUCER_IDENTITY_INVALID:
    'Bootstrap checkpoint producer identity is invalid',
});

export class PipelineBootstrapCheckpointMappingError
  extends AuraIntelligenceOSError {
  public readonly issue: PipelineBootstrapCheckpointMappingIssue;

  constructor(issue: PipelineBootstrapCheckpointMappingIssue) {
    super(
      ErrorCodes.INVALID_CONTRACT,
      MAPPING_MESSAGES[issue],
      false,
      undefined,
      { bootstrapCheckpointMappingIssue: issue }
    );
    this.name = 'PipelineBootstrapCheckpointMappingError';
    this.issue = issue;
    Object.setPrototypeOf(
      this,
      PipelineBootstrapCheckpointMappingError.prototype
    );
  }
}

function mappingError(
  issue: PipelineBootstrapCheckpointMappingIssue
): never {
  throw new PipelineBootstrapCheckpointMappingError(issue);
}

function isPlainObject(value: object): boolean {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function cloneSerializable<T>(
  value: T,
  seen: WeakMap<object, unknown> = new WeakMap()
): T {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      mappingError('BOOTSTRAP_CHECKPOINT_MAPPING_FAILED');
    }
    return value;
  }
  if (
    value === undefined ||
    typeof value === 'function' ||
    typeof value === 'symbol' ||
    typeof value === 'bigint'
  ) {
    mappingError('BOOTSTRAP_CHECKPOINT_MAPPING_FAILED');
  }
  if (typeof value !== 'object') {
    mappingError('BOOTSTRAP_CHECKPOINT_MAPPING_FAILED');
  }

  const objectValue = value as object;
  if (seen.has(objectValue)) {
    mappingError('BOOTSTRAP_CHECKPOINT_MAPPING_FAILED');
  }
  seen.set(objectValue, true);

  if (Array.isArray(value)) {
    const clone = value.map((item) => cloneSerializable(item, seen));
    seen.delete(objectValue);
    return clone as T;
  }
  if (!isPlainObject(objectValue)) {
    mappingError('BOOTSTRAP_CHECKPOINT_MAPPING_FAILED');
  }

  const clone: Record<string, unknown> = {};
  for (const key of Object.keys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      !descriptor ||
      !descriptor.enumerable ||
      descriptor.get !== undefined ||
      descriptor.set !== undefined
    ) {
      mappingError('BOOTSTRAP_CHECKPOINT_MAPPING_FAILED');
    }
    clone[key] = cloneSerializable(descriptor.value, seen);
  }
  if (Object.getOwnPropertySymbols(value).length > 0) {
    mappingError('BOOTSTRAP_CHECKPOINT_MAPPING_FAILED');
  }
  seen.delete(objectValue);
  return clone as T;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) {
      deepFreeze(nested);
    }
    Object.freeze(value);
  }
  return value;
}

function cloneAndFreeze<T>(value: T): T {
  return deepFreeze(cloneSerializable(value));
}

function projectExecutionScenario(
  state: BootstrapAcceptedState
): PipelineExecutionScenario {
  const scenario = state.initialDomainState.scenario;
  return cloneAndFreezePipelineExecutionScenario({
    scenarioId: scenario.scenarioId,
    scenarioVersion: scenario.scenarioVersion,
    objectiveKey: scenario.objectiveKey,
    requestedStages: [...scenario.requestedStages],
    allowedStages: [...scenario.allowedStages],
    requiredStages: [...scenario.requiredStages],
    stageDependencies: Object.fromEntries(
      Object.entries(scenario.stageDependencies).map(
        ([stage, dependencies]) => [stage, [...dependencies]]
      )
    ) as unknown as PipelineExecutionScenario['stageDependencies'],
    includedDomains: [...scenario.includedDomains],
    excludedDomains: [...scenario.excludedDomains],
  });
}

function validateProducerIdentity(
  producer: PipelineBootstrapCheckpointProducerIdentity
): void {
  if (
    !SAFE_IDENTIFIER_PATTERN.test(producer.producerId) ||
    !PRODUCER_VERSION_PATTERN.test(producer.producerVersion)
  ) {
    mappingError('BOOTSTRAP_PRODUCER_IDENTITY_INVALID');
  }
}

function classifyBootstrapValidationFailure(
  errors: readonly { readonly code: string; readonly message: string }[]
): never {
  if (
    errors.some(
      (error) =>
        error.code === 'INVALID_SCENARIO_DESCRIPTOR' ||
        error.code === 'INVALID_TARGET_SCENARIO'
    )
  ) {
    mappingError('BOOTSTRAP_SCENARIO_MISMATCH');
  }
  if (
    errors.some(
      (error) =>
        error.code === 'EMPTY_INITIAL_EVIDENCE' ||
        error.message.includes('evidence identifier') ||
        error.message.includes('Applied enterprise evidence')
    )
  ) {
    mappingError('BOOTSTRAP_EVIDENCE_IDENTITY_INVALID');
  }
  mappingError('BOOTSTRAP_CHECKPOINT_MAPPING_FAILED');
}

function deriveSessionId(
  evidence: readonly EnterpriseEvidence[]
): string {
  const sessionIds = new Set(evidence.map((item) => item.sessionId));
  if (
    sessionIds.size !== 1 ||
    [...sessionIds].some(
      (sessionId) => !SAFE_IDENTIFIER_PATTERN.test(sessionId)
    )
  ) {
    mappingError('BOOTSTRAP_EVIDENCE_IDENTITY_INVALID');
  }
  return [...sessionIds][0];
}

export function deriveBootstrapCheckpointId(bootstrapId: string): string {
  return bootstrapId;
}

function toCompletedAt(createdAt: number): string {
  const date = new Date(createdAt);
  if (!Number.isFinite(date.getTime())) {
    mappingError('BOOTSTRAP_CHECKPOINT_MAPPING_FAILED');
  }
  return date.toISOString();
}

export function mapBootstrapAcceptedStateToCheckpointHandoff(
  value: unknown,
  options: PipelineBootstrapCheckpointMapperOptions
): PipelineBootstrapExecutionHandoff {
  if (
    value === null ||
    typeof value !== 'object' ||
    (value as { readonly status?: unknown }).status !== 'ACCEPTED'
  ) {
    mappingError('BOOTSTRAP_STATE_NOT_ACCEPTED');
  }
  if (
    !Object.prototype.hasOwnProperty.call(value, 'initialDomainState') ||
    (value as { readonly initialDomainState?: unknown })
      .initialDomainState === undefined
  ) {
    mappingError('BOOTSTRAP_INITIAL_STATE_MISSING');
  }

  const policyResult = validatePipelineBootstrapPolicy(options.policy);
  if (!policyResult.valid) {
    mappingError('BOOTSTRAP_CHECKPOINT_MAPPING_FAILED');
  }
  validateProducerIdentity(options.producer);

  const acceptedResult = validateBootstrapAcceptedState(
    value,
    policyResult.value
  );
  if (!acceptedResult.valid) {
    classifyBootstrapValidationFailure(acceptedResult.errors);
  }

  try {
    const acceptedState = acceptedResult.value;
    const initialState = acceptedState.initialDomainState;
    const appliedEvidence = initialState.evidence
      .map((item) => cloneAndFreeze(item.appliedEvidence))
      .sort((left, right) =>
        left.evidenceId.localeCompare(right.evidenceId)
      );
    const evidenceIds = appliedEvidence.map(
      (evidence) => evidence.evidenceId
    );
    if (
      evidenceIds.some((evidenceId) => evidenceId.length === 0) ||
      new Set(evidenceIds).size !== evidenceIds.length
    ) {
      mappingError('BOOTSTRAP_EVIDENCE_IDENTITY_INVALID');
    }

    const sessionId = deriveSessionId(appliedEvidence);
    const mentalModel = cloneAndFreeze(initialState.mentalModel);
    const knowledgeGraph = cloneAndFreeze(initialState.knowledgeGraph);
    const executionScenario = projectExecutionScenario(acceptedState);
    const evidenceRefs = Object.freeze(
      canonicalizePipelineEvidenceReferences(
        appliedEvidence.map(
          (evidence): PipelineEvidenceReference => ({
            referenceType: 'EVIDENCE',
            evidenceId: evidence.evidenceId,
            schemaVersion: PRECOMPUTED_EVIDENCE_SCHEMA_VERSION,
          })
        )
      ).map((reference) => Object.freeze(reference))
    );

    const admissions = PRECOMPUTED_ADMISSIBLE_STAGE_IDS.map(
      (stage): PipelineStageAdmission => ({
        stageId: stage,
        admissionType: PRECOMPUTED_ADMISSION_TYPE,
        artifactSchemaVersion:
          PRECOMPUTED_STAGE_ARTIFACT_SCHEMA_VERSIONS[stage],
        ...calculateCheckpointStageFingerprints(stage, {
          tenantId: acceptedState.tenantId,
          correlationId: acceptedState.correlationId,
          scenarioId: executionScenario.scenarioId,
          scenarioVersion: executionScenario.scenarioVersion,
          evidenceRefs,
          appliedEvidence,
          mentalModel,
          knowledgeGraph,
        }),
        evidenceRefs,
      })
    );

    const checkpoint = freezePrecomputedPipelineCheckpoint({
      checkpointId: deriveBootstrapCheckpointId(
        acceptedState.bootstrapId
      ),
      checkpointVersion: PRECOMPUTED_CHECKPOINT_VERSION,
      tenantId: acceptedState.tenantId,
      correlationId: acceptedState.correlationId,
      scenarioId: executionScenario.scenarioId,
      scenarioVersion: executionScenario.scenarioVersion,
      producerId: options.producer.producerId,
      producerVersion: options.producer.producerVersion,
      completedAt: toCompletedAt(acceptedState.createdAt),
      admissions,
    });
    if (!validatePrecomputedPipelineCheckpoint(checkpoint).valid) {
      mappingError('BOOTSTRAP_CHECKPOINT_MAPPING_FAILED');
    }

    const aggregatedState = Object.freeze({
      sessionId,
      mentalModel,
      knowledgeGraph,
      evidence: Object.freeze([...appliedEvidence]),
      executionScenario,
    }) as Readonly<PipelineAggregatedState>;

    const pipelineInput = Object.freeze({
      sessionId,
      tenantId: acceptedState.tenantId,
      correlationId: acceptedState.correlationId,
      executionScenario,
      precomputedCheckpoint: checkpoint,
    }) satisfies Readonly<PipelineInput>;

    return Object.freeze({
      aggregatedState,
      pipelineInput,
      precomputedCheckpoint: checkpoint,
      tenantId: acceptedState.tenantId,
      correlationId: acceptedState.correlationId,
    });
  } catch (error) {
    if (error instanceof PipelineBootstrapCheckpointMappingError) {
      throw error;
    }
    mappingError('BOOTSTRAP_CHECKPOINT_MAPPING_FAILED');
  }
}
