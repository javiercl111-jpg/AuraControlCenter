import {
  AUTHORITY_PRINCIPAL_RESOLUTION_CHANNELS,
  AUTHORITY_PRINCIPAL_TYPES,
  validateAuthorityPrincipalIdV1,
} from '../serverPrincipalResolution';
import {
  AuthorityTenantScopeValidationError,
  type AuthorityTenantScopeContractIssue,
} from './tenantScopeResolutionErrors';
import {
  AUTHORITY_PLATFORM_BOUNDARIES,
  AUTHORITY_PLATFORM_OPERATION_CATEGORIES,
  AUTHORITY_SUPPORT_IMPERSONATION_MODES,
  AUTHORITY_TENANT_BOOTSTRAP_OPERATIONS,
  AUTHORITY_TENANT_MEMBERSHIP_BINDING_VERSION,
  AUTHORITY_TENANT_MEMBERSHIP_STATUSES,
  AUTHORITY_TENANT_SCOPE_CONTEXT_VERSION,
  AUTHORITY_TENANT_SCOPE_EVIDENCE_VERSION,
  AUTHORITY_TENANT_SCOPE_FRESHNESS_VERSION,
  AUTHORITY_TENANT_SCOPE_OPERATION_CATEGORIES,
  AUTHORITY_TENANT_SCOPE_PRINCIPAL_REFERENCE_VERSION,
  AUTHORITY_TENANT_SCOPE_REASON_CODES,
  AUTHORITY_TENANT_SCOPE_REQUEST_VERSION,
  AUTHORITY_TENANT_SCOPE_RESOLUTION_SOURCES,
  AUTHORITY_TENANT_SCOPE_RESOLUTION_STATUSES,
  AUTHORITY_TENANT_SCOPE_RESULT_VERSION,
  AUTHORITY_TENANT_SCOPE_RETRY_DISPOSITIONS,
  AUTHORITY_TENANT_SCOPE_SCHEMA_VERSION,
  AUTHORITY_TENANT_SCOPE_STATUSES,
  AUTHORITY_TENANT_SCOPE_TYPES,
  AUTHORITY_TENANT_SELECTOR_TYPES,
  AUTHORITY_TENANT_SELECTOR_VERSION,
  type AuthorityLegacyCanonicalizationBindingV1,
  type AuthorityResolvedPrincipalReferenceV1,
  type AuthorityTenantAliasReferenceV1,
  type AuthorityTenantIdV1,
  type AuthorityTenantMembershipBindingV1,
  type AuthorityTenantScopeFreshnessV1,
  type AuthorityTenantScopeResolutionContextV1,
  type AuthorityTenantScopeResolutionEvidenceV1,
  type AuthorityTenantScopeResolutionRequestV1,
  type AuthorityTenantScopeResolutionResultV1,
  type AuthorityTenantScopeSafeMetadataV1,
  type AuthorityTenantScopeSourceVersionV1,
  type AuthorityTenantScopeStatus,
  type AuthorityTenantScopeType,
  type AuthorityTenantSelectorType,
  type AuthorityTenantSelectorV1,
  type ResolvedAuthorityTenantScopeV1,
  type ResolvedLegacyCanonicalizationScopeV1,
  type ResolvedMigrationTenantScopeV1,
  type ResolvedPlatformAuthorityScopeV1,
  type ResolvedSupportTenantScopeV1,
  type ResolvedTenantAuthorityScopeV1,
  type ResolvedTenantBootstrapScopeV1,
} from './tenantScopeResolutionTypes';

type PlainRecord = Record<string, unknown>;

const TENANT_AUTHORITY_STATUSES = Object.freeze([
  'PENDING',
  'ACTIVE',
  'SUSPENDED',
  'DEACTIVATED',
  'DELETED',
] as const);

const TENANT_ALIAS_TYPES = Object.freeze([
  'TENANT_SLUG',
  'LEGACY_TENANT_ID',
  'CLIENT_REFERENCE',
  'ORGANIZATION_REFERENCE',
] as const);

