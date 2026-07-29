import {
  TRUSTED_AUTHENTICATION_METHODS,
  TRUSTED_RESOLVER_INPUT_VERSION,
  TRUSTED_SERVER_PRINCIPAL_TYPES,
  TRUSTED_TENANT_MEMBERSHIP_ROLES,
  type TrustedAuthenticationMethod,
  type TrustedServerPrincipalType,
  type TrustedServerPrincipalV1,
  type TrustedTenantMembershipRole,
  type TrustedTenantMembershipV1,
} from '../serverComposition/types';
import {
  validateTrustedResourceScopeV1,
  validateTrustedServerPrincipalV1,
  validateTrustedTenantMembershipV1,
} from '../serverComposition/validators';
import {
  CANONICAL_TENANT_AUTHORITY_VERSION,
  IDENTITY_CLAIMS_PROJECTION_VERSION,
  IDENTITY_RESOLUTION_CONTRACT_VERSION,
  NEUTRAL_AUTHENTICATION_TRANSPORTS,
  PRINCIPAL_RESOLUTION_REJECTION_REASONS,
  SERVER_OWNED_TENANT_MEMBERSHIP_STATUSES,
  SERVER_OWNED_TENANT_MEMBERSHIP_VERSION,
  TENANT_MEMBERSHIP_RESOLUTION_REASONS,
  TENANT_SELECTOR_HINT_VERSION,
  TENANT_SELECTOR_STRATEGIES,
  VERIFIED_AUTHENTICATION_ASSURANCE_LEVELS,
  VERIFIED_AUTHENTICATION_SUBJECT_VERSION,
  VERIFIED_IDENTITY_BINDING_VERSION,
  VERIFIED_IDENTITY_PROVIDERS,
  type CanonicalTenantAuthorityV1,
  type IdentityClaimsProjectionV1,
  type NeutralAuthenticationContextV1,
  type PrincipalResolutionInputV1,
  type PrincipalResolutionResultV1,
  type ResolverInvocationIdentityV1,
  type ServerOwnedTenantMembershipRecordV1,
  type TenantMembershipResolutionInputV1,
  type TenantMembershipResolutionResultV1,
  type TenantSelectorHintV1,
  type VerifiedAuthenticationSubjectV1,
  type VerifiedIdentityBindingV1,
  type VerifiedServiceIdentityBindingV1,
  type VerifiedSystemIdentityBindingV1,
  type VerifiedUserIdentityBindingV1,
} from './types';
import {
  failContract,
  freezeArray,
  getClosedRecord,
  hasDefined,
  requireCanonicalIdentifier,
  requireCanonicalReference,
  requireCanonicalTimestamp,
  requireEnumValue,
  requireExactLiteral,
  requireFirebaseUid,
  requireNonEmptyVersion,
  requireOptionalCanonicalReference,
  requireOptionalFingerprint,
  requireTenantSlug,
  requireTimestampOrder,
} from './helpers';

function authenticationCombinationIsValid(
  subjectType: TrustedServerPrincipalType,
  provider: VerifiedAuthenticationSubjectV1['provider'],
  method: TrustedAuthenticationMethod,
): boolean {
  if (subjectType === 'USER') {
    return provider === 'FIREBASE_AUTH' && method === 'FIREBASE_ID_TOKEN';
  }
  if (subjectType === 'SERVICE') {
    return (
      provider === 'GOOGLE_CLOUD_IAM' &&
      (method === 'OIDC_SERVICE_ACCOUNT' || method === 'WORKLOAD_IDENTITY')
    );
  }
  return (
    provider === 'GOOGLE_CLOUD_IAM' &&
    method === 'WORKLOAD_IDENTITY'
  );
}

function rolesMatchPrincipal(
  roles: readonly TrustedTenantMembershipRole[],
  principalType: TrustedServerPrincipalType,
): boolean {
  if (principalType === 'SYSTEM') {
    return roles.every((role) => role === 'TENANT_SYSTEM');
  }
  if (principalType === 'SERVICE') {
    return roles.every(
      (role) => role === 'TENANT_SERVICE' || role === 'TENANT_MEMBER',
    );
  }
  return roles.every(
    (role) =>
      role === 'TENANT_MEMBER' ||
      role === 'TENANT_OPERATOR' ||
      role === 'TENANT_ADMIN',
  );
}

function validateRoles(
  value: unknown,
  principalType: TrustedServerPrincipalType,
): readonly TrustedTenantMembershipRole[] {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some(
      (role) =>
        typeof role !== 'string' ||
        !TRUSTED_TENANT_MEMBERSHIP_ROLES.includes(
          role as TrustedTenantMembershipRole,
        ),
    )
  ) {
    return failContract('INVALID_MEMBERSHIP');
  }
  const roles = value as TrustedTenantMembershipRole[];
  if (
    new Set(roles).size !== roles.length ||
    !rolesMatchPrincipal(roles, principalType)
  ) {
    return failContract('INVALID_MEMBERSHIP');
  }
  return freezeArray([...roles].sort());
}

