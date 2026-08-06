import type { DocumentData, Firestore, Query, Transaction } from "firebase-admin/firestore";
import {
  AuthorityProvisioningError,
  validateAuthorityProvisioningAuditRecordV1,
  validatePlatformPrincipalV1,
  validatePlatformTenantV1,
  validateTenantMembershipV1,
  type AuthorityProvisioningAuditRecordV1,
  type AuthorityProvisioningUnitOfWorkV1,
  type AuthorityTransactionPortV1,
  type PlatformPrincipalV1,
  type PlatformTenantV1,
  type TenantMembershipV1,
} from "@aura/intelligence-os/server";

export const PREVIEW_AUTHORITY_COLLECTIONS_V1 = Object.freeze({
  principals: "platform_global_admins",
  tenants: "platform_tenants",
  memberships: "tenant_memberships",
  audit: "authority_audit_events",
} as const);

function persistenceFailure(): never {
  throw new AuthorityProvisioningError("PERSISTENCE_FAILURE");
}

function decode<T>(value: DocumentData | undefined, validator: (candidate: unknown) => T): T | null {
  if (value === undefined) return null;
  return validator(value);
}

function transactionUnit(firestore: Firestore, transaction: Transaction): AuthorityProvisioningUnitOfWorkV1 {
  const principals = firestore.collection(PREVIEW_AUTHORITY_COLLECTIONS_V1.principals);
  const tenants = firestore.collection(PREVIEW_AUTHORITY_COLLECTIONS_V1.tenants);
  const memberships = firestore.collection(PREVIEW_AUTHORITY_COLLECTIONS_V1.memberships);
  const audit = firestore.collection(PREVIEW_AUTHORITY_COLLECTIONS_V1.audit);
  return Object.freeze({
    principals: Object.freeze({
      async getByAuthUid(authUid: string): Promise<PlatformPrincipalV1 | null> {
        return decode((await transaction.get(principals.doc(authUid))).data(), validatePlatformPrincipalV1);
      },
      async create(record: PlatformPrincipalV1): Promise<void> {
        const validated = validatePlatformPrincipalV1(record);
        transaction.create(principals.doc(validated.authUid), validated);
      },
    }),
    tenants: Object.freeze({
      async getByTenantId(tenantId: string): Promise<PlatformTenantV1 | null> {
        return decode((await transaction.get(tenants.doc(tenantId))).data(), validatePlatformTenantV1);
      },
      async create(record: PlatformTenantV1): Promise<void> {
        const validated = validatePlatformTenantV1(record);
        transaction.create(tenants.doc(validated.tenantId), validated);
      },
    }),
    memberships: Object.freeze({
      async getByMembershipId(membershipId: string): Promise<TenantMembershipV1 | null> {
        return decode((await transaction.get(memberships.doc(membershipId))).data(), validateTenantMembershipV1);
      },
      async listByPrincipalId(principalId: string): Promise<readonly TenantMembershipV1[]> {
        const query: Query = memberships.where("principalId", "==", principalId).limit(2);
        const snapshot = await transaction.get(query);
        return Object.freeze(snapshot.docs.map((item) => validateTenantMembershipV1(item.data())));
      },
      async create(record: TenantMembershipV1): Promise<void> {
        const validated = validateTenantMembershipV1(record);
        transaction.create(memberships.doc(validated.membershipId), validated);
      },
    }),
    audit: Object.freeze({
      async getByAuditId(auditId: string): Promise<AuthorityProvisioningAuditRecordV1 | null> {
        return decode((await transaction.get(audit.doc(auditId))).data(), validateAuthorityProvisioningAuditRecordV1);
      },
      async create(record: AuthorityProvisioningAuditRecordV1): Promise<void> {
        const validated = validateAuthorityProvisioningAuditRecordV1(record);
        transaction.create(audit.doc(validated.auditId), validated);
      },
    }),
  });
}

export class FirestoreAuthorityProvisioningTransactionV1 implements AuthorityTransactionPortV1 {
  readonly #firestore: Firestore;
  constructor(firestore: Firestore) { this.#firestore = firestore; }
  async run<T>(operation: (unit: AuthorityProvisioningUnitOfWorkV1) => Promise<T>): Promise<T> {
    try {
      return await this.#firestore.runTransaction((transaction) => operation(transactionUnit(this.#firestore, transaction)));
    } catch (error: unknown) {
      if (error instanceof AuthorityProvisioningError) throw error;
      return persistenceFailure();
    }
  }
}
