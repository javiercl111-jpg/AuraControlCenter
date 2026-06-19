import type { AuraModuleCode } from "./platformClient";
import type { PricingPlanCode } from "./pricingPlan";

export type QuoteStatus = "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED" | "EXPIRED";

export type QuoteIndustry =
  | "HOTELERIA"
  | "RESTAURANTES"
  | "CORPORATIVO"
  | "HOSPITAL"
  | "RETAIL"
  | "MANUFACTURA"
  | "SERVICIOS"
  | "EDUCACION"
  | "GOBIERNO"
  | "OTRO";

export interface QuoteLineItem {
  label: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface PricingQuoteInput {
  prospectName: string;
  contactName: string;
  contactEmail: string;
  industry: QuoteIndustry;
  employeeCount: number;
  locationCount: number;
  companyCount: number;
  selectedModules: AuraModuleCode[];
  billingCycle: "MONTHLY" | "YEARLY";
  applySpecialDiscount: boolean;
  specialDiscountPercent: number;
}

export interface PricingQuoteResult {
  planCode: PricingPlanCode;
  planName: string;
  employeeCount: number;
  locationCount: number;
  companyCount: number;
  employeesLimit: number;
  locationsLimit: number;
  companiesLimit: number;
  selectedModules: AuraModuleCode[];
  includedLocations: number;
  includedCompanies: number;
  extraLocations: number;
  extraCompanies: number;
  items: QuoteLineItem[];
  monthlySubtotal: number;
  annualSubtotalBeforeDiscount: number;
  discountPercent: number;
  discountAmount: number;
  subtotal: number;
  ivaAmount: number;
  total: number;
  monthlyTotal: number;
  billingCycle: "MONTHLY" | "YEARLY";
  industry: QuoteIndustry;
}

export interface PlatformQuote extends PricingQuoteResult {
  id: string;
  folio: string;
  prospectName: string;
  contactName: string;
  contactEmail: string;
  status: QuoteStatus;
  validUntil: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}