function safelyValidateTrustedPrincipal(
  value: unknown,
): TrustedServerPrincipalV1 {
  try {
    return validateTrustedServerPrincipalV1(value);
  } catch {
    return failContract('INVALID_RESOLUTION');
  }
}

function safelyValidateTrustedMembership(
  value: unknown,
): TrustedTenantMembershipV1 {
  try {
    return validateTrustedTenantMembershipV1(value);
  } catch {
    return failContract('INVALID_RESOLUTION');
  }
}

export function validateVerifiedAuthenticationSubjectV1(
  value: unknown,
): VerifiedAuthenticationSubjectV1 {
  const record = getClosedRecord(
    value,
    [
      'schemaVersion',
      'subjectType',
      'provider',
      'providerSubjectId',
      'authenticationMethod',
      'authenticatedAt',
      'tokenIssuedAt',
      'tokenExpiresAt',
      'revocationCheckedAt',
      'credentialVersion',
      'assurance',
      'claimsFingerprint',
    ],
    'INVALID_SUBJECT',
  );
  const subjectType = requireEnumValue(
    record.subjectType,
    TRUSTED_SERVER_PRINCIPAL_TYPES,
    'INVALID_SUBJECT',
  );
  const provider = requireEnumValue(
    record.provider,
    VERIFIED_IDENTITY_PROVIDERS,
    'INVALID_SUBJECT',
  );
  const authenticationMethod = requireEnumValue(
    record.authenticationMethod,
    TRUSTED_AUTHENTICATION_METHODS,
    'INVALID_SUBJECT',
  );
  if (!authenticationCombinationIsValid(subjectType, provider, authenticationMethod)) {
    return failContract('INVALID_SUBJECT');
  }
  const providerSubjectId =
    provider === 'FIREBASE_AUTH'
      ? requireFirebaseUid(record.providerSubjectId, 'INVALID_SUBJECT')
      : requireCanonicalReference(record.providerSubjectId, 'INVALID_SUBJECT');
  const authenticatedAt = requireCanonicalTimestamp(
    record.authenticatedAt,
    'INVALID_SUBJECT',
  );
  const tokenIssuedAt = requireCanonicalTimestamp(
    record.tokenIssuedAt,
    'INVALID_SUBJECT',
  );
  const tokenExpiresAt = requireCanonicalTimestamp(
    record.tokenExpiresAt,
    'INVALID_SUBJECT',
  );
  const revocationCheckedAt = requireCanonicalTimestamp(
    record.revocationCheckedAt,
    'INVALID_SUBJECT',
  );
  requireTimestampOrder(
    authenticatedAt,
    tokenIssuedAt,
    true,
    'INVALID_SUBJECT',
  );
  requireTimestampOrder(
    tokenIssuedAt,
    revocationCheckedAt,
    true,
    'INVALID_SUBJECT',
  );
  requireTimestampOrder(
    revocationCheckedAt,
    tokenExpiresAt,
    false,
    'INVALID_SUBJECT',
  );
  const assurance =
    record.assurance === undefined
      ? undefined
      : requireEnumValue(
          record.assurance,
          VERIFIED_AUTHENTICATION_ASSURANCE_LEVELS,
          'INVALID_SUBJECT',
        );
  const claimsFingerprint = requireOptionalFingerprint(
    record.claimsFingerprint,
    'INVALID_SUBJECT',
  );
  return Object.freeze({
    schemaVersion: requireExactLiteral(
      record.schemaVersion,
      VERIFIED_AUTHENTICATION_SUBJECT_VERSION,
      'INVALID_SUBJECT',
    ),
    subjectType,
    provider,
    providerSubjectId,
    authenticationMethod,
    authenticatedAt,
    tokenIssuedAt,
    tokenExpiresAt,
    revocationCheckedAt,
    credentialVersion: requireNonEmptyVersion(
      record.credentialVersion,
      'INVALID_SUBJECT',
    ),
    ...(assurance === undefined ? {} : { assurance }),
    ...(claimsFingerprint === undefined ? {} : { claimsFingerprint }),
  });
}

