import {
  AuthorityProvisioningError,
  failAuthorityProvisioning,
} from './authorityProvisioningErrors';
import type {
  AuthorityProvisioningDependenciesV1,
} from './authorityProvisioningPorts';
import {
  AUTHORITY_PROVISIONING_AUDIT_VERSION,
  AUTHORITY_PROVISIONING_RECORD_VERSION,
  AUTHORITY_PROVISIONING_REQUEST_VERSION,
  AUTHORITY_RESOLUTION_REQUEST_VERSION,
  CONTROLLED_PREVIEW_HAPPY_PATH,
  PREVIEW_DISCOVERY_AUTHORITY_CAPABILITIES,
  PREVIEW_SYNTHETIC_AUTHORITY_RETENTION_POLICY_VERSION,
  type AuthorityProvisioningAuditRecordV1,
  type PlatformPrincipalV1,
  type PlatformTenantV1,
  type PreviewSyntheticAuthorityMetadataV1,
  type PreviewSyntheticAuthorityRetentionPolicyV1,
  type ProvisionSyntheticPreviewAuthorityRequestV1,
  type ResolvePreviewAuthorityRequestV1,
  type TenantMembershipV1,
} from './authorityProvisioningTypes';

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{9,159}$/;
const LABEL = /^AI02H2-PREVIEW-SYNTHETIC-[A-Z0-9-]{2,80}$/;
const FINGERPRINT = /^sha256:[a-f0-9]{64}$/;

function record(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return failAuthorityProvisioning('INVALID_REQUEST');
  }
  const candidate = value as Record<string, unknown>;
  if (Object.keys(candidate).some((key) => !keys.includes(key))) {
    return failAuthorityProvisioning('INVALID_REQUEST');
  }
  return candidate;
}

function identifier(value: unknown, code: 'UID_REQUIRED' | 'INVALID_RECORD'): string {
  if (typeof value !== 'string' || !IDENTIFIER.test(value)) {
    return failAuthorityProvisioning(code);
  }
  if (/aura-control-center-debb3|staging|production/i.test(value)) {
    return failAuthorityProvisioning('PRODUCTION_REFERENCE_FORBIDDEN');
  }
  return value;
}

function label(value: unknown): string {
  if (typeof value !== 'string' || !LABEL.test(value)) {
    return failAuthorityProvisioning('SYNTHETIC_LABEL_REQUIRED');
  }
  return value;
}

function timestamp(value: unknown): string {
  if (
    typeof value !== 'string' ||
    Number.isNaN(Date.parse(value)) ||
    new Date(value).toISOString() !== value
  ) {
    return failAuthorityProvisioning('INVALID_REQUEST');
  }
  return value;
}

export function validateAuthorityProvisioningTimestampV1(value: unknown): string {
  return timestamp(value);
}

function environment(value: unknown): 'PREVIEW' {
  if (value !== 'PREVIEW') {
    return failAuthorityProvisioning('ENVIRONMENT_NOT_PREVIEW');
  }
  return value;
}

function capabilities(value: unknown): readonly never[] {
  if (!Array.isArray(value)) {
    return failAuthorityProvisioning('INVALID_REQUEST');
  }
  if (
    value.length !== 0 ||
    value.some((item) =>
      !(PREVIEW_DISCOVERY_AUTHORITY_CAPABILITIES as readonly unknown[]).includes(item),
    )
  ) {
    return failAuthorityProvisioning('CAPABILITY_NOT_ALLOWED');
  }
  return Object.freeze([] as never[]);
}

export function validatePreviewSyntheticAuthorityRetentionPolicyV1(
  value: unknown,
): PreviewSyntheticAuthorityRetentionPolicyV1 {
  const candidate = record(value, [
    'version',
    'principalRetention',
    'tenantRetention',
    'membershipRetention',
    'happyPathDataRetentionDays',
    'cleanup',
    'approvedUse',
  ]);
  if (
    candidate.version !== PREVIEW_SYNTHETIC_AUTHORITY_RETENTION_POLICY_VERSION ||
    candidate.principalRetention !== 'PERMANENT_PREVIEW_FIXTURE' ||
    candidate.tenantRetention !== 'PERMANENT_PREVIEW_FIXTURE' ||
    candidate.membershipRetention !== 'PREVIEW_ENVIRONMENT_LIFETIME' ||
    candidate.happyPathDataRetentionDays !== 30 ||
    candidate.cleanup !== 'VERSIONED_AUTHORIZED_PROCEDURE' ||
    candidate.approvedUse !== CONTROLLED_PREVIEW_HAPPY_PATH
  ) {
    return failAuthorityProvisioning('INVALID_REQUEST');
  }
  return Object.freeze(candidate as unknown as PreviewSyntheticAuthorityRetentionPolicyV1);
}

