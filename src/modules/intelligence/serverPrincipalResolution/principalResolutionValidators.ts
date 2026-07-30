import {
  AuthorityPrincipalValidationError,
  type AuthorityPrincipalContractIssue,
} from './principalResolutionErrors';
import {
  AUTHORITY_APP_CHECK_EVIDENCE_STATUSES,
  AUTHORITY_APP_CHECK_EVIDENCE_VERSION,
  AUTHORITY_AUTHENTICATION_ASSURANCE_LEVELS,
  AUTHORITY_AUTHENTICATION_ASSURANCE_VERSION,
  AUTHORITY_AUTHENTICATION_BINDING_VERSION,
  AUTHORITY_AUTHENTICATION_CLAIMS_SNAPSHOT_VERSION,
  AUTHORITY_AUTHENTICATION_METHODS,
  AUTHORITY_FIREBASE_AUTH_PROVIDERS,
  AUTHORITY_PRINCIPAL_AUTHENTICATION_SOURCES,
  AUTHORITY_PRINCIPAL_BINDING_SOURCES,
  AUTHORITY_PRINCIPAL_FRESHNESS_VERSION,
  AUTHORITY_PRINCIPAL_ID_BINDING_VERSION,
  AUTHORITY_PRINCIPAL_RESOLUTION_CHANNELS,
  AUTHORITY_PRINCIPAL_RESOLUTION_CONTEXT_VERSION,
  AUTHORITY_PRINCIPAL_RESOLUTION_EVIDENCE_VERSION,
  AUTHORITY_PRINCIPAL_RESOLUTION_REASON_CODES,
  AUTHORITY_PRINCIPAL_RESOLUTION_REQUEST_VERSION,
  AUTHORITY_PRINCIPAL_RESOLUTION_RESULT_VERSION,
  AUTHORITY_PRINCIPAL_RESOLUTION_SCHEMA_VERSION,
  AUTHORITY_PRINCIPAL_RESOLUTION_STATUSES,
  AUTHORITY_PRINCIPAL_RETRY_DISPOSITIONS,
  AUTHORITY_PRINCIPAL_STATUSES,
  AUTHORITY_PRINCIPAL_TYPES,
  AUTHORITY_RESOLVED_PRINCIPAL_VERSION,
  AUTHORITY_REVOCATION_CHECK_STATUSES,
  type AuthorityAppCheckEvidenceV1,
  type AuthorityAuthenticationAssuranceV1,
  type AuthorityAuthenticationBindingV1,
  type AuthorityAuthenticationClaimsSnapshotV1,
  type AuthorityAuthenticationMethod,
  type AuthorityCanonicalPrincipalIdBindingV1,
  type AuthorityFirebasePrincipalResolutionRequestV1,
  type AuthorityFirebaseUserAuthenticationBindingV1,
  type AuthorityIamPrincipalResolutionRequestV1,
  type AuthorityIamServiceAuthenticationBindingV1,
  type AuthorityMigrationAuthenticationBindingV1,
  type AuthorityMigrationPrincipalResolutionRequestV1,
  type AuthorityPrincipalFreshnessV1,
  type AuthorityPrincipalResolutionContextV1,
  type AuthorityPrincipalResolutionEvidenceV1,
  type AuthorityPrincipalResolutionRequestV1,
  type AuthorityPrincipalResolutionResultV1,
  type AuthorityPrincipalResolutionSafeMetadataV1,
  type AuthorityPrincipalType,
  type AuthoritySupportAuthenticationBindingV1,
  type AuthoritySupportPrincipalResolutionRequestV1,
  type AuthoritySystemAuthenticationBindingV1,
  type AuthoritySystemPrincipalResolutionRequestV1,
  type ResolvedAuthorityPrincipalV1,
  type ResolvedHumanAuthorityPrincipalV1,
  type ResolvedInternalServicePrincipalV1,
  type ResolvedMigrationActorPrincipalV1,
  type ResolvedSupportOperatorPrincipalV1,
  type ResolvedSystemActorPrincipalV1,
} from './principalResolutionTypes';

type PlainRecord = Record<string, unknown>;

const PRINCIPAL_PREFIXES: Readonly<Record<AuthorityPrincipalType, string>> =
  Object.freeze({
    HUMAN_USER: 'apr_v1_human_',
    INTERNAL_SERVICE: 'apr_v1_service_',
    SYSTEM_ACTOR: 'apr_v1_system_',
    MIGRATION_ACTOR: 'apr_v1_migration_',
    SUPPORT_OPERATOR: 'apr_v1_support_',
  });

function fail(
  issue: AuthorityPrincipalContractIssue,
  field?: string,
): never {
  throw new AuthorityPrincipalValidationError(issue, field);
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
  issue: AuthorityPrincipalContractIssue,
  field?: string,
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
    !/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(value)
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
    !Number.isInteger(value) ||
    value < 1 ||
    value > 86_400
  ) {
    return fail('INVALID_DURATION', field);
  }
  return value;
}

function booleanValue(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') {
    return fail('INVALID_LITERAL', field);
  }
  return value;
}

function reference(
  value: unknown,
  field: string,
  maximum = 512,
): string {
  const containsControlCharacter =
    typeof value === 'string' &&
    Array.from(value).some((character) => {
      const codePoint = character.codePointAt(0);
      return codePoint !== undefined && (codePoint <= 31 || codePoint === 127);
    });
  if (
    typeof value !== 'string' ||
    value.length < 3 ||
    value.length > maximum ||
    value.trim() !== value ||
    /\s/.test(value) ||
    containsControlCharacter ||
    value.includes('..')
  ) {
    return fail('INVALID_REFERENCE', field);
  }
  return value;
}

function assertOptionalEqual(
  values: readonly (string | undefined)[],
  field: string,
): void {
  const defined = values.filter(
    (value): value is string => value !== undefined,
  );
  if (
    defined.length > 1 &&
    defined.some((value) => value !== defined[0])
  ) {
    fail('INVALID_RESOLVED_PRINCIPAL', field);
  }
}

export function validateAuthorityPrincipalIdV1(
  value: unknown,
  principalType: AuthorityPrincipalType,
): string {
  const principalId = identifier(value, 'principalId', 16, 160);
  if (!principalId.startsWith(PRINCIPAL_PREFIXES[principalType])) {
    return fail('INVALID_PRINCIPAL_ID', 'principalId');
  }
  return principalId;
}

export function validateAuthorityFirebaseUidV1(value: unknown): string {
  if (
    typeof value !== 'string' ||
    value.length < 6 ||
    value.length > 128 ||
    value.trim() !== value ||
    !/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(value)
  ) {
    return fail('INVALID_FIREBASE_UID', 'firebaseUid');
  }
  return value;
}

export function validateAuthorityPlatformUserIdV1(value: unknown): string {
  try {
    return identifier(value, 'platformUserId');
  } catch {
    return fail('INVALID_PLATFORM_USER_ID', 'platformUserId');
  }
}

export function validateAuthorityServicePrincipalIdV1(
  value: unknown,
): string {
  try {
    return identifier(value, 'servicePrincipalId');
  } catch {
    return fail('INVALID_SERVICE_PRINCIPAL', 'servicePrincipalId');
  }
}

export function validateAuthorityTimestampV1(
  value: unknown,
): string {
  return canonicalTimestamp(value, 'timestamp');
}

export function validateAuthorityAuthenticationMethodV1(
  value: unknown,
): AuthorityAuthenticationMethod {
  return enumValue(
    value,
    AUTHORITY_AUTHENTICATION_METHODS,
    'authenticationMethod',
  );
}

