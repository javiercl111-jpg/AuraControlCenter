import type {
  TrustedCompositionRootDependencies,
} from './ports';
import {
  TRUSTED_COMPOSITION_REGISTRY_VERSION,
  TRUSTED_CONSUMER_REGISTRY_V1,
  TRUSTED_SOURCE_REGISTRY_V1,
} from './registry';
import {
  TRUSTED_AUTHENTICATION_METHODS,
  TRUSTED_AUTHENTICATION_PROVIDERS,
  TRUSTED_REQUEST_GENERATION_STRATEGIES,
  TRUSTED_REQUEST_IDENTITY_VERSION,
  TRUSTED_RESOLVER_INPUT_VERSION,
  TRUSTED_RESOURCE_SCOPE_TYPES,
  TRUSTED_SANITIZED_TRANSPORT_CONTEXT_VERSION,
  TRUSTED_SERVER_INVOCATION_CLASSES,
  TRUSTED_SERVER_LIFECYCLE_VERSION,
  TRUSTED_SERVER_PRINCIPAL_TYPES,
  TRUSTED_SERVER_PRINCIPAL_VERSION,
  TRUSTED_SERVER_REQUEST_CONTEXT_VERSION,
  TRUSTED_SERVER_RESPONSE_SAFE_CODES,
  TRUSTED_SERVER_RESPONSE_STATUSES,
  TRUSTED_SERVER_RESPONSE_VERSION,
  TRUSTED_SERVER_RESULT_OUTCOMES,
  TRUSTED_SERVER_TRANSPORTS,
  TRUSTED_TENANT_MEMBERSHIP_ROLES,
  TRUSTED_TENANT_MEMBERSHIP_STATUSES,
  TRUSTED_TENANT_MEMBERSHIP_VERSION,
  type TrustedAuthenticationMethod,
  type TrustedAuthenticationProvider,
  type TrustedAuthenticationReferenceV1,
  type TrustedPrincipalResolutionInputV1,
  type TrustedRegistrySelectionV1,
  type TrustedRequestIdentityV1,
  type TrustedResourceScopeV1,
  type TrustedSanitizedTransportContextV1,
  type TrustedServerExecutionResponseV1,
  type TrustedServerExecutionStatus,
  type TrustedServerLifecycleV1,
  type TrustedServerPrincipalType,
  type TrustedServerPrincipalV1,
  type TrustedServerRequestContextV1,
  type TrustedServerResponseSafeCode,
  type TrustedServerResultSummaryV1,
  type TrustedTenantAuthorityResolutionInputV1,
  type TrustedTenantMembershipRole,
  type TrustedTenantMembershipV1,
} from './types';
import {
  TrustedCompositionContractError,
  type TrustedCompositionContractIssue,
} from './errors';

type PlainRecord = Readonly<Record<string, unknown>>;

const REQUEST_CONTEXT_KEYS = Object.freeze([
  'schemaVersion',
  'transport',
  'authenticatedPrincipal',
  'tenantMembership',
  'consumer',
  'source',
  'requestIdentity',
  'initiatedAt',
  'requestedExecutionMode',
  'cancellation',
] as const);

function fail(issue: TrustedCompositionContractIssue): never {
  throw new TrustedCompositionContractError(issue);
}

function isPlainRecord(value: unknown): value is PlainRecord {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value)
  ) {
    return false;
  }
  try {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function getClosedRecord(
  value: unknown,
  requiredKeys: readonly string[],
  optionalKeys: readonly string[] = []
): PlainRecord | undefined {
  if (!isPlainRecord(value)) {
    return undefined;
  }
  try {
    const allowedKeys = [...requiredKeys, ...optionalKeys];
    const ownKeys = Reflect.ownKeys(value);
    if (
      ownKeys.some(
        (key) =>
          typeof key !== 'string' || !allowedKeys.includes(key)
      ) ||
      requiredKeys.some(
        (key) => !Object.prototype.hasOwnProperty.call(value, key)
      )
    ) {
      return undefined;
    }
    for (const key of ownKeys) {
      if (typeof key !== 'string') {
        return undefined;
      }
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        !descriptor ||
        !descriptor.enumerable ||
        !Object.prototype.hasOwnProperty.call(descriptor, 'value')
      ) {
        return undefined;
      }
    }
    return value;
  } catch {
    return undefined;
  }
}

