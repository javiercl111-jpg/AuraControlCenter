export type PaymentMethod = "TRANSFER" | "SPEI" | "DEPOSIT" | "OTHER";

export interface PlatformPayment {
  id: string;
  invoiceId: string;
  clientId: string;
  clientName: string;
  invoiceNumber: string;
  amount: number;
  paymentMethod: PaymentMethod;
  paymentDate: string;
  reference: string;
  createdAt?: unknown;
}