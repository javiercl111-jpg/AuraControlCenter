import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Firestore } from "firebase-admin/firestore";
import {
  FirestorePreviewContainmentActivationAuthorityVerifierV1,
} from "../src/infrastructure/firestore/discoveryContainment/FirestorePreviewContainmentActivationAuthorityVerifierV1";
import {
  createPrivatePreviewContainmentActivationCompositionV1,
} from "../src/composition/previewContainmentActivation/PreviewContainmentActivationCompositionV1";

const timestamp = "2026-08-06T19:00:00.000Z";
const tenantId = `tenant-${"a".repeat(64)}`;

interface RecordWithId { id: string; value: Record<string, unknown> }
interface Records {
  principals: RecordWithId[];
  memberships: RecordWithId[];
  tenants: RecordWithId[];
}

function principal(
  role: "actor" | "approver",
  overrides: Record<string, unknown> = {},
): RecordWithId {
  const actor = role === "actor";
  const id = `ai02h2-preview-containment-${role}-01`;
  return {
    id,
    value: {
      schemaVersion: "PREVIEW_AUTHORITY_RECORD_V1",
      principalId: `principal-${(actor ? "b" : "c").repeat(64)}`,
      authUid: id,
      status: "ACTIVE",
      environment: "PREVIEW",
      createdAt: timestamp,
      updatedAt: timestamp,
      testMetadata: {
        label: actor
          ? "AI02H2-PREVIEW-SYNTHETIC-CONTAINMENT-ACTOR-01"
          : "AI02H2-PREVIEW-SYNTHETIC-CONTAINMENT-APPROVER-01",
        approvedUse: "PREVIEW_CONTAINMENT_CONTROL_PLANE",
        synthetic: true,
        authorityProfile: actor
          ? "CONTAINMENT_ACTIVATION_ACTOR"
          : "CONTAINMENT_ACTIVATION_APPROVER",
      },
      ...overrides,
    },
  };
}

function membership(
  role: "actor" | "approver",
  overrides: Record<string, unknown> = {},
): RecordWithId {
  const actor = role === "actor";
  const id = `membership-${actor ? "d" : "e".repeat(64)}`;
  return {
    id,
    value: {
      schemaVersion: "PREVIEW_AUTHORITY_RECORD_V1",
      membershipId: id,
      principalId: `principal-${(actor ? "b" : "c").repeat(64)}`,
      tenantId,
      status: "ACTIVE",
      environment: "PREVIEW",
      capabilities: [actor
        ? "containment.policy.activate"
        : "containment.policy.approve"],
      createdAt: timestamp,
      updatedAt: timestamp,
      ...overrides,
    },
  };
}

function tenant(overrides: Record<string, unknown> = {}): RecordWithId {
  return {
    id: tenantId,
    value: {
      schemaVersion: "PREVIEW_AUTHORITY_RECORD_V1",
      tenantId,
      status: "ACTIVE",
      environment: "PREVIEW",
      tenantType: "SYNTHETIC_TEST",
      createdAt: timestamp,
      updatedAt: timestamp,
      testMetadata: {
        label: "AI02H2-PREVIEW-SYNTHETIC-TENANT-01",
        approvedUse: "CONTROLLED_PREVIEW_HAPPY_PATH",
        synthetic: true,
      },
      ...overrides,
    },
  };
}

function validRecords(): Records {
  return {
    principals: [principal("actor"), principal("approver")],
    memberships: [membership("actor"), membership("approver")],
    tenants: [tenant()],
  };
}

function snapshot(record: RecordWithId | undefined) {
  return {
    id: record?.id ?? "missing",
    exists: record !== undefined,
    data: () => record?.value,
  };
}

