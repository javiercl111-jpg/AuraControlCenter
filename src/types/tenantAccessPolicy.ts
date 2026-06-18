import type { TenantStatus } from "./platformTenant";

export interface TenantAccessRule {
  status: TenantStatus;
  allowed: boolean;
  showBanner: boolean;
  showBlockedScreen: boolean;
  message: string;
}

export interface TenantAccessPolicy {
  id: string;
  rules: TenantAccessRule[];
  updatedAt?: unknown;
}