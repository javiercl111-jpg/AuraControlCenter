import {
  createAuthorityAliasKeyV1,
  createAuthorityIdempotencyDocumentIdV1,
  createAuthorityLegacyTenantPhysicalLocatorV1,
  createAuthorityMembershipKeyV1,
  createAuthorityOperationBindingDocumentIdV1,
  type AuthorityAdministrativeCommandV1,
  type AuthorityLegacyTenantSourceDescriptorV1,
  type AuthorityRepositoryCollection,
} from "@aura/intelligence-os/server";

import {
  createFirestoreAuthorityDocumentLocator,
  createFirestoreLegacyTenantDocumentLocator,
  type FirestoreAuthorityDocumentLocator,
} from "./firestoreAuthorityCollections";

type FirestoreAuthorityReadableCollection = Extract<
  AuthorityRepositoryCollection,
  | "TENANTS"
  | "MEMBERSHIPS"
  | "ALIASES"
  | "IDEMPOTENCY"
  | "OPERATION_BINDINGS"
>;

export type FirestoreAuthorityReadTarget =
  | Readonly<{
      repositoryCollection: FirestoreAuthorityReadableCollection;
      documentId: string;
      locator: FirestoreAuthorityDocumentLocator;
    }>
  | Readonly<{
      repositoryCollection: "LEGACY_TENANT_SOURCES";
      documentId: string;
      locator: FirestoreAuthorityDocumentLocator;
      sourceDescriptor: AuthorityLegacyTenantSourceDescriptorV1;
      decodedAt: string;
    }>;

function resourceTarget(
  repositoryCollection: FirestoreAuthorityReadableCollection,
  documentId: string,
): FirestoreAuthorityReadTarget {
  return Object.freeze({
    repositoryCollection,
    documentId,
    locator: createFirestoreAuthorityDocumentLocator(
      repositoryCollection,
      documentId,
    ),
  });
}

function legacyTarget(
  command: Extract<
    AuthorityAdministrativeCommandV1,
    { readonly operationType: "CANONICALIZE_LEGACY_TENANT" }
  >,
): FirestoreAuthorityReadTarget {
  const sourceRecord =
    command.payload.canonicalizationInput.sourceRecord;
  const physicalLocator =
    createAuthorityLegacyTenantPhysicalLocatorV1(
      sourceRecord.sourceDescriptor,
    );
  return Object.freeze({
    repositoryCollection: "LEGACY_TENANT_SOURCES",
    documentId: physicalLocator.locatorKey,
    locator: createFirestoreLegacyTenantDocumentLocator(
      physicalLocator.sourceCollection,
      physicalLocator.documentId,
    ),
    sourceDescriptor: sourceRecord.sourceDescriptor,
    decodedAt: sourceRecord.decodedAt,
  });
}

function operationTargets(
  command: AuthorityAdministrativeCommandV1,
): readonly FirestoreAuthorityReadTarget[] {
  switch (command.operationType) {
    case "CREATE_TENANT_AUTHORITY":
      return [resourceTarget("TENANTS", command.payload.tenantId)];
    case "UPDATE_TENANT_STATUS":
      return [
        resourceTarget("TENANTS", command.payload.tenantId),
        ...(command.payload.targetStatus === "ACTIVE" &&
        command.payload.activationPrerequisite !== undefined
          ? [
              resourceTarget(
                "MEMBERSHIPS",
                command.payload.activationPrerequisite.membershipKey,
              ),
            ]
          : []),
      ];
    case "CREATE_TENANT_MEMBERSHIP":
      return [
        resourceTarget("TENANTS", command.payload.tenantId),
        resourceTarget(
          "MEMBERSHIPS",
          createAuthorityMembershipKeyV1({
            principalType: command.payload.principalType,
            principalId: command.payload.principalId,
            tenantId: command.payload.tenantId,
          }),
        ),
      ];
    case "UPDATE_TENANT_MEMBERSHIP_ROLES":
    case "CHANGE_TENANT_MEMBERSHIP_STATUS":
      return [
        resourceTarget("TENANTS", command.payload.tenantId),
        resourceTarget("MEMBERSHIPS", command.payload.membershipKey),
      ];
    case "RESERVE_TENANT_ALIAS":
      return [
        resourceTarget("TENANTS", command.payload.tenantId),
        resourceTarget("ALIASES", command.payload.aliasKey),
      ];
    case "TOMBSTONE_TENANT_ALIAS":
      return [resourceTarget("ALIASES", command.payload.aliasKey)];
    case "CANONICALIZE_LEGACY_TENANT": {
      const input = command.payload.canonicalizationInput;
      return [
        legacyTarget(command),
        resourceTarget("TENANTS", input.canonicalDocumentId),
        ...input.selectedAliasCandidates.map((candidate) =>
          resourceTarget(
            "ALIASES",
            createAuthorityAliasKeyV1({
              aliasType: candidate.aliasType,
              normalizedAlias: candidate.normalizedAlias,
            }),
          ),
        ),
      ];
    }
  }
}

function targetKey(target: FirestoreAuthorityReadTarget): string {
  return `${target.repositoryCollection}:${target.documentId}`;
}

export function createFirestoreAuthorityReadSet(
  command: AuthorityAdministrativeCommandV1,
): readonly FirestoreAuthorityReadTarget[] {
  const targets = [
    resourceTarget(
      "IDEMPOTENCY",
      createAuthorityIdempotencyDocumentIdV1(command.idempotencyKey),
    ),
    resourceTarget(
      "OPERATION_BINDINGS",
      createAuthorityOperationBindingDocumentIdV1(
        command.operationId,
      ),
    ),
    ...operationTargets(command),
  ];
  const seen = new Set<string>();
  return Object.freeze(
    targets.filter((target) => {
      const key = targetKey(target);
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    }),
  );
}