function fakeFirestore(records: Records): Firestore {
  const byCollection: Record<string, RecordWithId[]> = {
    platform_global_admins: records.principals,
    tenant_memberships: records.memberships,
    platform_tenants: records.tenants,
  };
  return {
    collection(name: string) {
      const rows = byCollection[name] ?? [];
      return {
        where(field: string, _operator: string, expected: unknown) {
          const filtered = rows.filter(({ value }) => {
            if (field === "testMetadata.authorityProfile") {
              return (value.testMetadata as Record<string, unknown>)?.authorityProfile === expected;
            }
            return value[field] === expected;
          });
          return {
            limit(limit: number) {
              return {
                async get() {
                  const docs = filtered.slice(0, limit).map(snapshot);
                  return { size: docs.length, docs };
                },
              };
            },
          };
        },
        doc(id: string) {
          return { async get() { return snapshot(rows.find((row) => row.id === id)); } };
        },
      };
    },
  } as unknown as Firestore;
}

function input(overrides: Record<string, unknown> = {}) {
  return {
    actor: "CONTAINMENT_ACTIVATION_ACTOR",
    approver: "CONTAINMENT_ACTIVATION_APPROVER",
    reason: "AUTHORITY_COMPOSITION_CERTIFICATION",
    tenantId,
    projectId: "aura-intel-preview",
    ...overrides,
  } as never;
}

async function decision(records: Records, overrides: Record<string, unknown> = {}) {
  return new FirestorePreviewContainmentActivationAuthorityVerifierV1(
    fakeFirestore(records),
  ).verify(input(overrides));
}

