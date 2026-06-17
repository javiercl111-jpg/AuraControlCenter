export type PlatformAdminRole = "SUPER_ADMIN" | "ADMIN" | "SUPPORT";

export interface PlatformGlobalAdmin {
  id: string;
  email: string;
  displayName: string;
  role: PlatformAdminRole;
  isActive: boolean;
  createdAt?: unknown;
}