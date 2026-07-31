import {
  AUTHORITY_AUTHORIZATION_CHANNELS,
  AUTHORITY_AUTHORIZATION_DECISIONS,
  AUTHORITY_AUTHORIZATION_DECISION_REASON_CODES,
  AUTHORITY_AUTHORIZATION_OBLIGATION_TYPES,
  AUTHORITY_AUTHORIZATION_RESOURCE_TYPES,
  AUTHORITY_PERMISSIONS,
  type AuthorityPermissionV1,
} from '../serverAuthorityAuthorization/authorityAuthorizationTypes';
import {
  AUTHORITY_AUTHENTICATION_ASSURANCE_LEVELS,
  AUTHORITY_AUTHENTICATION_METHODS,
  AUTHORITY_PRINCIPAL_STATUSES,
  AUTHORITY_PRINCIPAL_TYPES,
} from '../serverPrincipalResolution/principalResolutionTypes';
import {
  AUTHORITY_PLATFORM_BOUNDARIES,
  AUTHORITY_PLATFORM_OPERATION_CATEGORIES,
  AUTHORITY_SUPPORT_IMPERSONATION_MODES,
  AUTHORITY_TENANT_SCOPE_STATUSES,
  AUTHORITY_TENANT_SCOPE_TYPES,
} from '../serverTenantScopeResolution/tenantScopeResolutionTypes';
import {
  AuthorityInvocationContextValidationError,
  type AuthorityInvocationContextContractIssue,
} from './authorityInvocationContextErrors';
import {
  AUTHORITY_INVOCATION_AUTHORIZATION_PROJECTION_VERSION,
  AUTHORITY_INVOCATION_AUTHORIZATION_STATUSES,
  AUTHORITY_INVOCATION_CONTEXT_REASON_CODES,
  AUTHORITY_INVOCATION_CONTEXT_RESULT_STATUSES,
  AUTHORITY_INVOCATION_CONTEXT_RESULT_VERSION,
  AUTHORITY_INVOCATION_CONTEXT_RETRY_DISPOSITIONS,
  AUTHORITY_INVOCATION_CONTEXT_STATUSES,
  AUTHORITY_INVOCATION_CONTEXT_VERSION,
  AUTHORITY_INVOCATION_FRESHNESS_VERSION,
  AUTHORITY_INVOCATION_IDEMPOTENCY_VERSION,
  AUTHORITY_INVOCATION_OPERATION_BINDING_VERSION,
  AUTHORITY_INVOCATION_PRINCIPAL_PROJECTION_VERSION,
  AUTHORITY_INVOCATION_REQUEST_METADATA_VERSION,
  AUTHORITY_INVOCATION_SCOPE_PROJECTION_VERSION,
  AUTHORITY_OBLIGATION_SATISFACTION_EVIDENCE_VERSION,
  AUTHORITY_OBLIGATION_SATISFACTION_STATUSES,
  AUTHORITY_OBLIGATION_SATISFACTION_SUMMARY_VERSION,
  type AuthorityInvocationAuthorizationProjectionV1,
  type AuthorityInvocationContextReasonCode,
  type AuthorityInvocationContextResultV1,
  type AuthorityInvocationContextSafeMetadataV1,
  type AuthorityInvocationContextV1,
  type AuthorityInvocationFreshnessV1,
  type AuthorityInvocationIdempotencyV1,
  type AuthorityInvocationOperationBindingV1,
  type AuthorityInvocationPrincipalProjectionV1,
  type AuthorityInvocationRequestMetadataV1,
  type AuthorityInvocationScopeProjectionV1,
  type AuthorityObligationSatisfactionEvidenceV1,
  type AuthorityObligationSatisfactionSummaryV1,
} from './authorityInvocationContextTypes';

type PlainRecord = Record<string, unknown>;

const AUTHORITY_OPERATION_TYPES = Object.freeze([
  'CREATE_TENANT_AUTHORITY',
  'UPDATE_TENANT_STATUS',
  'CREATE_TENANT_MEMBERSHIP',
  'UPDATE_TENANT_MEMBERSHIP_ROLES',
  'CHANGE_TENANT_MEMBERSHIP_STATUS',
  'RESERVE_TENANT_ALIAS',
  'TOMBSTONE_TENANT_ALIAS',
  'CANONICALIZE_LEGACY_TENANT',
] as const);

const OPERATION_PERMISSIONS: Readonly<
  Record<(typeof AUTHORITY_OPERATION_TYPES)[number], AuthorityPermissionV1>
> = Object.freeze({
  CREATE_TENANT_AUTHORITY: 'authority.tenant.create',
  UPDATE_TENANT_STATUS: 'authority.tenant.status.update',
  CREATE_TENANT_MEMBERSHIP: 'authority.membership.create',
  UPDATE_TENANT_MEMBERSHIP_ROLES:
    'authority.membership.roles.update',
  CHANGE_TENANT_MEMBERSHIP_STATUS:
    'authority.membership.status.update',
  RESERVE_TENANT_ALIAS: 'authority.alias.reserve',
  TOMBSTONE_TENANT_ALIAS: 'authority.alias.tombstone',
  CANONICALIZE_LEGACY_TENANT: 'authority.legacy.canonicalize',
});

const OPERATION_RESOURCE_TYPES = Object.freeze({
  CREATE_TENANT_AUTHORITY: 'TENANT',
  UPDATE_TENANT_STATUS: 'TENANT',
  CREATE_TENANT_MEMBERSHIP: 'MEMBERSHIP',
  UPDATE_TENANT_MEMBERSHIP_ROLES: 'MEMBERSHIP',
  CHANGE_TENANT_MEMBERSHIP_STATUS: 'MEMBERSHIP',
  RESERVE_TENANT_ALIAS: 'ALIAS',
  TOMBSTONE_TENANT_ALIAS: 'ALIAS',
  CANONICALIZE_LEGACY_TENANT: 'LEGACY_TENANT_SOURCE',
} as const);

function fail(
  issue: AuthorityInvocationContextContractIssue,
  field?: string,
  reasonCode: AuthorityInvocationContextReasonCode =
    'INVALID_INVOCATION_CONTEXT',
): never {
  throw new AuthorityInvocationContextValidationError(
    issue,
    field,
    reasonCode,
  );
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
  issue: AuthorityInvocationContextContractIssue,
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
    return fail('INVALID_LITERAL', field);
  }
  return expected;
}

function enumValue<T extends string>(
  value: unknown,
  values: readonly T[],
  field: string,
): T {
  if (typeof value !== 'string' || !values.includes(value as T)) {
    return fail('INVALID_LITERAL', field);
  }
  return value as T;
}

