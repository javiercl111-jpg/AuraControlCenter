import {
  AuthorityAuthorizationValidationError,
  type AuthorityAuthorizationContractIssue,
} from './authorityAuthorizationErrors';
import {
  AUTHORITY_AUTHORIZATION_ALLOW_REASON_CODES,
  AUTHORITY_AUTHORIZATION_CHANNELS,
  AUTHORITY_AUTHORIZATION_CONTEXT_VERSION,
  AUTHORITY_AUTHORIZATION_DECISIONS,
  AUTHORITY_AUTHORIZATION_DECISION_REASON_CODES,
  AUTHORITY_AUTHORIZATION_DENY_REASON_CODES,
  AUTHORITY_AUTHORIZATION_EVALUATION_REASON_CODES,
  AUTHORITY_AUTHORIZATION_FRESHNESS_VERSION,
  AUTHORITY_AUTHORIZATION_OBLIGATION_TYPES,
  AUTHORITY_AUTHORIZATION_OBLIGATION_VERSION,
  AUTHORITY_AUTHORIZATION_OPERATION_BINDING_VERSION,
  AUTHORITY_AUTHORIZATION_POLICY_EVIDENCE_VERSION,
  AUTHORITY_AUTHORIZATION_POLICY_SOURCES,
  AUTHORITY_AUTHORIZATION_PRINCIPAL_BINDING_VERSION,
  AUTHORITY_AUTHORIZATION_REQUEST_VERSION,
  AUTHORITY_AUTHORIZATION_RESOURCE_BINDING_VERSION,
  AUTHORITY_AUTHORIZATION_RESOURCE_TYPES,
  AUTHORITY_AUTHORIZATION_RESULT_STATUSES,
  AUTHORITY_AUTHORIZATION_RESULT_VERSION,
  AUTHORITY_AUTHORIZATION_RETRY_DISPOSITIONS,
  AUTHORITY_AUTHORIZATION_SCHEMA_VERSION,
  AUTHORITY_AUTHORIZATION_SCOPE_BINDING_VERSION,
  AUTHORITY_PERMISSIONS,
  type AuthorityAuthorizationDecisionReasonCode,
  type AuthorityAuthorizationDecisionV1,
  type AuthorityAuthorizationEvaluationContextV1,
  type AuthorityAuthorizationFreshnessV1,
  type AuthorityAuthorizationObligationV1,
  type AuthorityAuthorizationOperationBindingV1,
  type AuthorityAuthorizationPolicyEvidenceV1,
  type AuthorityAuthorizationPrincipalBindingV1,
  type AuthorityAuthorizationPriorDecisionReferenceV1,
  type AuthorityAuthorizationRequestV1,
  type AuthorityAuthorizationResourceBindingV1,
  type AuthorityAuthorizationResultV1,
  type AuthorityAuthorizationSafeMetadataV1,
  type AuthorityAuthorizationScopeBindingV1,
  type AuthorityPermissionV1,
} from './authorityAuthorizationTypes';

type PlainRecord = Record<string, unknown>;

const AUTHORITY_PRINCIPAL_TYPES = Object.freeze([
  'HUMAN_USER',
  'INTERNAL_SERVICE',
  'SYSTEM_ACTOR',
  'MIGRATION_ACTOR',
  'SUPPORT_OPERATOR',
] as const);

const AUTHORITY_PRINCIPAL_STATUSES = Object.freeze([
  'ACTIVE',
  'SUSPENDED',
  'REVOKED',
  'DISABLED',
] as const);

const AUTHORITY_AUTHENTICATION_METHODS = Object.freeze([
  'FIREBASE_ID_TOKEN',
  'IAM_OIDC',
  'SERVICE_ACCOUNT_ASSERTION',
  'INTERNAL_SYSTEM_CAPABILITY',
  'MIGRATION_CAPABILITY',
  'SUPPORT_SESSION',
] as const);

const AUTHORITY_AUTHENTICATION_ASSURANCE_LEVELS = Object.freeze([
  'LOW',
  'STANDARD',
  'HIGH',
  'SYSTEM_ATTESTED',
] as const);

const AUTHORITY_TENANT_SCOPE_TYPES = Object.freeze([
  'TENANT',
  'PLATFORM',
  'TENANT_BOOTSTRAP',
  'LEGACY_CANONICALIZATION',
  'MIGRATION',
  'SUPPORT',
] as const);

const AUTHORITY_TENANT_SCOPE_STATUSES = Object.freeze([
  'ACTIVE',
  'SUSPENDED',
  'REVOKED',
  'DISABLED',
  'PENDING_BOOTSTRAP',
  'LEGACY_PENDING_CANONICALIZATION',
] as const);

const AUTHORITY_PLATFORM_BOUNDARIES = Object.freeze([
  'AUTHORITY_CONTROL_PLANE',
  'TENANT_LIFECYCLE',
  'IDENTITY_GOVERNANCE',
] as const);

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

const OPERATION_PERMISSIONS = Object.freeze({
  CREATE_TENANT_AUTHORITY: 'authority.tenant.create',
  UPDATE_TENANT_STATUS: 'authority.tenant.status.update',
  CREATE_TENANT_MEMBERSHIP: 'authority.membership.create',
  UPDATE_TENANT_MEMBERSHIP_ROLES: 'authority.membership.roles.update',
  CHANGE_TENANT_MEMBERSHIP_STATUS:
    'authority.membership.status.update',
  RESERVE_TENANT_ALIAS: 'authority.alias.reserve',
  TOMBSTONE_TENANT_ALIAS: 'authority.alias.tombstone',
  CANONICALIZE_LEGACY_TENANT: 'authority.legacy.canonicalize',
} as const);

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
  issue: AuthorityAuthorizationContractIssue,
  field?: string,
): never {
  throw new AuthorityAuthorizationValidationError(issue, field);
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
  issue: AuthorityAuthorizationContractIssue,
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
  maximum = 128,
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
    value.includes('://')
  ) {
    return fail('INVALID_REFERENCE', field);
  }
  return value;
}

const CANONICAL_MEMBERSHIP_REFERENCE_MINIMUM_LENGTH = 21;
const CANONICAL_MEMBERSHIP_REFERENCE_MAXIMUM_LENGTH = 278;
const CANONICAL_MEMBERSHIP_PRINCIPAL_TYPES = Object.freeze([
  'USER',
  'SERVICE',
  'SYSTEM',
] as const);

function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint !== undefined && (codePoint <= 31 || codePoint === 127)) {
      return true;
    }
  }
  return false;
}

