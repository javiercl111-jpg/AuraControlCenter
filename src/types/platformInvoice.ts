export type InvoiceStatus =
  | "PENDING"
  | "PAID"
  | "OVERDUE"
  | "CANCELLED";

export interface PlatformInvoice {
  id: string;
  clientId: string;
  clientName: string;
  invoiceNumber: string;
  planCode: string;
  periodStart: string;
  periodEnd: string;
  subtotal: number;
  ivaRate: number;
  ivaAmount: number;
  total: number;
  status: InvoiceStatus;
  createdAt?: unknown;
  paidAt?: string;
}

export interface PlatformPayment {
  id: string;
  invoiceId: string;
  clientId: string;
  amount: number;
  paymentMethod: "TRANSFER" | "SPEI" | "DEPOSIT" | "OTHER";
  paymentDate: string;
  reference?: string;
  createdAt?: unknown;
}