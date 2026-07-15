export type PlatformAdminRole =
  | "PLATFORM_OWNER"
  | "PLATFORM_PARTNER"
  | "SUPER_ADMIN"
  | "FOUNDER"
  | "SALES_DIRECTOR"
  | "CONSULTANT"
  | "SALES_ADVISOR"
  | "READ_ONLY"
  | "VIEWER"
  | "ADMIN"
  | "SUPPORT";

export interface PlatformGlobalAdmin {
  id: string;
  email: string;
  displayName: string;
  role: PlatformAdminRole;
  isActive: boolean;
  advisorId?: string;
  createdAt?: unknown;
}