function canonicalMembershipFrame(
  value: string,
  cursor: number,
  terminal: boolean,
  field: string,
): Readonly<{ component: string; cursor: number }> {
  const lengthStart = cursor;
  while (cursor < value.length && /[0-9]/.test(value[cursor])) {
    cursor += 1;
  }
  const lengthText = value.slice(lengthStart, cursor);
  if (
    lengthText.length === 0 ||
    (lengthText.length > 1 && lengthText.startsWith('0')) ||
    value[cursor] !== ':'
  ) {
    return fail('INVALID_REFERENCE', field);
  }
  const componentLength = Number(lengthText);
  if (!Number.isSafeInteger(componentLength) || componentLength < 1) {
    return fail('INVALID_REFERENCE', field);
  }
  const componentStart = cursor + 1;
  const componentEnd = componentStart + componentLength;
  if (componentEnd > value.length) {
    return fail('INVALID_REFERENCE', field);
  }
  const component = value.slice(componentStart, componentEnd);
  if (terminal) {
    if (componentEnd !== value.length) {
      return fail('INVALID_REFERENCE', field);
    }
    return Object.freeze({ component, cursor: componentEnd });
  }
  if (value[componentEnd] !== '|') {
    return fail('INVALID_REFERENCE', field);
  }
  return Object.freeze({ component, cursor: componentEnd + 1 });
}

function validateAuthorityCanonicalMembershipReferenceV1(
  value: unknown,
  field: string,
): string {
  if (
    typeof value !== 'string' ||
    value.length < CANONICAL_MEMBERSHIP_REFERENCE_MINIMUM_LENGTH ||
    value.length > CANONICAL_MEMBERSHIP_REFERENCE_MAXIMUM_LENGTH ||
    value.trim() !== value ||
    hasControlCharacter(value) ||
    value.includes('/') ||
    value.includes('\\') ||
    value.includes('..') ||
    value.includes('://') ||
    !value.startsWith('v1|')
  ) {
    return fail('INVALID_REFERENCE', field);
  }
  const principalTypeFrame = canonicalMembershipFrame(
    value,
    3,
    false,
    field,
  );
  const principalIdFrame = canonicalMembershipFrame(
    value,
    principalTypeFrame.cursor,
    false,
    field,
  );
  const tenantIdFrame = canonicalMembershipFrame(
    value,
    principalIdFrame.cursor,
    true,
    field,
  );
  if (
    !CANONICAL_MEMBERSHIP_PRINCIPAL_TYPES.includes(
      principalTypeFrame.component as
        (typeof CANONICAL_MEMBERSHIP_PRINCIPAL_TYPES)[number],
    ) ||
    principalIdFrame.component.length < 3 ||
    principalIdFrame.component.length > 128 ||
    !/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(
      principalIdFrame.component,
    ) ||
    tenantIdFrame.component.length < 3 ||
    tenantIdFrame.component.length > 128 ||
    !/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(
      tenantIdFrame.component,
    )
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

function canonicalTimestamp(value: unknown, field: string): string {
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

function assertTimeOrder(
  earlier: string,
  later: string,
  allowEqual: boolean,
  field: string,
): void {
  const earlierMs = Date.parse(earlier);
  const laterMs = Date.parse(later);
  if (allowEqual ? earlierMs > laterMs : earlierMs >= laterMs) {
    fail('INVALID_TIME_ORDER', field);
  }
}

function boundedSeconds(value: unknown, field: string): number {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > 86_400
  ) {
    return fail('INVALID_DURATION', field);
  }
  return value;
}

function booleanLiteral<T extends boolean>(
  value: unknown,
  expected: T,
  field: string,
): T {
  if (value !== expected) {
    return fail('INVALID_LITERAL', field);
  }
  return expected;
}

function tenantId(value: unknown, field: string): string {
  try {
    return identifier(value, field);
  } catch {
    return fail('INVALID_IDENTIFIER', field);
  }
}

function principalId(
  value: unknown,
  principalType: (typeof AUTHORITY_PRINCIPAL_TYPES)[number],
  field: string,
): string {
  const prefixes = {
    HUMAN_USER: 'apr_v1_human_',
    INTERNAL_SERVICE: 'apr_v1_service_',
    SYSTEM_ACTOR: 'apr_v1_system_',
    MIGRATION_ACTOR: 'apr_v1_migration_',
    SUPPORT_OPERATOR: 'apr_v1_support_',
  } as const;
  const validated = identifier(value, field, 16, 160);
  if (!validated.startsWith(prefixes[principalType])) {
    return fail('INVALID_IDENTIFIER', field);
  }
  return validated;
}

export function validateAuthorityPermissionV1(
  value: unknown,
): AuthorityPermissionV1 {
  if (
    typeof value !== 'string' ||
    !AUTHORITY_PERMISSIONS.includes(value as AuthorityPermissionV1)
  ) {
    return fail('INVALID_PERMISSION', 'permission');
  }
  return value as AuthorityPermissionV1;
}

export function validateAuthorityAuthorizationPrincipalBindingV1(
  value: unknown,
): AuthorityAuthorizationPrincipalBindingV1 {
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
      'resolvedAt',
      'validUntil',
    ],
    'INVALID_PRINCIPAL_BINDING',
    'principalBinding',
  );
  const principalType = enumValue(
    record.principalType,
    AUTHORITY_PRINCIPAL_TYPES,
    'principalBinding.principalType',
  );
  const resolvedAt = canonicalTimestamp(
    record.resolvedAt,
    'principalBinding.resolvedAt',
  );
  const validUntil = canonicalTimestamp(
    record.validUntil,
    'principalBinding.validUntil',
  );
  assertTimeOrder(
    resolvedAt,
    validUntil,
    false,
    'principalBinding.validUntil',
  );
  return Object.freeze({
    schemaVersion: literal(
      record.schemaVersion,
      AUTHORITY_AUTHORIZATION_PRINCIPAL_BINDING_VERSION,
      'principalBinding.schemaVersion',
    ),
    principalId: principalId(
      record.principalId,
      principalType,
      'principalBinding.principalId',
    ),
    principalType,
    principalStatus: enumValue(
      record.principalStatus,
      AUTHORITY_PRINCIPAL_STATUSES,
      'principalBinding.principalStatus',
    ),
    authenticationMethod: enumValue(
      record.authenticationMethod,
      AUTHORITY_AUTHENTICATION_METHODS,
      'principalBinding.authenticationMethod',
    ),
    assuranceLevel: enumValue(
      record.assuranceLevel,
      AUTHORITY_AUTHENTICATION_ASSURANCE_LEVELS,
      'principalBinding.assuranceLevel',
    ),
    principalBindingVersion: version(
      record.principalBindingVersion,
      'principalBinding.principalBindingVersion',
    ),
    principalEvidenceFingerprint: fingerprint(
      record.principalEvidenceFingerprint,
      'principalBinding.principalEvidenceFingerprint',
    ),
    resolvedAt,
    validUntil,
  });
}

