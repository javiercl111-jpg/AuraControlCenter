import {
  validateAuthorityAuthorizationOperationBindingV1,
  validateAuthorityAuthorizationResourceBindingV1,
} from '../serverAuthorityAuthorization/authorityAuthorizationValidators';
import {
  validateAuthorityObligationSatisfactionEvidenceV1,
  validateAuthorityObligationSatisfactionSummaryV1,
} from '../serverAuthorityInvocationContext/authorityInvocationContextValidators';
import {
  validateAuthorityAdministrativeCommandV1,
} from '../serverAuthorityPersistence/validators';
import {
  validateAuthorityPrincipalResolutionRequestV1,
} from '../serverPrincipalResolution/principalResolutionValidators';
import {
  AUTHORITY_PRINCIPAL_RESOLUTION_CHANNELS,
} from '../serverPrincipalResolution/principalResolutionTypes';
import {
  AUTHORITY_TENANT_SCOPE_OPERATION_CATEGORIES,
} from '../serverTenantScopeResolution/tenantScopeResolutionTypes';
import {
  validateAuthorityTenantSelectorV1,
} from '../serverTenantScopeResolution/tenantScopeResolutionValidators';
import {
  AuthorityApplicationServiceValidationError,
  type AuthorityApplicationServiceContractIssue,
} from './authorityApplicationServiceErrors';
import type {
  AuthorityApplicationServiceDependenciesV1,
} from './authorityApplicationServicePorts';
import {
  AUTHORITY_APPLICATION_EXECUTION_CONTEXT_VERSION,
  AUTHORITY_APPLICATION_EXECUTION_MODES,
  AUTHORITY_APPLICATION_IDEMPOTENCY_INPUT_VERSION,
  AUTHORITY_APPLICATION_OBLIGATION_INPUT_VERSION,
  AUTHORITY_APPLICATION_RESULT_STATUSES,
  AUTHORITY_APPLICATION_RETRY_DISPOSITIONS,
  AUTHORITY_APPLICATION_SAFE_CODES,
  AUTHORITY_APPLICATION_SERVICE_REQUEST_VERSION,
  AUTHORITY_APPLICATION_SERVICE_RESULT_VERSION,
  AUTHORITY_APPLICATION_STAGE_STATUSES,
  AUTHORITY_APPLICATION_STAGE_TRACE_VERSION,
  AUTHORITY_APPLICATION_STAGES,
  AUTHORITY_OBLIGATION_VERIFICATION_RESULT_VERSION,
  AUTHORITY_OBLIGATION_VERIFICATION_STATUSES,
  type AuthorityApplicationExecutionContextV1,
  type AuthorityApplicationIdempotencyInputV1,
  type AuthorityApplicationObligationEvidenceInputV1,
  type AuthorityApplicationResultMetadataV1,
  type AuthorityApplicationServiceRequestV1,
  type AuthorityApplicationServiceResultV1,
  type AuthorityApplicationStageTraceV1,
  type AuthorityObligationVerificationResultV1,
} from './authorityApplicationServiceTypes';

type PlainRecord = Record<string, unknown>;

const AUTHORITY_OBLIGATION_TYPES = Object.freeze([
  'REQUIRE_FRESH_AUTHENTICATION',
  'REQUIRE_APP_CHECK',
  'REQUIRE_MFA',
  'REQUIRE_IDEMPOTENCY_KEY',
  'REQUIRE_EXPECTED_VERSION',
  'REQUIRE_AUDIT_REASON',
  'REQUIRE_CHANGE_TICKET',
  'REQUIRE_SUPPORT_SESSION',
  'REQUIRE_MIGRATION_MANIFEST',
  'MASK_NOT_FOUND',
  'LIMIT_TO_TEST_ONLY',
] as const);

function fail(
  issue: AuthorityApplicationServiceContractIssue,
  field?: string,
): never {
  throw new AuthorityApplicationServiceValidationError(issue, field);
}

