import { createHash } from "node:crypto";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import {
  createAuthorityProvisioningServiceV1,
  type AuthorityFingerprintProviderV1,
  type AuthorityIdProviderV1,
  type AuthorityProvisioningServiceV1,
} from "@aura/intelligence-os/server";
import { FirestoreAuthorityProvisioningTransactionV1 } from "../../infrastructure/firestore/authorityProvisioning";

function digest(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function createPrivatePreviewAuthorityProvisioningCompositionV1(
  firestore: Firestore = getFirestore(),
): AuthorityProvisioningServiceV1 {
  const ids: AuthorityIdProviderV1 = Object.freeze({
    principalId: (input: Readonly<{ authUid: string; identityLabel: string }>) =>
      `principal-${digest(`${input.authUid}\u0000${input.identityLabel}`)}`,
    tenantId: (input: Readonly<{ tenantLabel: string }>) =>
      `tenant-${digest(input.tenantLabel)}`,
    membershipId: (input: Readonly<{ principalId: string; tenantId: string }>) =>
      `membership-${digest(`${input.principalId}\u0000${input.tenantId}`)}`,
    auditId: (input: Readonly<{ idempotencyKey: string }>) =>
      `authority-audit-${digest(input.idempotencyKey)}`,
  });
  const fingerprints: AuthorityFingerprintProviderV1 = Object.freeze({
    fingerprint: (value: unknown) => `sha256:${digest(stable(value))}`,
  });
  return createAuthorityProvisioningServiceV1({
    transaction: new FirestoreAuthorityProvisioningTransactionV1(firestore),
    clock: Object.freeze({ now: () => new Date().toISOString() }),
    ids,
    fingerprints,
  });
}
