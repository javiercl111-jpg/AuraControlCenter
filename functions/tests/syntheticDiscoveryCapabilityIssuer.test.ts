import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { Firestore } from "firebase-admin/firestore";
import {
  authorizeDiscoveryCapabilityV1,
  hashDiscoveryCapabilityToken,
  SYNTHETIC_DISCOVERY_CAPABILITY_POLICY_V1,
  SyntheticDiscoveryCapabilityIssuerErrorV1,
  SyntheticDiscoveryCapabilityIssuerV1,
  type SyntheticDiscoveryCapabilityPersistenceV1,
  type SyntheticDiscoveryPreparationV1,
} from "../src/discovery/capabilities";
import { FirestoreSyntheticDiscoveryCapabilityPreparationV1 } from
  "../src/infrastructure/firestore/discoveryCapabilities";
import { authorizeEvaluateConversationCapabilityV1 } from
  "../src/intelligence/evaluateConversation";

const NOW = 1_786_469_400_000;
const authority = Object.freeze({
  projectId: SYNTHETIC_DISCOVERY_CAPABILITY_POLICY_V1.projectId,
  environment: SYNTHETIC_DISCOVERY_CAPABILITY_POLICY_V1.environment,
  actorId: SYNTHETIC_DISCOVERY_CAPABILITY_POLICY_V1.authorizedActorId,
  tenantId: SYNTHETIC_DISCOVERY_CAPABILITY_POLICY_V1.tenantId,
});

class MemoryPersistence implements SyntheticDiscoveryCapabilityPersistenceV1 {
  preparation?: SyntheticDiscoveryPreparationV1;
  async prepareAtomic(preparation: SyntheticDiscoveryPreparationV1) {
    if (this.preparation) {
      throw new SyntheticDiscoveryCapabilityIssuerErrorV1("ISSUANCE_CONFLICT");
    }
    this.preparation = preparation;
    return "CREATED" as const;
  }
}

function authorize(
  preparation: SyntheticDiscoveryPreparationV1,
  token: string,
  overrides: Record<string, unknown> = {},
) {
  const policy = SYNTHETIC_DISCOVERY_CAPABILITY_POLICY_V1;
  return authorizeDiscoveryCapabilityV1(preparation.capability, {
    now: NOW,
    tokenHash: hashDiscoveryCapabilityToken(token),
    type: "SESSION",
    purpose: "DISCOVERY_SESSION",
    linkId: policy.linkId,
    sessionId: policy.sessionId,
    environment: policy.environment,
    projectId: policy.projectId,
    tenantId: policy.tenantId,
    fixtureLocator: policy.fixtureLocator,
    requiredCapability: policy.requiredCapability,
    capabilityScope: policy.capabilityScope,
    ...overrides,
  });
}

function fakeFirestore(existing = new Map<string, unknown>()) {
  const writes: Array<{ path: string; value: unknown }> = [];
  const db = {
    collection(collectionName: string) {
      return {
        doc(id: string) { return { path: `${collectionName}/${id}` }; },
      };
    },
    runTransaction(operation: (transaction: unknown) => Promise<unknown>) {
      return operation({
        get: async (ref: { path: string }) => ({
          exists: existing.has(ref.path),
          data: () => existing.get(ref.path),
        }),
        create: (ref: { path: string }, value: unknown) => {
          writes.push({ path: ref.path, value });
        },
      });
    },
  } as unknown as Firestore;
  return { db, writes };
}