function isPlainRecord(value: unknown): value is PlainRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  try {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function closedRecord(
  value: unknown,
  keys: readonly string[],
  issue: AuthorityApplicationServiceContractIssue,
  field: string,
): PlainRecord {
  if (!isPlainRecord(value)) {
    return fail(issue, field);
  }
  let ownKeys: readonly PropertyKey[];
  try {
    ownKeys = Reflect.ownKeys(value);
  } catch {
    return fail(issue, field);
  }
  for (const key of ownKeys) {
    if (typeof key !== 'string' || !keys.includes(key)) {
      return fail('UNKNOWN_FIELD', field);
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      descriptor === undefined ||
      !descriptor.enumerable ||
      !Object.prototype.hasOwnProperty.call(descriptor, 'value') ||
      descriptor.value === undefined
    ) {
      return fail(issue, field);
    }
  }
  return value;
}

function literal<T extends string>(
  value: unknown,
  expected: T,
  field: string,
): T {
  if (value !== expected) {
    return fail('INVALID_RECORD', field);
  }
  return expected;
}

function enumValue<T extends string>(
  value: unknown,
  values: readonly T[],
  field: string,
): T {
  if (typeof value !== 'string' || !values.includes(value as T)) {
    return fail('INVALID_RECORD', field);
  }
  return value as T;
}

function identifier(value: unknown, field: string): string {
  if (
    typeof value !== 'string' ||
    value.length < 3 ||
    value.length > 160 ||
    value.trim() !== value ||
    !/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(value)
  ) {
    return fail('INVALID_RECORD', field);
  }
  return value;
}

function reference(value: unknown, field: string): string {
  if (
    typeof value !== 'string' ||
    value.length < 1 ||
    value.length > 256 ||
    value.trim() !== value ||
    /\s/.test(value) ||
    value.includes('..') ||
    value.includes('/') ||
    value.includes('\\') ||
    value.includes('*') ||
    value.includes('://')
  ) {
    return fail('INVALID_RECORD', field);
  }
  return value;
}

function version(value: unknown, field: string): string {
  if (
    typeof value !== 'string' ||
    value.length < 1 ||
    value.length > 128 ||
    value.trim() !== value ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value)
  ) {
    return fail('INVALID_RECORD', field);
  }
  return value;
}

function fingerprint(value: unknown, field: string): string {
  if (
    typeof value !== 'string' ||
    !/^sha256:[a-f0-9]{64}$/.test(value)
  ) {
    return fail('INVALID_RECORD', field);
  }
  return value;
}

function timestamp(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    return fail('INVALID_RECORD', field);
  }
  const milliseconds = Date.parse(value);
  if (
    !Number.isFinite(milliseconds) ||
    new Date(milliseconds).toISOString() !== value
  ) {
    return fail('INVALID_RECORD', field);
  }
  return value;
}

function requireOrder(
  earlier: string,
  later: string,
  field: string,
  allowEqual = false,
): void {
  const difference = Date.parse(later) - Date.parse(earlier);
  if (difference < 0 || (!allowEqual && difference === 0)) {
    return fail('INVALID_EXECUTION_CONTEXT', field);
  }
}

function optional<T>(
  value: unknown,
  validator: (input: unknown) => T,
): T | undefined {
  return value === undefined ? undefined : validator(value);
}

function validatePriorDecisionReference(
  value: unknown,
): NonNullable<
  AuthorityApplicationServiceRequestV1['priorDecisionReference']
> {
  const record = closedRecord(
    value,
    ['decisionFingerprint', 'policyVersion', 'evaluatedAt'],
    'INVALID_REQUEST',
    'request.priorDecisionReference',
  );
  return Object.freeze({
    decisionFingerprint: fingerprint(
      record.decisionFingerprint,
      'request.priorDecisionReference.decisionFingerprint',
    ),
    policyVersion: version(
      record.policyVersion,
      'request.priorDecisionReference.policyVersion',
    ),
    evaluatedAt: timestamp(
      record.evaluatedAt,
      'request.priorDecisionReference.evaluatedAt',
    ),
  });
}

function isAbortSignal(value: unknown): value is AbortSignal {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  return (
    typeof Reflect.get(value, 'aborted') === 'boolean' &&
    typeof Reflect.get(value, 'addEventListener') === 'function' &&
    typeof Reflect.get(value, 'removeEventListener') === 'function'
  );
}