function identifier(
  value: unknown,
  field: string,
  minimum = 3,
  maximum = 160,
): string {
  if (
    typeof value !== 'string' ||
    value.length < minimum ||
    value.length > maximum ||
    value.trim() !== value ||
    !/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(value) ||
    value.toLowerCase() === 'aura_root'
  ) {
    return fail('INVALID_IDENTIFIER', field);
  }
  return value;
}

function reference(value: unknown, field: string): string {
  if (
    typeof value !== 'string' ||
    value.length < 3 ||
    value.length > 256 ||
    value.trim() !== value ||
    /\s/.test(value) ||
    value.includes('..') ||
    value.includes('/') ||
    value.includes('\\') ||
    value.includes('*') ||
    value.includes('://') ||
    /^(?:allow|role|token|claims?)$/i.test(value)
  ) {
    return fail('INVALID_REFERENCE', field);
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
    return fail('INVALID_VERSION', field);
  }
  return value;
}

function fingerprint(value: unknown, field: string): string {
  if (
    typeof value !== 'string' ||
    !/^sha256:[a-f0-9]{64}$/.test(value)
  ) {
    return fail('INVALID_FINGERPRINT', field);
  }
  return value;
}

function timestamp(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    return fail('INVALID_TIMESTAMP', field);
  }
  const milliseconds = Date.parse(value);
  if (
    !Number.isFinite(milliseconds) ||
    new Date(milliseconds).toISOString() !== value
  ) {
    return fail('INVALID_TIMESTAMP', field);
  }
  return value;
}

function positiveInteger(
  value: unknown,
  field: string,
  maximum = 86_400,
): number {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > maximum
  ) {
    return fail('INVALID_DURATION', field);
  }
  return value;
}

function optional<T>(
  value: unknown,
  validator: (input: unknown) => T,
): T | undefined {
  return value === undefined ? undefined : validator(value);
}

function requireOrder(
  earlier: string,
  later: string,
  field: string,
  allowEqual = false,
): void {
  const delta = Date.parse(later) - Date.parse(earlier);
  if (delta < 0 || (!allowEqual && delta === 0)) {
    return fail('INVALID_TIME_ORDER', field);
  }
}

function frozenStrings<T extends string>(
  value: unknown,
  values: readonly T[],
  field: string,
  allowEmpty = false,
): readonly T[] {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
    return fail('INVALID_RECORD', field);
  }
  const result = value.map((item) => enumValue(item, values, field));
  if (new Set(result).size !== result.length) {
    return fail('INVALID_RECORD', field);
  }
  return Object.freeze(result);
}

function frozenIdentifiers(
  value: unknown,
  field: string,
): readonly string[] {
  if (!Array.isArray(value) || value.length === 0) {
    return fail('INVALID_RECORD', field);
  }
  const result = value.map((item) => identifier(item, field));
  if (new Set(result).size !== result.length) {
    return fail('INVALID_RECORD', field);
  }
  return Object.freeze(result);
}

export function validateAuthorityInvocationPrincipalProjectionV1(
  value: unknown,
): AuthorityInvocationPrincipalProjectionV1 {
  const record = closedRecord(
    value,
    [
      'schemaVersion',
      'principalId',
      'principalType',
      'principalStatus',
      'authenticationMethod',
      'assuranceLevel',
      'principalBindingVersion',
      'principalEvidenceFingerprint',
      'principalResolvedAt',
      'principalValidUntil',
    ],
    'INVALID_PRINCIPAL_PROJECTION',
    'principal',
  );
  const principalResolvedAt = timestamp(
    record.principalResolvedAt,
    'principal.principalResolvedAt',
  );
  const principalValidUntil = timestamp(
    record.principalValidUntil,
    'principal.principalValidUntil',
  );
  requireOrder(
    principalResolvedAt,
    principalValidUntil,
    'principal.principalValidUntil',
  );
  const principalType = enumValue(
    record.principalType,
    AUTHORITY_PRINCIPAL_TYPES,
    'principal.principalType',
  );
  const authenticationMethod = enumValue(
    record.authenticationMethod,
    AUTHORITY_AUTHENTICATION_METHODS,
    'principal.authenticationMethod',
  );
  const authenticationMatches =
    (principalType === 'HUMAN_USER' &&
      authenticationMethod === 'FIREBASE_ID_TOKEN') ||
    (principalType === 'INTERNAL_SERVICE' &&
      (authenticationMethod === 'IAM_OIDC' ||
        authenticationMethod === 'SERVICE_ACCOUNT_ASSERTION')) ||
    (principalType === 'SYSTEM_ACTOR' &&
      authenticationMethod === 'INTERNAL_SYSTEM_CAPABILITY') ||
    (principalType === 'MIGRATION_ACTOR' &&
      authenticationMethod === 'MIGRATION_CAPABILITY') ||
    (principalType === 'SUPPORT_OPERATOR' &&
      authenticationMethod === 'SUPPORT_SESSION');
  if (!authenticationMatches) {
    return fail(
      'INVALID_PRINCIPAL_PROJECTION',
      'principal.authenticationMethod',
    );
  }
  return Object.freeze({
    schemaVersion: literal(
      record.schemaVersion,
      AUTHORITY_INVOCATION_PRINCIPAL_PROJECTION_VERSION,
      'principal.schemaVersion',
    ),
    principalId: identifier(record.principalId, 'principal.principalId'),
    principalType,
    principalStatus: enumValue(
      record.principalStatus,
      AUTHORITY_PRINCIPAL_STATUSES,
      'principal.principalStatus',
    ),
    authenticationMethod,
    assuranceLevel: enumValue(
      record.assuranceLevel,
      AUTHORITY_AUTHENTICATION_ASSURANCE_LEVELS,
      'principal.assuranceLevel',
    ),
    principalBindingVersion: version(
      record.principalBindingVersion,
      'principal.principalBindingVersion',
    ),
    principalEvidenceFingerprint: fingerprint(
      record.principalEvidenceFingerprint,
      'principal.principalEvidenceFingerprint',
    ),
    principalResolvedAt,
    principalValidUntil,
  });
}

const SCOPE_BASE_KEYS = [
  'schemaVersion',
  'scopeType',
  'scopeStatus',
  'scopeEvidenceFingerprint',
  'scopeResolvedAt',
  'scopeValidUntil',
  'bindingVersion',
] as const;