function scopeBase(
  record: PlainRecord,
): {
  readonly schemaVersion:
    typeof AUTHORITY_AUTHORIZATION_SCOPE_BINDING_VERSION;
  readonly scopeStatus:
    (typeof AUTHORITY_TENANT_SCOPE_STATUSES)[number];
  readonly tenantAuthorityVersion: string;
  readonly membershipBindingVersion?: string;
  readonly scopeEvidenceFingerprint: string;
  readonly principalId: string;
  readonly resolvedAt: string;
  readonly validUntil: string;
} {
  const resolvedAt = canonicalTimestamp(
    record.resolvedAt,
    'scopeBinding.resolvedAt',
  );
  const validUntil = canonicalTimestamp(
    record.validUntil,
    'scopeBinding.validUntil',
  );
  assertTimeOrder(
    resolvedAt,
    validUntil,
    false,
    'scopeBinding.validUntil',
  );
  return {
    schemaVersion: literal(
      record.schemaVersion,
      AUTHORITY_AUTHORIZATION_SCOPE_BINDING_VERSION,
      'scopeBinding.schemaVersion',
    ),
    scopeStatus: enumValue(
      record.scopeStatus,
      AUTHORITY_TENANT_SCOPE_STATUSES,
      'scopeBinding.scopeStatus',
    ),
    tenantAuthorityVersion: version(
      record.tenantAuthorityVersion,
      'scopeBinding.tenantAuthorityVersion',
    ),
    ...(record.membershipBindingVersion === undefined
      ? {}
      : {
          membershipBindingVersion: version(
            record.membershipBindingVersion,
            'scopeBinding.membershipBindingVersion',
          ),
        }),
    scopeEvidenceFingerprint: fingerprint(
      record.scopeEvidenceFingerprint,
      'scopeBinding.scopeEvidenceFingerprint',
    ),
    principalId: identifier(
      record.principalId,
      'scopeBinding.principalId',
      16,
      160,
    ),
    resolvedAt,
    validUntil,
  };
}

const SCOPE_BASE_KEYS = [
  'schemaVersion',
  'scopeType',
  'scopeStatus',
  'tenantAuthorityVersion',
  'membershipBindingVersion',
  'scopeEvidenceFingerprint',
  'principalId',
  'resolvedAt',
  'validUntil',
] as const;

export function validateAuthorityAuthorizationScopeBindingV1(
  value: unknown,
): AuthorityAuthorizationScopeBindingV1 {
  if (!isPlainRecord(value)) {
    return fail('INVALID_SCOPE_BINDING', 'scopeBinding');
  }
  const scopeType = enumValue(
    value.scopeType,
    AUTHORITY_TENANT_SCOPE_TYPES,
    'scopeBinding.scopeType',
  );
  if (scopeType === 'TENANT') {
    const record = closedRecord(
      value,
      [...SCOPE_BASE_KEYS, 'tenantId'],
      'INVALID_SCOPE_BINDING',
      'scopeBinding',
    );
    const base = scopeBase(record);
    if (base.membershipBindingVersion === undefined) {
      return fail(
        'INVALID_SCOPE_BINDING',
        'scopeBinding.membershipBindingVersion',
      );
    }
    return Object.freeze({
      ...base,
      scopeType,
      tenantId: tenantId(record.tenantId, 'scopeBinding.tenantId'),
      membershipBindingVersion: base.membershipBindingVersion,
    });
  }
  if (scopeType === 'PLATFORM') {
    const record = closedRecord(
      value,
      [...SCOPE_BASE_KEYS, 'platformBoundary'],
      'INVALID_SCOPE_BINDING',
      'scopeBinding',
    );
    return Object.freeze({
      ...scopeBase(record),
      scopeType,
      platformBoundary: enumValue(
        record.platformBoundary,
        AUTHORITY_PLATFORM_BOUNDARIES,
        'scopeBinding.platformBoundary',
      ),
    });
  }
  if (scopeType === 'TENANT_BOOTSTRAP') {
    const record = closedRecord(
      value,
      [...SCOPE_BASE_KEYS, 'tenantIdCandidate', 'bootstrapRequestId'],
      'INVALID_SCOPE_BINDING',
      'scopeBinding',
    );
    return Object.freeze({
      ...scopeBase(record),
      scopeType,
      tenantIdCandidate: tenantId(
        record.tenantIdCandidate,
        'scopeBinding.tenantIdCandidate',
      ),
      bootstrapRequestId: identifier(
        record.bootstrapRequestId,
        'scopeBinding.bootstrapRequestId',
      ),
    });
  }
  if (scopeType === 'LEGACY_CANONICALIZATION') {
    const record = closedRecord(
      value,
      [
        ...SCOPE_BASE_KEYS,
        'canonicalTenantCandidate',
        'legacySourceFingerprint',
      ],
      'INVALID_SCOPE_BINDING',
      'scopeBinding',
    );
    return Object.freeze({
      ...scopeBase(record),
      scopeType,
      canonicalTenantCandidate: tenantId(
        record.canonicalTenantCandidate,
        'scopeBinding.canonicalTenantCandidate',
      ),
      legacySourceFingerprint: fingerprint(
        record.legacySourceFingerprint,
        'scopeBinding.legacySourceFingerprint',
      ),
    });
  }
  if (scopeType === 'MIGRATION') {
    const record = closedRecord(
      value,
      [
        ...SCOPE_BASE_KEYS,
        'targetTenantId',
        'migrationId',
        'migrationRunId',
      ],
      'INVALID_SCOPE_BINDING',
      'scopeBinding',
    );
    return Object.freeze({
      ...scopeBase(record),
      scopeType,
      targetTenantId: tenantId(
        record.targetTenantId,
        'scopeBinding.targetTenantId',
      ),
      migrationId: identifier(
        record.migrationId,
        'scopeBinding.migrationId',
      ),
      migrationRunId: identifier(
        record.migrationRunId,
        'scopeBinding.migrationRunId',
      ),
    });
  }
  const record = closedRecord(
    value,
    [...SCOPE_BASE_KEYS, 'tenantId', 'supportSessionId'],
    'INVALID_SCOPE_BINDING',
    'scopeBinding',
  );
  return Object.freeze({
    ...scopeBase(record),
    scopeType,
    tenantId: tenantId(record.tenantId, 'scopeBinding.tenantId'),
    supportSessionId: identifier(
      record.supportSessionId,
      'scopeBinding.supportSessionId',
    ),
  });
}

