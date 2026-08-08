import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  CRM_LEAD_CREATE_CAPABILITY_V1,
  CrmLeadCreateErrorV1,
  parseCreateCrmLeadRequestV1,
} from "../../src/crm/createCrmLeadContractV1";
import {
  CreateCrmLeadServiceV1,
  type CrmLeadCreateAuthorityV1,
  type CrmLeadCreatePersistenceCommandV1,
} from "../../src/crm/createCrmLeadCoreV1";

const root = resolve(__dirname, "..", "..", "..");
const source = (path: string): string =>
  readFileSync(resolve(root, path), "utf8");

function request(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: "CreateCrmLeadRequestV1",
    idempotencyKey: "12345678-1234-4234-8234-123456789012",
    lead: {
      companyName: "Synthetic Company",
      contactName: "Synthetic Contact",
      email: "synthetic@example.invalid",
      phone: "",
      source: "INBOUND",
      leadSourceCode: "INBOUND",
      leadSourceLabel: "Inbound",
      interestedModules: ["AURA_HCM"],
      notes: "",
    },
    ...overrides,
  };
}

function authority(
  value: CrmLeadCreateAuthorityV1 | null = {
    role: "VIEWER",
    isActive: true,
    capabilities: [CRM_LEAD_CREATE_CAPABILITY_V1],
  },
) {
  return { resolve: async () => value };
}

function persistence() {
  const commands: CrmLeadCreatePersistenceCommandV1[] = [];
  const records = new Map<string, string>();
  return {
    commands,
    records,
    port: {
      create: async (command: CrmLeadCreatePersistenceCommandV1) => {
        commands.push(command);
        const hash = JSON.stringify(command.lead);
        const existing = records.get(command.idempotencyKey);
        if (existing !== undefined && existing !== hash) {
          throw new CrmLeadCreateErrorV1("IDEMPOTENCY_CONFLICT");
        }
        if (existing === hash) return "REUSED" as const;
        records.set(command.idempotencyKey, hash);
        return "CREATED" as const;
      },
    },
  };
}

function service(
  resolved?: CrmLeadCreateAuthorityV1 | null,
) {
  const store = persistence();
  return {
    store,
    service: new CreateCrmLeadServiceV1(authority(resolved), store.port),
  };
}

const invocation = {
  auth: { uid: "synthetic-uid-not-evidence" },
  app: { appId: "synthetic-app" },
};

