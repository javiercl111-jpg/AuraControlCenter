import { doc, serverTimestamp, updateDoc } from "firebase/firestore";

import { db } from "../config/firebase";

import type {
  AuraModuleCode,
  BillingCycle,
  ClientFiscalData,
  ClientStatus,
} from "../types/platformClient";

const COLLECTION_NAME = "platform_clients";

export async function updateClient(
  clientId: string,
  data: {
    companyName: string;
    tradeName: string;
    status: ClientStatus;
    planCode: string;
    billingCycle: BillingCycle;
    enabledModules: AuraModuleCode[];
    fiscalData: ClientFiscalData;
    startDate?: string;
    renewalDate?: string;
    graceUntil?: string;
  }
): Promise<void> {
  await updateDoc(doc(db, COLLECTION_NAME, clientId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function updateClientStatus(
  clientId: string,
  status: ClientStatus
): Promise<void> {
  await updateDoc(doc(db, COLLECTION_NAME, clientId), {
    status,
    licenseStatusEvaluatedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateClientLicenseEvaluation(
  clientId: string,
  data: {
    status: ClientStatus;
    startDate?: string;
    renewalDate?: string;
    graceUntil?: string;
  }
): Promise<void> {
  await updateDoc(doc(db, COLLECTION_NAME, clientId), {
    status: data.status,
    startDate: data.startDate,
    renewalDate: data.renewalDate,
    graceUntil: data.graceUntil,
    licenseStatusEvaluatedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}