export function validateAuthorityAuthorizationResourceBindingV1(
  value: unknown,
): AuthorityAuthorizationResourceBindingV1 {
  if (!isPlainRecord(value)) {
    return fail('INVALID_RESOURCE_BINDING', 'resourceBinding');
  }
  const resourceType = enumValue(
    value.resourceType,
    AUTHORITY_AUTHORIZATION_RESOURCE_TYPES,
    'resourceBinding.resourceType',
  );
  if (resourceType === 'TENANT') {
    const record = closedRecord(
      value,
      ['schemaVersion', 'resourceType', 'tenantId'],
      'INVALID_RESOURCE_BINDING',
      'resourceBinding',
    );
    return Object.freeze({
      schemaVersion: literal(
        record.schemaVersion,
        AUTHORITY_AUTHORIZATION_RESOURCE_BINDING_VERSION,
        'resourceBinding.schemaVersion',
      ),
      resourceType,
      tenantId: tenantId(record.tenantId, 'resourceBinding.tenantId'),
    });
  }
  if (resourceType === 'MEMBERSHIP') {
    const record = closedRecord(
      value,
      [
        'schemaVersion',
        'resourceType',
        'tenantId',
        'membershipId',
        'targetPrincipalId',
      ],
      'INVALID_RESOURCE_BINDING',
      'resourceBinding',
    );
    return Object.freeze({
      schemaVersion: literal(
        record.schemaVersion,
        AUTHORITY_AUTHORIZATION_RESOURCE_BINDING_VERSION,
        'resourceBinding.schemaVersion',
      ),
      resourceType,
      tenantId: tenantId(record.tenantId, 'resourceBinding.tenantId'),
      membershipId: validateAuthorityCanonicalMembershipReferenceV1(
        record.membershipId,
        'resourceBinding.membershipId',
      ),
      targetPrincipalId: identifier(
        record.targetPrincipalId,
        'resourceBinding.targetPrincipalId',
        16,
        160,
      ),
    });
  }
  if (resourceType === 'ALIAS') {
    const record = closedRecord(
      value,
      ['schemaVersion', 'resourceType', 'tenantId', 'aliasKey'],
      'INVALID_RESOURCE_BINDING',
      'resourceBinding',
    );
    return Object.freeze({
      schemaVersion: literal(
        record.schemaVersion,
        AUTHORITY_AUTHORIZATION_RESOURCE_BINDING_VERSION,
        'resourceBinding.schemaVersion',
      ),
      resourceType,
      tenantId: tenantId(record.tenantId, 'resourceBinding.tenantId'),
      aliasKey: reference(record.aliasKey, 'resourceBinding.aliasKey'),
    });
  }
  const record = closedRecord(
    value,
    [
      'schemaVersion',
      'resourceType',
      'sourceType',
      'sourceLocatorKey',
      'canonicalTenantCandidate',
    ],
    'INVALID_RESOURCE_BINDING',
    'resourceBinding',
  );
  return Object.freeze({
    schemaVersion: literal(
      record.schemaVersion,
      AUTHORITY_AUTHORIZATION_RESOURCE_BINDING_VERSION,
      'resourceBinding.schemaVersion',
    ),
    resourceType,
    sourceType: literal(
      record.sourceType,
      'PLATFORM_TENANTS',
      'resourceBinding.sourceType',
    ),
    sourceLocatorKey: reference(
      record.sourceLocatorKey,
      'resourceBinding.sourceLocatorKey',
    ),
    canonicalTenantCandidate: tenantId(
      record.canonicalTenantCandidate,
      'resourceBinding.canonicalTenantCandidate',
    ),
  });
}

export function validateAuthorityAuthorizationOperationBindingV1(
  value: unknown,
): AuthorityAuthorizationOperationBindingV1 {
  const record = closedRecord(
    value,
    [
      'schemaVersion',
      'operationType',
      'permission',
      'commandVersion',
      'resourceType',
      'resourceId',
      'operationId',
      'commandFingerprint',
      'requestedAt',
      'channel',
    ],
    'INVALID_OPERATION_BINDING',
    'operationBinding',
  );
  const operationType = enumValue(
    record.operationType,
    AUTHORITY_OPERATION_TYPES,
    'operationBinding.operationType',
  );
  const permission = validateAuthorityPermissionV1(record.permission);
  const resourceType = enumValue(
    record.resourceType,
    AUTHORITY_AUTHORIZATION_RESOURCE_TYPES,
    'operationBinding.resourceType',
  );
  if (
    OPERATION_PERMISSIONS[operationType] !== permission ||
    OPERATION_RESOURCE_TYPES[operationType] !== resourceType
  ) {
    return fail('INVALID_OPERATION_BINDING', 'operationBinding');
  }
  return Object.freeze({
    schemaVersion: literal(
      record.schemaVersion,
      AUTHORITY_AUTHORIZATION_OPERATION_BINDING_VERSION,
      'operationBinding.schemaVersion',
    ),
    operationType,
    permission,
    commandVersion: version(
      record.commandVersion,
      'operationBinding.commandVersion',
    ),
    resourceType,
    resourceId: reference(
      record.resourceId,
      'operationBinding.resourceId',
    ),
    ...(record.operationId === undefined
      ? {}
      : {
          operationId: identifier(
            record.operationId,
            'operationBinding.operationId',
          ),
        }),
    ...(record.commandFingerprint === undefined
      ? {}
      : {
          commandFingerprint: fingerprint(
            record.commandFingerprint,
            'operationBinding.commandFingerprint',
          ),
        }),
    requestedAt: canonicalTimestamp(
      record.requestedAt,
      'operationBinding.requestedAt',
    ),
    channel: enumValue(
      record.channel,
      AUTHORITY_AUTHORIZATION_CHANNELS,
      'operationBinding.channel',
    ),
  });
}

function matchedRuleReferences(value: unknown): readonly string[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 32) {
    return fail(
      'INVALID_POLICY_EVIDENCE',
      'policyEvidence.matchedRuleReferences',
    );
  }
  const validated = value.map((entry, index) =>
    reference(entry, `policyEvidence.matchedRuleReferences.${index}`),
  );
  if (new Set(validated).size !== validated.length) {
    return fail(
      'INVALID_POLICY_EVIDENCE',
      'policyEvidence.matchedRuleReferences',
    );
  }
  return Object.freeze([...validated].sort());
}