function scopeBase(record: PlainRecord) {
  const scopeResolvedAt = timestamp(
    record.scopeResolvedAt,
    'scope.scopeResolvedAt',
  );
  const scopeValidUntil = timestamp(
    record.scopeValidUntil,
    'scope.scopeValidUntil',
  );
  requireOrder(scopeResolvedAt, scopeValidUntil, 'scope.scopeValidUntil');
  return {
    schemaVersion: literal(
      record.schemaVersion,
      AUTHORITY_INVOCATION_SCOPE_PROJECTION_VERSION,
      'scope.schemaVersion',
    ),
    scopeType: enumValue(
      record.scopeType,
      AUTHORITY_TENANT_SCOPE_TYPES,
      'scope.scopeType',
    ),
    scopeStatus: enumValue(
      record.scopeStatus,
      AUTHORITY_TENANT_SCOPE_STATUSES,
      'scope.scopeStatus',
    ),
    scopeEvidenceFingerprint: fingerprint(
      record.scopeEvidenceFingerprint,
      'scope.scopeEvidenceFingerprint',
    ),
    scopeResolvedAt,
    scopeValidUntil,
    bindingVersion: version(
      record.bindingVersion,
      'scope.bindingVersion',
    ),
  };
}

export function validateAuthorityInvocationScopeProjectionV1(
  value: unknown,
): AuthorityInvocationScopeProjectionV1 {
  if (!isPlainRecord(value)) {
    return fail('INVALID_SCOPE_PROJECTION', 'scope');
  }
  const scopeType = enumValue(
    value.scopeType,
    AUTHORITY_TENANT_SCOPE_TYPES,
    'scope.scopeType',
  );
  if (scopeType === 'TENANT') {
    const record = closedRecord(
      value,
      [
        ...SCOPE_BASE_KEYS,
        'tenantId',
        'tenantAuthorityVersion',
        'membershipBindingVersion',
      ],
      'INVALID_SCOPE_PROJECTION',
      'scope',
    );
    const base = scopeBase(record);
    return Object.freeze({
      ...base,
      scopeType,
      tenantId: identifier(record.tenantId, 'scope.tenantId'),
      tenantAuthorityVersion: version(
        record.tenantAuthorityVersion,
        'scope.tenantAuthorityVersion',
      ),
      membershipBindingVersion: version(
        record.membershipBindingVersion,
        'scope.membershipBindingVersion',
      ),
    });
  }
  if (scopeType === 'PLATFORM') {
    const record = closedRecord(
      value,
      [...SCOPE_BASE_KEYS, 'platformBoundary', 'operationCategory'],
      'INVALID_SCOPE_PROJECTION',
      'scope',
    );
    const base = scopeBase(record);
    return Object.freeze({
      ...base,
      scopeType,
      platformBoundary: enumValue(
        record.platformBoundary,
        AUTHORITY_PLATFORM_BOUNDARIES,
        'scope.platformBoundary',
      ),
      operationCategory: enumValue(
        record.operationCategory,
        AUTHORITY_PLATFORM_OPERATION_CATEGORIES,
        'scope.operationCategory',
      ),
    });
  }
  if (scopeType === 'TENANT_BOOTSTRAP') {
    const record = closedRecord(
      value,
      [
        ...SCOPE_BASE_KEYS,
        'bootstrapRequestId',
        'tenantIdCandidate',
        'candidateFingerprint',
      ],
      'INVALID_SCOPE_PROJECTION',
      'scope',
    );
    const base = scopeBase(record);
    return Object.freeze({
      ...base,
      scopeType,
      bootstrapRequestId: identifier(
        record.bootstrapRequestId,
        'scope.bootstrapRequestId',
      ),
      tenantIdCandidate: identifier(
        record.tenantIdCandidate,
        'scope.tenantIdCandidate',
      ),
      candidateFingerprint: fingerprint(
        record.candidateFingerprint,
        'scope.candidateFingerprint',
      ),
    });
  }
  if (scopeType === 'LEGACY_CANONICALIZATION') {
    const record = closedRecord(
      value,
      [
        ...SCOPE_BASE_KEYS,
        'sourceLocatorKey',
        'canonicalTenantCandidateId',
        'sourceFingerprint',
      ],
      'INVALID_SCOPE_PROJECTION',
      'scope',
    );
    const base = scopeBase(record);
    return Object.freeze({
      ...base,
      scopeType,
      sourceLocatorKey: reference(
        record.sourceLocatorKey,
        'scope.sourceLocatorKey',
      ),
      canonicalTenantCandidateId: identifier(
        record.canonicalTenantCandidateId,
        'scope.canonicalTenantCandidateId',
      ),
      sourceFingerprint: fingerprint(
        record.sourceFingerprint,
        'scope.sourceFingerprint',
      ),
    });
  }
  if (scopeType === 'MIGRATION') {
    const record = closedRecord(
      value,
      [
        ...SCOPE_BASE_KEYS,
        'migrationId',
        'migrationRunId',
        'manifestVersion',
        'scopeFingerprint',
        'targetTenantIds',
      ],
      'INVALID_SCOPE_PROJECTION',
      'scope',
    );
    const base = scopeBase(record);
    return Object.freeze({
      ...base,
      scopeType,
      migrationId: identifier(record.migrationId, 'scope.migrationId'),
      migrationRunId: identifier(
        record.migrationRunId,
        'scope.migrationRunId',
      ),
      manifestVersion: version(
        record.manifestVersion,
        'scope.manifestVersion',
      ),
      scopeFingerprint: fingerprint(
        record.scopeFingerprint,
        'scope.scopeFingerprint',
      ),
      targetTenantIds: frozenIdentifiers(
        record.targetTenantIds,
        'scope.targetTenantIds',
      ),
    });
  }
  const record = closedRecord(
    value,
    [
      ...SCOPE_BASE_KEYS,
      'supportSessionId',
      'targetTenantId',
      'sessionValidUntil',
      'impersonationMode',
    ],
    'INVALID_SCOPE_PROJECTION',
    'scope',
  );
  const base = scopeBase(record);
  const sessionValidUntil = timestamp(
    record.sessionValidUntil,
    'scope.sessionValidUntil',
  );
  requireOrder(
    base.scopeResolvedAt,
    sessionValidUntil,
    'scope.sessionValidUntil',
  );
  if (Date.parse(base.scopeValidUntil) > Date.parse(sessionValidUntil)) {
    return fail(
      'INVALID_SCOPE_PROJECTION',
      'scope.scopeValidUntil',
      'SCOPE_STALE',
    );
  }
  return Object.freeze({
    ...base,
    scopeType: 'SUPPORT',
    supportSessionId: identifier(
      record.supportSessionId,
      'scope.supportSessionId',
    ),
    targetTenantId: identifier(
      record.targetTenantId,
      'scope.targetTenantId',
    ),
    sessionValidUntil,
    impersonationMode: enumValue(
      record.impersonationMode,
      AUTHORITY_SUPPORT_IMPERSONATION_MODES,
      'scope.impersonationMode',
    ),
  });
}

