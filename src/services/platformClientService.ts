import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDocs,
    orderBy,
    query,
    serverTimestamp,
  } from "firebase/firestore";
  
  import { db } from "../config/firebase";
  
  import type {
    AuraModuleCode,
    BillingCycle,
    ClientFiscalData,
    ClientStatus,
    PlatformClient,
  } from "../types/platformClient";
  
  const COLLECTION_NAME = "platform_clients";
  
  function addMonths(date: Date, months: number): Date {
    const nextDate = new Date(date);
    nextDate.setMonth(nextDate.getMonth() + months);
    return nextDate;
  }
  
  function addDays(date: Date, days: number): Date {
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + days);
    return nextDate;
  }
  
  function toDateInputValue(date: Date): string {
    return date.toISOString().slice(0, 10);
  }
  
  export async function getClients(): Promise<PlatformClient[]> {
    const q = query(
      collection(db, COLLECTION_NAME),
      orderBy("companyName", "asc")
    );
  
    const snapshot = await getDocs(q);
  
    return snapshot.docs.map((clientDoc) => ({
      id: clientDoc.id,
      ...(clientDoc.data() as Omit<PlatformClient, "id">),
    }));
  }
  
  export async function createClient(data: {
    companyName: string;
    tradeName: string;
    planCode: string;
    billingCycle: BillingCycle;
    status: ClientStatus;
    enabledModules: AuraModuleCode[];
    fiscalData: ClientFiscalData;
  }) {
    const today = new Date();
  
    const renewalDate =
      data.billingCycle === "YEARLY" ? addMonths(today, 12) : addMonths(today, 1);
  
    const graceUntil = addDays(renewalDate, 15);
  
    await addDoc(collection(db, COLLECTION_NAME), {
      tenantId: "",
      companyName: data.companyName,
      tradeName: data.tradeName,
      status: data.status,
      planCode: data.planCode,
      billingCycle: data.billingCycle,
      enabledModules: data.enabledModules,
      fiscalData: data.fiscalData,
      startDate: toDateInputValue(today),
      renewalDate: toDateInputValue(renewalDate),
      graceUntil: toDateInputValue(graceUntil),
      createdAt: serverTimestamp(),
    });
  }
  
  export async function deleteClient(clientId: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTION_NAME, clientId));
  }