import type { AuraModuleCode, ClientStatus } from "./platformClient";

export type TenantStatus = ClientStatus;

export interface PlatformTenantUsage {
  hcmActiveEmployees: number;
  hcmEmployeeLimit: number;
  hcmWarningThreshold: number;
}

export interface PlatformTenant {
  id: string;
  tenantId: string;
  clientId: string;
  companyName: string;
  tradeName: string;
  status: TenantStatus;
  licenseStatus: ClientStatus;
  enabledModules: AuraModuleCode[];
  suspendedReason: string;
  usage?: PlatformTenantUsage;
  createdAt?: unknown;
  updatedAt?: unknown;
}