export function validateVerifiedUserIdentityBindingV1(
  value: unknown,
): VerifiedUserIdentityBindingV1 {
  const record = getClosedRecord(
    value,
    [
      'schemaVersion',
      'bindingVersion',
      'principalType',
      'provider',
      'providerSubjectId',
      'firebaseUid',
      'canonicalPrincipalId',
      'bindingId',
      'status',
      'verifiedAt',
      'resolverVersion',
    ],
    'INVALID_IDENTITY_BINDING',
  );
  const providerSubjectId = requireFirebaseUid(
    record.providerSubjectId,
    'INVALID_IDENTITY_BINDING',
  );
  const firebaseUid = requireFirebaseUid(
    record.firebaseUid,
    'INVALID_IDENTITY_BINDING',
  );
  const canonicalPrincipalId = requireCanonicalIdentifier(
    record.canonicalPrincipalId,
    'INVALID_IDENTITY_BINDING',
  );
  if (
    providerSubjectId !== firebaseUid ||
    firebaseUid !== canonicalPrincipalId
  ) {
    return failContract('INVALID_IDENTITY_BINDING');
  }
  return Object.freeze({
    schemaVersion: requireExactLiteral(
      record.schemaVersion,
      VERIFIED_IDENTITY_BINDING_VERSION,
      'INVALID_IDENTITY_BINDING',
    ),
    bindingVersion: requireNonEmptyVersion(
      record.bindingVersion,
      'INVALID_IDENTITY_BINDING',
    ),
    principalType: requireExactLiteral(
      record.principalType,
      'USER',
      'INVALID_IDENTITY_BINDING',
    ),
    provider: requireExactLiteral(
      record.provider,
      'FIREBASE_AUTH',
      'INVALID_IDENTITY_BINDING',
    ),
    providerSubjectId,
    firebaseUid,
    canonicalPrincipalId,
    bindingId: requireCanonicalIdentifier(
      record.bindingId,
      'INVALID_IDENTITY_BINDING',
    ),
    status: requireExactLiteral(
      record.status,
      'ACTIVE',
      'INVALID_IDENTITY_BINDING',
    ),
    verifiedAt: requireCanonicalTimestamp(
      record.verifiedAt,
      'INVALID_IDENTITY_BINDING',
    ),
    resolverVersion: requireNonEmptyVersion(
      record.resolverVersion,
      'INVALID_IDENTITY_BINDING',
    ),
  });
}

function validateIamIdentityBinding(
  value: unknown,
  principalType: 'SERVICE' | 'SYSTEM',
): VerifiedServiceIdentityBindingV1 | VerifiedSystemIdentityBindingV1 {
  const record = getClosedRecord(
    value,
    [
      'schemaVersion',
      'bindingVersion',
      'principalType',
      'provider',
      'providerSubjectId',
      'canonicalPrincipalId',
      'bindingId',
      'status',
      'verifiedAt',
      'resolverVersion',
      'iamEvidenceFingerprint',
    ],
    'INVALID_IDENTITY_BINDING',
  );
  const canonicalPrincipalId = requireCanonicalIdentifier(
    record.canonicalPrincipalId,
    'INVALID_IDENTITY_BINDING',
  );
  if (canonicalPrincipalId.toLowerCase() === 'system') {
    return failContract('INVALID_IDENTITY_BINDING');
  }
  const iamEvidenceFingerprint = requireOptionalFingerprint(
    record.iamEvidenceFingerprint,
    'INVALID_IDENTITY_BINDING',
  );
  const shared = {
    schemaVersion: requireExactLiteral(
      record.schemaVersion,
      VERIFIED_IDENTITY_BINDING_VERSION,
      'INVALID_IDENTITY_BINDING',
    ),
    bindingVersion: requireNonEmptyVersion(
      record.bindingVersion,
      'INVALID_IDENTITY_BINDING',
    ),
    principalType: requireExactLiteral(
      record.principalType,
      principalType,
      'INVALID_IDENTITY_BINDING',
    ),
    provider: requireExactLiteral(
      record.provider,
      'GOOGLE_CLOUD_IAM',
      'INVALID_IDENTITY_BINDING',
    ),
    providerSubjectId: requireCanonicalReference(
      record.providerSubjectId,
      'INVALID_IDENTITY_BINDING',
    ),
    canonicalPrincipalId,
    bindingId: requireCanonicalIdentifier(
      record.bindingId,
      'INVALID_IDENTITY_BINDING',
    ),
    status: requireExactLiteral(
      record.status,
      'ACTIVE',
      'INVALID_IDENTITY_BINDING',
    ),
    verifiedAt: requireCanonicalTimestamp(
      record.verifiedAt,
      'INVALID_IDENTITY_BINDING',
    ),
    resolverVersion: requireNonEmptyVersion(
      record.resolverVersion,
      'INVALID_IDENTITY_BINDING',
    ),
    ...(iamEvidenceFingerprint === undefined
      ? {}
      : { iamEvidenceFingerprint }),
  };
  return Object.freeze(shared);
}

