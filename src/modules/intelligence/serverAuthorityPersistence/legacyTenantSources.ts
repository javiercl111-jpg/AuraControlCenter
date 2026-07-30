import { createCanonicalAuthorityHashV1 } from './canonicalHash';
import {
  failAuthorityPersistenceContract,
  freezeArray,
  getClosedRecord,
  hasDefined,
  requireCanonicalDocumentId,
  requireCanonicalTimestamp,
  requireEnumValue,
  requireExactLiteral,
  requireFingerprint,
  requirePositiveInteger,
} from './helpers';
import {
  LEGACY_TENANT_CANONICALIZATION_CLASSIFICATIONS,
  LEGACY_TENANT_VARIANTS,
  type LegacyTenantCanonicalizationClassificationV1,
  type LegacyTenantVariantV1,
  type TenantAliasType,
  type TenantAuthorityStatus,
} from './types';

export const AUTHORITY_LEGACY_TENANT_SOURCE_DESCRIPTOR_VERSION =
  '1' as const;
export const AUTHORITY_LEGACY_TENANT_PHYSICAL_LOCATOR_VERSION =
  '1' as const;
export const AUTHORITY_LEGACY_TENANT_SOURCE_LOCATOR_VERSION =
  '1' as const;
export const AUTHORITY_LEGACY_TENANT_RAW_RECORD_VERSION = '1' as const;
export const AUTHORITY_LEGACY_SOURCE_RECORD_VERSION = '1' as const;
export const AUTHORITY_LEGACY_SOURCE_RECORD_VERSION_SCHEMA = '1' as const;
export const AUTHORITY_REPOSITORY_READ_REGISTRY_ENTRY_VERSION =
  '1' as const;

export const AUTHORITY_LEGACY_TENANT_SOURCE_COLLECTIONS = Object.freeze([
  'PLATFORM_TENANTS',
] as const);

export type AuthorityLegacyTenantSourceCollectionV1 =
  (typeof AUTHORITY_LEGACY_TENANT_SOURCE_COLLECTIONS)[number];

export const AUTHORITY_LEGACY_SOURCE_RECORD_VERSION_PROVENANCES =
  Object.freeze([
    'EXPLICIT_NUMERIC_VERSION',
    'CONTENT_FINGERPRINT_ONLY',
  ] as const);

export type AuthorityLegacySourceRecordVersionProvenanceV1 =
  (typeof AUTHORITY_LEGACY_SOURCE_RECORD_VERSION_PROVENANCES)[number];

export type AuthorityLegacySourceRecordVersionV1 =
  | Readonly<{
      schemaVersion:
        typeof AUTHORITY_LEGACY_SOURCE_RECORD_VERSION_SCHEMA;
      provenance: 'EXPLICIT_NUMERIC_VERSION';
      explicitVersion: number;
    }>
  | Readonly<{
      schemaVersion:
        typeof AUTHORITY_LEGACY_SOURCE_RECORD_VERSION_SCHEMA;
      provenance: 'CONTENT_FINGERPRINT_ONLY';
      contentFingerprint: string;
    }>;

export interface AuthorityLegacyTenantSourceDescriptorV1 {
  readonly schemaVersion:
    typeof AUTHORITY_LEGACY_TENANT_SOURCE_DESCRIPTOR_VERSION;
  readonly sourceCollection: AuthorityLegacyTenantSourceCollectionV1;
  readonly sourceDocumentId: string;
  readonly sourceLocatorVersion:
    typeof AUTHORITY_LEGACY_TENANT_SOURCE_LOCATOR_VERSION;
  readonly expectedSourceRecordVersion?: AuthorityLegacySourceRecordVersionV1;
  readonly expectedSourceFingerprint?: string;
  readonly authorityUse: 'PROHIBITED';
}

export interface AuthorityLegacyTenantPhysicalLocatorV1 {
  readonly schemaVersion:
    typeof AUTHORITY_LEGACY_TENANT_PHYSICAL_LOCATOR_VERSION;
  readonly collectionPath: 'platform_tenants';
  readonly documentId: string;
  readonly locatorKey: string;
  readonly sourceCollection: AuthorityLegacyTenantSourceCollectionV1;
  readonly sourceLocatorVersion:
    typeof AUTHORITY_LEGACY_TENANT_SOURCE_LOCATOR_VERSION;
}

export interface AuthorityLegacyTenantTimestampShapeV1 {
  readonly seconds: number;
  readonly nanoseconds: number;
}

export type AuthorityLegacyTenantTimestampV1 =
  | string
  | AuthorityLegacyTenantTimestampShapeV1;

export interface AuthorityLegacyTenantUsageV1 {
  readonly hcmActiveEmployees: number;
  readonly hcmEmployeeLimit: number;
  readonly hcmWarningThreshold: number;
}

export interface AuthorityLegacyTenantRawRecordV1 {
  readonly tenantId?: string;
  readonly tenantSlug?: string;
  readonly status?: string;
  readonly tenantStatus?: string;
  readonly companyId?: string;
  readonly companyName?: string;
  readonly tenantName?: string;
  readonly tradeName?: string;
  readonly clientId?: string;
  readonly organizationId?: string;
  readonly quoteId?: string;
  readonly licenseStatus?: string;
  readonly hcmTenantStatus?: string;
  readonly maintenanceTenantStatus?: string;
  readonly selectedModules?: readonly string[];
  readonly enabledModules?: readonly string[];
  readonly allowedDomains?: readonly string[];
  readonly subdomain?: string | null;
  readonly customDomain?: string | null;
  readonly suspendedReason?: string;
  readonly usage?: AuthorityLegacyTenantUsageV1;
  readonly createdAt?: AuthorityLegacyTenantTimestampV1;
  readonly updatedAt?: AuthorityLegacyTenantTimestampV1;
  readonly schemaVersion?: string | number;
  readonly recordVersion?: number;
}

export interface AuthorityLegacyTenantNormalizedRawRecordV1
  extends Omit<
    AuthorityLegacyTenantRawRecordV1,
    'createdAt' | 'updatedAt'
  > {
  readonly createdAt?: string;
  readonly updatedAt?: string;
}

export const AUTHORITY_LEGACY_TENANT_ALIAS_TYPES = Object.freeze([
  'TENANT_SLUG',
  'LEGACY_TENANT_ID',
  'CLIENT_REFERENCE',
  'ORGANIZATION_REFERENCE',
] as const satisfies readonly TenantAliasType[]);

export const AUTHORITY_LEGACY_TENANT_ALIAS_SOURCE_FIELDS =
  Object.freeze([
    'TENANT_ID',
    'TENANT_SLUG',
    'CLIENT_ID',
    'ORGANIZATION_ID',
  ] as const);

export type AuthorityLegacyTenantAliasSourceFieldV1 =
  (typeof AUTHORITY_LEGACY_TENANT_ALIAS_SOURCE_FIELDS)[number];

export const AUTHORITY_LEGACY_TENANT_ALIAS_CONFIDENCES = Object.freeze([
  'EXACT',
  'DERIVED',
  'AMBIGUOUS',
] as const);

export type AuthorityLegacyTenantAliasConfidenceV1 =
  (typeof AUTHORITY_LEGACY_TENANT_ALIAS_CONFIDENCES)[number];

export const AUTHORITY_LEGACY_TENANT_ALIAS_DISPOSITIONS = Object.freeze([
  'RESERVE',
  'REVIEW',
  'REJECT',
] as const);

export type AuthorityLegacyTenantAliasDispositionV1 =
  (typeof AUTHORITY_LEGACY_TENANT_ALIAS_DISPOSITIONS)[number];

export interface AuthorityLegacyTenantAliasCandidateV1 {
  readonly aliasType: TenantAliasType;
  readonly normalizedAlias: string;
  readonly sourceField: AuthorityLegacyTenantAliasSourceFieldV1;
  readonly confidence: AuthorityLegacyTenantAliasConfidenceV1;
  readonly disposition: AuthorityLegacyTenantAliasDispositionV1;
}

