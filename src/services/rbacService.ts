import { auth } from "../config/firebase";
import { getPlatformAdminByEmailOrUid } from "./platformAdminService";
import type { PlatformAdminRole } from "../types/platformAdmin";

// Lista de todas las capacidades comerciales y operativas de Aura
export type Capability =
  | "market.read"
  | "market.import"
  | "market.update"
  | "market.convert"
  | "market.export" // Nueva capacidad, lista para UI futura
  | "market.assign" // Nueva capacidad, lista para UI futura
  | "organization.create"
  | "timeline.create"
  | "market.pipeline.read"
  | "market.pipeline.manage_own"
  | "crm.leads.read_own"
  | "crm.leads.update_own"
  | "notifications.read_own";

// Mapeo canónico de Roles de Seguridad a sus respectivas Capacidades
const ROLE_CAPABILITIES: Record<PlatformAdminRole, Capability[]> = {
  SUPER_ADMIN: [
    "market.read",
    "market.import",
    "market.update",
    "market.convert",
    "market.export",
    "market.assign",
    "organization.create",
    "timeline.create",
    "market.pipeline.read",
    "market.pipeline.manage_own",
    "crm.leads.read_own",
    "crm.leads.update_own",
    "notifications.read_own",
  ],
  FOUNDER: [
    "market.read",
    "market.import",
    "market.update",
    "market.convert",
    "market.export",
    "market.assign",
    "organization.create",
    "timeline.create",
    "market.pipeline.read",
    "market.pipeline.manage_own",
    "crm.leads.read_own",
    "crm.leads.update_own",
    "notifications.read_own",
  ],
  SALES_DIRECTOR: [
    "market.read",
    "market.import",
    "market.update",
    "market.convert",
    "market.export",
    "market.assign",
    "organization.create",
    "timeline.create",
    "market.pipeline.read",
    "market.pipeline.manage_own",
    "crm.leads.read_own",
    "crm.leads.update_own",
    "notifications.read_own",
  ],
  CONSULTANT: [
    "market.read",
    "market.update",
    "market.convert",
    "market.assign",
    "organization.create",
    "timeline.create",
  ],
  SALES_ADVISOR: [
    "market.read",
    "market.pipeline.read",
    "market.pipeline.manage_own",
    "crm.leads.read_own",
    "crm.leads.update_own",
    "notifications.read_own",
  ],
  VIEWER: [
    "market.read",
  ],
  ADMIN: [
    "market.read",
    "market.import",
    "market.update",
    "market.convert",
    "market.export",
    "market.assign",
    "organization.create",
    "timeline.create",
    "market.pipeline.read",
    "market.pipeline.manage_own",
    "crm.leads.read_own",
    "crm.leads.update_own",
    "notifications.read_own",
  ],
  SUPPORT: [
    "market.read",
    "market.update",
    "market.assign",
  ],
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

const RbacService = {
  getCurrentUserRole,
  clearRbacCache,
  hasCapability,
  checkUserCapability,
};

export default RbacService;
