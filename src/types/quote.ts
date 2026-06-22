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

export type HcmMigrationType =
  | "NONE"
  | "SIMPLE_EXCEL"
  | "EXTERNAL_SYSTEM"
  | "COMPLEX_SYSTEM";

export type ImplementationType = "REMOTE" | "HYBRID" | "ONSITE";

export type MaintenanceInitialLoadType = "MANUAL" | "EXCEL" | "CMMS_MIGRATION";

export type FounderSetupDiscountMode = "NONE" | "FIFTY_PERCENT" | "FREE";

export type SetupCalculationType =
  | "NONE"
  | "HCM_ENTERPRISE"
  | "MAINTENANCE_ENTERPRISE"
  | "COMBINED_ENTERPRISE";

export interface QuoteLineItem {
  label: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface SetupBreakdownItem {
  product: "AURA_HCM" | "AURA_MAINTENANCE";
  factor: string;
  score: number;
  amount?: number;
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

  hcmMigrationType: HcmMigrationType;
  hcmImplementationType: ImplementationType;
  hcmIntegrationCount: number;

  maintenanceAssetCount: number;
  maintenanceTechnicianCount: number;
  maintenanceInitialLoadType: MaintenanceInitialLoadType;
  maintenanceMassiveQr: boolean;

  founderClient: boolean;
  founderSetupDiscountMode: FounderSetupDiscountMode;
  pricingMode?: "FOUNDER" | "DYNAMIC";
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

  setupCalculationType: SetupCalculationType;
  setupBasePrice: number;
  setupComplexityScore: number;
  setupBreakdown: SetupBreakdownItem[];
  setupFeeBeforeDiscount: number;
  setupDiscountPercent: number;
  setupDiscountAmount: number;
  setupFee: number;

  firstPaymentSubtotal: number;
  firstPaymentIvaAmount: number;
  firstPaymentTotal: number;
  annualProjectedRevenue: number;

  pricingMode?: "FOUNDER" | "DYNAMIC";
  founderPricing?: boolean;
  setupHcmTier?: string;
  setupMaintTier?: string;
  setupHcmFee?: number;
  setupMaintFee?: number;
}

export interface PlatformQuote extends PricingQuoteResult {
  id: string;
  folio: string;
  prospectName: string;
  contactName: string;
  contactEmail: string;
  status: QuoteStatus;
  validUntil: string;
  founderClient?: boolean;
  founderSetupDiscountMode?: FounderSetupDiscountMode;
  createdAt?: unknown;
  updatedAt?: unknown;
}