function isOneOf<T extends string>(
  value: unknown,
  allowed: readonly T[]
): value is T {
  return typeof value === 'string' && allowed.includes(value as T);
}

function isCanonicalIdentifier(
  value: unknown,
  minimumLength = 3,
  maximumLength = 128
): value is string {
  return (
    typeof value === 'string' &&
    value.length >= minimumLength &&
    value.length <= maximumLength &&
    value === value.trim() &&
    /^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(value) &&
    !value.includes('..')
  );
}

function isCanonicalVersion(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length >= 1 &&
    value.length <= 128 &&
    value === value.trim() &&
    /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value) &&
    !value.includes('..')
  );
}

function isSha256Fingerprint(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^sha256:[a-f0-9]{64}$/.test(value)
  );
}

function canonicalTimestampMilliseconds(
  value: unknown
): number | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const milliseconds = Date.parse(value);
  if (!Number.isSafeInteger(milliseconds) || milliseconds < 0) {
    return undefined;
  }
  return new Date(milliseconds).toISOString() === value
    ? milliseconds
    : undefined;
}

function isCanonicalTimestamp(value: unknown): value is string {
  return canonicalTimestampMilliseconds(value) !== undefined;
}

function isAbortSignal(value: unknown): value is AbortSignal {
  return (
    typeof AbortSignal !== 'undefined' &&
    value instanceof AbortSignal
  );
}

function isAuthenticationCombinationValid(
  principalType: TrustedServerPrincipalType,
  method: TrustedAuthenticationMethod,
  provider: TrustedAuthenticationProvider
): boolean {
  if (method === 'INTERNAL_TEST_ASSERTION') {
    return provider === 'AURA_INTERNAL_TEST';
  }
  if (principalType === 'USER') {
    return (
      method === 'FIREBASE_ID_TOKEN' &&
      provider === 'FIREBASE_AUTH'
    );
  }
  if (principalType === 'SERVICE') {
    return (
      (method === 'OIDC_SERVICE_ACCOUNT' ||
        method === 'WORKLOAD_IDENTITY') &&
      provider === 'GOOGLE_CLOUD_IAM'
    );
  }
  return (
    principalType === 'SYSTEM' &&
    method === 'WORKLOAD_IDENTITY' &&
    provider === 'GOOGLE_CLOUD_IAM'
  );
}

function rolesMatchPrincipal(
  roles: readonly TrustedTenantMembershipRole[],
  principalType: TrustedServerPrincipalType
): boolean {
  if (principalType === 'SYSTEM') {
    return roles.every((role) => role === 'TENANT_SYSTEM');
  }
  if (principalType === 'SERVICE') {
    return roles.every(
      (role) =>
        role === 'TENANT_SERVICE' || role === 'TENANT_MEMBER'
    );
  }
  return roles.every(
    (role) =>
      role === 'TENANT_MEMBER' ||
      role === 'TENANT_OPERATOR' ||
      role === 'TENANT_ADMIN'
  );
}

export function validateTrustedServerPrincipalV1(
  value: unknown
): TrustedServerPrincipalV1 {
  const record = getClosedRecord(
    value,
    [
      'schemaVersion',
      'principalId',
      'principalType',
      'authenticationMethod',
      'provider',
      'authenticatedAt',
    ],
    ['claimsFingerprint']
  );
  if (
    !record ||
    record.schemaVersion !== TRUSTED_SERVER_PRINCIPAL_VERSION ||
    !isCanonicalIdentifier(record.principalId) ||
    !isOneOf(
      record.principalType,
      TRUSTED_SERVER_PRINCIPAL_TYPES
    ) ||
    !isOneOf(
      record.authenticationMethod,
      TRUSTED_AUTHENTICATION_METHODS
    ) ||
    !isOneOf(
      record.provider,
      TRUSTED_AUTHENTICATION_PROVIDERS
    ) ||
    !isCanonicalTimestamp(record.authenticatedAt) ||
    (record.claimsFingerprint !== undefined &&
      !isSha256Fingerprint(record.claimsFingerprint))
  ) {
    fail('UNTRUSTED_AUTHORITY');
  }
  if (
    !isAuthenticationCombinationValid(
      record.principalType,
      record.authenticationMethod,
      record.provider
    )
  ) {
    fail('UNTRUSTED_AUTHORITY');
  }
  return Object.freeze({
    schemaVersion: TRUSTED_SERVER_PRINCIPAL_VERSION,
    principalId: record.principalId,
    principalType: record.principalType,
    authenticationMethod: record.authenticationMethod,
    provider: record.provider,
    authenticatedAt: record.authenticatedAt,
    ...(record.claimsFingerprint !== undefined
      ? { claimsFingerprint: record.claimsFingerprint }
      : {}),
  });
}