describe("SyntheticDiscoveryCapabilityIssuerV1", () => {
  it("returns distinct cryptographically generated bearer values", async () => {
    const first = await new SyntheticDiscoveryCapabilityIssuerV1(
      new MemoryPersistence(), () => NOW,
    ).issue(authority);
    const second = await new SyntheticDiscoveryCapabilityIssuerV1(
      new MemoryPersistence(), () => NOW,
    ).issue(authority);
    expect(first.bearerToken).toMatch(/^[a-f0-9]{64}$/u);
    expect(second.bearerToken).toMatch(/^[a-f0-9]{64}$/u);
    expect(first.bearerToken).not.toBe(second.bearerToken);
  });

  it("persists only the hash and returns plaintext only from memory", async () => {
    const persistence = new MemoryPersistence();
    const handoff = await new SyntheticDiscoveryCapabilityIssuerV1(
      persistence, () => NOW,
    ).issue(authority);
    const serialized = JSON.stringify(persistence.preparation);
    expect(persistence.preparation?.capability.tokenHash)
      .toBe(hashDiscoveryCapabilityToken(handoff.bearerToken));
    expect(persistence.preparation?.capability.tokenHash)
      .not.toBe(handoff.bearerToken);
    expect(serialized).not.toContain(handoff.bearerToken);
    expect(JSON.stringify(handoff)).not.toContain(handoff.bearerToken);
    expect(handoff.handoffBoundary).toBe("AUTHORIZED_IN_MEMORY_CALLER");
  });

  it("hands the bearer in memory to the evaluateConversation verifier", async () => {
    const persistence = new MemoryPersistence();
    const handoff = await new SyntheticDiscoveryCapabilityIssuerV1(
      persistence, () => NOW,
    ).issue(authority);
    let accepted = false;
    await authorizeEvaluateConversationCapabilityV1({
      authorizeSession: async ({ token }) => {
        authorize(persistence.preparation!, token);
        accepted = true;
        return Object.freeze({
          capability: persistence.preparation!.capability,
          linkData: persistence.preparation!.binding,
        });
      },
    }, handoff.bearerToken);
    expect(accepted).toBe(true);
  });

  it("accepts the valid bearer and rejects wrong or expired bearers", async () => {
    const persistence = new MemoryPersistence();
    const handoff = await new SyntheticDiscoveryCapabilityIssuerV1(
      persistence, () => NOW,
    ).issue(authority);
    expect(authorize(persistence.preparation!, handoff.bearerToken).synthetic)
      .toBe(true);
    expect(() => authorize(persistence.preparation!, "0".repeat(64)))
      .toThrowError(expect.objectContaining({ code: "CAPABILITY_NOT_FOUND" }));
    expect(() => authorize(
      persistence.preparation!, handoff.bearerToken,
      { now: handoff.expiresAt },
    )).toThrowError(expect.objectContaining({ code: "CAPABILITY_EXPIRED" }));
  });

  it.each([
    ["tenantId", "tenant-mismatch"],
    ["sessionId", "session-mismatch"],
    ["fixtureLocator", "fixture-mismatch"],
    ["requiredCapability", "ARBITRARY_SCOPE"],
  ])("rejects %s binding mismatch", async (field, value) => {
    const persistence = new MemoryPersistence();
    const handoff = await new SyntheticDiscoveryCapabilityIssuerV1(
      persistence, () => NOW,
    ).issue(authority);
    expect(() => authorize(
      persistence.preparation!, handoff.bearerToken, { [field]: value },
    )).toThrowError(expect.objectContaining({
      code: "CAPABILITY_BINDING_MISMATCH",
    }));
  });

  it.each(["PRODUCTION", "STAGING"])("rejects %s issuance", async (environment) => {
    await expect(new SyntheticDiscoveryCapabilityIssuerV1(
      new MemoryPersistence(), () => NOW,
    ).issue({ ...authority, environment })).rejects.toMatchObject({
      code: "AUTHORITY_REJECTED",
    });
  });

  it("fails closed on repeated conflicting issuance", async () => {
    const persistence = new MemoryPersistence();
    const issuer = new SyntheticDiscoveryCapabilityIssuerV1(
      persistence, () => NOW,
    );
    await issuer.issue(authority);
    await expect(issuer.issue(authority)).rejects.toMatchObject({
      code: "ISSUANCE_CONFLICT",
    });
  });

  it("does not log the bearer", async () => {
    const logs = [
      vi.spyOn(console, "log").mockImplementation(() => undefined),
      vi.spyOn(console, "info").mockImplementation(() => undefined),
      vi.spyOn(console, "warn").mockImplementation(() => undefined),
      vi.spyOn(console, "error").mockImplementation(() => undefined),
    ];
    try {
      const handoff = await new SyntheticDiscoveryCapabilityIssuerV1(
        new MemoryPersistence(), () => NOW,
      ).issue(authority);
      expect(logs.flatMap((spy) => spy.mock.calls).join(" "))
        .not.toContain(handoff.bearerToken);
    } finally {
      logs.forEach((spy) => spy.mockRestore());
    }
  });

  it("creates exactly binding, session, and hash-only capability writes", async () => {
    const memory = new MemoryPersistence();
    await new SyntheticDiscoveryCapabilityIssuerV1(memory, () => NOW)
      .issue(authority);
    const fake = fakeFirestore();
    await new FirestoreSyntheticDiscoveryCapabilityPreparationV1(fake.db)
      .prepareAtomic(memory.preparation!);
    expect(fake.writes).toHaveLength(3);
    expect(fake.writes.map((write) => write.path)).toEqual([
      `market_discovery_links/${SYNTHETIC_DISCOVERY_CAPABILITY_POLICY_V1.linkId}`,
      `discovery_sessions/${SYNTHETIC_DISCOVERY_CAPABILITY_POLICY_V1.sessionId}`,
      `discovery_capabilities_v1/${memory.preparation!.capability.tokenHash}`,
    ]);
    const persisted = JSON.stringify(fake.writes);
    expect(persisted).not.toMatch(/bearerToken|sessionToken|plaintext/u);
  });

  it("accepts an identical three-document state without another write", async () => {
    const memory = new MemoryPersistence();
    await new SyntheticDiscoveryCapabilityIssuerV1(memory, () => NOW)
      .issue(authority);
    const preparation = memory.preparation!;
    const policy = SYNTHETIC_DISCOVERY_CAPABILITY_POLICY_V1;
    const existing = new Map<string, unknown>([
      [`market_discovery_links/${policy.linkId}`, preparation.binding],
      [`discovery_sessions/${policy.sessionId}`, preparation.session],
      [`discovery_capabilities_v1/${preparation.capability.tokenHash}`,
        preparation.capability],
    ]);
    const fake = fakeFirestore(existing);
    await expect(new FirestoreSyntheticDiscoveryCapabilityPreparationV1(fake.db)
      .prepareAtomic(preparation)).resolves.toBe("EXISTING_IDENTICAL");
    expect(fake.writes).toHaveLength(0);
  });

  it("keeps replay and audit-oriented records hash-only", () => {
    const types = fs.readFileSync(path.resolve(
      "functions/src/discovery/capabilities/discoveryCapabilityTypes.ts",
    ), "utf8");
    expect(types).toMatch(/sessionCapabilityHash/u);
    expect(types).toMatch(/reportCapabilityHash/u);
    expect(types).not.toMatch(/DiscoveryCompletionRecordV1[\s\S]*bearerToken/u);
    const issuer = fs.readFileSync(path.resolve(
      "functions/src/discovery/capabilities/syntheticDiscoveryCapabilityIssuerV1.ts",
    ), "utf8");
    expect(issuer).not.toMatch(/audit.*bearer|evidence.*bearer/iu);
  });
});