export const AUTHORITY_LEGACY_TENANT_CANONICALIZATION_WARNINGS =
  Object.freeze([
    'AMBIGUOUS_ALIAS',
    'COMPANY_NAME_IGNORED',
    'INVALID_ALIAS',
    'MISSING_SLUG',
    'MISSING_STATUS',
    'SOURCE_DOCUMENT_ID_NOT_CANONICAL_ID',
    'STATUS_CONFLICT',
    'UNKNOWN_STATUS',
  ] as const);

export type AuthorityLegacyTenantCanonicalizationWarningV1 =
  (typeof AUTHORITY_LEGACY_TENANT_CANONICALIZATION_WARNINGS)[number];

export interface AuthorityLegacyTenantSourceRecordV1 {
  readonly schemaVersion: typeof AUTHORITY_LEGACY_SOURCE_RECORD_VERSION;
  readonly sourceDescriptor: AuthorityLegacyTenantSourceDescriptorV1;
  readonly sourceLocator: AuthorityLegacyTenantPhysicalLocatorV1;
  readonly sourceRecordVersion: AuthorityLegacySourceRecordVersionV1;
  readonly sourceRecordFingerprint: string;
  readonly classifiedVariant: LegacyTenantVariantV1;
  readonly classificationDisposition:
    LegacyTenantCanonicalizationClassificationV1;
  readonly sourceDocumentId: string;
  readonly observedTenantId?: string;
  readonly observedTenantSlug?: string;
  readonly observedStatus?: string;
  readonly observedTenantStatus?: string;
  readonly normalizedStatus?: TenantAuthorityStatus;
  readonly aliasCandidates: readonly AuthorityLegacyTenantAliasCandidateV1[];
  readonly canonicalizationWarnings:
    readonly AuthorityLegacyTenantCanonicalizationWarningV1[];
  readonly normalizedRawRecord:
    AuthorityLegacyTenantNormalizedRawRecordV1;
  readonly decodedAt: string;
  readonly authorityUse: 'PROHIBITED';
}

export const AUTHORITY_REPOSITORY_READ_STATUSES = Object.freeze([
  'PRESENT',
  'ABSENT',
] as const);

export type AuthorityRepositoryReadStatusV1 =
  (typeof AUTHORITY_REPOSITORY_READ_STATUSES)[number];

export type AuthorityRepositoryReadRegistryEntryV1 =
  | Readonly<{
      schemaVersion:
        typeof AUTHORITY_REPOSITORY_READ_REGISTRY_ENTRY_VERSION;
      collection: AuthorityLegacyTenantSourceCollectionV1;
      documentId: string;
      locatorKey: string;
      readStatus: 'PRESENT';
      recordFingerprint: string;
      recordVersion: AuthorityLegacySourceRecordVersionV1;
      authorityUse: 'PROHIBITED';
    }>
  | Readonly<{
      schemaVersion:
        typeof AUTHORITY_REPOSITORY_READ_REGISTRY_ENTRY_VERSION;
      collection: AuthorityLegacyTenantSourceCollectionV1;
      documentId: string;
      locatorKey: string;
      readStatus: 'ABSENT';
      authorityUse: 'PROHIBITED';
    }>;

const RAW_RECORD_KEYS = Object.freeze([
  'tenantId',
  'tenantSlug',
  'status',
  'tenantStatus',
  'companyId',
  'companyName',
  'tenantName',
  'tradeName',
  'clientId',
  'organizationId',
  'quoteId',
  'licenseStatus',
  'hcmTenantStatus',
  'maintenanceTenantStatus',
  'selectedModules',
  'enabledModules',
  'allowedDomains',
  'subdomain',
  'customDomain',
  'suspendedReason',
  'usage',
  'createdAt',
  'updatedAt',
  'schemaVersion',
  'recordVersion',
] as const);

const SOURCE_RECORD_KEYS = Object.freeze([
  'schemaVersion',
  'sourceDescriptor',
  'sourceLocator',
  'sourceRecordVersion',
  'sourceRecordFingerprint',
  'classifiedVariant',
  'classificationDisposition',
  'sourceDocumentId',
  'observedTenantId',
  'observedTenantSlug',
  'observedStatus',
  'observedTenantStatus',
  'normalizedStatus',
  'aliasCandidates',
  'canonicalizationWarnings',
  'normalizedRawRecord',
  'decodedAt',
  'authorityUse',
] as const);

const MINIMUM_TIMESTAMP_SECONDS = -62_135_596_800;
const MAXIMUM_TIMESTAMP_SECONDS = 253_402_300_799;

function requireLegacySourceDocumentId(value: unknown): string {
  if (
    typeof value !== 'string' ||
    value.length < 1 ||
    value.length > 128 ||
    value.trim() !== value ||
    !/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(value) ||
    value === '.' ||
    value === '..' ||
    value.includes('/') ||
    value.includes('\\')
  ) {
    return failAuthorityPersistenceContract(
      'INVALID_LEGACY_SOURCE_DESCRIPTOR',
    );
  }
  return value;
}

function requireLegacyIdentifier(value: unknown): string {
  if (
    typeof value !== 'string' ||
    value.length < 1 ||
    value.length > 256 ||
    value.trim() !== value ||
    !/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(value) ||
    value.includes('..')
  ) {
    return failAuthorityPersistenceContract(
      'INVALID_LEGACY_RAW_RECORD',
    );
  }
  return value;
}

function requireLegacyText(value: unknown): string {
  if (
    typeof value !== 'string' ||
    value.length < 1 ||
    value.length > 256 ||
    value.trim() !== value ||
    [...value].some((character) => {
      const codePoint = character.codePointAt(0);
      return (
        codePoint !== undefined &&
        (codePoint < 32 || codePoint === 127)
      );
    })
  ) {
    return failAuthorityPersistenceContract(
      'INVALID_LEGACY_RAW_RECORD',
    );
  }
  return value;
}

function requireLegacyStatusToken(value: unknown): string {
  if (
    typeof value !== 'string' ||
    value.length < 1 ||
    value.length > 64 ||
    value.trim() !== value ||
    !/^[A-Za-z][A-Za-z_]*$/.test(value)
  ) {
    return failAuthorityPersistenceContract(
      'INVALID_LEGACY_RAW_RECORD',
    );
  }
  return value;
}

function requireLegacySchemaVersion(value: unknown): string | number {
  if (
    (typeof value === 'string' &&
      value.length > 0 &&
      value.length <= 64 &&
      value.trim() === value &&
      /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value)) ||
    (typeof value === 'number' &&
      Number.isSafeInteger(value) &&
      value > 0)
  ) {
    return value;
  }
  return failAuthorityPersistenceContract(
    'INVALID_LEGACY_RAW_RECORD',
  );
}

function requireLegacyModuleArray(value: unknown): readonly string[] {
  if (!Array.isArray(value) || value.length > 64) {
    return failAuthorityPersistenceContract(
      'INVALID_LEGACY_RAW_RECORD',
    );
  }
  const modules = value.map((entry) => {
    if (
      typeof entry !== 'string' ||
      entry.length < 1 ||
      entry.length > 64 ||
      !/^[A-Z][A-Z0-9_]*$/.test(entry)
    ) {
      return failAuthorityPersistenceContract(
        'INVALID_LEGACY_RAW_RECORD',
      );
    }
    return entry;
  });
  if (new Set(modules).size !== modules.length) {
    return failAuthorityPersistenceContract(
      'INVALID_LEGACY_RAW_RECORD',
    );
  }
  return freezeArray([...modules].sort());
}

function requireLegacyDomain(value: unknown): string {
  if (
    typeof value !== 'string' ||
    value.length < 3 ||
    value.length > 253 ||
    value !== value.toLowerCase() ||
    !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])$/.test(value) ||
    value.includes('..')
  ) {
    return failAuthorityPersistenceContract(
      'INVALID_LEGACY_RAW_RECORD',
    );
  }
  return value;
}