export function validateTrustedTenantMembershipV1(
  value: unknown
): TrustedTenantMembershipV1 {
  const record = getClosedRecord(
    value,
    [
      'schemaVersion',
      'tenantId',
      'principalId',
      'membershipId',
      'roles',
      'status',
      'resolvedAt',
      'resolverVersion',
    ],
    ['evidenceFingerprint']
  );
  if (
    !record ||
    record.schemaVersion !== TRUSTED_TENANT_MEMBERSHIP_VERSION ||
    !isCanonicalIdentifier(record.tenantId) ||
    record.tenantId.toLowerCase() === 'aura_root' ||
    !isCanonicalIdentifier(record.principalId) ||
    !isCanonicalIdentifier(record.membershipId) ||
    !Array.isArray(record.roles) ||
    record.roles.length === 0 ||
    !record.roles.every((role) =>
      isOneOf(role, TRUSTED_TENANT_MEMBERSHIP_ROLES)
    ) ||
    new Set(record.roles).size !== record.roles.length ||
    !isOneOf(
      record.status,
      TRUSTED_TENANT_MEMBERSHIP_STATUSES
    ) ||
    record.status !== 'ACTIVE' ||
    !isCanonicalTimestamp(record.resolvedAt) ||
    !isCanonicalVersion(record.resolverVersion) ||
    (record.evidenceFingerprint !== undefined &&
      !isSha256Fingerprint(record.evidenceFingerprint))
  ) {
    fail('UNTRUSTED_AUTHORITY');
  }
  const roles = Object.freeze(
    [...record.roles].sort() as TrustedTenantMembershipRole[]
  );
  return Object.freeze({
    schemaVersion: TRUSTED_TENANT_MEMBERSHIP_VERSION,
    tenantId: record.tenantId,
    principalId: record.principalId,
    membershipId: record.membershipId,
    roles,
    status: record.status,
    resolvedAt: record.resolvedAt,
    resolverVersion: record.resolverVersion,
    ...(record.evidenceFingerprint !== undefined
      ? { evidenceFingerprint: record.evidenceFingerprint }
      : {}),
  });
}

export function validateTrustedRequestIdentityV1(
  value: unknown
): TrustedRequestIdentityV1 {
  const record = getClosedRecord(value, [
    'schemaVersion',
    'requestId',
    'correlationId',
    'generationStrategy',
    'generatedAt',
    'generatorVersion',
  ]);
  if (
    !record ||
    record.schemaVersion !== TRUSTED_REQUEST_IDENTITY_VERSION ||
    !isCanonicalIdentifier(record.requestId, 8) ||
    !isCanonicalIdentifier(record.correlationId, 8) ||
    !isOneOf(
      record.generationStrategy,
      TRUSTED_REQUEST_GENERATION_STRATEGIES
    ) ||
    !isCanonicalTimestamp(record.generatedAt) ||
    !isCanonicalVersion(record.generatorVersion)
  ) {
    fail('INVALID_CONTRACT');
  }
  return Object.freeze({
    schemaVersion: TRUSTED_REQUEST_IDENTITY_VERSION,
    requestId: record.requestId,
    correlationId: record.correlationId,
    generationStrategy: record.generationStrategy,
    generatedAt: record.generatedAt,
    generatorVersion: record.generatorVersion,
  });
}