function fail(
  issue: AuthorityTenantScopeContractIssue,
  field?: string,
): never {
  throw new AuthorityTenantScopeValidationError(issue, field);
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
  issue: AuthorityTenantScopeContractIssue,
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

function reasonCode(value: unknown, field: string): string {
  if (
    typeof value !== 'string' ||
    value.length < 3 ||
    value.length > 128 ||
    !/^[A-Z][A-Z0-9_]*$/.test(value)
  ) {
    return fail('INVALID_REFERENCE', field);
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
    value.includes('*')
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

export function validateAuthorityTenantIdV1(
  value: unknown,
): AuthorityTenantIdV1 {
  try {
    return identifier(value, 'tenantId');
  } catch {
    return fail('INVALID_TENANT_ID', 'tenantId');
  }
}

export function validateAuthorityTenantAliasV1(
  value: unknown,
): AuthorityTenantAliasReferenceV1 {
  const record = closedRecord(
    value,
    ['aliasType', 'normalizedAlias'],
    'INVALID_ALIAS',
    'alias',
  );
  const normalizedAlias = record.normalizedAlias;
  if (
    typeof normalizedAlias !== 'string' ||
    normalizedAlias.length < 3 ||
    normalizedAlias.length > 128 ||
    !/^[a-z0-9][a-z0-9_-]*$/.test(normalizedAlias) ||
    normalizedAlias.includes('*')
  ) {
    return fail('INVALID_ALIAS', 'alias.normalizedAlias');
  }
  return Object.freeze({
    aliasType: enumValue(
      record.aliasType,
      TENANT_ALIAS_TYPES,
      'alias.aliasType',
    ),
    normalizedAlias,
  });
}

function validateLegacySourceRecordVersion(
  value: unknown,
): Readonly<
  | {
      schemaVersion: '1';
      provenance: 'EXPLICIT_NUMERIC_VERSION';
      explicitVersion: number;
    }
  | {
      schemaVersion: '1';
      provenance: 'CONTENT_FINGERPRINT_ONLY';
      contentFingerprint: string;
    }
> {
  if (!isPlainRecord(value)) {
    return fail('INVALID_SELECTOR', 'sourceDescriptor.recordVersion');
  }
  if (value.provenance === 'EXPLICIT_NUMERIC_VERSION') {
    const record = closedRecord(
      value,
      ['schemaVersion', 'provenance', 'explicitVersion'],
      'INVALID_SELECTOR',
      'sourceDescriptor.recordVersion',
    );
    if (
      typeof record.explicitVersion !== 'number' ||
      !Number.isSafeInteger(record.explicitVersion) ||
      record.explicitVersion < 0
    ) {
      return fail(
        'INVALID_SELECTOR',
        'sourceDescriptor.recordVersion.explicitVersion',
      );
    }
    return Object.freeze({
      schemaVersion: literal(
        record.schemaVersion,
        '1',
        'sourceDescriptor.recordVersion.schemaVersion',
      ),
      provenance: literal(
        record.provenance,
        'EXPLICIT_NUMERIC_VERSION',
        'sourceDescriptor.recordVersion.provenance',
      ),
      explicitVersion: record.explicitVersion,
    });
  }
  const record = closedRecord(
    value,
    ['schemaVersion', 'provenance', 'contentFingerprint'],
    'INVALID_SELECTOR',
    'sourceDescriptor.recordVersion',
  );
  return Object.freeze({
    schemaVersion: literal(
      record.schemaVersion,
      '1',
      'sourceDescriptor.recordVersion.schemaVersion',
    ),
    provenance: literal(
      record.provenance,
      'CONTENT_FINGERPRINT_ONLY',
      'sourceDescriptor.recordVersion.provenance',
    ),
    contentFingerprint: fingerprint(
      record.contentFingerprint,
      'sourceDescriptor.recordVersion.contentFingerprint',
    ),
  });
}

function validateLegacySourceDescriptor(
  value: unknown,
): Extract<
  AuthorityTenantSelectorV1,
  { readonly selectorType: 'LEGACY_SOURCE' }
>['sourceDescriptor'] {
  const record = closedRecord(
    value,
    [
      'schemaVersion',
      'sourceCollection',
      'sourceDocumentId',
      'sourceLocatorVersion',
      'expectedSourceRecordVersion',
      'expectedSourceFingerprint',
      'authorityUse',
    ],
    'INVALID_SELECTOR',
    'sourceDescriptor',
  );
  return Object.freeze({
    schemaVersion: literal(
      record.schemaVersion,
      '1',
      'sourceDescriptor.schemaVersion',
    ),
    sourceCollection: literal(
      record.sourceCollection,
      'PLATFORM_TENANTS',
      'sourceDescriptor.sourceCollection',
    ),
    sourceDocumentId: identifier(
      record.sourceDocumentId,
      'sourceDescriptor.sourceDocumentId',
    ),
    sourceLocatorVersion: literal(
      record.sourceLocatorVersion,
      '1',
      'sourceDescriptor.sourceLocatorVersion',
    ),
    ...(record.expectedSourceRecordVersion === undefined
      ? {}
      : {
          expectedSourceRecordVersion:
            validateLegacySourceRecordVersion(
              record.expectedSourceRecordVersion,
            ),
        }),
    ...(record.expectedSourceFingerprint === undefined
      ? {}
      : {
          expectedSourceFingerprint: fingerprint(
            record.expectedSourceFingerprint,
            'sourceDescriptor.expectedSourceFingerprint',
          ),
        }),
    authorityUse: literal(
      record.authorityUse,
      'PROHIBITED',
      'sourceDescriptor.authorityUse',
    ),
  });
}

function tenantIdSet(
  value: unknown,
  field: string,
): readonly AuthorityTenantIdV1[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 256) {
    return fail('INVALID_SELECTOR', field);
  }
  const validated = value.map((entry) => validateAuthorityTenantIdV1(entry));
  if (new Set(validated).size !== validated.length) {
    return fail('INVALID_SELECTOR', field);
  }
  return Object.freeze([...validated].sort());
}

export function validateAuthorityTenantSelectorV1(
  value: unknown,
): AuthorityTenantSelectorV1 {
  if (!isPlainRecord(value)) {
    return fail('INVALID_SELECTOR', 'selector');
  }
  const selectorType = enumValue(
    value.selectorType,
    AUTHORITY_TENANT_SELECTOR_TYPES,
    'selector.selectorType',
  );
  if (selectorType === 'TENANT_ID') {
    const record = closedRecord(
      value,
      ['schemaVersion', 'selectorType', 'requestedTenantId'],
      'INVALID_SELECTOR',
      'selector',
    );
    return Object.freeze({
      schemaVersion: literal(
        record.schemaVersion,
        AUTHORITY_TENANT_SELECTOR_VERSION,
        'selector.schemaVersion',
      ),
      selectorType,
      requestedTenantId: validateAuthorityTenantIdV1(
        record.requestedTenantId,
      ),
    });
  }
  if (selectorType === 'TENANT_ALIAS') {
    const record = closedRecord(
      value,
      ['schemaVersion', 'selectorType', 'alias'],
      'INVALID_SELECTOR',
      'selector',
    );
    return Object.freeze({
      schemaVersion: literal(
        record.schemaVersion,
        AUTHORITY_TENANT_SELECTOR_VERSION,
        'selector.schemaVersion',
      ),
      selectorType,
      alias: validateAuthorityTenantAliasV1(record.alias),
    });
  }
  if (selectorType === 'PLATFORM_SCOPE') {
    const record = closedRecord(
      value,
      [
        'schemaVersion',
        'selectorType',
        'platformScopeId',
        'platformBoundary',
      ],
      'INVALID_SELECTOR',
      'selector',
    );
    return Object.freeze({
      schemaVersion: literal(
        record.schemaVersion,
        AUTHORITY_TENANT_SELECTOR_VERSION,
        'selector.schemaVersion',
      ),
      selectorType,
      platformScopeId: identifier(
        record.platformScopeId,
        'selector.platformScopeId',
      ),
      platformBoundary: enumValue(
        record.platformBoundary,
        AUTHORITY_PLATFORM_BOUNDARIES,
        'selector.platformBoundary',
      ),
    });
  }
  if (selectorType === 'BOOTSTRAP_CANDIDATE') {
    const record = closedRecord(
      value,
      [
        'schemaVersion',
        'selectorType',
        'bootstrapRequestId',
        'tenantIdCandidate',
      ],
      'INVALID_SELECTOR',
      'selector',
    );
    return Object.freeze({
      schemaVersion: literal(
        record.schemaVersion,
        AUTHORITY_TENANT_SELECTOR_VERSION,
        'selector.schemaVersion',
      ),
      selectorType,
      bootstrapRequestId: identifier(
        record.bootstrapRequestId,
        'selector.bootstrapRequestId',
      ),
      tenantIdCandidate: validateAuthorityTenantIdV1(
        record.tenantIdCandidate,
      ),
    });
  }
  if (selectorType === 'LEGACY_SOURCE') {
    const record = closedRecord(
      value,
      ['schemaVersion', 'selectorType', 'sourceDescriptor'],
      'INVALID_SELECTOR',
      'selector',
    );
    return Object.freeze({
      schemaVersion: literal(
        record.schemaVersion,
        AUTHORITY_TENANT_SELECTOR_VERSION,
        'selector.schemaVersion',
      ),
      selectorType,
      sourceDescriptor: validateLegacySourceDescriptor(
        record.sourceDescriptor,
      ),
    });
  }
  if (selectorType === 'MIGRATION_TARGET') {
    const record = closedRecord(
      value,
      [
        'schemaVersion',
        'selectorType',
        'migrationId',
        'migrationRunId',
        'targetTenantIds',
      ],
      'INVALID_SELECTOR',
      'selector',
    );
    return Object.freeze({
      schemaVersion: literal(
        record.schemaVersion,
        AUTHORITY_TENANT_SELECTOR_VERSION,
        'selector.schemaVersion',
      ),
      selectorType,
      migrationId: identifier(
        record.migrationId,
        'selector.migrationId',
      ),
      migrationRunId: identifier(
        record.migrationRunId,
        'selector.migrationRunId',
      ),
      targetTenantIds: tenantIdSet(
        record.targetTenantIds,
        'selector.targetTenantIds',
      ),
    });
  }
  const record = closedRecord(
    value,
    [
      'schemaVersion',
      'selectorType',
      'supportSessionId',
      'requestedTenantId',
    ],
    'INVALID_SELECTOR',
    'selector',
  );
  return Object.freeze({
    schemaVersion: literal(
      record.schemaVersion,
      AUTHORITY_TENANT_SELECTOR_VERSION,
      'selector.schemaVersion',
    ),
    selectorType,
    supportSessionId: identifier(
      record.supportSessionId,
      'selector.supportSessionId',
    ),
    requestedTenantId: validateAuthorityTenantIdV1(
      record.requestedTenantId,
    ),
  });
}

export function validateAuthorityTenantMembershipBindingV1(
  value: unknown,
): AuthorityTenantMembershipBindingV1 {
  const record = closedRecord(
    value,
    [
      'schemaVersion',
      'membershipId',
      'tenantId',
      'principalId',
      'membershipStatus',
      'membershipVersion',
      'tenantAuthorityVersion',
      'roleSetVersion',
      'bindingVersion',
      'resolvedAt',
      'source',
      'evidenceFingerprint',
    ],
    'INVALID_MEMBERSHIP_BINDING',
    'membershipBinding',
  );
  return Object.freeze({
    schemaVersion: literal(
      record.schemaVersion,
      AUTHORITY_TENANT_MEMBERSHIP_BINDING_VERSION,
      'membershipBinding.schemaVersion',
    ),
    membershipId: validateAuthorityCanonicalMembershipReferenceV1(
      record.membershipId,
      'membershipBinding.membershipId',
    ),
    tenantId: validateAuthorityTenantIdV1(record.tenantId),
    principalId: identifier(
      record.principalId,
      'membershipBinding.principalId',
      16,
      160,
    ),
    membershipStatus: enumValue(
      record.membershipStatus,
      AUTHORITY_TENANT_MEMBERSHIP_STATUSES,
      'membershipBinding.membershipStatus',
    ),
    membershipVersion: version(
      record.membershipVersion,
      'membershipBinding.membershipVersion',
    ),
    tenantAuthorityVersion: version(
      record.tenantAuthorityVersion,
      'membershipBinding.tenantAuthorityVersion',
    ),
    ...(record.roleSetVersion === undefined
      ? {}
      : {
          roleSetVersion: version(
            record.roleSetVersion,
            'membershipBinding.roleSetVersion',
          ),
        }),
    bindingVersion: version(
      record.bindingVersion,
      'membershipBinding.bindingVersion',
    ),
    resolvedAt: canonicalTimestamp(
      record.resolvedAt,
      'membershipBinding.resolvedAt',
    ),
    source: literal(
      record.source,
      'CANONICAL_MEMBERSHIP',
      'membershipBinding.source',
    ),
    evidenceFingerprint: fingerprint(
      record.evidenceFingerprint,
      'membershipBinding.evidenceFingerprint',
    ),
  });
}

function validateSourceVersions(
  value: unknown,
): readonly AuthorityTenantScopeSourceVersionV1[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 8) {
    return fail('INVALID_EVIDENCE', 'resolutionEvidence.sourceVersions');
  }
  const validated = value.map((entry, index) => {
    const record = closedRecord(
      entry,
      ['source', 'version'],
      'INVALID_EVIDENCE',
      `resolutionEvidence.sourceVersions.${index}`,
    );
    return Object.freeze({
      source: enumValue(
        record.source,
        AUTHORITY_TENANT_SCOPE_RESOLUTION_SOURCES,
        `resolutionEvidence.sourceVersions.${index}.source`,
      ),
      version: version(
        record.version,
        `resolutionEvidence.sourceVersions.${index}.version`,
      ),
    });
  });
  const sources = validated.map(({ source }) => source);
  if (new Set(sources).size !== sources.length) {
    return fail('INVALID_EVIDENCE', 'resolutionEvidence.sourceVersions');
  }
  return Object.freeze([...validated].sort((left, right) =>
    left.source.localeCompare(right.source),
  ));
}

export function validateAuthorityTenantScopeResolutionEvidenceV1(
  value: unknown,
): AuthorityTenantScopeResolutionEvidenceV1 {
  const record = closedRecord(
    value,
    [
      'schemaVersion',
      'selectorType',
      'source',
      'tenantAuthorityVersion',
      'membershipBindingVersion',
      'aliasVersion',
      'sourceDescriptorFingerprint',
      'resolverVersion',
      'resolvedAt',
      'evidenceFingerprint',
      'principalId',
      'principalBindingVersion',
      'sourceVersions',
    ],
    'INVALID_EVIDENCE',
    'resolutionEvidence',
  );
  const source = enumValue(
    record.source,
    AUTHORITY_TENANT_SCOPE_RESOLUTION_SOURCES,
    'resolutionEvidence.source',
  );
  const sourceVersions = validateSourceVersions(record.sourceVersions);
  if (!sourceVersions.some((entry) => entry.source === source)) {
    return fail('INVALID_EVIDENCE', 'resolutionEvidence.sourceVersions');
  }
  return Object.freeze({
    schemaVersion: literal(
      record.schemaVersion,
      AUTHORITY_TENANT_SCOPE_EVIDENCE_VERSION,
      'resolutionEvidence.schemaVersion',
    ),
    selectorType: enumValue(
      record.selectorType,
      AUTHORITY_TENANT_SELECTOR_TYPES,
      'resolutionEvidence.selectorType',
    ),
    source,
    ...(record.tenantAuthorityVersion === undefined
      ? {}
      : {
          tenantAuthorityVersion: version(
            record.tenantAuthorityVersion,
            'resolutionEvidence.tenantAuthorityVersion',
          ),
        }),
    ...(record.membershipBindingVersion === undefined
      ? {}
      : {
          membershipBindingVersion: version(
            record.membershipBindingVersion,
            'resolutionEvidence.membershipBindingVersion',
          ),
        }),
    ...(record.aliasVersion === undefined
      ? {}
      : {
          aliasVersion: version(
            record.aliasVersion,
            'resolutionEvidence.aliasVersion',
          ),
        }),
    ...(record.sourceDescriptorFingerprint === undefined
      ? {}
      : {
          sourceDescriptorFingerprint: fingerprint(
            record.sourceDescriptorFingerprint,
            'resolutionEvidence.sourceDescriptorFingerprint',
          ),
        }),
    resolverVersion: version(
      record.resolverVersion,
      'resolutionEvidence.resolverVersion',
    ),
    resolvedAt: canonicalTimestamp(
      record.resolvedAt,
      'resolutionEvidence.resolvedAt',
    ),
    evidenceFingerprint: fingerprint(
      record.evidenceFingerprint,
      'resolutionEvidence.evidenceFingerprint',
    ),
    principalId: identifier(
      record.principalId,
      'resolutionEvidence.principalId',
      16,
      160,
    ),
    principalBindingVersion: version(
      record.principalBindingVersion,
      'resolutionEvidence.principalBindingVersion',
    ),
    sourceVersions,
  });
}

export function validateAuthorityTenantScopeFreshnessV1(
  value: unknown,
): AuthorityTenantScopeFreshnessV1 {
  const record = closedRecord(
    value,
    [
      'schemaVersion',
      'resolvedAt',
      'validUntil',
      'tenantAuthorityVersion',
      'membershipVersion',
      'aliasVersion',
      'bindingVersion',
      'staleAfterSeconds',
    ],
    'INVALID_FRESHNESS',
    'freshness',
  );
  const resolvedAt = canonicalTimestamp(
    record.resolvedAt,
    'freshness.resolvedAt',
  );
  const validUntil = canonicalTimestamp(
    record.validUntil,
    'freshness.validUntil',
  );
  const staleAfterSeconds = boundedSeconds(
    record.staleAfterSeconds,
    'freshness.staleAfterSeconds',
  );
  assertTimeOrder(resolvedAt, validUntil, false, 'freshness.validUntil');
  if (
    Date.parse(validUntil) - Date.parse(resolvedAt) !==
    staleAfterSeconds * 1_000
  ) {
    return fail('INVALID_FRESHNESS', 'freshness.validUntil');
  }
  return Object.freeze({
    schemaVersion: literal(
      record.schemaVersion,
      AUTHORITY_TENANT_SCOPE_FRESHNESS_VERSION,
      'freshness.schemaVersion',
    ),
    resolvedAt,
    validUntil,
    tenantAuthorityVersion: version(
      record.tenantAuthorityVersion,
      'freshness.tenantAuthorityVersion',
    ),
    ...(record.membershipVersion === undefined
      ? {}
      : {
          membershipVersion: version(
            record.membershipVersion,
            'freshness.membershipVersion',
          ),
        }),
    ...(record.aliasVersion === undefined
      ? {}
      : {
          aliasVersion: version(
            record.aliasVersion,
            'freshness.aliasVersion',
          ),
        }),
    bindingVersion: version(
      record.bindingVersion,
      'freshness.bindingVersion',
    ),
    staleAfterSeconds,
  });
}

export function validateAuthorityResolvedPrincipalReferenceV1(
  value: unknown,
): AuthorityResolvedPrincipalReferenceV1 {
  const record = closedRecord(
    value,
    [
      'schemaVersion',
      'principalId',
      'principalType',
      'principalBindingVersion',
      'principalEvidenceFingerprint',
      'principalResolvedAt',
    ],
    'INVALID_PRINCIPAL_REFERENCE',
    'principalReference',
  );
  const principalType = enumValue(
    record.principalType,
    AUTHORITY_PRINCIPAL_TYPES,
    'principalReference.principalType',
  );
  return Object.freeze({
    schemaVersion: literal(
      record.schemaVersion,
      AUTHORITY_TENANT_SCOPE_PRINCIPAL_REFERENCE_VERSION,
      'principalReference.schemaVersion',
    ),
    principalId: validateAuthorityPrincipalIdV1(
      record.principalId,
      principalType,
    ),
    principalType,
    principalBindingVersion: version(
      record.principalBindingVersion,
      'principalReference.principalBindingVersion',
    ),
    principalEvidenceFingerprint: fingerprint(
      record.principalEvidenceFingerprint,
      'principalReference.principalEvidenceFingerprint',
    ),
    principalResolvedAt: canonicalTimestamp(
      record.principalResolvedAt,
      'principalReference.principalResolvedAt',
    ),
  });
}

interface ValidatedScopeBase<T extends AuthorityTenantScopeType> {
  readonly scopeType: T;
  readonly status: AuthorityTenantScopeStatus;
  readonly resolvedAt: string;
  readonly freshness: AuthorityTenantScopeFreshnessV1;
  readonly resolutionEvidence: AuthorityTenantScopeResolutionEvidenceV1;
  readonly record: PlainRecord;
}

function scopeBase<T extends AuthorityTenantScopeType>(
  value: unknown,
  expectedType: T,
  variantKeys: readonly string[],
): ValidatedScopeBase<T> {
  const record = closedRecord(
    value,
    [
      'schemaVersion',
      'version',
      'scopeType',
      'status',
      'resolvedAt',
      'freshness',
      'resolutionEvidence',
      ...variantKeys,
    ],
    'INVALID_SCOPE',
    'scope',
  );
  literal(
    record.schemaVersion,
    AUTHORITY_TENANT_SCOPE_SCHEMA_VERSION,
    'scope.schemaVersion',
  );
  literal(
    record.version,
    AUTHORITY_TENANT_SCOPE_SCHEMA_VERSION,
    'scope.version',
  );
  const scopeType = literal(
    record.scopeType,
    expectedType,
    'scope.scopeType',
  );
  const status = enumValue(
    record.status,
    AUTHORITY_TENANT_SCOPE_STATUSES,
    'scope.status',
  );
  if (
    (status === 'PENDING_BOOTSTRAP' &&
      scopeType !== 'TENANT_BOOTSTRAP') ||
    (status === 'LEGACY_PENDING_CANONICALIZATION' &&
      scopeType !== 'LEGACY_CANONICALIZATION') ||
    (scopeType === 'TENANT_BOOTSTRAP' &&
      status !== 'PENDING_BOOTSTRAP') ||
    (scopeType === 'LEGACY_CANONICALIZATION' &&
      status !== 'LEGACY_PENDING_CANONICALIZATION')
  ) {
    return fail('INVALID_SCOPE', 'scope.status');
  }
  const resolvedAt = canonicalTimestamp(
    record.resolvedAt,
    'scope.resolvedAt',
  );
  const freshness = validateAuthorityTenantScopeFreshnessV1(
    record.freshness,
  );
  const resolutionEvidence =
    validateAuthorityTenantScopeResolutionEvidenceV1(
      record.resolutionEvidence,
    );
  if (
    freshness.resolvedAt !== resolvedAt ||
    resolutionEvidence.resolvedAt !== resolvedAt ||
    freshness.bindingVersion !==
      resolutionEvidence.principalBindingVersion
  ) {
    return fail('INVALID_SCOPE', 'scope');
  }
  return {
    scopeType,
    status,
    resolvedAt,
    freshness,
    resolutionEvidence,
    record,
  };
}

function assertSelectorType(
  evidence: AuthorityTenantScopeResolutionEvidenceV1,
  allowed: readonly AuthorityTenantSelectorType[],
): void {
  if (!allowed.includes(evidence.selectorType)) {
    fail('INVALID_SCOPE', 'scope.resolutionEvidence.selectorType');
  }
}

export function validateResolvedTenantAuthorityScopeV1(
  value: unknown,
): ResolvedTenantAuthorityScopeV1 {
  const base = scopeBase(value, 'TENANT', [
    'tenantId',
    'canonicalTenantAuthorityVersion',
    'membershipBinding',
    'tenantStatus',
    'requestedTenantSelector',
    'source',
  ]);
  const tenantId = validateAuthorityTenantIdV1(base.record.tenantId);
  const membershipBinding =
    validateAuthorityTenantMembershipBindingV1(
      base.record.membershipBinding,
    );
  const canonicalTenantAuthorityVersion = version(
    base.record.canonicalTenantAuthorityVersion,
    'scope.canonicalTenantAuthorityVersion',
  );
  const source = enumValue(
    base.record.source,
    [
      'CANONICAL_TENANT_AUTHORITY',
      'CANONICAL_MEMBERSHIP',
      'TENANT_ALIAS',
    ] as const,
    'scope.source',
  );
  const requestedTenantSelector =
    base.record.requestedTenantSelector === undefined
      ? undefined
      : validateAuthorityTenantSelectorV1(
          base.record.requestedTenantSelector,
        );
  if (
    membershipBinding.tenantId !== tenantId ||
    membershipBinding.principalId !==
      base.resolutionEvidence.principalId ||
    membershipBinding.tenantAuthorityVersion !==
      canonicalTenantAuthorityVersion ||
    membershipBinding.membershipVersion !==
      base.freshness.membershipVersion ||
    membershipBinding.bindingVersion !==
      base.resolutionEvidence.membershipBindingVersion ||
    canonicalTenantAuthorityVersion !==
      base.freshness.tenantAuthorityVersion ||
    canonicalTenantAuthorityVersion !==
      base.resolutionEvidence.tenantAuthorityVersion ||
    source !== base.resolutionEvidence.source ||
    (requestedTenantSelector !== undefined &&
      requestedTenantSelector.selectorType !== 'TENANT_ID' &&
      requestedTenantSelector.selectorType !== 'TENANT_ALIAS')
  ) {
    return fail('INVALID_SCOPE', 'scope');
  }
  assertSelectorType(base.resolutionEvidence, [
    'TENANT_ID',
    'TENANT_ALIAS',
  ]);
  return Object.freeze({
    schemaVersion: AUTHORITY_TENANT_SCOPE_SCHEMA_VERSION,
    version: AUTHORITY_TENANT_SCOPE_SCHEMA_VERSION,
    scopeType: base.scopeType,
    status: base.status,
    tenantId,
    canonicalTenantAuthorityVersion,
    membershipBinding,
    tenantStatus: enumValue(
      base.record.tenantStatus,
      TENANT_AUTHORITY_STATUSES,
      'scope.tenantStatus',
    ),
    ...(requestedTenantSelector === undefined
      ? {}
      : { requestedTenantSelector }),
    source,
    resolvedAt: base.resolvedAt,
    freshness: base.freshness,
    resolutionEvidence: base.resolutionEvidence,
  });
}

export function validateResolvedPlatformAuthorityScopeV1(
  value: unknown,
): ResolvedPlatformAuthorityScopeV1 {
  const base = scopeBase(value, 'PLATFORM', [
    'platformScopeId',
    'platformBoundary',
    'platformOperationCategory',
    'source',
  ]);
  assertSelectorType(base.resolutionEvidence, ['PLATFORM_SCOPE']);
  if (base.resolutionEvidence.source !== 'PLATFORM_AUTHORITY') {
    return fail('INVALID_SCOPE', 'scope.source');
  }
  return Object.freeze({
    schemaVersion: AUTHORITY_TENANT_SCOPE_SCHEMA_VERSION,
    version: AUTHORITY_TENANT_SCOPE_SCHEMA_VERSION,
    scopeType: base.scopeType,
    status: base.status,
    platformScopeId: identifier(
      base.record.platformScopeId,
      'scope.platformScopeId',
    ),
    platformBoundary: enumValue(
      base.record.platformBoundary,
      AUTHORITY_PLATFORM_BOUNDARIES,
      'scope.platformBoundary',
    ),
    platformOperationCategory: enumValue(
      base.record.platformOperationCategory,
      AUTHORITY_PLATFORM_OPERATION_CATEGORIES,
      'scope.platformOperationCategory',
    ),
    source: literal(
      base.record.source,
      'PLATFORM_AUTHORITY',
      'scope.source',
    ),
    resolvedAt: base.resolvedAt,
    freshness: base.freshness,
    resolutionEvidence: base.resolutionEvidence,
  });
}

export function validateResolvedTenantBootstrapScopeV1(
  value: unknown,
): ResolvedTenantBootstrapScopeV1 {
  const base = scopeBase(value, 'TENANT_BOOTSTRAP', [
    'bootstrapRequestId',
    'tenantIdCandidate',
    'bootstrapOperation',
    'initiatingPrincipalId',
    'principalBindingVersion',
    'bootstrapReasonCode',
    'source',
  ]);
  assertSelectorType(base.resolutionEvidence, ['BOOTSTRAP_CANDIDATE']);
  const initiatingPrincipalId = identifier(
    base.record.initiatingPrincipalId,
    'scope.initiatingPrincipalId',
    16,
    160,
  );
  const principalBindingVersion = version(
    base.record.principalBindingVersion,
    'scope.principalBindingVersion',
  );
  if (
    initiatingPrincipalId !== base.resolutionEvidence.principalId ||
    principalBindingVersion !==
      base.resolutionEvidence.principalBindingVersion ||
    base.resolutionEvidence.source !== 'BOOTSTRAP_REQUEST'
  ) {
    return fail('INVALID_SCOPE', 'scope');
  }
  return Object.freeze({
    schemaVersion: AUTHORITY_TENANT_SCOPE_SCHEMA_VERSION,
    version: AUTHORITY_TENANT_SCOPE_SCHEMA_VERSION,
    scopeType: base.scopeType,
    status: base.status,
    bootstrapRequestId: identifier(
      base.record.bootstrapRequestId,
      'scope.bootstrapRequestId',
    ),
    tenantIdCandidate: validateAuthorityTenantIdV1(
      base.record.tenantIdCandidate,
    ),
    bootstrapOperation: enumValue(
      base.record.bootstrapOperation,
      AUTHORITY_TENANT_BOOTSTRAP_OPERATIONS,
      'scope.bootstrapOperation',
    ),
    initiatingPrincipalId,
    principalBindingVersion,
    bootstrapReasonCode: reasonCode(
      base.record.bootstrapReasonCode,
      'scope.bootstrapReasonCode',
    ),
    source: literal(
      base.record.source,
      'BOOTSTRAP_REQUEST',
      'scope.source',
    ),
    resolvedAt: base.resolvedAt,
    freshness: base.freshness,
    resolutionEvidence: base.resolutionEvidence,
  });
}

function validateCanonicalizationBinding(
  value: unknown,
): AuthorityLegacyCanonicalizationBindingV1 {
  const record = closedRecord(
    value,
    ['migrationId', 'migrationRunId', 'bindingVersion'],
    'INVALID_SCOPE',
    'scope.canonicalizationBinding',
  );
  return Object.freeze({
    migrationId: identifier(
      record.migrationId,
      'scope.canonicalizationBinding.migrationId',
    ),
    migrationRunId: identifier(
      record.migrationRunId,
      'scope.canonicalizationBinding.migrationRunId',
    ),
    bindingVersion: version(
      record.bindingVersion,
      'scope.canonicalizationBinding.bindingVersion',
    ),
  });
}

function validateAliasCandidates(
  value: unknown,
): readonly AuthorityTenantAliasReferenceV1[] {
  if (!Array.isArray(value) || value.length > 32) {
    return fail('INVALID_SCOPE', 'scope.aliasCandidates');
  }
  const candidates = value.map(validateAuthorityTenantAliasV1);
  const keys = candidates.map(
    ({ aliasType, normalizedAlias }) => `${aliasType}:${normalizedAlias}`,
  );
  if (new Set(keys).size !== keys.length) {
    return fail('INVALID_SCOPE', 'scope.aliasCandidates');
  }
  return Object.freeze([...candidates].sort((left, right) =>
    `${left.aliasType}:${left.normalizedAlias}`.localeCompare(
      `${right.aliasType}:${right.normalizedAlias}`,
    ),
  ));
}

export function validateResolvedLegacyCanonicalizationScopeV1(
  value: unknown,
): ResolvedLegacyCanonicalizationScopeV1 {
  const base = scopeBase(value, 'LEGACY_CANONICALIZATION', [
    'legacySourceDescriptor',
    'canonicalTenantCandidate',
    'aliasCandidates',
    'canonicalizationBinding',
    'source',
  ]);
  assertSelectorType(base.resolutionEvidence, ['LEGACY_SOURCE']);
  if (
    base.resolutionEvidence.source !== 'LEGACY_PLATFORM_TENANT' ||
    base.resolutionEvidence.sourceDescriptorFingerprint === undefined
  ) {
    return fail('INVALID_SCOPE', 'scope.resolutionEvidence');
  }
  return Object.freeze({
    schemaVersion: AUTHORITY_TENANT_SCOPE_SCHEMA_VERSION,
    version: AUTHORITY_TENANT_SCOPE_SCHEMA_VERSION,
    scopeType: base.scopeType,
    status: base.status,
    legacySourceDescriptor: validateLegacySourceDescriptor(
      base.record.legacySourceDescriptor,
    ),
    canonicalTenantCandidate: validateAuthorityTenantIdV1(
      base.record.canonicalTenantCandidate,
    ),
    aliasCandidates: validateAliasCandidates(
      base.record.aliasCandidates,
    ),
    canonicalizationBinding: validateCanonicalizationBinding(
      base.record.canonicalizationBinding,
    ),
    source: literal(
      base.record.source,
      'LEGACY_PLATFORM_TENANT',
      'scope.source',
    ),
    resolvedAt: base.resolvedAt,
    freshness: base.freshness,
    resolutionEvidence: base.resolutionEvidence,
  });
}

export function validateResolvedMigrationTenantScopeV1(
  value: unknown,
): ResolvedMigrationTenantScopeV1 {
  const base = scopeBase(value, 'MIGRATION', [
    'migrationId',
    'migrationRunId',
    'manifestVersion',
    'targetTenantIds',
    'batchId',
    'batchScope',
    'scopeFingerprint',
    'source',
  ]);
  assertSelectorType(base.resolutionEvidence, ['MIGRATION_TARGET']);
  if (base.resolutionEvidence.source !== 'MIGRATION_MANIFEST') {
    return fail('INVALID_SCOPE', 'scope.source');
  }
  return Object.freeze({
    schemaVersion: AUTHORITY_TENANT_SCOPE_SCHEMA_VERSION,
    version: AUTHORITY_TENANT_SCOPE_SCHEMA_VERSION,
    scopeType: base.scopeType,
    status: base.status,
    migrationId: identifier(
      base.record.migrationId,
      'scope.migrationId',
    ),
    migrationRunId: identifier(
      base.record.migrationRunId,
      'scope.migrationRunId',
    ),
    manifestVersion: version(
      base.record.manifestVersion,
      'scope.manifestVersion',
    ),
    targetTenantIds: tenantIdSet(
      base.record.targetTenantIds,
      'scope.targetTenantIds',
    ),
    batchId: identifier(base.record.batchId, 'scope.batchId'),
    batchScope: reference(base.record.batchScope, 'scope.batchScope'),
    scopeFingerprint: fingerprint(
      base.record.scopeFingerprint,
      'scope.scopeFingerprint',
    ),
    source: literal(
      base.record.source,
      'MIGRATION_MANIFEST',
      'scope.source',
    ),
    resolvedAt: base.resolvedAt,
    freshness: base.freshness,
    resolutionEvidence: base.resolutionEvidence,
  });
}

export function validateResolvedSupportTenantScopeV1(
  value: unknown,
): ResolvedSupportTenantScopeV1 {
  const base = scopeBase(value, 'SUPPORT', [
    'supportSessionId',
    'operatorPrincipalId',
    'requestedTenantId',
    'supportScopeReasonCode',
    'allowedUntil',
    'impersonationMode',
    'source',
  ]);
  assertSelectorType(base.resolutionEvidence, ['SUPPORT_TARGET']);
  const operatorPrincipalId = identifier(
    base.record.operatorPrincipalId,
    'scope.operatorPrincipalId',
    16,
    160,
  );
  const allowedUntil = canonicalTimestamp(
    base.record.allowedUntil,
    'scope.allowedUntil',
  );
  if (
    operatorPrincipalId !== base.resolutionEvidence.principalId ||
    base.resolutionEvidence.source !== 'SUPPORT_SESSION'
  ) {
    return fail('INVALID_SCOPE', 'scope');
  }
  assertTimeOrder(
    base.resolvedAt,
    allowedUntil,
    false,
    'scope.allowedUntil',
  );
  return Object.freeze({
    schemaVersion: AUTHORITY_TENANT_SCOPE_SCHEMA_VERSION,
    version: AUTHORITY_TENANT_SCOPE_SCHEMA_VERSION,
    scopeType: base.scopeType,
    status: base.status,
    supportSessionId: identifier(
      base.record.supportSessionId,
      'scope.supportSessionId',
    ),
    operatorPrincipalId,
    requestedTenantId: validateAuthorityTenantIdV1(
      base.record.requestedTenantId,
    ),
    supportScopeReasonCode: reasonCode(
      base.record.supportScopeReasonCode,
      'scope.supportScopeReasonCode',
    ),
    allowedUntil,
    impersonationMode: enumValue(
      base.record.impersonationMode,
      AUTHORITY_SUPPORT_IMPERSONATION_MODES,
      'scope.impersonationMode',
    ),
    source: literal(
      base.record.source,
      'SUPPORT_SESSION',
      'scope.source',
    ),
    resolvedAt: base.resolvedAt,
    freshness: base.freshness,
    resolutionEvidence: base.resolutionEvidence,
  });
}

export function validateResolvedAuthorityTenantScopeV1(
  value: unknown,
): ResolvedAuthorityTenantScopeV1 {
  if (!isPlainRecord(value)) {
    return fail('INVALID_SCOPE', 'scope');
  }
  const scopeType = enumValue(
    value.scopeType,
    AUTHORITY_TENANT_SCOPE_TYPES,
    'scope.scopeType',
  );
  switch (scopeType) {
    case 'TENANT':
      return validateResolvedTenantAuthorityScopeV1(value);
    case 'PLATFORM':
      return validateResolvedPlatformAuthorityScopeV1(value);
    case 'TENANT_BOOTSTRAP':
      return validateResolvedTenantBootstrapScopeV1(value);
    case 'LEGACY_CANONICALIZATION':
      return validateResolvedLegacyCanonicalizationScopeV1(value);
    case 'MIGRATION':
      return validateResolvedMigrationTenantScopeV1(value);
    case 'SUPPORT':
      return validateResolvedSupportTenantScopeV1(value);
  }
}

export function validateAuthorityTenantScopeResolutionRequestV1(
  value: unknown,
): AuthorityTenantScopeResolutionRequestV1 {
  const record = closedRecord(
    value,
    [
      'schemaVersion',
      'principalReference',
      'selector',
      'channel',
      'requestId',
      'correlationId',
      'resolutionTime',
      'operationCategory',
    ],
    'INVALID_REQUEST',
    'request',
  );
  const principalReference =
    validateAuthorityResolvedPrincipalReferenceV1(
      record.principalReference,
    );
  const resolutionTime = canonicalTimestamp(
    record.resolutionTime,
    'request.resolutionTime',
  );
  assertTimeOrder(
    principalReference.principalResolvedAt,
    resolutionTime,
    true,
    'request.resolutionTime',
  );
  return Object.freeze({
    schemaVersion: literal(
      record.schemaVersion,
      AUTHORITY_TENANT_SCOPE_REQUEST_VERSION,
      'request.schemaVersion',
    ),
    principalReference,
    selector: validateAuthorityTenantSelectorV1(record.selector),
    channel: enumValue(
      record.channel,
      AUTHORITY_PRINCIPAL_RESOLUTION_CHANNELS,
      'request.channel',
    ),
    requestId: identifier(record.requestId, 'request.requestId'),
    correlationId: identifier(
      record.correlationId,
      'request.correlationId',
    ),
    resolutionTime,
    ...(record.operationCategory === undefined
      ? {}
      : {
          operationCategory: enumValue(
            record.operationCategory,
            AUTHORITY_TENANT_SCOPE_OPERATION_CATEGORIES,
            'request.operationCategory',
          ),
        }),
  });
}

export function validateAuthorityTenantScopeResolutionContextV1(
  value: unknown,
): AuthorityTenantScopeResolutionContextV1 {
  const record = closedRecord(
    value,
    [
      'schemaVersion',
      'requestId',
      'correlationId',
      'channel',
      'resolutionTime',
      'resolverVersion',
      'cancellationPolicy',
    ],
    'INVALID_CONTEXT',
    'context',
  );
  return Object.freeze({
    schemaVersion: literal(
      record.schemaVersion,
      AUTHORITY_TENANT_SCOPE_CONTEXT_VERSION,
      'context.schemaVersion',
    ),
    requestId: identifier(record.requestId, 'context.requestId'),
    correlationId: identifier(
      record.correlationId,
      'context.correlationId',
    ),
    channel: enumValue(
      record.channel,
      AUTHORITY_PRINCIPAL_RESOLUTION_CHANNELS,
      'context.channel',
    ),
    resolutionTime: canonicalTimestamp(
      record.resolutionTime,
      'context.resolutionTime',
    ),
    resolverVersion: version(
      record.resolverVersion,
      'context.resolverVersion',
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
): AuthorityTenantScopeSafeMetadataV1 {
  const record = closedRecord(
    value,
    ['resolverReference', 'evidenceFingerprint'],
    'INVALID_RESULT',
    'result.safeMetadata',
  );
  return Object.freeze({
    ...(record.resolverReference === undefined
      ? {}
      : {
          resolverReference: identifier(
            record.resolverReference,
            'result.safeMetadata.resolverReference',
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
    (typeof AUTHORITY_TENANT_SCOPE_RESOLUTION_STATUSES)[number],
    'RESOLVED'
  >,
  reason: (typeof AUTHORITY_TENANT_SCOPE_REASON_CODES)[number],
  retry: (typeof AUTHORITY_TENANT_SCOPE_RETRY_DISPOSITIONS)[number],
): void {
  const reasons: Readonly<Record<typeof status, readonly typeof reason[]>> = {
    NOT_FOUND: [
      'TENANT_NOT_FOUND',
      'TENANT_ALIAS_NOT_FOUND',
      'MEMBERSHIP_NOT_FOUND',
      'LEGACY_SOURCE_NOT_FOUND',
    ],
    REJECTED: [
      'TENANT_DISABLED',
      'TENANT_SELECTOR_INVALID',
      'MEMBERSHIP_INACTIVE',
      'PLATFORM_SCOPE_NOT_SUPPORTED',
      'BOOTSTRAP_SCOPE_INVALID',
      'MIGRATION_SCOPE_INVALID',
      'SUPPORT_SCOPE_INVALID',
      'INVALID_RESOLUTION_REQUEST',
    ],
    STALE: [
      'TENANT_AUTHORITY_STALE',
      'MEMBERSHIP_STALE',
      'SUPPORT_SESSION_EXPIRED',
    ],
    REVOKED: ['TENANT_REVOKED', 'MEMBERSHIP_INACTIVE'],
    CONFLICT: [
      'PRINCIPAL_TENANT_BINDING_CONFLICT',
      'LEGACY_SOURCE_CONFLICT',
    ],
    AMBIGUOUS: ['TENANT_ALIAS_AMBIGUOUS'],
    INTERNAL_ERROR: ['INTERNAL_RESOLUTION_FAILURE'],
  };
  const retries: Readonly<Record<typeof status, readonly typeof retry[]>> = {
    NOT_FOUND: ['DO_NOT_RETRY', 'RETRY_AFTER_OPERATOR_REVIEW'],
    REJECTED: ['DO_NOT_RETRY', 'RETRY_AFTER_OPERATOR_REVIEW'],
    STALE: [
      'RETRY_AFTER_REFRESH',
      'RETRY_AFTER_MEMBERSHIP_REFRESH',
      'RETRY_AFTER_TENANT_REFRESH',
    ],
    REVOKED: ['DO_NOT_RETRY'],
    CONFLICT: ['RETRY_AFTER_OPERATOR_REVIEW'],
    AMBIGUOUS: ['DO_NOT_RETRY', 'RETRY_AFTER_OPERATOR_REVIEW'],
    INTERNAL_ERROR: ['SAFE_TO_RETRY'],
  };
  if (!reasons[status].includes(reason)) {
    fail('INVALID_RESULT', 'result.reasonCode');
  }
  if (!retries[status].includes(retry)) {
    fail('INVALID_RESULT', 'result.retryDisposition');
  }
}

export function validateAuthorityTenantScopeResolutionResultV1(
  value: unknown,
): AuthorityTenantScopeResolutionResultV1 {
  if (!isPlainRecord(value)) {
    return fail('INVALID_RESULT', 'result');
  }
  const status = enumValue(
    value.status,
    AUTHORITY_TENANT_SCOPE_RESOLUTION_STATUSES,
    'result.status',
  );
  if (status === 'RESOLVED') {
    const record = closedRecord(
      value,
      ['schemaVersion', 'status', 'scope'],
      'INVALID_RESULT',
      'result',
    );
    return Object.freeze({
      schemaVersion: literal(
        record.schemaVersion,
        AUTHORITY_TENANT_SCOPE_RESULT_VERSION,
        'result.schemaVersion',
      ),
      status,
      scope: validateResolvedAuthorityTenantScopeV1(record.scope),
    });
  }
  const record = closedRecord(
    value,
    [
      'schemaVersion',
      'status',
      'reasonCode',
      'retryDisposition',
      'resolverVersion',
      'resolvedAt',
      'safeMetadata',
    ],
    'INVALID_RESULT',
    'result',
  );
  const resultReason = enumValue(
    record.reasonCode,
    AUTHORITY_TENANT_SCOPE_REASON_CODES,
    'result.reasonCode',
  );
  const retryDisposition = enumValue(
    record.retryDisposition,
    AUTHORITY_TENANT_SCOPE_RETRY_DISPOSITIONS,
    'result.retryDisposition',
  );
  assertResultCompatibility(status, resultReason, retryDisposition);
  return Object.freeze({
    schemaVersion: literal(
      record.schemaVersion,
      AUTHORITY_TENANT_SCOPE_RESULT_VERSION,
      'result.schemaVersion',
    ),
    status,
    reasonCode: resultReason,
    retryDisposition,
    resolverVersion: version(
      record.resolverVersion,
      'result.resolverVersion',
    ),
    resolvedAt: canonicalTimestamp(
      record.resolvedAt,
      'result.resolvedAt',
    ),
    ...(record.safeMetadata === undefined
      ? {}
      : { safeMetadata: validateSafeMetadata(record.safeMetadata) }),
  });
}