export function validateAuthorityAppCheckEvidenceV1(
  value: unknown,
): AuthorityAppCheckEvidenceV1 {
  const discriminator = closedRecord(
    value,
    [
      'schemaVersion',
      'status',
      'applicationIdHash',
      'attestationProvider',
      'verifiedAt',
      'replayProtection',
      'reason',
    ],
    'INVALID_APP_CHECK_EVIDENCE',
    'appCheckEvidence',
  );
  const status = enumValue(
    discriminator.status,
    AUTHORITY_APP_CHECK_EVIDENCE_STATUSES,
    'appCheckEvidence.status',
  );
  if (status === 'REQUIRED_AND_VALID') {
    const record = closedRecord(
      value,
      [
        'schemaVersion',
        'status',
        'applicationIdHash',
        'attestationProvider',
        'verifiedAt',
        'replayProtection',
      ],
      'INVALID_APP_CHECK_EVIDENCE',
      'appCheckEvidence',
    );
    return Object.freeze({
      schemaVersion: literal(
        record.schemaVersion,
        AUTHORITY_APP_CHECK_EVIDENCE_VERSION,
        'appCheckEvidence.schemaVersion',
      ),
      status,
      applicationIdHash: fingerprint(
        record.applicationIdHash,
        'appCheckEvidence.applicationIdHash',
      ),
      attestationProvider: identifier(
        record.attestationProvider,
        'appCheckEvidence.attestationProvider',
      ),
      verifiedAt: canonicalTimestamp(
        record.verifiedAt,
        'appCheckEvidence.verifiedAt',
      ),
      replayProtection: literal(
        record.replayProtection,
        'ENFORCED',
        'appCheckEvidence.replayProtection',
      ),
    });
  }
  const record = closedRecord(
    value,
    ['schemaVersion', 'status', 'reason'],
    'INVALID_APP_CHECK_EVIDENCE',
    'appCheckEvidence',
  );
  const schemaVersion = literal(
    record.schemaVersion,
    AUTHORITY_APP_CHECK_EVIDENCE_VERSION,
    'appCheckEvidence.schemaVersion',
  );
  if (status === 'NOT_APPLICABLE_INTERNAL_CALLER') {
    return Object.freeze({
      schemaVersion,
      status,
      reason: literal(
        record.reason,
        'NON_APP_CALLER',
        'appCheckEvidence.reason',
      ),
    });
  }
  return Object.freeze({
    schemaVersion,
    status,
    reason: literal(
      record.reason,
      'PRE_RESOLUTION_ONLY',
      'appCheckEvidence.reason',
    ),
  });
}

export function validateAuthorityAuthenticationAssuranceV1(
  value: unknown,
): AuthorityAuthenticationAssuranceV1 {
  const record = closedRecord(
    value,
    [
      'schemaVersion',
      'level',
      'authenticationMethod',
      'authenticatedAt',
      'freshnessWindowSeconds',
      'secondFactorSatisfied',
      'appCheckEvidence',
      'tokenRevocationChecked',
      'issuerValidated',
      'audienceValidated',
    ],
    'INVALID_ASSURANCE',
    'assurance',
  );
  const appCheckEvidence = validateAuthorityAppCheckEvidenceV1(
    record.appCheckEvidence,
  );
  return Object.freeze({
    schemaVersion: literal(
      record.schemaVersion,
      AUTHORITY_AUTHENTICATION_ASSURANCE_VERSION,
      'assurance.schemaVersion',
    ),
    level: enumValue(
      record.level,
      AUTHORITY_AUTHENTICATION_ASSURANCE_LEVELS,
      'assurance.level',
    ),
    authenticationMethod: validateAuthorityAuthenticationMethodV1(
      record.authenticationMethod,
    ),
    authenticatedAt: canonicalTimestamp(
      record.authenticatedAt,
      'assurance.authenticatedAt',
    ),
    freshnessWindowSeconds: boundedSeconds(
      record.freshnessWindowSeconds,
      'assurance.freshnessWindowSeconds',
    ),
    secondFactorSatisfied: booleanValue(
      record.secondFactorSatisfied,
      'assurance.secondFactorSatisfied',
    ),
    appCheckEvidence,
    tokenRevocationChecked: booleanValue(
      record.tokenRevocationChecked,
      'assurance.tokenRevocationChecked',
    ),
    issuerValidated: booleanValue(
      record.issuerValidated,
      'assurance.issuerValidated',
    ),
    audienceValidated: booleanValue(
      record.audienceValidated,
      'assurance.audienceValidated',
    ),
  });
}

export function validateAuthorityAuthenticationClaimsSnapshotV1(
  value: unknown,
): AuthorityAuthenticationClaimsSnapshotV1 {
  const record = closedRecord(
    value,
    [
      'schemaVersion',
      'claimsVersion',
      'tokenIssuedAt',
      'tokenAuthTime',
      'tokenExpiresAt',
      'issuer',
      'audience',
      'subjectFingerprint',
      'snapshotFingerprint',
    ],
    'INVALID_CLAIMS_SNAPSHOT',
    'claimsSnapshot',
  );
  const tokenIssuedAt = canonicalTimestamp(
    record.tokenIssuedAt,
    'claimsSnapshot.tokenIssuedAt',
  );
  const tokenAuthTime = canonicalTimestamp(
    record.tokenAuthTime,
    'claimsSnapshot.tokenAuthTime',
  );
  const tokenExpiresAt = canonicalTimestamp(
    record.tokenExpiresAt,
    'claimsSnapshot.tokenExpiresAt',
  );
  assertTimeOrder(
    tokenAuthTime,
    tokenIssuedAt,
    true,
    'claimsSnapshot.tokenAuthTime',
  );
  assertTimeOrder(
    tokenIssuedAt,
    tokenExpiresAt,
    false,
    'claimsSnapshot.tokenExpiresAt',
  );
  return Object.freeze({
    schemaVersion: literal(
      record.schemaVersion,
      AUTHORITY_AUTHENTICATION_CLAIMS_SNAPSHOT_VERSION,
      'claimsSnapshot.schemaVersion',
    ),
    ...(record.claimsVersion === undefined
      ? {}
      : {
          claimsVersion: version(
            record.claimsVersion,
            'claimsSnapshot.claimsVersion',
          ),
        }),
    tokenIssuedAt,
    tokenAuthTime,
    tokenExpiresAt,
    issuer: reference(record.issuer, 'claimsSnapshot.issuer'),
    audience: reference(record.audience, 'claimsSnapshot.audience'),
    subjectFingerprint: fingerprint(
      record.subjectFingerprint,
      'claimsSnapshot.subjectFingerprint',
    ),
    snapshotFingerprint: fingerprint(
      record.snapshotFingerprint,
      'claimsSnapshot.snapshotFingerprint',
    ),
  });
}

function bindingBase(record: PlainRecord): {
  readonly schemaVersion: typeof AUTHORITY_AUTHENTICATION_BINDING_VERSION;
  readonly bindingId: string;
  readonly bindingVersion: string;
} {
  return {
    schemaVersion: literal(
      record.schemaVersion,
      AUTHORITY_AUTHENTICATION_BINDING_VERSION,
      'authenticationBinding.schemaVersion',
    ),
    bindingId: identifier(
      record.bindingId,
      'authenticationBinding.bindingId',
    ),
    bindingVersion: version(
      record.bindingVersion,
      'authenticationBinding.bindingVersion',
    ),
  };
}