describe("Preview containment activation authority composition", () => {
  it("1. resolves the single valid actor", async () => {
    const result = await new FirestorePreviewContainmentActivationAuthorityVerifierV1(
      fakeFirestore(validRecords()),
    ).inspect(input());
    expect(result.eligibleActor).toBe(1);
    expect(result.actor.capability).toBe("containment.policy.activate");
  });

  it("2. resolves the single valid approver", async () => {
    const result = await new FirestorePreviewContainmentActivationAuthorityVerifierV1(
      fakeFirestore(validRecords()),
    ).inspect(input());
    expect(result.eligibleApprover).toBe(1);
    expect(result.approver.capability).toBe("containment.policy.approve");
  });

  it("3. rejects a missing actor principal", async () => {
    const records = validRecords(); records.principals.shift();
    await expect(decision(records)).resolves.toBe("DENY");
  });

  it("4. rejects a missing approver principal", async () => {
    const records = validRecords(); records.principals.pop();
    await expect(decision(records)).resolves.toBe("DENY");
  });

  it("5. rejects an inactive actor principal", async () => {
    const records = validRecords(); records.principals[0] = principal("actor", { status: "INACTIVE" });
    await expect(decision(records)).resolves.toBe("DENY");
  });

  it("6. rejects an inactive approver principal", async () => {
    const records = validRecords(); records.principals[1] = principal("approver", { status: "INACTIVE" });
    await expect(decision(records)).resolves.toBe("DENY");
  });

  it("7. rejects actor equal to approver", async () => {
    await expect(decision(validRecords(), {
      approver: "CONTAINMENT_ACTIVATION_ACTOR",
    })).resolves.toBe("DENY");
  });

  it("8. rejects a cross-tenant actor membership", async () => {
    const records = validRecords(); records.memberships[0] = membership("actor", {
      tenantId: `tenant-${"f".repeat(64)}`,
    });
    await expect(decision(records)).resolves.toBe("DENY");
  });

  it("9. rejects a non-Preview authority record", async () => {
    const records = validRecords(); records.principals[0] = principal("actor", {
      environment: "PRODUCTION",
    });
    await expect(decision(records)).resolves.toBe("DENY");
  });

  it("10. rejects a project other than the exact Preview project", async () => {
    await expect(decision(validRecords(), { projectId: "other-project" })).resolves.toBe("DENY");
  });

  it("11. rejects a missing activate capability", async () => {
    const records = validRecords(); records.memberships[0] = membership("actor", { capabilities: [] });
    await expect(decision(records)).resolves.toBe("DENY");
  });

  it("12. rejects a missing approve capability", async () => {
    const records = validRecords(); records.memberships[1] = membership("approver", { capabilities: [] });
    await expect(decision(records)).resolves.toBe("DENY");
  });

  it("13. rejects wildcard capability", async () => {
    const records = validRecords(); records.memberships[0] = membership("actor", { capabilities: ["*"] });
    await expect(decision(records)).resolves.toBe("DENY");
  });

  it("14. rejects global privilege fields", async () => {
    const records = validRecords(); records.principals[0] = principal("actor", { globalPrivileges: ["admin"] });
    await expect(decision(records)).resolves.toBe("DENY");
  });

  it("15. rejects ambiguous actor principals", async () => {
    const records = validRecords(); records.principals.push(principal("actor", { authUid: "ai02h2-preview-containment-actor-02" }));
    await expect(decision(records)).resolves.toBe("DENY");
  });

  it("16. allows exactly one separated actor/approver pair", async () => {
    const verifier = new FirestorePreviewContainmentActivationAuthorityVerifierV1(fakeFirestore(validRecords()));
    await expect(verifier.verify(input())).resolves.toBe("ALLOW");
    await expect(verifier.inspect(input())).resolves.toMatchObject({ validSeparatedPair: 1 });
  });

  it("17. assembles a private composition without persistence calls", () => {
    const composition = createPrivatePreviewContainmentActivationCompositionV1(
      tenantId, fakeFirestore(validRecords()), { nowEpochMilliseconds: () => 1 },
    );
    expect(composition.authorityVerifier).toBeDefined();
    expect(composition.controlPlane).toBeDefined();
    expect(composition.inspectAuthority).toBeTypeOf("function");
  });

  it("18. has no callable export", () => {
    const source = fs.readFileSync(path.resolve("functions/src/composition/previewContainmentActivation/PreviewContainmentActivationCompositionV1.ts"), "utf8");
    expect(source).not.toMatch(/\bon(?:Call|Request)\s*\(|firebase-functions/u);
  });

  it("19. has no HTTP transport", () => {
    const source = fs.readFileSync(path.resolve("functions/src/composition/previewContainmentActivation/PreviewContainmentActivationCompositionV1.ts"), "utf8");
    expect(source).not.toMatch(/express\s*\(|https?\.|Request\b|Response\b/u);
  });

  it("20. is absent from public and Preview Discovery deployment entrypoints", () => {
    for (const file of ["functions/src/index.ts", "functions/src/previewDiscoveryIndex.ts"]) {
      expect(fs.readFileSync(path.resolve(file), "utf8")).not.toMatch(/PreviewContainmentActivationCompositionV1|FirestorePreviewContainmentActivationAuthorityVerifierV1/u);
    }
  });

  it("21. rejects a missing membership", async () => {
    const records = validRecords(); records.memberships.shift();
    await expect(decision(records)).resolves.toBe("DENY");
  });

  it("22. rejects an inactive membership", async () => {
    const records = validRecords(); records.memberships[1] = membership("approver", { status: "INACTIVE" });
    await expect(decision(records)).resolves.toBe("DENY");
  });

  it("23. rejects ambiguous memberships", async () => {
    const records = validRecords(); records.memberships.push(membership("actor", { membershipId: `membership-${"f".repeat(64)}` }));
    await expect(decision(records)).resolves.toBe("DENY");
  });

  it("24. rejects email or payload as authority selectors", async () => {
    await expect(decision(validRecords(), {
      actor: ["containment.actor.preview", "example.invalid"].join("@"),
    })).resolves.toBe("DENY");
    await expect(decision(validRecords(), { payload: { role: "actor" } })).resolves.toBe("DENY");
  });

  it("25. rejects an inactive or malformed tenant", async () => {
    const inactive = validRecords(); inactive.tenants[0] = tenant({ status: "INACTIVE" });
    await expect(decision(inactive)).resolves.toBe("DENY");
    await expect(decision(validRecords(), { tenantId: "tenant-other" })).resolves.toBe("DENY");
  });
});
