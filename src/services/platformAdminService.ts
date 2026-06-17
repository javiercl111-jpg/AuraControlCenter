import { doc, getDoc } from "firebase/firestore";
import { db } from "../config/firebase";
import type { PlatformGlobalAdmin } from "../types/platformAdmin";

export async function getPlatformAdminByEmail(
  email: string
): Promise<PlatformGlobalAdmin | null> {
  const normalizedEmail = email.trim().toLowerCase();
  const adminRef = doc(db, "platform_global_admins", normalizedEmail);
  const snapshot = await getDoc(adminRef);

  if (!snapshot.exists()) return null;

  const data = snapshot.data();

  return {
    id: snapshot.id,
    email: data.email,
    displayName: data.displayName,
    role: data.role,
    isActive: Boolean(data.isActive),
    createdAt: data.createdAt,
  };
}

export async function isGlobalAdmin(email: string): Promise<boolean> {
  const admin = await getPlatformAdminByEmail(email);
  return Boolean(admin && admin.isActive && admin.role === "SUPER_ADMIN");
}