import { beforeEach, describe, expect, it, vi } from "vitest";

const callableMock = vi.hoisted(() => vi.fn());
const httpsCallableMock = vi.hoisted(() => vi.fn(() => callableMock));

vi.mock("firebase/functions", () => ({ httpsCallable: httpsCallableMock }));
vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  getDocs: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
  serverTimestamp: vi.fn(),
  updateDoc: vi.fn(),
}));
vi.mock("../config/firebase", () => ({ db: {}, functions: {} }));

import {
  createLead,
  getCreateLeadSafeMessage,
  type CreateLeadInput,
} from "./platformLeadService";

function input(): CreateLeadInput {
  return {
    companyName: "Synthetic Company",
    contactName: "Synthetic Contact",
    email: "synthetic@example.invalid",
    phone: "",
    source: "INBOUND",
    leadSourceCode: "INBOUND",
    leadSourceLabel: "Inbound",
    interestedModules: ["AURA_HCM"],
    notes: "",
    nextFollowUpDate: "",
  };
}

describe("platformLeadService backend create migration", () => {
  beforeEach(() => {
    callableMock.mockReset();
    httpsCallableMock.mockClear();
    vi.stubGlobal("crypto", { randomUUID: () => "12345678-1234-4234-8234-123456789012" });
  });

  it("uses the createCrmLead callable exactly once", async () => {
    callableMock.mockResolvedValue({
      data: { schemaVersion: "CreateCrmLeadResultV1", action: "CREATED" },
    });
    await expect(createLead(input())).resolves.toMatchObject({ action: "CREATED" });
    expect(httpsCallableMock).toHaveBeenCalledWith({}, "createCrmLead");
    expect(callableMock).toHaveBeenCalledTimes(1);
  });

  it("sends no server-owned fields", async () => {
    callableMock.mockResolvedValue({
      data: { schemaVersion: "CreateCrmLeadResultV1", action: "CREATED" },
    });
    await createLead(input());
    const payload = callableMock.mock.calls[0][0] as Record<string, unknown>;
    const lead = payload.lead as Record<string, unknown>;
    for (const field of ["id", "stage", "createdAt", "updatedAt", "createdBy", "role", "capabilities", "environment", "audit"]) {
      expect(lead).not.toHaveProperty(field);
    }
  });

  it("does not add an automatic client retry after backend failure", async () => {
    callableMock.mockRejectedValue({ code: "functions/internal" });
    await expect(createLead(input())).rejects.toEqual({ code: "functions/internal" });
    expect(callableMock).toHaveBeenCalledTimes(1);
  });

  it("normalizes permission denied without internal details", () => {
    expect(getCreateLeadSafeMessage({ code: "functions/permission-denied", details: "secret" }))
      .toBe("No tienes permiso para crear prospectos.");
  });

  it("rejects malformed backend success and creates no optimistic duplicate", async () => {
    callableMock.mockResolvedValue({ data: { action: "CREATED" } });
    await expect(createLead(input())).rejects.toThrow("CRM_CREATE_RESPONSE_INVALID");
    expect(callableMock).toHaveBeenCalledTimes(1);
  });
});