export function validateVerifiedServiceIdentityBindingV1(
  value: unknown,
): VerifiedServiceIdentityBindingV1 {
  return validateIamIdentityBinding(
    value,
    'SERVICE',
  ) as VerifiedServiceIdentityBindingV1;
}

export function validateVerifiedSystemIdentityBindingV1(
  value: unknown,
): VerifiedSystemIdentityBindingV1 {
  return validateIamIdentityBinding(
    value,
    'SYSTEM',
  ) as VerifiedSystemIdentityBindingV1;
}

export function validateVerifiedIdentityBindingV1(
  value: unknown,
): VerifiedIdentityBindingV1 {
  const record = getClosedRecord(
    value,
    [
      'schemaVersion',
      'bindingVersion',
      'principalType',
      'provider',
      'providerSubjectId',
      'firebaseUid',
      'canonicalPrincipalId',
      'bindingId',
      'status',
      'verifiedAt',
      'resolverVersion',
      'iamEvidenceFingerprint',
    ],
    'INVALID_IDENTITY_BINDING',
  );
  if (record.principalType === 'USER') {
    return validateVerifiedUserIdentityBindingV1(value);
  }
  if (record.principalType === 'SERVICE') {
    return validateVerifiedServiceIdentityBindingV1(value);
  }
  if (record.principalType === 'SYSTEM') {
    return validateVerifiedSystemIdentityBindingV1(value);
  }
  return failContract('INVALID_IDENTITY_BINDING');
}

export function validateCanonicalTenantAuthorityV1(
  value: unknown,
): CanonicalTenantAuthorityV1 {
  const record = getClosedRecord(
    value,
    [
      'schemaVersion',
      'tenantId',
      'status',
      'authorityVersion',
      'resolvedAt',
      'tenantRecordVersion',
      'tenantSlug',
      'organizationReference',
      'clientReference',
    ],
    'INVALID_TENANT',
  );
  const tenantId = requireCanonicalIdentifier(
    record.tenantId,
    'INVALID_TENANT',
  );
  if (tenantId.toLowerCase() === 'aura_root') {
    return failContract('INVALID_TENANT');
  }
  const tenantSlug =
    record.tenantSlug === undefined
      ? undefined
      : requireTenantSlug(record.tenantSlug, 'INVALID_TENANT');
  if (tenantSlug !== undefined && tenantSlug === tenantId) {
    return failContract('INVALID_TENANT');
  }
  const organizationReference = requireOptionalCanonicalReference(
    record.organizationReference,
    'INVALID_TENANT',
  );
  const clientReference = requireOptionalCanonicalReference(
    record.clientReference,
    'INVALID_TENANT',
  );
  return Object.freeze({
    schemaVersion: requireExactLiteral(
      record.schemaVersion,
      CANONICAL_TENANT_AUTHORITY_VERSION,
      'INVALID_TENANT',
    ),
    tenantId,
    status: requireExactLiteral(
      record.status,
      'ACTIVE',
      'INVALID_TENANT',
    ),
    authorityVersion: requireNonEmptyVersion(
      record.authorityVersion,
      'INVALID_TENANT',
    ),
    resolvedAt: requireCanonicalTimestamp(
      record.resolvedAt,
      'INVALID_TENANT',
    ),
    tenantRecordVersion: requireNonEmptyVersion(
      record.tenantRecordVersion,
      'INVALID_TENANT',
    ),
    ...(tenantSlug === undefined ? {} : { tenantSlug }),
    ...(organizationReference === undefined
      ? {}
      : { organizationReference }),
    ...(clientReference === undefined ? {} : { clientReference }),
  });
}

