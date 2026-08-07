export const FIRESTORE_FEATURE_POLICY_SOURCE_ERROR_VERSION = '1' as const;

export const FIRESTORE_FEATURE_POLICY_SOURCE_ERROR_CODES = Object.freeze([
  'SOURCE_UNAVAILABLE',
  'MALFORMED_SNAPSHOT',
  'TENANT_INTEGRITY_VIOLATION',
] as const);

export type FirestoreFeaturePolicySourceErrorCode =
  (typeof FIRESTORE_FEATURE_POLICY_SOURCE_ERROR_CODES)[number];

const SOURCE_ERROR_MESSAGES: Readonly<
  Record<FirestoreFeaturePolicySourceErrorCode, string>
> = Object.freeze({
  SOURCE_UNAVAILABLE:
    'Authoritative feature policy source is unavailable',
  MALFORMED_SNAPSHOT:
    'Authoritative feature policy snapshot is malformed',
  TENANT_INTEGRITY_VIOLATION:
    'Authoritative feature policy snapshot violates tenant integrity',
});

export class FirestoreFeaturePolicySourceError extends Error {
  public readonly schemaVersion =
    FIRESTORE_FEATURE_POLICY_SOURCE_ERROR_VERSION;

  public readonly code: FirestoreFeaturePolicySourceErrorCode;

  public constructor(code: FirestoreFeaturePolicySourceErrorCode) {
    super(SOURCE_ERROR_MESSAGES[code]);

    this.name = 'FirestoreFeaturePolicySourceError';
    this.code = code;

    Object.freeze(this);
  }
}