export function validateAuthorityInvocationOperationBindingV1(
  value: unknown,
): AuthorityInvocationOperationBindingV1 {
  const record = closedRecord(
    value,
    [
      'schemaVersion',
      'operationType',
      'permission',
      'resourceType',
      'resourceId',
      'resourceTenantId',
      'operationId',
      'commandFingerprint',
      'authorizationInputFingerprint',
      'consumerId',
      'source',
    ],
    'INVALID_OPERATION_BINDING',
    'operation',
  );
  const operationType = enumValue(
    record.operationType,
    AUTHORITY_OPERATION_TYPES,
    'operation.operationType',
  );
  const permission = enumValue(
    record.permission,
    AUTHORITY_PERMISSIONS,
    'operation.permission',
  );
  const resourceType = enumValue(
    record.resourceType,
    AUTHORITY_AUTHORIZATION_RESOURCE_TYPES,
    'operation.resourceType',
  );
  if (
    permission !== OPERATION_PERMISSIONS[operationType] ||
    resourceType !== OPERATION_RESOURCE_TYPES[operationType]
  ) {
    return fail(
      'INVALID_OPERATION_BINDING',
      'operation',
      'OPERATION_PERMISSION_MISMATCH',
    );
  }
  const resourceTenantId = optional(record.resourceTenantId, (input) =>
    identifier(input, 'operation.resourceTenantId'),
  );
  return Object.freeze({
    schemaVersion: literal(
      record.schemaVersion,
      AUTHORITY_INVOCATION_OPERATION_BINDING_VERSION,
      'operation.schemaVersion',
    ),
    operationType,
    permission,
    resourceType,
    resourceId: reference(record.resourceId, 'operation.resourceId'),
    ...(resourceTenantId === undefined ? {} : { resourceTenantId }),
    operationId: identifier(record.operationId, 'operation.operationId'),
    commandFingerprint: fingerprint(
      record.commandFingerprint,
      'operation.commandFingerprint',
    ),
    authorizationInputFingerprint: fingerprint(
      record.authorizationInputFingerprint,
      'operation.authorizationInputFingerprint',
    ),
    consumerId: identifier(record.consumerId, 'operation.consumerId'),
    source: identifier(record.source, 'operation.source'),
  });
}

export function validateAuthorityInvocationAuthorizationProjectionV1(
  value: unknown,
): AuthorityInvocationAuthorizationProjectionV1 {
  const record = closedRecord(
    value,
    [
      'schemaVersion',
      'decision',
      'permission',
      'principalId',
      'scopeType',
      'tenantId',
      'operationType',
      'resourceType',
      'resourceId',
      'resourceTenantId',
      'policyId',
      'policyVersion',
      'decisionRuleId',
      'authorizationFingerprint',
      'authorizationInputFingerprint',
      'evaluatedAt',
      'validUntil',
      'declaredObligationTypes',
      'obligationsFingerprint',
      'reasonCode',
      'status',
    ],
    'INVALID_AUTHORIZATION_PROJECTION',
    'authorization',
  );
  const operationType = enumValue(
    record.operationType,
    AUTHORITY_OPERATION_TYPES,
    'authorization.operationType',
  );
  const permission = enumValue(
    record.permission,
    AUTHORITY_PERMISSIONS,
    'authorization.permission',
  );
  const resourceType = enumValue(
    record.resourceType,
    AUTHORITY_AUTHORIZATION_RESOURCE_TYPES,
    'authorization.resourceType',
  );
  if (
    permission !== OPERATION_PERMISSIONS[operationType] ||
    resourceType !== OPERATION_RESOURCE_TYPES[operationType]
  ) {
    return fail(
      'INVALID_AUTHORIZATION_PROJECTION',
      'authorization',
      'OPERATION_PERMISSION_MISMATCH',
    );
  }
  const evaluatedAt = timestamp(
    record.evaluatedAt,
    'authorization.evaluatedAt',
  );
  const validUntil = timestamp(
    record.validUntil,
    'authorization.validUntil',
  );
  requireOrder(evaluatedAt, validUntil, 'authorization.validUntil');
  const tenantId = optional(record.tenantId, (input) =>
    identifier(input, 'authorization.tenantId'),
  );
  const resourceTenantId = optional(record.resourceTenantId, (input) =>
    identifier(input, 'authorization.resourceTenantId'),
  );
  const decision = enumValue(
    record.decision,
    AUTHORITY_AUTHORIZATION_DECISIONS,
    'authorization.decision',
  );
  const reasonCode = enumValue(
    record.reasonCode,
    AUTHORITY_AUTHORIZATION_DECISION_REASON_CODES,
    'authorization.reasonCode',
  );
  const reasonMatches =
    (decision === 'ALLOW' &&
      (reasonCode === 'POLICY_RULE_MATCHED' ||
        reasonCode === 'REQUIRED_OBLIGATIONS_SATISFIABLE')) ||
    (decision === 'INDETERMINATE' && reasonCode === 'POLICY_NOT_FOUND') ||
    (decision === 'NOT_APPLICABLE' &&
      reasonCode === 'OPERATION_NOT_SUPPORTED') ||
    (decision === 'DENY' &&
      reasonCode !== 'POLICY_RULE_MATCHED' &&
      reasonCode !== 'REQUIRED_OBLIGATIONS_SATISFIABLE' &&
      reasonCode !== 'POLICY_NOT_FOUND');
  if (!reasonMatches) {
    return fail(
      'INVALID_AUTHORIZATION_PROJECTION',
      'authorization.reasonCode',
    );
  }
  return Object.freeze({
    schemaVersion: literal(
      record.schemaVersion,
      AUTHORITY_INVOCATION_AUTHORIZATION_PROJECTION_VERSION,
      'authorization.schemaVersion',
    ),
    decision,
    permission,
    principalId: identifier(
      record.principalId,
      'authorization.principalId',
    ),
    scopeType: enumValue(
      record.scopeType,
      AUTHORITY_TENANT_SCOPE_TYPES,
      'authorization.scopeType',
    ),
    ...(tenantId === undefined ? {} : { tenantId }),
    operationType,
    resourceType,
    resourceId: reference(
      record.resourceId,
      'authorization.resourceId',
    ),
    ...(resourceTenantId === undefined ? {} : { resourceTenantId }),
    policyId: identifier(record.policyId, 'authorization.policyId'),
    policyVersion: version(
      record.policyVersion,
      'authorization.policyVersion',
    ),
    decisionRuleId: identifier(
      record.decisionRuleId,
      'authorization.decisionRuleId',
    ),
    authorizationFingerprint: fingerprint(
      record.authorizationFingerprint,
      'authorization.authorizationFingerprint',
    ),
    authorizationInputFingerprint: fingerprint(
      record.authorizationInputFingerprint,
      'authorization.authorizationInputFingerprint',
    ),
    evaluatedAt,
    validUntil,
    declaredObligationTypes: frozenStrings(
      record.declaredObligationTypes,
      AUTHORITY_AUTHORIZATION_OBLIGATION_TYPES,
      'authorization.declaredObligationTypes',
      true,
    ),
    obligationsFingerprint: fingerprint(
      record.obligationsFingerprint,
      'authorization.obligationsFingerprint',
    ),
    reasonCode,
    status: enumValue(
      record.status,
      AUTHORITY_INVOCATION_AUTHORIZATION_STATUSES,
      'authorization.status',
    ),
  });
}

