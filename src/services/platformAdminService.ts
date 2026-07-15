import { doc, getDoc } from "firebase/firestore";
import { db } from "../config/firebase";
import type { PlatformGlobalAdmin, PlatformAdminRole } from "../types/platformAdmin";

/**
 * Obtiene el perfil de administrador buscando por UID (futura arquitectura)
 * o por Email (compatibilidad actual).
 * Implementa fallbacks robustos para campos duplicados en base (roleCode/type/role y status/isActive).
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
        role: (data.role || data.roleCode || data.type || "VIEWER") as PlatformAdminRole,
        isActive: Boolean(data.isActive) || data.status === "ACTIVE",
        advisorId: data.advisorId,
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
    role: (data.role || data.roleCode || data.type || "VIEWER") as PlatformAdminRole,
    isActive: Boolean(data.isActive) || data.status === "ACTIVE",
    advisorId: data.advisorId,
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
  if (!admin || !admin.isActive) return false;

  // Si es un asesor comercial, validar que su perfil de asesor no esté INACTIVO o SUSPENDIDO
  if (admin.role === "SALES_ADVISOR") {
    if (!admin.advisorId) return false;
    try {
      const advisorRef = doc(db, "platform_sales_advisors", admin.advisorId);
      const snapshot = await getDoc(advisorRef);
      if (!snapshot.exists()) return false;
      const advData = snapshot.data();
      if (advData?.advisorStatus === "INACTIVE" || advData?.advisorStatus === "SUSPENDED") {
        return false;
      }
    } catch (err) {
      console.error("[rbacService] Error al comprobar estado del asesor:", err);
      return false;
    }
  }

  return true;
}

const PlatformAdminService = {
  getPlatformAdminByEmail,
  getPlatformAdminByEmailOrUid,
  isGlobalAdmin,
};

export default PlatformAdminService;