export function validateTrustedServerLifecycleV1(
  value: unknown
): TrustedServerLifecycleV1 {
  const record = getClosedRecord(
    value,
    ['schemaVersion', 'transportAborted'],
    ['transportDeadlineAt', 'cancellationSignal']
  );
  if (
    !record ||
    record.schemaVersion !== TRUSTED_SERVER_LIFECYCLE_VERSION ||
    typeof record.transportAborted !== 'boolean' ||
    (record.transportDeadlineAt !== undefined &&
      !isCanonicalTimestamp(record.transportDeadlineAt)) ||
    (record.cancellationSignal !== undefined &&
      !isAbortSignal(record.cancellationSignal))
  ) {
    fail('INVALID_LIFECYCLE');
  }
  if (
    record.cancellationSignal !== undefined &&
    record.cancellationSignal.aborted !== record.transportAborted
  ) {
    fail('INVALID_LIFECYCLE');
  }
  return Object.freeze({
    schemaVersion: TRUSTED_SERVER_LIFECYCLE_VERSION,
    transportAborted: record.transportAborted,
    ...(record.transportDeadlineAt !== undefined
      ? { transportDeadlineAt: record.transportDeadlineAt }
      : {}),
    ...(record.cancellationSignal !== undefined
      ? { cancellationSignal: record.cancellationSignal }
      : {}),
  });
}

export function validateTrustedSanitizedTransportContextV1(
  value: unknown
): TrustedSanitizedTransportContextV1 {
  const record = getClosedRecord(
    value,
    ['schemaVersion'],
    ['traceId', 'region', 'transportName', 'invocationClass']
  );
  if (
    !record ||
    record.schemaVersion !==
      TRUSTED_SANITIZED_TRANSPORT_CONTEXT_VERSION ||
    (record.traceId !== undefined &&
      !isCanonicalIdentifier(record.traceId, 8)) ||
    (record.region !== undefined &&
      (typeof record.region !== 'string' ||
        !/^[a-z][a-z0-9-]{1,62}[a-z0-9]$/.test(record.region))) ||
    (record.transportName !== undefined &&
      !isOneOf(record.transportName, TRUSTED_SERVER_TRANSPORTS)) ||
    (record.invocationClass !== undefined &&
      !isOneOf(
        record.invocationClass,
        TRUSTED_SERVER_INVOCATION_CLASSES
      ))
  ) {
    fail('INVALID_CONTRACT');
  }
  return Object.freeze({
    schemaVersion: TRUSTED_SANITIZED_TRANSPORT_CONTEXT_VERSION,
    ...(record.traceId !== undefined
      ? { traceId: record.traceId }
      : {}),
    ...(record.region !== undefined ? { region: record.region } : {}),
    ...(record.transportName !== undefined
      ? { transportName: record.transportName }
      : {}),
    ...(record.invocationClass !== undefined
      ? { invocationClass: record.invocationClass }
      : {}),
  });
}