export function validateTenantSelectorHintV1(
  value: unknown,
): TenantSelectorHintV1 {
  const record = getClosedRecord(
    value,
    [
      'schemaVersion',
      'hintClassification',
      'selectionStrategy',
      'canonicalTenantIdCandidate',
      'tenantSlugCandidate',
      'resourceTenantReference',
    ],
    'INVALID_SELECTOR',
  );
  const schemaVersion = requireExactLiteral(
    record.schemaVersion,
    TENANT_SELECTOR_HINT_VERSION,
    'INVALID_SELECTOR',
  );
  const hintClassification = requireExactLiteral(
    record.hintClassification,
    'NON_AUTHORITATIVE',
    'INVALID_SELECTOR',
  );
  const selectionStrategy = requireEnumValue(
    record.selectionStrategy,
    TENANT_SELECTOR_STRATEGIES,
    'INVALID_SELECTOR',
  );
  const candidateCount = [
    'canonicalTenantIdCandidate',
    'tenantSlugCandidate',
    'resourceTenantReference',
  ].filter((key) => hasDefined(record, key)).length;
  if (candidateCount !== 1) {
    return failContract('INVALID_SELECTOR');
  }
  if (selectionStrategy === 'EXPLICIT_CANONICAL_ID') {
    if (!hasDefined(record, 'canonicalTenantIdCandidate')) {
      return failContract('INVALID_SELECTOR');
    }
    const canonicalTenantIdCandidate = requireCanonicalIdentifier(
      record.canonicalTenantIdCandidate,
      'INVALID_SELECTOR',
    );
    if (canonicalTenantIdCandidate.toLowerCase() === 'aura_root') {
      return failContract('INVALID_SELECTOR');
    }
    return Object.freeze({
      schemaVersion,
      hintClassification,
      selectionStrategy,
      canonicalTenantIdCandidate,
    });
  }
  if (selectionStrategy === 'EXPLICIT_SLUG') {
    if (!hasDefined(record, 'tenantSlugCandidate')) {
      return failContract('INVALID_SELECTOR');
    }
    return Object.freeze({
      schemaVersion,
      hintClassification,
      selectionStrategy,
      tenantSlugCandidate: requireTenantSlug(
        record.tenantSlugCandidate,
        'INVALID_SELECTOR',
      ),
    });
  }
  if (!hasDefined(record, 'resourceTenantReference')) {
    return failContract('INVALID_SELECTOR');
  }
  return Object.freeze({
    schemaVersion,
    hintClassification,
    selectionStrategy,
    resourceTenantReference: requireCanonicalReference(
      record.resourceTenantReference,
      'INVALID_SELECTOR',
    ),
  });
}

export function validateServerOwnedTenantMembershipRecordV1(
  value: unknown,
): ServerOwnedTenantMembershipRecordV1 {
  const record = getClosedRecord(
    value,
    [
      'schemaVersion',
      'membershipId',
      'principalType',
      'principalId',
      'tenantId',
      'roles',
      'status',
      'membershipVersion',
      'createdAt',
      'updatedAt',
      'revokedAt',
      'authorityVersion',
    ],
    'INVALID_MEMBERSHIP',
  );
  const principalType = requireEnumValue(
    record.principalType,
    TRUSTED_SERVER_PRINCIPAL_TYPES,
    'INVALID_MEMBERSHIP',
  );
  const tenantId = requireCanonicalIdentifier(
    record.tenantId,
    'INVALID_MEMBERSHIP',
  );
  if (tenantId.toLowerCase() === 'aura_root') {
    return failContract('INVALID_MEMBERSHIP');
  }
  const status = requireEnumValue(
    record.status,
    SERVER_OWNED_TENANT_MEMBERSHIP_STATUSES,
    'INVALID_MEMBERSHIP',
  );
  const createdAt = requireCanonicalTimestamp(
    record.createdAt,
    'INVALID_MEMBERSHIP',
  );
  const updatedAt = requireCanonicalTimestamp(
    record.updatedAt,
    'INVALID_MEMBERSHIP',
  );
  requireTimestampOrder(createdAt, updatedAt, true, 'INVALID_MEMBERSHIP');
  const revokedAt =
    record.revokedAt === undefined
      ? undefined
      : requireCanonicalTimestamp(record.revokedAt, 'INVALID_MEMBERSHIP');
  if (
    ((status === 'REVOKED' || status === 'DELETED') &&
      revokedAt === undefined) ||
    ((status === 'ACTIVE' || status === 'SUSPENDED') &&
      revokedAt !== undefined)
  ) {
    return failContract('INVALID_MEMBERSHIP');
  }
  if (revokedAt !== undefined) {
    requireTimestampOrder(createdAt, revokedAt, true, 'INVALID_MEMBERSHIP');
    requireTimestampOrder(revokedAt, updatedAt, true, 'INVALID_MEMBERSHIP');
  }
  return Object.freeze({
    schemaVersion: requireExactLiteral(
      record.schemaVersion,
      SERVER_OWNED_TENANT_MEMBERSHIP_VERSION,
      'INVALID_MEMBERSHIP',
    ),
    membershipId: requireCanonicalIdentifier(
      record.membershipId,
      'INVALID_MEMBERSHIP',
    ),
    principalType,
    principalId: requireCanonicalIdentifier(
      record.principalId,
      'INVALID_MEMBERSHIP',
    ),
    tenantId,
    roles: validateRoles(record.roles, principalType),
    status,
    membershipVersion: requireNonEmptyVersion(
      record.membershipVersion,
      'INVALID_MEMBERSHIP',
    ),
    createdAt,
    updatedAt,
    ...(revokedAt === undefined ? {} : { revokedAt }),
    authorityVersion: requireNonEmptyVersion(
      record.authorityVersion,
      'INVALID_MEMBERSHIP',
    ),
  });
}