export function validateAuthorityObligationSatisfactionEvidenceV1(
  value: unknown,
): AuthorityObligationSatisfactionEvidenceV1 {
  const record = closedRecord(
    value,
    [
      'schemaVersion',
      'obligationType',
      'satisfactionStatus',
      'satisfiedAt',
      'evidenceFingerprint',
      'verifierVersion',
      'validUntil',
      'safeReference',
    ],
    'INVALID_OBLIGATION_EVIDENCE',
    'obligationSatisfaction',
  );
  const satisfiedAt = timestamp(
    record.satisfiedAt,
    'obligationSatisfaction.satisfiedAt',
  );
  const validUntil = optional(record.validUntil, (input) =>
    timestamp(input, 'obligationSatisfaction.validUntil'),
  );
  if (validUntil !== undefined) {
    requireOrder(
      satisfiedAt,
      validUntil,
      'obligationSatisfaction.validUntil',
    );
  }
  const safeReference = optional(record.safeReference, (input) =>
    reference(input, 'obligationSatisfaction.safeReference'),
  );
  return Object.freeze({
    schemaVersion: literal(
      record.schemaVersion,
      AUTHORITY_OBLIGATION_SATISFACTION_EVIDENCE_VERSION,
      'obligationSatisfaction.schemaVersion',
    ),
    obligationType: enumValue(
      record.obligationType,
      AUTHORITY_AUTHORIZATION_OBLIGATION_TYPES,
      'obligationSatisfaction.obligationType',
    ),
    satisfactionStatus: enumValue(
      record.satisfactionStatus,
      AUTHORITY_OBLIGATION_SATISFACTION_STATUSES,
      'obligationSatisfaction.satisfactionStatus',
    ),
    satisfiedAt,
    evidenceFingerprint: fingerprint(
      record.evidenceFingerprint,
      'obligationSatisfaction.evidenceFingerprint',
    ),
    verifierVersion: version(
      record.verifierVersion,
      'obligationSatisfaction.verifierVersion',
    ),
    ...(validUntil === undefined ? {} : { validUntil }),
    ...(safeReference === undefined ? {} : { safeReference }),
  });
}

export function validateAuthorityObligationSatisfactionSummaryV1(
  value: unknown,
): AuthorityObligationSatisfactionSummaryV1 {
  const record = closedRecord(
    value,
    [
      'schemaVersion',
      'total',
      'satisfied',
      'notApplicable',
      'stale',
      'notSatisfied',
      'fingerprint',
    ],
    'INVALID_OBLIGATION_SUMMARY',
    'obligationSummary',
  );
  const count = (input: unknown, field: string): number => {
    if (
      typeof input !== 'number' ||
      !Number.isSafeInteger(input) ||
      input < 0 ||
      input > 128
    ) {
      return fail('INVALID_OBLIGATION_SUMMARY', field);
    }
    return input;
  };
  const total = count(record.total, 'obligationSummary.total');
  const satisfied = count(
    record.satisfied,
    'obligationSummary.satisfied',
  );
  const notApplicable = count(
    record.notApplicable,
    'obligationSummary.notApplicable',
  );
  const stale = count(record.stale, 'obligationSummary.stale');
  const notSatisfied = count(
    record.notSatisfied,
    'obligationSummary.notSatisfied',
  );
  if (total !== satisfied + notApplicable + stale + notSatisfied) {
    return fail('INVALID_OBLIGATION_SUMMARY', 'obligationSummary');
  }
  return Object.freeze({
    schemaVersion: literal(
      record.schemaVersion,
      AUTHORITY_OBLIGATION_SATISFACTION_SUMMARY_VERSION,
      'obligationSummary.schemaVersion',
    ),
    total,
    satisfied,
    notApplicable,
    stale,
    notSatisfied,
    fingerprint: fingerprint(
      record.fingerprint,
      'obligationSummary.fingerprint',
    ),
  });
}

export function validateAuthorityInvocationRequestMetadataV1(
  value: unknown,
): AuthorityInvocationRequestMetadataV1 {
  const record = closedRecord(
    value,
    [
      'schemaVersion',
      'requestId',
      'correlationId',
      'causationId',
      'channel',
      'receivedAt',
      'createdAt',
      'traceId',
      'clientRequestIdHash',
    ],
    'INVALID_REQUEST_METADATA',
    'request',
  );
  const receivedAt = timestamp(record.receivedAt, 'request.receivedAt');
  const createdAt = timestamp(record.createdAt, 'request.createdAt');
  requireOrder(receivedAt, createdAt, 'request.createdAt', true);
  const causationId = optional(record.causationId, (input) =>
    identifier(input, 'request.causationId'),
  );
  const traceId = optional(record.traceId, (input) =>
    identifier(input, 'request.traceId'),
  );
  const clientRequestIdHash = optional(
    record.clientRequestIdHash,
    (input) => fingerprint(input, 'request.clientRequestIdHash'),
  );
  return Object.freeze({
    schemaVersion: literal(
      record.schemaVersion,
      AUTHORITY_INVOCATION_REQUEST_METADATA_VERSION,
      'request.schemaVersion',
    ),
    requestId: identifier(record.requestId, 'request.requestId'),
    correlationId: identifier(
      record.correlationId,
      'request.correlationId',
    ),
    ...(causationId === undefined ? {} : { causationId }),
    channel: enumValue(
      record.channel,
      AUTHORITY_AUTHORIZATION_CHANNELS,
      'request.channel',
    ),
    receivedAt,
    createdAt,
    ...(traceId === undefined ? {} : { traceId }),
    ...(clientRequestIdHash === undefined
      ? {}
      : { clientRequestIdHash }),
  });
}

