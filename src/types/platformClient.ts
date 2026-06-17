export type ClientStatus =
  | "ACTIVE"
  | "GRACE_PERIOD"
  | "SUSPENDED"
  | "CANCELLED";

export interface PlatformClient {
  id: string;

  companyName: string;
  tradeName: string;

  status: ClientStatus;

  planCode: string;

  billingCycle: "MONTHLY" | "YEARLY";

  createdAt?: unknown;
}