export function validateResolverInvocationIdentityV1(
  value: unknown,
): ResolverInvocationIdentityV1 {
  const record = getClosedRecord(
    value,
    [
      'schemaVersion',
      'invocationId',
      'invokerType',
      'invokerId',
      'invokedAt',
      'resolverVersion',
    ],
    'INVALID_RESOLUTION',
  );
  return Object.freeze({
    schemaVersion: requireExactLiteral(
      record.schemaVersion,
      IDENTITY_RESOLUTION_CONTRACT_VERSION,
      'INVALID_RESOLUTION',
    ),
    invocationId: requireCanonicalIdentifier(
      record.invocationId,
      'INVALID_RESOLUTION',
    ),
    invokerType: requireExactLiteral(
      record.invokerType,
      'SERVER_COMPONENT',
      'INVALID_RESOLUTION',
    ),
    invokerId: requireCanonicalIdentifier(
      record.invokerId,
      'INVALID_RESOLUTION',
    ),
    invokedAt: requireCanonicalTimestamp(
      record.invokedAt,
      'INVALID_RESOLUTION',
    ),
    resolverVersion: requireNonEmptyVersion(
      record.resolverVersion,
      'INVALID_RESOLUTION',
    ),
  });
}

export function validateNeutralAuthenticationContextV1(
  value: unknown,
): NeutralAuthenticationContextV1 {
  const record = getClosedRecord(
    value,
    [
      'schemaVersion',
      'transport',
      'authenticationEventId',
      'audience',
      'issuer',
    ],
    'INVALID_RESOLUTION',
  );
  const authenticationEventId = requireOptionalCanonicalReference(
    record.authenticationEventId,
    'INVALID_RESOLUTION',
  );
  const audience = requireOptionalCanonicalReference(
    record.audience,
    'INVALID_RESOLUTION',
  );
  const issuer = requireOptionalCanonicalReference(
    record.issuer,
    'INVALID_RESOLUTION',
  );
  return Object.freeze({
    schemaVersion: requireExactLiteral(
      record.schemaVersion,
      IDENTITY_RESOLUTION_CONTRACT_VERSION,
      'INVALID_RESOLUTION',
    ),
    transport: requireEnumValue(
      record.transport,
      NEUTRAL_AUTHENTICATION_TRANSPORTS,
      'INVALID_RESOLUTION',
    ),
    ...(authenticationEventId === undefined ? {} : { authenticationEventId }),
    ...(audience === undefined ? {} : { audience }),
    ...(issuer === undefined ? {} : { issuer }),
  });
}

export function validatePrincipalResolutionInputV1(
  value: unknown,
): PrincipalResolutionInputV1 {
  const record = getClosedRecord(
    value,
    [
      'schemaVersion',
      'verifiedSubject',
      'resolverInvocation',
      'authenticationContext',
    ],
    'INVALID_RESOLUTION',
  );
  const authenticationContext =
    record.authenticationContext === undefined
      ? undefined
      : validateNeutralAuthenticationContextV1(record.authenticationContext);
  const verifiedSubject = validateVerifiedAuthenticationSubjectV1(
    record.verifiedSubject,
  );
  const resolverInvocation = validateResolverInvocationIdentityV1(
    record.resolverInvocation,
  );
  requireTimestampOrder(
    verifiedSubject.revocationCheckedAt,
    resolverInvocation.invokedAt,
    true,
    'INVALID_RESOLUTION',
  );
  requireTimestampOrder(
    resolverInvocation.invokedAt,
    verifiedSubject.tokenExpiresAt,
    false,
    'INVALID_RESOLUTION',
  );
  return Object.freeze({
    schemaVersion: requireExactLiteral(
      record.schemaVersion,
      IDENTITY_RESOLUTION_CONTRACT_VERSION,
      'INVALID_RESOLUTION',
    ),
    verifiedSubject,
    resolverInvocation,
    ...(authenticationContext === undefined ? {} : { authenticationContext }),
  });
}