function requireLegacyDomainArray(value: unknown): readonly string[] {
  if (!Array.isArray(value) || value.length > 64) {
    return failAuthorityPersistenceContract(
      'INVALID_LEGACY_RAW_RECORD',
    );
  }
  const domains = value.map(requireLegacyDomain);
  if (new Set(domains).size !== domains.length) {
    return failAuthorityPersistenceContract(
      'INVALID_LEGACY_RAW_RECORD',
    );
  }
  return freezeArray([...domains].sort());
}

function requireLegacySubdomain(value: unknown): string | null {
  if (value === null) {
    return null;
  }
  if (
    typeof value !== 'string' ||
    value.length < 1 ||
    value.length > 63 ||
    !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(value)
  ) {
    return failAuthorityPersistenceContract(
      'INVALID_LEGACY_RAW_RECORD',
    );
  }
  return value;
}

function requireNonNegativeSafeInteger(value: unknown): number {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    return failAuthorityPersistenceContract(
      'INVALID_LEGACY_RAW_RECORD',
    );
  }
  return value;
}

function validateLegacyUsage(
  value: unknown,
): AuthorityLegacyTenantUsageV1 {
  const record = getClosedRecord(
    value,
    [
      'hcmActiveEmployees',
      'hcmEmployeeLimit',
      'hcmWarningThreshold',
    ],
    'INVALID_LEGACY_RAW_RECORD',
  );
  const usage = Object.freeze({
    hcmActiveEmployees: requireNonNegativeSafeInteger(
      record.hcmActiveEmployees,
    ),
    hcmEmployeeLimit: requireNonNegativeSafeInteger(
      record.hcmEmployeeLimit,
    ),
    hcmWarningThreshold: requireNonNegativeSafeInteger(
      record.hcmWarningThreshold,
    ),
  });
  if (
    usage.hcmActiveEmployees > usage.hcmEmployeeLimit ||
    usage.hcmWarningThreshold > usage.hcmEmployeeLimit
  ) {
    return failAuthorityPersistenceContract(
      'INVALID_LEGACY_RAW_RECORD',
    );
  }
  return usage;
}

function validateLegacyTimestampShape(
  value: unknown,
): AuthorityLegacyTenantTimestampV1 {
  if (typeof value === 'string') {
    normalizeLegacyTenantTimestampV1(value);
    return value;
  }
  const record = getClosedRecord(
    value,
    ['seconds', 'nanoseconds'],
    'INVALID_LEGACY_TIMESTAMP',
  );
  if (
    typeof record.seconds !== 'number' ||
    !Number.isSafeInteger(record.seconds) ||
    typeof record.nanoseconds !== 'number' ||
    !Number.isSafeInteger(record.nanoseconds)
  ) {
    return failAuthorityPersistenceContract(
      'INVALID_LEGACY_TIMESTAMP',
    );
  }
  normalizeLegacyTenantTimestampV1(record);
  return Object.freeze({
    seconds: record.seconds,
    nanoseconds: record.nanoseconds,
  });
}

function optionalValue<T>(
  record: Readonly<Record<string, unknown>>,
  key: string,
  validator: (value: unknown) => T,
): T | undefined {
  return hasDefined(record, key) ? validator(record[key]) : undefined;
}

export function getLegacyTenantSourceCollectionPathV1(
  collection: unknown,
): 'platform_tenants' {
  const validated = requireEnumValue(
    collection,
    AUTHORITY_LEGACY_TENANT_SOURCE_COLLECTIONS,
    'INVALID_LEGACY_SOURCE_COLLECTION',
  );
  switch (validated) {
    case 'PLATFORM_TENANTS':
      return 'platform_tenants';
  }
}

export function validateAuthorityLegacySourceRecordVersionV1(
  value: unknown,
): AuthorityLegacySourceRecordVersionV1 {
  const record = getClosedRecord(
    value,
    [
      'schemaVersion',
      'provenance',
      'explicitVersion',
      'contentFingerprint',
    ],
    'INVALID_LEGACY_SOURCE_VERSION',
  );
  const provenance = requireEnumValue(
    record.provenance,
    AUTHORITY_LEGACY_SOURCE_RECORD_VERSION_PROVENANCES,
    'INVALID_LEGACY_SOURCE_VERSION',
  );
  const schemaVersion = requireExactLiteral(
    record.schemaVersion,
    AUTHORITY_LEGACY_SOURCE_RECORD_VERSION_SCHEMA,
    'INVALID_LEGACY_SOURCE_VERSION',
  );
  if (provenance === 'EXPLICIT_NUMERIC_VERSION') {
    if (
      !hasDefined(record, 'explicitVersion') ||
      hasDefined(record, 'contentFingerprint')
    ) {
      return failAuthorityPersistenceContract(
        'INVALID_LEGACY_SOURCE_VERSION',
      );
    }
    return Object.freeze({
      schemaVersion,
      provenance,
      explicitVersion: requirePositiveInteger(
        record.explicitVersion,
        'INVALID_LEGACY_SOURCE_VERSION',
      ),
    });
  }
  if (
    hasDefined(record, 'explicitVersion') ||
    !hasDefined(record, 'contentFingerprint')
  ) {
    return failAuthorityPersistenceContract(
      'INVALID_LEGACY_SOURCE_VERSION',
    );
  }
  return Object.freeze({
    schemaVersion,
    provenance,
    contentFingerprint: requireFingerprint(
      record.contentFingerprint,
      'INVALID_LEGACY_SOURCE_VERSION',
    ),
  });
}

export function createAuthorityLegacySourceRecordVersionKeyV1(
  value: unknown,
): string {
  const version = validateAuthorityLegacySourceRecordVersionV1(value);
  return version.provenance === 'EXPLICIT_NUMERIC_VERSION'
    ? `explicit-numeric:v1:${version.explicitVersion}`
    : `content-fingerprint:v1:${version.contentFingerprint}`;
}

export function validateAuthorityLegacyTenantSourceDescriptorV1(
  value: unknown,
): AuthorityLegacyTenantSourceDescriptorV1 {
  const record = getClosedRecord(
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
    'INVALID_LEGACY_SOURCE_DESCRIPTOR',
  );
  const expectedSourceRecordVersion = hasDefined(
    record,
    'expectedSourceRecordVersion',
  )
    ? validateAuthorityLegacySourceRecordVersionV1(
        record.expectedSourceRecordVersion,
      )
    : undefined;
  const expectedSourceFingerprint = hasDefined(
    record,
    'expectedSourceFingerprint',
  )
    ? requireFingerprint(
        record.expectedSourceFingerprint,
        'INVALID_LEGACY_SOURCE_DESCRIPTOR',
      )
    : undefined;
  if (
    expectedSourceRecordVersion?.provenance ===
      'CONTENT_FINGERPRINT_ONLY' &&
    expectedSourceFingerprint !== undefined &&
    expectedSourceRecordVersion.contentFingerprint !==
      expectedSourceFingerprint
  ) {
    return failAuthorityPersistenceContract(
      'INVALID_LEGACY_SOURCE_DESCRIPTOR',
    );
  }
  return Object.freeze({
    schemaVersion: requireExactLiteral(
      record.schemaVersion,
      AUTHORITY_LEGACY_TENANT_SOURCE_DESCRIPTOR_VERSION,
      'INVALID_LEGACY_SOURCE_DESCRIPTOR',
    ),
    sourceCollection: requireEnumValue(
      record.sourceCollection,
      AUTHORITY_LEGACY_TENANT_SOURCE_COLLECTIONS,
      'INVALID_LEGACY_SOURCE_DESCRIPTOR',
    ),
    sourceDocumentId: requireLegacySourceDocumentId(
      record.sourceDocumentId,
    ),
    sourceLocatorVersion: requireExactLiteral(
      record.sourceLocatorVersion,
      AUTHORITY_LEGACY_TENANT_SOURCE_LOCATOR_VERSION,
      'INVALID_LEGACY_SOURCE_DESCRIPTOR',
    ),
    ...(expectedSourceRecordVersion === undefined
      ? {}
      : { expectedSourceRecordVersion }),
    ...(expectedSourceFingerprint === undefined
      ? {}
      : { expectedSourceFingerprint }),
    authorityUse: requireExactLiteral(
      record.authorityUse,
      'PROHIBITED',
      'INVALID_LEGACY_SOURCE_DESCRIPTOR',
    ),
  });
}

