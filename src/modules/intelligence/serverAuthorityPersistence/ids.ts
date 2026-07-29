import {
  TRUSTED_SERVER_PRINCIPAL_TYPES,
} from '../serverComposition/types';
import {
  failAuthorityPersistenceContract,
  getClosedRecord,
  requireCanonicalDocumentId,
  requireCanonicalPrincipalId,
  requireEnumValue,
  requireNormalizedAlias,
} from './helpers';
import {
  AUTHORITY_ALIAS_KEY_VERSION,
  AUTHORITY_MEMBERSHIP_KEY_VERSION,
  TENANT_ALIAS_TYPES,
  type TenantAliasKeyInputV1,
  type TenantMembershipKeyInputV1,
} from './types';

function frame(value: string): string {
  return `${value.length}:${value}`;
}

export function validateTenantDocumentIdV1(value: unknown): string {
  return requireCanonicalDocumentId(value, 'INVALID_TENANT_RECORD');
}

export function createAuthorityMembershipKeyV1(value: unknown): string {
  const input = getClosedRecord(
    value,
    ['principalType', 'principalId', 'tenantId'],
    'INVALID_MEMBERSHIP_RECORD',
  );
  const principalType = requireEnumValue(
    input.principalType,
    TRUSTED_SERVER_PRINCIPAL_TYPES,
    'INVALID_MEMBERSHIP_RECORD',
  );
  const principalId = requireCanonicalPrincipalId(
    input.principalId,
    'INVALID_MEMBERSHIP_RECORD',
  );
  const tenantId = requireCanonicalDocumentId(
    input.tenantId,
    'INVALID_MEMBERSHIP_RECORD',
  );
  return [
    `v${AUTHORITY_MEMBERSHIP_KEY_VERSION}`,
    frame(principalType),
    frame(principalId),
    frame(tenantId),
  ].join('|');
}

export function createAuthorityAliasKeyV1(value: unknown): string {
  const input = getClosedRecord(
    value,
    ['aliasType', 'normalizedAlias'],
    'INVALID_ALIAS_RECORD',
  );
  const aliasType = requireEnumValue(
    input.aliasType,
    TENANT_ALIAS_TYPES,
    'INVALID_ALIAS_RECORD',
  );
  const normalizedAlias = requireNormalizedAlias(
    input.normalizedAlias,
    aliasType,
    'INVALID_ALIAS_RECORD',
  );
  const encodedAlias = encodeURIComponent(normalizedAlias);
  if (encodedAlias.includes('/')) {
    return failAuthorityPersistenceContract('INVALID_ALIAS_RECORD');
  }
  return [
    `v${AUTHORITY_ALIAS_KEY_VERSION}`,
    frame(aliasType),
    frame(encodedAlias),
  ].join('|');
}

export function assertAuthorityMembershipKeyV1(
  documentId: unknown,
  input: TenantMembershipKeyInputV1,
): string {
  const expected = createAuthorityMembershipKeyV1(input);
  if (documentId !== expected) {
    return failAuthorityPersistenceContract(
      'MEMBERSHIP_DOCUMENT_ID_MISMATCH',
    );
  }
  return expected;
}

export function assertAuthorityAliasKeyV1(
  documentId: unknown,
  input: TenantAliasKeyInputV1,
): string {
  const expected = createAuthorityAliasKeyV1(input);
  if (documentId !== expected) {
    return failAuthorityPersistenceContract('ALIAS_DOCUMENT_ID_MISMATCH');
  }
  return expected;
}