export function validateTenantMembershipResolutionInputV1(
  value: unknown,
): TenantMembershipResolutionInputV1 {
  const record = getClosedRecord(
    value,
    [
      'schemaVersion',
      'trustedPrincipal',
      'tenantSelector',
      'consumerId',
      'source',
      'resourceScope',
      'resolverInvocation',
    ],
    'INVALID_RESOLUTION',
  );
  let resourceScope: TenantMembershipResolutionInputV1['resourceScope'];
  try {
    resourceScope = validateTrustedResourceScopeV1(record.resourceScope);
  } catch {
    return failContract('INVALID_RESOLUTION');
  }
  if (resourceScope.schemaVersion !== TRUSTED_RESOLVER_INPUT_VERSION) {
    return failContract('INVALID_RESOLUTION');
  }
  const trustedPrincipal = safelyValidateTrustedPrincipal(
    record.trustedPrincipal,
  );
  const resolverInvocation = validateResolverInvocationIdentityV1(
    record.resolverInvocation,
  );
  requireTimestampOrder(
    trustedPrincipal.authenticatedAt,
    resolverInvocation.invokedAt,
    true,
    'INVALID_RESOLUTION',
  );
  return Object.freeze({
    schemaVersion: requireExactLiteral(
      record.schemaVersion,
      IDENTITY_RESOLUTION_CONTRACT_VERSION,
      'INVALID_RESOLUTION',
    ),
    trustedPrincipal,
    tenantSelector: validateTenantSelectorHintV1(record.tenantSelector),
    consumerId: requireCanonicalIdentifier(
      record.consumerId,
      'INVALID_RESOLUTION',
    ),
    source: requireCanonicalIdentifier(
      record.source,
      'INVALID_RESOLUTION',
    ),
    resourceScope,
    resolverInvocation,
  });
}

export function validatePrincipalResolutionResultV1(
  value: unknown,
): PrincipalResolutionResultV1 {
  const record = getClosedRecord(
    value,
    [
      'schemaVersion',
      'status',
      'principal',
      'bindingVersion',
      'reasonCode',
      'resolverVersion',
      'resolvedAt',
    ],
    'INVALID_RESOLUTION',
  );
  const schemaVersion = requireExactLiteral(
    record.schemaVersion,
    IDENTITY_RESOLUTION_CONTRACT_VERSION,
    'INVALID_RESOLUTION',
  );
  const resolverVersion = requireNonEmptyVersion(
    record.resolverVersion,
    'INVALID_RESOLUTION',
  );
  const resolvedAt = requireCanonicalTimestamp(
    record.resolvedAt,
    'INVALID_RESOLUTION',
  );
  if (record.status === 'RESOLVED') {
    if (
      !hasDefined(record, 'principal') ||
      !hasDefined(record, 'bindingVersion') ||
      hasDefined(record, 'reasonCode')
    ) {
      return failContract('INVALID_RESOLUTION');
    }
    const principal = safelyValidateTrustedPrincipal(record.principal);
    requireTimestampOrder(
      principal.authenticatedAt,
      resolvedAt,
      true,
      'INVALID_RESOLUTION',
    );
    return Object.freeze({
      schemaVersion,
      status: 'RESOLVED',
      principal,
      bindingVersion: requireNonEmptyVersion(
        record.bindingVersion,
        'INVALID_RESOLUTION',
      ),
      resolverVersion,
      resolvedAt,
    });
  }
  if (
    record.status !== 'REJECTED' ||
    hasDefined(record, 'principal') ||
    hasDefined(record, 'bindingVersion') ||
    !hasDefined(record, 'reasonCode')
  ) {
    return failContract('INVALID_RESOLUTION');
  }
  return Object.freeze({
    schemaVersion,
    status: 'REJECTED',
    reasonCode: requireEnumValue(
      record.reasonCode,
      PRINCIPAL_RESOLUTION_REJECTION_REASONS,
      'INVALID_RESOLUTION',
    ),
    resolverVersion,
    resolvedAt,
  });
}