export function resolveTrustedRegistrySelectionV1(
  value: unknown
): TrustedRegistrySelectionV1 {
  const record = getClosedRecord(value, [
    'consumer',
    'source',
    'transport',
    'requestedExecutionMode',
  ]);
  if (
    !record ||
    TRUSTED_CONSUMER_REGISTRY_V1.schemaVersion !==
      TRUSTED_COMPOSITION_REGISTRY_VERSION ||
    TRUSTED_SOURCE_REGISTRY_V1.schemaVersion !==
      TRUSTED_COMPOSITION_REGISTRY_VERSION ||
    record.consumer !== 'INTELLIGENCE_OS_CONTRACT_TEST' ||
    record.source !== 'TRUSTED_COMPOSITION_CONTRACT_TEST' ||
    !isOneOf(record.transport, TRUSTED_SERVER_TRANSPORTS) ||
    (record.requestedExecutionMode !== 'SHADOW_ONLY' &&
      record.requestedExecutionMode !== 'EVALUATION')
  ) {
    fail('REGISTRY_DENIED');
  }
  const consumer = TRUSTED_CONSUMER_REGISTRY_V1.entries[record.consumer];
  const source = TRUSTED_SOURCE_REGISTRY_V1.entries[record.source];
  if (
    !consumer.enabled ||
    !source.enabled ||
    consumer.version !== '1' ||
    source.version !== '1' ||
    consumer.contractVersion !==
      TRUSTED_SERVER_REQUEST_CONTEXT_VERSION ||
    source.contractVersion !==
      TRUSTED_SERVER_REQUEST_CONTEXT_VERSION ||
    !consumer.allowedTransports.includes(record.transport) ||
    !source.allowedTransports.includes(record.transport) ||
    !consumer.allowedExecutionModes.includes(
      record.requestedExecutionMode
    ) ||
    !source.allowedExecutionModes.includes(
      record.requestedExecutionMode
    ) ||
    !source.allowedConsumerIds.includes(record.consumer)
  ) {
    fail('REGISTRY_DENIED');
  }
  return Object.freeze({
    registryVersion: TRUSTED_COMPOSITION_REGISTRY_VERSION,
    consumer,
    source,
    transport: record.transport,
    requestedExecutionMode: record.requestedExecutionMode,
  });
}

export function validateTrustedServerRequestContextV1(
  value: unknown
): TrustedServerRequestContextV1 {
  const record = getClosedRecord(
    value,
    REQUEST_CONTEXT_KEYS,
    ['sanitizedTransportContext']
  );
  if (
    !record ||
    record.schemaVersion !== TRUSTED_SERVER_REQUEST_CONTEXT_VERSION ||
    !isOneOf(record.transport, TRUSTED_SERVER_TRANSPORTS) ||
    !isCanonicalTimestamp(record.initiatedAt) ||
    (record.requestedExecutionMode !== 'SHADOW_ONLY' &&
      record.requestedExecutionMode !== 'EVALUATION')
  ) {
    fail('INVALID_CONTRACT');
  }
  const principal = validateTrustedServerPrincipalV1(
    record.authenticatedPrincipal
  );
  const membership = validateTrustedTenantMembershipV1(
    record.tenantMembership
  );
  const identity = validateTrustedRequestIdentityV1(
    record.requestIdentity
  );
  const cancellation = validateTrustedServerLifecycleV1(
    record.cancellation
  );
  if (
    membership.principalId !== principal.principalId ||
    !rolesMatchPrincipal(membership.roles, principal.principalType)
  ) {
    fail('UNTRUSTED_AUTHORITY');
  }
  const initiatedAt = canonicalTimestampMilliseconds(record.initiatedAt);
  const authenticatedAt = canonicalTimestampMilliseconds(
    principal.authenticatedAt
  );
  const resolvedAt = canonicalTimestampMilliseconds(
    membership.resolvedAt
  );
  const generatedAt = canonicalTimestampMilliseconds(
    identity.generatedAt
  );
  if (
    initiatedAt === undefined ||
    authenticatedAt === undefined ||
    resolvedAt === undefined ||
    generatedAt === undefined ||
    authenticatedAt > initiatedAt ||
    resolvedAt > initiatedAt ||
    generatedAt > initiatedAt
  ) {
    fail('UNTRUSTED_AUTHORITY');
  }
  if (
    cancellation.transportDeadlineAt !== undefined &&
    canonicalTimestampMilliseconds(
      cancellation.transportDeadlineAt
    )! <= initiatedAt
  ) {
    fail('INVALID_LIFECYCLE');
  }
  const selection = resolveTrustedRegistrySelectionV1({
    consumer: record.consumer,
    source: record.source,
    transport: record.transport,
    requestedExecutionMode: record.requestedExecutionMode,
  });
  if (
    record.transport === 'INTERNAL_TEST' &&
    (principal.authenticationMethod !==
      'INTERNAL_TEST_ASSERTION' ||
      principal.provider !== 'AURA_INTERNAL_TEST' ||
      identity.generationStrategy !== 'DETERMINISTIC_TEST')
  ) {
    fail('UNTRUSTED_AUTHORITY');
  }
  const sanitizedTransportContext =
    record.sanitizedTransportContext === undefined
      ? undefined
      : validateTrustedSanitizedTransportContextV1(
          record.sanitizedTransportContext
        );
  if (
    sanitizedTransportContext?.transportName !== undefined &&
    sanitizedTransportContext.transportName !== record.transport
  ) {
    fail('INVALID_CONTRACT');
  }
  return Object.freeze({
    schemaVersion: TRUSTED_SERVER_REQUEST_CONTEXT_VERSION,
    transport: selection.transport,
    authenticatedPrincipal: principal,
    tenantMembership: membership,
    consumer: selection.consumer.id,
    source: selection.source.id,
    requestIdentity: identity,
    initiatedAt: record.initiatedAt,
    requestedExecutionMode: selection.requestedExecutionMode,
    cancellation,
    ...(sanitizedTransportContext !== undefined
      ? { sanitizedTransportContext }
      : {}),
  });
}

