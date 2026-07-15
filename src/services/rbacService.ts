import { auth } from "../config/firebase";
import { getPlatformAdminByEmailOrUid } from "./platformAdminService";
import type { PlatformAdminRole } from "../types/platformAdmin";

export type Capability =
  | "dashboard.read"
  | "market.read"
  | "market.import"
  | "market.update"
  | "market.convert"
  | "market.export"
  | "market.assign"
  | "market.pipeline.read"
  | "market.pipeline.manage_own"
  | "market.pipeline.manage_all"
  | "crm.read"
  | "crm.write"
  | "crm.leads.read_own"
  | "crm.leads.update_own"
  | "crm.leads.read_all"
  | "crm.leads.update_all"
  | "advisors.read"
  | "advisors.manage"
  | "discovery.read"
  | "discovery.manage"
  | "clients.read"
  | "clients.write"
  | "tenants.read"
  | "subscriptions.read"
  | "proposals.read"
  | "proposals.write"
  | "notifications.read_own"
  | "reports.read"
  | "settings.business.read"
  | "settings.business.write"
  // Permisos técnicos / destructivos (Solo OWNER y SUPER_ADMIN)
  | "secrets.read"
  | "secrets.write"
  | "deployments.manage"
  | "firebase.manage"
  | "security.rules.manage"
  | "platform.delete"
  | "audit.delete"
  | "billing.destructive"
  | "service_credentials.rotate"
  // Legacy / compatible capabilities
  | "organization.create"
  | "timeline.create";

const ALL_CAPABILITIES: Capability[] = [
  "dashboard.read", "market.read", "market.import", "market.update", "market.convert", "market.export", "market.assign",
  "market.pipeline.read", "market.pipeline.manage_own", "market.pipeline.manage_all",
  "crm.read", "crm.write", "crm.leads.read_own", "crm.leads.update_own", "crm.leads.read_all", "crm.leads.update_all",
  "advisors.read", "advisors.manage", "discovery.read", "discovery.manage", "clients.read", "clients.write",
  "tenants.read", "subscriptions.read", "proposals.read", "proposals.write", "notifications.read_own", "reports.read",
  "settings.business.read", "settings.business.write", "secrets.read", "secrets.write", "deployments.manage",
  "firebase.manage", "security.rules.manage", "platform.delete", "audit.delete", "billing.destructive",
  "service_credentials.rotate", "organization.create", "timeline.create"
];

const FUNCTIONAL_CAPABILITIES: Capability[] = [
  "dashboard.read", "market.read", "market.import", "market.update", "market.convert", "market.export", "market.assign",
  "market.pipeline.read", "market.pipeline.manage_all", "market.pipeline.manage_own",
  "crm.read", "crm.write", "crm.leads.read_all", "crm.leads.update_all", "crm.leads.read_own", "crm.leads.update_own",
  "advisors.read", "advisors.manage", "discovery.read", "discovery.manage", "clients.read", "clients.write",
  "tenants.read", "subscriptions.read", "proposals.read", "proposals.write", "notifications.read_own", "reports.read",
  "settings.business.read", "settings.business.write", "organization.create", "timeline.create"
];

const ROLE_CAPABILITIES: Record<PlatformAdminRole, Capability[]> = {
  PLATFORM_OWNER: ALL_CAPABILITIES,
  SUPER_ADMIN: ALL_CAPABILITIES,
  FOUNDER: ALL_CAPABILITIES,
  ADMIN: ALL_CAPABILITIES,
  PLATFORM_PARTNER: FUNCTIONAL_CAPABILITIES,
  SALES_DIRECTOR: [
    "dashboard.read", "market.read", "market.pipeline.read", "market.pipeline.manage_all",
    "crm.read", "crm.leads.read_all", "crm.leads.update_all", "advisors.read", "advisors.manage",
    "reports.read", "notifications.read_own"
  ],
  SALES_ADVISOR: [
    "dashboard.read", "market.read", "market.pipeline.read", "market.pipeline.manage_own",
    "crm.leads.read_own", "crm.leads.update_own", "notifications.read_own"
  ],
  CONSULTANT: [
    "dashboard.read", "market.read", "crm.read", "discovery.read", "clients.read", "proposals.read"
  ],
  READ_ONLY: [
    "dashboard.read", "market.read", "market.pipeline.read", "crm.read", "advisors.read"
  ],
  VIEWER: [
    "dashboard.read", "market.read"
  ],
  SUPPORT: [
    "dashboard.read", "market.read", "advisors.read"
  ]
};

// Caché en memoria para evitar consultas duplicadas a Firestore (Costo Firestore Protegido)
let cachedRole: PlatformAdminRole | null = null;
let cachedEmail: string | null = null;
let cachedUid: string | null = null;

/**
 * Obtiene el rol del usuario autenticado actual, resolviendo por UID o Email
 * y almacenando el resultado en caché.
 */
export async function getCurrentUserRole(): Promise<PlatformAdminRole | null> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    clearRbacCache();
    return null;
  }

  const email = currentUser.email || "";
  const uid = currentUser.uid;

  // Si coincide con la caché, devolver el rol de forma instantánea
  if (cachedRole && (uid === cachedUid || (email && email === cachedEmail))) {
    return cachedRole;
  }

  try {
    const admin = await getPlatformAdminByEmailOrUid(email, uid);
    if (admin && admin.isActive) {
      cachedRole = admin.role;
      cachedEmail = admin.email;
      cachedUid = admin.id; // Podría ser el UID o el email en función de cómo esté guardado en Firestore
      return cachedRole;
    }
  } catch (err) {
    console.error("[rbacService] Error al recuperar rol de administrador:", err);
  }

  return null;
}

/**
 * Limpia la caché local (e.g. en logout)
 */
export function clearRbacCache(): void {
  cachedRole = null;
  cachedEmail = null;
  cachedUid = null;
}

/**
 * Comprueba si un rol específico tiene una capacidad asignada
 */
export function hasCapability(role: PlatformAdminRole, capability: Capability): boolean {
  const capabilities = ROLE_CAPABILITIES[role] || [];
  return capabilities.includes(capability);
}

/**
 * Comprueba si el usuario autenticado actual posee una capacidad específica.
 * Utiliza la caché para proteger costos de Firestore (0 reads recurrentes).
 */
export async function checkUserCapability(capability: Capability): Promise<boolean> {
  const role = await getCurrentUserRole();
  if (!role) return false;
  return hasCapability(role, capability);
}

export async function can(capability: Capability): Promise<boolean> {
  return checkUserCapability(capability);
}

const RbacService = {
  getCurrentUserRole,
  clearRbacCache,
  hasCapability,
  checkUserCapability,
  can,
};

export default RbacService;
