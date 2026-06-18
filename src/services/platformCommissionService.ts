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
  import type {
    CommissionStatus,
    CommissionType,
    PlatformCommission,
  } from "../types/platformCommission";
  
  const COMMISSIONS_COLLECTION = "platform_commissions";
  
  function getCommissionRate(commissionType: CommissionType): number {
    if (commissionType === "RENEWAL") {
      return 0.05;
    }
  
    return 0.1;
  }
  
  export async function getCommissions(): Promise<PlatformCommission[]> {
    const q = query(
      collection(db, COMMISSIONS_COLLECTION),
      orderBy("createdAt", "desc")
    );
  
    const snapshot = await getDocs(q);
  
    return snapshot.docs.map((commissionDoc) => ({
      id: commissionDoc.id,
      ...(commissionDoc.data() as Omit<PlatformCommission, "id">),
    }));
  }
  
  export async function createCommissionFromPaidInvoice(data: {
    clientId: string;
    clientName: string;
    invoiceId: string;
    invoiceNumber: string;
    invoiceAmount: number;
    advisorId?: string;
    advisorName?: string;
    commissionType?: CommissionType;
  }) {
    const commissionType = data.commissionType || "FIRST_YEAR";
    const commissionRate = getCommissionRate(commissionType);
    const commissionAmount = Number(
      (data.invoiceAmount * commissionRate).toFixed(2)
    );
  
    await addDoc(collection(db, COMMISSIONS_COLLECTION), {
      advisorId: data.advisorId || "UNASSIGNED",
      advisorName: data.advisorName || "Sin asesor asignado",
      clientId: data.clientId,
      clientName: data.clientName,
      invoiceId: data.invoiceId,
      invoiceNumber: data.invoiceNumber,
      invoiceAmount: data.invoiceAmount,
      commissionType,
      commissionRate,
      commissionAmount,
      status: "PENDING",
      createdAt: serverTimestamp(),
    });
  }
  
  export async function updateCommissionStatus(
    commissionId: string,
    status: CommissionStatus
  ): Promise<void> {
    await updateDoc(doc(db, COMMISSIONS_COLLECTION, commissionId), {
      status,
      paidAt: status === "PAID" ? new Date().toISOString().slice(0, 10) : "",
      updatedAt: serverTimestamp(),
    });
  }