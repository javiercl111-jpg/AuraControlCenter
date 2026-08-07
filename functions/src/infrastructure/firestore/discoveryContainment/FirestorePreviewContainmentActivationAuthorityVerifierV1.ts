import { createHash } from "node:crypto";
import type {
  DocumentData,
  Firestore,
  QueryDocumentSnapshot,
} from "firebase-admin/firestore";
import type {
  PreviewContainmentActivationAuthorityVerifierV1,
} from "../../../discovery/containment/controlPlane/previewContainmentActivationTypesV1";

export const PREVIEW_CONTAINMENT_ACTOR_PROFILE_V1 =
  "CONTAINMENT_ACTIVATION_ACTOR" as const;
export const PREVIEW_CONTAINMENT_APPROVER_PROFILE_V1 =
  "CONTAINMENT_ACTIVATION_APPROVER" as const;
export const PREVIEW_CONTAINMENT_ACTOR_CAPABILITY_V1 =
  "containment.policy.activate" as const;
export const PREVIEW_CONTAINMENT_APPROVER_CAPABILITY_V1 =
  "containment.policy.approve" as const;

const PROJECT_ID = "aura-intel-preview" as const;
const ENVIRONMENT = "PREVIEW" as const;
const AUTHORITY_RECORD_VERSION = "PREVIEW_AUTHORITY_RECORD_V1" as const;
const APPROVED_USE = "PREVIEW_CONTAINMENT_CONTROL_PLANE" as const;
const TENANT_APPROVED_USE = "CONTROLLED_PREVIEW_HAPPY_PATH" as const;
const TENANT_LABEL = "AI02H2-PREVIEW-SYNTHETIC-TENANT-01" as const;
const PRINCIPALS = "platform_global_admins" as const;
const MEMBERSHIPS = "tenant_memberships" as const;
const TENANTS = "platform_tenants" as const;
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{9,159}$/;
const TENANT = /^tenant-[a-f0-9]{32,64}$/;
const REASON = /^[A-Z][A-Z0-9_]{1,95}$/;

type AuthorityProfileV1 =
  | typeof PREVIEW_CONTAINMENT_ACTOR_PROFILE_V1
  | typeof PREVIEW_CONTAINMENT_APPROVER_PROFILE_V1;
type AuthorityCapabilityV1 =
  | typeof PREVIEW_CONTAINMENT_ACTOR_CAPABILITY_V1
  | typeof PREVIEW_CONTAINMENT_APPROVER_CAPABILITY_V1;

const AUTHORITY_LABELS: Readonly<Record<AuthorityProfileV1, string>> = Object.freeze({
  CONTAINMENT_ACTIVATION_ACTOR:
    "AI02H2-PREVIEW-SYNTHETIC-CONTAINMENT-ACTOR-01",
  CONTAINMENT_ACTIVATION_APPROVER:
    "AI02H2-PREVIEW-SYNTHETIC-CONTAINMENT-APPROVER-01",
});

interface PrincipalV1 {
  readonly principalId: string;
  readonly authUid: string;
  readonly profile: AuthorityProfileV1;
}

interface MembershipV1 {
  readonly membershipId: string;
  readonly principalId: string;
  readonly tenantId: string;
  readonly capability: AuthorityCapabilityV1;
}

export interface PreviewContainmentAuthorityInspectionV1 {
  readonly eligibleActor: 1;
  readonly eligibleApprover: 1;
  readonly validSeparatedPair: 1;
  readonly actor: Readonly<{
    identityLocator: string;
    principalLocator: string;
    membershipLocator: string;
    capability: typeof PREVIEW_CONTAINMENT_ACTOR_CAPABILITY_V1;
  }>;
  readonly approver: Readonly<{
    identityLocator: string;
    principalLocator: string;
    membershipLocator: string;
    capability: typeof PREVIEW_CONTAINMENT_APPROVER_CAPABILITY_V1;
  }>;
  readonly tenantLocator: string;
}