function validateFirebaseBinding(
  value: unknown,
): AuthorityFirebaseUserAuthenticationBindingV1 {
  const record = closedRecord(
    value,
    [
      'schemaVersion',
      'bindingType',
      'bindingId',
      'bindingVersion',
      'authenticationMethod',
      'firebaseUid',
      'platformUserId',
      'tokenIssuedAt',
      'tokenAuthTime',
      'authProvider',
      'tokenIdHash',
      'claimsVersion',
    ],
    'INVALID_AUTHENTICATION_BINDING',
    'authenticationBinding',
  );
  const tokenIssuedAt = canonicalTimestamp(
    record.tokenIssuedAt,
    'authenticationBinding.tokenIssuedAt',
  );
  const tokenAuthTime = canonicalTimestamp(
    record.tokenAuthTime,
    'authenticationBinding.tokenAuthTime',
  );
  assertTimeOrder(
    tokenAuthTime,
    tokenIssuedAt,
    true,
    'authenticationBinding.tokenAuthTime',
  );
  return Object.freeze({
    ...bindingBase(record),
    bindingType: literal(
      record.bindingType,
      'FIREBASE_USER',
      'authenticationBinding.bindingType',
    ),
    authenticationMethod: literal(
      record.authenticationMethod,
      'FIREBASE_ID_TOKEN',
      'authenticationBinding.authenticationMethod',
    ),
    firebaseUid: validateAuthorityFirebaseUidV1(record.firebaseUid),
    platformUserId: validateAuthorityPlatformUserIdV1(
      record.platformUserId,
    ),
    tokenIssuedAt,
    tokenAuthTime,
    authProvider: enumValue(
      record.authProvider,
      AUTHORITY_FIREBASE_AUTH_PROVIDERS,
      'authenticationBinding.authProvider',
    ),
    ...(record.tokenIdHash === undefined
      ? {}
      : {
          tokenIdHash: fingerprint(
            record.tokenIdHash,
            'authenticationBinding.tokenIdHash',
          ),
        }),
    ...(record.claimsVersion === undefined
      ? {}
      : {
          claimsVersion: version(
            record.claimsVersion,
            'authenticationBinding.claimsVersion',
          ),
        }),
  });
}

function validateIamBinding(
  value: unknown,
): AuthorityIamServiceAuthenticationBindingV1 {
  const record = closedRecord(
    value,
    [
      'schemaVersion',
      'bindingType',
      'bindingId',
      'bindingVersion',
      'authenticationMethod',
      'servicePrincipalId',
      'issuer',
      'subject',
      'audience',
      'issuedAt',
      'credentialIdHash',
    ],
    'INVALID_AUTHENTICATION_BINDING',
    'authenticationBinding',
  );
  return Object.freeze({
    ...bindingBase(record),
    bindingType: literal(
      record.bindingType,
      'IAM_SERVICE',
      'authenticationBinding.bindingType',
    ),
    authenticationMethod: enumValue(
      record.authenticationMethod,
      ['IAM_OIDC', 'SERVICE_ACCOUNT_ASSERTION'] as const,
      'authenticationBinding.authenticationMethod',
    ),
    servicePrincipalId: validateAuthorityServicePrincipalIdV1(
      record.servicePrincipalId,
    ),
    issuer: reference(record.issuer, 'authenticationBinding.issuer'),
    subject: reference(record.subject, 'authenticationBinding.subject'),
    audience: reference(
      record.audience,
      'authenticationBinding.audience',
    ),
    issuedAt: canonicalTimestamp(
      record.issuedAt,
      'authenticationBinding.issuedAt',
    ),
    ...(record.credentialIdHash === undefined
      ? {}
      : {
          credentialIdHash: fingerprint(
            record.credentialIdHash,
            'authenticationBinding.credentialIdHash',
          ),
        }),
  });
}

function validateSystemBinding(
  value: unknown,
): AuthoritySystemAuthenticationBindingV1 {
  const record = closedRecord(
    value,
    [
      'schemaVersion',
      'bindingType',
      'bindingId',
      'bindingVersion',
      'authenticationMethod',
      'systemActorId',
      'executionOrigin',
      'capabilityBindingId',
      'attestationFingerprint',
    ],
    'INVALID_AUTHENTICATION_BINDING',
    'authenticationBinding',
  );
  return Object.freeze({
    ...bindingBase(record),
    bindingType: literal(
      record.bindingType,
      'SYSTEM',
      'authenticationBinding.bindingType',
    ),
    authenticationMethod: literal(
      record.authenticationMethod,
      'INTERNAL_SYSTEM_CAPABILITY',
      'authenticationBinding.authenticationMethod',
    ),
    systemActorId: identifier(
      record.systemActorId,
      'authenticationBinding.systemActorId',
    ),
    executionOrigin: identifier(
      record.executionOrigin,
      'authenticationBinding.executionOrigin',
    ),
    capabilityBindingId: identifier(
      record.capabilityBindingId,
      'authenticationBinding.capabilityBindingId',
    ),
    attestationFingerprint: fingerprint(
      record.attestationFingerprint,
      'authenticationBinding.attestationFingerprint',
    ),
  });
}

function validateMigrationBinding(
  value: unknown,
): AuthorityMigrationAuthenticationBindingV1 {
  const record = closedRecord(
    value,
    [
      'schemaVersion',
      'bindingType',
      'bindingId',
      'bindingVersion',
      'authenticationMethod',
      'migrationId',
      'migrationRunId',
      'executionIdentity',
      'batchId',
      'attestationFingerprint',
    ],
    'INVALID_AUTHENTICATION_BINDING',
    'authenticationBinding',
  );
  return Object.freeze({
    ...bindingBase(record),
    bindingType: literal(
      record.bindingType,
      'MIGRATION',
      'authenticationBinding.bindingType',
    ),
    authenticationMethod: literal(
      record.authenticationMethod,
      'MIGRATION_CAPABILITY',
      'authenticationBinding.authenticationMethod',
    ),
    migrationId: identifier(
      record.migrationId,
      'authenticationBinding.migrationId',
    ),
    migrationRunId: identifier(
      record.migrationRunId,
      'authenticationBinding.migrationRunId',
    ),
    executionIdentity: identifier(
      record.executionIdentity,
      'authenticationBinding.executionIdentity',
    ),
    batchId: identifier(
      record.batchId,
      'authenticationBinding.batchId',
    ),
    attestationFingerprint: fingerprint(
      record.attestationFingerprint,
      'authenticationBinding.attestationFingerprint',
    ),
  });
}

function validateSupportBinding(
  value: unknown,
): AuthoritySupportAuthenticationBindingV1 {
  const record = closedRecord(
    value,
    [
      'schemaVersion',
      'bindingType',
      'bindingId',
      'bindingVersion',
      'authenticationMethod',
      'operatorId',
      'supportSessionId',
      'operatorAuthentication',
    ],
    'INVALID_AUTHENTICATION_BINDING',
    'authenticationBinding',
  );
  return Object.freeze({
    ...bindingBase(record),
    bindingType: literal(
      record.bindingType,
      'SUPPORT',
      'authenticationBinding.bindingType',
    ),
    authenticationMethod: literal(
      record.authenticationMethod,
      'SUPPORT_SESSION',
      'authenticationBinding.authenticationMethod',
    ),
    operatorId: identifier(
      record.operatorId,
      'authenticationBinding.operatorId',
    ),
    supportSessionId: identifier(
      record.supportSessionId,
      'authenticationBinding.supportSessionId',
    ),
    operatorAuthentication: validateFirebaseBinding(
      record.operatorAuthentication,
    ),
  });
}

export function validateAuthorityAuthenticationBindingV1(
  value: unknown,
): AuthorityAuthenticationBindingV1 {
  const record = closedRecord(
    value,
    [
      'schemaVersion',
      'bindingType',
      'bindingId',
      'bindingVersion',
      'authenticationMethod',
      'firebaseUid',
      'platformUserId',
      'tokenIssuedAt',
      'tokenAuthTime',
      'authProvider',
      'tokenIdHash',
      'claimsVersion',
      'servicePrincipalId',
      'issuer',
      'subject',
      'audience',
      'issuedAt',
      'credentialIdHash',
      'systemActorId',
      'executionOrigin',
      'capabilityBindingId',
      'attestationFingerprint',
      'migrationId',
      'migrationRunId',
      'executionIdentity',
      'batchId',
      'operatorId',
      'supportSessionId',
      'operatorAuthentication',
    ],
    'INVALID_AUTHENTICATION_BINDING',
    'authenticationBinding',
  );
  switch (record.bindingType) {
    case 'FIREBASE_USER':
      return validateFirebaseBinding(value);
    case 'IAM_SERVICE':
      return validateIamBinding(value);
    case 'SYSTEM':
      return validateSystemBinding(value);
    case 'MIGRATION':
      return validateMigrationBinding(value);
    case 'SUPPORT':
      return validateSupportBinding(value);
    default:
      return fail(
        'INVALID_AUTHENTICATION_BINDING',
        'authenticationBinding.bindingType',
      );
  }
}

