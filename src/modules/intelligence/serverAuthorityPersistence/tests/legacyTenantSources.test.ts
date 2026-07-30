import { describe, expect, it } from 'vitest';

import { AuthorityPersistenceContractError } from '../errors';
import {
  createAuthorityAdministrativeCommandV1,
  createLegacyTenantCanonicalizationInputV1,
} from '../factories';
import {
  AUTHORITY_LEGACY_SOURCE_RECORD_VERSION_SCHEMA,
  AUTHORITY_LEGACY_TENANT_SOURCE_DESCRIPTOR_VERSION,
  AUTHORITY_LEGACY_TENANT_SOURCE_LOCATOR_VERSION,
  AUTHORITY_REPOSITORY_READ_REGISTRY_ENTRY_VERSION,
  createAuthorityLegacyTenantPhysicalLocatorV1,
  createAuthorityLegacyTenantSourceDescriptorV1,
  createAuthorityLegacyTenantSourceFingerprintV1,
  createAuthorityRepositoryReadRegistryEntryV1,
  decodeAuthorityLegacyTenantSourceRecordV1,
  getLegacyTenantSourceCollectionPathV1,
  normalizeAuthorityLegacyTenantRawRecordV1,
  normalizeLegacyTenantStatusV1,
  normalizeLegacyTenantTimestampV1,
  validateAuthorityLegacyTenantPhysicalLocatorV1,
  validateAuthorityLegacyTenantSourceRecordV1,
  type AuthorityLegacyTenantSourceRecordV1,
} from '../legacyTenantSources';
import {
  AUTHORITY_COMMAND_VERSION,
  AUTHORITY_MIGRATION_METADATA_VERSION,
  AUTHORITY_WRITE_PRECONDITION_VERSION,
  LEGACY_TENANT_CANONICALIZATION_INPUT_VERSION,
} from '../types';

const DECODED_AT = '2026-07-30T10:00:00.000Z';
const LATER_DECODED_AT = '2026-07-30T10:05:00.000Z';
const AUTO_DOCUMENT_ID = 'AbCdEfGhIjKlMnOpQrSt';
const CANONICAL_TENANT_ID = 'tenantCanonical001';

function descriptor(
  overrides: Readonly<Record<string, unknown>> = {},
) {
  return {
    schemaVersion:
      AUTHORITY_LEGACY_TENANT_SOURCE_DESCRIPTOR_VERSION,
    sourceCollection: 'PLATFORM_TENANTS',
    sourceDocumentId: AUTO_DOCUMENT_ID,
    sourceLocatorVersion:
      AUTHORITY_LEGACY_TENANT_SOURCE_LOCATOR_VERSION,
    authorityUse: 'PROHIBITED',
    ...overrides,
  };
}

function decoded(
  rawOverrides: Readonly<Record<string, unknown>> = {},
  descriptorOverrides: Readonly<Record<string, unknown>> = {},
  decodedAt = DECODED_AT,
) {
  return decodeAuthorityLegacyTenantSourceRecordV1(
    descriptor(descriptorOverrides),
    {
      tenantSlug: 'tenant-legacy',
      status: 'ACTIVE',
      clientId: 'client_001',
      organizationId: 'organization_001',
      createdAt: '2026-07-01T10:00:00.000Z',
      ...rawOverrides,
    },
    decodedAt,
  );
}

function migrationMetadata(source: AuthorityLegacyTenantSourceRecordV1) {
  return {
    schemaVersion: AUTHORITY_MIGRATION_METADATA_VERSION,
    authorityUse: 'PROHIBITED',
    migrationVersion: 'legacy-closure-v1',
    sourceSystem: 'legacy_platform',
    sourceLocatorKey: source.sourceLocator.locatorKey,
    sourceRecordVersion: source.sourceRecordVersion,
    sourceRecordFingerprint: source.sourceRecordFingerprint,
    classifiedVariant: source.classifiedVariant,
    migrationStatus: 'VALIDATED',
    validatedAt: DECODED_AT,
  };
}