export function validateTrustedAuthenticationReferenceV1(
  value: unknown
): TrustedAuthenticationReferenceV1 {
  const record = getClosedRecord(value, [
    'schemaVersion',
    'referenceId',
    'provider',
    'transport',
    'observedAt',
  ]);
  if (
    !record ||
    record.schemaVersion !== TRUSTED_RESOLVER_INPUT_VERSION ||
    !isCanonicalIdentifier(record.referenceId, 8) ||
    !isOneOf(record.provider, TRUSTED_AUTHENTICATION_PROVIDERS) ||
    !isOneOf(record.transport, TRUSTED_SERVER_TRANSPORTS) ||
    !isCanonicalTimestamp(record.observedAt)
  ) {
    fail('INVALID_CONTRACT');
  }
  return Object.freeze({
    schemaVersion: TRUSTED_RESOLVER_INPUT_VERSION,
    referenceId: record.referenceId,
    provider: record.provider,
    transport: record.transport,
    observedAt: record.observedAt,
  });
}

export function validateTrustedResourceScopeV1(
  value: unknown
): TrustedResourceScopeV1 {
  const record = getClosedRecord(value, [
    'schemaVersion',
    'resourceType',
    'resourceId',
  ]);
  if (
    !record ||
    record.schemaVersion !== TRUSTED_RESOLVER_INPUT_VERSION ||
    !isOneOf(record.resourceType, TRUSTED_RESOURCE_SCOPE_TYPES) ||
    !isCanonicalIdentifier(record.resourceId)
  ) {
    fail('INVALID_CONTRACT');
  }
  return Object.freeze({
    schemaVersion: TRUSTED_RESOLVER_INPUT_VERSION,
    resourceType: record.resourceType,
    resourceId: record.resourceId,
  });
}

export function validateTrustedPrincipalResolutionInputV1(
  value: unknown
): TrustedPrincipalResolutionInputV1 {
  const record = getClosedRecord(value, [
    'schemaVersion',
    'authenticationReference',
  ]);
  if (
    !record ||
    record.schemaVersion !== TRUSTED_RESOLVER_INPUT_VERSION
  ) {
    fail('INVALID_CONTRACT');
  }
  return Object.freeze({
    schemaVersion: TRUSTED_RESOLVER_INPUT_VERSION,
    authenticationReference:
      validateTrustedAuthenticationReferenceV1(
        record.authenticationReference
      ),
  });
}

export function validateTrustedTenantAuthorityResolutionInputV1(
  value: unknown
): TrustedTenantAuthorityResolutionInputV1 {
  const record = getClosedRecord(value, [
    'schemaVersion',
    'principal',
    'resourceScope',
    'consumer',
    'source',
  ]);
  if (
    !record ||
    record.schemaVersion !== TRUSTED_RESOLVER_INPUT_VERSION ||
    record.consumer !== 'INTELLIGENCE_OS_CONTRACT_TEST' ||
    record.source !== 'TRUSTED_COMPOSITION_CONTRACT_TEST'
  ) {
    fail('INVALID_CONTRACT');
  }
  return Object.freeze({
    schemaVersion: TRUSTED_RESOLVER_INPUT_VERSION,
    principal: validateTrustedServerPrincipalV1(record.principal),
    resourceScope: validateTrustedResourceScopeV1(
      record.resourceScope
    ),
    consumer: record.consumer,
    source: record.source,
  });
}