export function createAuthorityLegacyTenantSourceDescriptorV1(
  value: unknown,
): AuthorityLegacyTenantSourceDescriptorV1 {
  return validateAuthorityLegacyTenantSourceDescriptorV1(value);
}

export function createAuthorityLegacyTenantPhysicalLocatorV1(
  descriptorValue: unknown,
): AuthorityLegacyTenantPhysicalLocatorV1 {
  const descriptor =
    validateAuthorityLegacyTenantSourceDescriptorV1(descriptorValue);
  const locatorKey = createCanonicalAuthorityHashV1(
    'authority-legacy-tenant-physical-locator:v1',
    {
      sourceCollection: descriptor.sourceCollection,
      sourceDocumentId: descriptor.sourceDocumentId,
      sourceLocatorVersion: descriptor.sourceLocatorVersion,
    },
    'INVALID_LEGACY_SOURCE_LOCATOR',
  );
  return Object.freeze({
    schemaVersion:
      AUTHORITY_LEGACY_TENANT_PHYSICAL_LOCATOR_VERSION,
    collectionPath: getLegacyTenantSourceCollectionPathV1(
      descriptor.sourceCollection,
    ),
    documentId: descriptor.sourceDocumentId,
    locatorKey,
    sourceCollection: descriptor.sourceCollection,
    sourceLocatorVersion: descriptor.sourceLocatorVersion,
  });
}

export function validateAuthorityLegacyTenantPhysicalLocatorV1(
  value: unknown,
  descriptorValue: unknown,
): AuthorityLegacyTenantPhysicalLocatorV1 {
  const record = getClosedRecord(
    value,
    [
      'schemaVersion',
      'collectionPath',
      'documentId',
      'locatorKey',
      'sourceCollection',
      'sourceLocatorVersion',
    ],
    'INVALID_LEGACY_SOURCE_LOCATOR',
  );
  const descriptor =
    validateAuthorityLegacyTenantSourceDescriptorV1(descriptorValue);
  const expected =
    createAuthorityLegacyTenantPhysicalLocatorV1(descriptor);
  const validated = Object.freeze({
    schemaVersion: requireExactLiteral(
      record.schemaVersion,
      AUTHORITY_LEGACY_TENANT_PHYSICAL_LOCATOR_VERSION,
      'INVALID_LEGACY_SOURCE_LOCATOR',
    ),
    collectionPath: requireExactLiteral(
      record.collectionPath,
      expected.collectionPath,
      'INVALID_LEGACY_SOURCE_LOCATOR',
    ),
    documentId: requireLegacySourceDocumentId(record.documentId),
    locatorKey: requireFingerprint(
      record.locatorKey,
      'INVALID_LEGACY_SOURCE_LOCATOR',
    ),
    sourceCollection: requireEnumValue(
      record.sourceCollection,
      AUTHORITY_LEGACY_TENANT_SOURCE_COLLECTIONS,
      'INVALID_LEGACY_SOURCE_LOCATOR',
    ),
    sourceLocatorVersion: requireExactLiteral(
      record.sourceLocatorVersion,
      AUTHORITY_LEGACY_TENANT_SOURCE_LOCATOR_VERSION,
      'INVALID_LEGACY_SOURCE_LOCATOR',
    ),
  });
  if (
    validated.collectionPath !== expected.collectionPath ||
    validated.documentId !== expected.documentId ||
    validated.locatorKey !== expected.locatorKey ||
    validated.sourceCollection !== expected.sourceCollection ||
    validated.sourceLocatorVersion !== expected.sourceLocatorVersion
  ) {
    return failAuthorityPersistenceContract(
      'LEGACY_SOURCE_LOCATOR_MISMATCH',
    );
  }
  return validated;
}

export function normalizeLegacyTenantTimestampV1(
  value: unknown,
): string {
  if (typeof value === 'string') {
    const match =
      /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})\.(\d{3}|\d{9})Z$/.exec(
        value,
      );
    if (match === null) {
      return failAuthorityPersistenceContract(
        'INVALID_LEGACY_TIMESTAMP',
      );
    }
    const prefix = match[1];
    const fraction = match[2];
    if (prefix === undefined || fraction === undefined) {
      return failAuthorityPersistenceContract(
        'INVALID_LEGACY_TIMESTAMP',
      );
    }
    const millisecondIso = `${prefix}.${fraction.slice(0, 3)}Z`;
    const milliseconds = Date.parse(millisecondIso);
    if (
      !Number.isFinite(milliseconds) ||
      new Date(milliseconds).toISOString() !== millisecondIso
    ) {
      return failAuthorityPersistenceContract(
        'INVALID_LEGACY_TIMESTAMP',
      );
    }
    return `${prefix}.${fraction.padEnd(9, '0')}Z`;
  }
  const record = getClosedRecord(
    value,
    ['seconds', 'nanoseconds'],
    'INVALID_LEGACY_TIMESTAMP',
  );
  if (
    typeof record.seconds !== 'number' ||
    !Number.isSafeInteger(record.seconds) ||
    record.seconds < MINIMUM_TIMESTAMP_SECONDS ||
    record.seconds > MAXIMUM_TIMESTAMP_SECONDS ||
    typeof record.nanoseconds !== 'number' ||
    !Number.isSafeInteger(record.nanoseconds) ||
    record.nanoseconds < 0 ||
    record.nanoseconds > 999_999_999
  ) {
    return failAuthorityPersistenceContract(
      'INVALID_LEGACY_TIMESTAMP',
    );
  }
  const secondIso = new Date(record.seconds * 1_000).toISOString();
  const prefix = secondIso.slice(0, 19);
  return `${prefix}.${String(record.nanoseconds).padStart(9, '0')}Z`;
}

