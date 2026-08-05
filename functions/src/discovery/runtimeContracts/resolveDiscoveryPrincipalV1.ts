import type { Firestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";

export interface DiscoveryPlatformPrincipalV1 {
  readonly uid: string;
  readonly role: string;
  readonly advisorId?: string;
}

export interface DiscoveryAuthContextV1 {
  readonly uid?: string;
}

export async function resolveDiscoveryPrincipalV1(
  db: Firestore,
  authContext: DiscoveryAuthContextV1 | null | undefined,
): Promise<DiscoveryPlatformPrincipalV1> {
  const uid = authContext?.uid?.trim();
  if (!uid) {
    throw new HttpsError("unauthenticated", "AUTHENTICATION_REQUIRED");
  }

  const snapshot = await db.collection("platform_global_admins").doc(uid).get();
  if (!snapshot.exists) {
    throw new HttpsError("permission-denied", "CANONICAL_PRINCIPAL_REQUIRED");
  }
  const data = snapshot.data() ?? {};
  if (data.isActive === false || data.status === "INACTIVE") {
    throw new HttpsError("permission-denied", "PRINCIPAL_INACTIVE");
  }
  const role = String(data.role ?? data.roleCode ?? data.type ?? "VIEWER")
    .toUpperCase();
  return Object.freeze({
    uid,
    role: role === "PARTNER" ? "PLATFORM_PARTNER" : role,
    ...(typeof data.advisorId === "string" && data.advisorId.trim()
      ? { advisorId: data.advisorId }
      : {}),
  });
}