export function validateAuthorityAuthorizationPolicyEvidenceV1(
  value: unknown,
): AuthorityAuthorizationPolicyEvidenceV1 {
  const record = closedRecord(
    value,
    [
      'schemaVersion',
      'policyId',
      'policyVersion',
      'evaluatorVersion',
      'decisionRuleId',
      'evaluatedAt',
      'validUntil',
      'evidenceFingerprint',
      'inputFingerprint',
      'principalEvidenceFingerprint',
      'scopeEvidenceFingerprint',
      'policySource',
      'matchedRuleReferences',
      'roleSetVersion',
      'membershipVersion',
    ],
    'INVALID_POLICY_EVIDENCE',
    'policyEvidence',
  );
  const evaluatedAt = canonicalTimestamp(
    record.evaluatedAt,
    'policyEvidence.evaluatedAt',
  );
  const validUntil = canonicalTimestamp(
    record.validUntil,
    'policyEvidence.validUntil',
  );
  assertTimeOrder(
    evaluatedAt,
    validUntil,
    false,
    'policyEvidence.validUntil',
  );
  return Object.freeze({
    schemaVersion: literal(
      record.schemaVersion,
      AUTHORITY_AUTHORIZATION_POLICY_EVIDENCE_VERSION,
      'policyEvidence.schemaVersion',
    ),
    policyId: identifier(record.policyId, 'policyEvidence.policyId'),
    policyVersion: version(
      record.policyVersion,
      'policyEvidence.policyVersion',
    ),
    evaluatorVersion: version(
      record.evaluatorVersion,
      'policyEvidence.evaluatorVersion',
    ),
    decisionRuleId: identifier(
      record.decisionRuleId,
      'policyEvidence.decisionRuleId',
    ),
    evaluatedAt,
    validUntil,
    evidenceFingerprint: fingerprint(
      record.evidenceFingerprint,
      'policyEvidence.evidenceFingerprint',
    ),
    inputFingerprint: fingerprint(
      record.inputFingerprint,
      'policyEvidence.inputFingerprint',
    ),
    principalEvidenceFingerprint: fingerprint(
      record.principalEvidenceFingerprint,
      'policyEvidence.principalEvidenceFingerprint',
    ),
    scopeEvidenceFingerprint: fingerprint(
      record.scopeEvidenceFingerprint,
      'policyEvidence.scopeEvidenceFingerprint',
    ),
    policySource: enumValue(
      record.policySource,
      AUTHORITY_AUTHORIZATION_POLICY_SOURCES,
      'policyEvidence.policySource',
    ),
    matchedRuleReferences: matchedRuleReferences(
      record.matchedRuleReferences,
    ),
    ...(record.roleSetVersion === undefined
      ? {}
      : {
          roleSetVersion: version(
            record.roleSetVersion,
            'policyEvidence.roleSetVersion',
          ),
        }),
    ...(record.membershipVersion === undefined
      ? {}
      : {
          membershipVersion: version(
            record.membershipVersion,
            'policyEvidence.membershipVersion',
          ),
        }),
  });
}

export function validateAuthorityAuthorizationObligationV1(
  value: unknown,
): AuthorityAuthorizationObligationV1 {
  if (!isPlainRecord(value)) {
    return fail('INVALID_OBLIGATION', 'obligation');
  }
  const obligationType = enumValue(
    value.obligationType,
    AUTHORITY_AUTHORIZATION_OBLIGATION_TYPES,
    'obligation.obligationType',
  );
  const schemaVersion = literal(
    value.schemaVersion,
    AUTHORITY_AUTHORIZATION_OBLIGATION_VERSION,
    'obligation.schemaVersion',
  );
  if (obligationType === 'REQUIRE_FRESH_AUTHENTICATION') {
    const record = closedRecord(
      value,
      ['schemaVersion', 'obligationType', 'maxAuthenticationAgeSeconds'],
      'INVALID_OBLIGATION',
      'obligation',
    );
    return Object.freeze({
      schemaVersion,
      obligationType,
      maxAuthenticationAgeSeconds: boundedSeconds(
        record.maxAuthenticationAgeSeconds,
        'obligation.maxAuthenticationAgeSeconds',
      ),
    });
  }
  if (obligationType === 'REQUIRE_APP_CHECK') {
    const record = closedRecord(
      value,
      ['schemaVersion', 'obligationType', 'requiredStatus'],
      'INVALID_OBLIGATION',
      'obligation',
    );
    return Object.freeze({
      schemaVersion,
      obligationType,
      requiredStatus: literal(
        record.requiredStatus,
        'REQUIRED_AND_VALID',
        'obligation.requiredStatus',
      ),
    });
  }
  if (obligationType === 'REQUIRE_MFA') {
    const record = closedRecord(
      value,
      ['schemaVersion', 'obligationType', 'minimumFactors'],
      'INVALID_OBLIGATION',
      'obligation',
    );
    if (record.minimumFactors !== 2) {
      return fail('INVALID_OBLIGATION', 'obligation.minimumFactors');
    }
    return Object.freeze({
      schemaVersion,
      obligationType,
      minimumFactors: 2,
    });
  }
  if (obligationType === 'REQUIRE_IDEMPOTENCY_KEY') {
    const record = closedRecord(
      value,
      ['schemaVersion', 'obligationType', 'namespace'],
      'INVALID_OBLIGATION',
      'obligation',
    );
    return Object.freeze({
      schemaVersion,
      obligationType,
      namespace: literal(
        record.namespace,
        'PRINCIPAL_SCOPE_OPERATION',
        'obligation.namespace',
      ),
    });
  }
  if (obligationType === 'REQUIRE_EXPECTED_VERSION') {
    const record = closedRecord(
      value,
      ['schemaVersion', 'obligationType', 'versionSource'],
      'INVALID_OBLIGATION',
      'obligation',
    );
    return Object.freeze({
      schemaVersion,
      obligationType,
      versionSource: literal(
        record.versionSource,
        'RESOURCE_AUTHORITY_VERSION',
        'obligation.versionSource',
      ),
    });
  }
  if (obligationType === 'REQUIRE_AUDIT_REASON') {
    const record = closedRecord(
      value,
      ['schemaVersion', 'obligationType', 'reasonCodeRequired'],
      'INVALID_OBLIGATION',
      'obligation',
    );
    return Object.freeze({
      schemaVersion,
      obligationType,
      reasonCodeRequired: booleanLiteral(
        record.reasonCodeRequired,
        true,
        'obligation.reasonCodeRequired',
      ),
    });
  }
  if (obligationType === 'REQUIRE_CHANGE_TICKET') {
    const record = closedRecord(
      value,
      ['schemaVersion', 'obligationType', 'ticketReferencePattern'],
      'INVALID_OBLIGATION',
      'obligation',
    );
    return Object.freeze({
      schemaVersion,
      obligationType,
      ticketReferencePattern: literal(
        record.ticketReferencePattern,
        'CANONICAL_REFERENCE',
        'obligation.ticketReferencePattern',
      ),
    });
  }
  if (obligationType === 'REQUIRE_SUPPORT_SESSION') {
    const record = closedRecord(
      value,
      ['schemaVersion', 'obligationType', 'supportSessionId'],
      'INVALID_OBLIGATION',
      'obligation',
    );
    return Object.freeze({
      schemaVersion,
      obligationType,
      supportSessionId: identifier(
        record.supportSessionId,
        'obligation.supportSessionId',
      ),
    });
  }
  if (obligationType === 'REQUIRE_MIGRATION_MANIFEST') {
    const record = closedRecord(
      value,
      ['schemaVersion', 'obligationType', 'manifestVersion'],
      'INVALID_OBLIGATION',
      'obligation',
    );
    return Object.freeze({
      schemaVersion,
      obligationType,
      manifestVersion: version(
        record.manifestVersion,
        'obligation.manifestVersion',
      ),
    });
  }
  if (obligationType === 'MASK_NOT_FOUND') {
    const record = closedRecord(
      value,
      ['schemaVersion', 'obligationType', 'externalCode'],
      'INVALID_OBLIGATION',
      'obligation',
    );
    return Object.freeze({
      schemaVersion,
      obligationType,
      externalCode: literal(
        record.externalCode,
        'PERMISSION_DENIED',
        'obligation.externalCode',
      ),
    });
  }
  const record = closedRecord(
    value,
    ['schemaVersion', 'obligationType', 'executionMode'],
    'INVALID_OBLIGATION',
    'obligation',
  );
  return Object.freeze({
    schemaVersion,
    obligationType,
    executionMode: literal(
      record.executionMode,
      'TEST_ONLY',
      'obligation.executionMode',
    ),
  });
}

