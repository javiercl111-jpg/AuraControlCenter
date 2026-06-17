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
    ClientStatus,
    PlatformClient,
  } from "../types/platformClient";
  
  const COLLECTION_NAME = "platform_clients";
  
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
  }) {
    await addDoc(collection(db, COLLECTION_NAME), {
      companyName: data.companyName,
      tradeName: data.tradeName,
  
      status: data.status,
  
      planCode: data.planCode,
  
      billingCycle: data.billingCycle,
  
      enabledModules: data.enabledModules,
  
      createdAt: serverTimestamp(),
    });
  }
  
  export async function deleteClient(
    clientId: string
  ): Promise<void> {
    await deleteDoc(
      doc(
        db,
        COLLECTION_NAME,
        clientId
      )
    );
  }