export interface PlatformBillingSettings {
    defaultGraceDays: number;
  
    maxGraceDays: number;
  
    invoiceDueDays: number;
  
    autoSuspendEnabled: boolean;
  
    autoReactivateOnPayment: boolean;
  }
  
  export interface PlatformCommissionSettings {
    year1Commission: number;
  
    renewalCommission: number;
  
    advisorBonusThreshold: number;
  
    advisorBonusPercentage: number;
  }
  
  export interface PlatformSettings {
    id: string;
  
    billing: PlatformBillingSettings;
  
    commissions: PlatformCommissionSettings;
  
    updatedAt?: unknown;
  }