export function validateAuthorityLegacyTenantRawRecordV1(
  value: unknown,
): AuthorityLegacyTenantRawRecordV1 {
  const record = getClosedRecord(
    value,
    RAW_RECORD_KEYS,
    'INVALID_LEGACY_RAW_RECORD',
  );
  const tenantId = optionalValue(
    record,
    'tenantId',
    requireLegacyIdentifier,
  );
  const tenantSlug = optionalValue(
    record,
    'tenantSlug',
    requireLegacyIdentifier,
  );
  const status = optionalValue(
    record,
    'status',
    requireLegacyStatusToken,
  );
  const tenantStatus = optionalValue(
    record,
    'tenantStatus',
    requireLegacyStatusToken,
  );
  const companyId = optionalValue(
    record,
    'companyId',
    requireLegacyIdentifier,
  );
  const companyName = optionalValue(
    record,
    'companyName',
    requireLegacyText,
  );
  const tenantName = optionalValue(
    record,
    'tenantName',
    requireLegacyText,
  );
  const tradeName = optionalValue(
    record,
    'tradeName',
    requireLegacyText,
  );
  const clientId = optionalValue(
    record,
    'clientId',
    requireLegacyIdentifier,
  );
  const organizationId = optionalValue(
    record,
    'organizationId',
    requireLegacyIdentifier,
  );
  const quoteId = optionalValue(
    record,
    'quoteId',
    requireLegacyIdentifier,
  );
  const licenseStatus = optionalValue(
    record,
    'licenseStatus',
    requireLegacyStatusToken,
  );
  const hcmTenantStatus = optionalValue(
    record,
    'hcmTenantStatus',
    requireLegacyStatusToken,
  );
  const maintenanceTenantStatus = optionalValue(
    record,
    'maintenanceTenantStatus',
    requireLegacyStatusToken,
  );
  const selectedModules = optionalValue(
    record,
    'selectedModules',
    requireLegacyModuleArray,
  );
  const enabledModules = optionalValue(
    record,
    'enabledModules',
    requireLegacyModuleArray,
  );
  const allowedDomains = optionalValue(
    record,
    'allowedDomains',
    requireLegacyDomainArray,
  );
  const subdomain = hasDefined(record, 'subdomain')
    ? requireLegacySubdomain(record.subdomain)
    : undefined;
  const customDomain = hasDefined(record, 'customDomain')
    ? record.customDomain === null
      ? null
      : requireLegacyDomain(record.customDomain)
    : undefined;
  const suspendedReason = optionalValue(
    record,
    'suspendedReason',
    requireLegacyText,
  );
  const usage = optionalValue(record, 'usage', validateLegacyUsage);
  const createdAt = optionalValue(
    record,
    'createdAt',
    validateLegacyTimestampShape,
  );
  const updatedAt = optionalValue(
    record,
    'updatedAt',
    validateLegacyTimestampShape,
  );
  const schemaVersion = optionalValue(
    record,
    'schemaVersion',
    requireLegacySchemaVersion,
  );
  const recordVersion = optionalValue(
    record,
    'recordVersion',
    (entry) =>
      requirePositiveInteger(entry, 'INVALID_LEGACY_RAW_RECORD'),
  );
  return Object.freeze({
    ...(tenantId === undefined ? {} : { tenantId }),
    ...(tenantSlug === undefined ? {} : { tenantSlug }),
    ...(status === undefined ? {} : { status }),
    ...(tenantStatus === undefined ? {} : { tenantStatus }),
    ...(companyId === undefined ? {} : { companyId }),
    ...(companyName === undefined ? {} : { companyName }),
    ...(tenantName === undefined ? {} : { tenantName }),
    ...(tradeName === undefined ? {} : { tradeName }),
    ...(clientId === undefined ? {} : { clientId }),
    ...(organizationId === undefined ? {} : { organizationId }),
    ...(quoteId === undefined ? {} : { quoteId }),
    ...(licenseStatus === undefined ? {} : { licenseStatus }),
    ...(hcmTenantStatus === undefined ? {} : { hcmTenantStatus }),
    ...(maintenanceTenantStatus === undefined
      ? {}
      : { maintenanceTenantStatus }),
    ...(selectedModules === undefined ? {} : { selectedModules }),
    ...(enabledModules === undefined ? {} : { enabledModules }),
    ...(allowedDomains === undefined ? {} : { allowedDomains }),
    ...(subdomain === undefined ? {} : { subdomain }),
    ...(customDomain === undefined ? {} : { customDomain }),
    ...(suspendedReason === undefined ? {} : { suspendedReason }),
    ...(usage === undefined ? {} : { usage }),
    ...(createdAt === undefined ? {} : { createdAt }),
    ...(updatedAt === undefined ? {} : { updatedAt }),
    ...(schemaVersion === undefined ? {} : { schemaVersion }),
    ...(recordVersion === undefined ? {} : { recordVersion }),
  });
}

export function normalizeAuthorityLegacyTenantRawRecordV1(
  value: unknown,
): AuthorityLegacyTenantNormalizedRawRecordV1 {
  const raw = validateAuthorityLegacyTenantRawRecordV1(value);
  const { createdAt, updatedAt, ...withoutTimestamps } = raw;
  return Object.freeze({
    ...withoutTimestamps,
    ...(createdAt === undefined
      ? {}
      : {
          createdAt: normalizeLegacyTenantTimestampV1(createdAt),
        }),
    ...(updatedAt === undefined
      ? {}
      : {
          updatedAt: normalizeLegacyTenantTimestampV1(updatedAt),
        }),
  });
}

export function normalizeLegacyTenantStatusV1(
  value: unknown,
): TenantAuthorityStatus | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  switch (value) {
    case 'PENDING':
    case 'pending':
    case 'READY':
    case 'ready':
    case 'PENDING_ACTIVATION':
    case 'pending_activation':
      return 'PENDING';
    case 'ACTIVE':
    case 'active':
      return 'ACTIVE';
    case 'GRACE_PERIOD':
    case 'grace_period':
    case 'SUSPENDED':
    case 'suspended':
      return 'SUSPENDED';
    case 'DEACTIVATED':
    case 'deactivated':
    case 'CANCELLED':
    case 'cancelled':
      return 'DEACTIVATED';
    case 'DELETED':
    case 'deleted':
      return 'DELETED';
    default:
      return undefined;
  }
}

function normalizeAliasReference(value: string): string | undefined {
  const normalized = value.toLowerCase();
  return normalized.length >= 3 &&
    normalized.length <= 256 &&
    /^[a-z0-9][a-z0-9_.:-]*$/.test(normalized) &&
    !normalized.includes('..')
    ? normalized
    : undefined;
}

function normalizeAliasSlug(value: string): string | undefined {
  const normalized = value.toLowerCase();
  return normalized.length >= 3 &&
    normalized.length <= 128 &&
    /^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(normalized)
    ? normalized
    : undefined;
}

function createAliasCandidate(
  aliasType: TenantAliasType,
  normalizedAlias: string,
  sourceField: AuthorityLegacyTenantAliasSourceFieldV1,
  confidence: AuthorityLegacyTenantAliasConfidenceV1,
  disposition: AuthorityLegacyTenantAliasDispositionV1,
): AuthorityLegacyTenantAliasCandidateV1 {
  return Object.freeze({
    aliasType,
    normalizedAlias,
    sourceField,
    confidence,
    disposition,
  });
}

export function validateAuthorityLegacyTenantAliasCandidateV1(
  value: unknown,
): AuthorityLegacyTenantAliasCandidateV1 {
  const record = getClosedRecord(
    value,
    [
      'aliasType',
      'normalizedAlias',
      'sourceField',
      'confidence',
      'disposition',
    ],
    'INVALID_LEGACY_ALIAS_CANDIDATE',
  );
  const aliasType = requireEnumValue(
    record.aliasType,
    AUTHORITY_LEGACY_TENANT_ALIAS_TYPES,
    'INVALID_LEGACY_ALIAS_CANDIDATE',
  );
  const normalizedAlias =
    aliasType === 'TENANT_SLUG'
      ? normalizeAliasSlug(
          typeof record.normalizedAlias === 'string'
            ? record.normalizedAlias
            : '',
        )
      : normalizeAliasReference(
          typeof record.normalizedAlias === 'string'
            ? record.normalizedAlias
            : '',
        );
  if (
    normalizedAlias === undefined ||
    normalizedAlias !== record.normalizedAlias
  ) {
    return failAuthorityPersistenceContract(
      'INVALID_LEGACY_ALIAS_CANDIDATE',
    );
  }
  const confidence = requireEnumValue(
    record.confidence,
    AUTHORITY_LEGACY_TENANT_ALIAS_CONFIDENCES,
    'INVALID_LEGACY_ALIAS_CANDIDATE',
  );
  const disposition = requireEnumValue(
    record.disposition,
    AUTHORITY_LEGACY_TENANT_ALIAS_DISPOSITIONS,
    'INVALID_LEGACY_ALIAS_CANDIDATE',
  );
  if (
    (confidence === 'AMBIGUOUS' && disposition !== 'REVIEW') ||
    (confidence !== 'AMBIGUOUS' && disposition === 'REVIEW')
  ) {
    return failAuthorityPersistenceContract(
      'INVALID_LEGACY_ALIAS_CANDIDATE',
    );
  }
  return Object.freeze({
    aliasType,
    normalizedAlias,
    sourceField: requireEnumValue(
      record.sourceField,
      AUTHORITY_LEGACY_TENANT_ALIAS_SOURCE_FIELDS,
      'INVALID_LEGACY_ALIAS_CANDIDATE',
    ),
    confidence,
    disposition,
  });
}

