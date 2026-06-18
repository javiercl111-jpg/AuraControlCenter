import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

import { db } from "../config/firebase";
import type { TenantAccessPolicy } from "../types/tenantAccessPolicy";

const COLLECTION_NAME = "platform_tenant_access_policies";
const DOCUMENT_ID = "global";

const DEFAULT_POLICY: Omit<TenantAccessPolicy, "id"> = {
  rules: [
    {
      status: "ACTIVE",
      allowed: true,
      showBanner: false,
      showBlockedScreen: false,
      message: "Acceso completo.",
    },
    {
      status: "GRACE_PERIOD",
      allowed: true,
      showBanner: true,
      showBlockedScreen: false,
      message: "El tenant está en periodo de gracia.",
    },
    {
      status: "SUSPENDED",
      allowed: false,
      showBanner: false,
      showBlockedScreen: true,
      message: "La licencia está suspendida. Contacta a Aura.",
    },
    {
      status: "CANCELLED",
      allowed: false,
      showBanner: false,
      showBlockedScreen: true,
      message: "El servicio fue cancelado. Contacta a Aura.",
    },
  ],
};

export async function getTenantAccessPolicy(): Promise<TenantAccessPolicy> {
  const policyRef = doc(db, COLLECTION_NAME, DOCUMENT_ID);
  const snapshot = await getDoc(policyRef);

  if (!snapshot.exists()) {
    await setDoc(policyRef, {
      ...DEFAULT_POLICY,
      updatedAt: serverTimestamp(),
    });

    return {
      id: DOCUMENT_ID,
      ...DEFAULT_POLICY,
    };
  }

  return {
    id: snapshot.id,
    ...(snapshot.data() as Omit<TenantAccessPolicy, "id">),
  };
}

export async function saveTenantAccessPolicy(
  policy: Omit<TenantAccessPolicy, "id">
): Promise<void> {
  await setDoc(
    doc(db, COLLECTION_NAME, DOCUMENT_ID),
    {
      ...policy,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}