function validateObligations(
  value: unknown,
): readonly AuthorityAuthorizationObligationV1[] {
  if (!Array.isArray(value) || value.length > 16) {
    return fail('INVALID_OBLIGATION', 'decision.obligations');
  }
  const obligations = value.map(validateAuthorityAuthorizationObligationV1);
  const types = obligations.map(({ obligationType }) => obligationType);
  if (new Set(types).size !== types.length) {
    return fail('INVALID_OBLIGATION', 'decision.obligations');
  }
  return Object.freeze([...obligations].sort((left, right) =>
    left.obligationType.localeCompare(right.obligationType),
  ));
}

export function validateAuthorityAuthorizationFreshnessV1(
  value: unknown,
): AuthorityAuthorizationFreshnessV1 {
  const record = closedRecord(
    value,
    [
      'schemaVersion',
      'evaluatedAt',
      'validUntil',
      'principalValidUntil',
      'scopeValidUntil',
      'policyVersion',
      'inputFingerprint',
      'staleAfterSeconds',
    ],
    'INVALID_FRESHNESS',
    'freshness',
  );
  const evaluatedAt = canonicalTimestamp(
    record.evaluatedAt,
    'freshness.evaluatedAt',
  );
  const validUntil = canonicalTimestamp(
    record.validUntil,
    'freshness.validUntil',
  );
  const principalValidUntil = canonicalTimestamp(
    record.principalValidUntil,
    'freshness.principalValidUntil',
  );
  const scopeValidUntil = canonicalTimestamp(
    record.scopeValidUntil,
    'freshness.scopeValidUntil',
  );
  const staleAfterSeconds = boundedSeconds(
    record.staleAfterSeconds,
    'freshness.staleAfterSeconds',
  );
  assertTimeOrder(evaluatedAt, validUntil, false, 'freshness.validUntil');
  if (
    Date.parse(validUntil) > Date.parse(principalValidUntil) ||
    Date.parse(validUntil) > Date.parse(scopeValidUntil) ||
    Date.parse(validUntil) - Date.parse(evaluatedAt) !==
      staleAfterSeconds * 1_000
  ) {
    return fail('INVALID_FRESHNESS', 'freshness.validUntil');
  }
  return Object.freeze({
    schemaVersion: literal(
      record.schemaVersion,
      AUTHORITY_AUTHORIZATION_FRESHNESS_VERSION,
      'freshness.schemaVersion',
    ),
    evaluatedAt,
    validUntil,
    principalValidUntil,
    scopeValidUntil,
    policyVersion: version(
      record.policyVersion,
      'freshness.policyVersion',
    ),
    inputFingerprint: fingerprint(
      record.inputFingerprint,
      'freshness.inputFingerprint',
    ),
    staleAfterSeconds,
  });
}

function validateDecisionReasonCodes(
  value: unknown,
): readonly AuthorityAuthorizationDecisionReasonCode[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 8) {
    return fail('INVALID_DECISION', 'decision.reasonCodes');
  }
  const validated = value.map((entry, index) =>
    enumValue(
      entry,
      AUTHORITY_AUTHORIZATION_DECISION_REASON_CODES,
      `decision.reasonCodes.${index}`,
    ),
  );
  if (new Set(validated).size !== validated.length) {
    return fail('INVALID_DECISION', 'decision.reasonCodes');
  }
  return Object.freeze([...validated].sort());
}

function resourceId(
  binding: AuthorityAuthorizationResourceBindingV1,
): string {
  switch (binding.resourceType) {
    case 'TENANT':
      return binding.tenantId;
    case 'MEMBERSHIP':
      return binding.membershipId;
    case 'ALIAS':
      return binding.aliasKey;
    case 'LEGACY_TENANT_SOURCE':
      return binding.sourceLocatorKey;
  }
}

function resourceTenantId(
  binding: AuthorityAuthorizationResourceBindingV1,
): string {
  switch (binding.resourceType) {
    case 'TENANT':
    case 'MEMBERSHIP':
    case 'ALIAS':
      return binding.tenantId;
    case 'LEGACY_TENANT_SOURCE':
      return binding.canonicalTenantCandidate;
  }
}

function assertResourceInsideScope(
  scope: AuthorityAuthorizationScopeBindingV1,
  resource: AuthorityAuthorizationResourceBindingV1,
): void {
  const targetTenantId = resourceTenantId(resource);
  const compatible =
    scope.scopeType === 'PLATFORM' ||
    (scope.scopeType === 'TENANT' && scope.tenantId === targetTenantId) ||
    (scope.scopeType === 'TENANT_BOOTSTRAP' &&
      scope.tenantIdCandidate === targetTenantId) ||
    (scope.scopeType === 'LEGACY_CANONICALIZATION' &&
      scope.canonicalTenantCandidate === targetTenantId) ||
    (scope.scopeType === 'MIGRATION' &&
      scope.targetTenantId === targetTenantId) ||
    (scope.scopeType === 'SUPPORT' && scope.tenantId === targetTenantId);
  if (!compatible) {
    fail('INVALID_DECISION', 'decision.resourceBinding');
  }
}