function responseContract(
  status: TrustedServerExecutionStatus
): Readonly<{
  safeCode: TrustedServerResponseSafeCode;
  safeMessage: string;
}> {
  const contracts: Readonly<
    Record<
      TrustedServerExecutionStatus,
      Readonly<{
        safeCode: TrustedServerResponseSafeCode;
        safeMessage: string;
      }>
    >
  > = Object.freeze({
    COMPLETED: Object.freeze({
      safeCode: 'EXECUTION_COMPLETED',
      safeMessage: 'Execution completed',
    }),
    REJECTED: Object.freeze({
      safeCode: 'REQUEST_REJECTED',
      safeMessage: 'Request rejected',
    }),
    CANCELLED: Object.freeze({
      safeCode: 'REQUEST_CANCELLED',
      safeMessage: 'Request cancelled',
    }),
    TIMED_OUT: Object.freeze({
      safeCode: 'REQUEST_TIMED_OUT',
      safeMessage: 'Request timed out',
    }),
    INTERNAL_ERROR: Object.freeze({
      safeCode: 'INTERNAL_ERROR',
      safeMessage: 'An internal error occurred',
    }),
  });
  return contracts[status];
}

function sanitizeResultSummary(
  value: unknown
): TrustedServerResultSummaryV1 {
  if (!isPlainRecord(value)) {
    fail('INVALID_RESPONSE');
  }
  if (
    !isOneOf(value.outcome, TRUSTED_SERVER_RESULT_OUTCOMES) ||
    !Number.isSafeInteger(value.warningCount) ||
    (value.warningCount as number) < 0 ||
    (value.durationMs !== undefined &&
      (!Number.isSafeInteger(value.durationMs) ||
        (value.durationMs as number) < 0))
  ) {
    fail('INVALID_RESPONSE');
  }
  return Object.freeze({
    outcome: value.outcome,
    warningCount: value.warningCount as number,
    ...(value.durationMs !== undefined
      ? { durationMs: value.durationMs as number }
      : {}),
  });
}

export function sanitizeTrustedServerExecutionResponseV1(
  value: unknown
): TrustedServerExecutionResponseV1 {
  if (!isPlainRecord(value)) {
    fail('INVALID_RESPONSE');
  }
  const {
    requestId,
    correlationId,
    status,
    completedAt,
    executionId,
    resultSummary,
  } = value;
  if (
    !isCanonicalIdentifier(requestId, 8) ||
    !isCanonicalIdentifier(correlationId, 8) ||
    !isOneOf(status, TRUSTED_SERVER_RESPONSE_STATUSES) ||
    !isCanonicalTimestamp(completedAt)
  ) {
    fail('INVALID_RESPONSE');
  }
  const contract = responseContract(status);
  if (status === 'COMPLETED') {
    if (!isCanonicalIdentifier(executionId, 8)) {
      fail('INVALID_RESPONSE');
    }
    const safeSummary =
      resultSummary === undefined
        ? undefined
        : sanitizeResultSummary(resultSummary);
    return Object.freeze({
      schemaVersion: TRUSTED_SERVER_RESPONSE_VERSION,
      requestId,
      correlationId,
      status,
      safeCode: 'EXECUTION_COMPLETED',
      safeMessage: 'Execution completed',
      executionId,
      ...(safeSummary !== undefined
        ? { resultSummary: safeSummary }
        : {}),
      completedAt,
    });
  }
  if (executionId !== undefined || resultSummary !== undefined) {
    fail('INVALID_RESPONSE');
  }
  return Object.freeze({
    schemaVersion: TRUSTED_SERVER_RESPONSE_VERSION,
    requestId,
    correlationId,
    status,
    safeCode: contract.safeCode,
    safeMessage: contract.safeMessage,
    completedAt,
  }) as TrustedServerExecutionResponseV1;
}