function canonicalizationInput(
  source: AuthorityLegacyTenantSourceRecordV1 = decoded(),
  overrides: Readonly<Record<string, unknown>> = {},
) {
  const selectedAliasCandidates = source.aliasCandidates.filter(
    (candidate) =>
      candidate.disposition === 'RESERVE' &&
      candidate.confidence !== 'AMBIGUOUS',
  );
  const slugCandidate = selectedAliasCandidates.find(
    (candidate) => candidate.aliasType === 'TENANT_SLUG',
  );
  return {
    schemaVersion: LEGACY_TENANT_CANONICALIZATION_INPUT_VERSION,
    canonicalDocumentId: CANONICAL_TENANT_ID,
    sourceRecord: source,
    canonicalTarget: {
      tenantId: CANONICAL_TENANT_ID,
      status: source.normalizedStatus ?? 'PENDING',
      ...(slugCandidate === undefined
        ? {}
        : { tenantSlug: slugCandidate.normalizedAlias }),
    },
    selectedAliasCandidates,
    migrationMetadata: migrationMetadata(source),
    conflictDisposition:
      source.classificationDisposition === 'CANONICALIZABLE'
        ? 'NONE'
        : source.classificationDisposition === 'REQUIRES_REVIEW'
          ? 'REQUIRE_REVIEW'
          : 'REJECT',
    ...overrides,
  };
}

function canonicalizationCommand(
  source: AuthorityLegacyTenantSourceRecordV1,
) {
  return {
    schemaVersion: AUTHORITY_COMMAND_VERSION,
    operationType: 'CANONICALIZE_LEGACY_TENANT',
    operationId: 'operation:legacy-closure-001',
    idempotencyKey: 'idempotency:legacy-closure-001',
    actor: {
      actorType: 'USER',
      actorId: 'principalLegacyClosure001',
    },
    requestedAt: DECODED_AT,
    precondition: {
      schemaVersion: AUTHORITY_WRITE_PRECONDITION_VERSION,
      type: 'MUST_NOT_EXIST',
    },
    reasonCode: 'LEGACY_TENANT_CANONICALIZATION',
    requestId: 'request:legacy-closure-001',
    correlationId: 'correlation:legacy-closure-001',
    payload: {
      canonicalizationInput: canonicalizationInput(source),
    },
  };
}