export function validateAuthorityInvocationIdempotencyV1(
  value: unknown,
): AuthorityInvocationIdempotencyV1 {
  const record = closedRecord(
    value,
    [
      'schemaVersion',
      'callerKeyHash',
      'namespaceVersion',
      'scopeFingerprint',
      'principalId',
      'tenantId',
      'operationType',
      'operationId',
      'commandFingerprint',
      'createdAt',
    ],
    'INVALID_IDEMPOTENCY_METADATA',
    'idempotency',
  );
  const tenantId = optional(record.tenantId, (input) =>
    identifier(input, 'idempotency.tenantId'),
  );
  return Object.freeze({
    schemaVersion: literal(
      record.schemaVersion,
      AUTHORITY_INVOCATION_IDEMPOTENCY_VERSION,
      'idempotency.schemaVersion',
    ),
    callerKeyHash: fingerprint(
      record.callerKeyHash,
      'idempotency.callerKeyHash',
    ),
    namespaceVersion: version(
      record.namespaceVersion,
      'idempotency.namespaceVersion',
    ),
    scopeFingerprint: fingerprint(
      record.scopeFingerprint,
      'idempotency.scopeFingerprint',
    ),
    principalId: identifier(
      record.principalId,
      'idempotency.principalId',
    ),
    ...(tenantId === undefined ? {} : { tenantId }),
    operationType: enumValue(
      record.operationType,
      AUTHORITY_OPERATION_TYPES,
      'idempotency.operationType',
    ),
    operationId: identifier(
      record.operationId,
      'idempotency.operationId',
    ),
    commandFingerprint: fingerprint(
      record.commandFingerprint,
      'idempotency.commandFingerprint',
    ),
    createdAt: timestamp(record.createdAt, 'idempotency.createdAt'),
  });
}

export function validateAuthorityInvocationFreshnessV1(
  value: unknown,
): AuthorityInvocationFreshnessV1 {
  const record = closedRecord(
    value,
    [
      'schemaVersion',
      'evaluatedAt',
      'validUntil',
      'principalValidUntil',
      'scopeValidUntil',
      'authorizationValidUntil',
      'obligationValidUntil',
      'staleAfterSeconds',
    ],
    'INVALID_FRESHNESS',
    'freshness',
  );
  const evaluatedAt = timestamp(
    record.evaluatedAt,
    'freshness.evaluatedAt',
  );
  const principalValidUntil = timestamp(
    record.principalValidUntil,
    'freshness.principalValidUntil',
  );
  const scopeValidUntil = timestamp(
    record.scopeValidUntil,
    'freshness.scopeValidUntil',
  );
  const authorizationValidUntil = timestamp(
    record.authorizationValidUntil,
    'freshness.authorizationValidUntil',
  );
  const obligationValidUntil = optional(
    record.obligationValidUntil,
    (input) => timestamp(input, 'freshness.obligationValidUntil'),
  );
  const validUntil = timestamp(
    record.validUntil,
    'freshness.validUntil',
  );
  const limits = [
    principalValidUntil,
    scopeValidUntil,
    authorizationValidUntil,
    ...(obligationValidUntil === undefined
      ? []
      : [obligationValidUntil]),
  ];
  for (const limit of limits) {
    requireOrder(evaluatedAt, limit, 'freshness', false);
  }
  const expectedMinimum = limits.reduce((minimum, candidate) =>
    Date.parse(candidate) < Date.parse(minimum) ? candidate : minimum,
  );
  const staleAfterSeconds = positiveInteger(
    record.staleAfterSeconds,
    'freshness.staleAfterSeconds',
  );
  if (
    validUntil !== expectedMinimum ||
    Date.parse(validUntil) - Date.parse(evaluatedAt) !==
      staleAfterSeconds * 1_000
  ) {
    return fail(
      'INVALID_FRESHNESS',
      'freshness',
      'CONTEXT_FRESHNESS_INVALID',
    );
  }
  return Object.freeze({
    schemaVersion: literal(
      record.schemaVersion,
      AUTHORITY_INVOCATION_FRESHNESS_VERSION,
      'freshness.schemaVersion',
    ),
    evaluatedAt,
    validUntil,
    principalValidUntil,
    scopeValidUntil,
    authorizationValidUntil,
    ...(obligationValidUntil === undefined
      ? {}
      : { obligationValidUntil }),
    staleAfterSeconds,
  });
}

function tenantForScope(
  scope: AuthorityInvocationScopeProjectionV1,
): string | undefined {
  switch (scope.scopeType) {
    case 'TENANT':
      return scope.tenantId;
    case 'TENANT_BOOTSTRAP':
      return scope.tenantIdCandidate;
    case 'LEGACY_CANONICALIZATION':
      return scope.canonicalTenantCandidateId;
    case 'SUPPORT':
      return scope.targetTenantId;
    case 'PLATFORM':
    case 'MIGRATION':
      return undefined;
  }
}

function validateObligations(
  authorization: AuthorityInvocationAuthorizationProjectionV1,
  evidence: readonly AuthorityObligationSatisfactionEvidenceV1[],
  summary: AuthorityObligationSatisfactionSummaryV1,
): void {
  const declared = authorization.declaredObligationTypes;
  const actual = evidence.map((item) => item.obligationType);
  if (
    actual.length !== declared.length ||
    new Set(actual).size !== actual.length ||
    !declared.every((item) => actual.includes(item))
  ) {
    return fail(
      'BINDING_MISMATCH',
      'obligationSatisfaction',
      'OBLIGATION_MISSING',
    );
  }
  const expectedCounts = {
    total: evidence.length,
    satisfied: evidence.filter(
      (item) => item.satisfactionStatus === 'SATISFIED',
    ).length,
    notApplicable: evidence.filter(
      (item) => item.satisfactionStatus === 'NOT_APPLICABLE',
    ).length,
    stale: evidence.filter(
      (item) => item.satisfactionStatus === 'STALE',
    ).length,
    notSatisfied: evidence.filter(
      (item) => item.satisfactionStatus === 'NOT_SATISFIED',
    ).length,
  };
  if (
    summary.total !== expectedCounts.total ||
    summary.satisfied !== expectedCounts.satisfied ||
    summary.notApplicable !== expectedCounts.notApplicable ||
    summary.stale !== expectedCounts.stale ||
    summary.notSatisfied !== expectedCounts.notSatisfied ||
    summary.fingerprint !== authorization.obligationsFingerprint
  ) {
    return fail(
      'BINDING_MISMATCH',
      'obligationSummary',
      'AUTHORIZATION_BINDING_MISMATCH',
    );
  }
}