export function validateAuthorityAuthorizationDecisionV1(
  value: unknown,
): AuthorityAuthorizationDecisionV1 {
  const record = closedRecord(
    value,
    [
      'schemaVersion',
      'version',
      'decision',
      'permission',
      'principalBinding',
      'scopeBinding',
      'operationBinding',
      'resourceBinding',
      'policyEvidence',
      'obligations',
      'freshness',
      'reasonCodes',
      'decisionFingerprint',
      'evaluatedAt',
    ],
    'INVALID_DECISION',
    'decision',
  );
  const decision = enumValue(
    record.decision,
    AUTHORITY_AUTHORIZATION_DECISIONS,
    'decision.decision',
  );
  const permission = validateAuthorityPermissionV1(record.permission);
  const principalBinding =
    validateAuthorityAuthorizationPrincipalBindingV1(
      record.principalBinding,
    );
  const scopeBinding = validateAuthorityAuthorizationScopeBindingV1(
    record.scopeBinding,
  );
  const operationBinding =
    validateAuthorityAuthorizationOperationBindingV1(
      record.operationBinding,
    );
  const resourceBinding =
    validateAuthorityAuthorizationResourceBindingV1(
      record.resourceBinding,
    );
  const policyEvidence =
    validateAuthorityAuthorizationPolicyEvidenceV1(
      record.policyEvidence,
    );
  const obligations = validateObligations(record.obligations);
  const freshness = validateAuthorityAuthorizationFreshnessV1(
    record.freshness,
  );
  const reasonCodes = validateDecisionReasonCodes(record.reasonCodes);
  const evaluatedAt = canonicalTimestamp(
    record.evaluatedAt,
    'decision.evaluatedAt',
  );
  if (
    permission !== operationBinding.permission ||
    resourceBinding.resourceType !== operationBinding.resourceType ||
    resourceId(resourceBinding) !== operationBinding.resourceId ||
    principalBinding.principalId !== scopeBinding.principalId ||
    freshness.principalValidUntil !== principalBinding.validUntil ||
    freshness.scopeValidUntil !== scopeBinding.validUntil ||
    freshness.policyVersion !== policyEvidence.policyVersion ||
    freshness.inputFingerprint !== policyEvidence.inputFingerprint ||
    principalBinding.principalEvidenceFingerprint !==
      policyEvidence.principalEvidenceFingerprint ||
    scopeBinding.scopeEvidenceFingerprint !==
      policyEvidence.scopeEvidenceFingerprint ||
    freshness.evaluatedAt !== evaluatedAt ||
    policyEvidence.evaluatedAt !== evaluatedAt ||
    Date.parse(freshness.validUntil) > Date.parse(policyEvidence.validUntil)
  ) {
    return fail('INVALID_DECISION', 'decision');
  }
  assertResourceInsideScope(scopeBinding, resourceBinding);
  if (
    decision === 'ALLOW' &&
    (principalBinding.principalStatus !== 'ACTIVE' ||
      scopeBinding.scopeStatus !== 'ACTIVE' ||
      reasonCodes.some(
        (reason) =>
          !AUTHORITY_AUTHORIZATION_ALLOW_REASON_CODES.includes(
            reason as (typeof AUTHORITY_AUTHORIZATION_ALLOW_REASON_CODES)[number],
          ),
      ))
  ) {
    return fail('INVALID_DECISION', 'decision.reasonCodes');
  }
  if (
    decision === 'DENY' &&
    reasonCodes.some(
      (reason) =>
        !AUTHORITY_AUTHORIZATION_DENY_REASON_CODES.includes(
          reason as (typeof AUTHORITY_AUTHORIZATION_DENY_REASON_CODES)[number],
        ),
    )
  ) {
    return fail('INVALID_DECISION', 'decision.reasonCodes');
  }
  if (
    decision === 'INDETERMINATE' &&
    (reasonCodes.length !== 1 || reasonCodes[0] !== 'POLICY_NOT_FOUND')
  ) {
    return fail('INVALID_DECISION', 'decision.reasonCodes');
  }
  if (
    decision === 'NOT_APPLICABLE' &&
    (reasonCodes.length !== 1 ||
      reasonCodes[0] !== 'OPERATION_NOT_SUPPORTED')
  ) {
    return fail('INVALID_DECISION', 'decision.reasonCodes');
  }
  return Object.freeze({
    schemaVersion: literal(
      record.schemaVersion,
      AUTHORITY_AUTHORIZATION_SCHEMA_VERSION,
      'decision.schemaVersion',
    ),
    version: literal(
      record.version,
      AUTHORITY_AUTHORIZATION_SCHEMA_VERSION,
      'decision.version',
    ),
    decision,
    permission,
    principalBinding,
    scopeBinding,
    operationBinding,
    resourceBinding,
    policyEvidence,
    obligations,
    freshness,
    reasonCodes,
    decisionFingerprint: fingerprint(
      record.decisionFingerprint,
      'decision.decisionFingerprint',
    ),
    evaluatedAt,
  });
}

function validatePriorDecisionReference(
  value: unknown,
): AuthorityAuthorizationPriorDecisionReferenceV1 {
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
    evaluatedAt: canonicalTimestamp(
      record.evaluatedAt,
      'request.priorDecisionReference.evaluatedAt',
    ),
  });
}

export function validateAuthorityAuthorizationRequestV1(
  value: unknown,
): AuthorityAuthorizationRequestV1 {
  const record = closedRecord(
    value,
    [
      'schemaVersion',
      'principalBinding',
      'scopeBinding',
      'operationBinding',
      'resourceBinding',
      'channel',
      'requestId',
      'correlationId',
      'evaluatedAtInput',
      'priorDecisionReference',
    ],
    'INVALID_REQUEST',
    'request',
  );
  const principalBinding =
    validateAuthorityAuthorizationPrincipalBindingV1(
      record.principalBinding,
    );
  const scopeBinding = validateAuthorityAuthorizationScopeBindingV1(
    record.scopeBinding,
  );
  const operationBinding =
    validateAuthorityAuthorizationOperationBindingV1(
      record.operationBinding,
    );
  const resourceBinding =
    validateAuthorityAuthorizationResourceBindingV1(
      record.resourceBinding,
    );
  const channel = enumValue(
    record.channel,
    AUTHORITY_AUTHORIZATION_CHANNELS,
    'request.channel',
  );
  const evaluatedAtInput = canonicalTimestamp(
    record.evaluatedAtInput,
    'request.evaluatedAtInput',
  );
  if (
    principalBinding.principalId !== scopeBinding.principalId ||
    operationBinding.channel !== channel ||
    operationBinding.resourceType !== resourceBinding.resourceType ||
    operationBinding.resourceId !== resourceId(resourceBinding) ||
    Date.parse(principalBinding.resolvedAt) > Date.parse(evaluatedAtInput) ||
    Date.parse(scopeBinding.resolvedAt) > Date.parse(evaluatedAtInput) ||
    Date.parse(operationBinding.requestedAt) > Date.parse(evaluatedAtInput)
  ) {
    return fail('INVALID_REQUEST', 'request');
  }
  assertResourceInsideScope(scopeBinding, resourceBinding);
  return Object.freeze({
    schemaVersion: literal(
      record.schemaVersion,
      AUTHORITY_AUTHORIZATION_REQUEST_VERSION,
      'request.schemaVersion',
    ),
    principalBinding,
    scopeBinding,
    operationBinding,
    resourceBinding,
    channel,
    requestId: identifier(record.requestId, 'request.requestId'),
    correlationId: identifier(
      record.correlationId,
      'request.correlationId',
    ),
    evaluatedAtInput,
    ...(record.priorDecisionReference === undefined
      ? {}
      : {
          priorDecisionReference: validatePriorDecisionReference(
            record.priorDecisionReference,
          ),
        }),
  });
}

