import type { AuraModuleCode, ClientStatus } from "./platformClient";

export type TenantStatus = ClientStatus;

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
  createdAt?: unknown;
  updatedAt?: unknown;
}