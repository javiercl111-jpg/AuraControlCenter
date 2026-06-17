export type ClientStatus =
  | "ACTIVE"
  | "GRACE_PERIOD"
  | "SUSPENDED"
  | "CANCELLED";

export type BillingCycle =
  | "MONTHLY"
  | "YEARLY";

export type AuraModuleCode =
  | "AURA_HCM"
  | "AURA_MAINTENANCE"
  | "AURA_SIGNATURE"
  | "AURA_INTELLIGENCE";

export interface PlatformClient {
  id: string;

  companyName: string;

  tradeName: string;

  status: ClientStatus;

  planCode: string;

  billingCycle: BillingCycle;

  enabledModules: AuraModuleCode[];

  startDate?: string;

  renewalDate?: string;

  graceUntil?: string;

  createdAt?: unknown;
}