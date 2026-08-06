import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { AuthorityProvisioningError, AUTHORITY_PROVISIONING_RECORD_VERSION, CONTROLLED_PREVIEW_HAPPY_PATH, type PlatformPrincipalV1 } from "@aura/intelligence-os/server";
import { FirestoreAuthorityProvisioningTransactionV1, PREVIEW_AUTHORITY_COLLECTIONS_V1 } from "../src/infrastructure/firestore/authorityProvisioning";
import type { Firestore } from "firebase-admin/firestore";

interface Ref { kind: "doc"; path: string }
interface QueryRef { kind: "query"; collection: string }
function fakeFirestore(options: { fail?: boolean; document?: unknown } = {}) {
  const writes: Array<{ path: string; value: unknown }> = [];
  const firestore = {
    collection(name: string) {
      return {
        doc(id: string): Ref { return { kind: "doc", path: `${name}/${id}` }; },
        where(): { limit(): QueryRef } { return { limit: () => ({ kind: "query", collection: name }) }; },
      };
    },
    async runTransaction(operation: (transaction: unknown) => Promise<unknown>) {
      if (options.fail) throw new Error("database detail must not escape");
      return operation({
        get: async (target: Ref | QueryRef) => target.kind === "query"
          ? { docs: [] }
          : { data: () => options.document },
        create: (target: Ref, value: unknown) => { writes.push({ path: target.path, value }); },
      });
    },
  } as unknown as Firestore;
  return { firestore, writes };
}

function principal(overrides: Record<string, unknown> = {}): PlatformPrincipalV1 {
  return {
    schemaVersion: AUTHORITY_PROVISIONING_RECORD_VERSION,
    principalId: "principal-0000000000000000000000000000000000000001",
    authUid: "synthetic-preview-uid-0001",
    status: "ACTIVE",
    environment: "PREVIEW",
    createdAt: "2026-08-06T12:00:00.000Z",
    updatedAt: "2026-08-06T12:00:00.000Z",
    testMetadata: { label: "AI02H2-PREVIEW-SYNTHETIC-IDENTITY-01", approvedUse: CONTROLLED_PREVIEW_HAPPY_PATH, synthetic: true },
    ...overrides,
  } as PlatformPrincipalV1;
}

describe("Firestore Authority Provisioning adapter", () => {
  it("uses only the certified authoritative collections plus audit", () => {
    expect(PREVIEW_AUTHORITY_COLLECTIONS_V1).toEqual({ principals: "platform_global_admins", tenants: "platform_tenants", memberships: "tenant_memberships", audit: "authority_audit_events" });
  });
  it("addresses principals by Firebase UID", async () => {
    const fake = fakeFirestore();
    await new FirestoreAuthorityProvisioningTransactionV1(fake.firestore).run(async (unit) => { await unit.principals.create(principal()); });
    expect(fake.writes[0].path).toBe("platform_global_admins/synthetic-preview-uid-0001");
  });
  it("returns no Firestore snapshot from an absent principal read", async () => {
    const fake = fakeFirestore();
    const result = await new FirestoreAuthorityProvisioningTransactionV1(fake.firestore).run((unit) => unit.principals.getByAuthUid("synthetic-preview-uid-0001"));
    expect(result).toBeNull();
  });
  it("decodes a present principal through the closed schema", async () => {
    const fake = fakeFirestore({ document: principal() });
    const result = await new FirestoreAuthorityProvisioningTransactionV1(fake.firestore).run((unit) => unit.principals.getByAuthUid("synthetic-preview-uid-0001"));
    expect(result?.principalId).toContain("principal-");
  });
  it("rejects an unexpected persisted field", async () => {
    const fake = fakeFirestore({ document: principal({ email: "synthetic@example.invalid" }) });
    await expect(new FirestoreAuthorityProvisioningTransactionV1(fake.firestore).run((unit) => unit.principals.getByAuthUid("synthetic-preview-uid-0001"))).rejects.toMatchObject({ code: "INVALID_REQUEST" });
  });
  it("maps database failures to one safe persistence code", async () => {
    const fake = fakeFirestore({ fail: true });
    await expect(new FirestoreAuthorityProvisioningTransactionV1(fake.firestore).run(async () => null)).rejects.toEqual(new AuthorityProvisioningError("PERSISTENCE_FAILURE"));
  });
  it("keeps the composition absent from the public deployment unit", () => {
    expect(fs.readFileSync(path.resolve("functions/src/previewDiscoveryIndex.ts"), "utf8")).not.toMatch(/AuthorityProvisioning|authorityProvisioning/u);
  });
  it("keeps the composition free of callable and HTTP transports", () => {
    expect(fs.readFileSync(path.resolve("functions/src/composition/authorityProvisioning/previewAuthorityProvisioningComposition.ts"), "utf8")).not.toMatch(/onCall|onRequest|https\.on|express\s*\(/u);
  });
});