export function validateProvisionSyntheticPreviewAuthorityRequestV1(
  value: unknown,
): ProvisionSyntheticPreviewAuthorityRequestV1 {
  const candidate = record(value, [
    'version',
    'requestId',
    'correlationId',
    'idempotencyKey',
    'authUid',
    'identityLabel',
    'tenantLabel',
    'requestedCapabilities',
    'environment',
    'retentionPolicy',
    'requestedAt',
  ]);
  if (candidate.version !== AUTHORITY_PROVISIONING_REQUEST_VERSION) {
    return failAuthorityProvisioning('INVALID_REQUEST');
  }
  return Object.freeze({
    version: AUTHORITY_PROVISIONING_REQUEST_VERSION,
    requestId: identifier(candidate.requestId, 'INVALID_RECORD'),
    correlationId: identifier(candidate.correlationId, 'INVALID_RECORD'),
    idempotencyKey: identifier(candidate.idempotencyKey, 'INVALID_RECORD'),
    authUid: identifier(candidate.authUid, 'UID_REQUIRED'),
    identityLabel: label(candidate.identityLabel),
    tenantLabel: label(candidate.tenantLabel),
    requestedCapabilities: capabilities(candidate.requestedCapabilities),
    environment: environment(candidate.environment),
    retentionPolicy: validatePreviewSyntheticAuthorityRetentionPolicyV1(
      candidate.retentionPolicy,
    ),
    requestedAt: timestamp(candidate.requestedAt),
  });
}

export function validateResolvePreviewAuthorityRequestV1(
  value: unknown,
): ResolvePreviewAuthorityRequestV1 {
  const candidate = record(value, [
    'version',
    'authUid',
    'environment',
    'expectedTenantId',
    'requiredCapability',
  ]);
  if (candidate.version !== AUTHORITY_RESOLUTION_REQUEST_VERSION) {
    return failAuthorityProvisioning('INVALID_REQUEST');
  }
  if (candidate.requiredCapability !== undefined) {
    return failAuthorityProvisioning('CAPABILITY_NOT_ALLOWED');
  }
  return Object.freeze({
    version: AUTHORITY_RESOLUTION_REQUEST_VERSION,
    authUid: identifier(candidate.authUid, 'UID_REQUIRED'),
    environment: environment(candidate.environment),
    ...(candidate.expectedTenantId === undefined
      ? {}
      : { expectedTenantId: identifier(candidate.expectedTenantId, 'INVALID_RECORD') }),
  });
}

function metadata(value: unknown): PreviewSyntheticAuthorityMetadataV1 {
  const candidate = record(value, ['label', 'approvedUse', 'synthetic']);
  if (
    candidate.approvedUse !== CONTROLLED_PREVIEW_HAPPY_PATH ||
    candidate.synthetic !== true
  ) {
    return failAuthorityProvisioning('INVALID_RECORD');
  }
  return Object.freeze({
    label: label(candidate.label),
    approvedUse: CONTROLLED_PREVIEW_HAPPY_PATH,
    synthetic: true,
  });
}

export function validatePlatformPrincipalV1(value: unknown): PlatformPrincipalV1 {
  const candidate = record(value, [
    'schemaVersion', 'principalId', 'authUid', 'status', 'environment',
    'createdAt', 'updatedAt', 'testMetadata',
  ]);
  if (
    candidate.schemaVersion !== AUTHORITY_PROVISIONING_RECORD_VERSION ||
    !['ACTIVE', 'DISABLED'].includes(String(candidate.status))
  ) {
    return failAuthorityProvisioning('INVALID_RECORD');
  }
  return Object.freeze({
    schemaVersion: AUTHORITY_PROVISIONING_RECORD_VERSION,
    principalId: identifier(candidate.principalId, 'INVALID_RECORD'),
    authUid: identifier(candidate.authUid, 'UID_REQUIRED'),
    status: candidate.status as PlatformPrincipalV1['status'],
    environment: environment(candidate.environment),
    createdAt: timestamp(candidate.createdAt),
    updatedAt: timestamp(candidate.updatedAt),
    testMetadata: metadata(candidate.testMetadata),
  });
}

export function validatePlatformTenantV1(value: unknown): PlatformTenantV1 {
  const candidate = record(value, [
    'schemaVersion', 'tenantId', 'status', 'environment', 'tenantType',
    'createdAt', 'updatedAt', 'testMetadata',
  ]);
  if (
    candidate.schemaVersion !== AUTHORITY_PROVISIONING_RECORD_VERSION ||
    !['ACTIVE', 'DISABLED'].includes(String(candidate.status)) ||
    candidate.tenantType !== 'SYNTHETIC_TEST'
  ) {
    return failAuthorityProvisioning('INVALID_RECORD');
  }
  return Object.freeze({
    schemaVersion: AUTHORITY_PROVISIONING_RECORD_VERSION,
    tenantId: identifier(candidate.tenantId, 'INVALID_RECORD'),
    status: candidate.status as PlatformTenantV1['status'],
    environment: environment(candidate.environment),
    tenantType: 'SYNTHETIC_TEST',
    createdAt: timestamp(candidate.createdAt),
    updatedAt: timestamp(candidate.updatedAt),
    testMetadata: metadata(candidate.testMetadata),
  });
}