export function validateAuthorityCanonicalPrincipalIdBindingV1(
  value: unknown,
): AuthorityCanonicalPrincipalIdBindingV1 {
  const record = closedRecord(
    value,
    [
      'schemaVersion',
      'bindingId',
      'bindingVersion',
      'principalType',
      'canonicalPrincipalId',
      'canonicalSubjectId',
      'status',
      'evidenceFingerprint',
    ],
    'INVALID_PRINCIPAL_BINDING',
    'principalBinding',
  );
  const principalType = enumValue(
    record.principalType,
    AUTHORITY_PRINCIPAL_TYPES,
    'principalBinding.principalType',
  );
  return Object.freeze({
    schemaVersion: literal(
      record.schemaVersion,
      AUTHORITY_PRINCIPAL_ID_BINDING_VERSION,
      'principalBinding.schemaVersion',
    ),
    bindingId: identifier(record.bindingId, 'principalBinding.bindingId'),
    bindingVersion: version(
      record.bindingVersion,
      'principalBinding.bindingVersion',
    ),
    principalType,
    canonicalPrincipalId: validateAuthorityPrincipalIdV1(
      record.canonicalPrincipalId,
      principalType,
    ),
    canonicalSubjectId: identifier(
      record.canonicalSubjectId,
      'principalBinding.canonicalSubjectId',
    ),
    status: literal(
      record.status,
      'ACTIVE',
      'principalBinding.status',
    ),
    evidenceFingerprint: fingerprint(
      record.evidenceFingerprint,
      'principalBinding.evidenceFingerprint',
    ),
  });
}

export function validateAuthorityPrincipalResolutionEvidenceV1(
  value: unknown,
): AuthorityPrincipalResolutionEvidenceV1 {
  const record = closedRecord(
    value,
    [
      'schemaVersion',
      'authenticationSource',
      'bindingSource',
      'canonicalBindingVersion',
      'claimsVersion',
      'claimsSnapshot',
      'revocationCheckStatus',
      'assuranceLevel',
      'resolverVersion',
      'resolvedAt',
      'evidenceFingerprint',
    ],
    'INVALID_RESOLUTION_EVIDENCE',
    'resolutionEvidence',
  );
  const resolvedAt = canonicalTimestamp(
    record.resolvedAt,
    'resolutionEvidence.resolvedAt',
  );
  const claimsSnapshot =
    record.claimsSnapshot === undefined
      ? undefined
      : validateAuthorityAuthenticationClaimsSnapshotV1(
          record.claimsSnapshot,
        );
  const claimsVersionValue =
    record.claimsVersion === undefined
      ? undefined
      : version(
          record.claimsVersion,
          'resolutionEvidence.claimsVersion',
        );
  if (
    claimsSnapshot !== undefined &&
    claimsSnapshot.claimsVersion !== claimsVersionValue
  ) {
    return fail(
      'INVALID_RESOLUTION_EVIDENCE',
      'resolutionEvidence.claimsVersion',
    );
  }
  if (claimsSnapshot !== undefined) {
    assertTimeOrder(
      claimsSnapshot.tokenIssuedAt,
      resolvedAt,
      true,
      'resolutionEvidence.claimsSnapshot.tokenIssuedAt',
    );
    assertTimeOrder(
      resolvedAt,
      claimsSnapshot.tokenExpiresAt,
      true,
      'resolutionEvidence.claimsSnapshot.tokenExpiresAt',
    );
  }
  return Object.freeze({
    schemaVersion: literal(
      record.schemaVersion,
      AUTHORITY_PRINCIPAL_RESOLUTION_EVIDENCE_VERSION,
      'resolutionEvidence.schemaVersion',
    ),
    authenticationSource: enumValue(
      record.authenticationSource,
      AUTHORITY_PRINCIPAL_AUTHENTICATION_SOURCES,
      'resolutionEvidence.authenticationSource',
    ),
    bindingSource: enumValue(
      record.bindingSource,
      AUTHORITY_PRINCIPAL_BINDING_SOURCES,
      'resolutionEvidence.bindingSource',
    ),
    canonicalBindingVersion: version(
      record.canonicalBindingVersion,
      'resolutionEvidence.canonicalBindingVersion',
    ),
    ...(claimsVersionValue === undefined
      ? {}
      : { claimsVersion: claimsVersionValue }),
    ...(claimsSnapshot === undefined ? {} : { claimsSnapshot }),
    revocationCheckStatus: enumValue(
      record.revocationCheckStatus,
      AUTHORITY_REVOCATION_CHECK_STATUSES,
      'resolutionEvidence.revocationCheckStatus',
    ),
    assuranceLevel: enumValue(
      record.assuranceLevel,
      AUTHORITY_AUTHENTICATION_ASSURANCE_LEVELS,
      'resolutionEvidence.assuranceLevel',
    ),
    resolverVersion: version(
      record.resolverVersion,
      'resolutionEvidence.resolverVersion',
    ),
    resolvedAt,
    evidenceFingerprint: fingerprint(
      record.evidenceFingerprint,
      'resolutionEvidence.evidenceFingerprint',
    ),
  });
}

