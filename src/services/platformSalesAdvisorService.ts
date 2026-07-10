import {
    addDoc,
    collection,
    getDocs,
    orderBy,
    query,
    serverTimestamp,
  } from "firebase/firestore";
  
  import { auth, db } from "../config/firebase";
  
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
    userId?: string | null;
    notes?: string;
  }) {
    await addDoc(collection(db, COLLECTION_NAME), {
      name: data.name,
      email: data.email,
      phone: data.phone,
  
      status: data.status,
      userId: data.userId || null,
  
      commissionYear1: data.commissionYear1,
  
      commissionRenewal: data.commissionRenewal,
  
      bonusLevel: data.bonusLevel,
  
      notes: data.notes || "",
  
      createdAt: serverTimestamp(),
  
      updatedAt: serverTimestamp(),
    });
  }

  export async function getCurrentSalesAdvisor(): Promise<PlatformSalesAdvisor | null> {
    const user = auth.currentUser;
    if (!user) return null;

    const advisors = await getSalesAdvisors();
    const activeAdvisors = advisors.filter((a) =>
      a.advisorStatus &&
      typeof a.advisorStatus === "string" &&
      ["active", "activo"].includes(a.advisorStatus.toLowerCase())
    );

    // 1. Try matching by userId
    if (user.uid) {
      const matchById = activeAdvisors.find((a) => (a as any).userId === user.uid);
      if (matchById) return matchById;
    }

    // 2. Try matching by email
    if (user.email) {
      const matchByEmail = activeAdvisors.find(
        (a) => a.email && typeof a.email === "string" && a.email.toLowerCase() === user.email!.toLowerCase()
      );
      if (matchByEmail) return matchByEmail;
    }

    return null;
  }

  const platformSalesAdvisorService = {
    getSalesAdvisors,
    createSalesAdvisor,
    getCurrentSalesAdvisor,
  };

  export default platformSalesAdvisorService;