function compareAliasCandidates(
  left: AuthorityLegacyTenantAliasCandidateV1,
  right: AuthorityLegacyTenantAliasCandidateV1,
): number {
  const confidenceRank = (
    confidence: AuthorityLegacyTenantAliasConfidenceV1,
  ): number =>
    confidence === 'EXACT' ? 0 : confidence === 'DERIVED' ? 1 : 2;
  const leftKey =
    `${left.aliasType}:${left.normalizedAlias}:` +
    `${confidenceRank(left.confidence)}:${left.sourceField}`;
  const rightKey =
    `${right.aliasType}:${right.normalizedAlias}:` +
    `${confidenceRank(right.confidence)}:${right.sourceField}`;
  return leftKey.localeCompare(rightKey);
}

function buildAliasCandidates(
  raw: AuthorityLegacyTenantNormalizedRawRecordV1,
  sourceDocumentId: string,
): readonly AuthorityLegacyTenantAliasCandidateV1[] {
  const tenantSlugAlias =
    raw.tenantSlug === undefined
      ? []
      : (() => {
          const normalized = normalizeAliasSlug(raw.tenantSlug);
          return normalized === undefined
            ? []
            : [
                createAliasCandidate(
                  'TENANT_SLUG',
                  normalized,
                  'TENANT_SLUG',
                  normalized === raw.tenantSlug ? 'EXACT' : 'DERIVED',
                  'RESERVE',
                ),
              ];
        })();
  const legacyTenantIdAlias =
    raw.tenantId === undefined
      ? []
      : (() => {
          const normalized = normalizeAliasReference(raw.tenantId);
          return normalized === undefined
            ? []
            : [
                createAliasCandidate(
                  'LEGACY_TENANT_ID',
                  normalized,
                  'TENANT_ID',
                  normalized === raw.tenantId ? 'EXACT' : 'DERIVED',
                  'RESERVE',
                ),
              ];
        })();
  const tenantIdSlugAlias =
    raw.tenantId === undefined ||
    raw.tenantId === sourceDocumentId
      ? []
      : (() => {
          const normalized = normalizeAliasSlug(raw.tenantId);
          return normalized === undefined
            ? []
            : [
                createAliasCandidate(
                  'TENANT_SLUG',
                  normalized,
                  'TENANT_ID',
                  'DERIVED',
                  'RESERVE',
                ),
              ];
        })();
  const clientAlias =
    raw.clientId === undefined
      ? []
      : (() => {
          const normalized = normalizeAliasReference(raw.clientId);
          return normalized === undefined
            ? []
            : [
                createAliasCandidate(
                  'CLIENT_REFERENCE',
                  normalized,
                  'CLIENT_ID',
                  normalized === raw.clientId ? 'EXACT' : 'DERIVED',
                  'RESERVE',
                ),
              ];
        })();
  const organizationAlias =
    raw.organizationId === undefined
      ? []
      : (() => {
          const normalized = normalizeAliasReference(
            raw.organizationId,
          );
          return normalized === undefined
            ? []
            : [
                createAliasCandidate(
                  'ORGANIZATION_REFERENCE',
                  normalized,
                  'ORGANIZATION_ID',
                  normalized === raw.organizationId
                    ? 'EXACT'
                    : 'DERIVED',
                  'RESERVE',
                ),
              ];
        })();
  const candidates = [
    ...tenantSlugAlias,
    ...legacyTenantIdAlias,
    ...tenantIdSlugAlias,
    ...clientAlias,
    ...organizationAlias,
  ].sort(compareAliasCandidates);
  const collapsed = candidates.filter(
    (candidate, index) =>
      index === 0 ||
      candidates[index - 1]?.aliasType !== candidate.aliasType ||
      candidates[index - 1]?.normalizedAlias !==
        candidate.normalizedAlias,
  );
  const distinctSlugs = new Set(
    collapsed
      .filter((candidate) => candidate.aliasType === 'TENANT_SLUG')
      .map((candidate) => candidate.normalizedAlias),
  );
  const resolved =
    distinctSlugs.size <= 1
      ? collapsed
      : collapsed.map((candidate) =>
          candidate.aliasType === 'TENANT_SLUG'
            ? createAliasCandidate(
                candidate.aliasType,
                candidate.normalizedAlias,
                candidate.sourceField,
                'AMBIGUOUS',
                'REVIEW',
              )
            : candidate,
        );
  return freezeArray([...resolved].sort(compareAliasCandidates));
}

function statusesConflict(
  raw: AuthorityLegacyTenantNormalizedRawRecordV1,
): boolean {
  if (raw.status === undefined || raw.tenantStatus === undefined) {
    return false;
  }
  const status = normalizeLegacyTenantStatusV1(raw.status);
  const tenantStatus = normalizeLegacyTenantStatusV1(
    raw.tenantStatus,
  );
  return status === undefined || tenantStatus === undefined
    ? raw.status.toLowerCase() !== raw.tenantStatus.toLowerCase()
    : status !== tenantStatus;
}

function classifyVariant(
  descriptor: AuthorityLegacyTenantSourceDescriptorV1,
  raw: AuthorityLegacyTenantNormalizedRawRecordV1,
): LegacyTenantVariantV1 {
  if (statusesConflict(raw)) {
    return 'CONFLICTING_STATUS_FIELDS';
  }
  if (
    raw.tenantId !== undefined &&
    raw.tenantId !== descriptor.sourceDocumentId &&
    normalizeAliasSlug(raw.tenantId) !== undefined
  ) {
    return 'AUTO_ID_WITH_TENANT_ID_SLUG';
  }
  if (
    raw.tenantId === undefined &&
    raw.tenantSlug !== undefined &&
    /^[A-Za-z0-9]{20}$/.test(descriptor.sourceDocumentId)
  ) {
    return 'AUTO_ID_WITH_TENANT_SLUG';
  }
  if (
    raw.tenantId !== undefined &&
    raw.tenantId === descriptor.sourceDocumentId
  ) {
    return 'DOCUMENT_ID_EQUALS_TENANT_ID';
  }
  if (raw.tenantId !== undefined && raw.tenantSlug === undefined) {
    return 'MISSING_SLUG';
  }
  if (raw.status !== undefined && raw.tenantStatus === undefined) {
    return 'STATUS_FIELD_ONLY';
  }
  if (raw.status === undefined && raw.tenantStatus !== undefined) {
    return 'TENANT_STATUS_FIELD_ONLY';
  }
  return failAuthorityPersistenceContract(
    'UNSUPPORTED_LEGACY_SOURCE_SHAPE',
  );
}

export function classifyLegacyTenantVariantV1(
  descriptorValue: unknown,
  rawValue: unknown,
): LegacyTenantVariantV1 {
  return classifyVariant(
    validateAuthorityLegacyTenantSourceDescriptorV1(descriptorValue),
    normalizeAuthorityLegacyTenantRawRecordV1(rawValue),
  );
}

function normalizedObservedStatus(
  raw: AuthorityLegacyTenantNormalizedRawRecordV1,
): TenantAuthorityStatus | undefined {
  if (statusesConflict(raw)) {
    return undefined;
  }
  const fromStatus = normalizeLegacyTenantStatusV1(raw.status);
  const fromTenantStatus = normalizeLegacyTenantStatusV1(
    raw.tenantStatus,
  );
  return fromStatus ?? fromTenantStatus;
}