function validateCrossBindings(context: AuthorityInvocationContextV1): void {
  const {
    principal,
    scope,
    authorization,
    operation,
    idempotency,
    freshness,
    request,
  } = context;
  if (
    principal.principalId !== authorization.principalId ||
    principal.principalId !== idempotency.principalId
  ) {
    return fail(
      'BINDING_MISMATCH',
      'principalId',
      'AUTHORIZATION_BINDING_MISMATCH',
    );
  }
  if (
    scope.scopeType !== authorization.scopeType ||
    scope.scopeEvidenceFingerprint !== idempotency.scopeFingerprint
  ) {
    return fail(
      'BINDING_MISMATCH',
      'scope',
      'AUTHORIZATION_BINDING_MISMATCH',
    );
  }
  if (
    operation.operationType !== authorization.operationType ||
    operation.operationType !== idempotency.operationType ||
    operation.permission !== authorization.permission ||
    operation.operationId !== idempotency.operationId ||
    operation.commandFingerprint !== idempotency.commandFingerprint ||
    operation.authorizationInputFingerprint !==
      authorization.authorizationInputFingerprint ||
    operation.resourceType !== authorization.resourceType ||
    operation.resourceId !== authorization.resourceId ||
    operation.resourceTenantId !== authorization.resourceTenantId
  ) {
    return fail(
      'BINDING_MISMATCH',
      'operation',
      'IDEMPOTENCY_BINDING_MISMATCH',
    );
  }
  const scopeTenant = tenantForScope(scope);
  if (scope.scopeType === 'PLATFORM') {
    if (
      authorization.tenantId !== undefined ||
      authorization.resourceTenantId !== undefined ||
      operation.resourceTenantId !== undefined ||
      idempotency.tenantId !== undefined
    ) {
      return fail(
        'BINDING_MISMATCH',
        'tenantId',
        'TENANT_BINDING_MISMATCH',
      );
    }
  } else if (scope.scopeType === 'MIGRATION') {
    const targetTenant = authorization.tenantId;
    if (
      targetTenant === undefined ||
      !scope.targetTenantIds.includes(targetTenant) ||
      authorization.resourceTenantId !== targetTenant ||
      idempotency.tenantId !== targetTenant
    ) {
      return fail(
        'BINDING_MISMATCH',
        'tenantId',
        'TENANT_BINDING_MISMATCH',
      );
    }
  } else if (
    scopeTenant === undefined ||
    authorization.tenantId !== scopeTenant ||
    authorization.resourceTenantId !== scopeTenant ||
    operation.resourceTenantId !== scopeTenant ||
    idempotency.tenantId !== scopeTenant
  ) {
    return fail(
      'BINDING_MISMATCH',
      'tenantId',
      'TENANT_BINDING_MISMATCH',
    );
  }
  if (
    scopeTenant !== undefined &&
    authorization.resourceType === 'TENANT' &&
    authorization.resourceId !== scopeTenant
  ) {
    return fail(
      'BINDING_MISMATCH',
      'resourceId',
      'RESOURCE_SCOPE_MISMATCH',
    );
  }
  if (
    scope.scopeType === 'LEGACY_CANONICALIZATION' &&
    authorization.resourceId !== scope.sourceLocatorKey
  ) {
    return fail(
      'BINDING_MISMATCH',
      'resourceId',
      'RESOURCE_SCOPE_MISMATCH',
    );
  }
  if (
    scope.scopeType === 'TENANT_BOOTSTRAP' &&
    operation.operationType !== 'CREATE_TENANT_AUTHORITY'
  ) {
    return fail(
      'BINDING_MISMATCH',
      'scope',
      'RESOURCE_SCOPE_MISMATCH',
    );
  }
  if (
    scope.scopeType === 'LEGACY_CANONICALIZATION' &&
    operation.operationType !== 'CANONICALIZE_LEGACY_TENANT'
  ) {
    return fail(
      'BINDING_MISMATCH',
      'scope',
      'RESOURCE_SCOPE_MISMATCH',
    );
  }
  if (
    freshness.evaluatedAt !== authorization.evaluatedAt ||
    freshness.principalValidUntil !== principal.principalValidUntil ||
    freshness.scopeValidUntil !== scope.scopeValidUntil ||
    freshness.authorizationValidUntil !== authorization.validUntil ||
    request.createdAt !== context.createdAt ||
    Date.parse(context.createdAt) < Date.parse(authorization.evaluatedAt) ||
    Date.parse(context.createdAt) >= Date.parse(freshness.validUntil) ||
    Date.parse(idempotency.createdAt) > Date.parse(context.createdAt)
  ) {
    return fail(
      'BINDING_MISMATCH',
      'freshness',
      'CONTEXT_FRESHNESS_INVALID',
    );
  }
  if (
    scope.scopeType === 'SUPPORT' &&
    Date.parse(freshness.validUntil) > Date.parse(scope.sessionValidUntil)
  ) {
    return fail(
      'BINDING_MISMATCH',
      'freshness',
      'CONTEXT_FRESHNESS_INVALID',
    );
  }
}

function validateReady(context: AuthorityInvocationContextV1): void {
  if (context.principal.principalStatus !== 'ACTIVE') {
    return fail(
      'INVALID_CONTEXT',
      'principal.principalStatus',
      'PRINCIPAL_NOT_ACTIVE',
    );
  }
  const allowedScopeStatus =
    context.scope.scopeType === 'TENANT_BOOTSTRAP'
      ? 'PENDING_BOOTSTRAP'
      : context.scope.scopeType === 'LEGACY_CANONICALIZATION'
        ? 'LEGACY_PENDING_CANONICALIZATION'
        : 'ACTIVE';
  if (context.scope.scopeStatus !== allowedScopeStatus) {
    return fail(
      'INVALID_CONTEXT',
      'scope.scopeStatus',
      'SCOPE_NOT_ACTIVE',
    );
  }
  if (context.authorization.decision !== 'ALLOW') {
    return fail(
      'INVALID_CONTEXT',
      'authorization.decision',
      'AUTHORIZATION_NOT_ALLOW',
    );
  }
  if (context.authorization.status !== 'CURRENT') {
    return fail(
      'INVALID_CONTEXT',
      'authorization.status',
      'AUTHORIZATION_STALE',
    );
  }
  if (context.obligationSummary.stale > 0) {
    return fail(
      'INVALID_CONTEXT',
      'obligationSummary',
      'OBLIGATION_STALE',
    );
  }
  if (context.obligationSummary.notSatisfied > 0) {
    return fail(
      'INVALID_CONTEXT',
      'obligationSummary',
      'OBLIGATION_NOT_SATISFIED',
    );
  }
}

