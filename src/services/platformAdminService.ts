import { doc, getDoc } from "firebase/firestore";
import { db } from "../config/firebase";
import type { PlatformGlobalAdmin, PlatformAdminRole } from "../types/platformAdmin";

/**
 * Obtiene el perfil de administrador buscando por UID (futura arquitectura)
 * o por Email (compatibilidad actual).
 */
export async function getPlatformAdminByEmailOrUid(
  email: string,
  uid?: string
): Promise<PlatformGlobalAdmin | null> {
  // 1. Intentar buscar por UID si se proporciona (Migración preparada)
  if (uid) {
    const adminRef = doc(db, "platform_global_admins", uid);
    const snapshot = await getDoc(adminRef);
    if (snapshot.exists()) {
      const data = snapshot.data();
      return {
        id: snapshot.id,
        email: data.email || "",
        displayName: data.displayName || "",
        role: data.role as PlatformAdminRole,
        isActive: Boolean(data.isActive),
        createdAt: data.createdAt,
      };
    }
  }

  // 2. Fallback a buscar por correo electrónico (Compatibilidad actual)
  const normalizedEmail = email.trim().toLowerCase();
  const adminRef = doc(db, "platform_global_admins", normalizedEmail);
  const snapshot = await getDoc(adminRef);

  if (!snapshot.exists()) return null;

  const data = snapshot.data();

  return {
    id: snapshot.id,
    email: data.email || "",
    displayName: data.displayName || "",
    role: data.role as PlatformAdminRole,
    isActive: Boolean(data.isActive),
    createdAt: data.createdAt,
  };
}

/**
 * Busca por correo para retrocompatibilidad directa
 */
export async function getPlatformAdminByEmail(
  email: string
): Promise<PlatformGlobalAdmin | null> {
  return getPlatformAdminByEmailOrUid(email);
}

/**
 * Determina si el usuario es un administrador global activo para dar acceso al Control Center.
 * Permite la entrada de todos los roles administrativos asignados.
 */
export async function isGlobalAdmin(email: string, uid?: string): Promise<boolean> {
  const admin = await getPlatformAdminByEmailOrUid(email, uid);
  return Boolean(admin && admin.isActive);
}

const PlatformAdminService = {
  getPlatformAdminByEmail,
  getPlatformAdminByEmailOrUid,
  isGlobalAdmin,
};

export default PlatformAdminService;