type VerifyInput = Parameters<PreviewContainmentActivationAuthorityVerifierV1["verify"]>[0];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return actual.length === sortedExpected.length &&
    actual.every((key, index) => key === sortedExpected[index]);
}

function validTimestamp(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString() === value;
}

function reject(): never {
  throw new Error("PREVIEW_CONTAINMENT_AUTHORITY_REJECTED");
}

function safeLocator(value: string): string {
  return `sha256:${createHash("sha256").update(value, "utf8").digest("hex").slice(0, 12)}`;
}

function decodePrincipal(
  snapshot: QueryDocumentSnapshot<DocumentData>,
  expectedProfile: AuthorityProfileV1,
): PrincipalV1 {
  const value: unknown = snapshot.data();
  if (!isRecord(value) || !hasExactKeys(value, [
    "schemaVersion", "principalId", "authUid", "status", "environment",
    "createdAt", "updatedAt", "testMetadata",
  ]) || value.schemaVersion !== AUTHORITY_RECORD_VERSION || value.status !== "ACTIVE" ||
      value.environment !== ENVIRONMENT || typeof value.principalId !== "string" ||
      !IDENTIFIER.test(value.principalId) || typeof value.authUid !== "string" ||
      !IDENTIFIER.test(value.authUid) || snapshot.id !== value.authUid ||
      !validTimestamp(value.createdAt) || !validTimestamp(value.updatedAt) ||
      !isRecord(value.testMetadata) || !hasExactKeys(value.testMetadata, [
        "label", "approvedUse", "synthetic", "authorityProfile",
      ]) || value.testMetadata.label !== AUTHORITY_LABELS[expectedProfile] ||
      value.testMetadata.approvedUse !== APPROVED_USE ||
      value.testMetadata.synthetic !== true ||
      value.testMetadata.authorityProfile !== expectedProfile) {
    return reject();
  }
  return Object.freeze({
    principalId: value.principalId,
    authUid: value.authUid,
    profile: expectedProfile,
  });
}

function decodeMembership(
  snapshot: QueryDocumentSnapshot<DocumentData>,
  principalId: string,
  tenantId: string,
  expectedCapability: AuthorityCapabilityV1,
): MembershipV1 {
  const value: unknown = snapshot.data();
  if (!isRecord(value) || !hasExactKeys(value, [
    "schemaVersion", "membershipId", "principalId", "tenantId", "status",
    "environment", "capabilities", "createdAt", "updatedAt",
  ]) || value.schemaVersion !== AUTHORITY_RECORD_VERSION || value.status !== "ACTIVE" ||
      value.environment !== ENVIRONMENT || typeof value.membershipId !== "string" ||
      !IDENTIFIER.test(value.membershipId) || snapshot.id !== value.membershipId ||
      value.principalId !== principalId || value.tenantId !== tenantId ||
      !Array.isArray(value.capabilities) || value.capabilities.length !== 1 ||
      value.capabilities[0] !== expectedCapability ||
      !validTimestamp(value.createdAt) || !validTimestamp(value.updatedAt)) {
    return reject();
  }
  return Object.freeze({
    membershipId: value.membershipId,
    principalId,
    tenantId,
    capability: expectedCapability,
  });
}

function decodeTenant(value: unknown, documentId: string, expectedTenantId: string): void {
  if (!isRecord(value) || !hasExactKeys(value, [
    "schemaVersion", "tenantId", "status", "environment", "tenantType",
    "createdAt", "updatedAt", "testMetadata",
  ]) || value.schemaVersion !== AUTHORITY_RECORD_VERSION || value.tenantId !== expectedTenantId ||
      documentId !== expectedTenantId || value.status !== "ACTIVE" ||
      value.environment !== ENVIRONMENT || value.tenantType !== "SYNTHETIC_TEST" ||
      !validTimestamp(value.createdAt) || !validTimestamp(value.updatedAt) ||
      !isRecord(value.testMetadata) || !hasExactKeys(value.testMetadata, [
        "label", "approvedUse", "synthetic",
      ]) || value.testMetadata.label !== TENANT_LABEL ||
      value.testMetadata.approvedUse !== TENANT_APPROVED_USE ||
      value.testMetadata.synthetic !== true) {
    reject();
  }
}

