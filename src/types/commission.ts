import type { BillingCycle } from "./platformClient";

export type CommissionStatus = "PENDING" | "APPROVED" | "PAID" | "VOID";

export type CommissionType = "NEW_SALE" | "RENEWAL";

export interface PlatformCommission {
  id: string;
  quoteId: string;
  clientId: string;
  tenantId: string;
  advisorId: string;
  advisorName: string;
  commissionType: CommissionType;
  commissionPercent: number;
  commissionAmount: number;
  saleAmount: number;
  setupFee: number;
  billingCycle: BillingCycle;
  status: CommissionStatus;
  createdAt: any;
  updatedAt: any;
  paidAt?: string | null;
  notes?: string | null;
}

export interface CommissionGenerationResult {
  generated: boolean;
  skipped: boolean;
  reason?: "DIRECT_SALE_NO_ADVISOR" | "COMMISSION_ALREADY_EXISTS";
  commissionId?: string;
}

// Global rule: all files must end with a default export.
const CommissionTypes = {
  version: "1.0.0",
};

export default CommissionTypes;