describe('legacy tenant source physical closure', () => {
  it('accepts only PLATFORM_TENANTS and returns its fixed path', () => {
    expect(
      getLegacyTenantSourceCollectionPathV1('PLATFORM_TENANTS'),
    ).toBe('platform_tenants');
    expect(() =>
      getLegacyTenantSourceCollectionPathV1('platform_clients'),
    ).toThrow(AuthorityPersistenceContractError);
  });

  it('validates simple document IDs and rejects arbitrary paths', () => {
    expect(
      createAuthorityLegacyTenantSourceDescriptorV1(descriptor())
        .sourceDocumentId,
    ).toBe(AUTO_DOCUMENT_ID);
    for (const sourceDocumentId of [
      '',
      'platform_tenants/tenant-001',
      'tenant/children/child',
      'projects/demo/databases/(default)/documents/tenant',
      '..',
      '\\absolute',
    ]) {
      expect(() =>
        createAuthorityLegacyTenantSourceDescriptorV1(
          descriptor({ sourceDocumentId }),
        ),
      ).toThrow(AuthorityPersistenceContractError);
    }
  });

  it('requires authorityUse PROHIBITED', () => {
    expect(
      createAuthorityLegacyTenantSourceDescriptorV1(descriptor())
        .authorityUse,
    ).toBe('PROHIBITED');
    expect(() =>
      createAuthorityLegacyTenantSourceDescriptorV1(
        descriptor({ authorityUse: 'ALLOWED' }),
      ),
    ).toThrow(AuthorityPersistenceContractError);
  });

  it('creates an exact deterministic physical locator', () => {
    const first =
      createAuthorityLegacyTenantPhysicalLocatorV1(descriptor());
    const second =
      createAuthorityLegacyTenantPhysicalLocatorV1(descriptor());
    expect(first).toEqual(second);
    expect(first).toMatchObject({
      collectionPath: 'platform_tenants',
      documentId: AUTO_DOCUMENT_ID,
      sourceCollection: 'PLATFORM_TENANTS',
    });
    expect(first.locatorKey).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it('rejects a locator that does not match its descriptor', () => {
    const locator =
      createAuthorityLegacyTenantPhysicalLocatorV1(descriptor());
    expect(() =>
      validateAuthorityLegacyTenantPhysicalLocatorV1(
        { ...locator, documentId: 'DifferentDocument001' },
        descriptor(),
      ),
    ).toThrow(AuthorityPersistenceContractError);
  });
});

describe('legacy raw record decoding', () => {
  it('classifies document ID equals tenant ID', () => {
    const result = decoded(
      {
        tenantId: 'tenantDocument001',
        tenantSlug: 'tenant-document',
      },
      { sourceDocumentId: 'tenantDocument001' },
    );
    expect(result.classifiedVariant).toBe(
      'DOCUMENT_ID_EQUALS_TENANT_ID',
    );
    expect(result.classificationDisposition).toBe('CANONICALIZABLE');
  });

  it('classifies an auto ID whose tenantId is a slug', () => {
    const result = decoded({
      tenantId: 'tenant-id-slug',
      tenantSlug: undefined,
    });
    expect(result.classifiedVariant).toBe(
      'AUTO_ID_WITH_TENANT_ID_SLUG',
    );
  });

  it('classifies an auto ID with tenantSlug and no tenantId', () => {
    expect(decoded().classifiedVariant).toBe(
      'AUTO_ID_WITH_TENANT_SLUG',
    );
  });

  it('classifies missing slug after more critical identity variants', () => {
    const result = decoded({
      tenantId: 'tenant_canonical_001',
      tenantSlug: undefined,
    });
    expect(result.classifiedVariant).toBe('MISSING_SLUG');
    expect(result.classificationDisposition).toBe('CANONICALIZABLE');
  });

  it('classifies status-only and tenantStatus-only shapes', () => {
    const statusOnly = decodeAuthorityLegacyTenantSourceRecordV1(
      descriptor(),
      { status: 'ACTIVE' },
      DECODED_AT,
    );
    const tenantStatusOnly =
      decodeAuthorityLegacyTenantSourceRecordV1(
        descriptor(),
        { tenantStatus: 'ACTIVE' },
        DECODED_AT,
      );
    expect(statusOnly.classifiedVariant).toBe('STATUS_FIELD_ONLY');
    expect(tenantStatusOnly.classifiedVariant).toBe(
      'TENANT_STATUS_FIELD_ONLY',
    );
    expect(statusOnly.classificationDisposition).toBe(
      'REQUIRES_REVIEW',
    );
    expect(tenantStatusOnly.classificationDisposition).toBe(
      'REQUIRES_REVIEW',
    );
  });

  it('detects semantically conflicting status fields', () => {
    const result = decoded({
      status: 'ACTIVE',
      tenantStatus: 'SUSPENDED',
    });
    expect(result.classifiedVariant).toBe(
      'CONFLICTING_STATUS_FIELDS',
    );
    expect(result.classificationDisposition).toBe('REQUIRES_REVIEW');
    expect(result.normalizedStatus).toBeUndefined();
  });

  it('rejects an unsupported identity and status shape', () => {
    expect(() =>
      decodeAuthorityLegacyTenantSourceRecordV1(
        descriptor(),
        {
          status: 'ACTIVE',
          tenantStatus: 'active',
        },
        DECODED_AT,
      ),
    ).toThrow(AuthorityPersistenceContractError);
  });

  it('normalizes the closed audited status vocabulary', () => {
    expect(normalizeLegacyTenantStatusV1('ACTIVE')).toBe('ACTIVE');
    expect(normalizeLegacyTenantStatusV1('suspended')).toBe(
      'SUSPENDED',
    );
    expect(normalizeLegacyTenantStatusV1('READY')).toBe('PENDING');
    expect(normalizeLegacyTenantStatusV1('GRACE_PERIOD')).toBe(
      'SUSPENDED',
    );
    expect(normalizeLegacyTenantStatusV1('CANCELLED')).toBe(
      'DEACTIVATED',
    );
    expect(normalizeLegacyTenantStatusV1('UNRECOGNIZED')).toBeUndefined();
  });

  it('never promotes an unknown status to ACTIVE', () => {
    const result = decoded({ status: 'UNRECOGNIZED' });
    expect(result.normalizedStatus).toBeUndefined();
    expect(result.classificationDisposition).toBe('REJECTED');
    expect(result.canonicalizationWarnings).toContain('UNKNOWN_STATUS');
  });

  it('normalizes canonical ISO and neutral timestamp shapes', () => {
    expect(
      normalizeLegacyTenantTimestampV1(
        '2026-07-01T10:00:00.123Z',
      ),
    ).toBe('2026-07-01T10:00:00.123000000Z');
    expect(
      normalizeLegacyTenantTimestampV1({
        seconds: 0,
        nanoseconds: 123_456_789,
      }),
    ).toBe('1970-01-01T00:00:00.123456789Z');
  });

  it('rejects invalid timestamps and class instances', () => {
    expect(() =>
      normalizeLegacyTenantTimestampV1('07/30/2026 10:00'),
    ).toThrow(AuthorityPersistenceContractError);
    expect(() =>
      normalizeLegacyTenantTimestampV1({
        seconds: 0,
        nanoseconds: 1_000_000_000,
      }),
    ).toThrow(AuthorityPersistenceContractError);
    class TimestampLike {
      readonly seconds = 0;
      readonly nanoseconds = 0;
    }
    expect(() =>
      normalizeLegacyTenantTimestampV1(new TimestampLike()),
    ).toThrow(AuthorityPersistenceContractError);
  });

  it('rejects accessors, unknown fields and forbidden document content', () => {
    const accessor = Object.defineProperty({}, 'tenantId', {
      enumerable: true,
      get: () => 'tenant_001',
    });
    expect(() =>
      decodeAuthorityLegacyTenantSourceRecordV1(
        descriptor(),
        accessor,
        DECODED_AT,
      ),
    ).toThrow(AuthorityPersistenceContractError);
    expect(() =>
      decodeAuthorityLegacyTenantSourceRecordV1(
        descriptor(),
        { tenantSlug: 'tenant-legacy', status: 'ACTIVE', roles: [] },
        DECODED_AT,
      ),
    ).toThrow(AuthorityPersistenceContractError);
  });
});

describe('legacy source fingerprints, versions and aliases', () => {
  it('is deterministic and independent of property order', () => {
    const normalizedFirst =
      normalizeAuthorityLegacyTenantRawRecordV1({
        tenantSlug: 'tenant-legacy',
        status: 'ACTIVE',
        clientId: 'client_001',
      });
    const normalizedSecond =
      normalizeAuthorityLegacyTenantRawRecordV1({
        clientId: 'client_001',
        status: 'ACTIVE',
        tenantSlug: 'tenant-legacy',
      });
    expect(
      createAuthorityLegacyTenantSourceFingerprintV1(
        descriptor(),
        normalizedFirst,
      ),
    ).toBe(
      createAuthorityLegacyTenantSourceFingerprintV1(
        descriptor(),
        normalizedSecond,
      ),
    );
  });

  it('changes when a relevant source field changes', () => {
    expect(decoded({ clientId: 'client_001' }).sourceRecordFingerprint)
      .not.toBe(
        decoded({ clientId: 'client_002' }).sourceRecordFingerprint,
      );
  });

  it('excludes decodedAt from the source fingerprint', () => {
    const first = decoded({}, {}, DECODED_AT);
    const second = decoded({}, {}, LATER_DECODED_AT);
    expect(first.decodedAt).not.toBe(second.decodedAt);
    expect(first.sourceRecordFingerprint).toBe(
      second.sourceRecordFingerprint,
    );
  });

  it('preserves an explicit numeric record version', () => {
    expect(decoded({ recordVersion: 7 }).sourceRecordVersion).toEqual({
      schemaVersion: AUTHORITY_LEGACY_SOURCE_RECORD_VERSION_SCHEMA,
      provenance: 'EXPLICIT_NUMERIC_VERSION',
      explicitVersion: 7,
    });
  });

  it('uses content fingerprint provenance when version is missing', () => {
    const result = decoded();
    expect(result.sourceRecordVersion).toEqual({
      schemaVersion: AUTHORITY_LEGACY_SOURCE_RECORD_VERSION_SCHEMA,
      provenance: 'CONTENT_FINGERPRINT_ONLY',
      contentFingerprint: result.sourceRecordFingerprint,
    });
  });

  it('produces all security-relevant alias candidate types', () => {
    const result = decoded({
      tenantId: undefined,
      tenantSlug: 'tenant-legacy',
      clientId: 'client_001',
      organizationId: 'organization_001',
    });
    expect(
      result.aliasCandidates.map((candidate) => candidate.aliasType),
    ).toEqual([
      'CLIENT_REFERENCE',
      'ORGANIZATION_REFERENCE',
      'TENANT_SLUG',
    ]);
    const legacyId = decoded({
      tenantId: 'tenant_document_001',
      tenantSlug: undefined,
    });
    expect(
      legacyId.aliasCandidates.map((candidate) => candidate.aliasType),
    ).toContain('LEGACY_TENANT_ID');
  });

  it('never converts companyName into an alias', () => {
    const result = decoded({ companyName: 'Sensitive Company Name' });
    expect(
      result.aliasCandidates.some(
        (candidate) =>
          candidate.normalizedAlias.includes('sensitive-company'),
      ),
    ).toBe(false);
    expect(result.canonicalizationWarnings).toContain(
      'COMPANY_NAME_IGNORED',
    );
  });

  it('collapses duplicate slug candidates canonically', () => {
    const result = decoded({
      tenantId: 'tenant-legacy',
      tenantSlug: 'tenant-legacy',
    });
    expect(
      result.aliasCandidates.filter(
        (candidate) => candidate.aliasType === 'TENANT_SLUG',
      ),
    ).toHaveLength(1);
  });

  it('marks contradictory slug aliases ambiguous and requires review', () => {
    const result = decoded({
      tenantId: 'other-tenant-slug',
      tenantSlug: 'tenant-legacy',
    });
    expect(
      result.aliasCandidates.filter(
        (candidate) => candidate.aliasType === 'TENANT_SLUG',
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          confidence: 'AMBIGUOUS',
          disposition: 'REVIEW',
        }),
      ]),
    );
    expect(result.classificationDisposition).toBe('REQUIRES_REVIEW');
  });

  it('returns cloned and deeply frozen source data', () => {
    const modules = ['AURA_HCM'];
    const raw = {
      tenantSlug: 'tenant-legacy',
      status: 'ACTIVE',
      enabledModules: modules,
    };
    const result = decodeAuthorityLegacyTenantSourceRecordV1(
      descriptor(),
      raw,
      DECODED_AT,
    );
    modules[0] = 'AURA_MAINTENANCE';
    expect(result.normalizedRawRecord.enabledModules).toEqual([
      'AURA_HCM',
    ]);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.sourceDescriptor)).toBe(true);
    expect(Object.isFrozen(result.sourceLocator)).toBe(true);
    expect(Object.isFrozen(result.aliasCandidates)).toBe(true);
    expect(
      Object.isFrozen(result.normalizedRawRecord.enabledModules),
    ).toBe(true);
  });

  it('rejects source descriptor, locator, version or fingerprint mismatch', () => {
    const result = decoded();
    const mismatchedDescriptor = {
      ...result,
      sourceDescriptor: createAuthorityLegacyTenantSourceDescriptorV1(
        descriptor({ sourceDocumentId: 'DifferentSource001' }),
      ),
    };
    expect(() =>
      validateAuthorityLegacyTenantSourceRecordV1(
        mismatchedDescriptor,
        result.sourceLocator.locatorKey,
      ),
    ).toThrow(AuthorityPersistenceContractError);
    expect(() =>
      decodeAuthorityLegacyTenantSourceRecordV1(
        descriptor({
          expectedSourceFingerprint: `sha256:${'f'.repeat(64)}`,
        }),
        { tenantSlug: 'tenant-legacy', status: 'ACTIVE' },
        DECODED_AT,
      ),
    ).toThrow(AuthorityPersistenceContractError);
  });
});