function buildWarnings(
  descriptor: AuthorityLegacyTenantSourceDescriptorV1,
  raw: AuthorityLegacyTenantNormalizedRawRecordV1,
  aliases: readonly AuthorityLegacyTenantAliasCandidateV1[],
): readonly AuthorityLegacyTenantCanonicalizationWarningV1[] {
  const invalidAlias =
    (raw.tenantSlug !== undefined &&
      normalizeAliasSlug(raw.tenantSlug) === undefined) ||
    (raw.tenantId !== undefined &&
      normalizeAliasReference(raw.tenantId) === undefined) ||
    (raw.clientId !== undefined &&
      normalizeAliasReference(raw.clientId) === undefined) ||
    (raw.organizationId !== undefined &&
      normalizeAliasReference(raw.organizationId) === undefined);
  const unknownStatus =
    (raw.status !== undefined &&
      normalizeLegacyTenantStatusV1(raw.status) === undefined) ||
    (raw.tenantStatus !== undefined &&
      normalizeLegacyTenantStatusV1(raw.tenantStatus) === undefined);
  const warnings: AuthorityLegacyTenantCanonicalizationWarningV1[] = [
    ...(aliases.some((candidate) => candidate.disposition === 'REVIEW')
      ? (['AMBIGUOUS_ALIAS'] as const)
      : []),
    ...(raw.companyName === undefined
      ? []
      : (['COMPANY_NAME_IGNORED'] as const)),
    ...(invalidAlias ? (['INVALID_ALIAS'] as const) : []),
    ...(raw.tenantSlug === undefined
      ? (['MISSING_SLUG'] as const)
      : []),
    ...(raw.status === undefined && raw.tenantStatus === undefined
      ? (['MISSING_STATUS'] as const)
      : []),
    ...(raw.tenantId !== descriptor.sourceDocumentId
      ? (['SOURCE_DOCUMENT_ID_NOT_CANONICAL_ID'] as const)
      : []),
    ...(statusesConflict(raw)
      ? (['STATUS_CONFLICT'] as const)
      : []),
    ...(unknownStatus ? (['UNKNOWN_STATUS'] as const) : []),
  ];
  return freezeArray(
    [...new Set(warnings)].sort(),
  );
}

function classificationDisposition(
  variant: LegacyTenantVariantV1,
  raw: AuthorityLegacyTenantNormalizedRawRecordV1,
  normalizedStatus: TenantAuthorityStatus | undefined,
  warnings: readonly AuthorityLegacyTenantCanonicalizationWarningV1[],
): LegacyTenantCanonicalizationClassificationV1 {
  if (warnings.includes('UNKNOWN_STATUS')) {
    return 'REJECTED';
  }
  if (
    variant === 'CONFLICTING_STATUS_FIELDS' ||
    normalizedStatus === undefined ||
    warnings.includes('AMBIGUOUS_ALIAS') ||
    warnings.includes('INVALID_ALIAS') ||
    variant === 'STATUS_FIELD_ONLY' ||
    variant === 'TENANT_STATUS_FIELD_ONLY'
  ) {
    return 'REQUIRES_REVIEW';
  }
  if (variant === 'MISSING_SLUG') {
    try {
      requireCanonicalDocumentId(
        raw.tenantId,
        'INVALID_LEGACY_SOURCE_RECORD',
      );
    } catch {
      return 'REQUIRES_REVIEW';
    }
  }
  return 'CANONICALIZABLE';
}

export function createAuthorityLegacyTenantSourceFingerprintV1(
  descriptorValue: unknown,
  normalizedRawRecordValue: unknown,
): string {
  const descriptor =
    validateAuthorityLegacyTenantSourceDescriptorV1(descriptorValue);
  const normalizedRawRecord =
    normalizeAuthorityLegacyTenantRawRecordV1(normalizedRawRecordValue);
  return createCanonicalAuthorityHashV1(
    'authority-legacy-tenant-source-fingerprint:v1',
    {
      descriptor: {
        schemaVersion: descriptor.schemaVersion,
        sourceCollection: descriptor.sourceCollection,
        sourceDocumentId: descriptor.sourceDocumentId,
        sourceLocatorVersion: descriptor.sourceLocatorVersion,
        authorityUse: descriptor.authorityUse,
      },
      normalizedRawRecord,
    },
    'INVALID_LEGACY_SOURCE_RECORD',
  );
}

function deriveSourceRecordVersion(
  raw: AuthorityLegacyTenantNormalizedRawRecordV1,
  fingerprint: string,
): AuthorityLegacySourceRecordVersionV1 {
  return raw.recordVersion === undefined
    ? Object.freeze({
        schemaVersion:
          AUTHORITY_LEGACY_SOURCE_RECORD_VERSION_SCHEMA,
        provenance: 'CONTENT_FINGERPRINT_ONLY' as const,
        contentFingerprint: fingerprint,
      })
    : Object.freeze({
        schemaVersion:
          AUTHORITY_LEGACY_SOURCE_RECORD_VERSION_SCHEMA,
        provenance: 'EXPLICIT_NUMERIC_VERSION' as const,
        explicitVersion: raw.recordVersion,
      });
}

function sourceVersionsEqual(
  left: AuthorityLegacySourceRecordVersionV1,
  right: AuthorityLegacySourceRecordVersionV1,
): boolean {
  return (
    createAuthorityLegacySourceRecordVersionKeyV1(left) ===
    createAuthorityLegacySourceRecordVersionKeyV1(right)
  );
}

function buildDecodedSourceRecord(
  descriptor: AuthorityLegacyTenantSourceDescriptorV1,
  raw: AuthorityLegacyTenantNormalizedRawRecordV1,
  decodedAt: string,
): AuthorityLegacyTenantSourceRecordV1 {
  const sourceLocator =
    createAuthorityLegacyTenantPhysicalLocatorV1(descriptor);
  const sourceRecordFingerprint =
    createAuthorityLegacyTenantSourceFingerprintV1(descriptor, raw);
  const sourceRecordVersion = deriveSourceRecordVersion(
    raw,
    sourceRecordFingerprint,
  );
  if (
    descriptor.expectedSourceFingerprint !== undefined &&
    descriptor.expectedSourceFingerprint !== sourceRecordFingerprint
  ) {
    return failAuthorityPersistenceContract(
      'LEGACY_SOURCE_FINGERPRINT_MISMATCH',
    );
  }
  if (
    descriptor.expectedSourceRecordVersion !== undefined &&
    !sourceVersionsEqual(
      descriptor.expectedSourceRecordVersion,
      sourceRecordVersion,
    )
  ) {
    return failAuthorityPersistenceContract(
      'LEGACY_SOURCE_VERSION_MISMATCH',
    );
  }
  const classifiedVariant = classifyVariant(descriptor, raw);
  const normalizedStatus = normalizedObservedStatus(raw);
  const aliasCandidates = buildAliasCandidates(
    raw,
    descriptor.sourceDocumentId,
  );
  const canonicalizationWarnings = buildWarnings(
    descriptor,
    raw,
    aliasCandidates,
  );
  const disposition = classificationDisposition(
    classifiedVariant,
    raw,
    normalizedStatus,
    canonicalizationWarnings,
  );
  return Object.freeze({
    schemaVersion: AUTHORITY_LEGACY_SOURCE_RECORD_VERSION,
    sourceDescriptor: descriptor,
    sourceLocator,
    sourceRecordVersion,
    sourceRecordFingerprint,
    classifiedVariant,
    classificationDisposition: disposition,
    sourceDocumentId: descriptor.sourceDocumentId,
    ...(raw.tenantId === undefined
      ? {}
      : { observedTenantId: raw.tenantId }),
    ...(raw.tenantSlug === undefined
      ? {}
      : { observedTenantSlug: raw.tenantSlug }),
    ...(raw.status === undefined
      ? {}
      : { observedStatus: raw.status }),
    ...(raw.tenantStatus === undefined
      ? {}
      : { observedTenantStatus: raw.tenantStatus }),
    ...(normalizedStatus === undefined ? {} : { normalizedStatus }),
    aliasCandidates,
    canonicalizationWarnings,
    normalizedRawRecord: raw,
    decodedAt,
    authorityUse: 'PROHIBITED',
  });
}

export function decodeAuthorityLegacyTenantSourceRecordV1(
  descriptorValue: unknown,
  rawUnknown: unknown,
  decodedAtValue: unknown,
): AuthorityLegacyTenantSourceRecordV1 {
  const descriptor =
    validateAuthorityLegacyTenantSourceDescriptorV1(descriptorValue);
  const raw = normalizeAuthorityLegacyTenantRawRecordV1(rawUnknown);
  const decodedAt = requireCanonicalTimestamp(
    decodedAtValue,
    'INVALID_LEGACY_SOURCE_RECORD',
  );
  return buildDecodedSourceRecord(descriptor, raw, decodedAt);
}