export function validateAuthorityApplicationIdempotencyInputV1(
  value: unknown,
): AuthorityApplicationIdempotencyInputV1 {
  const record = closedRecord(
    value,
    [
      'schemaVersion',
      'idempotencyKey',
      'callerKeyHash',
      'namespaceVersion',
      'commandFingerprint',
    ],
    'INVALID_IDEMPOTENCY',
    'idempotency',
  );
  return Object.freeze({
    schemaVersion: literal(
      record.schemaVersion,
      AUTHORITY_APPLICATION_IDEMPOTENCY_INPUT_VERSION,
      'idempotency.schemaVersion',
    ),
    idempotencyKey: identifier(
      record.idempotencyKey,
      'idempotency.idempotencyKey',
    ),
    callerKeyHash: fingerprint(
      record.callerKeyHash,
      'idempotency.callerKeyHash',
    ),
    namespaceVersion: version(
      record.namespaceVersion,
      'idempotency.namespaceVersion',
    ),
    commandFingerprint: fingerprint(
      record.commandFingerprint,
      'idempotency.commandFingerprint',
    ),
  });
}

export function validateAuthorityApplicationObligationEvidenceInputV1(
  value: unknown,
): AuthorityApplicationObligationEvidenceInputV1 {
  const record = closedRecord(
    value,
    [
      'schemaVersion',
      'obligationType',
      'evidenceFingerprint',
      'observedAt',
      'validUntil',
      'verifierReference',
    ],
    'INVALID_OBLIGATION_INPUT',
    'obligationEvidence',
  );
  const observedAt = timestamp(
    record.observedAt,
    'obligationEvidence.observedAt',
  );
  const validUntil = optional(record.validUntil, (input) =>
    timestamp(input, 'obligationEvidence.validUntil'),
  );
  if (validUntil !== undefined) {
    requireOrder(
      observedAt,
      validUntil,
      'obligationEvidence.validUntil',
    );
  }
  const verifierReference = optional(record.verifierReference, (input) =>
    reference(input, 'obligationEvidence.verifierReference'),
  );
  return Object.freeze({
    schemaVersion: literal(
      record.schemaVersion,
      AUTHORITY_APPLICATION_OBLIGATION_INPUT_VERSION,
      'obligationEvidence.schemaVersion',
    ),
    obligationType: enumValue(
      record.obligationType,
      AUTHORITY_OBLIGATION_TYPES,
      'obligationEvidence.obligationType',
    ),
    evidenceFingerprint: fingerprint(
      record.evidenceFingerprint,
      'obligationEvidence.evidenceFingerprint',
    ),
    observedAt,
    ...(validUntil === undefined ? {} : { validUntil }),
    ...(verifierReference === undefined ? {} : { verifierReference }),
  });
}