export function validateAuthorityAuthorizationEvaluationContextV1(
  value: unknown,
): AuthorityAuthorizationEvaluationContextV1 {
  const record = closedRecord(
    value,
    [
      'schemaVersion',
      'requestId',
      'correlationId',
      'evaluatedAt',
      'channel',
      'evaluatorVersion',
      'cancellationPolicy',
    ],
    'INVALID_CONTEXT',
    'context',
  );
  return Object.freeze({
    schemaVersion: literal(
      record.schemaVersion,
      AUTHORITY_AUTHORIZATION_CONTEXT_VERSION,
      'context.schemaVersion',
    ),
    requestId: identifier(record.requestId, 'context.requestId'),
    correlationId: identifier(
      record.correlationId,
      'context.correlationId',
    ),
    evaluatedAt: canonicalTimestamp(
      record.evaluatedAt,
      'context.evaluatedAt',
    ),
    channel: enumValue(
      record.channel,
      AUTHORITY_AUTHORIZATION_CHANNELS,
      'context.channel',
    ),
    evaluatorVersion: version(
      record.evaluatorVersion,
      'context.evaluatorVersion',
    ),
    cancellationPolicy: literal(
      record.cancellationPolicy,
      'EXTERNAL_EXECUTION_CONTEXT',
      'context.cancellationPolicy',
    ),
  });
}

function validateSafeMetadata(
  value: unknown,
): AuthorityAuthorizationSafeMetadataV1 {
  const record = closedRecord(
    value,
    ['evaluatorReference', 'evidenceFingerprint'],
    'INVALID_RESULT',
    'result.safeMetadata',
  );
  return Object.freeze({
    ...(record.evaluatorReference === undefined
      ? {}
      : {
          evaluatorReference: identifier(
            record.evaluatorReference,
            'result.safeMetadata.evaluatorReference',
          ),
        }),
    ...(record.evidenceFingerprint === undefined
      ? {}
      : {
          evidenceFingerprint: fingerprint(
            record.evidenceFingerprint,
            'result.safeMetadata.evidenceFingerprint',
          ),
        }),
  });
}

function assertResultCompatibility(
  status: Exclude<
    (typeof AUTHORITY_AUTHORIZATION_RESULT_STATUSES)[number],
    'DECIDED'
  >,
  reason:
    (typeof AUTHORITY_AUTHORIZATION_EVALUATION_REASON_CODES)[number],
  retry: (typeof AUTHORITY_AUTHORIZATION_RETRY_DISPOSITIONS)[number],
): void {
  const reasons: Readonly<Record<typeof status, readonly typeof reason[]>> = {
    REJECTED: [
      'AUTHORIZATION_REQUEST_INVALID',
      'POLICY_NOT_FOUND',
      'POLICY_EVALUATION_FAILED',
    ],
    STALE: [
      'PRINCIPAL_BINDING_STALE',
      'SCOPE_BINDING_STALE',
      'POLICY_STALE',
    ],
    CONFLICT: ['BINDING_CONFLICT'],
    INTERNAL_ERROR: ['INTERNAL_AUTHORIZATION_FAILURE'],
  };
  const retries: Readonly<Record<typeof status, readonly typeof retry[]>> = {
    REJECTED: ['DO_NOT_RETRY', 'RETRY_AFTER_OPERATOR_REVIEW'],
    STALE: [
      'RETRY_AFTER_REAUTHENTICATION',
      'RETRY_AFTER_PRINCIPAL_REFRESH',
      'RETRY_AFTER_SCOPE_REFRESH',
      'RETRY_AFTER_POLICY_REFRESH',
    ],
    CONFLICT: ['DO_NOT_RETRY', 'RETRY_AFTER_OPERATOR_REVIEW'],
    INTERNAL_ERROR: ['SAFE_TO_RETRY'],
  };
  if (!reasons[status].includes(reason)) {
    fail('INVALID_RESULT', 'result.reasonCode');
  }
  if (!retries[status].includes(retry)) {
    fail('INVALID_RESULT', 'result.retryDisposition');
  }
}

export function validateAuthorityAuthorizationResultV1(
  value: unknown,
): AuthorityAuthorizationResultV1 {
  if (!isPlainRecord(value)) {
    return fail('INVALID_RESULT', 'result');
  }
  const status = enumValue(
    value.status,
    AUTHORITY_AUTHORIZATION_RESULT_STATUSES,
    'result.status',
  );
  if (status === 'DECIDED') {
    const record = closedRecord(
      value,
      ['schemaVersion', 'status', 'decision'],
      'INVALID_RESULT',
      'result',
    );
    return Object.freeze({
      schemaVersion: literal(
        record.schemaVersion,
        AUTHORITY_AUTHORIZATION_RESULT_VERSION,
        'result.schemaVersion',
      ),
      status,
      decision: validateAuthorityAuthorizationDecisionV1(
        record.decision,
      ),
    });
  }
  const record = closedRecord(
    value,
    [
      'schemaVersion',
      'status',
      'reasonCode',
      'retryDisposition',
      'evaluatorVersion',
      'evaluatedAt',
      'safeMetadata',
    ],
    'INVALID_RESULT',
    'result',
  );
  const reason = enumValue(
    record.reasonCode,
    AUTHORITY_AUTHORIZATION_EVALUATION_REASON_CODES,
    'result.reasonCode',
  );
  const retryDisposition = enumValue(
    record.retryDisposition,
    AUTHORITY_AUTHORIZATION_RETRY_DISPOSITIONS,
    'result.retryDisposition',
  );
  assertResultCompatibility(status, reason, retryDisposition);
  return Object.freeze({
    schemaVersion: literal(
      record.schemaVersion,
      AUTHORITY_AUTHORIZATION_RESULT_VERSION,
      'result.schemaVersion',
    ),
    status,
    reasonCode: reason,
    retryDisposition,
    evaluatorVersion: version(
      record.evaluatorVersion,
      'result.evaluatorVersion',
    ),
    evaluatedAt: canonicalTimestamp(
      record.evaluatedAt,
      'result.evaluatedAt',
    ),
    ...(record.safeMetadata === undefined
      ? {}
      : { safeMetadata: validateSafeMetadata(record.safeMetadata) }),
  });
}