export function validateTenantMembershipResolutionResultV1(
  value: unknown,
): TenantMembershipResolutionResultV1 {
  const record = getClosedRecord(
    value,
    [
      'schemaVersion',
      'status',
      'tenant',
      'membership',
      'membershipVersion',
      'reasonCode',
      'resolverVersion',
      'resolvedAt',
    ],
    'INVALID_RESOLUTION',
  );
  const schemaVersion = requireExactLiteral(
    record.schemaVersion,
    IDENTITY_RESOLUTION_CONTRACT_VERSION,
    'INVALID_RESOLUTION',
  );
  const resolverVersion = requireNonEmptyVersion(
    record.resolverVersion,
    'INVALID_RESOLUTION',
  );
  const resolvedAt = requireCanonicalTimestamp(
    record.resolvedAt,
    'INVALID_RESOLUTION',
  );
  if (record.status === 'RESOLVED') {
    if (
      !hasDefined(record, 'tenant') ||
      !hasDefined(record, 'membership') ||
      !hasDefined(record, 'membershipVersion') ||
      hasDefined(record, 'reasonCode')
    ) {
      return failContract('INVALID_RESOLUTION');
    }
    const tenant = validateCanonicalTenantAuthorityV1(record.tenant);
    const membership = safelyValidateTrustedMembership(record.membership);
    if (tenant.tenantId !== membership.tenantId) {
      return failContract('TENANT_MISMATCH');
    }
    requireTimestampOrder(
      tenant.resolvedAt,
      resolvedAt,
      true,
      'INVALID_RESOLUTION',
    );
    requireTimestampOrder(
      membership.resolvedAt,
      resolvedAt,
      true,
      'INVALID_RESOLUTION',
    );
    return Object.freeze({
      schemaVersion,
      status: 'RESOLVED',
      tenant,
      membership,
      membershipVersion: requireNonEmptyVersion(
        record.membershipVersion,
        'INVALID_RESOLUTION',
      ),
      resolverVersion,
      resolvedAt,
    });
  }
  if (
    (record.status !== 'REJECTED' && record.status !== 'AMBIGUOUS') ||
    hasDefined(record, 'tenant') ||
    hasDefined(record, 'membership') ||
    hasDefined(record, 'membershipVersion') ||
    !hasDefined(record, 'reasonCode')
  ) {
    return failContract('INVALID_RESOLUTION');
  }
  const reasonCode = requireEnumValue(
    record.reasonCode,
    TENANT_MEMBERSHIP_RESOLUTION_REASONS,
    'INVALID_RESOLUTION',
  );
  if (
    record.status === 'AMBIGUOUS' &&
    reasonCode !== 'TENANT_AMBIGUOUS' &&
    reasonCode !== 'MEMBERSHIP_DUPLICATE'
  ) {
    return failContract('INVALID_RESOLUTION');
  }
  if (
    record.status === 'REJECTED' &&
    (reasonCode === 'TENANT_AMBIGUOUS' ||
      reasonCode === 'MEMBERSHIP_DUPLICATE')
  ) {
    return failContract('INVALID_RESOLUTION');
  }
  return Object.freeze({
    schemaVersion,
    status: record.status,
    reasonCode,
    resolverVersion,
    resolvedAt,
  });
}

export function validateIdentityClaimsProjectionV1(
  value: unknown,
): IdentityClaimsProjectionV1 {
  const record = getClosedRecord(
    value,
    [
      'schemaVersion',
      'classification',
      'authorityUse',
      'principalType',
      'canonicalPrincipalId',
      'projectionVersion',
      'sourceBindingVersion',
      'issuedAt',
      'expiresAt',
      'claimsFingerprint',
      'tenantId',
      'roles',
    ],
    'CLAIMS_NOT_AUTHORITY',
  );
  const principalType = requireEnumValue(
    record.principalType,
    TRUSTED_SERVER_PRINCIPAL_TYPES,
    'CLAIMS_NOT_AUTHORITY',
  );
  const issuedAt = requireCanonicalTimestamp(
    record.issuedAt,
    'CLAIMS_NOT_AUTHORITY',
  );
  const expiresAt = requireCanonicalTimestamp(
    record.expiresAt,
    'CLAIMS_NOT_AUTHORITY',
  );
  requireTimestampOrder(issuedAt, expiresAt, false, 'CLAIMS_NOT_AUTHORITY');
  const tenantId =
    record.tenantId === undefined
      ? undefined
      : requireCanonicalIdentifier(record.tenantId, 'CLAIMS_NOT_AUTHORITY');
  const roles =
    record.roles === undefined
      ? undefined
      : validateRoles(record.roles, principalType);
  if ((tenantId === undefined) !== (roles === undefined)) {
    return failContract('CLAIMS_NOT_AUTHORITY');
  }
  const claimsFingerprint = requireOptionalFingerprint(
    record.claimsFingerprint,
    'CLAIMS_NOT_AUTHORITY',
  );
  return Object.freeze({
    schemaVersion: requireExactLiteral(
      record.schemaVersion,
      IDENTITY_CLAIMS_PROJECTION_VERSION,
      'CLAIMS_NOT_AUTHORITY',
    ),
    classification: requireExactLiteral(
      record.classification,
      'DERIVED',
      'CLAIMS_NOT_AUTHORITY',
    ),
    authorityUse: requireExactLiteral(
      record.authorityUse,
      'PROHIBITED',
      'CLAIMS_NOT_AUTHORITY',
    ),
    principalType,
    canonicalPrincipalId: requireCanonicalIdentifier(
      record.canonicalPrincipalId,
      'CLAIMS_NOT_AUTHORITY',
    ),
    projectionVersion: requireNonEmptyVersion(
      record.projectionVersion,
      'CLAIMS_NOT_AUTHORITY',
    ),
    sourceBindingVersion: requireNonEmptyVersion(
      record.sourceBindingVersion,
      'CLAIMS_NOT_AUTHORITY',
    ),
    issuedAt,
    expiresAt,
    ...(claimsFingerprint === undefined ? {} : { claimsFingerprint }),
    ...(tenantId === undefined ? {} : { tenantId }),
    ...(roles === undefined ? {} : { roles }),
  });
}
