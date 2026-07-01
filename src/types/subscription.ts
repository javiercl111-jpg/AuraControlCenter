import type { AuraModuleCode, SubscriptionStatus } from "./platformClient";

export interface PlatformSubscription {
  id: string;
  quoteId: string;
  clientId: string;
  tenantId: string;
  status: SubscriptionStatus;
  billingCycle: "MONTHLY" | "YEARLY";
  pricingMode: "FOUNDER" | "DYNAMIC";
  founderPricing: boolean;
  monthlyAmount: number;
  annualAmount: number;
  setupFee: number;
  firstPaymentTotal: number;
  ivaAmount: number;
  selectedModules: AuraModuleCode[];
  startsAt: any;
  activatedAt?: any;
  suspendedAt?: any;
  cancelledAt?: any;
  cancellationReason?: string | null;
  nextBillingDate?: any;
  gracePeriodEndDate?: any;
  planCode?: string;
  createdAt: any;
  updatedAt: any;
}
