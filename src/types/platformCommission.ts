export type CommissionStatus = "PENDING" | "PAID" | "CANCELLED";

export type CommissionType = "FIRST_YEAR" | "RENEWAL";

export interface PlatformCommission {
  id: string;
  advisorId: string;
  advisorName: string;
  clientId: string;
  clientName: string;
  invoiceId: string;
  invoiceNumber: string;
  invoiceAmount: number;
  commissionType: CommissionType;
  commissionRate: number;
  commissionAmount: number;
  status: CommissionStatus;
  createdAt?: unknown;
  paidAt?: string;
}