describe('read registry and canonicalization closure', () => {
  it('distinguishes PRESENT from ABSENT reads', () => {
    const source = decoded();
    const present = createAuthorityRepositoryReadRegistryEntryV1({
      schemaVersion:
        AUTHORITY_REPOSITORY_READ_REGISTRY_ENTRY_VERSION,
      collection: source.sourceDescriptor.sourceCollection,
      documentId: source.sourceDocumentId,
      locatorKey: source.sourceLocator.locatorKey,
      readStatus: 'PRESENT',
      recordFingerprint: source.sourceRecordFingerprint,
      recordVersion: source.sourceRecordVersion,
      authorityUse: 'PROHIBITED',
    });
    const absent = createAuthorityRepositoryReadRegistryEntryV1({
      schemaVersion:
        AUTHORITY_REPOSITORY_READ_REGISTRY_ENTRY_VERSION,
      collection: source.sourceDescriptor.sourceCollection,
      documentId: source.sourceDocumentId,
      locatorKey: source.sourceLocator.locatorKey,
      readStatus: 'ABSENT',
      authorityUse: 'PROHIBITED',
    });
    expect(present.readStatus).toBe('PRESENT');
    expect(absent.readStatus).toBe('ABSENT');
    expect('recordFingerprint' in absent).toBe(false);
  });

  it('accepts only decoded source records in canonicalization input', () => {
    expect(
      createLegacyTenantCanonicalizationInputV1(
        canonicalizationInput(),
      ).sourceRecord.sourceLocator.collectionPath,
    ).toBe('platform_tenants');
    const withoutSource = canonicalizationInput();
    expect(() =>
      createLegacyTenantCanonicalizationInputV1({
        ...withoutSource,
        sourceRecord: undefined,
      }),
    ).toThrow(AuthorityPersistenceContractError);
  });

  it('rejects free sourceReference compatibility fields', () => {
    const source = decoded();
    expect(() =>
      createLegacyTenantCanonicalizationInputV1({
        ...canonicalizationInput(source),
        migrationMetadata: {
          ...migrationMetadata(source),
          sourceReference: 'platform_tenants/arbitrary',
        },
      }),
    ).toThrow(AuthorityPersistenceContractError);
  });

  it('prevents review and rejected sources from becoming commands', () => {
    const reviewSource = decoded({
      status: 'ACTIVE',
      tenantStatus: 'SUSPENDED',
    });
    const rejectedSource = decoded({ status: 'UNRECOGNIZED' });
    expect(
      createLegacyTenantCanonicalizationInputV1(
        canonicalizationInput(reviewSource),
      ).sourceRecord.classificationDisposition,
    ).toBe('REQUIRES_REVIEW');
    expect(
      createLegacyTenantCanonicalizationInputV1(
        canonicalizationInput(rejectedSource),
      ).sourceRecord.classificationDisposition,
    ).toBe('REJECTED');
    expect(() =>
      createAuthorityAdministrativeCommandV1(
        canonicalizationCommand(reviewSource),
      ),
    ).toThrow(AuthorityPersistenceContractError);
    expect(() =>
      createAuthorityAdministrativeCommandV1(
        canonicalizationCommand(rejectedSource),
      ),
    ).toThrow(AuthorityPersistenceContractError);
  });

  it('prevents a slug-derived target document ID', () => {
    const source = decoded();
    expect(() =>
      createLegacyTenantCanonicalizationInputV1(
        canonicalizationInput(source, {
          canonicalDocumentId: 'tenant-legacy',
          canonicalTarget: {
            tenantId: 'tenant-legacy',
            status: 'ACTIVE',
            tenantSlug: 'tenant-legacy',
          },
        }),
      ),
    ).toThrow(AuthorityPersistenceContractError);
  });
});
