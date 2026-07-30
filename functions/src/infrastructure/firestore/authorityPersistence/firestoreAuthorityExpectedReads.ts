import {
  createAuthorityLegacySourceRecordVersionKeyV1,
  validateAuthorityLegacyTenantSourceRecordV1,
  validatePersistedTenantAliasRecordV1,
  validatePersistedTenantAuthorityRecordV1,
  validatePersistedTenantMembershipRecordV1,
  type AuthorityMutationExpectedReadV1,
  type AuthorityRepositoryReadRegistryEntryV1,
} from "@aura/intelligence-os/server";

import type {
  FirestoreAuthorityReadObservation,
} from "./firestoreAuthoritySnapshot";

const EXPECTED_READ_ERROR_MESSAGE =
  "Authority Firestore expected-read revalidation failed.";

export class FirestoreAuthorityExpectedReadError extends Error {
  readonly code = "AUTHORITY_EXPECTED_READ_REVALIDATION_FAILED";

  constructor() {
    super(EXPECTED_READ_ERROR_MESSAGE);
    this.name = "FirestoreAuthorityExpectedReadError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

function observationKey(
  collection: string,
  documentId: string,
): string {
  return `${collection}:${documentId}`;
}

function findObservation(
  expected: AuthorityMutationExpectedReadV1,
  observations: readonly FirestoreAuthorityReadObservation[],
): FirestoreAuthorityReadObservation {
  const expectedKey = observationKey(
    expected.collection,
    expected.documentId,
  );
  const observation = observations.find(
    (candidate) =>
      observationKey(
        candidate.target.repositoryCollection,
        candidate.target.documentId,
      ) === expectedKey,
  );
  if (observation === undefined) {
    throw new FirestoreAuthorityExpectedReadError();
  }
  return observation;
}

function recordVersion(
  expected: Extract<
    AuthorityMutationExpectedReadV1,
    {
      readonly expectation:
        | "MUST_EXIST_AT_VERSION"
        | "MUST_MATCH_AUTHORITY_VERSION";
    }
  >,
  observation: Extract<
    FirestoreAuthorityReadObservation,
    { readonly exists: true }
  >,
): Readonly<{ recordVersion: number; authorityVersion: number }> {
  switch (expected.collection) {
    case "TENANTS": {
      const record = validatePersistedTenantAuthorityRecordV1(
        observation.value,
        expected.documentId,
      );
      return {
        recordVersion: record.recordVersion,
        authorityVersion: record.authorityVersion,
      };
    }
    case "MEMBERSHIPS": {
      const record = validatePersistedTenantMembershipRecordV1(
        observation.value,
        expected.documentId,
      );
      return {
        recordVersion: record.membershipVersion,
        authorityVersion: record.authorityVersion,
      };
    }
    case "ALIASES": {
      const record = validatePersistedTenantAliasRecordV1(
        observation.value,
        expected.documentId,
      );
      return {
        recordVersion: record.aliasVersion,
        authorityVersion: record.authorityVersion,
      };
    }
  }
}

function revalidateLegacySource(
  expected: Extract<
    AuthorityMutationExpectedReadV1,
    { readonly expectation: "MUST_MATCH_SOURCE" }
  >,
  observation: FirestoreAuthorityReadObservation,
  readRegistry: readonly AuthorityRepositoryReadRegistryEntryV1[],
): void {
  if (
    !observation.exists ||
    observation.target.repositoryCollection !==
      "LEGACY_TENANT_SOURCES"
  ) {
    throw new FirestoreAuthorityExpectedReadError();
  }
  const source = validateAuthorityLegacyTenantSourceRecordV1(
    observation.value,
    expected.locatorKey,
  );
  const registry = readRegistry.find(
    (entry) => entry.locatorKey === expected.locatorKey,
  );
  if (
    registry === undefined ||
    registry.readStatus !== "PRESENT" ||
    registry.collection !== expected.sourceCollection ||
    registry.documentId !== expected.sourceDocumentId ||
    registry.locatorKey !== expected.locatorKey ||
    source.sourceDescriptor.sourceCollection !==
      expected.sourceCollection ||
    source.sourceDocumentId !== expected.sourceDocumentId ||
    source.sourceLocator.locatorKey !== expected.locatorKey ||
    source.sourceRecordFingerprint !==
      expected.expectedSourceRecordFingerprint ||
    registry.recordFingerprint !==
      expected.expectedSourceRecordFingerprint ||
    createAuthorityLegacySourceRecordVersionKeyV1(
      source.sourceRecordVersion,
    ) !==
      createAuthorityLegacySourceRecordVersionKeyV1(
        expected.expectedSourceRecordVersion,
      ) ||
    createAuthorityLegacySourceRecordVersionKeyV1(
      registry.recordVersion,
    ) !==
      createAuthorityLegacySourceRecordVersionKeyV1(
        expected.expectedSourceRecordVersion,
      )
  ) {
    throw new FirestoreAuthorityExpectedReadError();
  }
}

export function revalidateFirestoreAuthorityExpectedReads(
  expectedReads: readonly AuthorityMutationExpectedReadV1[],
  observations: readonly FirestoreAuthorityReadObservation[],
  readRegistry: readonly AuthorityRepositoryReadRegistryEntryV1[],
): void {
  expectedReads.forEach((expected) => {
    const observation = findObservation(expected, observations);
    if (expected.expectation === "MUST_NOT_EXIST") {
      if (observation.exists) {
        throw new FirestoreAuthorityExpectedReadError();
      }
      return;
    }
    if (expected.expectation === "MUST_EXIST") {
      if (!observation.exists) {
        throw new FirestoreAuthorityExpectedReadError();
      }
      return;
    }
    if (expected.expectation === "MUST_MATCH_SOURCE") {
      revalidateLegacySource(expected, observation, readRegistry);
      return;
    }
    if (!observation.exists) {
      throw new FirestoreAuthorityExpectedReadError();
    }
    if (
      expected.expectation !== "MUST_EXIST_AT_VERSION" &&
      expected.expectation !== "MUST_MATCH_AUTHORITY_VERSION"
    ) {
      throw new FirestoreAuthorityExpectedReadError();
    }
    const versions = recordVersion(expected, observation);
    const actualVersion =
      expected.expectation === "MUST_EXIST_AT_VERSION"
        ? versions.recordVersion
        : versions.authorityVersion;
    if (actualVersion !== expected.expectedVersion) {
      throw new FirestoreAuthorityExpectedReadError();
    }
  });
}
