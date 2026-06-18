export type ClientStatus =
  | "ACTIVE"
  | "GRACE_PERIOD"
  | "SUSPENDED"
  | "CANCELLED";

export type BillingCycle = "MONTHLY" | "YEARLY";

export type AuraModuleCode =
  | "AURA_HCM"
  | "AURA_MAINTENANCE"
  | "AURA_SIGNATURE"
  | "AURA_INTELLIGENCE";

export type CfdiPaymentMethod = "PUE" | "PPD";

export interface ClientFiscalData {
  legalName: string;
  rfc: string;
  taxRegime: string;
  cfdiUse: string;
  paymentMethod: CfdiPaymentMethod;
  paymentForm: string;
  fiscalZipCode: string;
  billingEmail: string;
  billingContactName: string;
  billingPhone: string;
  billingNotes: string;
}

export interface PlatformClient {
  id: string;
  companyName: string;
  tradeName: string;
  status: ClientStatus;
  planCode: string;
  billingCycle: BillingCycle;
  enabledModules: AuraModuleCode[];
  fiscalData: ClientFiscalData;
  startDate?: string;
  renewalDate?: string;
  graceUntil?: string;
  createdAt?: unknown;
}