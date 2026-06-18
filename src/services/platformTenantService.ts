import {
  addDoc,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import { db } from "../config/firebase";

import type { AuraModuleCode, ClientStatus } from "../types/platformClient";
import type { PlatformTenant, TenantStatus } from "../types/platformTenant";

const TENANTS_COLLECTION = "platform_tenants";
const CLIENTS_COLLECTION = "platform_clients";

function normalizeTenantId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function buildTenantId(companyName: string, clientId: string): string {
  const normalizedName = normalizeTenantId(companyName);
  return normalizedName || `tenant-${clientId.slice(0, 8)}`;
}

export async function getTenants(): Promise<PlatformTenant[]> {
  const q = query(
    collection(db, TENANTS_COLLECTION),
    orderBy("companyName", "asc")
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((tenantDoc) => ({
    id: tenantDoc.id,
    ...(tenantDoc.data() as Omit<PlatformTenant, "id">),
  }));
}

export async function createTenantFromClient(data: {
  clientId: string;
  companyName: string;
  tradeName: string;
  status: TenantStatus;
  licenseStatus: ClientStatus;
  enabledModules: AuraModuleCode[];
}): Promise<string> {
  const tenantId = buildTenantId(data.companyName, data.clientId);

  const tenantRef = await addDoc(collection(db, TENANTS_COLLECTION), {
    tenantId,
    clientId: data.clientId,
    companyName: data.companyName,
    tradeName: data.tradeName,
    status: data.status,
    licenseStatus: data.licenseStatus,
    enabledModules: data.enabledModules,
    suspendedReason: "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await updateDoc(doc(db, CLIENTS_COLLECTION, data.clientId), {
    tenantId: tenantRef.id,
    updatedAt: serverTimestamp(),
  });

  return tenantRef.id;
}

export async function updateTenantStatus(
  tenantDocumentId: string,
  status: TenantStatus,
  suspendedReason = ""
): Promise<void> {
  await updateDoc(doc(db, TENANTS_COLLECTION, tenantDocumentId), {
    status,
    licenseStatus: status,
    suspendedReason: status === "SUSPENDED" ? suspendedReason : "",
    updatedAt: serverTimestamp(),
  });
}

export async function syncTenantFromClientStatus(data: {
  tenantDocumentId?: string;
  clientStatus: ClientStatus;
  suspendedReason?: string;
}): Promise<void> {
  if (!data.tenantDocumentId) return;

  await updateDoc(doc(db, TENANTS_COLLECTION, data.tenantDocumentId), {
    status: data.clientStatus,
    licenseStatus: data.clientStatus,
    suspendedReason:
      data.clientStatus === "SUSPENDED"
        ? data.suspendedReason || "Suspensión automática por vencimiento"
        : "",
    updatedAt: serverTimestamp(),
  });
}