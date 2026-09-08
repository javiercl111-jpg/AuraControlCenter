import { beforeEach, describe, expect, it, vi } from "vitest";
import { httpsCallable } from "firebase/functions";

import {
  getGrowthSocialProfileById,
  listGrowthSocialProfiles,
  upsertGrowthSocialProfile,
  type GrowthSocialProfileBinding,
} from "./growthSocialProfileService";

vi.mock("firebase/functions", () => ({
  httpsCallable: vi.fn(),
}));

vi.mock("../config/firebase", () => ({
  functions: {},
}));

const mockedHttpsCallable = vi.mocked(httpsCallable);

const sampleBinding: GrowthSocialProfileBinding = {
  bindingId: "linkedin-aura-nexus",
  tenantId: "aura_root",
  provider: "LINKEDIN",
  accountType: "ORGANIZATION",
  externalAccountId: "aura-nexus-linkedin",
  displayName: "Aura Nexus",
  connectionState: "PENDING",
  isActive: true,
  createdAt: "2026-09-08T16:00:00.000Z",
  updatedAt: "2026-09-08T16:00:00.000Z",
};

describe("growthSocialProfileService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists without sending tenantId", async () => {
    const callable = vi.fn().mockResolvedValue({
      data: {
        status: "SUCCEEDED",
        operation: "LIST_BY_TENANT",
        tenantId: "aura_root",
        principalId: "principal-1",
        role: "SUPER_ADMIN",
        bindings: [sampleBinding],
      },
    });

    mockedHttpsCallable.mockReturnValue(callable as never);

    const result = await listGrowthSocialProfiles({
      activeOnly: false,
    });

    expect(callable).toHaveBeenCalledWith({
      operation: "LIST_BY_TENANT",
      activeOnly: false,
    });

    expect(callable.mock.calls[0]?.[0]).not.toHaveProperty(
      "tenantId"
    );

    expect(result).toEqual([sampleBinding]);
  });

  it("gets by binding id", async () => {
    const callable = vi.fn().mockResolvedValue({
      data: {
        status: "SUCCEEDED",
        operation: "GET_BY_ID",
        tenantId: "aura_root",
        principalId: "principal-1",
        role: "SUPER_ADMIN",
        binding: sampleBinding,
      },
    });

    mockedHttpsCallable.mockReturnValue(callable as never);

    const result = await getGrowthSocialProfileById(
      sampleBinding.bindingId
    );

    expect(callable).toHaveBeenCalledWith({
      operation: "GET_BY_ID",
      bindingId: sampleBinding.bindingId,
    });

    expect(result).toEqual(sampleBinding);
  });

  it("upserts metadata without tenant or publish fields", async () => {
    const callable = vi.fn().mockResolvedValue({
      data: {
        status: "SUCCEEDED",
        operation: "UPSERT",
        tenantId: "aura_root",
        principalId: "principal-1",
        role: "SUPER_ADMIN",
        binding: sampleBinding,
      },
    });

    mockedHttpsCallable.mockReturnValue(callable as never);

    const input = {
      bindingId: sampleBinding.bindingId,
      provider: sampleBinding.provider,
      accountType: sampleBinding.accountType,
      externalAccountId: sampleBinding.externalAccountId,
      displayName: sampleBinding.displayName,
      connectionState: sampleBinding.connectionState,
      isActive: sampleBinding.isActive,
      createdAt: sampleBinding.createdAt,
      updatedAt: sampleBinding.updatedAt,
    } as const;

    await upsertGrowthSocialProfile(input);

    const request = callable.mock.calls[0]?.[0] as {
      binding?: Record<string, unknown>;
    };

    expect(request.binding).not.toHaveProperty("tenantId");
    expect(request.binding).not.toHaveProperty("accessToken");
    expect(request.binding).not.toHaveProperty("secret");
    expect(request).not.toHaveProperty("publish");
  });
});