export function validateAuthorityInvocationContextV1(
  value: unknown,
): AuthorityInvocationContextV1 {
  const record = closedRecord(
    value,
    [
      'version',
      'principal',
      'scope',
      'authorization',
      'operation',
      'request',
      'idempotency',
      'obligationSatisfaction',
      'obligationSummary',
      'freshness',
      'contextFingerprint',
      'createdAt',
      'status',
    ],
    'INVALID_CONTEXT',
    'context',
  );
  if (!Array.isArray(record.obligationSatisfaction)) {
    return fail(
      'INVALID_OBLIGATION_EVIDENCE',
      'obligationSatisfaction',
    );
  }
  const obligationSatisfaction = Object.freeze(
    record.obligationSatisfaction.map((item) =>
      validateAuthorityObligationSatisfactionEvidenceV1(item),
    ),
  );
  const context: AuthorityInvocationContextV1 = Object.freeze({
    version: literal(
      record.version,
      AUTHORITY_INVOCATION_CONTEXT_VERSION,
      'context.version',
    ),
    principal: validateAuthorityInvocationPrincipalProjectionV1(
      record.principal,
    ),
    scope: validateAuthorityInvocationScopeProjectionV1(record.scope),
    authorization:
      validateAuthorityInvocationAuthorizationProjectionV1(
        record.authorization,
      ),
    operation: validateAuthorityInvocationOperationBindingV1(
      record.operation,
    ),
    request: validateAuthorityInvocationRequestMetadataV1(record.request),
    idempotency: validateAuthorityInvocationIdempotencyV1(
      record.idempotency,
    ),
    obligationSatisfaction,
    obligationSummary:
      validateAuthorityObligationSatisfactionSummaryV1(
        record.obligationSummary,
      ),
    freshness: validateAuthorityInvocationFreshnessV1(record.freshness),
    contextFingerprint: fingerprint(
      record.contextFingerprint,
      'context.contextFingerprint',
    ),
    createdAt: timestamp(record.createdAt, 'context.createdAt'),
    status: enumValue(
      record.status,
      AUTHORITY_INVOCATION_CONTEXT_STATUSES,
      'context.status',
    ),
  });
  validateObligations(
    context.authorization,
    context.obligationSatisfaction,
    context.obligationSummary,
  );
  const obligationLimits = context.obligationSatisfaction
    .map((item) => item.validUntil)
    .filter((item): item is string => item !== undefined);
  const expectedObligationLimit =
    obligationLimits.length === 0
      ? undefined
      : obligationLimits.reduce((minimum, candidate) =>
          Date.parse(candidate) < Date.parse(minimum)
            ? candidate
            : minimum,
        );
  if (
    context.freshness.obligationValidUntil !==
      expectedObligationLimit ||
    context.obligationSatisfaction.some(
      (item) =>
        Date.parse(item.satisfiedAt) > Date.parse(context.createdAt),
    )
  ) {
    return fail(
      'BINDING_MISMATCH',
      'obligationSatisfaction',
      'CONTEXT_FRESHNESS_INVALID',
    );
  }
  validateCrossBindings(context);
  if (context.status === 'READY') {
    validateReady(context);
  } else if (
    context.status === 'NOT_AUTHORIZED' &&
    context.authorization.decision === 'ALLOW'
  ) {
    return fail(
      'INVALID_CONTEXT',
      'context.status',
      'AUTHORIZATION_BINDING_MISMATCH',
    );
  } else if (
    context.status === 'STALE' &&
    context.authorization.status !== 'STALE' &&
    context.obligationSummary.stale === 0
  ) {
    return fail(
      'INVALID_CONTEXT',
      'context.status',
      'CONTEXT_FRESHNESS_INVALID',
    );
  }
  return context;
}

export function validateAuthorityInvocationContextResultV1(
  value: unknown,
): AuthorityInvocationContextResultV1 {
  if (!isPlainRecord(value)) {
    return fail('INVALID_RESULT', 'result');
  }
  const status = enumValue(
    value.status,
    AUTHORITY_INVOCATION_CONTEXT_RESULT_STATUSES,
    'result.status',
  );
  if (status === 'READY') {
    const record = closedRecord(
      value,
      ['schemaVersion', 'status', 'context'],
      'INVALID_RESULT',
      'result',
    );
    const context = validateAuthorityInvocationContextV1(record.context);
    if (context.status !== 'READY') {
      return fail('INVALID_RESULT', 'result.context');
    }
    return Object.freeze({
      schemaVersion: literal(
        record.schemaVersion,
        AUTHORITY_INVOCATION_CONTEXT_RESULT_VERSION,
        'result.schemaVersion',
      ),
      status,
      context,
    });
  }
  const record = closedRecord(
    value,
    [
      'schemaVersion',
      'status',
      'reasonCode',
      'retryDisposition',
      'safeMetadata',
    ],
    'INVALID_RESULT',
    'result',
  );
  const safeMetadata =
    record.safeMetadata === undefined
      ? undefined
      : validateSafeMetadata(record.safeMetadata);
  return Object.freeze({
    schemaVersion: literal(
      record.schemaVersion,
      AUTHORITY_INVOCATION_CONTEXT_RESULT_VERSION,
      'result.schemaVersion',
    ),
    status,
    reasonCode: enumValue(
      record.reasonCode,
      AUTHORITY_INVOCATION_CONTEXT_REASON_CODES,
      'result.reasonCode',
    ),
    retryDisposition: enumValue(
      record.retryDisposition,
      AUTHORITY_INVOCATION_CONTEXT_RETRY_DISPOSITIONS,
      'result.retryDisposition',
    ),
    ...(safeMetadata === undefined ? {} : { safeMetadata }),
  });
}

function validateSafeMetadata(
  value: unknown,
): AuthorityInvocationContextSafeMetadataV1 {
  const record = closedRecord(
    value,
    ['requestId', 'correlationId', 'contextFingerprint'],
    'INVALID_RESULT',
    'result.safeMetadata',
  );
  const requestId = optional(record.requestId, (input) =>
    identifier(input, 'result.safeMetadata.requestId'),
  );
  const correlationId = optional(record.correlationId, (input) =>
    identifier(input, 'result.safeMetadata.correlationId'),
  );
  const contextFingerprint = optional(
    record.contextFingerprint,
    (input) => fingerprint(input, 'result.safeMetadata.contextFingerprint'),
  );
  return Object.freeze({
    ...(requestId === undefined ? {} : { requestId }),
    ...(correlationId === undefined ? {} : { correlationId }),
    ...(contextFingerprint === undefined
      ? {}
      : { contextFingerprint }),
  });
}

export function validateAuthorityRepositoryProjectionInputV1(
  value: unknown,
): AuthorityInvocationContextV1 {
  const context = validateAuthorityInvocationContextV1(value);
  if (context.status !== 'READY') {
    return fail(
      'INVALID_CONTEXT',
      'context.status',
      'INVALID_INVOCATION_CONTEXT',
    );
  }
  validateReady(context);
  return context;
}