export class FirestorePreviewContainmentActivationAuthorityVerifierV1
implements PreviewContainmentActivationAuthorityVerifierV1 {
  constructor(private readonly firestore: Firestore) {}

  private async resolve(
    profile: AuthorityProfileV1,
    capability: AuthorityCapabilityV1,
    tenantId: string,
  ): Promise<Readonly<{ principal: PrincipalV1; membership: MembershipV1 }>> {
    const principalSnapshot = await this.firestore.collection(PRINCIPALS)
      .where("testMetadata.authorityProfile", "==", profile).limit(2).get();
    if (principalSnapshot.size !== 1) return reject();
    const principal = decodePrincipal(principalSnapshot.docs[0], profile);
    const membershipSnapshot = await this.firestore.collection(MEMBERSHIPS)
      .where("principalId", "==", principal.principalId).limit(2).get();
    if (membershipSnapshot.size !== 1) return reject();
    const membership = decodeMembership(
      membershipSnapshot.docs[0], principal.principalId, tenantId, capability,
    );
    return Object.freeze({ principal, membership });
  }

  async inspect(input: VerifyInput): Promise<PreviewContainmentAuthorityInspectionV1> {
    if (!isRecord(input) || !hasExactKeys(input, [
      "actor", "approver", "reason", "tenantId", "projectId",
    ]) || input.actor !== PREVIEW_CONTAINMENT_ACTOR_PROFILE_V1 ||
        input.approver !== PREVIEW_CONTAINMENT_APPROVER_PROFILE_V1 ||
        input.projectId !== PROJECT_ID ||
        typeof input.reason !== "string" || !REASON.test(input.reason) ||
        typeof input.tenantId !== "string" || !TENANT.test(input.tenantId)) {
      return reject();
    }
    const tenantSnapshot = await this.firestore.collection(TENANTS).doc(input.tenantId).get();
    if (!tenantSnapshot.exists) return reject();
    decodeTenant(tenantSnapshot.data(), tenantSnapshot.id, input.tenantId);
    const [actor, approver] = await Promise.all([
      this.resolve(PREVIEW_CONTAINMENT_ACTOR_PROFILE_V1,
        PREVIEW_CONTAINMENT_ACTOR_CAPABILITY_V1, input.tenantId),
      this.resolve(PREVIEW_CONTAINMENT_APPROVER_PROFILE_V1,
        PREVIEW_CONTAINMENT_APPROVER_CAPABILITY_V1, input.tenantId),
    ]);
    if (actor.principal.authUid === approver.principal.authUid ||
        actor.principal.principalId === approver.principal.principalId ||
        actor.membership.membershipId === approver.membership.membershipId) {
      return reject();
    }
    return Object.freeze({
      eligibleActor: 1,
      eligibleApprover: 1,
      validSeparatedPair: 1,
      actor: Object.freeze({
        identityLocator: safeLocator(actor.principal.authUid),
        principalLocator: safeLocator(actor.principal.principalId),
        membershipLocator: safeLocator(actor.membership.membershipId),
        capability: PREVIEW_CONTAINMENT_ACTOR_CAPABILITY_V1,
      }),
      approver: Object.freeze({
        identityLocator: safeLocator(approver.principal.authUid),
        principalLocator: safeLocator(approver.principal.principalId),
        membershipLocator: safeLocator(approver.membership.membershipId),
        capability: PREVIEW_CONTAINMENT_APPROVER_CAPABILITY_V1,
      }),
      tenantLocator: safeLocator(input.tenantId),
    });
  }

  async verify(input: VerifyInput): Promise<"ALLOW" | "DENY"> {
    try {
      await this.inspect(input);
      return "ALLOW";
    } catch {
      return "DENY";
    }
  }
}
