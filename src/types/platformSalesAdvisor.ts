export type SalesAdvisorStatus =
  | "ACTIVE"
  | "INACTIVE";

export interface PlatformSalesAdvisor {
  id: string;

  name: string;

  email: string;

  phone: string;

  status: SalesAdvisorStatus;

  commissionYear1: number;

  commissionRenewal: number;

  bonusLevel: number;

  notes?: string;

  createdAt?: unknown;

  updatedAt?: unknown;
}