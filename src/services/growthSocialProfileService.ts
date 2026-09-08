import { httpsCallable } from "firebase/functions";

import { functions } from "../config/firebase";
import type {
  CreateGrowthSocialProfileBindingInputV1,
  GrowthSocialAccountTypeV1,
  GrowthSocialConnectionStateV1,
  GrowthSocialProfileBindingV1,
  GrowthSocialProviderV1,
} from "../modules/intelligence/growthIntegration/externalActions/social/profiles/GrowthSocialProfileBindingV1";

export type GrowthSocialProvider = GrowthSocialProviderV1;
export type GrowthSocialAccountType = GrowthSocialAccountTypeV1;
export type GrowthSocialConnectionState = GrowthSocialConnectionStateV1;
export type GrowthSocialProfileBinding = GrowthSocialProfileBindingV1;

export type GrowthSocialProfileUpsertInput = Omit<
  CreateGrowthSocialProfileBindingInputV1,
  "tenantId"
>;

type ManagementRequest =
  | {
      operation: "UPSERT";
      binding: GrowthSocialProfileUpsertInput;
    }
  | {
      operation: "GET_BY_ID";
      bindingId: string;
    }
  | {
      operation: "LIST_BY_TENANT";
      provider?: GrowthSocialProvider;
      activeOnly?: boolean;
    };

type ManagementResponse =
  | {
      status: "SUCCEEDED";
      operation: "UPSERT";
      tenantId: string;
      principalId: string;
      role: string;
      binding: GrowthSocialProfileBinding;
    }
  | {
      status: "SUCCEEDED";
      operation: "GET_BY_ID";
      tenantId: string;
      principalId: string;
      role: string;
      binding: GrowthSocialProfileBinding | null;
    }
  | {
      status: "SUCCEEDED";
      operation: "LIST_BY_TENANT";
      tenantId: string;
      principalId: string;
      role: string;
      bindings: readonly GrowthSocialProfileBinding[];
    };

async function invoke(
  request: ManagementRequest
): Promise<ManagementResponse> {
  const callable = httpsCallable<
    ManagementRequest,
    ManagementResponse
  >(functions, "growthSocialProfileManagementV1");

  const response = await callable(request);

  return response.data;
}

export async function listGrowthSocialProfiles(
  options: {
    provider?: GrowthSocialProvider;
    activeOnly?: boolean;
  } = {}
): Promise<readonly GrowthSocialProfileBinding[]> {
  const response = await invoke({
    operation: "LIST_BY_TENANT",
    ...(options.provider ? { provider: options.provider } : {}),
    ...(typeof options.activeOnly === "boolean"
      ? { activeOnly: options.activeOnly }
      : {}),
  });

  if (response.operation !== "LIST_BY_TENANT") {
    throw new Error("GROWTH_SOCIAL_PROFILE_LIST_RESPONSE_INVALID");
  }

  return response.bindings;
}

export async function getGrowthSocialProfileById(
  bindingId: string
): Promise<GrowthSocialProfileBinding | null> {
  const response = await invoke({
    operation: "GET_BY_ID",
    bindingId,
  });

  if (response.operation !== "GET_BY_ID") {
    throw new Error("GROWTH_SOCIAL_PROFILE_GET_RESPONSE_INVALID");
  }

  return response.binding;
}

export async function upsertGrowthSocialProfile(
  binding: GrowthSocialProfileUpsertInput
): Promise<GrowthSocialProfileBinding> {
  const response = await invoke({
    operation: "UPSERT",
    binding,
  });

  if (response.operation !== "UPSERT") {
    throw new Error("GROWTH_SOCIAL_PROFILE_UPSERT_RESPONSE_INVALID");
  }

  return response.binding;
}