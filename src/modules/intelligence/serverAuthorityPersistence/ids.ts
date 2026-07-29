import {
  TRUSTED_SERVER_PRINCIPAL_TYPES,
} from '../serverComposition/types';
import {
  failAuthorityPersistenceContract,
  getClosedRecord,
  requireAuthorityResourceReference,
  requireCanonicalDocumentId,
  requireCanonicalPrincipalId,
  requireEnumValue,
  requireNormalizedAlias,
  requireOperationalId,
} from './helpers';
import { createCanonicalAuthorityHashV1 } from './canonicalHash';
import {
  AUTHORITY_ALIAS_KEY_VERSION,
  AUTHORITY_DETERMINISTIC_ID_VERSION,
  AUTHORITY_EVENT_TYPES,
  AUTHORITY_MEMBERSHIP_KEY_VERSION,
  AUTHORITY_RESOURCE_TYPES,
  TENANT_ALIAS_TYPES,
  type AuthorityEventType,
  type AuthorityResourceType,
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

export interface AuthorityEventIdInputV1 {
  readonly operationId: string;
  readonly eventType: AuthorityEventType;
  readonly resourceType: AuthorityResourceType;
  readonly resourceId: string;
}

function createDeterministicDocumentId(
  prefix: string,
  namespace: string,
  value: unknown,
): string {
  const fingerprint = createCanonicalAuthorityHashV1(
    namespace,
    value,
    'INVALID_DETERMINISTIC_ID',
  );
  return `${prefix}_v${AUTHORITY_DETERMINISTIC_ID_VERSION}_${fingerprint.slice(
    'sha256:'.length,
  )}`;
}

function validateEventIdInput(value: unknown): AuthorityEventIdInputV1 {
  const record = getClosedRecord(
    value,
    ['operationId', 'eventType', 'resourceType', 'resourceId'],
    'INVALID_DETERMINISTIC_ID',
  );
  return Object.freeze({
    operationId: requireOperationalId(
      record.operationId,
      'INVALID_DETERMINISTIC_ID',
    ),
    eventType: requireEnumValue(
      record.eventType,
      AUTHORITY_EVENT_TYPES,
      'INVALID_DETERMINISTIC_ID',
    ),
    resourceType: requireEnumValue(
      record.resourceType,
      AUTHORITY_RESOURCE_TYPES,
      'INVALID_DETERMINISTIC_ID',
    ),
    resourceId: requireAuthorityResourceReference(
      record.resourceId,
      'INVALID_DETERMINISTIC_ID',
    ),
  });
}

export function createAuthorityAuditEventIdV1(value: unknown): string {
  return createDeterministicDocumentId(
    'aaudit',
    'authority-audit-event-id:v1',
    validateEventIdInput(value),
  );
}

export function createAuthorityOutboxEventIdV1(value: unknown): string {
  return createDeterministicDocumentId(
    'aoutbox',
    'authority-outbox-event-id:v1',
    validateEventIdInput(value),
  );
}

export function createAuthorityIdempotencyDocumentIdV1(
  idempotencyKey: unknown,
): string {
  const validated = requireOperationalId(
    idempotencyKey,
    'INVALID_DETERMINISTIC_ID',
  );
  return createDeterministicDocumentId(
    'aikey',
    'authority-idempotency-document-id:v1',
    validated,
  );
}

export function createAuthorityOperationBindingDocumentIdV1(
  operationId: unknown,
): string {
  const validated = requireOperationalId(
    operationId,
    'INVALID_DETERMINISTIC_ID',
  );
  return createDeterministicDocumentId(
    'aoperation',
    'authority-operation-binding-document-id:v1',
    validated,
  );
}
