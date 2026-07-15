export type AuthStatus = "NOT_CREATED" | "CREATED" | "DISABLED";
export type InvitationStatus = "PENDING" | "LINK_GENERATED" | "SENT" | "ACCEPTED" | "EXPIRED" | "SEND_FAILED";
export type AdvisorStatus = "ACTIVE" | "SUSPENDED" | "INACTIVE";

export interface AdvisorProfile {
  id?: string;
  advisorId: string;
  uid?: string | null;

  name: string;
  email: string;
  phone?: string;

  commercialCode?: string;
  discoveryLink?: string;

  assignedStates: string[];
  assignedStateCodes?: string[];
  assignedStateLabels?: string[];
  assignedCities: string[];
  specialties: string[];

  authStatus: AuthStatus;
  invitationStatus: InvitationStatus;
  advisorStatus: AdvisorStatus;

  platformRole?: string;
  commercialTier?: string;
  commissionPlanId?: string;

  // Legacy fields for UI compatibility, to be removed or mapped later
  commissionYear1?: number;
  commissionRenewal?: number;
  bonusLevel?: number;
  notes?: string;

  createdAt?: unknown;
  createdBy?: string;
  updatedAt?: unknown;
  lastLoginAt?: unknown;

  provisioningStatus?: "PENDING" | "SUCCESS" | "ERROR";
  lastSafeErrorCode?: string;
}

// Retro-compatibility export
export type PlatformSalesAdvisor = AdvisorProfile;
export type SalesAdvisorStatus = AdvisorStatus;