export function validateAuthorityPrincipalFreshnessV1(
  value: unknown,
): AuthorityPrincipalFreshnessV1 {
  const record = closedRecord(
    value,
    [
      'schemaVersion',
      'resolvedAt',
      'validUntil',
      'sourceVersion',
      'claimsVersion',
      'bindingVersion',
      'revocationCheckedAt',
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
    return fail('INVALID_FRESHNESS', 'freshness.staleAfterSeconds');
  }
  const revocationCheckedAt =
    record.revocationCheckedAt === undefined
      ? undefined
      : canonicalTimestamp(
          record.revocationCheckedAt,
          'freshness.revocationCheckedAt',
        );
  if (revocationCheckedAt !== undefined) {
    assertTimeOrder(
      revocationCheckedAt,
      resolvedAt,
      true,
      'freshness.revocationCheckedAt',
    );
  }
  return Object.freeze({
    schemaVersion: literal(
      record.schemaVersion,
      AUTHORITY_PRINCIPAL_FRESHNESS_VERSION,
      'freshness.schemaVersion',
    ),
    resolvedAt,
    validUntil,
    sourceVersion: version(
      record.sourceVersion,
      'freshness.sourceVersion',
    ),
    ...(record.claimsVersion === undefined
      ? {}
      : {
          claimsVersion: version(
            record.claimsVersion,
            'freshness.claimsVersion',
          ),
        }),
    bindingVersion: version(
      record.bindingVersion,
      'freshness.bindingVersion',
    ),
    ...(revocationCheckedAt === undefined
      ? {}
      : { revocationCheckedAt }),
    staleAfterSeconds,
  });
}

function validateResolvedBase(
  value: unknown,
  variantKeys: readonly string[],
  expectedType: AuthorityPrincipalType,
): {
  readonly record: PlainRecord;
  readonly principalId: string;
  readonly status: (typeof AUTHORITY_PRINCIPAL_STATUSES)[number];
  readonly authenticationBinding: AuthorityAuthenticationBindingV1;
  readonly assurance: AuthorityAuthenticationAssuranceV1;
  readonly resolutionEvidence: AuthorityPrincipalResolutionEvidenceV1;
  readonly resolvedAt: string;
  readonly freshness: AuthorityPrincipalFreshnessV1;
} {
  const record = closedRecord(
    value,
    [
      'schemaVersion',
      'version',
      'principalId',
      'principalType',
      'status',
      'authenticationBinding',
      'assurance',
      'resolutionEvidence',
      'resolvedAt',
      'freshness',
      ...variantKeys,
    ],
    'INVALID_RESOLVED_PRINCIPAL',
    'principal',
  );
  literal(
    record.schemaVersion,
    AUTHORITY_PRINCIPAL_RESOLUTION_SCHEMA_VERSION,
    'principal.schemaVersion',
  );
  literal(
    record.version,
    AUTHORITY_RESOLVED_PRINCIPAL_VERSION,
    'principal.version',
  );
  literal(record.principalType, expectedType, 'principal.principalType');
  const authenticationBinding =
    validateAuthorityAuthenticationBindingV1(
      record.authenticationBinding,
    );
  const assurance = validateAuthorityAuthenticationAssuranceV1(
    record.assurance,
  );
  const resolutionEvidence =
    validateAuthorityPrincipalResolutionEvidenceV1(
      record.resolutionEvidence,
    );
  const resolvedAt = canonicalTimestamp(
    record.resolvedAt,
    'principal.resolvedAt',
  );
  const freshness = validateAuthorityPrincipalFreshnessV1(
    record.freshness,
  );
  if (
    authenticationBinding.authenticationMethod !==
      assurance.authenticationMethod ||
    assurance.level !== resolutionEvidence.assuranceLevel ||
    resolutionEvidence.canonicalBindingVersion !==
      authenticationBinding.bindingVersion ||
    freshness.bindingVersion !== authenticationBinding.bindingVersion ||
    freshness.resolvedAt !== resolvedAt ||
    resolutionEvidence.resolvedAt !== resolvedAt ||
    assurance.appCheckEvidence.status === 'NOT_EVALUATED'
  ) {
    fail('INVALID_RESOLVED_PRINCIPAL', 'principal');
  }
  assertTimeOrder(
    assurance.authenticatedAt,
    resolvedAt,
    true,
    'principal.resolvedAt',
  );
  const bindingClaims =
    authenticationBinding.bindingType === 'FIREBASE_USER'
      ? authenticationBinding.claimsVersion
      : authenticationBinding.bindingType === 'SUPPORT'
        ? authenticationBinding.operatorAuthentication.claimsVersion
        : undefined;
  assertOptionalEqual(
    [
      bindingClaims,
      resolutionEvidence.claimsVersion,
      resolutionEvidence.claimsSnapshot?.claimsVersion,
      freshness.claimsVersion,
    ],
    'principal.claimsVersion',
  );
  return {
    record,
    principalId: validateAuthorityPrincipalIdV1(
      record.principalId,
      expectedType,
    ),
    status: enumValue(
      record.status,
      AUTHORITY_PRINCIPAL_STATUSES,
      'principal.status',
    ),
    authenticationBinding,
    assurance,
    resolutionEvidence,
    resolvedAt,
    freshness,
  };
}

function assertAppCallerEvidence(
  base: ReturnType<typeof validateResolvedBase>,
): void {
  const firebaseBinding =
    base.authenticationBinding.bindingType === 'FIREBASE_USER'
      ? base.authenticationBinding
      : base.authenticationBinding.bindingType === 'SUPPORT'
        ? base.authenticationBinding.operatorAuthentication
        : undefined;
  const claimsSnapshot = base.resolutionEvidence.claimsSnapshot;
  if (
    firebaseBinding === undefined ||
    claimsSnapshot === undefined ||
    claimsSnapshot.tokenIssuedAt !== firebaseBinding.tokenIssuedAt ||
    claimsSnapshot.tokenAuthTime !== firebaseBinding.tokenAuthTime ||
    base.assurance.appCheckEvidence.status !== 'REQUIRED_AND_VALID' ||
    !base.assurance.tokenRevocationChecked ||
    !base.assurance.issuerValidated ||
    !base.assurance.audienceValidated ||
    base.resolutionEvidence.authenticationSource !== 'FIREBASE_AUTH' ||
    base.resolutionEvidence.revocationCheckStatus !== 'CHECKED_VALID'
  ) {
    fail('INVALID_RESOLVED_PRINCIPAL', 'principal.assurance');
  }
}

function assertInternalEvidence(
  base: ReturnType<typeof validateResolvedBase>,
  authenticationSource:
    | 'GOOGLE_CLOUD_IAM'
    | 'INTERNAL_CAPABILITY_REGISTRY'
    | 'MIGRATION_MANIFEST',
): void {
  if (
    base.assurance.appCheckEvidence.status !==
      'NOT_APPLICABLE_INTERNAL_CALLER' ||
    base.resolutionEvidence.authenticationSource !==
      authenticationSource ||
    base.resolutionEvidence.revocationCheckStatus !==
      'NOT_APPLICABLE_INTERNAL_CALLER'
  ) {
    fail('INVALID_RESOLVED_PRINCIPAL', 'principal.assurance');
  }
}

export function validateResolvedHumanAuthorityPrincipalV1(
  value: unknown,
): ResolvedHumanAuthorityPrincipalV1 {
  const base = validateResolvedBase(
    value,
    ['firebaseUid', 'platformUserId'],
    'HUMAN_USER',
  );
  if (base.authenticationBinding.bindingType !== 'FIREBASE_USER') {
    return fail(
      'INVALID_RESOLVED_PRINCIPAL',
      'principal.authenticationBinding',
    );
  }
  assertAppCallerEvidence(base);
  const firebaseUid = validateAuthorityFirebaseUidV1(
    base.record.firebaseUid,
  );
  const platformUserId = validateAuthorityPlatformUserIdV1(
    base.record.platformUserId,
  );
  if (
    firebaseUid !== base.authenticationBinding.firebaseUid ||
    platformUserId !== base.authenticationBinding.platformUserId
  ) {
    return fail('INVALID_RESOLVED_PRINCIPAL', 'principal');
  }
  return Object.freeze({
    schemaVersion: AUTHORITY_PRINCIPAL_RESOLUTION_SCHEMA_VERSION,
    version: AUTHORITY_RESOLVED_PRINCIPAL_VERSION,
    principalId: base.principalId,
    principalType: 'HUMAN_USER',
    firebaseUid,
    platformUserId,
    status: base.status,
    authenticationBinding: base.authenticationBinding,
    assurance: base.assurance,
    resolutionEvidence: base.resolutionEvidence,
    resolvedAt: base.resolvedAt,
    freshness: base.freshness,
  });
}

export function validateResolvedInternalServicePrincipalV1(
  value: unknown,
): ResolvedInternalServicePrincipalV1 {
  const base = validateResolvedBase(
    value,
    ['servicePrincipalId', 'serviceName'],
    'INTERNAL_SERVICE',
  );
  if (base.authenticationBinding.bindingType !== 'IAM_SERVICE') {
    return fail(
      'INVALID_RESOLVED_PRINCIPAL',
      'principal.authenticationBinding',
    );
  }
  assertInternalEvidence(base, 'GOOGLE_CLOUD_IAM');
  if (
    !base.assurance.issuerValidated ||
    !base.assurance.audienceValidated
  ) {
    return fail('INVALID_RESOLVED_PRINCIPAL', 'principal.assurance');
  }
  const servicePrincipalId = validateAuthorityServicePrincipalIdV1(
    base.record.servicePrincipalId,
  );
  if (
    servicePrincipalId !==
    base.authenticationBinding.servicePrincipalId
  ) {
    return fail('INVALID_RESOLVED_PRINCIPAL', 'principal');
  }
  return Object.freeze({
    schemaVersion: AUTHORITY_PRINCIPAL_RESOLUTION_SCHEMA_VERSION,
    version: AUTHORITY_RESOLVED_PRINCIPAL_VERSION,
    principalId: base.principalId,
    principalType: 'INTERNAL_SERVICE',
    servicePrincipalId,
    serviceName: identifier(
      base.record.serviceName,
      'principal.serviceName',
    ),
    status: base.status,
    authenticationBinding: base.authenticationBinding,
    assurance: base.assurance,
    resolutionEvidence: base.resolutionEvidence,
    resolvedAt: base.resolvedAt,
    freshness: base.freshness,
  });
}

export function validateResolvedSystemActorPrincipalV1(
  value: unknown,
): ResolvedSystemActorPrincipalV1 {
  const base = validateResolvedBase(
    value,
    ['systemActorId', 'executionOrigin', 'capabilityBindingId'],
    'SYSTEM_ACTOR',
  );
  if (
    base.authenticationBinding.bindingType !== 'SYSTEM' ||
    base.assurance.level !== 'SYSTEM_ATTESTED'
  ) {
    return fail('INVALID_RESOLVED_PRINCIPAL', 'principal');
  }
  assertInternalEvidence(base, 'INTERNAL_CAPABILITY_REGISTRY');
  const systemActorId = identifier(
    base.record.systemActorId,
    'principal.systemActorId',
  );
  const executionOrigin = identifier(
    base.record.executionOrigin,
    'principal.executionOrigin',
  );
  const capabilityBindingId = identifier(
    base.record.capabilityBindingId,
    'principal.capabilityBindingId',
  );
  if (
    systemActorId !== base.authenticationBinding.systemActorId ||
    executionOrigin !== base.authenticationBinding.executionOrigin ||
    capabilityBindingId !==
      base.authenticationBinding.capabilityBindingId
  ) {
    return fail('INVALID_RESOLVED_PRINCIPAL', 'principal');
  }
  return Object.freeze({
    schemaVersion: AUTHORITY_PRINCIPAL_RESOLUTION_SCHEMA_VERSION,
    version: AUTHORITY_RESOLVED_PRINCIPAL_VERSION,
    principalId: base.principalId,
    principalType: 'SYSTEM_ACTOR',
    systemActorId,
    executionOrigin,
    capabilityBindingId,
    status: base.status,
    authenticationBinding: base.authenticationBinding,
    assurance: base.assurance,
    resolutionEvidence: base.resolutionEvidence,
    resolvedAt: base.resolvedAt,
    freshness: base.freshness,
  });
}

export function validateResolvedMigrationActorPrincipalV1(
  value: unknown,
): ResolvedMigrationActorPrincipalV1 {
  const base = validateResolvedBase(
    value,
    [
      'migrationId',
      'migrationRunId',
      'executionPrincipalId',
      'batchScope',
      'changeReference',
    ],
    'MIGRATION_ACTOR',
  );
  if (
    base.authenticationBinding.bindingType !== 'MIGRATION' ||
    base.assurance.level !== 'SYSTEM_ATTESTED'
  ) {
    return fail('INVALID_RESOLVED_PRINCIPAL', 'principal');
  }
  assertInternalEvidence(base, 'MIGRATION_MANIFEST');
  const migrationId = identifier(
    base.record.migrationId,
    'principal.migrationId',
  );
  const migrationRunId = identifier(
    base.record.migrationRunId,
    'principal.migrationRunId',
  );
  const executionPrincipalId = identifier(
    base.record.executionPrincipalId,
    'principal.executionPrincipalId',
  );
  if (
    migrationId !== base.authenticationBinding.migrationId ||
    migrationRunId !== base.authenticationBinding.migrationRunId ||
    executionPrincipalId !==
      base.authenticationBinding.executionIdentity
  ) {
    return fail('INVALID_RESOLVED_PRINCIPAL', 'principal');
  }
  return Object.freeze({
    schemaVersion: AUTHORITY_PRINCIPAL_RESOLUTION_SCHEMA_VERSION,
    version: AUTHORITY_RESOLVED_PRINCIPAL_VERSION,
    principalId: base.principalId,
    principalType: 'MIGRATION_ACTOR',
    migrationId,
    migrationRunId,
    executionPrincipalId,
    batchScope: reference(
      base.record.batchScope,
      'principal.batchScope',
      256,
    ),
    ...(base.record.changeReference === undefined
      ? {}
      : {
          changeReference: reference(
            base.record.changeReference,
            'principal.changeReference',
            256,
          ),
        }),
    status: base.status,
    authenticationBinding: base.authenticationBinding,
    assurance: base.assurance,
    resolutionEvidence: base.resolutionEvidence,
    resolvedAt: base.resolvedAt,
    freshness: base.freshness,
  });
}

export function validateResolvedSupportOperatorPrincipalV1(
  value: unknown,
): ResolvedSupportOperatorPrincipalV1 {
  const base = validateResolvedBase(
    value,
    ['operatorPrincipalId', 'supportSessionId', 'impersonation'],
    'SUPPORT_OPERATOR',
  );
  if (base.authenticationBinding.bindingType !== 'SUPPORT') {
    return fail('INVALID_RESOLVED_PRINCIPAL', 'principal');
  }
  assertAppCallerEvidence(base);
  const operatorPrincipalId = identifier(
    base.record.operatorPrincipalId,
    'principal.operatorPrincipalId',
  );
  const supportSessionId = identifier(
    base.record.supportSessionId,
    'principal.supportSessionId',
  );
  if (
    operatorPrincipalId !== base.authenticationBinding.operatorId ||
    supportSessionId !== base.authenticationBinding.supportSessionId
  ) {
    return fail('INVALID_RESOLVED_PRINCIPAL', 'principal');
  }
  return Object.freeze({
    schemaVersion: AUTHORITY_PRINCIPAL_RESOLUTION_SCHEMA_VERSION,
    version: AUTHORITY_RESOLVED_PRINCIPAL_VERSION,
    principalId: base.principalId,
    principalType: 'SUPPORT_OPERATOR',
    operatorPrincipalId,
    supportSessionId,
    impersonation: literal(
      base.record.impersonation,
      'PROHIBITED',
      'principal.impersonation',
    ),
    status: base.status,
    authenticationBinding: base.authenticationBinding,
    assurance: base.assurance,
    resolutionEvidence: base.resolutionEvidence,
    resolvedAt: base.resolvedAt,
    freshness: base.freshness,
  });
}

export function validateResolvedAuthorityPrincipalV1(
  value: unknown,
): ResolvedAuthorityPrincipalV1 {
  if (!isPlainRecord(value)) {
    return fail('INVALID_RESOLVED_PRINCIPAL', 'principal');
  }
  switch (value.principalType) {
    case 'HUMAN_USER':
      return validateResolvedHumanAuthorityPrincipalV1(value);
    case 'INTERNAL_SERVICE':
      return validateResolvedInternalServicePrincipalV1(value);
    case 'SYSTEM_ACTOR':
      return validateResolvedSystemActorPrincipalV1(value);
    case 'MIGRATION_ACTOR':
      return validateResolvedMigrationActorPrincipalV1(value);
    case 'SUPPORT_OPERATOR':
      return validateResolvedSupportOperatorPrincipalV1(value);
    default:
      return fail(
        'INVALID_RESOLVED_PRINCIPAL',
        'principal.principalType',
      );
  }
}

function validateFirebaseRequest(
  value: unknown,
): AuthorityFirebasePrincipalResolutionRequestV1 {
  const record = closedRecord(
    value,
    [
      'schemaVersion',
      'requestType',
      'authenticationMethod',
      'firebaseUid',
      'tokenIssuedAt',
      'tokenAuthTime',
      'authenticatedAt',
      'authProvider',
      'tokenIdHash',
      'claimsVersion',
      'revocationCheckedAt',
      'issuer',
      'audience',
      'appCheckEvidence',
    ],
    'INVALID_RESOLUTION_REQUEST',
    'request',
  );
  const tokenAuthTime = canonicalTimestamp(
    record.tokenAuthTime,
    'request.tokenAuthTime',
  );
  const tokenIssuedAt = canonicalTimestamp(
    record.tokenIssuedAt,
    'request.tokenIssuedAt',
  );
  const authenticatedAt = canonicalTimestamp(
    record.authenticatedAt,
    'request.authenticatedAt',
  );
  const revocationCheckedAt = canonicalTimestamp(
    record.revocationCheckedAt,
    'request.revocationCheckedAt',
  );
  assertTimeOrder(tokenAuthTime, tokenIssuedAt, true, 'request.tokenAuthTime');
  assertTimeOrder(
    tokenIssuedAt,
    authenticatedAt,
    true,
    'request.authenticatedAt',
  );
  assertTimeOrder(
    authenticatedAt,
    revocationCheckedAt,
    true,
    'request.revocationCheckedAt',
  );
  const appCheckEvidence = validateAuthorityAppCheckEvidenceV1(
    record.appCheckEvidence,
  );
  if (appCheckEvidence.status !== 'REQUIRED_AND_VALID') {
    return fail('INVALID_RESOLUTION_REQUEST', 'request.appCheckEvidence');
  }
  return Object.freeze({
    schemaVersion: literal(
      record.schemaVersion,
      AUTHORITY_PRINCIPAL_RESOLUTION_REQUEST_VERSION,
      'request.schemaVersion',
    ),
    requestType: literal(
      record.requestType,
      'VERIFIED_FIREBASE_USER',
      'request.requestType',
    ),
    authenticationMethod: literal(
      record.authenticationMethod,
      'FIREBASE_ID_TOKEN',
      'request.authenticationMethod',
    ),
    firebaseUid: validateAuthorityFirebaseUidV1(record.firebaseUid),
    tokenIssuedAt,
    tokenAuthTime,
    authenticatedAt,
    authProvider: enumValue(
      record.authProvider,
      AUTHORITY_FIREBASE_AUTH_PROVIDERS,
      'request.authProvider',
    ),
    ...(record.tokenIdHash === undefined
      ? {}
      : { tokenIdHash: fingerprint(record.tokenIdHash, 'request.tokenIdHash') }),
    ...(record.claimsVersion === undefined
      ? {}
      : { claimsVersion: version(record.claimsVersion, 'request.claimsVersion') }),
    revocationCheckedAt,
    issuer: reference(record.issuer, 'request.issuer'),
    audience: reference(record.audience, 'request.audience'),
    appCheckEvidence,
  });
}

function validateIamRequest(
  value: unknown,
): AuthorityIamPrincipalResolutionRequestV1 {
  const record = closedRecord(
    value,
    [
      'schemaVersion',
      'requestType',
      'authenticationMethod',
      'servicePrincipalId',
      'issuer',
      'subject',
      'audience',
      'issuedAt',
      'authenticatedAt',
      'credentialIdHash',
    ],
    'INVALID_RESOLUTION_REQUEST',
    'request',
  );
  const issuedAt = canonicalTimestamp(record.issuedAt, 'request.issuedAt');
  const authenticatedAt = canonicalTimestamp(
    record.authenticatedAt,
    'request.authenticatedAt',
  );
  assertTimeOrder(issuedAt, authenticatedAt, true, 'request.authenticatedAt');
  return Object.freeze({
    schemaVersion: literal(
      record.schemaVersion,
      AUTHORITY_PRINCIPAL_RESOLUTION_REQUEST_VERSION,
      'request.schemaVersion',
    ),
    requestType: literal(
      record.requestType,
      'VERIFIED_IAM_SERVICE',
      'request.requestType',
    ),
    authenticationMethod: enumValue(
      record.authenticationMethod,
      ['IAM_OIDC', 'SERVICE_ACCOUNT_ASSERTION'] as const,
      'request.authenticationMethod',
    ),
    servicePrincipalId: validateAuthorityServicePrincipalIdV1(
      record.servicePrincipalId,
    ),
    issuer: reference(record.issuer, 'request.issuer'),
    subject: reference(record.subject, 'request.subject'),
    audience: reference(record.audience, 'request.audience'),
    issuedAt,
    authenticatedAt,
    ...(record.credentialIdHash === undefined
      ? {}
      : {
          credentialIdHash: fingerprint(
            record.credentialIdHash,
            'request.credentialIdHash',
          ),
        }),
  });
}

function validateSystemRequest(
  value: unknown,
): AuthoritySystemPrincipalResolutionRequestV1 {
  const record = closedRecord(
    value,
    [
      'schemaVersion',
      'requestType',
      'authenticationMethod',
      'systemActorId',
      'executionOrigin',
      'capabilityBindingId',
      'attestationFingerprint',
      'authenticatedAt',
    ],
    'INVALID_RESOLUTION_REQUEST',
    'request',
  );
  return Object.freeze({
    schemaVersion: literal(
      record.schemaVersion,
      AUTHORITY_PRINCIPAL_RESOLUTION_REQUEST_VERSION,
      'request.schemaVersion',
    ),
    requestType: literal(
      record.requestType,
      'VERIFIED_SYSTEM_CAPABILITY',
      'request.requestType',
    ),
    authenticationMethod: literal(
      record.authenticationMethod,
      'INTERNAL_SYSTEM_CAPABILITY',
      'request.authenticationMethod',
    ),
    systemActorId: identifier(record.systemActorId, 'request.systemActorId'),
    executionOrigin: identifier(
      record.executionOrigin,
      'request.executionOrigin',
    ),
    capabilityBindingId: identifier(
      record.capabilityBindingId,
      'request.capabilityBindingId',
    ),
    attestationFingerprint: fingerprint(
      record.attestationFingerprint,
      'request.attestationFingerprint',
    ),
    authenticatedAt: canonicalTimestamp(
      record.authenticatedAt,
      'request.authenticatedAt',
    ),
  });
}

function validateMigrationRequest(
  value: unknown,
): AuthorityMigrationPrincipalResolutionRequestV1 {
  const record = closedRecord(
    value,
    [
      'schemaVersion',
      'requestType',
      'authenticationMethod',
      'migrationId',
      'migrationRunId',
      'executionPrincipalId',
      'batchId',
      'batchScope',
      'changeReference',
      'attestationFingerprint',
      'authenticatedAt',
    ],
    'INVALID_RESOLUTION_REQUEST',
    'request',
  );
  return Object.freeze({
    schemaVersion: literal(
      record.schemaVersion,
      AUTHORITY_PRINCIPAL_RESOLUTION_REQUEST_VERSION,
      'request.schemaVersion',
    ),
    requestType: literal(
      record.requestType,
      'VERIFIED_MIGRATION_INVOCATION',
      'request.requestType',
    ),
    authenticationMethod: literal(
      record.authenticationMethod,
      'MIGRATION_CAPABILITY',
      'request.authenticationMethod',
    ),
    migrationId: identifier(record.migrationId, 'request.migrationId'),
    migrationRunId: identifier(
      record.migrationRunId,
      'request.migrationRunId',
    ),
    executionPrincipalId: identifier(
      record.executionPrincipalId,
      'request.executionPrincipalId',
    ),
    batchId: identifier(record.batchId, 'request.batchId'),
    batchScope: reference(record.batchScope, 'request.batchScope', 256),
    ...(record.changeReference === undefined
      ? {}
      : {
          changeReference: reference(
            record.changeReference,
            'request.changeReference',
            256,
          ),
        }),
    attestationFingerprint: fingerprint(
      record.attestationFingerprint,
      'request.attestationFingerprint',
    ),
    authenticatedAt: canonicalTimestamp(
      record.authenticatedAt,
      'request.authenticatedAt',
    ),
  });
}

function validateSupportRequest(
  value: unknown,
): AuthoritySupportPrincipalResolutionRequestV1 {
  const record = closedRecord(
    value,
    [
      'schemaVersion',
      'requestType',
      'authenticationMethod',
      'operatorPrincipalId',
      'supportSessionId',
      'firebaseUid',
      'tokenIssuedAt',
      'tokenAuthTime',
      'authenticatedAt',
      'authProvider',
      'tokenIdHash',
      'claimsVersion',
      'revocationCheckedAt',
      'issuer',
      'audience',
      'appCheckEvidence',
    ],
    'INVALID_RESOLUTION_REQUEST',
    'request',
  );
  const firebaseRequest = validateFirebaseRequest({
    schemaVersion: record.schemaVersion,
    requestType: 'VERIFIED_FIREBASE_USER',
    authenticationMethod: 'FIREBASE_ID_TOKEN',
    firebaseUid: record.firebaseUid,
    tokenIssuedAt: record.tokenIssuedAt,
    tokenAuthTime: record.tokenAuthTime,
    authenticatedAt: record.authenticatedAt,
    authProvider: record.authProvider,
    ...(record.tokenIdHash === undefined
      ? {}
      : { tokenIdHash: record.tokenIdHash }),
    ...(record.claimsVersion === undefined
      ? {}
      : { claimsVersion: record.claimsVersion }),
    revocationCheckedAt: record.revocationCheckedAt,
    issuer: record.issuer,
    audience: record.audience,
    appCheckEvidence: record.appCheckEvidence,
  });
  return Object.freeze({
    schemaVersion: firebaseRequest.schemaVersion,
    requestType: literal(
      record.requestType,
      'VERIFIED_SUPPORT_SESSION',
      'request.requestType',
    ),
    authenticationMethod: literal(
      record.authenticationMethod,
      'SUPPORT_SESSION',
      'request.authenticationMethod',
    ),
    operatorPrincipalId: identifier(
      record.operatorPrincipalId,
      'request.operatorPrincipalId',
    ),
    supportSessionId: identifier(
      record.supportSessionId,
      'request.supportSessionId',
    ),
    firebaseUid: firebaseRequest.firebaseUid,
    tokenIssuedAt: firebaseRequest.tokenIssuedAt,
    tokenAuthTime: firebaseRequest.tokenAuthTime,
    authenticatedAt: firebaseRequest.authenticatedAt,
    authProvider: firebaseRequest.authProvider,
    ...(firebaseRequest.tokenIdHash === undefined
      ? {}
      : { tokenIdHash: firebaseRequest.tokenIdHash }),
    ...(firebaseRequest.claimsVersion === undefined
      ? {}
      : { claimsVersion: firebaseRequest.claimsVersion }),
    revocationCheckedAt: firebaseRequest.revocationCheckedAt,
    issuer: firebaseRequest.issuer,
    audience: firebaseRequest.audience,
    appCheckEvidence: firebaseRequest.appCheckEvidence,
  });
}

export function validateAuthorityPrincipalResolutionRequestV1(
  value: unknown,
): AuthorityPrincipalResolutionRequestV1 {
  if (!isPlainRecord(value)) {
    return fail('INVALID_RESOLUTION_REQUEST', 'request');
  }
  switch (value.requestType) {
    case 'VERIFIED_FIREBASE_USER':
      return validateFirebaseRequest(value);
    case 'VERIFIED_IAM_SERVICE':
      return validateIamRequest(value);
    case 'VERIFIED_SYSTEM_CAPABILITY':
      return validateSystemRequest(value);
    case 'VERIFIED_MIGRATION_INVOCATION':
      return validateMigrationRequest(value);
    case 'VERIFIED_SUPPORT_SESSION':
      return validateSupportRequest(value);
    default:
      return fail('INVALID_RESOLUTION_REQUEST', 'request.requestType');
  }
}

export function validateAuthorityPrincipalResolutionContextV1(
  value: unknown,
): AuthorityPrincipalResolutionContextV1 {
  const record = closedRecord(
    value,
    [
      'schemaVersion',
      'requestId',
      'correlationId',
      'channel',
      'resolverVersion',
      'resolutionTime',
    ],
    'INVALID_RESOLUTION_CONTEXT',
    'context',
  );
  return Object.freeze({
    schemaVersion: literal(
      record.schemaVersion,
      AUTHORITY_PRINCIPAL_RESOLUTION_CONTEXT_VERSION,
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
    resolverVersion: version(
      record.resolverVersion,
      'context.resolverVersion',
    ),
    resolutionTime: canonicalTimestamp(
      record.resolutionTime,
      'context.resolutionTime',
    ),
  });
}

function validateSafeMetadata(
  value: unknown,
): AuthorityPrincipalResolutionSafeMetadataV1 {
  const record = closedRecord(
    value,
    ['resolverReference', 'evidenceFingerprint'],
    'INVALID_RESOLUTION_RESULT',
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
    (typeof AUTHORITY_PRINCIPAL_RESOLUTION_STATUSES)[number],
    'RESOLVED'
  >,
  reasonCode:
    (typeof AUTHORITY_PRINCIPAL_RESOLUTION_REASON_CODES)[number],
  retryDisposition:
    (typeof AUTHORITY_PRINCIPAL_RETRY_DISPOSITIONS)[number],
): void {
  const reasons: Readonly<
    Record<typeof status, readonly typeof reasonCode[]>
  > = {
    NOT_FOUND: [
      'AUTHENTICATION_BINDING_NOT_FOUND',
      'CANONICAL_USER_BINDING_NOT_FOUND',
    ],
    REJECTED: [
      'PRINCIPAL_DISABLED',
      'INVALID_ISSUER',
      'INVALID_AUDIENCE',
      'INVALID_APP_CHECK_EVIDENCE',
      'UNSUPPORTED_PRINCIPAL_TYPE',
      'INVALID_RESOLUTION_REQUEST',
    ],
    STALE: [
      'STALE_AUTHENTICATION',
      'STALE_BINDING',
      'CLAIMS_VERSION_MISMATCH',
    ],
    REVOKED: ['PRINCIPAL_REVOKED'],
    CONFLICT: ['PRINCIPAL_BINDING_CONFLICT'],
    INTERNAL_ERROR: ['INTERNAL_RESOLUTION_FAILURE'],
  };
  if (!reasons[status].includes(reasonCode)) {
    fail('INVALID_RESOLUTION_RESULT', 'result.reasonCode');
  }
  const retries: Readonly<
    Record<typeof status, readonly typeof retryDisposition[]>
  > = {
    NOT_FOUND: ['DO_NOT_RETRY', 'RETRY_AFTER_OPERATOR_REVIEW'],
    REJECTED: ['DO_NOT_RETRY', 'RETRY_AFTER_REAUTHENTICATION'],
    STALE: ['RETRY_AFTER_REAUTHENTICATION', 'RETRY_AFTER_REFRESH'],
    REVOKED: ['DO_NOT_RETRY'],
    CONFLICT: ['RETRY_AFTER_OPERATOR_REVIEW'],
    INTERNAL_ERROR: ['SAFE_TO_RETRY'],
  };
  if (!retries[status].includes(retryDisposition)) {
    fail('INVALID_RESOLUTION_RESULT', 'result.retryDisposition');
  }
}

export function validateAuthorityPrincipalResolutionResultV1(
  value: unknown,
): AuthorityPrincipalResolutionResultV1 {
  if (!isPlainRecord(value)) {
    return fail('INVALID_RESOLUTION_RESULT', 'result');
  }
  const status = enumValue(
    value.status,
    AUTHORITY_PRINCIPAL_RESOLUTION_STATUSES,
    'result.status',
  );
  if (status === 'RESOLVED') {
    const record = closedRecord(
      value,
      ['schemaVersion', 'status', 'principal'],
      'INVALID_RESOLUTION_RESULT',
      'result',
    );
    return Object.freeze({
      schemaVersion: literal(
        record.schemaVersion,
        AUTHORITY_PRINCIPAL_RESOLUTION_RESULT_VERSION,
        'result.schemaVersion',
      ),
      status,
      principal: validateResolvedAuthorityPrincipalV1(record.principal),
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
    'INVALID_RESOLUTION_RESULT',
    'result',
  );
  const reasonCode = enumValue(
    record.reasonCode,
    AUTHORITY_PRINCIPAL_RESOLUTION_REASON_CODES,
    'result.reasonCode',
  );
  const retryDisposition = enumValue(
    record.retryDisposition,
    AUTHORITY_PRINCIPAL_RETRY_DISPOSITIONS,
    'result.retryDisposition',
  );
  assertResultCompatibility(status, reasonCode, retryDisposition);
  return Object.freeze({
    schemaVersion: literal(
      record.schemaVersion,
      AUTHORITY_PRINCIPAL_RESOLUTION_RESULT_VERSION,
      'result.schemaVersion',
    ),
    status,
    reasonCode,
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
