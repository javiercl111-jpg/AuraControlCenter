import {
    addDoc,
    collection,
    getDocs,
    orderBy,
    query,
    serverTimestamp,
  } from "firebase/firestore";
  
  import { db } from "../config/firebase";
  import type { PlatformClient } from "../types/platformClient";
  
  const COLLECTION_NAME = "platform_clients";
  
  export async function getClients(): Promise<PlatformClient[]> {
    const q = query(
      collection(db, COLLECTION_NAME),
      orderBy("companyName", "asc")
    );
  
    const snapshot = await getDocs(q);
  
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<PlatformClient, "id">),
    }));
  }
  
  export async function createClient(data: {
    companyName: string;
    tradeName: string;
    planCode: string;
  }) {
    await addDoc(collection(db, COLLECTION_NAME), {
      companyName: data.companyName,
      tradeName: data.tradeName,
  
      status: "ACTIVE",
  
      planCode: data.planCode,
  
      billingCycle: "MONTHLY",
  
      createdAt: serverTimestamp(),
    });
  }