export function validateTenantMembershipV1(value: unknown): TenantMembershipV1 {
  const candidate = record(value, [
    'schemaVersion', 'membershipId', 'principalId', 'tenantId', 'status',
    'environment', 'capabilities', 'createdAt', 'updatedAt',
  ]);
  if (
    candidate.schemaVersion !== AUTHORITY_PROVISIONING_RECORD_VERSION ||
    !['ACTIVE', 'DISABLED'].includes(String(candidate.status))
  ) {
    return failAuthorityProvisioning('INVALID_RECORD');
  }
  return Object.freeze({
    schemaVersion: AUTHORITY_PROVISIONING_RECORD_VERSION,
    membershipId: identifier(candidate.membershipId, 'INVALID_RECORD'),
    principalId: identifier(candidate.principalId, 'INVALID_RECORD'),
    tenantId: identifier(candidate.tenantId, 'INVALID_RECORD'),
    status: candidate.status as TenantMembershipV1['status'],
    environment: environment(candidate.environment),
    capabilities: capabilities(candidate.capabilities),
    createdAt: timestamp(candidate.createdAt),
    updatedAt: timestamp(candidate.updatedAt),
  });
}

export function validateAuthorityProvisioningAuditRecordV1(
  value: unknown,
): AuthorityProvisioningAuditRecordV1 {
  const candidate = record(value, [
    'schemaVersion', 'auditId', 'idempotencyKey', 'requestFingerprint',
    'principalId', 'tenantId', 'membershipId', 'environment', 'occurredAt',
    'approvedUse',
  ]);
  if (
    candidate.schemaVersion !== AUTHORITY_PROVISIONING_AUDIT_VERSION ||
    candidate.approvedUse !== CONTROLLED_PREVIEW_HAPPY_PATH ||
    typeof candidate.requestFingerprint !== 'string' ||
    !FINGERPRINT.test(candidate.requestFingerprint)
  ) {
    return failAuthorityProvisioning('INVALID_RECORD');
  }
  return Object.freeze({
    schemaVersion: AUTHORITY_PROVISIONING_AUDIT_VERSION,
    auditId: identifier(candidate.auditId, 'INVALID_RECORD'),
    idempotencyKey: identifier(candidate.idempotencyKey, 'INVALID_RECORD'),
    requestFingerprint: candidate.requestFingerprint,
    principalId: identifier(candidate.principalId, 'INVALID_RECORD'),
    tenantId: identifier(candidate.tenantId, 'INVALID_RECORD'),
    membershipId: identifier(candidate.membershipId, 'INVALID_RECORD'),
    environment: environment(candidate.environment),
    occurredAt: timestamp(candidate.occurredAt),
    approvedUse: CONTROLLED_PREVIEW_HAPPY_PATH,
  });
}

export function validateAuthorityProvisioningDependenciesV1(
  value: unknown,
): AuthorityProvisioningDependenciesV1 {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return failAuthorityProvisioning('INVALID_DEPENDENCIES');
  }
  const candidate = value as Partial<AuthorityProvisioningDependenciesV1>;
  if (
    typeof candidate.transaction?.run !== 'function' ||
    typeof candidate.clock?.now !== 'function' ||
    typeof candidate.ids?.principalId !== 'function' ||
    typeof candidate.ids?.tenantId !== 'function' ||
    typeof candidate.ids?.membershipId !== 'function' ||
    typeof candidate.ids?.auditId !== 'function' ||
    typeof candidate.fingerprints?.fingerprint !== 'function'
  ) {
    return failAuthorityProvisioning('INVALID_DEPENDENCIES');
  }
  return Object.freeze({
    transaction: candidate.transaction,
    clock: candidate.clock,
    ids: candidate.ids,
    fingerprints: candidate.fingerprints,
  }) as AuthorityProvisioningDependenciesV1;
}

export function validateGeneratedAuthorityIdentifierV1(value: unknown): string {
  return identifier(value, 'INVALID_RECORD');
}

export function validateAuthorityFingerprintV1(value: unknown): string {
  if (typeof value !== 'string' || !FINGERPRINT.test(value)) {
    return failAuthorityProvisioning('INVALID_RECORD');
  }
  return value;
}

export function isAuthorityProvisioningError(
  value: unknown,
): value is AuthorityProvisioningError {
  return value instanceof AuthorityProvisioningError;
}
