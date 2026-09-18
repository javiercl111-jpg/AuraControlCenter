import { createHash } from "node:crypto";

import type { Firestore } from "firebase-admin/firestore";

import {
  createCanonicalTenantAuthorityV1,
  createServerOwnedTenantMembershipRecordV1,
  createVerifiedServiceIdentityBindingV1,
  validatePersistedTenantAuthorityRecordV1,
  validatePersistedTenantMembershipRecordV1,
} from "@aura/intelligence-os/server";

import {
  FIRESTORE_AUTHORITY_COLLECTIONS,
} from "../../infrastructure/firestore/authorityPersistence/firestoreAuthorityCollections";

export const DISCOVERY_OIDC_SERVICE_IDENTITY_BINDING_COLLECTION_V1 =
  "discovery_oidc_service_identity_bindings" as const;

export const DISCOVERY_OIDC_SERVICE_IDENTITY_BINDING_SCHEMA_V1 =
  "DiscoveryOidcServiceIdentityBindingV1" as const;

export const DISCOVERY_OIDC_SERVICE_IDENTITY_BINDING_VERSION_V1 =
  "1" as const;

export const DISCOVERY_OIDC_SERVICE_IDENTITY_BINDING_PROJECT_V1 =
  "aura-intel-preview" as const;

export const DISCOVERY_OIDC_SERVICE_IDENTITY_BINDING_ENVIRONMENT_V1 =
  "PREVIEW" as const;

export const DISCOVERY_OIDC_SERVICE_ACCOUNT_EMAIL_V1 =
  "preview-discovery-complete-rt@aura-intel-preview.iam.gserviceaccount.com" as const;

const PROVIDER = "GOOGLE_CLOUD_IAM" as const;
const AUTHENTICATION_METHOD = "OIDC_SERVICE_ACCOUNT" as const;
const PROVIDER_SUBJECT_PREFIX = "google-oidc-sub:" as const;
const DOCUMENT_ID_PREFIX = "oidc-service-v1-" as const;

const RESOLVER_VERSION =
  "discovery-oidc-service-identity-binding-resolver-v1" as const;

export type VerifiedDiscoveryServiceIdentityBindingV1 =
  ReturnType<typeof createVerifiedServiceIdentityBindingV1>;

export type CanonicalDiscoveryTenantAuthorityV1 =
  ReturnType<typeof createCanonicalTenantAuthorityV1>;

export type ServerOwnedDiscoveryTenantMembershipV1 =
  ReturnType<typeof createServerOwnedTenantMembershipRecordV1>;

export interface ResolvedDiscoveryServiceAuthorityV1 {
  readonly binding: VerifiedDiscoveryServiceIdentityBindingV1;
  readonly tenant: CanonicalDiscoveryTenantAuthorityV1;
  readonly membership: ServerOwnedDiscoveryTenantMembershipV1;
  readonly resolvedAt: string;
}

export type OidcServiceIdentityBindingResolutionErrorCodeV1 =
  | "INVALID_INPUT"
  | "BINDING_NOT_FOUND"
  | "BINDING_LOOKUP_FAILED"
  | "INVALID_BINDING_DOCUMENT"
  | "BINDING_AUTHORITY_MISMATCH"
  | "MEMBERSHIP_NOT_FOUND"
  | "MEMBERSHIP_LOOKUP_FAILED"
  | "MEMBERSHIP_AUTHORITY_AMBIGUOUS"
  | "INVALID_MEMBERSHIP_DOCUMENT"
  | "MEMBERSHIP_AUTHORITY_MISMATCH"
  | "TENANT_NOT_FOUND"
  | "TENANT_LOOKUP_FAILED"
  | "INVALID_TENANT_DOCUMENT"
  | "TENANT_AUTHORITY_MISMATCH"
  | "INVALID_RESOLUTION_TIME";

export class OidcServiceIdentityBindingResolutionErrorV1 extends Error {
  readonly code: OidcServiceIdentityBindingResolutionErrorCodeV1;

