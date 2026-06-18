import {
    addDoc,
    collection,
    getDocs,
    orderBy,
    query,
    serverTimestamp,
  } from "firebase/firestore";
  
  import { db } from "../config/firebase";
  
  import type {
    PlatformSalesAdvisor,
    SalesAdvisorStatus,
  } from "../types/platformSalesAdvisor";
  
  const COLLECTION_NAME = "platform_sales_advisors";
  
  export async function getSalesAdvisors(): Promise<
    PlatformSalesAdvisor[]
  > {
    const q = query(
      collection(db, COLLECTION_NAME),
      orderBy("name", "asc")
    );
  
    const snapshot = await getDocs(q);
  
    return snapshot.docs.map((advisorDoc) => ({
      id: advisorDoc.id,
      ...(advisorDoc.data() as Omit<
        PlatformSalesAdvisor,
        "id"
      >),
    }));
  }
  
  export async function createSalesAdvisor(data: {
    name: string;
    email: string;
    phone: string;
    status: SalesAdvisorStatus;
    commissionYear1: number;
    commissionRenewal: number;
    bonusLevel: number;
    notes?: string;
  }) {
    await addDoc(collection(db, COLLECTION_NAME), {
      name: data.name,
      email: data.email,
      phone: data.phone,
  
      status: data.status,
  
      commissionYear1: data.commissionYear1,
  
      commissionRenewal: data.commissionRenewal,
  
      bonusLevel: data.bonusLevel,
  
      notes: data.notes || "",
  
      createdAt: serverTimestamp(),
  
      updatedAt: serverTimestamp(),
    });
  }