export function validateTrustedServerExecutionResponseV1(
  value: unknown
): TrustedServerExecutionResponseV1 {
  const record = getClosedRecord(
    value,
    [
      'schemaVersion',
      'requestId',
      'correlationId',
      'status',
      'safeCode',
      'safeMessage',
      'completedAt',
    ],
    ['executionId', 'resultSummary']
  );
  if (
    !record ||
    record.schemaVersion !== TRUSTED_SERVER_RESPONSE_VERSION ||
    !isCanonicalIdentifier(record.requestId, 8) ||
    !isCanonicalIdentifier(record.correlationId, 8) ||
    !isOneOf(record.status, TRUSTED_SERVER_RESPONSE_STATUSES) ||
    !isOneOf(record.safeCode, TRUSTED_SERVER_RESPONSE_SAFE_CODES) ||
    typeof record.safeMessage !== 'string' ||
    !isCanonicalTimestamp(record.completedAt)
  ) {
    fail('INVALID_RESPONSE');
  }
  const expected = responseContract(record.status);
  if (
    record.safeCode !== expected.safeCode ||
    record.safeMessage !== expected.safeMessage
  ) {
    fail('INVALID_RESPONSE');
  }
  return sanitizeTrustedServerExecutionResponseV1(record);
}

function hasMethod(value: unknown, method: string): boolean {
  if (
    (typeof value !== 'object' && typeof value !== 'function') ||
    value === null
  ) {
    return false;
  }
  try {
    return (
      typeof (value as Readonly<Record<string, unknown>>)[method] ===
      'function'
    );
  } catch {
    return false;
  }
}

export function validateTrustedCompositionRootDependencies(
  value: unknown
): TrustedCompositionRootDependencies {
  const record = getClosedRecord(
    value,
    [
      'featurePolicyPort',
      'executionPort',
      'clockPort',
      'auditPort',
      'requestIdentityFactory',
      'registry',
      'tenantAuthorityResolver',
      'principalResolver',
      'responseSanitizer',
    ],
    ['cancellationAdapter']
  );
  if (
    !record ||
    !hasMethod(record.featurePolicyPort, 'getEffectivePolicy') ||
    !hasMethod(
      record.featurePolicyPort,
      'evaluateAuthoritativePolicy'
    ) ||
    !hasMethod(record.executionPort, 'execute') ||
    !hasMethod(record.clockPort, 'now') ||
    !hasMethod(record.auditPort, 'logEvent') ||
    !hasMethod(record.requestIdentityFactory, 'createIdentity') ||
    !hasMethod(record.registry, 'resolve') ||
    !hasMethod(
      record.tenantAuthorityResolver,
      'resolveMembership'
    ) ||
    !hasMethod(record.principalResolver, 'resolvePrincipal') ||
    !hasMethod(record.responseSanitizer, 'sanitize') ||
    (record.cancellationAdapter !== undefined &&
      !hasMethod(record.cancellationAdapter, 'adapt'))
  ) {
    fail('INVALID_DEPENDENCIES');
  }
  return Object.freeze({
    featurePolicyPort:
      record.featurePolicyPort as TrustedCompositionRootDependencies['featurePolicyPort'],
    executionPort:
      record.executionPort as TrustedCompositionRootDependencies['executionPort'],
    clockPort:
      record.clockPort as TrustedCompositionRootDependencies['clockPort'],
    auditPort:
      record.auditPort as TrustedCompositionRootDependencies['auditPort'],
    requestIdentityFactory:
      record.requestIdentityFactory as TrustedCompositionRootDependencies['requestIdentityFactory'],
    registry:
      record.registry as TrustedCompositionRootDependencies['registry'],
    tenantAuthorityResolver:
      record.tenantAuthorityResolver as TrustedCompositionRootDependencies['tenantAuthorityResolver'],
    principalResolver:
      record.principalResolver as TrustedCompositionRootDependencies['principalResolver'],
    responseSanitizer:
      record.responseSanitizer as TrustedCompositionRootDependencies['responseSanitizer'],
    ...(record.cancellationAdapter !== undefined
      ? {
          cancellationAdapter:
            record.cancellationAdapter as TrustedCompositionRootDependencies['cancellationAdapter'],
        }
      : {}),
  });
}