  constructor(code: OidcServiceIdentityBindingResolutionErrorCodeV1) {
    super(code);
    this.name = "OidcServiceIdentityBindingResolutionErrorV1";
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

interface DiscoveryOidcServiceIdentityBindingDocumentV1 {
  readonly schemaVersion:
    typeof DISCOVERY_OIDC_SERVICE_IDENTITY_BINDING_SCHEMA_V1;
  readonly bindingVersion:
    typeof DISCOVERY_OIDC_SERVICE_IDENTITY_BINDING_VERSION_V1;
  readonly environment:
    typeof DISCOVERY_OIDC_SERVICE_IDENTITY_BINDING_ENVIRONMENT_V1;
  readonly projectId:
    typeof DISCOVERY_OIDC_SERVICE_IDENTITY_BINDING_PROJECT_V1;
  readonly provider: typeof PROVIDER;
  readonly authenticationMethod: typeof AUTHENTICATION_METHOD;
  readonly providerSubjectId: string;
  readonly serviceAccountEmail:
    typeof DISCOVERY_OIDC_SERVICE_ACCOUNT_EMAIL_V1;
  readonly canonicalPrincipalId: string;
  readonly bindingId: string;
  readonly status: "ACTIVE";
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ResolveOidcServiceIdentityBindingInputV1 {
  readonly verifiedGoogleSubject: string;
  readonly serviceAccountEmail: string;
}

function fail(
  code: OidcServiceIdentityBindingResolutionErrorCodeV1,
): never {
  throw new OidcServiceIdentityBindingResolutionErrorV1(code);
}

function digest(value: string): string {
  return createHash("sha256")
    .update(value, "utf8")
    .digest("hex");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function hasExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean {
  const actual = Object.keys(value).sort();
  const required = [...expected].sort();

  return (
    actual.length === required.length &&
    actual.every((key, index) => key === required[index])
  );
}

function canonicalTimestamp(value: unknown): string {
  if (typeof value !== "string") {
    return fail("INVALID_BINDING_DOCUMENT");
  }

  const milliseconds = Date.parse(value);

  if (
    !Number.isFinite(milliseconds) ||
    new Date(milliseconds).toISOString() !== value
  ) {
    return fail("INVALID_BINDING_DOCUMENT");
  }

  return value;
}

function canonicalResolutionTimestamp(value: unknown): string {
  if (typeof value !== "string") {
    return fail("INVALID_RESOLUTION_TIME");
  }

  const milliseconds = Date.parse(value);

  if (
    !Number.isFinite(milliseconds) ||
    new Date(milliseconds).toISOString() !== value
  ) {
    return fail("INVALID_RESOLUTION_TIME");
  }

  return value;
}

function canonicalPrincipalId(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length < 3 ||
    value.length > 128 ||
    !/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(value) ||
    value.toLowerCase() === "system"
  ) {
    return fail("INVALID_BINDING_DOCUMENT");
  }

  return value;
}

export function createDiscoveryOidcProviderSubjectV1(
  verifiedGoogleSubject: string,
): string {
  if (
    typeof verifiedGoogleSubject !== "string" ||
    verifiedGoogleSubject.trim() !== verifiedGoogleSubject ||
    verifiedGoogleSubject.length < 1 ||
    verifiedGoogleSubject.length > 220 ||
    !/^[A-Za-z0-9][A-Za-z0-9_:/.-]*$/.test(
      verifiedGoogleSubject,
    ) ||
    verifiedGoogleSubject.includes("..") ||
    verifiedGoogleSubject.includes("@")
  ) {
    return fail("INVALID_INPUT");
  }

  const providerSubjectId =
    `${PROVIDER_SUBJECT_PREFIX}${verifiedGoogleSubject}`;

  if (
    providerSubjectId.length < 3 ||
    providerSubjectId.length > 256
  ) {
    return fail("INVALID_INPUT");
  }

  return providerSubjectId;
}

export function createDiscoveryOidcBindingDocumentIdV1(
  providerSubjectId: string,
): string {
  if (
    typeof providerSubjectId !== "string" ||
    !providerSubjectId.startsWith(PROVIDER_SUBJECT_PREFIX)
  ) {
    return fail("INVALID_INPUT");
  }

  return `${DOCUMENT_ID_PREFIX}${digest(providerSubjectId)}`;
}

function decodeBindingDocument(
  value: unknown,
  expectedProviderSubjectId: string,
  expectedDocumentId: string,
): DiscoveryOidcServiceIdentityBindingDocumentV1 {
  if (!isRecord(value)) {
    return fail("INVALID_BINDING_DOCUMENT");
  }

  if (
    !hasExactKeys(value, [
      "schemaVersion",
      "bindingVersion",
      "environment",
      "projectId",
      "provider",
      "authenticationMethod",
      "providerSubjectId",
      "serviceAccountEmail",
      "canonicalPrincipalId",
      "bindingId",
      "status",
      "createdAt",
      "updatedAt",
    ])
  ) {
    return fail("INVALID_BINDING_DOCUMENT");
  }

  if (
    value.schemaVersion !==
      DISCOVERY_OIDC_SERVICE_IDENTITY_BINDING_SCHEMA_V1 ||
    value.bindingVersion !==
      DISCOVERY_OIDC_SERVICE_IDENTITY_BINDING_VERSION_V1 ||
    value.environment !==
      DISCOVERY_OIDC_SERVICE_IDENTITY_BINDING_ENVIRONMENT_V1 ||
    value.projectId !==
      DISCOVERY_OIDC_SERVICE_IDENTITY_BINDING_PROJECT_V1 ||
    value.provider !== PROVIDER ||
    value.authenticationMethod !== AUTHENTICATION_METHOD ||
    value.providerSubjectId !== expectedProviderSubjectId ||
    value.serviceAccountEmail !==
      DISCOVERY_OIDC_SERVICE_ACCOUNT_EMAIL_V1 ||
    value.bindingId !== expectedDocumentId ||
    value.status !== "ACTIVE"
  ) {
    return fail("BINDING_AUTHORITY_MISMATCH");
  }

  const createdAt = canonicalTimestamp(value.createdAt);
  const updatedAt = canonicalTimestamp(value.updatedAt);

  if (Date.parse(updatedAt) < Date.parse(createdAt)) {
    return fail("INVALID_BINDING_DOCUMENT");
  }

  return Object.freeze({
    schemaVersion:
      DISCOVERY_OIDC_SERVICE_IDENTITY_BINDING_SCHEMA_V1,
    bindingVersion:
      DISCOVERY_OIDC_SERVICE_IDENTITY_BINDING_VERSION_V1,
    environment:
      DISCOVERY_OIDC_SERVICE_IDENTITY_BINDING_ENVIRONMENT_V1,
    projectId:
      DISCOVERY_OIDC_SERVICE_IDENTITY_BINDING_PROJECT_V1,
    provider: PROVIDER,
    authenticationMethod: AUTHENTICATION_METHOD,
    providerSubjectId: expectedProviderSubjectId,
    serviceAccountEmail:
      DISCOVERY_OIDC_SERVICE_ACCOUNT_EMAIL_V1,
    canonicalPrincipalId:
      canonicalPrincipalId(value.canonicalPrincipalId),
    bindingId: expectedDocumentId,
    status: "ACTIVE",
    createdAt,
    updatedAt,
  });
}

export class FirestoreOidcServiceIdentityBindingResolverV1 {
  constructor(
    private readonly firestore: Firestore,
    private readonly now: () => string =
      () => new Date().toISOString(),
  ) {}

  async resolve(
    input: ResolveOidcServiceIdentityBindingInputV1,
  ): Promise<VerifiedDiscoveryServiceIdentityBindingV1> {
    if (
      !input ||
      input.serviceAccountEmail !==
        DISCOVERY_OIDC_SERVICE_ACCOUNT_EMAIL_V1
    ) {
      return fail("INVALID_INPUT");
    }

    const providerSubjectId =
      createDiscoveryOidcProviderSubjectV1(
        input.verifiedGoogleSubject,
      );

    const documentId =
      createDiscoveryOidcBindingDocumentIdV1(
        providerSubjectId,
      );

    let value: unknown;

    try {
      const snapshot = await this.firestore
        .collection(
          DISCOVERY_OIDC_SERVICE_IDENTITY_BINDING_COLLECTION_V1,
        )
        .doc(documentId)
        .get();

      if (!snapshot.exists) {
        return fail("BINDING_NOT_FOUND");
      }

      value = snapshot.data();
    } catch (error: unknown) {
      if (
        error instanceof
        OidcServiceIdentityBindingResolutionErrorV1
      ) {
        throw error;
      }

      return fail("BINDING_LOOKUP_FAILED");
    }

    const binding = decodeBindingDocument(
      value,
      providerSubjectId,
      documentId,
    );

    return createVerifiedServiceIdentityBindingV1({
      schemaVersion: "1",
      bindingVersion: binding.bindingVersion,
      principalType: "SERVICE",
      provider: "GOOGLE_CLOUD_IAM",
      providerSubjectId: binding.providerSubjectId,
      canonicalPrincipalId: binding.canonicalPrincipalId,
      bindingId: binding.bindingId,
      status: "ACTIVE",
      verifiedAt: binding.updatedAt,
      resolverVersion: RESOLVER_VERSION,
    });
  }

  async resolveAuthority(
    input: ResolveOidcServiceIdentityBindingInputV1,
  ): Promise<ResolvedDiscoveryServiceAuthorityV1> {
    const binding = await this.resolve(input);

    let membershipSnapshot;

    try {
      membershipSnapshot = await this.firestore
        .collection(FIRESTORE_AUTHORITY_COLLECTIONS.MEMBERSHIPS)
        .where(
          "principalId",
          "==",
          binding.canonicalPrincipalId,
        )
        .limit(2)
        .get();
    } catch {
      return fail("MEMBERSHIP_LOOKUP_FAILED");
    }

    if (membershipSnapshot.empty) {
      return fail("MEMBERSHIP_NOT_FOUND");
    }

    if (membershipSnapshot.size !== 1) {
      return fail("MEMBERSHIP_AUTHORITY_AMBIGUOUS");
    }

    const membershipDocument = membershipSnapshot.docs[0];

    if (!membershipDocument) {
      return fail("MEMBERSHIP_NOT_FOUND");
    }

    let persistedMembership;

    try {
      persistedMembership =
        validatePersistedTenantMembershipRecordV1(
          membershipDocument.data(),
          membershipDocument.id,
        );
    } catch {
      return fail("INVALID_MEMBERSHIP_DOCUMENT");
    }

    if (
      persistedMembership.principalType !== "SERVICE" ||
      persistedMembership.principalId !==
        binding.canonicalPrincipalId ||
      persistedMembership.status !== "ACTIVE" ||
      !persistedMembership.roles.includes("TENANT_SERVICE")
    ) {
      return fail("MEMBERSHIP_AUTHORITY_MISMATCH");
    }

    let tenantSnapshot;

    try {
      tenantSnapshot = await this.firestore
        .collection(FIRESTORE_AUTHORITY_COLLECTIONS.TENANTS)
        .doc(persistedMembership.tenantId)
        .get();
    } catch {
      return fail("TENANT_LOOKUP_FAILED");
    }

    if (!tenantSnapshot.exists) {
      return fail("TENANT_NOT_FOUND");
    }

    let persistedTenant;

    try {
      persistedTenant =
        validatePersistedTenantAuthorityRecordV1(
          tenantSnapshot.data(),
          tenantSnapshot.id,
        );
    } catch {
      return fail("INVALID_TENANT_DOCUMENT");
    }

    if (
      persistedTenant.status !== "ACTIVE" ||
      persistedTenant.tenantId !== persistedMembership.tenantId
    ) {
      return fail("TENANT_AUTHORITY_MISMATCH");
    }

    const resolvedAt =
      canonicalResolutionTimestamp(this.now());

    if (
      Date.parse(resolvedAt) <
        Date.parse(persistedMembership.updatedAt) ||
      Date.parse(resolvedAt) <
        Date.parse(persistedTenant.updatedAt) ||
      Date.parse(resolvedAt) <
        Date.parse(binding.verifiedAt)
    ) {
      return fail("INVALID_RESOLUTION_TIME");
    }

    const tenant =
      createCanonicalTenantAuthorityV1({
        schemaVersion: "1",
        tenantId: persistedTenant.tenantId,
        status: "ACTIVE",
        authorityVersion:
          String(persistedTenant.authorityVersion),
        resolvedAt,
        tenantRecordVersion:
          String(persistedTenant.recordVersion),
        ...(persistedTenant.tenantSlug === undefined
          ? {}
          : {
              tenantSlug: persistedTenant.tenantSlug,
            }),
        ...(persistedTenant.organizationReference === undefined
          ? {}
          : {
              organizationReference:
                persistedTenant.organizationReference,
            }),
        ...(persistedTenant.clientReference === undefined
          ? {}
          : {
              clientReference:
                persistedTenant.clientReference,
            }),
      });

    const membership =
      createServerOwnedTenantMembershipRecordV1({
        schemaVersion: "1",
        membershipId: persistedMembership.membershipId,
        principalType: persistedMembership.principalType,
        principalId: persistedMembership.principalId,
        tenantId: persistedMembership.tenantId,
        roles: persistedMembership.roles,
        status: "ACTIVE",
        membershipVersion:
          String(persistedMembership.membershipVersion),
        createdAt: persistedMembership.createdAt,
        updatedAt: persistedMembership.updatedAt,
        authorityVersion:
          String(persistedMembership.authorityVersion),
      });

    return Object.freeze({
      binding,
      tenant,
      membership,
      resolvedAt,
    });
  }
}