export function validateAuthorityApplicationServiceRequestV1(
  value: unknown,
): AuthorityApplicationServiceRequestV1 {
  const record = closedRecord(
    value,
    [
      'schemaVersion',
      'principalResolutionRequest',
      'tenantSelector',
      'scopeOperationCategory',
      'authorizationOperation',
      'authorizationResource',
      'priorDecisionReference',
      'command',
      'idempotency',
      'obligationEvidence',
    ],
    'INVALID_REQUEST',
    'request',
  );
  const validatedCommand = validateAuthorityAdministrativeCommandV1(
    record.command,
  );
  const command =
    record.command as AuthorityApplicationServiceRequestV1['command'];
  const authorizationOperation =
    validateAuthorityAuthorizationOperationBindingV1(
      record.authorizationOperation,
    );
  const idempotency =
    validateAuthorityApplicationIdempotencyInputV1(record.idempotency);
  if (
    validatedCommand.operationType !==
      authorizationOperation.operationType ||
    validatedCommand.operationId !== authorizationOperation.operationId ||
    validatedCommand.requestedAt !== authorizationOperation.requestedAt ||
    authorizationOperation.commandFingerprint !==
      idempotency.commandFingerprint ||
    command.idempotencyKey !== idempotency.idempotencyKey
  ) {
    return fail('COMMAND_BINDING_MISMATCH', 'request.command');
  }
  if (!Array.isArray(record.obligationEvidence)) {
    return fail('INVALID_OBLIGATION_INPUT', 'request.obligationEvidence');
  }
  const obligationEvidence = Object.freeze(
    record.obligationEvidence.map((item) =>
      validateAuthorityApplicationObligationEvidenceInputV1(item),
    ),
  );
  const obligationTypes = obligationEvidence.map(
    (item) => item.obligationType,
  );
  if (new Set(obligationTypes).size !== obligationTypes.length) {
    return fail('INVALID_OBLIGATION_INPUT', 'request.obligationEvidence');
  }
  const scopeOperationCategory = optional(
    record.scopeOperationCategory,
    (input) =>
      enumValue(
        input,
        AUTHORITY_TENANT_SCOPE_OPERATION_CATEGORIES,
        'request.scopeOperationCategory',
      ),
  );
  const priorDecisionReference =
    record.priorDecisionReference === undefined
      ? undefined
      : validatePriorDecisionReference(record.priorDecisionReference);
  return Object.freeze({
    schemaVersion: literal(
      record.schemaVersion,
      AUTHORITY_APPLICATION_SERVICE_REQUEST_VERSION,
      'request.schemaVersion',
    ),
    principalResolutionRequest:
      validateAuthorityPrincipalResolutionRequestV1(
        record.principalResolutionRequest,
      ),
    tenantSelector: validateAuthorityTenantSelectorV1(
      record.tenantSelector,
    ),
    ...(scopeOperationCategory === undefined
      ? {}
      : { scopeOperationCategory }),
    authorizationOperation,
    authorizationResource:
      validateAuthorityAuthorizationResourceBindingV1(
        record.authorizationResource,
      ),
    ...(priorDecisionReference === undefined
      ? {}
      : { priorDecisionReference }),
    command,
    idempotency,
    obligationEvidence,
  });
}

export function validateAuthorityApplicationExecutionContextV1(
  value: unknown,
): AuthorityApplicationExecutionContextV1 {
  const record = closedRecord(
    value,
    [
      'schemaVersion',
      'requestId',
      'correlationId',
      'causationId',
      'channel',
      'receivedAt',
      'evaluatedAt',
      'createdAt',
      'deadlineAt',
      'traceId',
      'clientRequestIdHash',
      'principalResolverVersion',
      'scopeResolverVersion',
      'authorizationEvaluatorVersion',
      'executionMode',
      'cancellationSignal',
    ],
    'INVALID_EXECUTION_CONTEXT',
    'executionContext',
  );
  const receivedAt = timestamp(
    record.receivedAt,
    'executionContext.receivedAt',
  );
  const evaluatedAt = timestamp(
    record.evaluatedAt,
    'executionContext.evaluatedAt',
  );
  const createdAt = timestamp(
    record.createdAt,
    'executionContext.createdAt',
  );
  requireOrder(receivedAt, evaluatedAt, 'executionContext.evaluatedAt', true);
  requireOrder(evaluatedAt, createdAt, 'executionContext.createdAt', true);
  const deadlineAt = optional(record.deadlineAt, (input) =>
    timestamp(input, 'executionContext.deadlineAt'),
  );
  if (deadlineAt !== undefined) {
    requireOrder(createdAt, deadlineAt, 'executionContext.deadlineAt');
  }
  const cancellationSignal = record.cancellationSignal;
  if (
    cancellationSignal !== undefined &&
    !isAbortSignal(cancellationSignal)
  ) {
    return fail(
      'INVALID_EXECUTION_CONTEXT',
      'executionContext.cancellationSignal',
    );
  }
  const causationId = optional(record.causationId, (input) =>
    identifier(input, 'executionContext.causationId'),
  );
  const traceId = optional(record.traceId, (input) =>
    identifier(input, 'executionContext.traceId'),
  );
  const clientRequestIdHash = optional(
    record.clientRequestIdHash,
    (input) => fingerprint(input, 'executionContext.clientRequestIdHash'),
  );
  return Object.freeze({
    schemaVersion: literal(
      record.schemaVersion,
      AUTHORITY_APPLICATION_EXECUTION_CONTEXT_VERSION,
      'executionContext.schemaVersion',
    ),
    requestId: identifier(
      record.requestId,
      'executionContext.requestId',
    ),
    correlationId: identifier(
      record.correlationId,
      'executionContext.correlationId',
    ),
    ...(causationId === undefined ? {} : { causationId }),
    channel: enumValue(
      record.channel,
      AUTHORITY_PRINCIPAL_RESOLUTION_CHANNELS,
      'executionContext.channel',
    ),
    receivedAt,
    evaluatedAt,
    createdAt,
    ...(deadlineAt === undefined ? {} : { deadlineAt }),
    ...(traceId === undefined ? {} : { traceId }),
    ...(clientRequestIdHash === undefined
      ? {}
      : { clientRequestIdHash }),
    principalResolverVersion: version(
      record.principalResolverVersion,
      'executionContext.principalResolverVersion',
    ),
    scopeResolverVersion: version(
      record.scopeResolverVersion,
      'executionContext.scopeResolverVersion',
    ),
    authorizationEvaluatorVersion: version(
      record.authorizationEvaluatorVersion,
      'executionContext.authorizationEvaluatorVersion',
    ),
    executionMode: enumValue(
      record.executionMode,
      AUTHORITY_APPLICATION_EXECUTION_MODES,
      'executionContext.executionMode',
    ),
    ...(cancellationSignal === undefined
      ? {}
      : { cancellationSignal }),
  });
}

