export const FIRESTORE_RATE_LIMIT_COLLECTION =
  "public_rate_limit_counters_v1" as const;

export interface FirestoreRateLimitDocumentLocator {
  readonly collectionPath: typeof FIRESTORE_RATE_LIMIT_COLLECTION;
  readonly documentId: string;
}