export function validateAuthorityLegacyTenantSourceRecordV1(
  value: unknown,
  documentId?: unknown,
): AuthorityLegacyTenantSourceRecordV1 {
  const record = getClosedRecord(
    value,
    SOURCE_RECORD_KEYS,
    'INVALID_LEGACY_SOURCE_RECORD',
  );
  requireExactLiteral(
    record.schemaVersion,
    AUTHORITY_LEGACY_SOURCE_RECORD_VERSION,
    'INVALID_LEGACY_SOURCE_RECORD',
  );
  requireEnumValue(
    record.classifiedVariant,
    LEGACY_TENANT_VARIANTS,
    'INVALID_LEGACY_SOURCE_RECORD',
  );
  requireEnumValue(
    record.classificationDisposition,
    LEGACY_TENANT_CANONICALIZATION_CLASSIFICATIONS,
    'INVALID_LEGACY_SOURCE_RECORD',
  );
  requireExactLiteral(
    record.authorityUse,
    'PROHIBITED',
    'INVALID_LEGACY_SOURCE_RECORD',
  );
  const descriptor =
    validateAuthorityLegacyTenantSourceDescriptorV1(
      record.sourceDescriptor,
    );
  validateAuthorityLegacyTenantPhysicalLocatorV1(
    record.sourceLocator,
    descriptor,
  );
  validateAuthorityLegacySourceRecordVersionV1(
    record.sourceRecordVersion,
  );
  requireFingerprint(
    record.sourceRecordFingerprint,
    'INVALID_LEGACY_SOURCE_RECORD',
  );
  if (!Array.isArray(record.aliasCandidates)) {
    return failAuthorityPersistenceContract(
      'INVALID_LEGACY_SOURCE_RECORD',
    );
  }
  record.aliasCandidates.forEach(
    validateAuthorityLegacyTenantAliasCandidateV1,
  );
  if (!Array.isArray(record.canonicalizationWarnings)) {
    return failAuthorityPersistenceContract(
      'INVALID_LEGACY_SOURCE_RECORD',
    );
  }
  record.canonicalizationWarnings.forEach((warning) =>
    requireEnumValue(
      warning,
      AUTHORITY_LEGACY_TENANT_CANONICALIZATION_WARNINGS,
      'INVALID_LEGACY_SOURCE_RECORD',
    ),
  );
  const raw = normalizeAuthorityLegacyTenantRawRecordV1(
    record.normalizedRawRecord,
  );
  const decodedAt = requireCanonicalTimestamp(
    record.decodedAt,
    'INVALID_LEGACY_SOURCE_RECORD',
  );
  const reconstructed = buildDecodedSourceRecord(
    descriptor,
    raw,
    decodedAt,
  );
  const suppliedHash = createCanonicalAuthorityHashV1(
    'authority-legacy-tenant-source-record-validation:v1',
    record,
    'INVALID_LEGACY_SOURCE_RECORD',
  );
  const reconstructedHash = createCanonicalAuthorityHashV1(
    'authority-legacy-tenant-source-record-validation:v1',
    reconstructed,
    'INVALID_LEGACY_SOURCE_RECORD',
  );
  if (
    suppliedHash !== reconstructedHash ||
    (documentId !== undefined &&
      documentId !== reconstructed.sourceLocator.locatorKey)
  ) {
    return failAuthorityPersistenceContract(
      'LEGACY_SOURCE_RECORD_MISMATCH',
    );
  }
  return reconstructed;
}

export function validateAuthorityRepositoryReadRegistryEntryV1(
  value: unknown,
): AuthorityRepositoryReadRegistryEntryV1 {
  const record = getClosedRecord(
    value,
    [
      'schemaVersion',
      'collection',
      'documentId',
      'locatorKey',
      'readStatus',
      'recordFingerprint',
      'recordVersion',
      'authorityUse',
    ],
    'INVALID_LEGACY_READ_REGISTRY',
  );
  const collection = requireEnumValue(
    record.collection,
    AUTHORITY_LEGACY_TENANT_SOURCE_COLLECTIONS,
    'INVALID_LEGACY_READ_REGISTRY',
  );
  const documentId = requireLegacySourceDocumentId(record.documentId);
  const expectedLocator =
    createAuthorityLegacyTenantPhysicalLocatorV1({
      schemaVersion:
        AUTHORITY_LEGACY_TENANT_SOURCE_DESCRIPTOR_VERSION,
      sourceCollection: collection,
      sourceDocumentId: documentId,
      sourceLocatorVersion:
        AUTHORITY_LEGACY_TENANT_SOURCE_LOCATOR_VERSION,
      authorityUse: 'PROHIBITED',
    });
  const locatorKey = requireFingerprint(
    record.locatorKey,
    'INVALID_LEGACY_READ_REGISTRY',
  );
  if (locatorKey !== expectedLocator.locatorKey) {
    return failAuthorityPersistenceContract(
      'INVALID_LEGACY_READ_REGISTRY',
    );
  }
  const schemaVersion = requireExactLiteral(
    record.schemaVersion,
    AUTHORITY_REPOSITORY_READ_REGISTRY_ENTRY_VERSION,
    'INVALID_LEGACY_READ_REGISTRY',
  );
  const readStatus = requireEnumValue(
    record.readStatus,
    AUTHORITY_REPOSITORY_READ_STATUSES,
    'INVALID_LEGACY_READ_REGISTRY',
  );
  const authorityUse = requireExactLiteral(
    record.authorityUse,
    'PROHIBITED',
    'INVALID_LEGACY_READ_REGISTRY',
  );
  if (readStatus === 'ABSENT') {
    if (
      hasDefined(record, 'recordFingerprint') ||
      hasDefined(record, 'recordVersion')
    ) {
      return failAuthorityPersistenceContract(
        'INVALID_LEGACY_READ_REGISTRY',
      );
    }
    return Object.freeze({
      schemaVersion,
      collection,
      documentId,
      locatorKey,
      readStatus,
      authorityUse,
    });
  }
  if (
    !hasDefined(record, 'recordFingerprint') ||
    !hasDefined(record, 'recordVersion')
  ) {
    return failAuthorityPersistenceContract(
      'INVALID_LEGACY_READ_REGISTRY',
    );
  }
  return Object.freeze({
    schemaVersion,
    collection,
    documentId,
    locatorKey,
    readStatus,
    recordFingerprint: requireFingerprint(
      record.recordFingerprint,
      'INVALID_LEGACY_READ_REGISTRY',
    ),
    recordVersion: validateAuthorityLegacySourceRecordVersionV1(
      record.recordVersion,
    ),
    authorityUse,
  });
}

export function createAuthorityRepositoryReadRegistryEntryV1(
  value: unknown,
): AuthorityRepositoryReadRegistryEntryV1 {
  return validateAuthorityRepositoryReadRegistryEntryV1(value);
}

export function validateAuthorityRepositoryReadRegistryV1(
  value: unknown,
): readonly AuthorityRepositoryReadRegistryEntryV1[] {
  if (!Array.isArray(value)) {
    return failAuthorityPersistenceContract(
      'INVALID_LEGACY_READ_REGISTRY',
    );
  }
  const entries = value
    .map(validateAuthorityRepositoryReadRegistryEntryV1)
    .sort((left, right) =>
      left.locatorKey.localeCompare(right.locatorKey),
    );
  if (
    entries.some(
      (entry, index) =>
        index > 0 &&
        entries[index - 1]?.locatorKey === entry.locatorKey,
    )
  ) {
    return failAuthorityPersistenceContract(
      'INVALID_LEGACY_READ_REGISTRY',
    );
  }
  return freezeArray(entries);
}