function dependencyMethod(
  value: unknown,
  method: string,
  field: string,
): void {
  if (
    typeof value !== 'object' ||
    value === null ||
    typeof Reflect.get(value, method) !== 'function'
  ) {
    return fail('INVALID_DEPENDENCY', field);
  }
}

export function validateAuthorityApplicationServiceDependenciesV1(
  value: unknown,
): AuthorityApplicationServiceDependenciesV1 {
  const record = closedRecord(
    value,
    [
      'principalResolver',
      'tenantScopeResolver',
      'authorizationEvaluator',
      'obligationVerifier',
      'contextFingerprintProvider',
      'repository',
      'clock',
    ],
    'INVALID_DEPENDENCY',
    'dependencies',
  );
  dependencyMethod(
    record.principalResolver,
    'resolve',
    'dependencies.principalResolver',
  );
  dependencyMethod(
    record.tenantScopeResolver,
    'resolve',
    'dependencies.tenantScopeResolver',
  );
  dependencyMethod(
    record.authorizationEvaluator,
    'evaluate',
    'dependencies.authorizationEvaluator',
  );
  dependencyMethod(
    record.obligationVerifier,
    'verify',
    'dependencies.obligationVerifier',
  );
  dependencyMethod(
    record.contextFingerprintProvider,
    'fingerprint',
    'dependencies.contextFingerprintProvider',
  );
  dependencyMethod(
    record.repository,
    'execute',
    'dependencies.repository',
  );
  dependencyMethod(record.clock, 'nowIso', 'dependencies.clock');
  return Object.freeze({
    principalResolver:
      record.principalResolver as AuthorityApplicationServiceDependenciesV1['principalResolver'],
    tenantScopeResolver:
      record.tenantScopeResolver as AuthorityApplicationServiceDependenciesV1['tenantScopeResolver'],
    authorizationEvaluator:
      record.authorizationEvaluator as AuthorityApplicationServiceDependenciesV1['authorizationEvaluator'],
    obligationVerifier:
      record.obligationVerifier as AuthorityApplicationServiceDependenciesV1['obligationVerifier'],
    contextFingerprintProvider:
      record.contextFingerprintProvider as AuthorityApplicationServiceDependenciesV1['contextFingerprintProvider'],
    repository:
      record.repository as AuthorityApplicationServiceDependenciesV1['repository'],
    clock:
      record.clock as AuthorityApplicationServiceDependenciesV1['clock'],
  });
}