describe("Create CRM lead backend enforcement", () => {
  it("01 rejects unauthenticated callers", async () => {
    await expect(service().service.execute(request(), { app: invocation.app }))
      .rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("02 rejects missing App Check evidence", async () => {
    await expect(service().service.execute(request(), { auth: invocation.auth }))
      .rejects.toMatchObject({ code: "APP_CHECK_REJECTED" });
  });

  it("03 rejects a principal without crm.leads.create", async () => {
    const harness = service({ role: "VIEWER", isActive: true, capabilities: [] });
    await expect(harness.service.execute(request(), invocation))
      .rejects.toMatchObject({ code: "PERMISSION_DENIED" });
  });

  it("04 accepts exactly crm.leads.create", async () => {
    await expect(service().service.execute(request(), invocation))
      .resolves.toMatchObject({ action: "CREATED" });
  });

  it("05 keeps VIEWER rejected without the explicit capability", async () => {
    const harness = service({ role: "VIEWER", isActive: true, capabilities: [] });
    await expect(harness.service.execute(request(), invocation))
      .rejects.toMatchObject({ code: "PERMISSION_DENIED" });
  });

  it("06 rejects an invalid payload", () => {
    expect(() => parseCreateCrmLeadRequestV1(request({ lead: null })))
      .toThrowError("INVALID_ARGUMENT");
  });

  it("07 rejects an unexpected request field", () => {
    expect(() => parseCreateCrmLeadRequestV1(request({ role: "ADMIN" })))
      .toThrowError("INVALID_ARGUMENT");
  });

  it.each(["id", "createdAt", "updatedAt", "createdBy", "actorUid", "role", "capabilities", "environment", "audit"])(
    "08 rejects the client-controlled authoritative field %s",
    (field) => {
      const candidate = request();
      expect(() => parseCreateCrmLeadRequestV1({
        ...candidate,
        lead: { ...candidate.lead, [field]: "forbidden" },
      })).toThrowError("INVALID_ARGUMENT");
    },
  );

  it("09 keeps timestamps server-owned", () => {
    const adapter = source("functions/src/crm/firestoreCrmLeadCreateV1.ts");
    expect(adapter).toContain("FieldValue.serverTimestamp()");
    const clientService = source("src/services/platformLeadService.ts");
    const clientCreateBlock = clientService.slice(
      clientService.indexOf("export async function createLead"),
      clientService.indexOf("export async function updateLeadStage"),
    );
    expect(clientCreateBlock).not.toMatch(/createdAt\s*:|updatedAt\s*:/u);
  });

  it("10 generates the lead document ID on the server", () => {
    const adapter = source("functions/src/crm/firestoreCrmLeadCreateV1.ts");
    expect(adapter).toContain("this.db.collection(LEADS).doc()");
    expect(adapter).not.toContain("command.lead.id");
  });

  it("11 returns CREATED for the first valid request", async () => {
    await expect(service().service.execute(request(), invocation))
      .resolves.toEqual({ schemaVersion: "CreateCrmLeadResultV1", action: "CREATED" });
  });

  it("12 returns REUSED for an identical replay", async () => {
    const harness = service();
    await harness.service.execute(request(), invocation);
    await expect(harness.service.execute(request(), invocation))
      .resolves.toMatchObject({ action: "REUSED" });
  });

  it("13 adds zero duplicate business persistence on identical replay", async () => {
    const harness = service();
    await harness.service.execute(request(), invocation);
    await harness.service.execute(request(), invocation);
    expect(harness.store.records).toHaveLength(1);
  });

  it("14 rejects a conflicting replay", async () => {
    const harness = service();
    await harness.service.execute(request(), invocation);
    const changed = request();
    await expect(harness.service.execute({
      ...changed,
      lead: { ...changed.lead, companyName: "Changed Company" },
    }, invocation)).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
    expect(harness.store.records).toHaveLength(1);
  });

  it("15 emits a durable audit in the creation transaction", () => {
    const adapter = source("functions/src/crm/firestoreCrmLeadCreateV1.ts");
    expect(adapter).toContain("transaction.create(auditRef");
    expect(adapter).toContain('operation: CRM_LEAD_CREATE_CAPABILITY_V1');
  });

  it("16 restricts audit fields to sanitized locators", () => {
    const adapter = source("functions/src/crm/firestoreCrmLeadCreateV1.ts");
    const auditBlock = adapter.slice(
      adapter.indexOf("transaction.create(auditRef"),
      adapter.indexOf('return "CREATED"'),
    );
    expect(auditBlock).toContain("actorLocator");
    expect(auditBlock).toContain("leadLocator");
    expect(auditBlock).not.toMatch(/email|phone|companyName|contactName|actorUid\s*:/u);
  });

  it("17 does not authorize through role escalation", () => {
    const core = source("functions/src/crm/createCrmLeadCoreV1.ts");
    expect(core).not.toMatch(/ADMIN|SUPER_ADMIN|PLATFORM_OWNER/u);
    const rbac = source("src/services/rbacService.ts");
    expect(rbac.match(/VIEWER:\s*\[([\s\S]*?)\]/u)?.[1])
      .not.toContain("crm.leads.create");
  });

  it("18 pins the runtime to aura-intel-preview", () => {
    const deployment = source("functions/src/discovery/deployment/previewDiscoveryDeploymentUnitV1.ts");
    expect(deployment).toContain('"aura-intel-preview"');
    expect(deployment).toContain("assertPreviewDiscoveryRuntimeV1");
  });

  it("19 rejects Staging and Production through the reused runtime guard", () => {
    const callable = source("functions/src/crm/createCrmLead.ts");
    expect(callable).toContain("assertPreviewDiscoveryRuntimeV1()");
    const runtime = source("functions/src/discovery/runtimeContracts/runtimeEnvironmentV1.ts");
    expect(runtime).toContain("RUNTIME_ENVIRONMENT_PROJECT_MISMATCH");
  });

  it("20 touches only the CRM lead plus explicit control metadata", () => {
    const adapter = source("functions/src/crm/firestoreCrmLeadCreateV1.ts");
    expect(adapter).toContain('const LEADS = "platform_leads"');
    expect(adapter).toContain('const IDEMPOTENCY = "crm_lead_create_idempotency"');
    expect(adapter).toContain('const AUDIT = "platform_audit_logs"');
    expect(adapter).not.toMatch(/platform_clients|platform_tenants|tenant_memberships/u);
  });

  it("21 bounds strings, arrays, dates, and estimated value", () => {
    const candidate = request();
    expect(() => parseCreateCrmLeadRequestV1({
      ...candidate,
      lead: { ...candidate.lead, notes: "x".repeat(5_001) },
    })).toThrowError("INVALID_ARGUMENT");
    expect(() => parseCreateCrmLeadRequestV1({
      ...candidate,
      lead: { ...candidate.lead, interestedModules: [] },
    })).toThrowError("INVALID_ARGUMENT");
  });

  it("22 rejects inactive principals even when a capability is present", async () => {
    const harness = service({
      role: "VIEWER",
      isActive: false,
      capabilities: [CRM_LEAD_CREATE_CAPABILITY_V1],
    });
    await expect(harness.service.execute(request(), invocation))
      .rejects.toMatchObject({ code: "PERMISSION_DENIED" });
  });
});
