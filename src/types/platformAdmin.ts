export type PlatformAdminRole =
  | "SUPER_ADMIN"
  | "FOUNDER"
  | "SALES_DIRECTOR"
  | "CONSULTANT"
  | "SALES_ADVISOR"
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