export function validateAuthorityObligationVerificationResultV1(
  value: unknown,
): AuthorityObligationVerificationResultV1 {
  if (!isPlainRecord(value)) {
    return fail('INVALID_OBLIGATION_RESULT', 'obligationResult');
  }
  const status = enumValue(
    value.status,
    AUTHORITY_OBLIGATION_VERIFICATION_STATUSES,
    'obligationResult.status',
  );
  if (status === 'VERIFIED') {
    const record = closedRecord(
      value,
      [
        'schemaVersion',
        'status',
        'evidence',
        'summary',
        'obligationsFingerprint',
        'safeCode',
        'retryDisposition',
        'maskNotFound',
      ],
      'INVALID_OBLIGATION_RESULT',
      'obligationResult',
    );
    if (
      !Array.isArray(record.evidence) ||
      typeof record.summary !== 'object' ||
      record.summary === null
    ) {
      return fail('INVALID_OBLIGATION_RESULT', 'obligationResult');
    }
    const evidence = Object.freeze(
      record.evidence.map((item) =>
        validateAuthorityObligationSatisfactionEvidenceV1(item),
      ),
    );
    const summary = validateAuthorityObligationSatisfactionSummaryV1(
      record.summary,
    );
    const obligationsFingerprint = fingerprint(
      record.obligationsFingerprint,
      'obligationResult.obligationsFingerprint',
    );
    if (
      summary.fingerprint !== obligationsFingerprint ||
      summary.total !== evidence.length
    ) {
      return fail('INVALID_OBLIGATION_RESULT', 'obligationResult');
    }
    const maskNotFound = record.maskNotFound;
    if (typeof maskNotFound !== 'boolean') {
      return fail('INVALID_OBLIGATION_RESULT', 'obligationResult');
    }
    return Object.freeze({
      schemaVersion: literal(
        record.schemaVersion,
        AUTHORITY_OBLIGATION_VERIFICATION_RESULT_VERSION,
        'obligationResult.schemaVersion',
      ),
      status,
      evidence,
      summary,
      obligationsFingerprint,
      safeCode: literal(
        record.safeCode,
        'OBLIGATIONS_VERIFIED',
        'obligationResult.safeCode',
      ),
      retryDisposition: literal(
        record.retryDisposition,
        'DO_NOT_RETRY',
        'obligationResult.retryDisposition',
      ),
      maskNotFound,
    });
  }
  const record = closedRecord(
    value,
    [
      'schemaVersion',
      'status',
      'safeCode',
      'retryDisposition',
      'maskNotFound',
    ],
    'INVALID_OBLIGATION_RESULT',
    'obligationResult',
  );
  const expectedCodes = Object.freeze({
    REJECTED: 'OBLIGATIONS_REJECTED',
    STALE: 'OBLIGATIONS_STALE',
    INCOMPLETE: 'OBLIGATIONS_INCOMPLETE',
    CONFLICT: 'OBLIGATIONS_CONFLICT',
    INTERNAL_ERROR: 'OBLIGATIONS_INTERNAL_ERROR',
  } as const);
  if (typeof record.maskNotFound !== 'boolean') {
    return fail('INVALID_OBLIGATION_RESULT', 'obligationResult');
  }
  return Object.freeze({
    schemaVersion: literal(
      record.schemaVersion,
      AUTHORITY_OBLIGATION_VERIFICATION_RESULT_VERSION,
      'obligationResult.schemaVersion',
    ),
    status,
    safeCode: literal(
      record.safeCode,
      expectedCodes[status],
      'obligationResult.safeCode',
    ),
    retryDisposition: enumValue(
      record.retryDisposition,
      AUTHORITY_APPLICATION_RETRY_DISPOSITIONS,
      'obligationResult.retryDisposition',
    ),
    maskNotFound: record.maskNotFound,
  });
}

export function validateAuthorityApplicationStageTraceV1(
  value: unknown,
): AuthorityApplicationStageTraceV1 {
  const record = closedRecord(
    value,
    [
      'schemaVersion',
      'stage',
      'status',
      'startedAt',
      'completedAt',
      'safeCode',
      'retryDisposition',
    ],
    'INVALID_STAGE_TRACE',
    'stageTrace',
  );
  const startedAt = timestamp(record.startedAt, 'stageTrace.startedAt');
  const completedAt = timestamp(
    record.completedAt,
    'stageTrace.completedAt',
  );
  requireOrder(startedAt, completedAt, 'stageTrace.completedAt', true);
  const safeCode = optional(record.safeCode, (input) =>
    enumValue(input, AUTHORITY_APPLICATION_SAFE_CODES, 'stageTrace.safeCode'),
  );
  const retryDisposition = optional(
    record.retryDisposition,
    (input) =>
      enumValue(
        input,
        AUTHORITY_APPLICATION_RETRY_DISPOSITIONS,
        'stageTrace.retryDisposition',
      ),
  );
  return Object.freeze({
    schemaVersion: literal(
      record.schemaVersion,
      AUTHORITY_APPLICATION_STAGE_TRACE_VERSION,
      'stageTrace.schemaVersion',
    ),
    stage: enumValue(
      record.stage,
      AUTHORITY_APPLICATION_STAGES,
      'stageTrace.stage',
    ),
    status: enumValue(
      record.status,
      AUTHORITY_APPLICATION_STAGE_STATUSES,
      'stageTrace.status',
    ),
    startedAt,
    completedAt,
    ...(safeCode === undefined ? {} : { safeCode }),
    ...(retryDisposition === undefined ? {} : { retryDisposition }),
  });
}

function validateResultMetadata(
  value: unknown,
): AuthorityApplicationResultMetadataV1 {
  const record = closedRecord(
    value,
    [
      'operationId',
      'correlationId',
      'contextFingerprint',
      'repositorySafeCode',
      'resultingVersion',
      'resourceReference',
      'maskNotFound',
    ],
    'INVALID_RESULT',
    'result.metadata',
  );
  const contextFingerprint = optional(
    record.contextFingerprint,
    (input) => fingerprint(input, 'result.metadata.contextFingerprint'),
  );
  const repositorySafeCode = optional(
    record.repositorySafeCode,
    (input) => reference(input, 'result.metadata.repositorySafeCode'),
  );
  const resourceReference = optional(
    record.resourceReference,
    (input) => reference(input, 'result.metadata.resourceReference'),
  );
  const resultingVersion = optional(record.resultingVersion, (input) => {
    if (
      typeof input !== 'number' ||
      !Number.isSafeInteger(input) ||
      input < 1
    ) {
      return fail('INVALID_RESULT', 'result.metadata.resultingVersion');
    }
    return input;
  });
  if (typeof record.maskNotFound !== 'boolean') {
    return fail('INVALID_RESULT', 'result.metadata.maskNotFound');
  }
  return Object.freeze({
    operationId: identifier(
      record.operationId,
      'result.metadata.operationId',
    ),
    correlationId: identifier(
      record.correlationId,
      'result.metadata.correlationId',
    ),
    ...(contextFingerprint === undefined
      ? {}
      : { contextFingerprint }),
    ...(repositorySafeCode === undefined
      ? {}
      : { repositorySafeCode }),
    ...(resultingVersion === undefined ? {} : { resultingVersion }),
    ...(resourceReference === undefined ? {} : { resourceReference }),
    maskNotFound: record.maskNotFound,
  });
}

export function validateAuthorityApplicationServiceResultV1(
  value: unknown,
): AuthorityApplicationServiceResultV1 {
  const record = closedRecord(
    value,
    [
      'schemaVersion',
      'status',
      'safeCode',
      'retryDisposition',
      'stageTrace',
      'metadata',
    ],
    'INVALID_RESULT',
    'result',
  );
  if (!Array.isArray(record.stageTrace)) {
    return fail('INVALID_RESULT', 'result.stageTrace');
  }
  return Object.freeze({
    schemaVersion: literal(
      record.schemaVersion,
      AUTHORITY_APPLICATION_SERVICE_RESULT_VERSION,
      'result.schemaVersion',
    ),
    status: enumValue(
      record.status,
      AUTHORITY_APPLICATION_RESULT_STATUSES,
      'result.status',
    ),
    safeCode: enumValue(
      record.safeCode,
      AUTHORITY_APPLICATION_SAFE_CODES,
      'result.safeCode',
    ),
    retryDisposition: enumValue(
      record.retryDisposition,
      AUTHORITY_APPLICATION_RETRY_DISPOSITIONS,
      'result.retryDisposition',
    ),
    stageTrace: Object.freeze(
      record.stageTrace.map((item) =>
        validateAuthorityApplicationStageTraceV1(item),
      ),
    ),
    metadata: validateResultMetadata(record.metadata),
  });
}
